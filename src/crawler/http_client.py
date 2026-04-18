# -*- coding: utf-8 -*-
"""HTTP helpers for crawlers (encoding, THS anti-bot headers)."""

from __future__ import annotations

import logging
import re
import time
from typing import Optional

import httpx

from src.crawler.config import CrawlerConfig
from src.crawler.errors import CrawlAuthError

logger = logging.getLogger(__name__)

_CHROME_MAJOR_RE = re.compile(r"Chrome/(\d+)", re.I)


def _chrome_major_version(user_agent: str) -> str:
    m = _CHROME_MAJOR_RE.search(user_agent or "")
    return m.group(1) if m else "131"


def _sec_ch_ua_platform_quoted(user_agent: str) -> str:
    """与 User-Agent 一致的 Client Hints 平台串（引号已包含）。"""
    ua = (user_agent or "").lower()
    if "macintosh" in ua or "mac os x" in ua:
        return '"macOS"'
    if "linux" in ua and "android" not in ua:
        return '"Linux"'
    return '"Windows"'


def _decode_response_text(response: httpx.Response) -> str:
    enc = "utf-8"
    ct = (response.headers.get("content-type") or "").lower()
    if "charset=gbk" in ct or "charset=gb2312" in ct:
        enc = "gbk"
    return response.content.decode(enc, errors="replace")


_THS_DOCUMENT_ACCEPT = (
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,"
    "image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
)
_THS_ACCEPT_LANGUAGE = "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-TW;q=0.6"


def _ths_bootstrap_nav_headers(user_agent: str) -> dict:
    """
    访问主站首页拉取 Cookie 时的请求头（对齐浏览器导航请求，便于下发 ``v`` 等 Cookie）。

    不包含 ``Cookie`` / ``If-None-Match``：由响应 ``Set-Cookie`` 写入 httpx 会话 jar。
    """
    maj = _chrome_major_version(user_agent)
    sec_ch = f'"Chromium";v="{maj}", "Not-A.Brand";v="24", "Google Chrome";v="{maj}"'
    return {
        "Accept": _THS_DOCUMENT_ACCEPT,
        "Accept-Language": _THS_ACCEPT_LANGUAGE,
        "Cache-Control": "max-age=0",
        "Connection": "keep-alive",
        "Referer": "https://q.10jqka.com.cn/",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent": user_agent,
        "sec-ch-ua": sec_ch,
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": _sec_ch_ua_platform_quoted(user_agent),
    }


def _ths_constituent_ajax_nav_headers(user_agent: str) -> dict:
    """
    概念成分 ``.../ajax/1/code/...`` 在浏览器地址栏直接打开时的请求指纹（非 XHR）。

    与常见 ``Sec-Fetch-Mode: cors`` + ``X-Requested-With`` 的脚本请求不同；同花顺侧易对后者返回 401/403，
    而与 Chrome 顶层导航一致的 ``document`` / ``navigate`` / ``Sec-Fetch-Site: none`` 更稳定。

    不包含 ``Referer`` / ``Origin`` / ``Cookie``：Referer 由调用方决定是否省略；Cookie / hexin-v 在 ``get`` 中合并。
    """
    maj = _chrome_major_version(user_agent)
    sec_ch = f'"Chromium";v="{maj}", "Not-A.Brand";v="24", "Google Chrome";v="{maj}"'
    return {
        "Accept": _THS_DOCUMENT_ACCEPT,
        "Accept-Language": _THS_ACCEPT_LANGUAGE,
        "Cache-Control": "max-age=0",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent": user_agent,
        "sec-ch-ua": sec_ch,
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": _sec_ch_ua_platform_quoted(user_agent),
    }


def read_ths_v_cookie_from_client(client: httpx.Client) -> Optional[str]:
    """从 httpx 会话 Cookie jar 中读取同花顺 ``v``（用于 ``hexin-v`` 头）。"""
    try:
        jar = client.cookies.jar
    except Exception:
        return None
    try:
        for cookie in jar:
            if getattr(cookie, "name", None) != "v":
                continue
            dom = (getattr(cookie, "domain", "") or "").lower()
            if "10jqka.com.cn" in dom or dom == "":
                val = getattr(cookie, "value", None)
                if val:
                    return str(val)
    except Exception:
        return None
    return None


