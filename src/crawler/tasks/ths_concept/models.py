# -*- coding: utf-8 -*-
"""Structured rows for THS concept crawl."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class ConceptRef:
    concept_code: str
    detail_url: str
    name: Optional[str] = None


@dataclass(frozen=True)
class ConstituentRow:
    concept_code: str
    stock_code: str
    stock_name: str
    page: int
    row_index: int
