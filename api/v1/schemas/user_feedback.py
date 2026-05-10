# -*- coding: utf-8 -*-
"""用户反馈 API 模型。"""

from typing import List, Optional

from pydantic import BaseModel, Field


class UserFeedbackSubmitRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000, description="反馈正文")
    contact: Optional[str] = Field(None, max_length=256, description="选填：联系方式或邮箱")
    page_url: Optional[str] = Field(
        None,
        max_length=512,
        description="选填：提交时页面 URL（前端可自动带上）",
    )


class UserFeedbackItem(BaseModel):
    id: int
    message: str
    contact: Optional[str] = None
    portal_user_id: Optional[int] = None
    portal_email: Optional[str] = Field(None, description="门户账号邮箱（提交时已登录门户时有值）")
    page_url: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: str


class UserFeedbackListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[UserFeedbackItem]


class UserFeedbackSubmitResponse(BaseModel):
    id: int
    ok: bool = True
