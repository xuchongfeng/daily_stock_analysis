# -*- coding: utf-8 -*-
"""
User watchlist API.

- 请求带有效 **门户** Cookie (`dsa_portal_session`)：读写对应 `portal_users.watchlist_json`（C 端 /user 每用户自选）。
- 否则：沿用全局 JSON 文件（`WATCHLIST_FILE` / CLI ``--my-watchlist``），供管理员工作台与单机工具。
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from api.deps import get_db
from api.v1.schemas.watchlist import WatchlistPutRequest, WatchlistResponse
from src.portal_auth import PORTAL_COOKIE_NAME, verify_portal_session_token
from src.repositories.portal_users_repo import get_portal_user_by_id
from src.services.watchlist_store import (
    build_normalized_watchlist_payload,
    load_watchlist_file,
    save_watchlist,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _portal_uid_from_cookie(request: Request) -> Optional[int]:
    pc = request.cookies.get(PORTAL_COOKIE_NAME)
    if not pc:
        return None
    uid = verify_portal_session_token(pc)
    return uid if isinstance(uid, int) else None


def _portal_watchlist_to_response(raw: Optional[str]) -> WatchlistResponse:
    if not raw or not str(raw).strip():
        return WatchlistResponse(codes=[], labels={}, updated_at=None)
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return WatchlistResponse(codes=[], labels={}, updated_at=None)
        codes = list(data.get("codes") or [])
        labels_raw = data.get("labels") or {}
        labels: dict[str, str] = {str(k): str(v) for k, v in labels_raw.items()} if isinstance(labels_raw, dict) else {}
        updated_at = data.get("updated_at")
        ua = updated_at if isinstance(updated_at, str) else None
        sc = [str(x) for x in codes]
        return WatchlistResponse(codes=sc, labels=labels, updated_at=ua)
    except json.JSONDecodeError:
        logger.warning("portal_users.watchlist_json 非法 JSON，当作空自选处理")
        return WatchlistResponse(codes=[], labels={}, updated_at=None)


@router.get("", response_model=WatchlistResponse)
def get_watchlist(request: Request, db: Session = Depends(get_db)) -> WatchlistResponse:
    uid = _portal_uid_from_cookie(request)
    if uid is not None:
        user = get_portal_user_by_id(db, uid)
        if user is None:
            return WatchlistResponse(codes=[], labels={}, updated_at=None)
        return _portal_watchlist_to_response(getattr(user, "watchlist_json", None))

    data = load_watchlist_file()
    return WatchlistResponse(
        codes=list(data.get("codes") or []),
        labels=dict(data.get("labels") or {}),
        updated_at=data.get("updated_at"),
    )


@router.put("", response_model=WatchlistResponse)
def put_watchlist(request: Request, body: WatchlistPutRequest, db: Session = Depends(get_db)) -> WatchlistResponse:
    uid = _portal_uid_from_cookie(request)
    if uid is not None:
        user = get_portal_user_by_id(db, uid)
        if user is None:
            return WatchlistResponse(codes=[], labels={}, updated_at=None)
        payload = build_normalized_watchlist_payload(body.codes, body.labels or {})
        user.watchlist_json = json.dumps(payload, ensure_ascii=False)
        db.commit()
        db.refresh(user)
        logger.info("门户自选已更新 uid=%s 共 %d 条", uid, len(payload.get("codes") or []))
        return WatchlistResponse(
            codes=list(payload.get("codes") or []),
            labels=dict(payload.get("labels") or {}),
            updated_at=payload.get("updated_at"),
        )

    saved = save_watchlist(body.codes, body.labels)
    logger.info("全局自选列表已更新，共 %d 条", len(saved.get("codes") or []))
    return WatchlistResponse(
        codes=list(saved.get("codes") or []),
        labels=dict(saved.get("labels") or {}),
        updated_at=saved.get("updated_at"),
    )
