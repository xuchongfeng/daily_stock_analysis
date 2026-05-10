# -*- coding: utf-8 -*-
"""公开分析埋点（豁免 API 门禁，便于未登录访客计入 PV/UV）。"""

from __future__ import annotations

import logging
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from api.deps import get_database_manager
from api.v1.schemas.common import ErrorResponse
from src.storage import DatabaseManager

logger = logging.getLogger(__name__)

router = APIRouter()

VISITOR_COOKIE_NAME = "dsa_visitor_id"
VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60


class PageViewReportBody(BaseModel):
    path: str = Field("", description="浏览器路径，含 query", max_length=600)
    surface: Literal["admin", "portal", "unknown"] = Field(
        "unknown",
        description="admin=管理端 SPA；portal=C 端 SPA",
    )


@router.post(
    "/analytics/page-view",
    responses={
        200: {"description": "已记录"},
        400: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
    summary="上报页面浏览（PV）",
    description=(
        "写入 ``page_view_events``；若请求无 ``dsa_visitor_id`` Cookie 则下发 HttpOnly Cookie 用于 UV 去重。"
        " 需在 Web 前端路由变化时调用（见 apps/dsa-web、apps/dsa-user）。"
    ),
)
def report_page_view(
    request: Request,
    response: Response,
    body: PageViewReportBody,
    db_manager: DatabaseManager = Depends(get_database_manager),
):
    raw_vid: Optional[str] = request.cookies.get(VISITOR_COOKIE_NAME)
    vid = (raw_vid or "").strip()
    if not vid or len(vid) > 64:
        vid = str(uuid.uuid4())
        response.set_cookie(
            key=VISITOR_COOKIE_NAME,
            value=vid,
            max_age=VISITOR_COOKIE_MAX_AGE,
            path="/",
            httponly=True,
            samesite="lax",
        )
    path = (body.path or "").strip()[:512] or "/"
    try:
        db_manager.insert_page_view(vid, path, body.surface)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as exc:
        logger.warning("insert_page_view failed: %s", exc)
        raise HTTPException(status_code=500, detail="write_failed") from exc
    return {"ok": True}
