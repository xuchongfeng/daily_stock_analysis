# -*- coding: utf-8 -*-
"""信号摘要（近窗 analysis_history 聚合）API Schema。"""

from typing import List, Optional

from pydantic import BaseModel, Field


class SignalDigestBoardRef(BaseModel):
    name: str = ""
    code: Optional[str] = None
    type: Optional[str] = None


class SignalDigestWindow(BaseModel):
    trading_sessions: int = Field(..., description="交易日窗口长度（含锚定日）")
    anchor_date: str = Field(..., description="窗口锚定日（市场本地日历）ISO 日期")
    oldest_date: str = Field(..., description="窗口最早一日 ISO 日期")
    rows_considered: int = Field(0, description="时间窗内从库中拉取到的行数（筛建议前）")
    rows_after_advice_filter: int = Field(
        0,
        description="经 advice_filter 过滤后参与聚合的行数",
    )
    distinct_stocks: int = Field(0, description="窗内涉及的股票数量（过滤市场后）")
    market_filter: str = Field("cn", description="cn | hk | us | all")
    exclude_batch: bool = Field(
        False,
        description="是否排除带 batch_run_id 的记录（与 batch_only 互斥）",
    )
    batch_only: bool = Field(
        False,
        description="是否仅保留 batch_run_id 非空的榜单批次记录",
    )
    advice_filter: str = Field("any", description="any | buy_or_hold")


class SignalDigestPick(BaseModel):
    code: str
    name: Optional[str] = None
    score: float = Field(..., description="规则综合分（0–100 参考尺度）")
    appearance_count: int = Field(..., description="窗口内该代码出现次数")
    latest_created_at: Optional[str] = None
    sentiment_score: Optional[int] = None
    operation_advice: Optional[str] = None
    trend_prediction: Optional[str] = None
    analysis_summary_excerpt: Optional[str] = None
    boards: List[SignalDigestBoardRef] = Field(default_factory=list)


class SignalDigestBoardHighlight(BaseModel):
    name: str
    count: int


class SignalDigestResponse(BaseModel):
    window: SignalDigestWindow
    picks: List[SignalDigestPick] = Field(default_factory=list)
    board_highlights: List[SignalDigestBoardHighlight] = Field(
        default_factory=list,
        description="仅 Top-K 标的的归属板块共现（与 picks 一致）",
    )
    board_highlights_all: List[SignalDigestBoardHighlight] = Field(
        default_factory=list,
        description="窗口内全部符合条件标的的板块共现（不限于 Top-K）",
    )
    concept_highlights: List[SignalDigestBoardHighlight] = Field(
        default_factory=list,
        description="仅 Top-K 标的的概念板块共现",
    )
    concept_highlights_all: List[SignalDigestBoardHighlight] = Field(
        default_factory=list,
        description="窗口内全部符合条件标的的概念板块共现（不限于 Top-K）",
    )
    narrative_markdown: Optional[str] = Field(None, description="可选 LLM 生成的 Markdown 短文")
    narrative_generated: bool = Field(False, description="是否成功生成叙事（非空）")
    from_cache: bool = Field(False, description="是否命中服务端 SQLite 缓存")
    cache_expires_at: Optional[str] = Field(
        None,
        description="缓存失效时间 ISO8601；未启用缓存或强制刷新后首次写入前可能为空",
    )
