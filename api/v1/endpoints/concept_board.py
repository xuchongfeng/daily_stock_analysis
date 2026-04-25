# -*- coding: utf-8 -*-
"""概念板块查询 API。"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import get_database_manager
from api.v1.schemas.concept_board import (
    ConceptBoardItem,
    ConceptBoardListResponse,
    ConceptBoardStocksResponse,
)
from src.storage import DatabaseManager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "",
    response_model=ConceptBoardListResponse,
    summary="概念板块列表",
)
def list_concept_boards(
    limit: int = Query(200, ge=1, le=1000),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> ConceptBoardListResponse:
    try:
        rows = db_manager.list_concept_boards(limit=limit)
        return ConceptBoardListResponse(items=[ConceptBoardItem(**x) for x in rows])
    except Exception as exc:
        logger.exception("list_concept_boards failed: %s", exc)
        raise HTTPException(status_code=500, detail="查询概念板块失败") from exc


@router.get(
    "/{board_code}/stocks",
    response_model=ConceptBoardStocksResponse,
    summary="概念板块下股票（含最近评分）",
)
def list_concept_board_stocks(
    board_code: str,
    limit: int = Query(300, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> ConceptBoardStocksResponse:
    try:
        out = db_manager.get_concept_board_stocks_with_latest_score(
            board_code=board_code,
            limit=limit,
            offset=offset,
        )
        if out.get("board") is None:
            raise HTTPException(status_code=404, detail="concept_board_not_found")
        return ConceptBoardStocksResponse(
            board=out["board"],
            total=int(out.get("total") or 0),
            limit=limit,
            offset=offset,
            items=out.get("items") or [],
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("list_concept_board_stocks failed: %s", exc)
        raise HTTPException(status_code=500, detail="查询概念板块股票失败") from exc
