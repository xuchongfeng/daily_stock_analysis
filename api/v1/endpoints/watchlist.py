# -*- coding: utf-8 -*-
"""User watchlist file API (shared with CLI ``--my-watchlist``)."""

from __future__ import annotations

import logging

from fastapi import APIRouter

from api.v1.schemas.watchlist import WatchlistPutRequest, WatchlistResponse
from src.services.watchlist_store import load_watchlist_file, save_watchlist

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=WatchlistResponse)
def get_watchlist() -> WatchlistResponse:
    data = load_watchlist_file()
    return WatchlistResponse(
        codes=list(data.get("codes") or []),
        labels=dict(data.get("labels") or {}),
        updated_at=data.get("updated_at"),
    )


@router.put("", response_model=WatchlistResponse)
def put_watchlist(body: WatchlistPutRequest) -> WatchlistResponse:
    saved = save_watchlist(body.codes, body.labels)
    logger.info("自选列表已更新，共 %d 条", len(saved.get("codes") or []))
    return WatchlistResponse(
        codes=list(saved.get("codes") or []),
        labels=dict(saved.get("labels") or {}),
        updated_at=saved.get("updated_at"),
    )
