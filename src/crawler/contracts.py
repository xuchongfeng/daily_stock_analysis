# -*- coding: utf-8 -*-
"""Shared crawl task contracts."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Protocol


@dataclass
class CrawlContext:
    """Runtime options for a crawl run."""

    run_id: str
    output_dir: Path
    dry_run: bool = False
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CrawlResult:
    """Summary of a completed crawl."""

    task_id: str
    ok: bool
    message: str
    output_dir: Path
    stats: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)


class CrawlTask(Protocol):
    task_id: str

    def run(self, ctx: CrawlContext) -> CrawlResult:  # pragma: no cover - interface
        ...
