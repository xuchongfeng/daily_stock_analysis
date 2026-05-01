# -*- coding: utf-8 -*-
"""GET /analysis/status/{task_id}：队列内已完成任务应返回 result，而非仅 status。"""

from __future__ import annotations

import tempfile
import unittest
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
from src.services.task_queue import TaskInfo, TaskStatus as TS
from src.storage import DatabaseManager


class AnalysisStatusQueueResultTest(unittest.TestCase):
    def setUp(self) -> None:
        DatabaseManager.reset_instance()
        Config.reset_instance()
        self._static_root = tempfile.TemporaryDirectory()
        self.addCleanup(self._static_root.cleanup)
        p = Path(self._static_root.name)
        self.app = create_app(static_dir=p, user_static_dir=p)
        self.client = TestClient(self.app)

    def tearDown(self) -> None:
        DatabaseManager.reset_instance()
        Config.reset_instance()

    @patch("api.v1.endpoints.analysis.get_task_queue")
    def test_completed_in_queue_returns_report(self, mock_get_q: MagicMock) -> None:
        t = TaskInfo(
            task_id="tid-abc",
            stock_code="600519",
            stock_name="茅台",
            status=TS.COMPLETED,
            progress=100,
            result={
                "stock_code": "600519",
                "stock_name": "贵州茅台",
                "report": {
                    "meta": {"query_id": "tid-abc", "stock_code": "600519"},
                    "summary": {
                        "sentiment_score": 70,
                        "operation_advice": "持有",
                        "trend_prediction": "震荡",
                        "analysis_summary": "测试摘要",
                    },
                },
            },
        )
        mock_get_q.return_value.get_task.return_value = t

        r = self.client.get("/api/v1/analysis/status/tid-abc")
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        self.assertEqual(data.get("status"), "completed")
        res = data.get("result") or {}
        rep = res.get("report") or {}
        summ = rep.get("summary") or {}
        self.assertEqual(summ.get("sentiment_score"), 70)
        self.assertEqual(summ.get("analysis_summary"), "测试摘要")
