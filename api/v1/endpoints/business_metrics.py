# -*- coding: utf-8 -*-
"""管理端运营指标（需管理员会话；见 ``require_admin_session``）。"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import get_database_manager, require_admin_session
from api.v1.schemas.business_metrics import (
    BusinessMetricsDailySeriesResponse,
    BusinessMetricsResponse,
)
from api.v1.schemas.common import ErrorResponse
from src.storage import DatabaseManager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/business-metrics",
    response_model=BusinessMetricsResponse,
    responses={
        200: {"description": "当日汇总"},
        403: {"description": "需要管理员登录", "model": ErrorResponse},
        500: {"description": "服务器错误", "model": ErrorResponse},
    },
    summary="今日运营指标汇总",
    description="聚合 PV/UV、门户注册、问股消息数等；口径见 docs/business-metrics.md。",
)
def get_business_metrics(
    _: None = Depends(require_admin_session),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> BusinessMetricsResponse:
    try:
        snap = db_manager.get_business_metrics_snapshot()
        return BusinessMetricsResponse(**snap)
    except Exception as e:
        logger.error("get_business_metrics failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": "查询运营指标失败"},
        ) from e


@router.get(
    "/business-metrics/daily",
    response_model=BusinessMetricsDailySeriesResponse,
    responses={
        200: {"description": "按日序列"},
        403: {"description": "需要管理员登录", "model": ErrorResponse},
        500: {"description": "服务器错误", "model": ErrorResponse},
    },
    summary="运营指标按日序列",
    description="返回最近若干自然日的 PV/UV、注册、问股等；口径与当日汇总一致，详见 docs/business-metrics.md。",
)
def get_business_metrics_daily(
    days: int = Query(30, ge=1, le=90, description="自然日个数，最大 90"),
    _: None = Depends(require_admin_session),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> BusinessMetricsDailySeriesResponse:
    try:
        payload = db_manager.get_business_metrics_daily_series(days=days)
        return BusinessMetricsDailySeriesResponse(**payload)
    except Exception as e:
        logger.error("get_business_metrics_daily failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": "查询运营指标序列失败"},
        ) from e
