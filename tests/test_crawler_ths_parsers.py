# -*- coding: utf-8 -*-
"""Unit tests for THS HTML parsers (no network)."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.crawler.tasks.ths_concept.parsers import (
    extract_concept_refs,
    parse_constituent_rows,
    parse_max_page_from_pager,
    parse_page_info,
)

_FIX = Path(__file__).resolve().parent / "fixtures" / "crawler"


def test_extract_concept_refs() -> None:
    html = (_FIX / "ths_catalog_snippet.html").read_text(encoding="utf-8")
    refs = extract_concept_refs(html, catalog_url="https://q.10jqka.com.cn/gn/detail/code/308718/")
    codes = {r[0] for r in refs}
    assert "301558" in codes
    assert "308630" in codes
    by_code = {r[0]: r for r in refs}
    assert "芯片" in (by_code["301558"][1] or "")
    assert by_code["301558"][2].startswith("https:")


def test_parse_constituent_rows_pairs() -> None:
    html = (_FIX / "ths_ajax_snippet.html").read_text(encoding="utf-8")
    rows = parse_constituent_rows(html, concept_code="308630", page=1)
    assert rows[0][0] == "300840"
    assert rows[0][1] == "酷特智能"
    assert rows[1][0] == "000793"


def test_parse_page_info() -> None:
    html = (_FIX / "ths_ajax_snippet.html").read_text(encoding="utf-8")
    assert parse_page_info(html) == (1, 12)


def test_parse_max_page_from_pager() -> None:
    html = (_FIX / "ths_ajax_snippet.html").read_text(encoding="utf-8")
    assert parse_max_page_from_pager(html) == 12


@pytest.mark.parametrize(
    "html_snippet,expected",
    [
        ("<span class='page_info'>3/10</span>", (3, 10)),
        ("no pager here", None),
    ],
)
def test_parse_page_info_edge(html_snippet: str, expected) -> None:
    assert parse_page_info(html_snippet) == expected
