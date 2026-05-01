# -*- coding: utf-8 -*-
"""C /user 邮箱注册与登录（独立于管理员认证）."""

from __future__ import annotations

import logging
import os
import re

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.deps import get_db
from src.auth import check_rate_limit, clear_rate_limit, get_client_ip, record_login_failure
from src.repositories.portal_users_repo import (
    create_portal_user,
    get_portal_user_by_email,
    normalize_email,
)
from src.portal_auth import (
    PORTAL_COOKIE_NAME,
    create_portal_session_token,
    hash_plain_password,
    portal_session_ttl_hours,
    verify_portal_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/portal", tags=["PortalAuth"])

_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _validate_email_format(email: str) -> bool:
    normalized = normalize_email(email)
    if len(normalized) > 254:
        return False
    return bool(_EMAIL_PATTERN.match(normalized))


def _normalize_portal_username(raw: str) -> tuple[str | None, str | None]:
    """Return (username, error_message)."""
    s = (raw or "").strip()
    if len(s) < 2:
        return None, "用户名至少 2 个字符"
    if len(s) > 128:
        return None, "用户名过长"
    if any(c in s for c in "\r\n\t\0"):
        return None, "用户名含有非法空白或控制字符"
    return s, None


def _portal_cookie_params(request: Request) -> dict:
    secure = False
    if os.getenv("TRUST_X_FORWARDED_FOR", "false").lower() == "true":
        proto = request.headers.get("X-Forwarded-Proto", "").lower()
        secure = proto == "https"
    else:
        secure = request.url.scheme == "https"
    ttl_h = portal_session_ttl_hours()
    max_age = int(ttl_h * 3600) if ttl_h > 0 else None
    return {
        "httponly": True,
        "samesite": "lax",
        "secure": secure,
        "path": "/",
        "max_age": max_age,
    }


def _set_portal_cookie(response: Response, token: str, request: Request) -> None:
    params = _portal_cookie_params(request)
    kw = dict(
        key=PORTAL_COOKIE_NAME,
        value=token,
        httponly=params["httponly"],
        samesite=params["samesite"],
        secure=params["secure"],
        path=params["path"],
    )
    if params["max_age"] is not None:
        kw["max_age"] = params["max_age"]
    response.set_cookie(**kw)


class PortalRegisterRequest(BaseModel):
    model_config = {"populate_by_name": True}

    username: str = Field(default="", description="必填显示名（2～128 字符，trim 后校验）")
    email: str = Field(default="", description="Login email")
    password: str = Field(default="", description="Password")
    password_confirm: str = Field(default="", alias="passwordConfirm", description="Confirmation")


class PortalLoginRequest(BaseModel):
    model_config = {"populate_by_name": True}

    email: str = Field(default="", description="Login email")
    password: str = Field(default="", description="Password")


@router.post(
    "/register",
    summary="Register portal user",
    description="Create email/password account for /user SPA and issue session cookie.",
)
async def portal_register(request: Request, body: PortalRegisterRequest, db: Session = Depends(get_db)):
    uname, uname_err = _normalize_portal_username(body.username)
    if uname_err or not uname:
        return JSONResponse(
            status_code=400,
            content={"error": "invalid_username", "message": uname_err or "用户名无效"},
        )

    email = normalize_email(body.email)
    pw = body.password or ""
    confirm = body.password_confirm or ""

    if not _validate_email_format(email):
        return JSONResponse(status_code=400, content={"error": "invalid_email", "message": "邮箱格式无效"})
    if pw != confirm:
        return JSONResponse(status_code=400, content={"error": "password_mismatch", "message": "两次密码不一致"})

    err, cred_line = hash_plain_password(pw)
    if err or not cred_line:
        return JSONResponse(status_code=400, content={"error": "weak_password", "message": err or "密码不符合要求"})

    ip = get_client_ip(request)
    if not check_rate_limit(ip):
        return JSONResponse(
            status_code=429,
            content={"error": "rate_limited", "message": "尝试过于频繁，请稍后再试"},
        )

    try:
        row = create_portal_user(db, email, cred_line, uname)
    except IntegrityError:
        db.rollback()
        record_login_failure(ip)
        return JSONResponse(status_code=409, content={"error": "email_exists", "message": "该邮箱已注册"})
    except Exception:
        logger.exception("portal register failed")
        record_login_failure(ip)
        return JSONResponse(status_code=500, content={"error": "internal_error", "message": "注册失败"})

    clear_rate_limit(ip)
    token = create_portal_session_token(row.id)
    if not token:
        return JSONResponse(status_code=500, content={"error": "internal_error", "message": "会话签发失败"})
    resp = JSONResponse(
        content={"ok": True, "userEmail": row.email, "userName": (row.username or "").strip()},
    )
    _set_portal_cookie(resp, token, request)
    return resp


@router.post("/login", summary="Portal login")
async def portal_login(request: Request, body: PortalLoginRequest, db: Session = Depends(get_db)):
    email = normalize_email(body.email)
    pw = body.password or ""
    if not email or not pw:
        return JSONResponse(status_code=400, content={"error": "invalid_request", "message": "请输入邮箱与密码"})

    ip = get_client_ip(request)
    if not check_rate_limit(ip):
        return JSONResponse(
            status_code=429,
            content={"error": "rate_limited", "message": "尝试过于频繁，请稍后再试"},
        )

    row = get_portal_user_by_email(db, email)
    if row is None or not verify_portal_password(pw, row.password_hash):
        record_login_failure(ip)
        return JSONResponse(status_code=401, content={"error": "invalid_credentials", "message": "邮箱或密码错误"})

    clear_rate_limit(ip)
    token = create_portal_session_token(row.id)
    if not token:
        return JSONResponse(status_code=500, content={"error": "internal_error", "message": "会话签发失败"})
    resp = JSONResponse(
        content={"ok": True, "userEmail": row.email, "userName": (row.username or "").strip()},
    )
    _set_portal_cookie(resp, token, request)
    return resp


@router.post("/logout", summary="Portal logout")
async def portal_logout(_request: Request):
    """清除门户会话 cookie；不因功能开关拒绝（便于前端统一调用）。"""
    resp = Response(status_code=204)
    resp.delete_cookie(key=PORTAL_COOKIE_NAME, path="/")
    return resp
