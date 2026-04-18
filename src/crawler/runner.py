# -*- coding: utf-8 -*-
"""Dispatch ``--crawl`` tasks from CLI."""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Optional

from src.crawler.config import load_crawler_config
from src.crawler.contracts import CrawlContext
from src.crawler.tasks.ths_concept import run_ths_concept_crawl

logger = logging.getLogger(__name__)


def run_crawl_cli(
    task_id: str,
    *,
    dry_run: bool = False,
    output_dir: Optional[Path] = None,
    max_concepts: Optional[int] = None,
    max_pages: Optional[int] = None,
) -> int:
    run_id = uuid.uuid4().hex[:12]
    cfg = load_crawler_config(
        output_dir_override=output_dir,
        max_concepts_override=max_concepts,
        max_pages_override=max_pages,
    )
    base = cfg.output_dir
    ctx = CrawlContext(run_id=run_id, output_dir=base, dry_run=dry_run)

    if task_id == "ths-concept":
        res = run_ths_concept_crawl(ctx, cfg=cfg)
        logger.info(
            "crawl task=%s ok=%s dir=%s stats=%s",
            res.task_id,
            res.ok,
            res.output_dir,
            res.stats,
        )
        if res.errors:
            for e in res.errors:
                logger.error("%s", e)
        return 0 if res.ok else 1

    logger.error("未知 crawl 任务: %s", task_id)
    return 2
