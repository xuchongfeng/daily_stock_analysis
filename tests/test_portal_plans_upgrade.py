# -*- coding: utf-8 -*-
"""portal_plans：套餐升级意向校验。"""
import unittest

from src.portal_plans import validate_plan_upgrade_target


class TestPortalPlanUpgradeValidation(unittest.TestCase):
    def test_free_to_paid_ok(self):
        ok, msg = validate_plan_upgrade_target("free", "p19")
        self.assertTrue(ok)
        self.assertEqual(msg, "")

    def test_p19_to_p49_ok(self):
        ok, msg = validate_plan_upgrade_target("p19", "p49")
        self.assertTrue(ok)
        self.assertEqual(msg, "")

    def test_same_tier_rejected(self):
        ok, msg = validate_plan_upgrade_target("p49", "p49")
        self.assertFalse(ok)
        self.assertIn("高于", msg)

    def test_downgrade_rejected(self):
        ok, msg = validate_plan_upgrade_target("p99", "p19")
        self.assertFalse(ok)

    def test_free_target_rejected(self):
        ok, msg = validate_plan_upgrade_target("free", "free")
        self.assertFalse(ok)

    def test_unknown_target_rejected(self):
        ok, msg = validate_plan_upgrade_target("free", "enterprise")
        self.assertFalse(ok)


if __name__ == "__main__":
    unittest.main()
