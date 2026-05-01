# -*- coding: utf-8 -*-
"""Unit tests for C /user portal auth helpers."""

from __future__ import annotations

import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import src.portal_auth as pa


class TestPortalAuth(unittest.TestCase):
    def tearDown(self) -> None:
        pa.refresh_portal_auth_state()

    def test_password_hash_roundtrip(self) -> None:
        err, line = pa.hash_plain_password("abcdefgh")
        self.assertIsNone(err)
        assert line is not None
        self.assertTrue(pa.verify_portal_password("abcdefgh", line))
        self.assertFalse(pa.verify_portal_password("abcdefgi", line))

    def test_password_too_short(self) -> None:
        err, line = pa.hash_plain_password("short")
        self.assertIsNotNone(err)
        self.assertIsNone(line)

    def test_session_token_roundtrip(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "stock_analysis.db"
            with patch.dict(os.environ, {"DATABASE_PATH": str(db), "PORTAL_SESSION_MAX_AGE_HOURS": "1"}):
                pa.refresh_portal_auth_state()
                tok = pa.create_portal_session_token(42)
                self.assertTrue(tok)
                self.assertEqual(pa.verify_portal_session_token(tok), 42)

    def test_session_token_expired(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "stock_analysis.db"
            with patch.dict(os.environ, {"DATABASE_PATH": str(db), "PORTAL_SESSION_MAX_AGE_HOURS": "2"}):
                pa.refresh_portal_auth_state()
                base_ts = 1_700_000_000
                with patch.object(pa.time, "time", return_value=base_ts):
                    tok = pa.create_portal_session_token(99)
                with patch.object(pa.time, "time", return_value=base_ts):
                    self.assertEqual(pa.verify_portal_session_token(tok), 99)
                with patch.object(pa.time, "time", return_value=base_ts + 3 * 3600):
                    self.assertIsNone(pa.verify_portal_session_token(tok))
