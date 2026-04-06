# -*- coding: utf-8 -*-
"""榜单扫描批次列表与条目查询（涨幅榜 / 成交量榜）。"""

import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import get_database_manager
from api.v1.schemas.market_scan import (
    MarketScanBatchItemsResponse,
    MarketScanBatchListResponse,
    MarketScanBatchSummary,
    MarketScanItem,
    MarketScanResumeResponse,
)
from src.services.market_scan_batch_service import resume_market_scan_batch
from src.services.market_scan_constants import scan_kind_from_batch_kind
from src.storage import DatabaseManager

logger = logging.getLogger(__name__)

router = APIRouter()


def _normalize_scan_kind_filter(raw: Optional[str]) -> str:
    s = (raw or "all").strip().lower()
    if s in {"gainers", "volume", "all"}:
        return s
    return "all"


@router.get(
    "/batches",
    response_model=MarketScanBatchListResponse,
    summary="榜单扫描批次列表",
)
def list_market_scan_batches(
    limit: int = Query(30, ge=1, le=100),
    batch_date: Optional[date] = Query(
        None,
        description="按批次号日期段筛选（YYYY-MM-DD）：涨幅 tm_YYYYMMDD_*，成交量 tv_YYYYMMDD_*",
    ),
    scan_kind: str = Query(
        "all",
        description="all | gainers | volume",
    ),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> MarketScanBatchListResponse:
    try:
        sk = _normalize_scan_kind_filter(scan_kind)
        rows = db_manager.list_top_mover_batch_runs(
            limit=limit, batch_date=batch_date, scan_kind=sk
        )
        items = [
            MarketScanBatchSummary(
                batch_run_id=r["batch_run_id"],
                scan_kind=scan_kind_from_batch_kind(r.get("batch_kind")),
                item_count=r["item_count"],
                last_created_at=r.get("last_created_at"),
            )
            for r in rows
        ]
        return MarketScanBatchListResponse(items=items)
    except Exception as exc:
        logger.exception("list_market_scan_batches failed: %s", exc)
        raise HTTPException(status_code=500, detail="查询榜单批次失败") from exc


@router.get(
    "/batches/{batch_run_id}/items",
    response_model=MarketScanBatchItemsResponse,
    summary="某批次内分析记录（支持按评分/名次/成交量等排序）",
)
def list_market_scan_batch_items(
    batch_run_id: str,
    sort_by: str = Query(
        "sentiment_score",
        description="sentiment_score | rank_in_batch | created_at | ref_change_pct | ref_trade_volume",
    ),
    order: str = Query("desc", description="asc 或 desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> MarketScanBatchItemsResponse:
    sort_by_l = (sort_by or "sentiment_score").strip().lower()
    order_l = (order or "desc").strip().lower()
    if order_l not in {"asc", "desc"}:
        order_l = "desc"
    offset = (page - 1) * limit
    try:
        records, total = db_manager.get_top_mover_batch_items(
            batch_run_id=batch_run_id,
            sort_by=sort_by_l,
            order_desc=order_l == "desc",
            offset=offset,
            limit=limit,
        )
        items = [
            MarketScanItem(
                id=r.id,
                query_id=r.query_id or "",
                stock_code=r.code,
                stock_name=r.name,
                report_type=r.report_type,
                sentiment_score=r.sentiment_score,
                operation_advice=r.operation_advice,
                rank_in_batch=r.rank_in_batch,
                ref_change_pct=r.ref_change_pct,
                ref_trade_volume=getattr(r, "ref_trade_volume", None),
                created_at=r.created_at.isoformat() if r.created_at else None,
            )
            for r in records
        ]
        return MarketScanBatchItemsResponse(
            total=total,
            page=page,
            limit=limit,
            sort_by=sort_by_l,
            order=order_l,
            items=items,
        )
    except Exception as exc:
        logger.exception("list_market_scan_batch_items failed: %s", exc)
        raise HTTPException(status_code=500, detail="查询批次明细失败") from exc


@router.post(
    "/batches/{batch_run_id}/resume",
    response_model=MarketScanResumeResponse,
    summary="续跑榜单批次（仅补全未分析股票）",
)
def resume_market_scan_batch_endpoint(
    batch_run_id: str,
    dry_run: bool = Query(False, description="为 True 时只拉数据不跑 LLM"),
    send_notification: bool = Query(True, description="是否发送续跑汇总通知"),
) -> MarketScanResumeResponse:
    """
    按批次号中的交易日与榜单类型重建股票池，排除该 ``batch_run_id`` 已写入历史的代码，
    对其余股票继续分析并仍写入同一批次字段。
    """
    try:
        stats = resume_market_scan_batch(
            batch_run_id,
            dry_run=dry_run,
            send_notification=send_notification,
        )
        return MarketScanResumeResponse(**stats)
    except Exception as exc:
        logger.exception("resume_market_scan_batch failed: %s", exc)
        raise HTTPException(status_code=500, detail="榜单续跑失败") from exc
