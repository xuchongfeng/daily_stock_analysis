# -*- coding: utf-8 -*-
"""C 端前端构建辅助（user_frontend）最小烟测。"""

import unittest

from src.user_frontend import prepare_user_frontend_assets


class UserFrontendSmokeTest(unittest.TestCase):
    def test_prepare_is_callable(self) -> None:
        self.assertTrue(callable(prepare_user_frontend_assets))

    def test_prepare_disabled_returns_bool(self) -> None:
        r = prepare_user_frontend_assets(enabled=False)
        self.assertIsInstance(r, bool)


if __name__ == "__main__":
    unittest.main()
