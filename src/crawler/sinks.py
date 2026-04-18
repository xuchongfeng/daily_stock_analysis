# -*- coding: utf-8 -*-
"""Write crawl outputs (JSONL + manifest)."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping

logger = logging.getLogger(__name__)


def ensure_run_dir(base: Path, run_id: str) -> Path:
    p = (base / "ths_concept" / run_id).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


def write_jsonl(path: Path, rows: Iterable[Mapping[str, Any]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            n += 1
    return n


def write_manifest(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {**payload, "finished_at": datetime.now(timezone.utc).isoformat()}
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    logger.info("已写入 manifest: %s", path)
