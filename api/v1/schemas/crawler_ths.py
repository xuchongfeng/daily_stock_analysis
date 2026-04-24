# -*- coding: utf-8 -*-
"""Schemas for Tonghuashun concept crawl read API."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ThsConceptRunItem(BaseModel):
    run_id: str
    task_id: str
    catalog_url: str
    dry_run: bool
    ok: bool
    message: Optional[str] = None
    stats: Dict[str, Any] = Field(default_factory=dict)
    errors: List[Any] = Field(default_factory=list)
    output_path: Optional[str] = None
    created_at: Optional[str] = None
    concept_count: int = 0
    constituent_count: int = 0


class ThsConceptRunListResponse(BaseModel):
    items: List[ThsConceptRunItem] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    limit: int = 30


class ThsConceptItem(BaseModel):
    concept_code: str
    concept_name: Optional[str] = None
    detail_url: Optional[str] = None
    crawled_at: Optional[str] = None


class ThsConceptListResponse(BaseModel):
    items: List[ThsConceptItem] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    limit: int = 100
    run_id: str


class ThsConstituentItem(BaseModel):
    concept_code: str
    stock_code: str
    stock_name: Optional[str] = None
    page: int = 1
    row_index: int = 0
    crawled_at: Optional[str] = None


class ThsConstituentListResponse(BaseModel):
    items: List[ThsConstituentItem] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    limit: int = 200
    run_id: str
    concept_code: Optional[str] = None


class ThsVolumeBatchSectorStatItem(BaseModel):
    concept_code: str
    concept_name: Optional[str] = None
    stocks_in_batch: int = Field(
        ...,
        description="该板块成分中出现在本成交量批次中的条数（一股属多板块时在各板块各计一次）",
    )
    avg_sentiment_score: Optional[float] = Field(None, description="命中样本平均 AI 评分")
    avg_change_pct: Optional[float] = Field(None, description="命中样本平均当日涨跌幅%")
    best_rank_in_batch: Optional[int] = Field(None, description="命中样本中最优（最小）榜单名次")
    avg_ref_trade_volume: Optional[float] = Field(None, description="命中样本平均参考成交量（口径同榜单数据源）")


class ThsVolumeBatchSectorStatsResponse(BaseModel):
    run_id: str
    batch_run_id: str
    batch_stock_count: int = Field(0, description="该成交量批次在 analysis_history 中的总条数")
    items: List[ThsVolumeBatchSectorStatItem] = Field(default_factory=list)
