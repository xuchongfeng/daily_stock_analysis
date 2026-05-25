# -*- coding: utf-8 -*-
"""Static file helpers for SPA fallback routes."""

from __future__ import annotations

from pathlib import Path
from typing import Optional


def resolve_static_file(base_dir: Path, rel: str) -> Optional[Path]:
    """
    Resolve ``rel`` under ``base_dir`` and return the path only when it is a
    regular file inside the directory (blocks ``..`` and absolute paths).
    """
    if not rel or rel in (".", ".."):
        return None

    rel_path = Path(rel)
    if rel_path.is_absolute() or ".." in rel_path.parts:
        return None

    try:
        base_resolved = base_dir.resolve()
        candidate = (base_dir / rel_path).resolve()
        candidate.relative_to(base_resolved)
    except (OSError, ValueError):
        return None

    if candidate.is_file():
        return candidate
    return None
