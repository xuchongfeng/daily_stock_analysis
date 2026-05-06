#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将 ``data/discover_hot_events_seed.json`` 全量写入数据库 ``discover_hot_events`` /
``discover_hot_event_timeline``（会先清空再导入）。

用法：
  python scripts/seed_discover_hot_events.py
  python scripts/seed_discover_hot_events.py --file /path/to/custom.json

JSON 顶层字段：
  events: 数组，元素字段见仓库内 ``data/discover_hot_events_seed.json`` 示例。

退出码：导入失败为 1。
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.config import setup_env

setup_env()

from src.storage import DatabaseManager  # noqa: E402

logger = logging.getLogger(__name__)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser(description="Seed discover hot events from JSON.")
    ap.add_argument(
        "--file",
        type=Path,
        default=ROOT / "data" / "discover_hot_events_seed.json",
        help="JSON 文件路径（默认 data/discover_hot_events_seed.json）",
    )
    args = ap.parse_args()
    path: Path = args.file
    if not path.is_file():
        logger.error("文件不存在: %s", path)
        return 1
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.error("读取 JSON 失败: %s", exc)
        return 1
    events = payload.get("events")
    if not isinstance(events, list):
        logger.error("JSON 缺少顶层数组字段 events")
        return 1
    DatabaseManager.reset_instance()
    db = DatabaseManager.get_instance()
    try:
        n = db.sync_discover_hot_events_from_seed(events)
    except Exception as exc:
        logger.exception("写入失败: %s", exc)
        return 1
    logger.info("已导入 %s 条热点事件（含时间线）", n)
    return 0


if __name__ == "__main__":
    sys.exit(main())
