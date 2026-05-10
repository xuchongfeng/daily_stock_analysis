# -*- coding: utf-8 -*-
"""门户用量统计（与账户页展示、分析接口配额拦截共用同一口径）。"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.portal_plans import limits_for_tier, normalize_plan_tier
from src.repositories.portal_users_repo import get_portal_user_by_id
from src.services.task_queue import get_task_queue
from src.storage import AnalysisHistory


def month_bounds_local():
    """当前自然月的 [start, end)（本地时间），与账户页用量口径一致。"""
    now = datetime.now()
    start = datetime(now.year, now.month, 1)
    if now.month == 12:
        end = datetime(now.year + 1, 1, 1)
    else:
        end = datetime(now.year, now.month + 1, 1)
    return start, end


def count_portal_analysis_month(session: Session, portal_user_id: int) -> int:
    """本月已写入 ``analysis_history`` 且归属该门户用户的分析条数。"""
    start, end = month_bounds_local()
    q = (
        select(func.count())
        .select_from(AnalysisHistory)
        .where(
            AnalysisHistory.portal_user_id == portal_user_id,
            AnalysisHistory.created_at >= start,
            AnalysisHistory.created_at < end,
        )
    )
    return int(session.scalar(q) or 0)


def ensure_portal_monthly_ai_quota_or_raise(
    session: Session,
    portal_user_id: Optional[int],
    stock_codes: List[str],
) -> None:
    """
    门户用户触发分析前校验「当月 AI 分析次数」套餐上限。

    - 无门户会话（管理员/访客）：不限制。
    - ``ai_analysis_month <= 0``：视为不限（预留）。
    """
    if portal_user_id is None:
        return
    row = get_portal_user_by_id(session, portal_user_id)
    if row is None:
        return
    limits = limits_for_tier(normalize_plan_tier(getattr(row, "plan_tier", None)))
    cap = int(limits.get("ai_analysis_month") or 0)
    if cap <= 0:
        return
    used = count_portal_analysis_month(session, portal_user_id)
    new_slots = get_task_queue().count_distinct_new_queue_slots(stock_codes)
    if new_slots <= 0:
        return
    remaining = cap - used
    if new_slots <= remaining:
        return
    raise HTTPException(
        status_code=403,
        detail={
            "error": "portal_ai_quota_exceeded",
            "message": (
                f"本月 AI 分析额度不足（已用 {used}/{cap} 次，本次需提交 {new_slots} 次）。"
                "请下月重置后再试，或在门户账户升级套餐。"
            ),
            "used": used,
            "cap": cap,
            "requested": new_slots,
            "remaining": max(0, remaining),
        },
    )
