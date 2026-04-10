# -*- coding: utf-8 -*-
"""
信号摘要 API：近窗 ``analysis_history`` 二次聚合。
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import get_database_manager
from api.v1.schemas.common import ErrorResponse
from api.v1.schemas.signal_digest import SignalDigestResponse
from src.services.signal_digest_service import build_signal_digest
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
    ),
)
def get_signal_digest(
    trading_sessions: int = Query(
        14,
        ge=3,
        le=60,
        description="交易日窗口长度（含锚定日）",
    ),
    top_k: int = Query(10, ge=3, le=30, description="返回的标的数量上限"),
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
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> SignalDigestResponse:
    if exclude_batch and batch_only:
        raise HTTPException(
            status_code=422,
            detail="exclude_batch 与 batch_only 不能同时为 true",
        )
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
        return SignalDigestResponse.model_validate(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("signal_digest failed: %s", exc)
        raise HTTPException(status_code=500, detail="signal_digest_failed") from exc
