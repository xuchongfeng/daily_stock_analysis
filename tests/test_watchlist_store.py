# -*- coding: utf-8 -*-
"""Tests for persisted watchlist JSON helpers."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.services import watchlist_store as ws


def test_normalize_and_roundtrip(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    p = tmp_path / "wl.json"
    monkeypatch.setenv("WATCHLIST_FILE", str(p))

    saved = ws.save_watchlist(["600519", "aapl", "600519"], {"600519": "茅台"})
    assert saved["codes"] == ["600519", "AAPL"]
    assert saved["labels"] == {"600519": "茅台"}
    assert "updated_at" in saved and saved["updated_at"]

    codes = ws.load_watchlist_codes()
    assert codes == ["600519", "AAPL"]

    data = ws.load_watchlist_file()
    assert data["codes"] == ["600519", "AAPL"]


def test_missing_file_returns_empty(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    p = tmp_path / "nope.json"
    monkeypatch.setenv("WATCHLIST_FILE", str(p))
    assert ws.load_watchlist_codes() == []


def test_relative_watchlist_file_resolves_to_cwd(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    rel = "subdir/my_wl.json"
    target = (tmp_path / rel).resolve()
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("WATCHLIST_FILE", rel)
    ws.save_watchlist(["000001"], None)
    assert target.is_file()
    loaded = json.loads(target.read_text(encoding="utf-8"))
    assert loaded["codes"] == ["000001"]
