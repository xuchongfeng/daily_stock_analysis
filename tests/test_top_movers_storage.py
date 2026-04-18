# -*- coding: utf-8 -*-
"""SQLite 涨幅榜字段迁移与批次查询单测。"""

import os
import tempfile
import unittest
from datetime import date

from src.config import Config
from src.storage import DatabaseManager, AnalysisHistory


class TopMoversStorageTest(unittest.TestCase):
    def setUp(self) -> None:
        self._temp = tempfile.TemporaryDirectory()
        self._db_path = os.path.join(self._temp.name, "tm.db")
        os.environ["DATABASE_PATH"] = self._db_path
        Config._instance = None
        DatabaseManager.reset_instance()
        self.db = DatabaseManager.get_instance()

    def tearDown(self) -> None:
        DatabaseManager.reset_instance()
        self._temp.cleanup()

    def test_list_batches_and_items(self) -> None:
        batch_run_id = "tm_20260405_test1234"
        with self.db.get_session() as session:
            session.add(
                AnalysisHistory(
                    query_id="q1",
                    code="000001",
                    name="测试A",
                    report_type="simple",
                    sentiment_score=80,
                    operation_advice="持有",
                    trend_prediction="看多",
                    analysis_summary="s",
                    raw_result="{}",
                    batch_kind="top_movers_daily",
                    batch_run_id=batch_run_id,
                    rank_in_batch=1,
                    ref_change_pct=9.5,
                )
            )
            session.add(
                AnalysisHistory(
                    query_id="q2",
                    code="000002",
                    name="测试B",
                    report_type="simple",
                    sentiment_score=60,
                    operation_advice="观望",
                    trend_prediction="震荡",
                    analysis_summary="s",
                    raw_result="{}",
                    batch_kind="top_movers_daily",
                    batch_run_id=batch_run_id,
                    rank_in_batch=2,
                    ref_change_pct=8.0,
                )
            )
            session.commit()

        batches = self.db.list_top_mover_batch_runs(limit=10)
        self.assertEqual(len(batches), 1)
        self.assertEqual(batches[0]["batch_run_id"], batch_run_id)
        self.assertEqual(batches[0]["batch_kind"], "top_movers_daily")
        self.assertEqual(batches[0]["item_count"], 2)

        rows, total = self.db.get_top_mover_batch_items(
            batch_run_id, sort_by="sentiment_score", order_desc=True, offset=0, limit=10
        )
        self.assertEqual(total, 2)
        self.assertEqual(rows[0].code, "000001")
        self.assertEqual(rows[1].code, "000002")

    def test_list_batches_filter_by_batch_date(self) -> None:
        with self.db.get_session() as session:
            for bid, code in (
                ("tm_20260405_a", "000001"),
                ("tm_20260406_b", "000002"),
            ):
                session.add(
                    AnalysisHistory(
                        query_id=f"q-{bid}",
                        code=code,
                        name="x",
                        report_type="simple",
                        sentiment_score=50,
                        operation_advice="—",
                        trend_prediction="—",
                        analysis_summary="s",
                        raw_result="{}",
                        batch_kind="top_movers_daily",
                        batch_run_id=bid,
                        rank_in_batch=1,
                        ref_change_pct=1.0,
                    )
                )
            session.commit()

        all_batches = self.db.list_top_mover_batch_runs(limit=20)
        self.assertEqual(len(all_batches), 2)

        day5 = self.db.list_top_mover_batch_runs(limit=20, batch_date=date(2026, 4, 5))
        self.assertEqual(len(day5), 1)
        self.assertEqual(day5[0]["batch_run_id"], "tm_20260405_a")

        day7 = self.db.list_top_mover_batch_runs(limit=20, batch_date=date(2026, 4, 7))
        self.assertEqual(day7, [])

    def test_scan_kind_gainers_volume_and_all(self) -> None:
        with self.db.get_session() as session:
            session.add(
                AnalysisHistory(
                    query_id="qg",
                    code="000001",
                    name="g",
                    report_type="simple",
                    sentiment_score=50,
                    operation_advice="—",
                    trend_prediction="—",
                    analysis_summary="s",
                    raw_result="{}",
                    batch_kind="top_movers_daily",
                    batch_run_id="tm_20260405_g",
                    rank_in_batch=1,
                    ref_change_pct=1.0,
                )
            )
            session.add(
                AnalysisHistory(
                    query_id="qv",
                    code="000002",
                    name="v",
                    report_type="simple",
                    sentiment_score=50,
                    operation_advice="—",
                    trend_prediction="—",
                    analysis_summary="s",
                    raw_result="{}",
                    batch_kind="top_volume_daily",
                    batch_run_id="tv_20260405_v",
                    rank_in_batch=1,
                    ref_change_pct=0.0,
                    ref_trade_volume=12345.0,
                )
            )
            session.commit()

        all_b = self.db.list_top_mover_batch_runs(limit=20, scan_kind="all")
        self.assertEqual(len(all_b), 2)
        gonly = self.db.list_top_mover_batch_runs(limit=20, scan_kind="gainers")
        self.assertEqual(len(gonly), 1)
        self.assertEqual(gonly[0]["batch_kind"], "top_movers_daily")
        vonly = self.db.list_top_mover_batch_runs(limit=20, scan_kind="volume")
        self.assertEqual(len(vonly), 1)
        self.assertEqual(vonly[0]["batch_kind"], "top_volume_daily")

        rows, total = self.db.get_top_mover_batch_items(
            "tv_20260405_v", sort_by="ref_trade_volume", order_desc=True, offset=0, limit=10
        )
        self.assertEqual(total, 1)
        self.assertEqual(rows[0].ref_trade_volume, 12345.0)

    def test_volume_scan_daily_ge_score_counts_and_stock_series(self) -> None:
        bid = "tv_20260410_deadbeef"
        with self.db.get_session() as session:
            session.add(
                AnalysisHistory(
                    query_id="v1",
                    code="600519",
                    name="茅台",
                    report_type="simple",
                    sentiment_score=72,
                    operation_advice="持有",
                    trend_prediction="—",
                    analysis_summary="s",
                    raw_result="{}",
                    batch_kind="top_volume_daily",
                    batch_run_id=bid,
                    rank_in_batch=3,
                    ref_change_pct=1.0,
                    ref_trade_volume=100.0,
                )
            )
            session.add(
                AnalysisHistory(
                    query_id="v2",
                    code="000001",
                    name="平安",
                    report_type="simple",
                    sentiment_score=65,
                    operation_advice="观望",
                    trend_prediction="—",
                    analysis_summary="s",
                    raw_result="{}",
                    batch_kind="top_volume_daily",
                    batch_run_id=bid,
                    rank_in_batch=10,
                    ref_change_pct=0.5,
                    ref_trade_volume=200.0,
                )
            )
            session.add(
                AnalysisHistory(
                    query_id="v3",
                    code="600519",
                    name="茅台",
                    report_type="simple",
                    sentiment_score=68,
                    operation_advice="观望",
                    trend_prediction="—",
                    analysis_summary="s",
                    raw_result="{}",
                    batch_kind="top_volume_daily",
                    batch_run_id=bid,
                    rank_in_batch=5,
                    ref_change_pct=-0.2,
                    ref_trade_volume=150.0,
                )
            )
            session.commit()

        daily = self.db.get_volume_scan_daily_ge_score_stock_counts(min_score=70)
        self.assertEqual(len(daily), 1)
        self.assertEqual(daily[0]["trade_date"], "2026-04-10")
        self.assertEqual(daily[0]["stock_count"], 1)

        daily60 = self.db.get_volume_scan_daily_ge_score_stock_counts(min_score=60)
        self.assertEqual(daily60[0]["stock_count"], 2)

        series = self.db.get_volume_scan_stock_rating_series("600519")
        self.assertEqual(len(series), 1)
        self.assertEqual(series[0]["trade_date"], "2026-04-10")
        self.assertEqual(series[0]["sentiment_score"], 68)
        self.assertEqual(series[0]["batch_run_id"], bid)
        self.assertIn("id", series[0])
        self.assertIsNotNone(series[0]["id"])
