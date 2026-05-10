# -*- coding: utf-8 -*-
"""门户登录用户的账户资料、通知偏好、密码与用量（C 端站点根路径 /account）。"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.deps import get_db, require_portal_user_id
from src.portal_auth import hash_plain_password, verify_portal_password
from src.portal_plans import limits_for_tier, normalize_plan_tier, validate_plan_upgrade_target
from src.portal_usage import count_portal_analysis_month
from src.repositories.portal_users_repo import (
    get_portal_user_by_id,
    insert_portal_plan_upgrade_request,
    update_portal_notification_prefs,
    update_portal_password_hash,
    update_portal_usage_stats,
    update_portal_user_profile_fields,
)
from src.storage import PortalUser

logger = logging.getLogger(__name__)

router = APIRouter(tags=["PortalAccount"])


def _current_calendar_month_key() -> str:
    now = datetime.now()
    return f"{now.year:04d}-{now.month:02d}"


def _default_notification_prefs() -> Dict[str, Any]:
    return {
        "emailEnabled": True,
        "dingtalkWebhook": "",
        "feishuWebhook": "",
        "dailyDigest": False,
        "analysisPush": True,
    }


def _parse_notification_prefs(raw: Optional[str]) -> Dict[str, Any]:
    base = _default_notification_prefs()
    if not raw or not str(raw).strip():
        return dict(base)
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return dict(base)
        out = dict(base)
        for k in base:
            if k in data:
                if k.endswith("Webhook"):
                    out[k] = str(data[k] or "").strip()[:2048]
                elif isinstance(base[k], bool):
                    out[k] = bool(data[k])
                else:
                    out[k] = data[k]
        return out
    except Exception:
        return dict(base)


def _parse_usage_stats(raw: Optional[str]) -> Dict[str, Any]:
    month = _current_calendar_month_key()
    base = {"month": month, "stockSearchCount": 0}
    if not raw or not str(raw).strip():
        return dict(base)
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return dict(base)
        out = dict(base)
        if data.get("month") == month:
            try:
                out["stockSearchCount"] = max(0, int(data.get("stockSearchCount") or 0))
            except (TypeError, ValueError):
                out["stockSearchCount"] = 0
        return out
    except Exception:
        return dict(base)


def _normalize_username(raw: str) -> tuple[Optional[str], Optional[str]]:
    s = (raw or "").strip()
    if len(s) < 2:
        return None, "用户名至少 2 个字符"
    if len(s) > 128:
        return None, "用户名过长"
    if any(c in s for c in "\r\n\t\0"):
        return None, "用户名含有非法空白或控制字符"
    return s, None


def _portal_row(session: Session, uid: int) -> Optional[PortalUser]:
    return get_portal_user_by_id(session, uid)


def _account_payload(session: Session, row: PortalUser) -> Dict[str, Any]:
    tier = normalize_plan_tier(getattr(row, "plan_tier", None))
    limits = limits_for_tier(tier)
    prefs = _parse_notification_prefs(getattr(row, "notification_prefs_json", None))
    usage = _parse_usage_stats(getattr(row, "usage_stats_json", None))
    analysis_used = count_portal_analysis_month(session, row.id)
    month_key = _current_calendar_month_key()
    return {
        "email": row.email,
        "username": (row.username or "").strip(),
        "avatarUrl": getattr(row, "avatar_url", None),
        "notificationPrefs": prefs,
        "planTier": tier,
        "planLabel": limits.get("label", "免费"),
        "limits": {
            "aiAnalysisMonth": limits.get("ai_analysis_month"),
            "watchlistMax": limits.get("watchlist_max"),
            "stockSearchMonth": limits.get("stock_search_month"),
        },
        "usage": {
            "calendarMonth": month_key,
            "analysisCountMonth": analysis_used,
            "stockSearchCountMonth": int(usage.get("stockSearchCount") or 0),
        },
    }


class PortalNotificationPrefsPatch(BaseModel):
    model_config = {"populate_by_name": True}

    email_enabled: Optional[bool] = Field(None, alias="emailEnabled")
    dingtalk_webhook: Optional[str] = Field(None, alias="dingtalkWebhook")
    feishu_webhook: Optional[str] = Field(None, alias="feishuWebhook")
    daily_digest: Optional[bool] = Field(None, alias="dailyDigest")
    analysis_push: Optional[bool] = Field(None, alias="analysisPush")


class PortalAccountPatchRequest(BaseModel):
    model_config = {"populate_by_name": True}

    username: Optional[str] = None
    avatar_url: Optional[str] = Field(None, alias="avatarUrl")
    notification_prefs: Optional[PortalNotificationPrefsPatch] = Field(None, alias="notificationPrefs")


class PortalPasswordChangeRequest(BaseModel):
    model_config = {"populate_by_name": True}

    current_password: str = Field(..., alias="currentPassword")
    new_password: str = Field(..., alias="newPassword")
    new_password_confirm: str = Field(..., alias="newPasswordConfirm")


class PortalPlanUpgradeRequestBody(BaseModel):
    """提交套餐升级意向（无支付链路，仅记录订单待客服跟进）。"""

    model_config = {"populate_by_name": True}

    target_tier: str = Field(..., alias="targetTier", description="目标档位，如 p19 / p49 / p99")
    note: Optional[str] = Field(None, description="用户备注，选填")


@router.get("/account", summary="门户账户聚合信息")
async def get_portal_account(
    request: Request,
    db: Session = Depends(get_db),
    uid: int = Depends(require_portal_user_id),
):
    row = _portal_row(db, uid)
    if not row:
        return JSONResponse(status_code=404, content={"error": "not_found", "message": "用户不存在"})
    return _account_payload(db, row)


@router.patch("/account", summary="更新门户资料或通知偏好")
async def patch_portal_account(
    request: Request,
    body: PortalAccountPatchRequest,
    db: Session = Depends(get_db),
    uid: int = Depends(require_portal_user_id),
):
    row = _portal_row(db, uid)
    if not row:
        return JSONResponse(status_code=404, content={"error": "not_found", "message": "用户不存在"})

    if body.username is not None:
        uname, err = _normalize_username(body.username)
        if err or not uname:
            return JSONResponse(status_code=400, content={"error": "invalid_username", "message": err or "用户名无效"})
        update_portal_user_profile_fields(db, uid, username=uname)

    if body.avatar_url is not None:
        av = (body.avatar_url or "").strip()
        if len(av) > 512:
            return JSONResponse(status_code=400, content={"error": "invalid_avatar", "message": "头像链接过长"})
        if av and not re.match(r"^https?://", av):
            return JSONResponse(
                status_code=400,
                content={"error": "invalid_avatar", "message": "头像请使用以 http(s):// 开头的链接"},
            )
        update_portal_user_profile_fields(db, uid, avatar_url=av)

    if body.notification_prefs is not None:
        fresh = _portal_row(db, uid) or row
        merged = _parse_notification_prefs(getattr(fresh, "notification_prefs_json", None))
        patch_raw = body.notification_prefs.model_dump(by_alias=True, exclude_none=True)
        for key, val in patch_raw.items():
            if key not in merged:
                continue
            if key.endswith("Webhook"):
                merged[key] = str(val or "").strip()[:2048]
            elif isinstance(merged.get(key), bool):
                merged[key] = bool(val)
            else:
                merged[key] = val
        update_portal_notification_prefs(db, uid, json.dumps(merged, ensure_ascii=False))

    row = _portal_row(db, uid)
    if not row:
        return JSONResponse(status_code=500, content={"error": "internal_error", "message": "刷新用户失败"})
    return _account_payload(db, row)


@router.post("/account/password", summary="修改门户登录密码")
async def portal_change_password(
    body: PortalPasswordChangeRequest,
    db: Session = Depends(get_db),
    uid: int = Depends(require_portal_user_id),
):
    row = _portal_row(db, uid)
    if not row:
        return JSONResponse(status_code=404, content={"error": "not_found", "message": "用户不存在"})
    cur = (body.current_password or "").strip()
    new_pwd = (body.new_password or "").strip()
    new_confirm = (body.new_password_confirm or "").strip()
    if not cur:
        return JSONResponse(status_code=400, content={"error": "current_required", "message": "请输入当前密码"})
    if len(new_pwd) < 8:
        return JSONResponse(status_code=400, content={"error": "weak_password", "message": "新密码至少 8 位"})
    if new_pwd != new_confirm:
        return JSONResponse(status_code=400, content={"error": "password_mismatch", "message": "两次输入的新密码不一致"})
    if not verify_portal_password(cur, row.password_hash):
        return JSONResponse(status_code=401, content={"error": "invalid_password", "message": "当前密码错误"})
    err, line = hash_plain_password(new_pwd)
    if err or not line:
        return JSONResponse(
            status_code=400,
            content={"error": "weak_password", "message": err or "新密码不符合要求"},
        )
    update_portal_password_hash(db, uid, line)
    return Response(status_code=204)


@router.post("/account/plan-upgrade", summary="提交套餐升级意向订单（无在线支付，客服跟进）")
async def portal_submit_plan_upgrade(
    body: PortalPlanUpgradeRequestBody,
    db: Session = Depends(get_db),
    uid: int = Depends(require_portal_user_id),
):
    row = _portal_row(db, uid)
    if not row:
        return JSONResponse(status_code=404, content={"error": "not_found", "message": "用户不存在"})
    ok, err_msg = validate_plan_upgrade_target(getattr(row, "plan_tier", None), body.target_tier)
    if not ok:
        return JSONResponse(status_code=400, content={"error": "invalid_upgrade", "message": err_msg})
    from_tier = normalize_plan_tier(getattr(row, "plan_tier", None))
    target_tier = normalize_plan_tier(body.target_tier)
    note_raw = (body.note or "").strip()
    note = note_raw[:2048] if note_raw else None
    order_id = insert_portal_plan_upgrade_request(
        db,
        portal_user_id=uid,
        from_tier=from_tier,
        target_tier=target_tier,
        note=note,
    )
    return {
        "orderId": order_id,
        "message": "订单已提交。暂未开通在线支付，将由客服人员与您联系确认开通事宜。",
    }


@router.post("/account/usage/stock-search", summary="记录一次个股搜索/选中（当月计数）")
async def portal_usage_stock_search(
    db: Session = Depends(get_db),
    uid: int = Depends(require_portal_user_id),
):
    row = _portal_row(db, uid)
    if not row:
        return JSONResponse(status_code=404, content={"error": "not_found", "message": "用户不存在"})
    usage = _parse_usage_stats(getattr(row, "usage_stats_json", None))
    month = _current_calendar_month_key()
    if usage.get("month") != month:
        usage = {"month": month, "stockSearchCount": 0}
    usage["stockSearchCount"] = int(usage.get("stockSearchCount") or 0) + 1
    usage["month"] = month
    update_portal_usage_stats(db, uid, json.dumps(usage, ensure_ascii=False))
    limits = limits_for_tier(normalize_plan_tier(getattr(row, "plan_tier", None)))
    cap = int(limits.get("stock_search_month") or 0)
    used = int(usage["stockSearchCount"])
    return {
        "calendarMonth": month,
        "stockSearchCountMonth": used,
        "stockSearchMonthLimit": cap,
        "overLimit": cap > 0 and used > cap,
    }
