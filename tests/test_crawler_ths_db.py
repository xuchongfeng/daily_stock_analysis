# -*- coding: utf-8 -*-
"""Tests for persisting THS concept crawl rows into SQLite."""

import os
import tempfile
import unittest

from src.config import Config
from src.storage import (
    AnalysisHistory,
    CrawlerThsConcept,
    CrawlerThsConceptConstituent,
    CrawlerThsConceptRun,
    DatabaseManager,
)
from sqlalchemy import select, func


class CrawlerThsDbTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._temp_dir = tempfile.TemporaryDirectory()
        self._db_path = os.path.join(self._temp_dir.name, "test_crawler_ths.db")
        os.environ["DATABASE_PATH"] = self._db_path
        Config._instance = None
        DatabaseManager.reset_instance()
        self.db = DatabaseManager.get_instance()

    def tearDown(self) -> None:
        DatabaseManager.reset_instance()
        Config._instance = None
        self._temp_dir.cleanup()

    def test_save_ths_concept_crawl_inserts_and_replaces(self) -> None:
        self.db.save_ths_concept_crawl(
            run_id="runtest1",
            task_id="ths-concept",
            catalog_url="https://q.10jqka.com.cn/gn/detail/code/308718/",
            dry_run=False,
            ok=True,
            message="完成",
            stats={"concepts_seen": 1, "constituent_rows": 1},
            errors=[],
            output_path="/data/crawler/ths_concept/runtest1",
            concepts=[
                {
                    "concept_code": "308614",
                    "concept_name": "测试概念",
                    "detail_url": "http://q.10jqka.com.cn/gn/detail/code/308614/",
                    "crawled_at": "2026-01-01T00:00:00+00:00",
                }
            ],
            constituents=[
                {
                    "concept_code": "308614",
                    "stock_code": "600519",
                    "stock_name": "贵州茅台",
                    "page": 1,
                    "row_index": 0,
                    "crawled_at": "2026-01-01T00:00:00+00:00",
                }
            ],
        )

        with self.db.get_session() as session:
            n_run = session.scalar(select(func.count()).select_from(CrawlerThsConceptRun))
            n_con = session.scalar(select(func.count()).select_from(CrawlerThsConcept))
            n_cst = session.scalar(select(func.count()).select_from(CrawlerThsConceptConstituent))
        self.assertEqual(n_run, 1)
        self.assertEqual(n_con, 1)
        self.assertEqual(n_cst, 1)

        self.db.save_ths_concept_crawl(
            run_id="runtest1",
            task_id="ths-concept",
            catalog_url="https://q.10jqka.com.cn/gn/detail/code/308718/",
            dry_run=False,
            ok=True,
            message="完成",
            stats={"concepts_seen": 1, "constituent_rows": 0},
            errors=[],
            output_path="/data/crawler/ths_concept/runtest1",
            concepts=[
                {
                    "concept_code": "308614",
                    "concept_name": "测试概念",
                    "detail_url": "http://q.10jqka.com.cn/gn/detail/code/308614/",
                    "crawled_at": "2026-01-02T00:00:00+00:00",
                }
            ],
            constituents=[],
        )

        with self.db.get_session() as session:
            n_run = session.scalar(select(func.count()).select_from(CrawlerThsConceptRun))
            n_cst = session.scalar(select(func.count()).select_from(CrawlerThsConceptConstituent))
        self.assertEqual(n_run, 1)
        self.assertEqual(n_cst, 0)

    def test_list_ths_concept_runs_and_children(self) -> None:
        self.db.save_ths_concept_crawl(
            run_id="runlist1",
            task_id="ths-concept",
            catalog_url="https://q.10jqka.com.cn/gn/detail/code/308718/",
            dry_run=False,
            ok=True,
            message="完成",
            stats={"concepts_seen": 1, "constituent_rows": 1},
            errors=[],
            output_path="/tmp/runlist1",
            concepts=[
                {
                    "concept_code": "308614",
                    "concept_name": "列表测试概念",
                    "detail_url": "http://q.10jqka.com.cn/gn/detail/code/308614/",
                    "crawled_at": "2026-01-01T00:00:00+00:00",
                }
            ],
            constituents=[
                {
                    "concept_code": "308614",
                    "stock_code": "600519",
                    "stock_name": "贵州茅台",
                    "page": 1,
                    "row_index": 0,
                    "crawled_at": "2026-01-01T00:00:00+00:00",
                }
            ],
        )
        self.assertTrue(self.db.ths_concept_run_exists("runlist1"))
        self.assertFalse(self.db.ths_concept_run_exists("missing"))

        runs, total = self.db.list_ths_concept_runs(limit=10, offset=0)
        self.assertEqual(total, 1)
        self.assertEqual(len(runs), 1)
        self.assertEqual(runs[0]["run_id"], "runlist1")
        self.assertEqual(runs[0]["concept_count"], 1)
        self.assertEqual(runs[0]["constituent_count"], 1)
        self.assertEqual(runs[0]["stats"].get("constituent_rows"), 1)

        concepts, ct = self.db.list_ths_concepts_for_run("runlist1", limit=50, offset=0)
        self.assertEqual(ct, 1)
        self.assertEqual(concepts[0]["concept_code"], "308614")

        cons, nt = self.db.list_ths_constituents_for_run("runlist1", concept_code=None, limit=50, offset=0)
        self.assertEqual(nt, 1)
        self.assertEqual(cons[0]["stock_code"], "600519")

        cons_f, nt2 = self.db.list_ths_constituents_for_run(
            "runlist1", concept_code="308614", limit=50, offset=0
        )
        self.assertEqual(nt2, 1)
        self.assertEqual(len(cons_f), 1)

    def test_aggregate_ths_sector_stats_for_volume_batch(self) -> None:
        self.db.save_ths_concept_crawl(
            run_id="runvol1",
            task_id="ths-concept",
            catalog_url="https://q.10jqka.com.cn/gn/detail/code/308718/",
            dry_run=False,
            ok=True,
            message="完成",
            stats={},
            errors=[],
            output_path="/tmp/runvol1",
            concepts=[
                {
                    "concept_code": "308614",
                    "concept_name": "量榜板块测试",
                    "detail_url": "http://q.10jqka.com.cn/gn/detail/code/308614/",
                    "crawled_at": "2026-01-01T00:00:00+00:00",
                }
            ],
            constituents=[
                {
                    "concept_code": "308614",
                    "stock_code": "600519",
                    "stock_name": "贵州茅台",
                    "page": 1,
                    "row_index": 0,
                    "crawled_at": "2026-01-01T00:00:00+00:00",
                }
            ],
        )
        bid = "tv_20260410_a1b2c3d4"
        with self.db.get_session() as session:
            session.add(
                AnalysisHistory(
                    query_id="qv1",
                    code="600519",
                    name="贵州茅台",
                    report_type="simple",
                    sentiment_score=72,
                    operation_advice="持有",
                    trend_prediction="—",
                    analysis_summary="s",
                    raw_result="{}",
                    batch_kind="top_volume_daily",
                    batch_run_id=bid,
                    rank_in_batch=15,
                    ref_change_pct=1.2,
                    ref_trade_volume=500.0,
                )
            )
            session.add(
                AnalysisHistory(
                    query_id="qv2",
                    code="000001",
                    name="平安",
                    report_type="simple",
                    sentiment_score=60,
                    operation_advice="观望",
                    trend_prediction="—",
                    analysis_summary="s",
                    raw_result="{}",
                    batch_kind="top_volume_daily",
                    batch_run_id=bid,
                    rank_in_batch=200,
                    ref_change_pct=-0.5,
                    ref_trade_volume=100.0,
                )
            )
            session.commit()

        batch_total, items = self.db.aggregate_ths_sector_stats_for_volume_batch("runvol1", bid)
        self.assertEqual(batch_total, 2)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["concept_code"], "308614")
        self.assertEqual(items[0]["stocks_in_batch"], 1)
        self.assertEqual(items[0]["avg_sentiment_score"], 72.0)
        self.assertEqual(items[0]["best_rank_in_batch"], 15)

        empty, no_items = self.db.aggregate_ths_sector_stats_for_volume_batch("runvol1", "tm_20260410_a1b2c3d4")
        self.assertEqual(empty, 0)
        self.assertEqual(no_items, [])


if __name__ == "__main__":
    unittest.main()
