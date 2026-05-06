# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.storage import DatabaseManager


class TestDiscoverHotEvents(unittest.TestCase):
    def tearDown(self):
        DatabaseManager.reset_instance()

    def test_sync_list_detail(self):
        DatabaseManager.reset_instance()
        db = DatabaseManager(db_url='sqlite:///:memory:')

        n = db.sync_discover_hot_events_from_seed(
            [
                {
                    'slug': 'test-theme',
                    'title': '测试主题',
                    'summary': '摘要',
                    'market': 'cn',
                    'status': 'active',
                    'heat_score': 42,
                    'board_codes': [],
                    'anchor_stocks': [
                        {'stock_code': '600519', 'stock_name': '贵州茅台', 'role': '龙头'},
                    ],
                    'core_metrics': [{'label': '指标A', 'value': '+1%', 'hint': '示例'}],
                    'source_note': '免责声明',
                    'started_at': '2026-04-01',
                    'timeline': [
                        {
                            'occurred_on': '2026-04-02',
                            'headline': '节点一',
                            'body': '正文',
                            'kind': 'news',
                        },
                    ],
                },
            ]
        )
        self.assertEqual(n, 1)

        items = db.list_discover_hot_events(statuses=['active'], limit=10)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['slug'], 'test-theme')
        self.assertEqual(items[0]['heat_score'], 42)

        detail = db.get_discover_hot_event_detail('test-theme')
        assert detail is not None
        self.assertEqual(detail['title'], '测试主题')
        self.assertEqual(len(detail['timeline']), 1)
        self.assertEqual(detail['timeline'][0]['headline'], '节点一')
        self.assertEqual(len(detail['anchor_stocks']), 1)
        self.assertEqual(detail['anchor_stocks'][0]['stock_code'], '600519')

    def test_invalid_slug_skipped_in_seed(self):
        DatabaseManager.reset_instance()
        db = DatabaseManager(db_url='sqlite:///:memory:')
        n = db.sync_discover_hot_events_from_seed(
            [
                {'slug': 'BAD SLUG', 'title': 'x'},
                {'slug': 'ok-slug', 'title': '好的'},
            ]
        )
        self.assertEqual(n, 1)
        rows = db.list_discover_hot_events(statuses=None, limit=10)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['slug'], 'ok-slug')


if __name__ == '__main__':
    unittest.main()
