# -*- coding: utf-8 -*-
"""
===================================
API v1 路由聚合
===================================

职责：
1. 聚合 v1 版本的所有 endpoint 路由
2. 统一添加 /api/v1 前缀
"""

from fastapi import APIRouter

from api.v1.endpoints import (
    analysis,
    auth,
    portal_auth,
    portal_account,
    history,
    public_demo,
    feedback_public,
    feedback_admin,
    analytics_public,
    business_metrics,
    stocks,
    backtest,
    system_config,
    agent,
    usage,
    portfolio,
    market_scan,
    signal_digest,
    concept_board,
    discover_hot_event,
    discover_industry_chain,
    watchlist,
)

# 创建 v1 版本主路由
router = APIRouter(prefix="/api/v1")

router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Auth"]
)

router.include_router(portal_auth.router, prefix="/auth")

router.include_router(portal_account.router, prefix="/auth/portal")

router.include_router(
    agent.router,
    prefix="/agent",
    tags=["Agent"]
)

router.include_router(
    analysis.router,
    prefix="/analysis",
    tags=["Analysis"]
)

router.include_router(
    history.router,
    prefix="/history",
    tags=["History"]
)

router.include_router(
    public_demo.router,
    prefix="/public",
    tags=["PublicDemo"],
)

router.include_router(
    feedback_public.router,
    prefix="/public",
    tags=["UserFeedback"],
)

router.include_router(
    analytics_public.router,
    prefix="/public",
    tags=["Analytics"],
)

router.include_router(
    feedback_admin.router,
    prefix="/system",
    tags=["UserFeedback"],
)

router.include_router(
    stocks.router,
    prefix="/stocks",
    tags=["Stocks"]
)

router.include_router(
    backtest.router,
    prefix="/backtest",
    tags=["Backtest"]
)

router.include_router(
    system_config.router,
    prefix="/system",
    tags=["SystemConfig"]
)

router.include_router(
    business_metrics.router,
    prefix="/system",
    tags=["BusinessMetrics"],
)

router.include_router(
    usage.router,
    prefix="/usage",
    tags=["Usage"]
)

router.include_router(
    portfolio.router,
    prefix="/portfolio",
    tags=["Portfolio"]
)

router.include_router(
    market_scan.router,
    prefix="/market-scanner",
    tags=["榜单扫描"],
)
router.include_router(
    market_scan.router,
    prefix="/top-movers",
    tags=["榜单扫描(兼容)"],
)

router.include_router(
    signal_digest.router,
    prefix="/insights/signal-digest",
    tags=["Insights"],
)

router.include_router(
    concept_board.router,
    prefix="/concept-boards",
    tags=["ConceptBoards"],
)

router.include_router(
    discover_hot_event.router,
    prefix="/discover/hot-events",
    tags=["DiscoverHotEvents"],
)

router.include_router(
    discover_industry_chain.router,
    prefix="/discover/industry-chains",
    tags=["DiscoverIndustryChains"],
)

router.include_router(
    watchlist.router,
    prefix="/watchlist",
    tags=["Watchlist"],
)
