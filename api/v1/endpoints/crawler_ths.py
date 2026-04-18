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
