# -*- coding: utf-8 -*-
"""
A 股榜单批量 AI 分析（涨幅榜 / 成交量榜等），写入 analysis_history 批次字段并可选推送摘要。
"""
from __future__ import annotations

import logging
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, time, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from data_provider.base import canonical_stock_code
from src.analyzer import AnalysisResult
from src.config import Config, get_config
from src.core.pipeline import StockAnalysisPipeline
from src.core.trading_calendar import get_open_markets_today, is_market_open
from src.enums import ReportType
from src.services.market_scan_constants import (
    SCAN_KIND_GAINERS,
    SCAN_KIND_VOLUME,
    batch_id_prefix_for_scan_kind,
    batch_kind_for_scan_kind,
)

logger = logging.getLogger(__name__)

# 兼容旧 import
TOP_MOVERS_BATCH_KIND = batch_kind_for_scan_kind(SCAN_KIND_GAINERS)


def _parse_report_type(raw: str) -> ReportType:
    s = (raw or "simple").strip().lower()
    if s == "brief":
        return ReportType.BRIEF
    if s == "full":
        return ReportType.FULL
    return ReportType.SIMPLE


def _build_summary_markdown(
    batch_run_id: str,
    results: List[Optional[AnalysisResult]],
    top_k: int,
    scan_kind: str,
) -> str:
    ok = [r for r in results if r is not None and getattr(r, "success", False)]
    fail_n = len(results) - len(ok)
    if scan_kind == SCAN_KIND_VOLUME:
        title = "# 📊 A 股成交量榜 AI 扫描"
        metric_lbl = "当日涨跌"
    else:
        title = "# 📈 A 股涨幅榜 AI 扫描"
        metric_lbl = "当日涨跌"
    lines = [
        title,
        "",
        f"- **批次**: `{batch_run_id}`",
        f"- **成功**: {len(ok)} / {len(results)}（失败 {fail_n}）",
        "",
        f"## 按评分 Top {top_k}",
        "",
    ]
    ranked = sorted(
        ok,
        key=lambda x: (x.sentiment_score is not None, x.sentiment_score or 0),
        reverse=True,
    )[: max(1, top_k)]
    for r in ranked:
        pct = getattr(r, "change_pct", None)
        pct_s = f"{pct:+.2f}%" if pct is not None else "—"
        lines.append(
            f"- **{r.name}**（`{r.code}`）评分 **{r.sentiment_score}** | "
            f"{r.operation_advice} | {metric_lbl} {pct_s}"
        )
    lines.extend(["", "> 仅供参考，不构成投资建议。"])
    return "\n".join(lines)


