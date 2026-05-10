# -*- coding: utf-8 -*-
"""门户月度 AI 分析配额拦截逻辑单元测试。"""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


from fastapi import HTTPException

from src.portal_usage import ensure_portal_monthly_ai_quota_or_raise


class PortalAiQuotaTestCase(unittest.TestCase):
    def test_skips_when_no_portal_user(self) -> None:
        session = MagicMock()
        ensure_portal_monthly_ai_quota_or_raise(session, None, ["600519.SH"])
        session.scalar.assert_not_called()

    @patch("src.portal_usage.get_portal_user_by_id", return_value=None)
    def test_skips_when_user_row_missing(self, _mock_get: MagicMock) -> None:
        session = MagicMock()
        ensure_portal_monthly_ai_quota_or_raise(session, 42, ["600519.SH"])

    @patch("src.portal_usage.get_task_queue")
    @patch("src.portal_usage.count_portal_analysis_month", return_value=5)
    def test_skips_when_cap_non_positive(self, _cnt: MagicMock, _tq: MagicMock) -> None:
        session = MagicMock()
        row = SimpleNamespace(plan_tier="free")
        with patch("src.portal_usage.get_portal_user_by_id", return_value=row), patch(
            "src.portal_usage.limits_for_tier",
            return_value={"ai_analysis_month": 0},
        ):
            ensure_portal_monthly_ai_quota_or_raise(session, 1, ["600519.SH"])

    @patch("src.portal_usage.get_task_queue")
    @patch("src.portal_usage.count_portal_analysis_month", return_value=30)
    def test_raises_when_quota_insufficient(self, _cnt: MagicMock, mock_tq: MagicMock) -> None:
        mock_tq.return_value.count_distinct_new_queue_slots.return_value = 1
        session = MagicMock()
        row = SimpleNamespace(plan_tier="free")
        with patch("src.portal_usage.get_portal_user_by_id", return_value=row), patch(
            "src.portal_usage.limits_for_tier",
            return_value={"ai_analysis_month": 30},
        ):
            with self.assertRaises(HTTPException) as ctx:
                ensure_portal_monthly_ai_quota_or_raise(session, 1, ["600519.SH"])
        ex = ctx.exception
        self.assertEqual(ex.status_code, 403)
        detail = ex.detail
        self.assertEqual(detail["error"], "portal_ai_quota_exceeded")
        self.assertEqual(detail["used"], 30)
        self.assertEqual(detail["cap"], 30)
        self.assertEqual(detail["requested"], 1)
        self.assertEqual(detail["remaining"], 0)

    @patch("src.portal_usage.get_task_queue")
    @patch("src.portal_usage.count_portal_analysis_month", return_value=29)
    def test_allows_when_within_quota(self, _cnt: MagicMock, mock_tq: MagicMock) -> None:
        mock_tq.return_value.count_distinct_new_queue_slots.return_value = 1
        session = MagicMock()
        row = SimpleNamespace(plan_tier="free")
        with patch("src.portal_usage.get_portal_user_by_id", return_value=row), patch(
            "src.portal_usage.limits_for_tier",
            return_value={"ai_analysis_month": 30},
        ):
            ensure_portal_monthly_ai_quota_or_raise(session, 1, ["600519.SH"])

    @patch("src.portal_usage.get_task_queue")
    @patch("src.portal_usage.count_portal_analysis_month", return_value=30)
    def test_skips_when_only_duplicate_queue_slots(self, _cnt: MagicMock, mock_tq: MagicMock) -> None:
        mock_tq.return_value.count_distinct_new_queue_slots.return_value = 0
        session = MagicMock()
        row = SimpleNamespace(plan_tier="free")
        with patch("src.portal_usage.get_portal_user_by_id", return_value=row), patch(
            "src.portal_usage.limits_for_tier",
            return_value={"ai_analysis_month": 30},
        ):
            ensure_portal_monthly_ai_quota_or_raise(session, 1, ["600519.SH"])


if __name__ == "__main__":
    unittest.main()
