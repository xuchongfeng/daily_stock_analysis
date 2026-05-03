#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将个股日线 OHLCV 拉取并写入本地 SQLite ``stock_daily``，供 K 线图等能力复用。

用法：
  python scripts/sync_stock_daily.py --codes 600519,AAPL
  python scripts/sync_stock_daily.py --stock-list
  python scripts/sync_stock_daily.py --stock-list --full

全市场（需先运行 scripts/fetch_tushare_stock_list.py 生成 CSV）最近 365 天示例：
  python scripts/sync_stock_daily.py --all-markets cn,hk,us --lookback-days 365
  python scripts/sync_stock_daily.py --all-markets cn --limit 50 --sleep-seconds 0.3

环境变量：
  STOCK_DAILY_SYNC_LOOKBACK_DAYS   无本地历史或 --full 时的回溯自然日数，默认 365
  STOCK_DAILY_SYNC_DATA_SOURCE    auto（默认多源）或 tushare（仅 TuShare；港股/美股日线依接口而定）

定时任务示例（工作日盘后）：
  0 18 * * 1-5 cd /path/to/repo && ./venv/bin/python scripts/sync_stock_daily.py --stock-list

退出码：任一只股票同步失败则为 1（便于 cron 告警）；未指定任何代码为 2。
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.config import setup_env

setup_env()

from data_provider.base import DataFetchError  # noqa: E402
from src.config import get_config  # noqa: E402
from src.logging_config import setup_logging  # noqa: E402
from src.services.stock_daily_sync_service import (  # noqa: E402
    StockDailySyncResult,
    build_stock_daily_fetcher_manager,
    resolve_stock_daily_sync_data_source,
    sync_stock_daily_bars,
)
from src.storage import get_db  # noqa: E402
from src.utils.stock_list_csv import codes_from_tushare_stock_csv  # noqa: E402

_MARKET_FILES = {
    "cn": "stock_list_a.csv",
    "hk": "stock_list_hk.csv",
    "us": "stock_list_us.csv",
}


def _parse_codes(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [p.strip() for p in raw.split(",") if p.strip()]


def _parse_markets(raw: str) -> list[str]:
    out: list[str] = []
    for part in raw.split(","):
        k = part.strip().lower()
        if k in _MARKET_FILES:
            out.append(k)
    return out


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
        "--csv",
        action="append",
        default=[],
        metavar="PATH",
        help="Extra Tushare-style stock list CSV (repeatable). Columns ts_code/symbol.",
    )
    parser.add_argument(
        "--all-markets",
        type=str,
        default="",
        help="Load codes from data/*.csv: comma list cn,hk,us (needs fetch_tushare_stock_list output)",
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=ROOT / "data",
        help="Directory for stock_list_*.csv when using --all-markets (default: repo data/)",
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
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Process at most N stocks (0 = no limit). Useful for dry runs.",
    )
    parser.add_argument(
        "--sleep-seconds",
        type=float,
        default=float(os.getenv("STOCK_DAILY_SYNC_SLEEP_SECONDS", "0") or 0),
        help="Pause between stocks (0 default). Set e.g. 0.2 when syncing full markets.",
    )
    parser.add_argument(
        "--source",
        type=str,
        default=os.getenv("STOCK_DAILY_SYNC_DATA_SOURCE", "auto"),
        metavar="auto|tushare",
        help="Daily fetch chain: auto (default multi-source) or tushare only (needs TUSHARE_TOKEN)",
    )
    args = parser.parse_args(argv)

    setup_logging()
    log = logging.getLogger("sync_stock_daily")

    codes = _parse_codes(args.codes)
    if args.stock_list:
        cfg = get_config()
        codes.extend(cfg.stock_list or [])

    for csv_path in args.csv:
        p = Path(csv_path).expanduser()
        if not p.is_file():
            log.error("CSV not found: %s", p)
            return 2
        codes.extend(codes_from_tushare_stock_csv(p))

    markets = _parse_markets(args.all_markets)
    for m in markets:
        fn = _MARKET_FILES[m]
        p = (args.data_dir / fn).resolve()
        if not p.is_file():
            log.error(
                "Market list missing: %s (run scripts/fetch_tushare_stock_list.py or check --data-dir)",
                p,
            )
            return 2
        loaded = codes_from_tushare_stock_csv(p)
        log.info("Loaded %s symbols from %s (%s)", len(loaded), fn, m)
        codes.extend(loaded)

    # de-dupe preserving order
    deduped: list[str] = []
    seen: set[str] = set()
    for c in codes:
        k = c.strip().upper()
        if k and k not in seen:
            seen.add(k)
            deduped.append(k)

    if not deduped:
        log.error(
            "No stock codes: use --codes, --stock-list, --csv PATH, or --all-markets cn,hk,us"
        )
        return 2

    if args.limit and args.limit > 0:
        limit_n = min(len(deduped), args.limit)
    else:
        limit_n = len(deduped)
    total_plan = limit_n

    resolved_src = resolve_stock_daily_sync_data_source(args.source)
    log.info(
        "sync_stock_daily: planned=%s full=%s lookback_days=%s sleep_s=%s source=%s",
        total_plan,
        args.full,
        max(5, args.lookback_days),
        args.sleep_seconds,
        resolved_src,
    )

    try:
        mgr = build_stock_daily_fetcher_manager(args.source)
    except ValueError as e:
        log.error("%s", e)
        return 2
    except DataFetchError as e:
        log.error("%s", e)
        return 2

    db = get_db()
    results: list[StockDailySyncResult] = []

    for i, code in enumerate(deduped):
        if i >= limit_n:
            break
        results.append(
            sync_stock_daily_bars(
                code,
                lookback_days=max(5, args.lookback_days),
                full=args.full,
                db=db,
                fetcher_manager=mgr,
            )
        )
        if args.sleep_seconds > 0 and (i + 1) < limit_n:
            time.sleep(args.sleep_seconds)

    for r in results:
        log.info("%s", r.describe())

    failed = [r for r in results if not r.ok]
    if failed:
        log.error("sync_stock_daily: %s failure(s)", len(failed))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
