# -*- coding: utf-8 -*-
"""Read API for persisted Tonghuashun (ths-concept) crawl rows (SQLite)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import get_database_manager
from api.v1.schemas.common import ErrorResponse
from api.v1.schemas.crawler_ths import (
    ThsConceptItem,
    ThsConceptListResponse,
    ThsConceptRunItem,
    ThsConceptRunListResponse,
    ThsConstituentItem,
    ThsConstituentListResponse,
    ThsVolumeBatchSectorStatItem,
    ThsVolumeBatchSectorStatsResponse,
)
from src.storage import DatabaseManager

logger = logging.getLogger(__name__)

router = APIRouter()


def _page_limit_offset(page: int, limit: int) -> tuple[int, int]:
    p = max(1, page)
    lim = max(1, limit)
    return p, (p - 1) * lim


@router.get(
    "/runs",
    response_model=ThsConceptRunListResponse,
    responses={500: {"description": "服务器错误", "model": ErrorResponse}},
    summary="列出同花顺概念爬虫运行记录",
)
def list_ths_concept_runs(
    page: int = Query(1, ge=1, description="页码（从 1 起）"),
    limit: int = Query(30, ge=1, le=200, description="每页条数"),
    db: DatabaseManager = Depends(get_database_manager),
) -> ThsConceptRunListResponse:
    try:
        p, off = _page_limit_offset(page, limit)
        rows, total = db.list_ths_concept_runs(limit=limit, offset=off)
        items = [ThsConceptRunItem(**r) for r in rows]
        return ThsConceptRunListResponse(items=items, total=total, page=p, limit=limit)
    except Exception as exc:
        logger.exception("list_ths_concept_runs failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get(
    "/runs/{run_id}/concepts",
    response_model=ThsConceptListResponse,
    responses={
        404: {"description": "运行不存在", "model": ErrorResponse},
        500: {"description": "服务器错误", "model": ErrorResponse},
    },
    summary="列出某次运行下的概念（板块）",
)
def list_ths_concepts(
    run_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    q: str | None = Query(None, description="按概念代码或名称模糊筛选"),
    db: DatabaseManager = Depends(get_database_manager),
) -> ThsConceptListResponse:
    rid = (run_id or "").strip()
    if not db.ths_concept_run_exists(rid):
        raise HTTPException(status_code=404, detail="run_not_found")
    try:
        p, off = _page_limit_offset(page, limit)
        rows, total = db.list_ths_concepts_for_run(rid, limit=limit, offset=off, q=q)
        items = [ThsConceptItem(**r) for r in rows]
        return ThsConceptListResponse(items=items, total=total, page=p, limit=limit, run_id=rid)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("list_ths_concepts failed run_id=%s", rid)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get(
    "/runs/{run_id}/constituents",
    response_model=ThsConstituentListResponse,
    responses={
        404: {"description": "运行不存在", "model": ErrorResponse},
        500: {"description": "服务器错误", "model": ErrorResponse},
    },
    summary="列出某次运行下的成分股（可按概念筛选）",
)
def list_ths_constituents(
    run_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(200, ge=1, le=1000),
    concept_code: str | None = Query(None, description="仅查看指定概念代码下的成分"),
    db: DatabaseManager = Depends(get_database_manager),
) -> ThsConstituentListResponse:
    rid = (run_id or "").strip()
    if not db.ths_concept_run_exists(rid):
        raise HTTPException(status_code=404, detail="run_not_found")
    try:
        p, off = _page_limit_offset(page, limit)
        cc = (concept_code or "").strip() or None
        rows, total = db.list_ths_constituents_for_run(rid, concept_code=cc, limit=limit, offset=off)
        items = [ThsConstituentItem(**r) for r in rows]
        return ThsConstituentListResponse(
            items=items,
            total=total,
            page=p,
            limit=limit,
            run_id=rid,
            concept_code=cc,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("list_ths_constituents failed run_id=%s", rid)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get(
    "/runs/{run_id}/volume-batch-sector-stats",
    response_model=ThsVolumeBatchSectorStatsResponse,
    responses={
        400: {"description": "参数错误", "model": ErrorResponse},
        404: {"description": "运行不存在", "model": ErrorResponse},
        500: {"description": "服务器错误", "model": ErrorResponse},
    },
    summary="同花顺板块 × 成交量榜批次：板块维度表现汇总",
)
def ths_volume_batch_sector_stats(
    run_id: str,
    batch_run_id: str = Query(..., description="成交量榜批次号 tv_YYYYMMDD_*"),
    limit: int = Query(200, ge=1, le=500, description="返回板块条数上限（按命中数降序）"),
    db: DatabaseManager = Depends(get_database_manager),
) -> ThsVolumeBatchSectorStatsResponse:
    rid = (run_id or "").strip()
    bid = (batch_run_id or "").strip()
    if not bid:
        raise HTTPException(status_code=400, detail="batch_run_id_required")
    if not bid.lower().startswith("tv_"):
        raise HTTPException(
            status_code=400,
            detail="batch_run_id_must_be_volume_tv_prefix",
        )
    if not db.ths_concept_run_exists(rid):
        raise HTTPException(status_code=404, detail="run_not_found")
    try:
        batch_total, rows = db.aggregate_ths_sector_stats_for_volume_batch(
            rid, bid, limit=limit
        )
        items = [ThsVolumeBatchSectorStatItem(**r) for r in rows]
        return ThsVolumeBatchSectorStatsResponse(
            run_id=rid,
            batch_run_id=bid,
            batch_stock_count=batch_total,
            items=items,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("ths_volume_batch_sector_stats failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
