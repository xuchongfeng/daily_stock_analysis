# -*- coding: utf-8 -*-
"""
从 Tushare 脚本导出的 ``data/stock_list_*.csv`` 解析股票代码列表。

依赖 CSV 列 ``ts_code`` / ``symbol``（与 ``scripts/fetch_tushare_stock_list.py`` 输出一致）。
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import List

from data_provider.base import canonical_stock_code, normalize_stock_code


def codes_from_tushare_stock_csv(path: Path) -> List[str]:
    """
    读取单张 Tushare 风格股票列表 CSV，返回去重后的 canonical 代码。

    - A 股：优先 ``symbol``（6 位数字），否则 ``ts_code``（如 000001.SZ）
    - 港股/美股：主要依赖 ``ts_code``（如 00700.HK、AAPL）
    """
    if not path.is_file():
        raise FileNotFoundError(f"stock list csv not found: {path}")

    out: list[str] = []
    seen: set[str] = set()

    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sym = (row.get("symbol") or "").strip()
            tc = (row.get("ts_code") or "").strip()
            raw: str | None = None
            if sym and sym.isdigit() and len(sym) == 6:
                raw = sym
            elif tc:
                raw = normalize_stock_code(tc)
            elif sym:
                raw = normalize_stock_code(sym)
            if not raw:
                continue
            c = canonical_stock_code(raw)
            if not c or c in seen:
                continue
            seen.add(c)
            out.append(c)

    return out
