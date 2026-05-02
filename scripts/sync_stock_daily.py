#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将个股日线 OHLCV 拉取并写入本地 SQLite ``stock_daily``，供 K 线图等能力复用。

用法：
  python scripts/sync_stock_daily.py --codes 600519,AAPL
  python scripts/sync_stock_daily.py --stock-list
  python scripts/sync_stock_daily.py --stock-list --full

环境变量：
  STOCK_DAILY_SYNC_LOOKBACK_DAYS   无本地历史或 --full 时的回溯自然日数，默认 365

定时任务示例（工作日盘后）：
  0 18 * * 1-5 cd /path/to/repo && ./venv/bin/python scripts/sync_stock_daily.py --stock-list

退出码：任一只股票同步失败则为 1（便于 cron 告警）；未指定任何代码为 2。
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.config import setup_env

setup_env()

from src.config import get_config  # noqa: E402
from src.logging_config import setup_logging  # noqa: E402
from src.services.stock_daily_sync_service import (  # noqa: E402
    StockDailySyncResult,
    sync_many_stock_daily_bars,
)


def _parse_codes(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [p.strip() for p in raw.split(",") if p.strip()]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sync stock daily OHLCV into stock_daily table.")
    parser.add_argument(
        "--codes",
        type=str,
        default="",
        help="Comma-separated stock codes (e.g. 600519,hk00700,AAPL)",
    )
    parser.add_argument(
        "--stock-list",
        action="store_true",
        help="Use STOCK_LIST from config (.env / persisted settings)",
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Ignore incremental state; refetch last LOOKBACK days and upsert",
    )
    parser.add_argument(
        "--lookback-days",
        type=int,
        default=int(os.getenv("STOCK_DAILY_SYNC_LOOKBACK_DAYS", "365")),
        help="Natural-day lookback when DB empty or with --full (default env or 365)",
    )
    args = parser.parse_args(argv)

    setup_logging()
    log = logging.getLogger("sync_stock_daily")

    codes = _parse_codes(args.codes)
    if args.stock_list:
        cfg = get_config()
        codes.extend(cfg.stock_list or [])

    # de-dupe preserving order
    deduped: list[str] = []
    seen: set[str] = set()
    for c in codes:
        k = c.strip().upper()
        if k and k not in seen:
            seen.add(k)
            deduped.append(k)

    if not deduped:
        log.error("No stock codes: pass --codes or --stock-list")
        return 2

    log.info(
        "sync_stock_daily: count=%s full=%s lookback_days=%s",
        len(deduped),
        args.full,
        args.lookback_days,
    )

    results = sync_many_stock_daily_bars(
        deduped,
        lookback_days=max(5, args.lookback_days),
        full=args.full,
    )

    for r in results:
        log.info("%s", r.describe())

    failed = [r for r in results if not r.ok]
    if failed:
        log.error("sync_stock_daily: %s failure(s)", len(failed))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
