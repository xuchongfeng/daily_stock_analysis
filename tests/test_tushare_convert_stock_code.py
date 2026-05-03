# -*- coding: utf-8 -*-
"""TushareFetcher._convert_stock_code: exchange hint vs A-share listing conventions."""

import unittest

from data_provider.tushare_fetcher import TushareFetcher


class TushareConvertStockCodeTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.fetcher = TushareFetcher.__new__(TushareFetcher)

    def test_sh_prefix_on_sz_stock_000301_maps_to_sz(self) -> None:
        """误写的 SH000301（深市东方盛虹）不可变成 000301.SH。"""
        self.assertEqual(self.fetcher._convert_stock_code("SH000301"), "000301.SZ")

    def test_plain_000301_maps_to_sz(self) -> None:
        self.assertEqual(self.fetcher._convert_stock_code("000301"), "000301.SZ")

    def test_sh000001_stays_sh_index(self) -> None:
        self.assertEqual(self.fetcher._convert_stock_code("SH000001"), "000001.SH")

    def test_sz600519_corrected_to_sh(self) -> None:
        self.assertEqual(self.fetcher._convert_stock_code("SZ600519"), "600519.SH")


if __name__ == "__main__":
    unittest.main()
