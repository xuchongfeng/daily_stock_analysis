# -*- coding: utf-8 -*-
"""C 端「热点事件」只读 API（数据由策展脚本写入）。"""

import logging
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import get_database_manager
from api.v1.schemas.discover_hot_event import (
    HotEventDetail,
    HotEventListResponse,
    HotEventSummary,
)
from src.storage import DatabaseManager

logger = logging.getLogger(__name__)

router = APIRouter()

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


@router.get(
    "",
    response_model=HotEventListResponse,
    summary="热点事件列表",
)
def list_hot_events(
    market: Optional[str] = Query(None, description="cn / hk / us / all（省略不过滤）"),
    status: Optional[str] = Query(
        None,
        description="active / cooling / archived / all；省略则排除 archived",
    ),
    limit: int = Query(50, ge=1, le=100),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> HotEventListResponse:
    try:
        statuses: Optional[List[str]]
        if status is None or str(status).strip() == "":
            statuses = ["active", "cooling"]
        elif str(status).strip().lower() == "all":
            statuses = None
        else:
            statuses = [str(status).strip().lower()]
        mk = str(market).strip().lower() if market is not None else None
        if mk in ("", "all"):
            mk = None
        rows = db_manager.list_discover_hot_events(
            market=mk,
            statuses=statuses,
            limit=limit,
        )
        return HotEventListResponse(
            items=[HotEventSummary(**x) for x in rows],
        )
    except Exception as exc:
        logger.exception("list_hot_events failed: %s", exc)
        raise HTTPException(status_code=500, detail="查询热点事件失败") from exc


@router.get(
    "/{slug}",
    response_model=HotEventDetail,
    summary="热点事件详情",
)
def get_hot_event_detail(
    slug: str,
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> HotEventDetail:
    key = str(slug or "").strip().lower()
    if not key or not _SLUG_RE.match(key):
        raise HTTPException(status_code=404, detail="hot_event_not_found")
    try:
        row = db_manager.get_discover_hot_event_detail(key)
        if row is None:
            raise HTTPException(status_code=404, detail="hot_event_not_found")
        return HotEventDetail(**row)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("get_hot_event_detail failed: %s", exc)
        raise HTTPException(status_code=500, detail="查询热点事件详情失败") from exc
