# -*- coding: utf-8 -*-
"""涨幅榜股票池：Tushare daily 优先、东财回退（离线 mock）。"""

from datetime import date
from unittest.mock import MagicMock

from data_provider.base import DataFetcherManager
from data_provider.tushare_fetcher import TushareFetcher


def test_prefers_tushare_daily_when_returns_rows():
    mgr = object.__new__(DataFetcherManager)
    ts = object.__new__(TushareFetcher)
    ts.name = "TushareFetcher"
    ts.is_available = lambda: True
    ts.get_cn_top_movers_universe_from_daily = MagicMock(
        return_value=[
            {"code": "600519", "name": "贵州茅台", "change_pct": 5.0, "rank": 1},
        ]
    )
    mgr._get_fetchers_snapshot = MagicMock(return_value=[ts])
    out = mgr.get_cn_top_movers_universe(
        limit=10, exclude_st=True, trade_date=date(2026, 4, 1)
    )
    assert len(out) == 1
    assert out[0]["code"] == "600519"
    ts.get_cn_top_movers_universe_from_daily.assert_called_once()


def test_explicit_trade_date_skips_akshare_when_tushare_empty():
    mgr = object.__new__(DataFetcherManager)
    ts = object.__new__(TushareFetcher)
    ts.name = "TushareFetcher"
    ts.is_available = lambda: True
    ts.get_cn_top_movers_universe_from_daily = MagicMock(return_value=[])
    ak = MagicMock()
    ak.name = "AkshareFetcher"
    ak.get_cn_a_spot_em_dataframe = MagicMock(
        return_value=None
    )  # 若误调会暴露
    mgr._get_fetchers_snapshot = MagicMock(return_value=[ts, ak])
    out = mgr.get_cn_top_movers_universe(
        limit=10, exclude_st=True, trade_date=date(2026, 4, 1)
    )
    assert out == []
    ak.get_cn_a_spot_em_dataframe.assert_not_called()
