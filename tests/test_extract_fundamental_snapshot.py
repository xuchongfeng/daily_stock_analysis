# -*- coding: utf-8 -*-
"""context_snapshot 结构兼容：pipeline 嵌套 vs Agent 扁平 fundamental_context。"""

import unittest

from src.utils.data_processing import extract_board_detail_fields, extract_fundamental_context


class ExtractFundamentalSnapshotTest(unittest.TestCase):
    def test_nested_enhanced_context(self) -> None:
        snap = {
            "enhanced_context": {
                "fundamental_context": {"belong_boards": [{"name": "白酒", "type": "行业"}]},
            },
        }
        fc = extract_fundamental_context(snap)
        self.assertIsNotNone(fc)
        detail = extract_board_detail_fields(snap)
        self.assertEqual(len(detail["belong_boards"]), 1)
        self.assertEqual(detail["belong_boards"][0]["name"], "白酒")

    def test_flat_root_fundamental_context_agent_style(self) -> None:
        """Agent 路径写入的 context_snapshot 无 enhanced_context 包装。"""
        snap = {
            "stock_code": "600519",
            "fundamental_context": {"belong_boards": [{"name": "半导体", "code": "885908"}]},
        }
        fc = extract_fundamental_context(snap)
        self.assertIsNotNone(fc)
        detail = extract_board_detail_fields(snap)
        self.assertEqual(len(detail["belong_boards"]), 1)
        self.assertEqual(detail["belong_boards"][0]["name"], "半导体")
        self.assertEqual(detail["belong_boards"][0].get("code"), "885908")

    def test_nested_takes_precedence_over_root(self) -> None:
        snap = {
            "enhanced_context": {
                "fundamental_context": {"belong_boards": [{"name": "嵌套板块"}]},
            },
            "fundamental_context": {"belong_boards": [{"name": "根级板块"}]},
        }
        fc = extract_fundamental_context(snap)
        self.assertIsNotNone(fc)
        self.assertEqual(fc.get("belong_boards", [{}])[0].get("name"), "嵌套板块")


if __name__ == "__main__":
    unittest.main()
