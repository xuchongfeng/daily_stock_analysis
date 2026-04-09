# -*- coding: utf-8 -*-
"""榜单批次手动通知：Markdown 组装与 API 契约。"""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

try:
    import litellm  # noqa: F401
except ModuleNotFoundError:
    import sys

    sys.modules["litellm"] = MagicMock()

from api.app import create_app
from src.config import Config
from src.services.market_scan_batch_service import build_market_scan_notify_markdown
from src.services.market_scan_constants import SCAN_KIND_GAINERS
from src.storage import AnalysisHistory, DatabaseManager


class MarketScanNotifyMarkdownTestCase(unittest.TestCase):
    def test_build_summary_and_detailed(self) -> None:
        rows = [
            SimpleNamespace(
                name="测试股",
                code="600000",
                rank_in_batch=1,
                sentiment_score=80,
                operation_advice="持有",
                ref_change_pct=1.5,
                ref_trade_volume=None,
                analysis_summary="第一行\n第二行",
            )
        ]
        s = build_market_scan_notify_markdown(
            "tm_20260401_abcdef12",
            SCAN_KIND_GAINERS,
            rows,
            "summary",
        )
        self.assertIn("600000", s)
        self.assertIn("手动推送", s)
        self.assertNotIn("第一行", s)

        d = build_market_scan_notify_markdown(
            "tm_20260401_abcdef12",
            SCAN_KIND_GAINERS,
            rows,
            "detailed",
        )
        self.assertIn("第一行", d)
        self.assertIn("> 第二行", d)


class MarketScanNotifyApiTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temp_dir.name)
        self.env_path = self.data_dir / ".env"
        self.db_path = self.data_dir / "market_scan_notify_test.db"
        self.env_path.write_text(
            "\n".join(
                [
                    "STOCK_LIST=600519",
                    "GEMINI_API_KEY=test",
                    "ADMIN_AUTH_ENABLED=false",
                    f"DATABASE_PATH={self.db_path}",
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        os.environ["ENV_FILE"] = str(self.env_path)
        os.environ["DATABASE_PATH"] = str(self.db_path)
        Config.reset_instance()
        DatabaseManager.reset_instance()
        app = create_app(static_dir=self.data_dir / "empty-static")
        self.client = TestClient(app)
        self.db = DatabaseManager.get_instance()

    def tearDown(self) -> None:
        DatabaseManager.reset_instance()
        Config.reset_instance()
        os.environ.pop("ENV_FILE", None)
        os.environ.pop("DATABASE_PATH", None)
        self.temp_dir.cleanup()

    def test_notify_endpoint_invalid_batch(self) -> None:
        r = self.client.post(
            "/api/v1/market-scanner/batches/bad-id/notify",
            json={"top_n": 5, "detail_level": "summary"},
        )
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertTrue(data.get("skipped"))
        self.assertEqual(data.get("reason"), "invalid_batch_run_id")

    @patch(
        "src.services.market_scan_batch_service.NotificationService.send",
        return_value=True,
    )
    @patch(
        "src.services.market_scan_batch_service.NotificationService.is_available",
        return_value=True,
    )
    def test_notify_endpoint_sends_with_rows(
        self, _mock_avail: MagicMock, _mock_send: MagicMock
    ) -> None:
        batch_id = "tm_20260401_a1b2c3d4"
        with self.db.get_session() as session:
            session.add(
                AnalysisHistory(
                    query_id="q1",
                    code="600000",
                    name="浦发银行",
                    report_type="simple",
                    sentiment_score=75,
                    operation_advice="观望",
                    analysis_summary="摘要内容",
                    raw_result="{}",
                    batch_kind="top_movers_daily",
                    batch_run_id=batch_id,
                    rank_in_batch=3,
                    ref_change_pct=2.5,
                )
            )
            session.commit()

        r = self.client.post(
            f"/api/v1/market-scanner/batches/{batch_id}/notify",
            json={"top_n": 10, "detail_level": "detailed"},
        )
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertFalse(data.get("skipped"))
        self.assertTrue(data.get("notification_sent"))
        self.assertEqual(data.get("items_included"), 1)

    def test_notify_empty_batch_skipped(self) -> None:
        from src.services.market_scan_batch_service import send_market_scan_batch_notification

        out = send_market_scan_batch_notification(
            "tm_20260401_a1b2c3d4",
            top_n=5,
            detail_level="summary",
        )
        self.assertTrue(out.get("skipped"))
        self.assertEqual(out.get("reason"), "empty_batch")
