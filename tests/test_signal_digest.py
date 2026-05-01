# -*- coding: utf-8 -*-
"""信号摘要：规则打分与 API 冒烟。"""

from __future__ import annotations

import os
import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

try:
    import litellm  # noqa: F401
except ModuleNotFoundError:
    import sys

    sys.modules["litellm"] = MagicMock()

from api.app import create_app
from src.config import Config
from src.services import signal_digest_service as sds
from src.storage import AnalysisHistory, DatabaseManager


class SignalDigestScoringTest(unittest.TestCase):
    def test_is_buy_or_hold_advice(self) -> None:
        self.assertTrue(sds.is_buy_or_hold_advice("持有"))
        self.assertTrue(sds.is_buy_or_hold_advice("买入"))
        self.assertTrue(sds.is_buy_or_hold_advice("增持"))
        self.assertFalse(sds.is_buy_or_hold_advice("观望"))
        self.assertFalse(sds.is_buy_or_hold_advice("卖出"))

    def test_advice_bias_buy(self) -> None:
        self.assertGreater(sds.advice_bias("买入"), 0)

    def test_advice_bias_sell(self) -> None:
        self.assertLess(sds.advice_bias("卖出"), 0)

    def test_compute_pick_score_repeated_raises(self) -> None:
        a = sds.compute_pick_score(80, 1, "持有")
        b = sds.compute_pick_score(80, 4, "持有")
        self.assertGreater(b, a)


class SignalDigestApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        data_dir = Path(self.temp_dir.name)
        env_path = data_dir / ".env"
        db_path = data_dir / "signal_digest_api_test.db"
        env_path.write_text(
            "\n".join(
                [
                    "STOCK_LIST=600519",
                    "GEMINI_API_KEY=test",
                    "ADMIN_AUTH_ENABLED=false",
                    "SIGNAL_DIGEST_CACHE_TTL_SECONDS=0",
                    f"DATABASE_PATH={db_path}",
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        os.environ["ENV_FILE"] = str(env_path)
        os.environ["DATABASE_PATH"] = str(db_path)
        DatabaseManager.reset_instance()
        Config.reset_instance()
        es = data_dir / "empty-static"
        self.app = create_app(static_dir=es, user_static_dir=es)
        self.client = TestClient(self.app)

    def tearDown(self) -> None:
        DatabaseManager.reset_instance()
        Config.reset_instance()
        os.environ.pop("ENV_FILE", None)
        os.environ.pop("DATABASE_PATH", None)
        os.environ.pop("SIGNAL_DIGEST_CACHE_TTL_SECONDS", None)
        self.temp_dir.cleanup()

    @patch("api.v1.endpoints.signal_digest.build_signal_digest")
    def test_get_signal_digest_ok(self, mock_build: MagicMock) -> None:
        mock_build.return_value = {
            "window": {
                "trading_sessions": 14,
                "anchor_date": "2026-04-09",
                "oldest_date": "2026-03-20",
                "rows_considered": 3,
                "distinct_stocks": 2,
                "market_filter": "cn",
                "exclude_batch": True,
                "rows_after_advice_filter": 3,
                "batch_only": False,
                "advice_filter": "any",
            },
            "picks": [
                {
                    "code": "600519",
                    "name": "贵州茅台",
                    "score": 77.5,
                    "appearance_count": 2,
                    "latest_created_at": "2026-04-09T10:00:00",
                    "sentiment_score": 82,
                    "operation_advice": "持有",
                    "trend_prediction": "震荡",
                    "analysis_summary_excerpt": "测试",
                    "boards": [{"name": "白酒"}],
                }
            ],
            "board_highlights": [{"name": "白酒", "count": 1}],
            "board_highlights_all": [{"name": "白酒", "count": 1}],
            "narrative_markdown": None,
            "narrative_generated": False,
        }
        r = self.client.get("/api/v1/insights/signal-digest")
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertEqual(data["window"]["trading_sessions"], 14)
        self.assertEqual(len(data["picks"]), 1)
        self.assertEqual(data["picks"][0]["code"], "600519")
        self.assertEqual(len(data["board_highlights_all"]), 1)


class SignalDigestServiceIntegrationTest(unittest.TestCase):
    """In-memory style: patch storage list to return synthetic rows."""

    def test_build_groups_and_sorts(self) -> None:
        db = MagicMock()
        r1 = AnalysisHistory(
            code="600519",
            name="茅台",
            sentiment_score=80,
            operation_advice="买入",
            trend_prediction="看多",
            analysis_summary="A",
            context_snapshot='{"enhanced_context":{"fundamental_context":{"belong_boards":[{"name":"白酒"}]}}}',
            created_at=datetime(2026, 4, 8, 10, 0, 0),
        )
        r2 = AnalysisHistory(
            code="600519",
            name="茅台",
            sentiment_score=75,
            operation_advice="持有",
            trend_prediction="震荡",
            analysis_summary="B",
            context_snapshot="{}",
            created_at=datetime(2026, 4, 7, 10, 0, 0),
        )
        r3 = AnalysisHistory(
            code="300750",
            name="宁德",
            sentiment_score=60,
            operation_advice="观望",
            trend_prediction="震荡",
            analysis_summary="C",
            context_snapshot="{}",
            created_at=datetime(2026, 4, 8, 11, 0, 0),
        )
        db.list_analysis_history_since.return_value = [r1, r2, r3]

        with patch("src.services.signal_digest_service.get_effective_trading_date", return_value=date(2026, 4, 9)):
            with patch(
                "src.services.signal_digest_service.get_oldest_date_in_trading_window",
                return_value=date(2026, 3, 1),
            ):
                out = sds.build_signal_digest(
                    db,
                    trading_sessions=14,
                    top_k=5,
                    market_filter="cn",
                    exclude_batch=True,
                    with_narrative=False,
                )
        self.assertGreaterEqual(len(out["picks"]), 1)
        codes = [p["code"] for p in out["picks"]]
        self.assertIn("600519", codes)
        top = out["picks"][0]
        self.assertEqual(top["code"], "600519")
        self.assertGreaterEqual(top["appearance_count"], 2)

    def test_board_highlights_all_covers_non_top_stocks(self) -> None:
        """top_k=1 时 Top 板块仅首股；全量板块统计仍包含窗口内其余标的。"""
        db = MagicMock()
        snap_a = '{"enhanced_context":{"fundamental_context":{"belong_boards":[{"name":"白酒"}]}}}'
        snap_b = '{"enhanced_context":{"fundamental_context":{"belong_boards":[{"name":"银行"}]}}}'
        r_a = AnalysisHistory(
            code="600519",
            name="茅台",
            sentiment_score=90,
            operation_advice="买入",
            trend_prediction="看多",
            analysis_summary="A",
            context_snapshot=snap_a,
            created_at=datetime(2026, 4, 8, 10, 0, 0),
        )
        r_b = AnalysisHistory(
            code="000001",
            name="平安",
            sentiment_score=50,
            operation_advice="买入",
            trend_prediction="震荡",
            analysis_summary="B",
            context_snapshot=snap_b,
            created_at=datetime(2026, 4, 8, 11, 0, 0),
        )
        db.list_analysis_history_since.return_value = [r_a, r_b]
        db.get_concept_board_highlights_by_codes.side_effect = [
            [{"name": "芯片概念", "count": 2}],
            [{"name": "芯片概念", "count": 1}],
        ]

        with patch("src.services.signal_digest_service.get_effective_trading_date", return_value=date(2026, 4, 9)):
            with patch(
                "src.services.signal_digest_service.get_oldest_date_in_trading_window",
                return_value=date(2026, 3, 1),
            ):
                out = sds.build_signal_digest(
                    db,
                    trading_sessions=14,
                    top_k=1,
                    market_filter="cn",
                    exclude_batch=True,
                    with_narrative=False,
                )
        self.assertEqual(len(out["picks"]), 1)
        self.assertEqual(out["picks"][0]["code"], "600519")
        top_names = {x["name"] for x in out["board_highlights"]}
        all_names = {x["name"] for x in out["board_highlights_all"]}
        self.assertEqual(top_names, {"白酒"})
        self.assertEqual(all_names, {"白酒", "银行"})
        concept_top = {x["name"] for x in out["concept_highlights"]}
        concept_all = {x["name"] for x in out["concept_highlights_all"]}
        self.assertEqual(concept_top, {"芯片概念"})
        self.assertEqual(concept_all, {"芯片概念"})

    def test_buy_or_hold_filters_rows(self) -> None:
        db = MagicMock()
        r1 = AnalysisHistory(
            code="600519",
            name="茅台",
            sentiment_score=80,
            operation_advice="买入",
            trend_prediction="看多",
            analysis_summary="A",
            context_snapshot="{}",
            created_at=datetime(2026, 4, 8, 10, 0, 0),
        )
        r3 = AnalysisHistory(
            code="300750",
            name="宁德",
            sentiment_score=60,
            operation_advice="观望",
            trend_prediction="震荡",
            analysis_summary="C",
            context_snapshot="{}",
            created_at=datetime(2026, 4, 8, 11, 0, 0),
        )
        db.list_analysis_history_since.return_value = [r1, r3]

        with patch("src.services.signal_digest_service.get_effective_trading_date", return_value=date(2026, 4, 9)):
            with patch(
                "src.services.signal_digest_service.get_oldest_date_in_trading_window",
                return_value=date(2026, 3, 1),
            ):
                out = sds.build_signal_digest(
                    db,
                    trading_sessions=14,
                    top_k=5,
                    market_filter="cn",
                    exclude_batch=True,
                    advice_filter="buy_or_hold",
                    with_narrative=False,
                )
        self.assertEqual(out["window"]["rows_considered"], 2)
        self.assertEqual(out["window"]["rows_after_advice_filter"], 1)
        self.assertEqual(len(out["picks"]), 1)
        self.assertEqual(out["picks"][0]["code"], "600519")

    def test_compute_cache_key_stable(self) -> None:
        k1 = sds.compute_signal_digest_cache_key(
            trading_sessions=14,
            top_k=10,
            market_filter="cn",
            exclude_batch=False,
            batch_only=True,
            advice_filter="buy_or_hold",
            with_narrative=True,
        )
        k2 = sds.compute_signal_digest_cache_key(
            trading_sessions=14,
            top_k=10,
            market_filter="cn",
            exclude_batch=False,
            batch_only=True,
            advice_filter="buy_or_hold",
            with_narrative=True,
        )
        self.assertEqual(k1, k2)
        self.assertEqual(len(k1), 64)


class SignalDigestHttpCacheTest(unittest.TestCase):
    """两次相同请求仅计算一次（SQLite 缓存）。"""

    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        data_dir = Path(self.temp_dir.name)
        env_path = data_dir / ".env"
        db_path = data_dir / "signal_digest_http_cache_test.db"
        env_path.write_text(
            "\n".join(
                [
                    "STOCK_LIST=600519",
                    "GEMINI_API_KEY=test",
                    "ADMIN_AUTH_ENABLED=false",
                    "SIGNAL_DIGEST_CACHE_TTL_SECONDS=600",
                    f"DATABASE_PATH={db_path}",
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        os.environ["ENV_FILE"] = str(env_path)
        os.environ["DATABASE_PATH"] = str(db_path)
        # 覆盖同进程内其它用例可能留下的环境变量（setup_env 会合并 .env 到 os.environ）
        os.environ["SIGNAL_DIGEST_CACHE_TTL_SECONDS"] = "600"
        DatabaseManager.reset_instance()
        Config.reset_instance()
        es = data_dir / "empty-static"
        self.app = create_app(static_dir=es, user_static_dir=es)
        self.client = TestClient(self.app)

    def tearDown(self) -> None:
        DatabaseManager.reset_instance()
        Config.reset_instance()
        os.environ.pop("ENV_FILE", None)
        os.environ.pop("DATABASE_PATH", None)
        os.environ.pop("SIGNAL_DIGEST_CACHE_TTL_SECONDS", None)
        self.temp_dir.cleanup()

    @patch("api.v1.endpoints.signal_digest.build_signal_digest")
    def test_second_hit_is_cached(self, mock_build: MagicMock) -> None:
        mock_build.return_value = {
            "window": {
                "trading_sessions": 14,
                "anchor_date": "2026-04-09",
                "oldest_date": "2026-03-20",
                "rows_considered": 1,
                "rows_after_advice_filter": 1,
                "distinct_stocks": 1,
                "market_filter": "cn",
                "exclude_batch": False,
                "batch_only": False,
                "advice_filter": "any",
            },
            "picks": [],
            "board_highlights": [],
            "board_highlights_all": [],
            "narrative_markdown": None,
            "narrative_generated": False,
        }
        q = "/api/v1/insights/signal-digest?trading_sessions=14&top_k=10&market=cn"
        r1 = self.client.get(q)
        r2 = self.client.get(q)
        self.assertEqual(r1.status_code, 200, r1.text)
        self.assertEqual(r2.status_code, 200, r2.text)
        self.assertEqual(mock_build.call_count, 1)
        self.assertFalse(r1.json().get("from_cache"))
        self.assertTrue(r2.json().get("from_cache"))
