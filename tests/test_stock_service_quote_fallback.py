# -*- coding: utf-8 -*-
"""Tests for StockService.get_realtime_quote daily-close fallback."""

from __future__ import annotations

import unittest
from datetime import date, timedelta
from types import SimpleNamespace
from typing import Optional
from unittest.mock import MagicMock, patch

from src.services import stock_service
from src.services.stock_service import StockService


def _daily_row(*, close: float, prev_close: Optional[float] = None, pct: Optional[float] = 5.0) -> SimpleNamespace:
    d = date.today()
    if prev_close is not None:
        return SimpleNamespace(
            date=d,
            open=prev_close,
            high=max(close, prev_close) * 1.01,
            low=min(close, prev_close) * 0.99,
            close=close,
            volume=1e6,
            amount=close * 1e6,
            pct_chg=pct,
        )
    return SimpleNamespace(
        date=d,
        open=close * 0.99,
        high=close * 1.01,
        low=close * 0.98,
        close=close,
        volume=1e6,
        amount=close * 1e6,
        pct_chg=pct,
    )


class StockServiceQuoteFallbackTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.svc = StockService()
        self.svc.repo = MagicMock()

    @patch.object(stock_service, "DataFetcherManager")
    def test_fallback_when_realtime_none(self, mock_mgr_cls: MagicMock) -> None:
        mock_mgr = MagicMock()
        mock_mgr_cls.return_value = mock_mgr
        mock_mgr.get_realtime_quote.return_value = None

        latest = _daily_row(close=100.0, prev_close=95.0)
        prev = SimpleNamespace(
            date=date.today() - timedelta(days=1),
            close=95.0,
            open=94.0,
            high=96.0,
            low=93.0,
            volume=1e6,
            amount=95e6,
            pct_chg=1.0,
        )
        self.svc.repo.get_latest.return_value = [latest, prev]

        out = self.svc.get_realtime_quote("600519")

        self.assertIsNotNone(out)
        self.assertEqual(out["price_source"], "daily_close")
        self.assertEqual(out["current_price"], 100.0)
        self.assertEqual(out["prev_close"], 95.0)
        self.assertAlmostEqual(out["change"], 5.0)

    @patch.object(stock_service, "DataFetcherManager")
    def test_realtime_when_ok(self, mock_mgr_cls: MagicMock) -> None:
        mock_mgr = MagicMock()
        mock_mgr_cls.return_value = mock_mgr
        mock_mgr.get_realtime_quote.return_value = SimpleNamespace(
            code="600519",
            name="茅台",
            price=123.45,
            change_amount=1.0,
            change_pct=0.8,
            open_price=122.0,
            high=124.0,
            low=121.0,
            pre_close=122.45,
            volume=1000,
            amount=1234500.0,
        )

        out = self.svc.get_realtime_quote("600519")

        self.assertEqual(out["price_source"], "realtime")
        self.assertEqual(out["current_price"], 123.45)
        self.svc.repo.get_latest.assert_not_called()


if __name__ == "__main__":
    unittest.main()
