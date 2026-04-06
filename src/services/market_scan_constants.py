# -*- coding: utf-8 -*-
"""榜单扫描（涨幅 / 成交量等）共享常量。"""

from __future__ import annotations

from typing import FrozenSet

# 与 CLI / API scan_kind 对齐
SCAN_KIND_GAINERS = "gainers"
SCAN_KIND_VOLUME = "volume"

# 写入 analysis_history.batch_kind（历史数据保留 top_movers_daily）
BATCH_KIND_GAINERS = "top_movers_daily"
BATCH_KIND_VOLUME = "top_volume_daily"

MARKET_SCAN_BATCH_KINDS: FrozenSet[str] = frozenset({BATCH_KIND_GAINERS, BATCH_KIND_VOLUME})


def batch_kind_for_scan_kind(scan_kind: str) -> str:
    s = (scan_kind or "").strip().lower()
    if s == SCAN_KIND_VOLUME:
        return BATCH_KIND_VOLUME
    return BATCH_KIND_GAINERS


def batch_id_prefix_for_scan_kind(scan_kind: str) -> str:
    s = (scan_kind or "").strip().lower()
    if s == SCAN_KIND_VOLUME:
        return "tv_"
    return "tm_"


def scan_kind_from_batch_kind(batch_kind: str | None) -> str:
    if (batch_kind or "").strip() == BATCH_KIND_VOLUME:
        return SCAN_KIND_VOLUME
    return SCAN_KIND_GAINERS
