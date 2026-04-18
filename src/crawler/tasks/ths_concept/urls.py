# -*- coding: utf-8 -*-
"""Build THS concept AJAX URLs."""

from __future__ import annotations


def concept_detail_url(concept_code: str) -> str:
    return f"https://q.10jqka.com.cn/gn/detail/code/{concept_code}/"


def constituents_ajax_url(*, field: str, order: str, page: int, concept_code: str) -> str:
    return (
        f"https://q.10jqka.com.cn/gn/detail/field/{field}/order/{order}/page/{page}/ajax/1/code/{concept_code}"
    )
