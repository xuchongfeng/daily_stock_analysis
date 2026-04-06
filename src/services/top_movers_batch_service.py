# -*- coding: utf-8 -*-
"""向后兼容：涨幅榜入口，实现见 ``market_scan_batch_service``。"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, Optional

from src.config import Config
from src.services.market_scan_batch_service import (  # noqa: F401
    TOP_MOVERS_BATCH_KIND,
    run_market_scan_batch,
)
from src.services.market_scan_constants import SCAN_KIND_GAINERS


def run_top_movers_batch(
    config: Optional[Config] = None,
    *,
    dry_run: bool = False,
    send_notification: bool = True,
    force_run: bool = False,
    limit_override: Optional[int] = None,
    max_workers_override: Optional[int] = None,
    ignore_enabled_flag: bool = False,
    trade_date: Optional[date] = None,
) -> Dict[str, Any]:
    """等价于 ``run_market_scan_batch(..., scan_kind=gainers)``。"""
    return run_market_scan_batch(
        config,
        scan_kind=SCAN_KIND_GAINERS,
        dry_run=dry_run,
        send_notification=send_notification,
        force_run=force_run,
        limit_override=limit_override,
        max_workers_override=max_workers_override,
        ignore_enabled_flag=ignore_enabled_flag,
        trade_date=trade_date,
    )


__all__ = ["TOP_MOVERS_BATCH_KIND", "run_market_scan_batch", "run_top_movers_batch"]
