# -*- coding: utf-8 -*-
"""Tests for earnings_outlook prompt/backfill helpers (fundamental_context earnings.data)."""

from src.analyzer import (
    backfill_dashboard_earnings_outlook_from_fundamentals,
    extract_earnings_forecast_snippets,
)


def _ctx_with_earnings(**earnings_data):
    return {
        "earnings": {
            "status": "partial",
            "data": earnings_data,
        }
    }


def test_extract_both_snippets():
    fc, qr = extract_earnings_forecast_snippets(
        _ctx_with_earnings(
            forecast_summary="  预告扭亏  ",
            quick_report_summary="营收同比+10%",
        )
    )
    assert fc == "预告扭亏"
    assert qr == "营收同比+10%"


def test_extract_empty():
    assert extract_earnings_forecast_snippets(None) == (None, None)
    assert extract_earnings_forecast_snippets({}) == (None, None)


def test_backfill_fills_when_llm_empty():
    dash = {"intelligence": {"earnings_outlook": "", "risk_alerts": []}}
    backfill_dashboard_earnings_outlook_from_fundamentals(
        dash,
        _ctx_with_earnings(forecast_summary="预增50%-80%"),
        report_language="zh",
    )
    assert "预增" in dash["intelligence"]["earnings_outlook"]


def test_backfill_skips_when_llm_nonempty():
    dash = {"intelligence": {"earnings_outlook": "模型已写：稳健增长"}}
    backfill_dashboard_earnings_outlook_from_fundamentals(
        dash,
        _ctx_with_earnings(forecast_summary="不应覆盖"),
        report_language="zh",
    )
    assert dash["intelligence"]["earnings_outlook"] == "模型已写：稳健增长"


def test_backfill_creates_intelligence_block():
    dash = {}
    backfill_dashboard_earnings_outlook_from_fundamentals(
        dash,
        _ctx_with_earnings(quick_report_summary="Q3 EPS beat"),
        report_language="en",
    )
    assert "quick report" in dash["intelligence"]["earnings_outlook"].lower()
