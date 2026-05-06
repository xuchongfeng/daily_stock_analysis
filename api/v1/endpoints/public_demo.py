# -*- coding: utf-8 -*-
"""
公开营销示例接口（无需管理员或门户 Cookie）。

在 ADMIN_AUTH_ENABLED 时仍可通过豁免路径访问，供 C 端「个股分析示例」页加载示例报告。
"""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import get_database_manager
from api.v1.endpoints.history import build_analysis_report_from_detail_dict
from api.v1.schemas.common import ErrorResponse
from api.v1.schemas.history import AnalysisReport, PublicDemoAnalysisSamplesResponse
from src.services.history_service import HistoryService
from src.storage import DatabaseManager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/demo-analysis-samples",
    response_model=PublicDemoAnalysisSamplesResponse,
    responses={
        200: {"description": "示例分析报告列表（可为空）"},
        500: {"description": "服务器错误", "model": ErrorResponse},
    },
    summary="公开示例分析报告",
    description=(
        "返回若干条已落库的个股分析报告，用于营销页展示；"
        "在「每只股票取最近一条分析」的候选集中按时间取近端股票，再随机抽取指定条数。"
        "不依赖登录；库中无分析记录时返回空列表。"
    ),
)
def get_public_demo_analysis_samples(
    limit: int = Query(3, ge=1, le=10, description="返回条数（默认 3）"),
    pool_size: int = Query(
        48,
        ge=3,
        le=500,
        description="随机抽样候选池大小：先取每股票最新一条中时间最近的 pool_size 只，再抽 limit 条",
    ),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> PublicDemoAnalysisSamplesResponse:
    try:
        ids = db_manager.list_public_demo_analysis_record_ids(
            limit=limit,
            pool_size=pool_size,
        )
        if not ids:
            return PublicDemoAnalysisSamplesResponse(items=[])

        service = HistoryService(db_manager)
        items: List[AnalysisReport] = []
        for rid in ids:
            detail = service.resolve_and_get_detail(str(rid))
            if detail is None:
                continue
            try:
                items.append(build_analysis_report_from_detail_dict(detail, db_manager))
            except Exception as ex:
                logger.warning("公开示例跳过 record_id=%s: %s", rid, ex)
                continue

        return PublicDemoAnalysisSamplesResponse(items=items)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("公开示例报告查询失败: %s", e, exc_info=True)

        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_error",
                "message": f"公开示例报告查询失败: {e!s}",
            },
        ) from e
