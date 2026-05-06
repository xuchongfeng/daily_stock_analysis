# -*- coding: utf-8 -*-
"""持仓现价：stock_daily 代码候选（港股 HK 前缀对齐）。"""
import os
import sys
import unittest
from datetime import date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.repositories.portfolio_repo import (
    PortfolioRepository,
    _portfolio_stock_daily_code_candidates,
)
from src.storage import DatabaseManager, StockDaily


class TestPortfolioStockDailyCandidates(unittest.TestCase):
    def test_hk_short_code_adds_hk_prefix_candidate(self):
        c = _portfolio_stock_daily_code_candidates('00700', 'hk')
        self.assertIn('HK00700', c)
        self.assertIn('00700', c)

    def test_get_latest_close_matches_db_hk_form(self):
        DatabaseManager.reset_instance()
        db = DatabaseManager(db_url='sqlite:///:memory:')
        repo = PortfolioRepository(db)

        d = date(2026, 4, 1)
        with db.get_session() as session:
            session.add(
                StockDaily(
                    code='HK00700',
                    date=d,
                    open=100.0,
                    high=101.0,
                    low=99.0,
                    close=100.5,
                    volume=1e6,
                    amount=None,
                    pct_chg=None,
                    ma5=None,
                    ma10=None,
                    ma20=None,
                    volume_ratio=None,
                    data_source='test',
                    created_at=None,
                    updated_at=None,
                )
            )
            session.commit()

        px = repo.get_latest_close('00700', d, market='hk')
        self.assertAlmostEqual(px or 0.0, 100.5, places=4)

        DatabaseManager.reset_instance()


if __name__ == '__main__':
    unittest.main()
