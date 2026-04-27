# -*- coding: utf-8 -*-
"""临时脚本：初始化最近 N 个交易日信号摘要快照（默认 20 日，3/14/30/60，Top100）。"""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import List

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src.core.trading_calendar import get_effective_trading_date, is_market_open
from src.services.signal_digest_service import build_signal_digest
from src.storage import DatabaseManager


def _parse_sessions(text: str) -> List[int]:
    raw = [x.strip() for x in (text or "").split(",") if x.strip()]
    if not raw:
        raise ValueError("sessions 不能为空")
    out: List[int] = []
    for item in raw:
        n = int(item)
        if n < 3 or n > 60:
            raise ValueError(f"sessions 中存在非法窗口: {n}（需在 3~60）")
        out.append(n)
    return sorted(set(out))


def _collect_recent_trading_days(*, anchor: date, trading_days: int) -> List[date]:
    out: List[date] = []
    cur = anchor
    while len(out) < trading_days:
        if is_market_open("cn", cur):
            out.append(cur)
        cur -= timedelta(days=1)
    out.sort()
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="临时初始化最近 N 个交易日信号摘要快照")
    parser.add_argument("--trading-days", type=int, default=20, help="最近交易日数量（默认 20）")
    parser.add_argument("--sessions", default="3,14,30,60", help="交易日窗口，逗号分隔（默认 3,14,30,60）")
    parser.add_argument("--top-k", type=int, default=100, help="Top K（默认 100）")
    parser.add_argument("--market", default="cn", choices=["cn", "hk", "us", "all"])
    parser.add_argument("--advice-filter", default="buy_or_hold", choices=["any", "buy_or_hold"])
    parser.add_argument("--exclude-batch", action=argparse.BooleanOptionalAction, default=False)
    parser.add_argument("--batch-only", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--anchor-date", default="", help="锚定日期 YYYY-MM-DD（默认最新有效交易日）")
    args = parser.parse_args()

    if args.trading_days <= 0:
        raise SystemExit("trading-days 必须大于 0")
    if args.top_k <= 0:
        raise SystemExit("top-k 必须大于 0")

    sessions = _parse_sessions(args.sessions)
    anchor = date.fromisoformat(args.anchor_date) if args.anchor_date else get_effective_trading_date("cn")
    days = _collect_recent_trading_days(anchor=anchor, trading_days=int(args.trading_days))

    db = DatabaseManager.get_instance()
    written = 0

    print(
        f"开始初始化: trading_days={args.trading_days}, sessions={sessions}, top_k={args.top_k}, "
        f"date_range={days[0].isoformat()}~{days[-1].isoformat()}"
    )
    for d in days:
        for sess in sessions:
            payload = build_signal_digest(
                db,
                trading_sessions=sess,
                top_k=int(args.top_k),
                market_filter=args.market,
                exclude_batch=bool(args.exclude_batch),
                batch_only=bool(args.batch_only),
                advice_filter=args.advice_filter,
                with_narrative=False,
                anchor_date_override=d,
            )
            db.upsert_signal_digest_snapshot(
                snapshot_date=d,
                trading_sessions=sess,
                top_k=int(args.top_k),
                market_filter=args.market,
                exclude_batch=bool(args.exclude_batch),
                batch_only=bool(args.batch_only),
                advice_filter=args.advice_filter,
                payload=payload,
            )
            written += 1
        print(f"[ok] {d.isoformat()} -> sessions={sessions}, top_k={args.top_k}")

    print(
        f"完成: trading_days={len(days)}, sessions={len(sessions)}, "
        f"written_snapshots={written}"
    )


if __name__ == "__main__":
    main()

