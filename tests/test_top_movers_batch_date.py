# -*- coding: utf-8 -*-
"""涨幅榜批量任务：--top-movers-date 交易日门禁逻辑（离线单测）。"""

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from src.services.top_movers_batch_service import run_top_movers_batch


@pytest.fixture
def minimal_config():
    cfg = MagicMock()
    cfg.top_movers_enabled = True
    cfg.trading_day_check_enabled = True
    cfg.top_movers_limit = 5
    cfg.top_movers_exclude_st = True
    cfg.top_movers_max_workers = 1
    cfg.top_movers_report_type = "simple"
    cfg.top_movers_dedupe_watchlist = False
    cfg.top_movers_notify_enabled = False
    cfg.stock_list = []
    cfg.refresh_stock_list = MagicMock()
    cfg.max_workers = 1
    cfg.report_type = "simple"
    return cfg


def test_trade_date_closed_skips(minimal_config):
    d = date(2026, 1, 1)
    with patch(
        "src.services.market_scan_batch_service.is_market_open", return_value=False
    ):
        out = run_top_movers_batch(
            minimal_config,
            force_run=False,
            ignore_enabled_flag=True,
            trade_date=d,
        )
    assert out["skipped"] is True
    assert out["reason"] == "cn_date_not_trading_day"
    assert out["trade_date"] == "2026-01-01"


def test_trade_date_open_proceeds_gate(minimal_config):
    d = date(2026, 1, 5)
    with patch(
        "src.services.market_scan_batch_service.is_market_open", return_value=True
    ), patch(
        "src.services.market_scan_batch_service.StockAnalysisPipeline"
    ) as m_pipe:
        inst = MagicMock()
        inst.fetcher_manager.get_cn_top_movers_universe.return_value = []
        m_pipe.return_value = inst
        out = run_top_movers_batch(
            minimal_config,
            force_run=False,
            ignore_enabled_flag=True,
            trade_date=d,
        )
    assert out.get("reason") == "empty_universe"
    assert out["batch_run_id"].startswith("tm_20260105_")
