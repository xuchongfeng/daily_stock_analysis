# -*- coding: utf-8 -*-
"""Tests for StockService.get_history_data DB-first behavior."""

import unittest
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from src.services import stock_service
from src.services.stock_service import StockService


def _ns(**kwargs):
    return SimpleNamespace(**kwargs)


class StockServiceHistoryTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.svc = StockService()
        self.svc.repo = MagicMock()

    @patch.object(stock_service, "DataFetcherManager")
    def test_uses_db_when_recent_and_sufficient(self, mock_mgr_cls: MagicMock) -> None:
        end = date.today()
        rows = [
            _ns(
                date=end - timedelta(days=i),
                open=10.0,
                high=11.0,
                low=9.0,
                close=10.5,
                volume=1e6,
                amount=1e7,
                pct_chg=0.5,
            )
            for i in range(25, 0, -1)
        ]
        self.svc.repo.get_range.return_value = rows
        mock_mgr = MagicMock()
        mock_mgr_cls.return_value = mock_mgr
        mock_mgr.get_stock_name.return_value = "茅台"

        out = self.svc.get_history_data("600519", period="daily", days=30)

        mock_mgr.get_daily_data.assert_not_called()
        self.svc.repo.save_dataframe.assert_not_called()
        self.assertEqual(out["stock_code"], "600519")
        self.assertGreaterEqual(len(out["data"]), 20)

    @patch.object(stock_service, "DataFetcherManager")
    def test_fetches_when_empty_then_saves(self, mock_mgr_cls: MagicMock) -> None:
        import pandas as pd

        end = date.today()
        self.svc.repo.get_range.side_effect = [
            [],
            [
                _ns(
                    date=end,
                    open=1.0,
                    high=1.1,
                    low=0.9,
                    close=1.0,
                    volume=100.0,
                    amount=1000.0,
                    pct_chg=0.0,
                )
            ],
        ]

        mock_mgr = MagicMock()
        mock_mgr_cls.return_value = mock_mgr
        mock_mgr.get_daily_data.return_value = (
            pd.DataFrame(
                [
                    {
                        "date": end,
                        "open": 1.0,
                        "high": 1.1,
                        "low": 0.9,
                        "close": 1.0,
                        "volume": 100.0,
                        "amount": 1000.0,
                        "pct_chg": 0.0,
                    }
                ]
            ),
            "MockSource",
        )
        mock_mgr.get_stock_name.return_value = "X"

        out = self.svc.get_history_data("600519", period="daily", days=30)

        mock_mgr.get_daily_data.assert_called_once()
        self.svc.repo.save_dataframe.assert_called_once()
        self.assertEqual(len(out["data"]), 1)


if __name__ == "__main__":
    unittest.main()
