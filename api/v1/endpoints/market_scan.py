# -*- coding: utf-8 -*-
"""榜单扫描批次列表与条目查询（涨幅榜 / 成交量榜）。"""

import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from api.deps import get_database_manager
from api.v1.schemas.market_scan import (
    MarketScanBatchItemsResponse,
    MarketScanBatchListResponse,
    MarketScanBatchSummary,
    MarketScanItem,
    MarketScanNotifyRequest,
    MarketScanNotifyResponse,
    MarketScanResumeResponse,
    VolumeScanDailyGeScorePoint,
    VolumeScanDailyGeScoreSeriesResponse,
    VolumeScanStockRatingPoint,
    VolumeScanStockRatingSeriesResponse,
)
from data_provider.base import canonical_stock_code
from src.services.market_scan_batch_service import (
    resume_market_scan_batch,
    send_market_scan_batch_notification,
)
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
    "/stats/volume-rating-threshold-daily",
    response_model=VolumeScanDailyGeScoreSeriesResponse,
    summary="成交量榜：每日高分股票数量曲线",
)
def volume_scan_daily_ge_score_counts(
    min_score: int = Query(
        70,
        ge=0,
        le=100,
        description="评分下限（含）；统计各交易日评分不低于该值的去重股票数",
    ),
    start_date: Optional[date] = Query(
        None,
        description="可选：交易日下界（与批次号 tv_YYYYMMDD_* 对齐）",
    ),
    end_date: Optional[date] = Query(
        None,
        description="可选：交易日上界",
    ),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> VolumeScanDailyGeScoreSeriesResponse:
    try:
        if start_date is not None and end_date is not None and start_date > end_date:
            raise HTTPException(status_code=400, detail="start_date 不能晚于 end_date")
        rows = db_manager.get_volume_scan_daily_ge_score_stock_counts(
            min_score=min_score,
            start_date=start_date,
            end_date=end_date,
        )
        return VolumeScanDailyGeScoreSeriesResponse(
            points=[VolumeScanDailyGeScorePoint(**r) for r in rows]
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("volume_scan_daily_ge_score_counts failed: %s", exc)
        raise HTTPException(status_code=500, detail="查询成交量榜评分统计失败") from exc


@router.get(
    "/stocks/{stock_code}/volume-rating-series",
    response_model=VolumeScanStockRatingSeriesResponse,
    summary="成交量榜：单只股票按交易日的 AI 评分曲线",
)
def volume_scan_stock_rating_series(
    stock_code: str,
    start_date: Optional[date] = Query(
        None,
        description="可选：交易日下界",
    ),
    end_date: Optional[date] = Query(
        None,
        description="可选：交易日上界",
    ),
    db_manager: DatabaseManager = Depends(get_database_manager),
) -> VolumeScanStockRatingSeriesResponse:
    code = canonical_stock_code(stock_code)
    if not code:
        raise HTTPException(status_code=400, detail="股票代码不能为空")
    try:
        if start_date is not None and end_date is not None and start_date > end_date:
            raise HTTPException(status_code=400, detail="start_date 不能晚于 end_date")
        rows = db_manager.get_volume_scan_stock_rating_series(
            code=code,
            start_date=start_date,
            end_date=end_date,
        )
        pts = [
            VolumeScanStockRatingPoint(
                id=r.get("id"),
                trade_date=r["trade_date"],
                sentiment_score=int(r["sentiment_score"] or 0),
                batch_run_id=r.get("batch_run_id") or "",
                rank_in_batch=r.get("rank_in_batch"),
                stock_name=r.get("stock_name"),
                created_at=r.get("created_at"),
            )
            for r in rows
        ]
        return VolumeScanStockRatingSeriesResponse(stock_code=code, points=pts)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("volume_scan_stock_rating_series failed: %s", exc)
        raise HTTPException(status_code=500, detail="查询个股成交量榜评分序列失败") from exc


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
        code_list = [str(r.code or "").strip() for r in records if str(r.code or "").strip()]
        concept_tags_by_code = db_manager.get_concept_tags_by_codes(code_list, per_stock_limit=8) if code_list else {}
        items = [
            MarketScanItem(
                id=r.id,
                query_id=r.query_id or "",
                stock_code=r.code,
                stock_name=r.name,
                report_type=r.report_type,
                sentiment_score=r.sentiment_score,
                operation_advice=r.operation_advice,
                concept_tags=concept_tags_by_code.get(str(r.code or "").strip(), []),
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


@router.post(
    "/batches/{batch_run_id}/notify",
    response_model=MarketScanNotifyResponse,
    summary="手动推送榜单批次通知（自定义 Top N 与是否含分析摘要）",
)
def notify_market_scan_batch_endpoint(
    batch_run_id: str,
    body: MarketScanNotifyRequest = Body(default_factory=MarketScanNotifyRequest),
) -> MarketScanNotifyResponse:
    """
    从 ``analysis_history`` 读取该批次已落库记录，按 **AI 评分** 降序取前 ``top_n`` 只，
    组装 Markdown 后走与 CLI 批次相同的通知渠道。

    与跑批结束时的自动汇总通知不同：本接口为 **用户主动触发**，不依赖 ``TOP_MOVERS_NOTIFY_ENABLED``；
    仍需配置至少一种通知渠道。
    """
    try:
        stats = send_market_scan_batch_notification(
            batch_run_id,
            top_n=body.top_n,
            detail_level=body.detail_level,
        )
        return MarketScanNotifyResponse(**stats)
    except Exception as exc:
        logger.exception("send_market_scan_batch_notification failed: %s", exc)
        raise HTTPException(status_code=500, detail="榜单通知发送失败") from exc
