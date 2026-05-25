# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.storage import DatabaseManager


class TestDiscoverIndustryChains(unittest.TestCase):
    def tearDown(self):
        DatabaseManager.reset_instance()

    def test_crud_list_detail(self):
        DatabaseManager.reset_instance()
        db = DatabaseManager(db_url='sqlite:///:memory:')

        created = db.create_discover_industry_chain(
            slug='ev-battery',
            name='动力电池',
            introduction='上下游概览',
            latest_news='某龙头扩产',
            core_stocks=[
                {'stock_code': '300750', 'stock_name': '宁德时代', 'role': '龙头', 'sort_order': 0},
            ],
            market='cn',
            status='active',
            sort_order=10,
        )
        self.assertEqual(created['slug'], 'ev-battery')
        self.assertEqual(created['core_stock_count'], 1)

        items = db.list_discover_industry_chains(statuses=['active'], limit=10)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['name'], '动力电池')

        detail = db.get_discover_industry_chain_detail('ev-battery')
        assert detail is not None
        self.assertEqual(detail['latest_news'], '某龙头扩产')
        self.assertEqual(len(detail['core_stocks']), 1)
        self.assertEqual(detail['core_stocks'][0]['stock_code'], '300750')

        updated = db.update_discover_industry_chain(
            'ev-battery',
            latest_news='政策加码',
            core_stocks=[
                {'stock_code': '300750', 'stock_name': '宁德时代', 'role': '龙头'},
                {'stock_code': '002594', 'stock_name': '比亚迪', 'role': '整车'},
            ],
        )
        assert updated is not None
        self.assertEqual(updated['core_stock_count'], 2)

        ok = db.delete_discover_industry_chain('ev-battery')
        self.assertTrue(ok)
        self.assertIsNone(db.get_discover_industry_chain_detail('ev-battery'))

    def test_create_requires_slug_and_name(self):
        DatabaseManager.reset_instance()
        db = DatabaseManager(db_url='sqlite:///:memory:')
        with self.assertRaises(ValueError):
            db.create_discover_industry_chain(slug='', name='x')


if __name__ == '__main__':
    unittest.main()
