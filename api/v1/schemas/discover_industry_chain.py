# -*- coding: utf-8 -*-
"""C 端「核心产业链」API Schema。"""

from typing import List, Optional

from pydantic import BaseModel, Field


class IndustryChainStock(BaseModel):
    stock_code: str
    stock_name: Optional[str] = None
    role: Optional[str] = None
    sort_order: int = 0


class IndustryChainSummary(BaseModel):
    slug: str
    name: str
    introduction: str = ""
    latest_news: str = ""
    market: str = "cn"
    status: str = "active"
    sort_order: int = 0
    core_stock_count: int = 0
    updated_at: Optional[str] = None


class IndustryChainListResponse(BaseModel):
    items: List[IndustryChainSummary] = Field(default_factory=list)


class IndustryChainDetail(IndustryChainSummary):
    core_stocks: List[IndustryChainStock] = Field(default_factory=list)
    created_at: Optional[str] = None


class IndustryChainUpsertRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    slug: Optional[str] = Field(None, max_length=64, description="URL 标识；省略则自动生成")
    introduction: str = ""
    latest_news: str = ""
    core_stocks: List[IndustryChainStock] = Field(default_factory=list)
    market: str = Field("cn", pattern="^(cn|hk|us|all)$")
    status: str = Field("active", pattern="^(active|archived)$")
    sort_order: int = Field(0, ge=0, le=9999)


class IndustryChainWriteResponse(BaseModel):
    item: IndustryChainSummary


class IndustryChainDeleteResponse(BaseModel):
    deleted: bool = True
    slug: str
