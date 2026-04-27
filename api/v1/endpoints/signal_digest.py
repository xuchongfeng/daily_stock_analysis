# -*- coding: utf-8 -*-
"""
信号摘要 API：近窗 ``analysis_history`` 二次聚合。
"""

import logging
from datetime import datetime, timedelta, date

from fastapi import APIRouter, Depends, HTTPException, Query, Body

from api.deps import get_database_manager
from api.v1.schemas.common import ErrorResponse
from api.v1.schemas.signal_digest import (
    SignalDigestResponse,
    SignalDigestSnapshotDatesResponse,
    SignalDigestSnapshotInitRequest,
    SignalDigestSnapshotInitResponse,
)
from src.config import get_config
from src.core.trading_calendar import is_market_open
from src.services.signal_digest_service import (
    build_signal_digest,
    compute_signal_digest_cache_key,
)
from src.storage import DatabaseManager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "",
    response_model=SignalDigestResponse,
    responses={
        200: {"description": "信号摘要"},
        500: {"description": "服务器错误", "model": ErrorResponse},
    },
    summary="近窗分析记录信号摘要",
    description=(
        "基于近若干交易日内的 analysis_history 记录做规则打分与板块共现聚合；"
        "可选生成简短 Markdown 叙事（依赖已配置 LLM）。"
        "交易日窗口锚定使用 A 股日历（与 market=cn 一致）；market=all 时仍用该窗口拉取数据，"
        "再按代码归属市场过滤。"
        "使用 batch_only=true 可只聚合榜单扫描批次（batch_run_id 非空）；"
        "advice_filter=buy_or_hold 仅保留建议为买入/加仓/持有/增持等偏多或持有类记录。"
        "默认使用 SQLite 缓存（SIGNAL_DIGEST_CACHE_TTL_SECONDS，默认 12 小时，0关闭）；"
        "refresh=true 跳过缓存强制重算。"
    ),
)
def get_signal_digest(
    trading_sessions: int = Query(
        14,
        ge=3,
        le=60,
        description="交易日窗口长度（含锚定日）",
    ),
    top_k: int = Query(10, ge=3, le=100, description="返回的标的数量上限"),
    market: str = Query(
        "cn",
        pattern="^(cn|hk|us|all)$",
        description="市场过滤",
    ),
    exclude_batch: bool = Query(
        False,
        description="为 true 时仅保留 batch_run_id 为空的记录（手工/单股分析等）；与 batch_only 互斥",
    ),
    batch_only: bool = Query(
        False,
        description="为 true 时仅保留榜单扫描等 batch_run_id 非空的记录；与 exclude_batch 互斥",
    ),
    advice_filter: str = Query(
        "any",
        pattern="^(any|buy_or_hold)$",
        description="any=不筛建议；buy_or_hold=仅买入/加仓/持有/增持等偏多或持有类",
    ),
    with_narrative: bool = Query(
        True,
        description="是否调用 LLM 生成叙事（失败时仍返回结构化数据）",
    ),
    use_cache: bool = Query(
        True,
        description="是否读写服务端缓存；false 时每次全量计算且不落库缓存",
    ),
    refresh: bool = Query(
        False,
        description="为 true 时跳过读缓存并重新计算，若 use_cache 仍为 true 则回写缓存",
    ),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> SignalDigestResponse:
    if exclude_batch and batch_only:
        raise HTTPException(
            status_code=422,
            detail="exclude_batch 与 batch_only 不能同时为 true",
        )
    cfg = get_config()
    ttl = int(getattr(cfg, "signal_digest_cache_ttl_seconds", 0) or 0)
    cache_key: str | None = None
    if ttl > 0 and use_cache:
        cache_key = compute_signal_digest_cache_key(
            trading_sessions=trading_sessions,
            top_k=top_k,
            market_filter=market,
            exclude_batch=exclude_batch,
            batch_only=batch_only,
            advice_filter=advice_filter,
            with_narrative=with_narrative,
        )
        if not refresh:
            hit = db_manager.get_signal_digest_cache_payload(cache_key)
            if hit is not None:
                payload, exp = hit
                merged = {
                    **payload,
                    "from_cache": True,
                    "cache_expires_at": exp.isoformat(),
                }
                return SignalDigestResponse.model_validate(merged)

    try:
        payload = build_signal_digest(
            db_manager,
            trading_sessions=trading_sessions,
            top_k=top_k,
            market_filter=market,
            exclude_batch=exclude_batch,
            batch_only=batch_only,
            advice_filter=advice_filter,
            with_narrative=with_narrative,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("signal_digest failed: %s", exc)
        raise HTTPException(status_code=500, detail="signal_digest_failed") from exc

    # 每次 refresh 时覆盖写入可回溯快照（当前仅保留 14/100、30/100 两档）。
    if refresh and top_k == 100 and trading_sessions in (14, 30):
        try:
            window = payload.get("window") or {}
            anchor_date = window.get("anchor_date")
            if anchor_date:
                snap_date = datetime.fromisoformat(str(anchor_date)).date()
                db_manager.upsert_signal_digest_snapshot(
                    snapshot_date=snap_date,
                    trading_sessions=trading_sessions,
                    top_k=top_k,
                    market_filter=market,
                    exclude_batch=exclude_batch,
                    batch_only=batch_only,
                    advice_filter=advice_filter,
                    payload=payload,
                )
        except Exception as exc:
            logger.warning("signal_digest snapshot write skipped: %s", exc)

    expires_iso: str | None = None
    if ttl > 0 and use_cache and cache_key is not None:
        try:
            exp = db_manager.set_signal_digest_cache_payload(cache_key, payload, ttl)
            expires_iso = exp.isoformat()
        except Exception as exc:
            logger.warning("signal_digest cache write skipped: %s", exc)
            expires_iso = (datetime.now() + timedelta(seconds=ttl)).isoformat()
    else:
        expires_iso = None

    merged = {
        **payload,
        "from_cache": False,
        "cache_expires_at": expires_iso,
    }
    return SignalDigestResponse.model_validate(merged)


@router.get(
    "/snapshots",
    response_model=SignalDigestResponse,
    summary="读取信号摘要历史快照",
)
def get_signal_digest_snapshot(
    snapshot_date: date = Query(..., description="快照日期 YYYY-MM-DD"),
    trading_sessions: int = Query(14, ge=3, le=60),
    top_k: int = Query(100, ge=3, le=100),
    market: str = Query("cn", pattern="^(cn|hk|us|all)$"),
    exclude_batch: bool = Query(False),
    batch_only: bool = Query(True),
    advice_filter: str = Query("buy_or_hold", pattern="^(any|buy_or_hold)$"),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> SignalDigestResponse:
    payload = db_manager.get_signal_digest_snapshot_payload(
        snapshot_date=snapshot_date,
        trading_sessions=trading_sessions,
        top_k=top_k,
        market_filter=market,
        exclude_batch=exclude_batch,
        batch_only=batch_only,
        advice_filter=advice_filter,
    )
    if payload is None:
        raise HTTPException(status_code=404, detail="snapshot_not_found")
    return SignalDigestResponse.model_validate(payload)


@router.get(
    "/snapshot-dates",
    response_model=SignalDigestSnapshotDatesResponse,
    summary="获取信号摘要可用历史日期",
)
def list_signal_digest_snapshot_dates(
    trading_sessions: int = Query(14, ge=3, le=60),
    top_k: int = Query(100, ge=3, le=100),
    market: str = Query("cn", pattern="^(cn|hk|us|all)$"),
    exclude_batch: bool = Query(False),
    batch_only: bool = Query(True),
    advice_filter: str = Query("buy_or_hold", pattern="^(any|buy_or_hold)$"),
    limit: int = Query(120, ge=1, le=500),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> SignalDigestSnapshotDatesResponse:
    return SignalDigestSnapshotDatesResponse(
        items=db_manager.list_signal_digest_snapshot_dates(
            trading_sessions=trading_sessions,
            top_k=top_k,
            market_filter=market,
            exclude_batch=exclude_batch,
            batch_only=batch_only,
            advice_filter=advice_filter,
            limit=limit,
        )
    )


@router.post(
    "/snapshots/init",
    response_model=SignalDigestSnapshotInitResponse,
    summary="初始化历史信号摘要快照",
)
def init_signal_digest_snapshots(
    request: SignalDigestSnapshotInitRequest = Body(...),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> SignalDigestSnapshotInitResponse:
    if request.date_from > request.date_to:
        raise HTTPException(status_code=422, detail="date_from cannot be after date_to")

    processed = 0
    skipped = 0
    written = 0
    cur = request.date_from
    while cur <= request.date_to:
        if not is_market_open("cn", cur):
            skipped += 1
            cur += timedelta(days=1)
            continue
        processed += 1
        for sess in (14, 30):
            payload = build_signal_digest(
                db_manager,
                trading_sessions=sess,
                top_k=100,
                market_filter=request.market,
                exclude_batch=request.exclude_batch,
                batch_only=request.batch_only,
                advice_filter=request.advice_filter,
                with_narrative=False,
                anchor_date_override=cur,
            )
            db_manager.upsert_signal_digest_snapshot(
                snapshot_date=cur,
                trading_sessions=sess,
                top_k=100,
                market_filter=request.market,
                exclude_batch=request.exclude_batch,
                batch_only=request.batch_only,
                advice_filter=request.advice_filter,
                payload=payload,
            )
            written += 1
        cur += timedelta(days=1)

    return SignalDigestSnapshotInitResponse(
        processed_trading_days=processed,
        skipped_non_trading_days=skipped,
        written_snapshots=written,
    )
