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
