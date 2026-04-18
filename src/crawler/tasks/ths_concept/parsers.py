# -*- coding: utf-8 -*-
"""Parse THS HTML (catalog + AJAX table fragments)."""

from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from lxml import html

_CONCEPT_CODE_RE = re.compile(r"/gn/detail/code/(\d+)/?", re.I)
_STOCK_HREF_RE = re.compile(
    r"https?://stockpage\.10jqka\.com\.cn/(\d{6})/?", re.I
)
_PAGE_INFO_RE = re.compile(
    r"<span\s+class=[\"']page_info[\"']\s*>(\d+)\s*/\s*(\d+)\s*</span>", re.I
)
_PAGER_PAGE_RE = re.compile(r'changePage"\s+page="(\d+)"', re.I)


def extract_concept_refs(document: str, *, catalog_url: str) -> List[Tuple[str, Optional[str], str]]:
    """
    Return list of (concept_code, link_text_or_none, absolute_or_path_url).

    Dedupes by concept_code; preserves first-seen name.
    """
    tree = html.fromstring(document)
    seen: Dict[str, Tuple[Optional[str], str]] = {}
    for a in tree.xpath("//a[@href]"):
        href = (a.get("href") or "").strip()
        m = _CONCEPT_CODE_RE.search(href)
        if not m:
            continue
        code = m.group(1)
        text = (a.text or "").strip() or None
        if href.startswith("//"):
            full = "https:" + href
        elif href.startswith("http"):
            full = href
        else:
            full = f"https://q.10jqka.com.cn{href}" if href.startswith("/") else catalog_url
        if code not in seen:
            seen[code] = (text, full.split("?", 1)[0])
    return [(c, t, u) for c, (t, u) in seen.items()]


def parse_page_info(document: str) -> Optional[Tuple[int, int]]:
    m = _PAGE_INFO_RE.search(document)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def parse_max_page_from_pager(document: str) -> int:
    """Fallback when ``page_info`` missing: max ``changePage`` page number (含尾页)."""
    nums = [int(x) for x in _PAGER_PAGE_RE.findall(document)]
    return max(nums) if nums else 1


def parse_constituent_rows(document: str, *, concept_code: str, page: int) -> List[Tuple[str, str, int]]:
    """
    Parse ``m-pager-table`` flat ``<td>`` pairs: (code, name, row_index).

    Returns list of (stock_code, stock_name, row_index).
    """
    tree = html.fromstring(document)
    tds = tree.xpath('//table[contains(@class,"m-pager-table")]//td')
    out: List[Tuple[str, str, int]] = []
    i = 0
    row = 0
    while i + 1 < len(tds):
        c1 = tds[i]
        c2 = tds[i + 1]
        a1 = c1.xpath(".//a[@href]")
        a2 = c2.xpath(".//a[@href]")
        if not a1 or not a2:
            i += 1
            continue
        href1 = (a1[0].get("href") or "").strip()
        m = _STOCK_HREF_RE.search(href1)
        if not m:
            i += 1
            continue
        code = m.group(1)
        name = (a2[0].text or "").strip() or code
        out.append((code, name, row))
        row += 1
        i += 2
    return out
