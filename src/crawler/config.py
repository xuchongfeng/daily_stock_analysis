# -*- coding: utf-8 -*-
"""Crawler-related environment configuration (no secrets in code defaults)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# 默认同花顺行情站 WAF 易拦截 ``compatible; bot`` 类 UA；未设置 CRAWLER_USER_AGENT 时使用常见桌面 Chrome（与 Sec-CH-UA-Platform 一致见 http_client）。
_DEFAULT_BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/146.0.0.0 Safari/537.36"
)
# 同花顺等站点对过密请求敏感；未设置 CRAWLER_DELAY_MS 时默认 2s/次。
_DEFAULT_CRAWLER_DELAY_MS = 2000


def _env_int(name: str, default: Optional[int]) -> Optional[int]:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    v = str(raw).strip().lower()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        v = v[1:-1].strip().lower()
    if not v:
        return default
    return v not in {"0", "false", "no", "off"}


@dataclass(frozen=True)
class CrawlerConfig:
    output_dir: Path
    delay_ms: int
    catalog_url: str
    ths_field: str
    ths_order: str
    hexin_v: Optional[str]
    cookie_header: Optional[str]
    user_agent: str
    max_concepts: Optional[int]
    max_pages_per_concept: Optional[int]
    save_raw_html: bool
    request_timeout_sec: float
    persist_db: bool
    ths_bootstrap_url: str
    auto_bootstrap: bool
    preflight_detail: bool
    http_verify_ssl: bool
    # 成分 AJAX 遇 HTTP 401/403 或 chameleon 时的额外重试次数（不含首次）；第 n 次重试前休眠 10*n 秒。
    ths_auth_max_retries: int


def load_crawler_config(
    *,
    output_dir_override: Optional[Path] = None,
    max_concepts_override: Optional[int] = None,
    max_pages_override: Optional[int] = None,
) -> CrawlerConfig:
    root = Path(__file__).resolve().parents[2]
    default_out = root / "data" / "crawler"
    out_raw = (os.getenv("CRAWLER_OUTPUT_DIR") or "").strip()
    output_dir = Path(output_dir_override or (out_raw or str(default_out))).expanduser()

    delay_ms = max(0, _env_int("CRAWLER_DELAY_MS", _DEFAULT_CRAWLER_DELAY_MS) or 0)

    catalog = (os.getenv("CRAWLER_THS_CATALOG_URL") or "").strip() or (
        "https://q.10jqka.com.cn/gn/detail/code/308718/"
    )
    field = (os.getenv("CRAWLER_THS_FIELD") or "").strip() or "199112"
    order = (os.getenv("CRAWLER_THS_ORDER") or "").strip() or "desc"

    hexin_v = (os.getenv("CRAWLER_THS_HEXIN_V") or "").strip() or None
    cookie_header = (os.getenv("CRAWLER_THS_COOKIE") or "").strip() or None

    ua = (os.getenv("CRAWLER_USER_AGENT") or "").strip() or _DEFAULT_BROWSER_UA

    max_concepts = max_concepts_override if max_concepts_override is not None else _env_int(
        "CRAWLER_THS_MAX_CONCEPTS", None
    )
    max_pages = max_pages_override if max_pages_override is not None else _env_int(
        "CRAWLER_THS_MAX_PAGES", None
    )

    save_raw = _env_bool("CRAWLER_SAVE_RAW_HTML", False)
    timeout = float((os.getenv("CRAWLER_REQUEST_TIMEOUT_SEC") or "30").strip() or "30")
    persist_db = _env_bool("CRAWLER_THS_PERSIST_DB", True)
    bootstrap_url = (os.getenv("CRAWLER_THS_BOOTSTRAP_URL") or "").strip() or (
        "https://www.10jqka.com.cn/"
    )
    auto_bootstrap = _env_bool("CRAWLER_THS_AUTO_BOOTSTRAP", True)
    preflight_detail = _env_bool("CRAWLER_THS_PREFLIGHT_DETAIL", True)
    http_verify_ssl = _env_bool("CRAWLER_HTTP_VERIFY_SSL", True)
    _auth_retries = _env_int("CRAWLER_THS_AUTH_MAX_RETRIES", 3)
    if _auth_retries is None:
        ths_auth_max_retries = 3
    else:
        ths_auth_max_retries = max(0, min(30, int(_auth_retries)))

    return CrawlerConfig(
        output_dir=output_dir,
        delay_ms=delay_ms,
        catalog_url=catalog,
        ths_field=field,
        ths_order=order,
        hexin_v=hexin_v,
        cookie_header=cookie_header,
        user_agent=ua,
        max_concepts=max_concepts,
        max_pages_per_concept=max_pages,
        save_raw_html=save_raw,
        request_timeout_sec=timeout,
        persist_db=persist_db,
        ths_bootstrap_url=bootstrap_url,
        auto_bootstrap=auto_bootstrap,
        preflight_detail=preflight_detail,
        http_verify_ssl=http_verify_ssl,
        ths_auth_max_retries=ths_auth_max_retries,
    )
