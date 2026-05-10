# -*- coding: utf-8 -*-
"""运营指标按日序列聚合（内存 SQLite）。"""
from __future__ import annotations

import os
import sys
import unittest
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.storage import DatabaseManager, PageViewEvent


class TestBusinessMetricsDailySeries(unittest.TestCase):
    def tearDown(self):
        DatabaseManager.reset_instance()

    def test_daily_series_groups_pv_uv(self):
        DatabaseManager.reset_instance()
        db = DatabaseManager(db_url='sqlite:///:memory:')
        today = date.today()
        noon = datetime.strptime('12:00:00', '%H:%M:%S').time()
        t0 = datetime.combine(today, noon)
        t1 = datetime.combine(today - timedelta(days=1), noon)

        with db.get_session() as s:
            s.add(PageViewEvent(visitor_id='u1', path='/a', surface='admin', created_at=t0))
            s.add(PageViewEvent(visitor_id='u1', path='/b', surface='admin', created_at=t0))
            s.add(PageViewEvent(visitor_id='u2', path='/c', surface='portal', created_at=t0))
            s.add(PageViewEvent(visitor_id='u9', path='/z', surface='portal', created_at=t1))
            s.commit()

        out = db.get_business_metrics_daily_series(days=3)
        self.assertEqual(out['days'], 3)
        self.assertIn('series', out)
        by_day = {row['calendar_date']: row for row in out['series']}
        self.assertEqual(by_day[today.isoformat()]['page_views'], 3)
        self.assertEqual(by_day[today.isoformat()]['unique_visitors'], 2)
        self.assertEqual(by_day[(today - timedelta(days=1)).isoformat()]['page_views'], 1)
        self.assertEqual(by_day[(today - timedelta(days=1)).isoformat()]['unique_visitors'], 1)


if __name__ == '__main__':
    unittest.main()
