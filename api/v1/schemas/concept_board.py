# -*- coding: utf-8 -*-
"""概念板块与板块股票 API Schema。"""

from typing import List, Optional

from pydantic import BaseModel, Field


class ConceptBoardItem(BaseModel):
    board_code: str
    board_name: str
    stocks_count: int = 0
    volume_ge_75_count: int = 0
    updated_at: Optional[str] = None


class ConceptBoardListResponse(BaseModel):
    items: List[ConceptBoardItem] = Field(default_factory=list)


class ConceptBoardStockItem(BaseModel):
    stock_code: str
    stock_name: Optional[str] = None
    sentiment_score: Optional[int] = None
    operation_advice: Optional[str] = None
    latest_scored_at: Optional[str] = None
    tag_industry: List[str] = Field(default_factory=list)
    tag_concept: List[str] = Field(default_factory=list)


class ConceptBoardDetail(BaseModel):
    board_code: str
    board_name: str
    stocks_count: int = 0
    updated_at: Optional[str] = None


class ConceptBoardStocksResponse(BaseModel):
    board: ConceptBoardDetail
    total: int = 0
    limit: int = 200
    offset: int = 0
    items: List[ConceptBoardStockItem] = Field(default_factory=list)
