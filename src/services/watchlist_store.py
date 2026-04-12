# -*- coding: utf-8 -*-
"""Persisted user watchlist (JSON file) shared by Web API and ``main.py --my-watchlist``."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from data_provider.base import canonical_stock_code

logger = logging.getLogger(__name__)

MAX_WATCHLIST_CODES = 500
_SCHEMA_VERSION = 1


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def resolved_watchlist_path() -> Path:
    raw = (os.getenv("WATCHLIST_FILE") or "").strip()
    if raw:
        p = Path(raw).expanduser()
        return p.resolve() if p.is_absolute() else (Path.cwd() / p).resolve()
    return (_project_root() / "data" / "watchlist.json").resolve()


def _empty_payload() -> Dict[str, Any]:
    return {"version": _SCHEMA_VERSION, "codes": [], "labels": {}, "updated_at": None}


def _normalize_codes(raw: List[str]) -> List[str]:
    seen: set[str] = set()
    codes: List[str] = []
    for item in raw:
        s = (item or "").strip()
        if not s:
            continue
        c = canonical_stock_code(s)
        if not c:
            continue
        if c in seen:
            continue
        seen.add(c)
        codes.append(c)
        if len(codes) >= MAX_WATCHLIST_CODES:
            break
    return codes


def _normalize_labels(codes: List[str], labels: Optional[Dict[str, Any]]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    if not labels:
        return out
    code_set = set(codes)
    for k, v in labels.items():
        if k not in code_set:
            continue
        if v is None:
            continue
        text = str(v).strip()
        if text:
            out[k] = text[:120]
    return out


def load_watchlist_file(path: Optional[Path] = None) -> Dict[str, Any]:
    """Return full payload dict (version, codes, labels, updated_at)."""
    p = path or resolved_watchlist_path()
    if not p.is_file():
        return _empty_payload()
    try:
        raw_text = p.read_text(encoding="utf-8")
    except OSError as exc:
        logger.error("读取自选文件失败 %s: %s", p, exc)
        return _empty_payload()
    try:
        data = json.loads(raw_text) if raw_text.strip() else {}
    except json.JSONDecodeError as exc:
        logger.error("自选文件 JSON 无效 %s: %s", p, exc)
        return _empty_payload()
    if not isinstance(data, dict):
        return _empty_payload()
    codes_raw = data.get("codes") or data.get("stock_codes") or []
    if not isinstance(codes_raw, list):
        codes_raw = []
    str_codes = [str(x) for x in codes_raw if x is not None]
    codes = _normalize_codes(str_codes)
    labels_in = data.get("labels")
    labels: Dict[str, str] = {}
    if isinstance(labels_in, dict):
        labels = _normalize_labels(codes, labels_in)
    return {
        "version": int(data.get("version") or _SCHEMA_VERSION),
        "codes": codes,
        "labels": labels,
        "updated_at": data.get("updated_at"),
    }


def load_watchlist_codes(path: Optional[Path] = None) -> List[str]:
    return list(load_watchlist_file(path)["codes"])


def save_watchlist(
    codes: List[str],
    labels: Optional[Dict[str, Any]] = None,
    path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Persist codes (canonical, deduped, capped). Returns saved payload."""
    p = path or resolved_watchlist_path()
    norm_codes = _normalize_codes([str(x) for x in codes if x is not None])
    norm_labels = _normalize_labels(norm_codes, labels)
    payload = {
        "version": _SCHEMA_VERSION,
        "codes": norm_codes,
        "labels": norm_labels,
        "updated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    }
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    body = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    tmp.write_text(body, encoding="utf-8")
    os.replace(tmp, p)
    return payload