class CrawlHttpClient:
    """Thin httpx wrapper with THS ``hexin-v`` / cookie support."""

    def __init__(self, cfg: CrawlerConfig) -> None:
        self._cfg = cfg
        self._client = httpx.Client(
            timeout=httpx.Timeout(cfg.request_timeout_sec),
            follow_redirects=True,
            verify=cfg.http_verify_ssl,
            headers={"User-Agent": cfg.user_agent},
        )
        self._bootstrap_done = False

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "CrawlHttpClient":
        return self

    def __exit__(self, *args) -> None:
        self.close()

    def _sleep_delay(self) -> None:
        if self._cfg.delay_ms > 0:
            time.sleep(self._cfg.delay_ms / 1000.0)

    def _ensure_ths_bootstrap(self) -> None:
        """未配置 Cookie/hexin-v 时，先访问主站首页（默认 www.10jqka.com.cn）以获取 ``v`` 等 Cookie。"""
        if self._bootstrap_done:
            return
        self._bootstrap_done = True
        if self._cfg.cookie_header or self._cfg.hexin_v:
            return
        if not self._cfg.auto_bootstrap:
            return
        url = self._cfg.ths_bootstrap_url
        self._sleep_delay()
        try:
            nav_headers = _ths_bootstrap_nav_headers(self._cfg.user_agent)
            resp = self._client.get(url, headers=nav_headers)
            resp.raise_for_status()
        except Exception as exc:
            logger.warning("同花顺 Cookie 预取失败（%s）: %s", url, exc)
            return
        v = read_ths_v_cookie_from_client(self._client)
        if v:
            logger.info("已从预取页获得同花顺 Cookie「v」，后续请求将使用该会话。")
        else:
            logger.warning(
                "预取页未返回可用的「v」Cookie（%s），成分 AJAX 仍可能失败；可手动设置 "
                "CRAWLER_THS_HEXIN_V 或 CRAWLER_THS_COOKIE。",
                url,
            )

    def _effective_hexin_v(self) -> Optional[str]:
        if self._cfg.hexin_v:
            return self._cfg.hexin_v
        return read_ths_v_cookie_from_client(self._client)

    def _headers_for_ths(self, *, referer: str, ajax: bool) -> dict:
        ua = self._cfg.user_agent
        ths_q = bool(referer and "10jqka.com.cn" in referer)
        if ajax and ths_q:
            h = _ths_constituent_ajax_nav_headers(ua)
            v = self._effective_hexin_v()
            if v:
                h["hexin-v"] = v
            return h

        h: dict = {"Referer": referer, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"}
        if ajax:
            h["X-Requested-With"] = "XMLHttpRequest"
            h["Accept"] = "text/html, */*; q=0.01"
        else:
            h["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        if ajax and "10jqka.com.cn" in (referer or ""):
            h["Origin"] = "https://q.10jqka.com.cn"
            h["Sec-Fetch-Site"] = "same-origin"
            h["Sec-Fetch-Mode"] = "cors"
            h["Sec-Fetch-Dest"] = "empty"
            if "chrome/" in (ua or "").lower():
                maj = _chrome_major_version(ua)
                h["Sec-CH-UA"] = (
                    f'"Google Chrome";v="{maj}", "Chromium";v="{maj}", "Not_A Brand";v="24"'
                )
                h["Sec-CH-UA-Mobile"] = "?0"
                h["Sec-CH-UA-Platform"] = _sec_ch_ua_platform_quoted(ua)
        v = self._effective_hexin_v()
        if v:
            h["hexin-v"] = v
        return h

    def _cookie_header_override(self) -> Optional[str]:
        """显式 Cookie 头；未配置时交给 httpx 会话 jar（预取页写入的 Cookie）。"""
        if self._cfg.cookie_header:
            return self._cfg.cookie_header
        if self._cfg.hexin_v:
            return f"v={self._cfg.hexin_v}"
        return None

    def get(self, url: str, *, referer: str, ajax: bool = False) -> str:
        self._ensure_ths_bootstrap()
        self._sleep_delay()
        headers = self._headers_for_ths(referer=referer, ajax=ajax)
        ch = self._cookie_header_override()
        if ch:
            headers["Cookie"] = ch
        resp = self._client.get(url, headers=headers)
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            code = exc.response.status_code if exc.response is not None else 0
            if ajax and code in (401, 403):
                snippet = ""
                try:
                    r401 = exc.response
                    if r401 is not None:
                        snippet = (r401.text or "")[:400].replace("\n", " ")
                except Exception:
                    pass
                if snippet:
                    logger.warning("同花顺 AJAX HTTP %s 响应片段: %s", code, snippet)
                raise CrawlAuthError(
                    f"同花顺成分接口返回 HTTP {code}（多为 WAF / 鉴权拦截）。请确认："
                    "1) 未把 CRAWLER_USER_AGENT 设为机器人串（留空则使用内置 Chrome UA）；"
                    "2) 适当增大 CRAWLER_DELAY_MS（默认 2000，可试 3000～5000）；"
                    "3) 仍失败时在浏览器复制完整 CRAWLER_THS_COOKIE 或有效的 CRAWLER_THS_HEXIN_V。"
                ) from exc
            raise
        text = _decode_response_text(resp)
        # 列表页有时可无 Cookie；成分 AJAX 几乎必校验 hexin-v / v
        if ajax and "window.location.href" in text and "chameleon" in text.lower():
            raise CrawlAuthError(
                "同花顺返回反爬跳转页：可设置 CRAWLER_THS_HEXIN_V（与浏览器 Cookie「v」一致）或 "
                "CRAWLER_THS_COOKIE；若未配置，请确认 CRAWLER_THS_AUTO_BOOTSTRAP 为 true 且能访问 "
                "CRAWLER_THS_BOOTSTRAP_URL（默认 https://www.10jqka.com.cn/）以自动获取「v」。"
            )
        return text
