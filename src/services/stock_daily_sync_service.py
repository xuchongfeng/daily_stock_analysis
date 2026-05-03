# -*- coding: utf-8 -*-
"""
个股日线 OHLCV 入库服务（支撑本地 K 线与减少重复请求）。

设计要点：
- 持久化使用既有 ``stock_daily`` 表与 ``DatabaseManager.save_daily_data``（UPSERT）。
- **增量**：若库中已有该代码数据，则仅请求 ``最新入库日期 + 1``～今日的区间；否则按 ``lookback_days`` 拉一段历史。
- **全量**：``full=True`` 时忽略增量逻辑，按 ``lookback_days`` 重新拉取并覆盖重叠日期。
- 定时任务建议每日收盘后运行 ``scripts/sync_stock_daily.py``（见脚本说明），与分析主流程解耦。
- 数据源可选 ``STOCK_DAILY_SYNC_DATA_SOURCE=auto|tushare``（或脚本 ``--source``）；``tushare`` 时仅用 TuShare Pro，需 ``TUSHARE_TOKEN``。

API ``GET /api/v1/stocks/{code}/history`` 当前仍可能直连数据源；后续可读库优先时再改 endpoints。
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

from data_provider.base import DataFetchError, DataFetcherManager, canonical_stock_code

from src.storage import DatabaseManager, get_db

logger = logging.getLogger(__name__)


def resolve_stock_daily_sync_data_source(explicit: Optional[str] = None) -> str:
    """解析日线入库数据源关键字：来自 ``fetcher_source`` 参数或 ``STOCK_DAILY_SYNC_DATA_SOURCE``。"""
    raw = (
        explicit
        if explicit is not None
        else (os.getenv("STOCK_DAILY_SYNC_DATA_SOURCE") or "auto")
    )
    return (raw or "auto").strip().lower() or "auto"


def build_stock_daily_fetcher_manager(source: Optional[str] = None) -> DataFetcherManager:
    """
    为 ``stock_daily`` 同步构造 ``DataFetcherManager``。

    - ``auto``（默认）：与主流程一致的多源 failover。
    - ``tushare``：仅使用 TuShare（需 ``TUSHARE_TOKEN``）；港股/美股日线是否可用以 TuShare 接口为准。
    """
    src = resolve_stock_daily_sync_data_source(source)
    if src in ("auto", "default", ""):
        return DataFetcherManager()
    if src in ("tushare", "ts", "tusharefetcher"):
        from data_provider.tushare_fetcher import TushareFetcher

        ts = TushareFetcher()
        if not ts.is_available():
            raise DataFetchError(
                "指定 tushare 数据源但 TuShare 不可用（请配置 TUSHARE_TOKEN）"
            )
        return DataFetcherManager(fetchers=[ts])
    raise ValueError(
        f"不支持的日线同步数据源 {src!r}；请使用 auto 或 tushare"
    )


@dataclass
class StockDailySyncResult:
    ok: bool
    code: str
    skipped: bool = False
    rows_fetched: int = 0
    rows_new: int = 0
    source: str = ""
    message: str = ""
    error: str = ""

    def describe(self) -> str:
        if self.error:
            return f"[{self.code}] FAIL: {self.error}"
        if self.skipped:
            return f"[{self.code}] SKIP: {self.message or 'up to date'}"
        return (
            f"[{self.code}] OK source={self.source} fetched={self.rows_fetched} "
            f"new_rows={self.rows_new}"
        )


def sync_stock_daily_bars(
    code: str,
    *,
    lookback_days: int = 365,
    full: bool = False,
    db: Optional[DatabaseManager] = None,
    fetcher_manager: Optional[DataFetcherManager] = None,
    fetcher_source: Optional[str] = None,
) -> StockDailySyncResult:
    """
    拉取单只股票日线并写入 ``stock_daily``。

    Args:
        code: 股票代码（与系统其它入口一致，会做 canonical 大写）
        lookback_days: 无本地历史或 ``full=True`` 时，传给数据源的回溯自然日数量
        full: 为 True 时不做增量，直接按 lookback_days 拉取
        db: 数据库管理器，默认单例
        fetcher_manager: 数据源管理器；若传入则忽略 ``fetcher_source`` / 环境变量
        fetcher_source: 未传 ``fetcher_manager`` 时生效：``auto`` 或 ``tushare``（亦可用 ``STOCK_DAILY_SYNC_DATA_SOURCE``）

    Returns:
        StockDailySyncResult
    """
    raw = (code or "").strip()
    canon = canonical_stock_code(raw)
    if not canon:
        return StockDailySyncResult(ok=False, code=raw or "?", error="empty_or_invalid_code")

    db = db or get_db()
    manager = (
        fetcher_manager
        if fetcher_manager is not None
        else build_stock_daily_fetcher_manager(fetcher_source)
    )

    today = date.today()
    lookback_days = max(int(lookback_days), 5)

    try:
        if full:
            df, source = manager.get_daily_data(canon, days=lookback_days)
            mode = "full"
        else:
            latest = db.get_latest_stock_daily_trade_date(canon)
            if latest is None:
                df, source = manager.get_daily_data(canon, days=lookback_days)
                mode = f"initial_{lookback_days}d"
            else:
                start = latest + timedelta(days=1)
                if start > today:
                    return StockDailySyncResult(
                        ok=True,
                        code=canon,
                        skipped=True,
                        message=f"latest_trade_date={latest.isoformat()} nothing to fetch until tomorrow",
                    )
                span = (today - start).days + 1
                fetch_days = max(span + 10, 30)
                df, source = manager.get_daily_data(
                    canon,
                    start_date=start.isoformat(),
                    end_date=today.isoformat(),
                    days=fetch_days,
                )
                mode = f"incremental_from_{start.isoformat()}"

        if df is None or df.empty:
            logger.warning("stock_daily_sync: %s returned empty frame (%s)", canon, mode)
            return StockDailySyncResult(
                ok=True,
                code=canon,
                skipped=False,
                rows_fetched=0,
                rows_new=0,
                source=source or "",
                message=f"{mode}: empty response",
            )

        rows_fetched = len(df.index)
        rows_new = db.save_daily_data(df, canon, source or "Unknown")
        logger.info(
            "stock_daily_sync: %s mode=%s source=%s fetched=%s new=%s",
            canon,
            mode,
            source,
            rows_fetched,
            rows_new,
        )
        return StockDailySyncResult(
            ok=True,
            code=canon,
            rows_fetched=rows_fetched,
            rows_new=rows_new,
            source=source or "",
            message=mode,
        )
    except DataFetchError as e:
        err = str(e)
        logger.warning("stock_daily_sync: %s DataFetchError: %s", canon, err)
        return StockDailySyncResult(ok=False, code=canon, error=err)
    except Exception as e:  # pragma: no cover - defensive
        err = str(e)
        logger.exception("stock_daily_sync: %s unexpected: %s", canon, err)
        return StockDailySyncResult(ok=False, code=canon, error=err)


def sync_many_stock_daily_bars(
    codes: list[str],
    *,
    lookback_days: int = 365,
    full: bool = False,
    db: Optional[DatabaseManager] = None,
    fetcher_manager: Optional[DataFetcherManager] = None,
    fetcher_source: Optional[str] = None,
) -> list[StockDailySyncResult]:
    """顺序同步多只股票（避免数据源并发触顶）。"""
    mgr = (
        fetcher_manager
        if fetcher_manager is not None
        else build_stock_daily_fetcher_manager(fetcher_source)
    )
    database = db or get_db()
    out: list[StockDailySyncResult] = []
    seen: set[str] = set()
    for c in codes:
        key = canonical_stock_code((c or "").strip())
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(
            sync_stock_daily_bars(
                key,
                lookback_days=lookback_days,
                full=full,
                db=database,
                fetcher_manager=mgr,
            )
        )
    return out
