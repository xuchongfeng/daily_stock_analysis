# -*- coding: utf-8 -*-
"""公开用户反馈提交（无需管理员或门户会话；可选门户 Cookie 记录 portal_user_id）。"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from api.deps import get_database_manager, optional_portal_user_id
from api.v1.schemas.common import ErrorResponse
from api.v1.schemas.user_feedback import UserFeedbackSubmitRequest, UserFeedbackSubmitResponse
from src.storage import DatabaseManager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/feedback",
    response_model=UserFeedbackSubmitResponse,
    responses={
        200: {"description": "已保存"},
        400: {"description": "参数错误", "model": ErrorResponse},
        500: {"description": "服务器错误", "model": ErrorResponse},
    },
    summary="提交用户反馈",
    description="写入 ``user_feedback`` 表；开启管理员 API 门禁时本路径仍豁免，便于未登录用户反馈。",
)
def submit_user_feedback(
    request: Request,
    body: UserFeedbackSubmitRequest,
    portal_uid: Optional[int] = Depends(optional_portal_user_id),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> UserFeedbackSubmitResponse:
    try:
        ua = request.headers.get("user-agent") or ""
        rid = db_manager.insert_user_feedback(
            body.message,
            contact=body.contact,
            portal_user_id=portal_uid,
            page_url=body.page_url,
            user_agent=ua,
        )
        return UserFeedbackSubmitResponse(id=rid, ok=True)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_request", "message": str(e)},
        ) from e
    except Exception as e:
        logger.error("submit_user_feedback failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": "保存反馈失败"},
        ) from e
