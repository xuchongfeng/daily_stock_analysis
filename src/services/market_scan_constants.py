# -*- coding: utf-8 -*-
"""榜单扫描（涨幅 / 成交量等）共享常量。"""

from __future__ import annotations

import re
from datetime import date
from typing import FrozenSet, Optional, Tuple

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


def parse_market_scan_batch_run_id(batch_run_id: str) -> Optional[Tuple[str, date]]:
    """
    解析榜单批次号 ``tm_YYYYMMDD_<8hex>`` / ``tv_YYYYMMDD_<8hex>``。

    Returns:
        ``(scan_kind, trade_date)`` 或 ``None``（格式非法）。
    """
    s = (batch_run_id or "").strip()
    m = re.match(r"^(tm|tv)_(\d{8})_[0-9a-f]{8}$", s, re.I)
    if not m:
        return None
    prefix, ds = m.group(1).lower(), m.group(2)
    sk = SCAN_KIND_VOLUME if prefix == "tv" else SCAN_KIND_GAINERS
    d = date(int(ds[0:4]), int(ds[4:6]), int(ds[6:8]))
    return sk, d


def infer_batch_kind_from_run_id(batch_run_id: str | None) -> str | None:
    """
    当 analysis_history.batch_kind 为空时，用批次号前缀推断榜单类型
    （与 batch_id_prefix_for_scan_kind 一致：tm_=涨幅，tv_=成交量）。
    """
    s = (batch_run_id or "").strip()
    if s.startswith("tv_"):
        return BATCH_KIND_VOLUME
    if s.startswith("tm_"):
        return BATCH_KIND_GAINERS
    return None
