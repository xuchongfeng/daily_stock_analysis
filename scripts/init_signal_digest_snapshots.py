# -*- coding: utf-8 -*-
"""初始化信号摘要历史快照（14/100、30/100）。"""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from src.core.trading_calendar import is_market_open
from src.services.signal_digest_service import build_signal_digest
from src.storage import DatabaseManager


def _parse_date(text: str) -> date:
    return date.fromisoformat((text or "").strip())


def main() -> None:
    parser = argparse.ArgumentParser(description="初始化信号摘要历史快照")
    parser.add_argument("--date-from", required=True, help="起始日期，格式 YYYY-MM-DD")
    parser.add_argument("--date-to", required=True, help="结束日期，格式 YYYY-MM-DD")
    parser.add_argument("--market", default="cn", choices=["cn", "hk", "us", "all"])
    parser.add_argument("--advice-filter", default="buy_or_hold", choices=["any", "buy_or_hold"])
    parser.add_argument("--exclude-batch", action=argparse.BooleanOptionalAction, default=False)
    parser.add_argument("--batch-only", action=argparse.BooleanOptionalAction, default=True)
    args = parser.parse_args()

    d_from = _parse_date(args.date_from)
    d_to = _parse_date(args.date_to)
    if d_from > d_to:
        raise SystemExit("date-from 不能晚于 date-to")

    db = DatabaseManager.get_instance()
    processed = 0
    skipped = 0
    written = 0

    cur = d_from
    while cur <= d_to:
        if not is_market_open("cn", cur):
            skipped += 1
            cur += timedelta(days=1)
            continue
        processed += 1
        for sessions in (14, 30):
            payload = build_signal_digest(
                db,
                trading_sessions=sessions,
                top_k=100,
                market_filter=args.market,
                exclude_batch=bool(args.exclude_batch),
                batch_only=bool(args.batch_only),
                advice_filter=args.advice_filter,
                with_narrative=False,
                anchor_date_override=cur,
            )
            db.upsert_signal_digest_snapshot(
                snapshot_date=cur,
                trading_sessions=sessions,
                top_k=100,
                market_filter=args.market,
                exclude_batch=bool(args.exclude_batch),
                batch_only=bool(args.batch_only),
                advice_filter=args.advice_filter,
                payload=payload,
            )
            written += 1
        print(f"[ok] {cur.isoformat()} -> 14/100 + 30/100")
        cur += timedelta(days=1)

    print(
        f"完成: processed_trading_days={processed}, skipped_non_trading_days={skipped}, written_snapshots={written}"
    )


if __name__ == "__main__":
    main()

