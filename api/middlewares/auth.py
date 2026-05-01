# -*- coding: utf-8 -*-
"""
Auth middleware: protect /api/v1/* when admin auth is enabled.
"""

from __future__ import annotations

import logging
from typing import Callable

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from src.auth import COOKIE_NAME, is_auth_enabled, verify_session
from src.portal_auth import PORTAL_COOKIE_NAME, verify_portal_session_token

logger = logging.getLogger(__name__)

EXEMPT_PATHS = frozenset({
    "/api/v1/auth/login",
    "/api/v1/auth/status",
    "/api/v1/auth/portal/register",
    "/api/v1/auth/portal/login",
    "/api/v1/auth/portal/logout",
    "/api/health",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
})


def _path_exempt(path: str) -> bool:
    """Check if path is exempt from auth."""
    normalized = path.rstrip("/") or "/"
    return normalized in EXEMPT_PATHS


class AuthMiddleware(BaseHTTPMiddleware):
    """仅在 ADMIN_AUTH_ENABLED 时对 /api/v1/* 要求会话；认可管理员 Cookie 或 C 端邮箱门户 Cookie。"""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ):
        if not is_auth_enabled():
            return await call_next(request)

        path = request.url.path
        if _path_exempt(path):
            return await call_next(request)

        if not path.startswith("/api/v1/"):
            return await call_next(request)

        ac = request.cookies.get(COOKIE_NAME)
        ok_admin = bool(ac and verify_session(ac))

        pc = request.cookies.get(PORTAL_COOKIE_NAME)
        ok_portal = bool(pc and verify_portal_session_token(pc) is not None)

        combined = ok_admin or ok_portal

        if not combined:
            return JSONResponse(
                status_code=401,
                content={
                    "error": "unauthorized",
                    "message": "Login required",
                },
            )

        return await call_next(request)


def add_auth_middleware(app):
    """Add auth middleware to protect API routes.

    Portal (C /user) cookies never open API protection by themselves:
    ADMIN_AUTH_ENABLED gates /api/v1/*; portal or admin cookie may satisfy it.
    """
    app.add_middleware(AuthMiddleware)
