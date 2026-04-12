# -*- coding: utf-8 -*-
"""Watchlist API schemas."""

from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class WatchlistResponse(BaseModel):
    codes: List[str] = Field(default_factory=list)
    labels: Dict[str, str] = Field(default_factory=dict)
    updated_at: Optional[str] = None


class WatchlistPutRequest(BaseModel):
    codes: List[str] = Field(default_factory=list)
    labels: Optional[Dict[str, str]] = None
