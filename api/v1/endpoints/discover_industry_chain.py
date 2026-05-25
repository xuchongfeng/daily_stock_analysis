# -*- coding: utf-8 -*-
"""C 端「核心产业链」API（读开放；写需管理员会话）。"""

import logging
import re
import secrets
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import get_database_manager, require_admin_session
from api.v1.schemas.discover_industry_chain import (
    IndustryChainDeleteResponse,
    IndustryChainDetail,
    IndustryChainListResponse,
    IndustryChainSummary,
    IndustryChainUpsertRequest,
    IndustryChainWriteResponse,
)
from src.storage import DatabaseManager

logger = logging.getLogger(__name__)

router = APIRouter()

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _normalize_slug(name: str, explicit: Optional[str] = None) -> str:
    if explicit:
        s = str(explicit).strip().lower()
        if s and _SLUG_RE.match(s):
            return s[:64]
    base = re.sub(r"[^a-z0-9]+", "-", (name or "").strip().lower()).strip("-")
    if not base or not _SLUG_RE.match(base):
        base = f"chain-{secrets.token_hex(4)}"
    return base[:64]


def _unique_slug(db_manager: DatabaseManager, base_slug: str) -> str:
    candidate = base_slug[:64]
    suffix = 2
    while db_manager.get_discover_industry_chain_detail(candidate) is not None:
        tail = f"-{suffix}"
        candidate = f"{base_slug[: max(1, 64 - len(tail))]}{tail}"
        suffix += 1
    return candidate


def _stocks_payload(items: List) -> List[dict]:
    out: List[dict] = []
    for idx, item in enumerate(items or []):
        code = str(getattr(item, "stock_code", "") or "").strip()
        if not code:
            continue
        name = getattr(item, "stock_name", None)
        role = getattr(item, "role", None)
        sort_order = getattr(item, "sort_order", idx)
        out.append(
            {
                "stock_code": code,
                "stock_name": str(name).strip() if name else None,
                "role": str(role).strip() if role else None,
                "sort_order": int(sort_order),
            }
        )
    return out


@router.get(
    "",
    response_model=IndustryChainListResponse,
    summary="核心产业链列表",
)
def list_industry_chains(
    market: Optional[str] = Query(None, description="cn / hk / us / all（省略不过滤）"),
    status: Optional[str] = Query(
        None,
        description="active / archived / all；省略则仅 active",
    ),
    limit: int = Query(100, ge=1, le=200),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> IndustryChainListResponse:
    try:
        statuses: Optional[List[str]]
        if status is None or str(status).strip() == "":
            statuses = ["active"]
        elif str(status).strip().lower() == "all":
            statuses = None
        else:
            statuses = [str(status).strip().lower()]
        mk = str(market).strip().lower() if market is not None else None
        if mk in ("", "all"):
            mk = None
        rows = db_manager.list_discover_industry_chains(
            market=mk,
            statuses=statuses,
            limit=limit,
        )
        return IndustryChainListResponse(items=[IndustryChainSummary(**x) for x in rows])
    except Exception as exc:
        logger.exception("list_industry_chains failed: %s", exc)
        raise HTTPException(status_code=500, detail="查询核心产业链失败") from exc


@router.get(
    "/{slug}",
    response_model=IndustryChainDetail,
    summary="核心产业链详情",
)
def get_industry_chain_detail(
    slug: str,
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> IndustryChainDetail:
    key = str(slug or "").strip().lower()
    if not key or not _SLUG_RE.match(key):
        raise HTTPException(status_code=404, detail="industry_chain_not_found")
    try:
        row = db_manager.get_discover_industry_chain_detail(key)
        if row is None:
            raise HTTPException(status_code=404, detail="industry_chain_not_found")
        return IndustryChainDetail(**row)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("get_industry_chain_detail failed: %s", exc)
        raise HTTPException(status_code=500, detail="查询核心产业链详情失败") from exc


@router.post(
    "",
    response_model=IndustryChainWriteResponse,
    summary="新增核心产业链",
)
def create_industry_chain(
    body: IndustryChainUpsertRequest,
    _: None = Depends(require_admin_session),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> IndustryChainWriteResponse:
    base_slug = _normalize_slug(body.name, body.slug)
    slug = _unique_slug(db_manager, base_slug)
    try:
        row = db_manager.create_discover_industry_chain(
            slug=slug,
            name=body.name,
            introduction=body.introduction,
            latest_news=body.latest_news,
            core_stocks=_stocks_payload(body.core_stocks),
            market=body.market,
            status=body.status,
            sort_order=body.sort_order,
        )
        return IndustryChainWriteResponse(item=IndustryChainSummary(**row))
    except ValueError as exc:
        if str(exc) == "slug_already_exists":
            raise HTTPException(status_code=409, detail="slug_already_exists") from exc
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("create_industry_chain failed: %s", exc)
        raise HTTPException(status_code=500, detail="创建核心产业链失败") from exc


@router.put(
    "/{slug}",
    response_model=IndustryChainWriteResponse,
    summary="更新核心产业链",
)
def update_industry_chain(
    slug: str,
    body: IndustryChainUpsertRequest,
    _: None = Depends(require_admin_session),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> IndustryChainWriteResponse:
    key = str(slug or "").strip().lower()
    if not key or not _SLUG_RE.match(key):
        raise HTTPException(status_code=404, detail="industry_chain_not_found")
    try:
        row = db_manager.update_discover_industry_chain(
            key,
            name=body.name,
            introduction=body.introduction,
            latest_news=body.latest_news,
            core_stocks=_stocks_payload(body.core_stocks),
            market=body.market,
            status=body.status,
            sort_order=body.sort_order,
        )
        if row is None:
            raise HTTPException(status_code=404, detail="industry_chain_not_found")
        return IndustryChainWriteResponse(item=IndustryChainSummary(**row))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("update_industry_chain failed: %s", exc)
        raise HTTPException(status_code=500, detail="更新核心产业链失败") from exc


@router.delete(
    "/{slug}",
    response_model=IndustryChainDeleteResponse,
    summary="删除核心产业链",
)
def delete_industry_chain(
    slug: str,
    _: None = Depends(require_admin_session),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> IndustryChainDeleteResponse:
    key = str(slug or "").strip().lower()
    if not key or not _SLUG_RE.match(key):
        raise HTTPException(status_code=404, detail="industry_chain_not_found")
    try:
        ok = db_manager.delete_discover_industry_chain(key)
        if not ok:
            raise HTTPException(status_code=404, detail="industry_chain_not_found")
        return IndustryChainDeleteResponse(slug=key)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("delete_industry_chain failed: %s", exc)
        raise HTTPException(status_code=500, detail="删除核心产业链失败") from exc
