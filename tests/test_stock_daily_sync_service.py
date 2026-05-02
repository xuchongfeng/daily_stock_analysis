# -*- coding: utf-8 -*-
"""Tests for stock_daily_sync_service (mocked fetcher, real SQLite)."""

import os
import tempfile
import unittest
from datetime import date, timedelta
from unittest.mock import MagicMock

import pandas as pd

from src.config import Config
from src.services.stock_daily_sync_service import sync_stock_daily_bars
from src.storage import DatabaseManager


class StockDailySyncServiceTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._temp_dir = tempfile.TemporaryDirectory()
        self._db_path = os.path.join(self._temp_dir.name, "test_sync_daily.db")
        os.environ["DATABASE_PATH"] = self._db_path
        Config._instance = None
        DatabaseManager.reset_instance()
        self.db = DatabaseManager.get_instance()

    def tearDown(self) -> None:
        DatabaseManager.reset_instance()
        self._temp_dir.cleanup()

    def test_incremental_calls_fetcher_with_start_end(self) -> None:
        d0 = date(2026, 1, 10)
        self.db.save_daily_data(
            pd.DataFrame(
                [
                    {
                        "date": d0,
                        "open": 1.0,
                        "high": 2.0,
                        "low": 0.5,
                        "close": 1.5,
                        "volume": 100.0,
                        "amount": 150.0,
                        "pct_chg": 1.0,
                    }
                ]
            ),
            "600519",
            data_source="seed",
        )

        mgr = MagicMock()
        mgr.get_daily_data.return_value = (
            pd.DataFrame(
                [
                    {
                        "date": d0 + timedelta(days=1),
                        "open": 1.5,
                        "high": 2.5,
                        "low": 1.0,
                        "close": 2.0,
                        "volume": 110.0,
                        "amount": 220.0,
                        "pct_chg": 2.0,
                    }
                ]
            ),
            "MockFetcher",
        )

        r = sync_stock_daily_bars(
            "600519",
            lookback_days=365,
            full=False,
            db=self.db,
            fetcher_manager=mgr,
        )
        self.assertTrue(r.ok)
        self.assertFalse(r.skipped)
        mgr.get_daily_data.assert_called_once()
        kwargs = mgr.get_daily_data.call_args.kwargs
        self.assertIn("start_date", kwargs)
        self.assertIn("end_date", kwargs)

    def test_skip_when_already_through_today(self) -> None:
        today = date.today()
        self.db.save_daily_data(
            pd.DataFrame(
                [
                    {
                        "date": today,
                        "open": 1.0,
                        "high": 2.0,
                        "low": 0.5,
                        "close": 1.5,
                        "volume": 100.0,
                        "amount": 150.0,
                        "pct_chg": 1.0,
                    }
                ]
            ),
            "000001",
            data_source="seed",
        )
        mgr = MagicMock()
        r = sync_stock_daily_bars(
            "000001",
            db=self.db,
            fetcher_manager=mgr,
        )
        self.assertTrue(r.ok)
        self.assertTrue(r.skipped)
        mgr.get_daily_data.assert_not_called()


if __name__ == "__main__":
    unittest.main()
