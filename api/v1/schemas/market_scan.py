# -*- coding: utf-8 -*-
"""榜单扫描（涨幅 / 成交量）API Schema。"""

from typing import List, Literal, Optional

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


class MarketScanNotifyRequest(BaseModel):
    """手动推送榜单批次摘要：按评分降序取前 top_n 条。"""

    top_n: int = Field(15, ge=1, le=200, description="推送包含的股票条数上限（按评分降序）")
    detail_level: Literal["summary", "detailed"] = Field(
        "summary",
        description="summary=仅列表行；detailed=每只股票下附带 analysis_summary 摘要",
    )


class MarketScanNotifyResponse(BaseModel):
    """榜单批次手动通知结果。"""

    skipped: bool = Field(False, description="是否未发送（如无记录、无通知渠道等）")
    reason: Optional[str] = Field(None, description="skipped 时的原因码")
    detail: Optional[str] = Field(None, description="补充说明")
    batch_run_id: str = ""
    scan_kind: Optional[str] = None
    items_included: int = Field(0, description="实际纳入推送的条数")
    total_in_batch: int = Field(0, description="该批次在库中的总条数")
    notification_sent: bool = False
    detail_level: Optional[str] = Field(None, description="请求使用的详细程度")
    top_n_requested: int = Field(0, description="请求的上限条数")


class VolumeScanDailyGeScorePoint(BaseModel):
    """成交量榜：某交易日评分不低于阈值的去重股票数量。"""

    trade_date: str = Field(..., description="交易日 YYYY-MM-DD（来自批次号 tv_YYYYMMDD_*）")
    stock_count: int = Field(..., description="该日评分 >= min_score 的股票数（按代码去重）")
    min_score: int = Field(70, description="使用的评分下限（含）")


class VolumeScanDailyGeScoreSeriesResponse(BaseModel):
    points: List[VolumeScanDailyGeScorePoint] = Field(default_factory=list)


class VolumeScanStockRatingPoint(BaseModel):
    id: Optional[int] = Field(None, description="analysis_history 主键，用于获取 Markdown 报告")
    trade_date: str = Field(..., description="交易日 YYYY-MM-DD")
    sentiment_score: int = Field(..., description="AI 评分（当日最新一条成交量榜分析）")
    batch_run_id: str = Field("", description="对应批次号")
    rank_in_batch: Optional[int] = Field(None, description="当日榜单名次（若有）")
    stock_name: Optional[str] = Field(None, description="分析记录中的股票名称")
    created_at: Optional[str] = Field(None, description="该条记录创建时间")


class VolumeScanStockRatingSeriesResponse(BaseModel):
    stock_code: str = Field("", description="查询使用的股票代码（规范化后）")
    points: List[VolumeScanStockRatingPoint] = Field(default_factory=list)
