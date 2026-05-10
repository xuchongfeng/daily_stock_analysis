# -*- coding: utf-8 -*-
"""FastAPI 静态站点路径：C 端根路径 /、管理端 /admin/、旧 /user/ 重定向。"""
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from api.app import create_app


class TestApiAppStaticRoutes(unittest.TestCase):
    def test_legacy_user_path_redirects_to_root(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            user_dir = root / "su"
            user_dir.mkdir()
            (user_dir / "index.html").write_text("<!DOCTYPE html><html><body>c</body></html>", encoding="utf-8")
            empty = root / "empty"
            empty.mkdir()
            app = create_app(static_dir=empty, user_static_dir=user_dir)
            client = TestClient(app)
            r = client.get("/user/today", follow_redirects=False)
            self.assertEqual(r.status_code, 308)
            self.assertEqual(r.headers.get("location"), "/today")

    def test_admin_only_root_redirects_to_admin_slash(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            adm = root / "adm"
            adm.mkdir()
            (adm / "index.html").write_text("<!DOCTYPE html><html><body>a</body></html>", encoding="utf-8")
            nometa = root / "nometa"
            nometa.mkdir()
            app = create_app(static_dir=adm, user_static_dir=nometa)
            client = TestClient(app)
            r = client.get("/", follow_redirects=False)
            self.assertEqual(r.status_code, 307)
            self.assertEqual(r.headers.get("location"), "/admin/")


if __name__ == "__main__":
    unittest.main()
