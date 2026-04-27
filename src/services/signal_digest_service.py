# -*- coding: utf-8 -*-
"""
近窗分析记录二次聚合（信号摘要 MVP）。

基于 ``analysis_history`` 在若干交易日窗口内的多笔记录，按规则打分、取 Top-K，
并从最新记录的 ``context_snapshot`` 抽取归属板块做共现统计；可选调用 LLM 生成短文。
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from collections import Counter
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from src.analyzer import GeminiAnalyzer
from src.config import get_config
from src.core.trading_calendar import (
    get_effective_trading_date,
    get_market_for_stock,
    get_oldest_date_in_trading_window,
)
from src.storage import AnalysisHistory, DatabaseManager
from src.utils.data_processing import extract_board_detail_fields

logger = logging.getLogger(__name__)

_SUMMARY_EXCERPT_LEN = 220


def _normalize_by_range(values: List[float]) -> List[float]:
    if not values:
        return []
    mn = min(values)
    mx = max(values)
    if abs(mx - mn) < 1e-9:
        return [1.0 for _ in values]
    return [(v - mn) / (mx - mn) for v in values]


def _allocate_quotas(
    candidate_counts: List[int],
    target: int,
    min_per_board: int,
    max_per_board: int,
) -> List[int]:
    if not candidate_counts:
        return []
    capped = [max(0, min(int(n), int(max_per_board))) for n in candidate_counts]
    total = sum(capped)
    if total <= target:
        return capped
    board_count = len(capped)
    min_feasible = min(min_per_board, max(0, target // max(1, board_count)))
    base = [min(n, min_feasible) for n in capped]
    remain = target - sum(base)
    if remain < 0:
        # 极端兜底（理论上不应触发）
        out = base[:]
        i = len(out) - 1
        while sum(out) > target and i >= 0:
            if out[i] > 0:
                out[i] -= 1
            i -= 1
            if i < 0 and sum(out) > target:
                i = len(out) - 1
        return out

    raw = [(target * n / total) if total > 0 else 0.0 for n in capped]
    frac_order = sorted(
        [{"idx": i, "frac": raw[i] - int(raw[i])} for i in range(len(raw))],
        key=lambda x: x["frac"],
        reverse=True,
    )
    while remain > 0:
        assigned = False
        for it in frac_order:
            idx = int(it["idx"])
            if base[idx] < capped[idx]:
                base[idx] += 1
                remain -= 1
                assigned = True
                if remain == 0:
                    break
        if not assigned:
            break
    return base


def is_buy_or_hold_advice(operation_advice: Optional[str]) -> bool:
    """
    True if ``operation_advice`` reads as 买入/加仓/持有/增持 等偏多或持有建议。

    显式卖出/减仓/回避类返回 False；无法识别的文案（如仅「观望」）返回 False。
    """
    if not operation_advice or not str(operation_advice).strip():
        return False
    t = str(operation_advice).strip().lower()
    bear = ("卖", "减持", "回避", "看空", "卖出", "减仓", "清仓", "sell", "short")
    for k in bear:
        if k in t:
            return False
    bull_hold = (
        "买入",
        "加仓",
        "持有",
        "增持",
        "推荐",
        "buy",
        "hold",
        "accumulate",
        "long",
    )
    for k in bull_hold:
        if k in t:
            return True
    return False


def advice_bias(operation_advice: Optional[str]) -> float:
    if not operation_advice:
        return 0.0
    t = operation_advice.strip().lower()
    bull = ("买", "增持", "推荐", "看多", "买入", "加仓", "buy", "long")
    bear = ("卖", "减持", "回避", "看空", "卖出", "减仓", "sell", "short")
    for k in bull:
        if k in t:
            return 12.0
    for k in bear:
        if k in t:
            return -12.0
    return 0.0


def compute_pick_score(
    latest_sentiment: Optional[int],
    appearance_count: int,
    operation_advice: Optional[str],
) -> float:
    base = float(latest_sentiment if latest_sentiment is not None else 50)
    freq = min(float(appearance_count) * 7.0, 35.0)
    bias = advice_bias(operation_advice)
    score = base * 0.45 + freq + bias
    return max(0.0, min(score, 100.0))


def compute_signal_digest_cache_key(
    *,
    trading_sessions: int,
    top_k: int,
    market_filter: str,
    exclude_batch: bool,
    batch_only: bool,
    advice_filter: str,
    with_narrative: bool,
) -> str:
    """
    稳定哈希：参数 + 锚定交易日。锚定日变化（如新交易日）自然使旧缓存失效。
    """
    cal_mkt = _calendar_market_for_filter(market_filter)
    anchor = get_effective_trading_date(cal_mkt)
    blob = json.dumps(
        {
            "anchor_date": anchor.isoformat(),
            "advice_filter": (advice_filter or "any").strip().lower(),
            "batch_only": bool(batch_only),
            "exclude_batch": bool(exclude_batch),
            "market_filter": (market_filter or "cn").strip().lower(),
            "top_k": int(top_k),
            "trading_sessions": int(trading_sessions),
            "with_narrative": bool(with_narrative),
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _calendar_market_for_filter(market_filter: str) -> str:
    mf = (market_filter or "cn").strip().lower()
    if mf in ("cn", "hk", "us"):
        return mf
    return "cn"


def _passes_market_filter(code: str, market_filter: str) -> bool:
    mf = (market_filter or "all").strip().lower()
    if mf == "all":
        return True
    m = get_market_for_stock(code)
    return m == mf


def _excerpt(text: Optional[str], max_len: int = _SUMMARY_EXCERPT_LEN) -> Optional[str]:
    if not text or not str(text).strip():
        return None
    s = re.sub(r"\s+", " ", str(text).strip())
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def _boards_from_record(rec: AnalysisHistory) -> List[Dict[str, Any]]:
    detail = extract_board_detail_fields(rec.context_snapshot)
    boards = detail.get("belong_boards") or []
    out: List[Dict[str, Any]] = []
    if isinstance(boards, list):
        for b in boards[:5]:
            if isinstance(b, dict) and b.get("name"):
                item: Dict[str, Any] = {"name": str(b["name"]).strip()}
                if b.get("code") is not None:
                    item["code"] = str(b.get("code")).strip()
                if b.get("type") is not None:
                    item["type"] = str(b.get("type")).strip()
                out.append(item)
    return out


def _build_narrative_prompt(
    *,
    window: Dict[str, Any],
    picks: List[Dict[str, Any]],
    board_highlights: List[Dict[str, Any]],
    concept_highlights: List[Dict[str, Any]],
) -> str:
    compact = {
        "window": window,
        "board_highlights": board_highlights[:12],
        "concept_highlights": concept_highlights[:16],
        "picks": [
            {
                "code": p["code"],
                "name": p.get("name"),
                "score": p.get("score"),
                "appearance_count": p.get("appearance_count"),
                "operation_advice": p.get("operation_advice"),
                "trend_prediction": p.get("trend_prediction"),
                "boards": [b.get("name") for b in (p.get("boards") or []) if b.get("name")],
            }
            for p in picks[:8]
        ],
    }
    blob = json.dumps(compact, ensure_ascii=False)
    return (
        "你是二级市场复盘助手。根据以下 JSON（系统内在近若干交易日写入的分析记录聚合结果，"
        "非实时行情），用简洁中文 Markdown 输出：\n"
        "1) 用 2～4 句做摘要；\n"
        "2) 「板块关注点」用小标题 + 列表（基于 board_highlights 与 picks 中的板块，勿臆造）；\n"
        "3) 「标的速览」对 Top 标的各一行点评（可合并同类表述）。\n"
        "不要编造 JSON 之外的事实或新闻。若信息不足请明确说明。\n\n"
        f"JSON:\n{blob}\n"
    )


def build_signal_digest(
    db: DatabaseManager,
    *,
    trading_sessions: int = 14,
    top_k: int = 10,
    market_filter: str = "cn",
    exclude_batch: bool = False,
    batch_only: bool = False,
    advice_filter: str = "any",
    with_narrative: bool = True,
    anchor_date_override: Optional[date] = None,
) -> Dict[str, Any]:
    cal_mkt = _calendar_market_for_filter(market_filter)
    anchor_date = anchor_date_override or get_effective_trading_date(cal_mkt)
    oldest_date = get_oldest_date_in_trading_window(cal_mkt, trading_sessions, anchor_date)
    since = datetime.combine(oldest_date, datetime.min.time())
    until = datetime.combine(anchor_date, datetime.max.time())

    if batch_only and exclude_batch:
        raise ValueError("batch_only and exclude_batch are mutually exclusive")

    af = (advice_filter or "any").strip().lower()
    if af not in ("any", "buy_or_hold"):
        raise ValueError("advice_filter must be 'any' or 'buy_or_hold'")

    rows = db.list_analysis_history_since(
        since,
        exclude_batch=exclude_batch and not batch_only,
        batch_only=batch_only,
        limit=200_000,
    )
    # 锚定历史日期时，必须同时限制上界到 anchor_date 当日，避免混入未来日期记录。
    rows = [r for r in rows if (getattr(r, "created_at", None) is None or r.created_at <= until)]
    rows_fetched = len(rows)
    if af == "buy_or_hold":
        rows = [r for r in rows if is_buy_or_hold_advice(r.operation_advice)]

    by_code: Dict[str, List[AnalysisHistory]] = {}
    for rec in rows:
        if not rec.code:
            continue
        if not _passes_market_filter(rec.code, market_filter):
            continue
        by_code.setdefault(rec.code, []).append(rec)

    for code, lst in by_code.items():
        lst.sort(key=lambda r: r.created_at or datetime.min, reverse=True)

    picks_raw: List[Tuple[float, AnalysisHistory, int]] = []
    for code, lst in by_code.items():
        if not lst:
            continue
        latest = lst[0]
        n = len(lst)
        score = compute_pick_score(latest.sentiment_score, n, latest.operation_advice)
        picks_raw.append((score, latest, n))

    picks_raw.sort(key=lambda x: (-x[0], -x[2], x[1].code or ""))

    boards_by_code: Dict[str, List[Dict[str, Any]]] = {}
    board_counter_all: Counter[str] = Counter()
    for _score, latest, _n in picks_raw:
        code = latest.code or ""
        boards = _boards_from_record(latest)
        boards_by_code[code] = boards
        for b in boards[:3]:
            name = b.get("name")
            if name:
                board_counter_all[str(name)] += 1

    top = picks_raw[: max(1, min(int(top_k), 100))]

    picks_out: List[Dict[str, Any]] = []
    board_counter_top: Counter[str] = Counter()
    for score, latest, n in top:
        boards = boards_by_code.get(latest.code or "", [])
        for b in boards[:3]:
            name = b.get("name")
            if name:
                board_counter_top[str(name)] += 1
        created = latest.created_at.isoformat() if latest.created_at else None
        picks_out.append(
            {
                "code": latest.code,
                "name": latest.name,
                "score": round(score, 2),
                "appearance_count": n,
                "latest_created_at": created,
                "sentiment_score": latest.sentiment_score,
                "operation_advice": latest.operation_advice,
                "trend_prediction": latest.trend_prediction,
                "analysis_summary_excerpt": _excerpt(latest.analysis_summary),
                "boards": boards,
            }
        )

    board_highlights = [
        {"name": name, "count": c}
        for name, c in board_counter_top.most_common(16)
    ]
    board_highlights_all = [
        {"name": name, "count": c}
        for name, c in board_counter_all.most_common(32)
    ]
    all_codes = [str(x[1].code or "").strip() for x in picks_raw if str(x[1].code or "").strip()]
    top_codes = [str(x[1].code or "").strip() for x in top if str(x[1].code or "").strip()]
    concept_highlights_all = []
    concept_highlights = []
    concept_tags_by_code: Dict[str, List[str]] = {}
    if hasattr(db, "get_concept_board_highlights_by_codes"):
        try:
            all_raw = db.get_concept_board_highlights_by_codes(all_codes, limit=32)
            top_raw = db.get_concept_board_highlights_by_codes(top_codes, limit=16)
            concept_highlights_all = all_raw if isinstance(all_raw, list) else []
            concept_highlights = top_raw if isinstance(top_raw, list) else []
        except Exception as exc:
            logger.exception("signal_digest concept highlights failed: %s", exc)
            concept_highlights_all = []
            concept_highlights = []
    if hasattr(db, "get_concept_tags_by_codes"):
        try:
            tags_raw = db.get_concept_tags_by_codes(top_codes, per_stock_limit=8)
            concept_tags_by_code = tags_raw if isinstance(tags_raw, dict) else {}
        except Exception as exc:
            logger.exception("signal_digest concept tags failed: %s", exc)
            concept_tags_by_code = {}

    for p in picks_out:
        code = str(p.get("code") or "").strip()
        p["concept_tags"] = concept_tags_by_code.get(code, [])
    window_info = {
        "trading_sessions": max(1, int(trading_sessions)),
        "anchor_date": anchor_date.isoformat(),
        "oldest_date": oldest_date.isoformat(),
        "rows_considered": rows_fetched,
        "rows_after_advice_filter": len(rows),
        "distinct_stocks": len(by_code),
        "market_filter": (market_filter or "cn").strip().lower(),
        "exclude_batch": bool(exclude_batch) and not batch_only,
        "batch_only": bool(batch_only),
        "advice_filter": af,
    }

    narrative_md: Optional[str] = None
    narrative_generated = False
    if with_narrative and picks_out:
        try:
            analyzer = GeminiAnalyzer(config=get_config())
            prompt = _build_narrative_prompt(
                window=window_info,
                picks=picks_out,
                board_highlights=board_highlights,
                concept_highlights=concept_highlights,
            )
            narrative_md = analyzer.generate_text(
                prompt,
                max_tokens=1024,
                temperature=0.35,
                usage_call_type="signal_digest",
            )
            narrative_generated = bool(narrative_md and narrative_md.strip())
        except Exception as exc:
            logger.warning("signal_digest narrative skipped: %s", exc)

    return {
        "window": window_info,
        "picks": picks_out,
        "board_highlights": board_highlights,
        "board_highlights_all": board_highlights_all,
        "concept_highlights": concept_highlights,
        "concept_highlights_all": concept_highlights_all,
        "narrative_markdown": narrative_md,
        "narrative_generated": narrative_generated,
    }


def build_portfolio_selection_from_digest(
    digest_payload: Dict[str, Any],
    *,
    top_board_count: int = 4,
    per_board_candidate: int = 5,
    target_count: int = 12,
    min_per_board: int = 2,
    high_score_threshold: float = 75.0,
    shrink_k: float = 10.0,
) -> Dict[str, Any]:
    picks = list(digest_payload.get("picks") or [])
    eligible_picks = [
        p for p in picks
        if float((p or {}).get("score") or 0.0) > float(high_score_threshold)
    ]
    if not eligible_picks:
        return {
            "window": digest_payload.get("window") or {},
            "strategy": {
                "top_board_count": top_board_count,
                "per_board_candidate": per_board_candidate,
                "target_count": target_count,
                "min_per_board": min_per_board,
                "high_score_threshold": high_score_threshold,
                "shrink_k": shrink_k,
            },
            "boards": [],
            "selected": [],
        }

    high_count_all = sum(1 for p in eligible_picks if float(p.get("score") or 0.0) > high_score_threshold)
    global_high_ratio = high_count_all / max(1, len(eligible_picks))

    concept_names: set[str] = set()
    for p in eligible_picks:
        for tag in (p.get("concept_tags") or []):
            if tag:
                concept_names.add(str(tag))

    raw_stats: List[Dict[str, Any]] = []
    for name in concept_names:
        members = [
            p
            for p in eligible_picks
            if name in [str(t) for t in (p.get("concept_tags") or [])]
        ]
        members.sort(key=lambda x: float(x.get("score") or 0.0), reverse=True)
        stock_count = len(members)
        high_score_count = sum(1 for p in members if float(p.get("score") or 0.0) >= high_score_threshold)
        ratio_adj = (
            (high_score_count + shrink_k * global_high_ratio) / (stock_count + shrink_k)
            if stock_count > 0
            else 0.0
        )
        raw_stats.append(
            {
                "name": name,
                "members": members,
                "stock_count": stock_count,
                "high_score_count": high_score_count,
                "high_score_ratio_adj": ratio_adj,
                "mix": float(high_score_count) * float(ratio_adj),
            }
        )

    norm_h = _normalize_by_range([float(x["high_score_count"]) for x in raw_stats])
    norm_r = _normalize_by_range([float(x["high_score_ratio_adj"]) for x in raw_stats])
    norm_mix = _normalize_by_range([float(x["mix"]) for x in raw_stats])
    for i, item in enumerate(raw_stats):
        item["board_strength"] = round(0.35 * norm_h[i] + 0.45 * norm_r[i] + 0.2 * norm_mix[i], 6)

    top_boards = sorted(raw_stats, key=lambda x: float(x["board_strength"]), reverse=True)[: max(1, int(top_board_count))]
    for b in top_boards:
        b["candidates"] = list(b["members"][: max(1, int(per_board_candidate))])

    quotas = _allocate_quotas(
        [len(b["candidates"]) for b in top_boards],
        int(target_count),
        int(min_per_board),
        int(per_board_candidate),
    )

    board_stats = []
    for i, b in enumerate(top_boards):
        board_stats.append(
            {
                "name": b["name"],
                "board_strength": float(b["board_strength"]),
                "stock_count": int(b["stock_count"]),
                "high_score_count": int(b["high_score_count"]),
                "high_score_ratio_adj": float(b["high_score_ratio_adj"]),
                "candidate_count": len(b["candidates"]),
                "quota": int(quotas[i] if i < len(quotas) else 0),
            }
        )

    selected_by_code: Dict[str, Dict[str, Any]] = {}
    used_by_board: Dict[str, int] = {str(b["name"]): 0 for b in top_boards}

    def _add_selected(pick: Dict[str, Any], board_name: str, reason: str) -> None:
        code = str(pick.get("code") or "").strip()
        if not code or code in selected_by_code:
            return
        selected_by_code[code] = {
            **pick,
            "board_name": board_name,
            "selected_reason": reason,
        }
        used_by_board[board_name] = int(used_by_board.get(board_name, 0)) + 1

    # Step1: 板块保底
    for i, board in enumerate(top_boards):
        name = str(board["name"])
        quota = int(quotas[i] if i < len(quotas) else 0)
        guarantee = min(int(min_per_board), quota)
        for pick in board["candidates"]:
            if len(selected_by_code) >= int(target_count):
                break
            if int(used_by_board.get(name, 0)) >= guarantee:
                break
            _add_selected(pick, name, "板块保底")

    # Step2: 20池内全局补位
    flattened = []
    for board in top_boards:
        name = str(board["name"])
        strength = float(board["board_strength"])
        for pick in board["candidates"]:
            flattened.append({"pick": pick, "board_name": name, "strength": strength})
    flattened.sort(
        key=lambda x: (
            -float((x["pick"] or {}).get("score") or 0.0),
            -float(x["strength"]),
            str((x["pick"] or {}).get("code") or ""),
        )
    )
    quota_by_board = {str(top_boards[i]["name"]): int(quotas[i] if i < len(quotas) else 0) for i in range(len(top_boards))}
    for item in flattened:
        if len(selected_by_code) >= int(target_count):
            break
        board_name = str(item["board_name"])
        if int(used_by_board.get(board_name, 0)) >= int(quota_by_board.get(board_name, 0)):
            continue
        _add_selected(dict(item["pick"]), board_name, "全局补位")

    # Step3: 候选外补位
    top_board_name_set = {str(b["name"]) for b in top_boards}
    fallback = sorted(
        eligible_picks,
        key=lambda p: (
            -float(p.get("score") or 0.0),
            str(p.get("code") or ""),
        ),
    )
    for pick in fallback:
        if len(selected_by_code) >= int(target_count):
            break
        tags = [str(t) for t in (pick.get("concept_tags") or []) if t]
        board_name = next((t for t in tags if t in top_board_name_set), "其他")
        _add_selected(pick, board_name, "候选外补位")

    selected = sorted(
        list(selected_by_code.values()),
        key=lambda x: (
            -float(x.get("score") or 0.0),
            str(x.get("code") or ""),
        ),
    )[: int(target_count)]

    return {
        "window": digest_payload.get("window") or {},
        "strategy": {
            "top_board_count": int(top_board_count),
            "per_board_candidate": int(per_board_candidate),
            "target_count": int(target_count),
            "min_per_board": int(min_per_board),
            "high_score_threshold": float(high_score_threshold),
            "shrink_k": float(shrink_k),
        },
        "boards": board_stats,
        "selected": selected,
    }


def build_portfolio_selection(
    db: DatabaseManager,
    *,
    trading_sessions: int = 14,
    top_k: int = 100,
    market_filter: str = "cn",
    exclude_batch: bool = False,
    batch_only: bool = True,
    advice_filter: str = "buy_or_hold",
    top_board_count: int = 4,
    per_board_candidate: int = 5,
    target_count: int = 12,
    min_per_board: int = 2,
    high_score_threshold: float = 75.0,
    shrink_k: float = 10.0,
    anchor_date_override: Optional[date] = None,
) -> Dict[str, Any]:
    digest_payload = build_signal_digest(
        db,
        trading_sessions=trading_sessions,
        top_k=top_k,
        market_filter=market_filter,
        exclude_batch=exclude_batch,
        batch_only=batch_only,
        advice_filter=advice_filter,
        with_narrative=False,
        anchor_date_override=anchor_date_override,
    )
    return build_portfolio_selection_from_digest(
        digest_payload,
        top_board_count=top_board_count,
        per_board_candidate=per_board_candidate,
        target_count=target_count,
        min_per_board=min_per_board,
        high_score_threshold=high_score_threshold,
        shrink_k=shrink_k,
    )
