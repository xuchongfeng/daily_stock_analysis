# -*- coding: utf-8 -*-

import tempfile
import unittest
from pathlib import Path

from src.utils.stock_list_csv import codes_from_tushare_stock_csv


class StockListCsvTestCase(unittest.TestCase):
    def test_a_share_symbol_and_ts_code(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "a.csv"
            p.write_text(
                "ts_code,symbol,name\n000001.SZ,000001,Ping An Bank\n600519.SH,600519,Kweichow\n",
                encoding="utf-8",
            )
            codes = codes_from_tushare_stock_csv(p)
            self.assertEqual(codes, ["000001", "600519"])

    def test_missing_file(self) -> None:
        with self.assertRaises(FileNotFoundError):
            codes_from_tushare_stock_csv(Path("/nonexistent/stock_list_a.csv"))


if __name__ == "__main__":
    unittest.main()
