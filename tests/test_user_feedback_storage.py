# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.storage import DatabaseManager, UserFeedback


class TestUserFeedbackStorage(unittest.TestCase):
    def tearDown(self):
        DatabaseManager.reset_instance()

    def test_insert_and_list_user_feedback(self):
        DatabaseManager.reset_instance()
        db = DatabaseManager(db_url='sqlite:///:memory:')

        rid = db.insert_user_feedback(
            'hello feedback',
            contact='a@b.com',
            portal_user_id=None,
            page_url='/user/today',
            user_agent='pytest',
        )
        self.assertGreater(rid, 0)

        rows, total = db.list_user_feedback_paginated(offset=0, limit=10)
        self.assertEqual(total, 1)
        self.assertEqual(len(rows), 1)
        self.assertIsInstance(rows[0], UserFeedback)
        self.assertEqual(rows[0].message, 'hello feedback')
        self.assertEqual(rows[0].contact, 'a@b.com')


if __name__ == '__main__':
    unittest.main()
