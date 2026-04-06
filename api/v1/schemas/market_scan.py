# -*- coding: utf-8 -*-
"""榜单扫描（涨幅 / 成交量）API Schema。"""

from typing import List, Optional

from pydantic import BaseModel, Field


class MarketScanBatchSummary(BaseModel):
    batch_run_id: str = Field(..., description="批次 ID")
    scan_kind: str = Field(..., description="gainers=涨幅榜 volume=成交量榜")
    item_count: int = Field(..., description="该批次分析记录条数")
    last_created_at: Optional[str] = Field(None, description="批次内最近一条创建时间")


class MarketScanBatchListResponse(BaseModel):
    items: List[MarketScanBatchSummary] = Field(default_factory=list)


class MarketScanItem(BaseModel):
    id: Optional[int] = None
    query_id: str = ""
    stock_code: str = ""
    stock_name: Optional[str] = None
    report_type: Optional[str] = None
    sentiment_score: Optional[int] = None
    operation_advice: Optional[str] = None
    rank_in_batch: Optional[int] = None
    ref_change_pct: Optional[float] = None
    ref_trade_volume: Optional[float] = Field(
        None, description="榜单参考成交量（单位与数据源一致，如东财股数或 Tushare 手数）"
    )
    created_at: Optional[str] = None


class MarketScanBatchItemsResponse(BaseModel):
    total: int = 0
    page: int = 1
    limit: int = 50
    sort_by: str = "sentiment_score"
    order: str = "desc"
    items: List[MarketScanItem] = Field(default_factory=list)


class MarketScanResumeResponse(BaseModel):
    """榜单批次续跑：仅分析该批次尚未写入历史的股票。"""

    skipped: bool = Field(False, description="是否未执行分析（如无待补全、参数错误等）")
    reason: Optional[str] = Field(None, description="skipped 时的原因码")
    detail: Optional[str] = Field(None, description="补充说明")
    batch_run_id: str = ""
    scan_kind: Optional[str] = None
    trade_date: Optional[str] = None
    universe_size: int = 0
    already_completed_before: int = 0
    pending_resume: int = Field(0, description="续跑前判定无需补全时可能返回")
    resume_attempted: int = 0
    success_count: int = 0
    failure_count: int = 0
    notification_sent: bool = False
