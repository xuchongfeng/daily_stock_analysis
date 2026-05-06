# -*- coding: utf-8 -*-
"""C 端门户订阅档位配额（与前台定价说明对齐；计费逻辑以实际上线规则为准）。"""

from __future__ import annotations

from typing import Any, Dict, Tuple

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

# 档位高低（用于校验升级意向）；与前台定价顺序一致
TIER_RANK: Dict[str, int] = {
    "free": 0,
    "p19": 1,
    "p49": 2,
    "p99": 3,
}


def normalize_plan_tier(raw: str | None) -> str:
    s = (raw or "").strip().lower()
    return s if s in PORTAL_PLAN_LIMITS else "free"


def plan_tier_rank(tier: str | None) -> int:
    return int(TIER_RANK.get(normalize_plan_tier(tier), 0))


def validate_plan_upgrade_target(from_tier: str | None, target_tier: str | None) -> Tuple[bool, str]:
    """
    校验升级意向：目标须为已定义的付费档，且高于当前生效档位。
    返回 (是否通过, 中文错误说明)。
    """
    raw_target = (target_tier or "").strip().lower()
    if not raw_target:
        return False, "请选择目标档位"
    if raw_target not in PORTAL_PLAN_LIMITS:
        return False, "无效的档位"
    if raw_target == "free":
        return False, "请选择付费档位"
    current = normalize_plan_tier(from_tier)
    normalized_target = normalize_plan_tier(raw_target)
    if plan_tier_rank(normalized_target) <= plan_tier_rank(current):
        return False, "请选择高于当前档位的套餐"
    return True, ""


def limits_for_tier(tier: str | None) -> Dict[str, Any]:
    return dict(PORTAL_PLAN_LIMITS.get(normalize_plan_tier(tier), PORTAL_PLAN_LIMITS["free"]))
