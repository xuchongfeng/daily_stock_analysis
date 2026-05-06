# -*- coding: utf-8 -*-
"""C 端「热点事件」策展数据 API Schema。"""

from typing import List, Optional

from pydantic import BaseModel, Field


class HotEventBoardRef(BaseModel):
    board_code: str
    board_name: Optional[str] = None
    stocks_count: Optional[int] = None


class HotEventSummary(BaseModel):
    slug: str
    title: str
    summary: str = ""
    market: str = "cn"
    status: str = "active"
    heat_score: int = 0
    board_codes: List[str] = Field(default_factory=list)
    started_at: Optional[str] = None
    updated_at: Optional[str] = None


class HotEventListResponse(BaseModel):
    items: List[HotEventSummary] = Field(default_factory=list)


class HotEventTimelineItem(BaseModel):
    occurred_on: Optional[str] = None
    sort_order: int = 0
    headline: str
    body: str = ""
    link_url: Optional[str] = None
    kind: str = "news"


class HotEventAnchorStock(BaseModel):
    stock_code: str
    stock_name: Optional[str] = None
    role: Optional[str] = None


class HotEventCoreMetric(BaseModel):
    label: str
    value: str = ""
    hint: Optional[str] = None


class HotEventDetail(HotEventSummary):
    boards: List[HotEventBoardRef] = Field(default_factory=list)
    anchor_stocks: List[HotEventAnchorStock] = Field(default_factory=list)
    core_metrics: List[HotEventCoreMetric] = Field(default_factory=list)
    timeline: List[HotEventTimelineItem] = Field(default_factory=list)
    source_note: Optional[str] = None
