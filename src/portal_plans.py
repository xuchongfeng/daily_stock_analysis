# -*- coding: utf-8 -*-
"""C 端门户订阅档位配额（与前台定价说明对齐；计费逻辑以实际上线规则为准）。"""

from __future__ import annotations

from typing import Any, Dict

# 键与 apps/dsa-user/src/content/pricingPlans.ts 中 PricingTierId 一致
PORTAL_PLAN_LIMITS: Dict[str, Dict[str, Any]] = {
    "free": {
        "label": "免费",
        "ai_analysis_month": 30,
        "watchlist_max": 15,
        "stock_search_month": 200,
    },
    "p19": {
        "label": "入门",
        "ai_analysis_month": 200,
        "watchlist_max": 50,
        "stock_search_month": 800,
    },
    "p49": {
        "label": "进阶",
        "ai_analysis_month": 900,
        "watchlist_max": 200,
        "stock_search_month": 3000,
    },
    "p99": {
        "label": "专业",
        "ai_analysis_month": 3000,
        "watchlist_max": 500,
        "stock_search_month": 10000,
    },
}


def normalize_plan_tier(raw: str | None) -> str:
    s = (raw or "").strip().lower()
    return s if s in PORTAL_PLAN_LIMITS else "free"


def limits_for_tier(tier: str | None) -> Dict[str, Any]:
    return dict(PORTAL_PLAN_LIMITS.get(normalize_plan_tier(tier), PORTAL_PLAN_LIMITS["free"]))
