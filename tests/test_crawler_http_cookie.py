# -*- coding: utf-8 -*-
"""Tests for THS cookie / hexin-v helpers on httpx client."""

import os
import unittest
from unittest.mock import MagicMock, patch

import httpx

from src.crawler.config import load_crawler_config
from src.crawler.errors import CrawlAuthError
from src.crawler.http_client import (
    CrawlHttpClient,
    _chrome_major_version,
    _sec_ch_ua_platform_quoted,
    _ths_bootstrap_nav_headers,
    _ths_constituent_ajax_nav_headers,
    read_ths_v_cookie_from_client,
)


class CrawlerHttpCookieTestCase(unittest.TestCase):
    def test_read_v_from_jar(self) -> None:
        client = httpx.Client()
        client.cookies.set("v", "tok123", domain=".10jqka.com.cn", path="/")
        self.assertEqual(read_ths_v_cookie_from_client(client), "tok123")

    def test_read_v_empty_jar(self) -> None:
        client = httpx.Client()
        self.assertIsNone(read_ths_v_cookie_from_client(client))

    def test_chrome_major_from_ua(self) -> None:
        self.assertEqual(_chrome_major_version("Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36"), "120")
        self.assertEqual(_chrome_major_version("Chrome/146.0.0.0"), "146")
        self.assertEqual(_chrome_major_version(""), "131")

    def test_sec_ch_platform_from_ua(self) -> None:
        mac = (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
        )
        self.assertEqual(_sec_ch_ua_platform_quoted(mac), '"macOS"')
        self.assertEqual(_sec_ch_ua_platform_quoted("Windows NT 10.0 Chrome/131"), '"Windows"')

    def test_bootstrap_nav_headers_match_main_site_flow(self) -> None:
        ua = (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
        )
        h = _ths_bootstrap_nav_headers(ua)
        self.assertEqual(h["Referer"], "https://q.10jqka.com.cn/")
        self.assertEqual(h["Sec-Fetch-Mode"], "navigate")
        self.assertIn("146", h["sec-ch-ua"])
        self.assertEqual(h["sec-ch-ua-platform"], '"macOS"')

    def test_constituent_ajax_nav_headers_match_browser_top_navigation(self) -> None:
        """成分 AJAX 使用文档导航指纹（与地址栏打开 q.10jqka 一致），非 XHR cors。"""
        ua = (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
        )
        h = _ths_constituent_ajax_nav_headers(ua)
        self.assertNotIn("Referer", h)
        self.assertNotIn("Origin", h)
        self.assertNotIn("X-Requested-With", h)
        self.assertEqual(h["Sec-Fetch-Dest"], "document")
        self.assertEqual(h["Sec-Fetch-Mode"], "navigate")
        self.assertEqual(h["Sec-Fetch-Site"], "none")
        self.assertEqual(h["Sec-Fetch-User"], "?1")
        self.assertEqual(h["Upgrade-Insecure-Requests"], "1")

    def test_default_user_agent_is_browser_like(self) -> None:
        with patch.dict(os.environ, {"CRAWLER_USER_AGENT": ""}, clear=False):
            cfg = load_crawler_config()
        self.assertIn("Chrome/", cfg.user_agent)
        self.assertNotIn("DSA-crawler", cfg.user_agent)

    def test_http_verify_ssl_defaults_true(self) -> None:
        cfg = load_crawler_config()
        self.assertTrue(cfg.http_verify_ssl)

    def test_delay_ms_defaults_2000(self) -> None:
        with patch.dict(os.environ, {"CRAWLER_DELAY_MS": ""}, clear=False):
            cfg = load_crawler_config()
        self.assertEqual(cfg.delay_ms, 2000)

    def test_delay_ms_override_from_env(self) -> None:
        with patch.dict(os.environ, {"CRAWLER_DELAY_MS": "750"}, clear=False):
            cfg = load_crawler_config()
        self.assertEqual(cfg.delay_ms, 750)

    def test_http_verify_ssl_false_from_env(self) -> None:
        with patch.dict(os.environ, {"CRAWLER_HTTP_VERIFY_SSL": "false"}, clear=False):
            cfg = load_crawler_config()
        self.assertFalse(cfg.http_verify_ssl)

    def test_http_verify_ssl_false_with_quotes_in_env(self) -> None:
        """.env 中误加引号时仍应识别为关闭校验。"""
        with patch.dict(os.environ, {"CRAWLER_HTTP_VERIFY_SSL": '"false"'}, clear=False):
            cfg = load_crawler_config()
        self.assertFalse(cfg.http_verify_ssl)

    def test_ths_auth_max_retries_default(self) -> None:
        cfg = load_crawler_config()
        self.assertEqual(cfg.ths_auth_max_retries, 3)

    def test_ajax_401_retries_with_linear_backoff_then_success(self) -> None:
        import src.crawler.http_client as http_client_mod

        req = httpx.Request("GET", "https://q.10jqka.com.cn/gn/ajax")
        r401 = httpx.Response(401, request=req, text="denied")
        ok_html = "<html><body><table class='m-pager-table'></table></body></html>"
        r200 = httpx.Response(200, request=req, text=ok_html)

        env = {
            "CRAWLER_DELAY_MS": "0",
            "CRAWLER_THS_AUTH_MAX_RETRIES": "2",
            "CRAWLER_THS_AUTO_BOOTSTRAP": "false",
            "CRAWLER_THS_HEXIN_V": "test-v-token",
        }
        with patch.dict(os.environ, env, clear=False):
            cfg = load_crawler_config()
        client = CrawlHttpClient(cfg)
        client._bootstrap_done = True
        client._client.get = MagicMock(side_effect=[r401, r200])

        with patch.object(http_client_mod.time, "sleep") as mock_sleep:
            text = client.get(
                "https://q.10jqka.com.cn/gn/ajax/1",
                referer="https://q.10jqka.com.cn/gn/detail/code/308614/",
                ajax=True,
            )

        self.assertIn("m-pager-table", text)
        self.assertEqual(client._client.get.call_count, 2)
        mock_sleep.assert_called_once_with(10)

    def test_ajax_401_exhausts_retries_raises(self) -> None:
        import src.crawler.http_client as http_client_mod

        req = httpx.Request("GET", "https://q.10jqka.com.cn/gn/ajax")
        r401 = httpx.Response(401, request=req, text="denied")

        env = {
            "CRAWLER_DELAY_MS": "0",
            "CRAWLER_THS_AUTH_MAX_RETRIES": "1",
            "CRAWLER_THS_AUTO_BOOTSTRAP": "false",
            "CRAWLER_THS_HEXIN_V": "test-v-token",
        }
        with patch.dict(os.environ, env, clear=False):
            cfg = load_crawler_config()
        client = CrawlHttpClient(cfg)
        client._bootstrap_done = True
        client._client.get = MagicMock(return_value=r401)

        with patch.object(http_client_mod.time, "sleep") as mock_sleep:
            with self.assertRaises(CrawlAuthError):
                client.get(
                    "https://q.10jqka.com.cn/gn/ajax/1",
                    referer="https://q.10jqka.com.cn/gn/detail/code/308614/",
                    ajax=True,
                )

        self.assertEqual(client._client.get.call_count, 2)
        self.assertEqual(mock_sleep.call_count, 1)
        mock_sleep.assert_called_with(10)


if __name__ == "__main__":
    unittest.main()
