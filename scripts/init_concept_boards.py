# -*- coding: utf-8 -*-
"""导入概念板块与板块股票映射到数据库。"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

# 允许从项目根外直接 `python scripts/init_concept_boards.py` 执行
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from data_provider.base import canonical_stock_code
from src.storage import DatabaseManager


def _parse_json_array(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x).strip()]
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        try:
            arr = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return []
        if isinstance(arr, list):
            return [str(x).strip() for x in arr if str(x).strip()]
    return []


def _normalize_board_items(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = payload.get("items")
    if not isinstance(items, list):
        return []

    out: List[Dict[str, Any]] = []
    for board in items:
        if not isinstance(board, dict):
            continue
        board_code = str(board.get("p_code") or "").strip()
        board_name = str(board.get("name") or "").strip()
        if not board_code or not board_name:
            continue
        stocks_raw = board.get("stocks")
        stocks_out: List[Dict[str, Any]] = []
        if isinstance(stocks_raw, list):
            for row in stocks_raw:
                if not isinstance(row, dict):
                    continue
                raw_code = str(row.get("stock_code") or "").strip()
                stock_code = canonical_stock_code(raw_code) or raw_code
                if not stock_code:
                    continue
                stock_name = str(row.get("stock_name") or "").strip()
                stocks_out.append(
                    {
                        "stock_code": stock_code,
                        "stock_name": stock_name or None,
                        # 按需求：行业/概念标签都保留
                        "tag_industry": _parse_json_array(row.get("tag_industrys")),
                        "tag_concept": _parse_json_array(row.get("tag_concepts")),
                        # 仅保留少量可追溯字段，避免入库过大
                        "raw_payload": {
                            "company_id": row.get("company_id"),
                            "product_id": row.get("product_id"),
                            "plate": row.get("plate"),
                            "update_time": row.get("update_time"),
                        },
                    }
                )
        out.append(
            {
                "board_code": board_code,
                "board_name": board_name,
                "stocks_count": int(board.get("stocks_count") or len(stocks_out) or 0),
                "stocks": stocks_out,
            }
        )
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="初始化概念板块与板块股票映射")
    parser.add_argument(
        "input_path",
        help="概念板块 JSON 路径（如 /Users/flyfish/Projects/crawler/stock_xueqiu_by_industry_full.json）",
    )
    args = parser.parse_args()
    path = Path(args.input_path).expanduser().resolve()
    if not path.exists():
        raise SystemExit(f"输入文件不存在: {path}")

    payload = json.loads(path.read_text(encoding="utf-8"))
    boards = _normalize_board_items(payload)
    if not boards:
        raise SystemExit("输入文件未解析到有效板块数据，已中止。")

    db = DatabaseManager.get_instance()
    stats = db.replace_concept_boards(boards=boards, source_path=str(path))
    print(
        f"导入完成: boards={stats.get('boards', 0)}, stocks={stats.get('stocks', 0)}, source={path}"
    )


if __name__ == "__main__":
    main()