def run_market_scan_batch(
    config: Optional[Config] = None,
    *,
    scan_kind: str = SCAN_KIND_GAINERS,
    dry_run: bool = False,
    send_notification: bool = True,
    force_run: bool = False,
    limit_override: Optional[int] = None,
    max_workers_override: Optional[int] = None,
    ignore_enabled_flag: bool = False,
    trade_date: Optional[date] = None,
) -> Dict[str, Any]:
    """
    榜单批量分析：``scan_kind=gainers`` 涨幅 Top N；``scan_kind=volume`` 成交量 Top N。

    Args:
        ignore_enabled_flag: CLI 显式调用时传 True，跳过 ``TOP_MOVERS_ENABLED`` 检查。
        trade_date: 可选；开市校验与 ``batch_run_id`` 日期段与该日一致（前缀 ``tm_`` / ``tv_``）。
    """
    sk = (scan_kind or SCAN_KIND_GAINERS).strip().lower()
    if sk not in {SCAN_KIND_GAINERS, SCAN_KIND_VOLUME}:
        sk = SCAN_KIND_GAINERS

    config = config or get_config()
    if not ignore_enabled_flag and not getattr(config, "top_movers_enabled", False):
        logger.info(
            "TOP_MOVERS_ENABLED=false，跳过榜单扫描（CLI: python main.py --market-scan 或 --top-movers）"
        )
        return {"skipped": True, "reason": "disabled"}

    label = "成交量榜" if sk == SCAN_KIND_VOLUME else "涨幅榜"

    if not force_run and getattr(config, "trading_day_check_enabled", True):
        if trade_date is not None:
            if not is_market_open("cn", trade_date):
                logger.info(
                    "指定日期 %s 非 A 股交易日，跳过%s扫描（请换交易日或 --force-run）",
                    trade_date.isoformat(),
                    label,
                )
                return {
                    "skipped": True,
                    "reason": "cn_date_not_trading_day",
                    "trade_date": trade_date.isoformat(),
                    "scan_kind": sk,
                }
        elif "cn" not in get_open_markets_today():
            logger.info(
                "今日 A 股非交易日，跳过%s扫描（可用 --market-scan-date / --top-movers-date 或 --force-run）",
                label,
            )
            return {"skipped": True, "reason": "cn_market_closed", "scan_kind": sk}

    limit = limit_override if limit_override is not None else getattr(config, "top_movers_limit", 200)
    exclude_st = getattr(config, "top_movers_exclude_st", True)

    day_tag = (
        trade_date.strftime("%Y%m%d")
        if trade_date is not None
        else datetime.now(timezone.utc).strftime("%Y%m%d")
    )
    prefix = batch_id_prefix_for_scan_kind(sk)
    batch_run_id = f"{prefix}{day_tag}_{uuid.uuid4().hex[:8]}"
    batch_kind = batch_kind_for_scan_kind(sk)

    max_workers = max_workers_override if max_workers_override is not None else getattr(
        config, "top_movers_max_workers", None
    )
    if max_workers is None:
        max_workers = getattr(config, "max_workers", 3)
    max_workers = max(1, int(max_workers))

    rt_raw = getattr(config, "top_movers_report_type", None) or getattr(config, "report_type", "simple")
    report_type = _parse_report_type(str(rt_raw))

    pipeline = StockAnalysisPipeline(
        config=config,
        max_workers=max_workers,
        query_id=batch_run_id,
        query_source=f"market_scan_{sk}",
    )

    fm = pipeline.fetcher_manager
    if sk == SCAN_KIND_VOLUME:
        universe = fm.get_cn_top_volume_universe(
            limit=int(limit),
            exclude_st=exclude_st,
            trade_date=trade_date,
        )
    else:
        universe = fm.get_cn_top_movers_universe(
            limit=int(limit),
            exclude_st=exclude_st,
            trade_date=trade_date,
        )

    if not universe:
        logger.error("%s股票池为空，终止", label)
        return {
            "skipped": True,
            "reason": "empty_universe",
            "batch_run_id": batch_run_id,
            "scan_kind": sk,
        }

    if getattr(config, "top_movers_dedupe_watchlist", True):
        config.refresh_stock_list()
        watch = {
            canonical_stock_code(c)
            for c in (config.stock_list or [])
            if (c or "").strip()
        }
        before = len(universe)
        universe = [e for e in universe if e.get("code") not in watch]
        logger.info("与自选股去重: %d -> %d", before, len(universe))
    if not universe:
        logger.info("去重后股票池为空，终止")
        return {
            "skipped": True,
            "reason": "empty_after_dedupe",
            "batch_run_id": batch_run_id,
            "scan_kind": sk,
        }

    codes = [e["code"] for e in universe]
    if len(codes) >= 5:
        pipeline.fetcher_manager.prefetch_realtime_quotes(codes)
    if not dry_run:
        pipeline.fetcher_manager.prefetch_stock_names(codes, use_bulk=False)

    if trade_date is not None:
        sh = ZoneInfo("Asia/Shanghai")
        resume_reference_time = datetime.combine(
            trade_date, time(15, 0), tzinfo=sh
        ).astimezone(timezone.utc)
    else:
        resume_reference_time = datetime.now(timezone.utc)

    results: List[Optional[AnalysisResult]] = []
    history_extras: Dict[str, Dict[str, Any]] = {}
    for e in universe:
        code = e["code"]
        extra: Dict[str, Any] = {
            "batch_kind": batch_kind,
            "batch_run_id": batch_run_id,
            "rank_in_batch": e["rank"],
            "ref_change_pct": e.get("change_pct"),
        }
        if sk == SCAN_KIND_VOLUME and e.get("trade_volume") is not None:
            extra["ref_trade_volume"] = float(e["trade_volume"])
        history_extras[code] = extra

    logger.info(
        "开始%s批量分析 batch_run_id=%s scan_kind=%s 数量=%d 并发=%d 报告=%s dry_run=%s",
        label,
        batch_run_id,
        sk,
        len(codes),
        max_workers,
        report_type.value,
        dry_run,
    )

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_code = {
            executor.submit(
                pipeline.process_single_stock,
                code,
                skip_analysis=dry_run,
                single_stock_notify=False,
                report_type=report_type,
                analysis_query_id=uuid.uuid4().hex,
                current_time=resume_reference_time,
                history_extra=history_extras.get(code),
            ): code
            for code in codes
        }
        for fut in as_completed(future_to_code):
            code = future_to_code[fut]
            try:
                results.append(fut.result())
            except Exception as exc:
                logger.exception("[%s] %s分析任务异常: %s", code, label, exc)
                results.append(None)

    success_n = sum(1 for r in results if r is not None and getattr(r, "success", False))
    notify_ok = False
    if (
        send_notification
        and getattr(config, "top_movers_notify_enabled", True)
        and not dry_run
        and pipeline.notifier.is_available()
    ):
        top_k = max(1, int(getattr(config, "top_movers_notify_top_k", 15)))
        body = _build_summary_markdown(batch_run_id, results, top_k, sk)
        notify_ok = bool(pipeline.notifier.send(body, email_send_to_all=True))
        if notify_ok:
            logger.info("%s汇总通知已发送", label)
        else:
            logger.warning("%s汇总通知发送失败", label)

    return {
        "skipped": False,
        "batch_run_id": batch_run_id,
        "scan_kind": sk,
        "universe_size": len(codes),
        "success_count": success_n,
        "failure_count": len(results) - success_n,
        "notification_sent": notify_ok,
    }
