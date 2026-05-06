# -*- coding: utf-8 -*-
"""管理端查看用户反馈列表（需管理员会话；见 ``require_admin_session``）。"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import get_database_manager, require_admin_session
from api.v1.schemas.common import ErrorResponse
from api.v1.schemas.user_feedback import UserFeedbackItem, UserFeedbackListResponse
from src.storage import DatabaseManager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/user-feedback",
    response_model=UserFeedbackListResponse,
    responses={
        200: {"description": "反馈列表"},
        403: {"description": "需要管理员登录", "model": ErrorResponse},
        500: {"description": "服务器错误", "model": ErrorResponse},
    },
    summary="分页列出用户反馈",
)
def list_user_feedback(
    page: int = Query(1, ge=1, description="页码（从 1 开始）"),
    limit: int = Query(50, ge=1, le=200, description="每页条数"),
    _: None = Depends(require_admin_session),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> UserFeedbackListResponse:
    try:
        offset = (page - 1) * limit
        rows, total = db_manager.list_user_feedback_paginated(offset=offset, limit=limit)
        items = [
            UserFeedbackItem(
                id=r.id,
                message=r.message or "",
                contact=r.contact,
                portal_user_id=r.portal_user_id,
                page_url=r.page_url,
                user_agent=r.user_agent,
                created_at=r.created_at.isoformat() if r.created_at else "",
            )
            for r in rows
        ]
        return UserFeedbackListResponse(total=total, page=page, limit=limit, items=items)
    except Exception as e:
        logger.error("list_user_feedback failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": "查询反馈列表失败"},
        ) from e
