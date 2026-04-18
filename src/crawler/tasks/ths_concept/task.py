# -*- coding: utf-8 -*-
"""Orchestrate 同花顺概念目录 + 成分股分页抓取."""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from src.crawler.config import CrawlerConfig, load_crawler_config
from src.crawler.contracts import CrawlContext, CrawlResult
from src.crawler.errors import CrawlAuthError
from src.crawler.http_client import CrawlHttpClient
from src.crawler.sinks import ensure_run_dir, write_jsonl, write_manifest
from src.crawler.tasks.ths_concept.models import ConstituentRow
from src.crawler.tasks.ths_concept.parsers import (
    extract_concept_refs,
    parse_constituent_rows,
    parse_max_page_from_pager,
    parse_page_info,
)
from src.crawler.tasks.ths_concept.urls import concept_detail_url, constituents_ajax_url

logger = logging.getLogger(__name__)

_HUB_CODE_RE = re.compile(r"/detail/code/(\d+)/?", re.I)


def _log_ths_concept_progress(
    *,
    total_plates: int,
    plates_done: int,
    concept_code: str,
    concept_name: str,
    detail: str,
    page: int | None = None,
    page_max: int | None = None,
    stock_est: str | None = None,
    stock_in_plate: int | None = None,
    stock_global: int | None = None,
) -> None:
    """
    人类可读的爬取进度（替代逐请求打印完整 HTTP 头）。

    - total_plates: 本次任务概念板块总数
    - plates_done: 已完全处理完的板块数（当前板块进行中时不含当前块）
    - detail: 简短说明，如「开始拉成分」「成分第 N 页」
    """
    name = (concept_name or "—").strip()[:48] or "—"
    base = (
        "同花顺概念爬取进度 板块总数=%d 已完板块=%d 当前板块=[%s] %s %s"
        % (total_plates, plates_done, concept_code, name, detail)
    )
    if page is not None:
        pm = page_max if page_max is not None else "?"
        base += " 成分页=%s/%s" % (page, pm)
    if stock_est is not None:
        base += " 本板块股票估=%s" % stock_est
    if stock_in_plate is not None:
        base += " 本板块已=%d" % stock_in_plate
    if stock_global is not None:
        base += " 全局成分已=%d" % stock_global
    logger.info(base)


def _hub_code_from_catalog_url(catalog_url: str) -> str | None:
    m = _HUB_CODE_RE.search(catalog_url)
    return m.group(1) if m else None


def _exclude_codes() -> Set[str]:
    raw = (os.getenv("CRAWLER_THS_EXCLUDE_CONCEPT_CODES") or "").strip()
    if not raw:
        return set()
    return {x.strip() for x in raw.split(",") if x.strip()}


def _maybe_persist_ths_concept_crawl(
    cfg: CrawlerConfig,
    ctx: CrawlContext,
    run_dir: Path,
    *,
    catalog_url: str,
    dry_run: bool,
    ok: bool,
    message: str,
    stats: Dict[str, Any],
    errors: List[str],
    concepts: List[Dict[str, Any]],
    constituents: Optional[List[Dict[str, Any]]] = None,
) -> None:
    if not cfg.persist_db:
        return
    try:
        from src.storage import DatabaseManager

        DatabaseManager.get_instance().save_ths_concept_crawl(
            run_id=ctx.run_id,
            task_id="ths-concept",
            catalog_url=catalog_url,
            dry_run=dry_run,
            ok=ok,
            message=message,
            stats=stats,
            errors=errors,
            output_path=str(run_dir),
            concepts=concepts,
            constituents=constituents,
        )
    except Exception:
        logger.exception("同花顺概念爬虫结果写入数据库失败（磁盘 jsonl/manifest 仍以任务结果为准）")


def run_ths_concept_crawl(
    ctx: CrawlContext,
    cfg: CrawlerConfig | None = None,
) -> CrawlResult:
    cfg = cfg or load_crawler_config()
    errors: List[str] = []
    stats: Dict[str, Any] = {
        "concepts_seen": 0,
        "concepts_crawled": 0,
        "constituent_rows": 0,
        "ajax_pages": 0,
    }

    run_dir = ensure_run_dir(ctx.output_dir, ctx.run_id)
    concepts_payload: List[Dict[str, Any]] = []
    all_rows: List[Dict[str, Any]] = []
    hub = _hub_code_from_catalog_url(cfg.catalog_url)
    exclude = _exclude_codes()
    if hub and (os.getenv("CRAWLER_THS_EXCLUDE_CATALOG_HUB", "true").strip().lower() not in {"0", "false", "no"}):
        exclude.add(hub)

    try:
        with CrawlHttpClient(cfg) as http:
            logger.info("抓取概念目录: %s", cfg.catalog_url)
            catalog_html = http.get(cfg.catalog_url, referer=cfg.catalog_url, ajax=False)
            if cfg.save_raw_html:
                (run_dir / "raw_catalog.html").write_text(catalog_html, encoding="utf-8", errors="replace")

            refs = extract_concept_refs(catalog_html, catalog_url=cfg.catalog_url)
            concepts_payload = []
            for code, name, detail in refs:
                if code in exclude:
                    continue
                concepts_payload.append(
                    {
                        "concept_code": code,
                        "concept_name": name,
                        "detail_url": detail.rstrip("/") + "/",
                        "crawled_at": datetime.now(timezone.utc).isoformat(),
                    }
                )
            stats["concepts_seen"] = len(concepts_payload)

            if cfg.max_concepts is not None:
                concepts_payload = concepts_payload[: max(0, cfg.max_concepts)]

            if not concepts_payload and "chameleon" in catalog_html.lower():
                msg = (
                    "目录页疑似反爬跳转（chameleon），未解析到概念链接。"
                    "请配置 CRAWLER_THS_HEXIN_V（与 Cookie「v」一致）或 CRAWLER_THS_COOKIE 后重试。"
                )
                write_manifest(run_dir / "manifest.json", {"error": msg, "stats": stats})
                _maybe_persist_ths_concept_crawl(
                    cfg,
                    ctx,
                    run_dir,
                    catalog_url=cfg.catalog_url,
                    dry_run=ctx.dry_run,
                    ok=False,
                    message=msg,
                    stats=stats,
                    errors=[msg],
                    concepts=[],
                    constituents=None,
                )
                return CrawlResult(
                    task_id="ths-concept",
                    ok=False,
                    message=msg,
                    output_dir=run_dir,
                    stats=stats,
                    errors=[msg],
                )

            if ctx.dry_run:
                write_manifest(
                    run_dir / "manifest.json",
                    {"dry_run": True, "stats": stats, "sample_concepts": concepts_payload[:20]},
                )
                _maybe_persist_ths_concept_crawl(
                    cfg,
                    ctx,
                    run_dir,
                    catalog_url=cfg.catalog_url,
                    dry_run=True,
                    ok=True,
                    message="dry-run：仅解析目录，未请求成分 AJAX",
                    stats=stats,
                    errors=[],
                    concepts=list(concepts_payload),
                    constituents=None,
                )
                return CrawlResult(
                    task_id="ths-concept",
                    ok=True,
                    message="dry-run：仅解析目录，未请求成分 AJAX",
                    output_dir=run_dir,
                    stats=stats,
                    errors=[],
                )

            write_jsonl(run_dir / "concepts.jsonl", concepts_payload)

            all_rows: List[Dict[str, Any]] = []
            total_plates = len(concepts_payload)
            for item in concepts_payload:
                code = item["concept_code"]
                cname = (item.get("concept_name") or "").strip() or "—"
                referer = concept_detail_url(code)
                _log_ths_concept_progress(
                    total_plates=total_plates,
                    plates_done=stats["concepts_crawled"],
                    concept_code=code,
                    concept_name=cname,
                    detail="开始" + ("（预检详情页）" if cfg.preflight_detail else ""),
                    stock_global=len(all_rows),
                )
                if cfg.preflight_detail:
                    try:
                        http.get(referer, referer=referer, ajax=False)
                    except Exception as exc:
                        logger.warning("概念 %s 详情页预检失败，仍尝试 AJAX: %s", code, exc)
                page = 1
                total_pages: int | None = None

                while True:
                    if cfg.max_pages_per_concept is not None and page > cfg.max_pages_per_concept:
                        break
                    ajax_url = constituents_ajax_url(
                        field=cfg.ths_field, order=cfg.ths_order, page=page, concept_code=code
                    )
                    try:
                        frag = http.get(ajax_url, referer=referer, ajax=True)
                    except CrawlAuthError as exc:
                        err = f"{code} p{page}: {exc}"
                        errors.append(err)
                        logger.error("%s", err)
                        break
                    except Exception as exc:  # pragma: no cover - network
                        errors.append(f"{code} p{page}: {exc}")
                        logger.warning("%s", errors[-1])
                        break

                    stats["ajax_pages"] += 1
                    if cfg.save_raw_html:
                        (run_dir / "raw" / f"{code}_p{page}.html").parent.mkdir(parents=True, exist_ok=True)
                        (run_dir / "raw" / f"{code}_p{page}.html").write_text(
                            frag, encoding="utf-8", errors="replace"
                        )

                    pi = parse_page_info(frag)
                    if pi:
                        _, total_pages = pi
                    elif total_pages is None:
                        total_pages = parse_max_page_from_pager(frag)

                    parsed = parse_constituent_rows(frag, concept_code=code, page=page)
                    if not parsed and page == 1:
                        logger.warning("概念 %s 第 1 页无成分数据（可能字段/权限变化）", code)

                    for stock_code, stock_name, ridx in parsed:
                        row = ConstituentRow(
                            concept_code=code,
                            stock_code=stock_code,
                            stock_name=stock_name,
                            page=page,
                            row_index=ridx,
                        )
                        all_rows.append(
                            {
                                "concept_code": row.concept_code,
                                "stock_code": row.stock_code,
                                "stock_name": row.stock_name,
                                "page": row.page,
                                "row_index": row.row_index,
                                "crawled_at": datetime.now(timezone.utc).isoformat(),
                            }
                        )

                    n_page = len(parsed)
                    in_plate = sum(1 for r in all_rows if r.get("concept_code") == code)
                    tp = total_pages
                    if tp is not None and n_page > 0:
                        est = str(tp * n_page)
                    elif n_page == 0:
                        est = "本页0条"
                    else:
                        est = "未知(总页数未解析)"
                    _log_ths_concept_progress(
                        total_plates=total_plates,
                        plates_done=stats["concepts_crawled"],
                        concept_code=code,
                        concept_name=cname,
                        detail="成分数据",
                        page=page,
                        page_max=tp,
                        stock_est=est,
                        stock_in_plate=in_plate,
                        stock_global=len(all_rows),
                    )

                    if page >= (total_pages or 1):
                        break
                    page += 1

                stats["concepts_crawled"] += 1

            stats["constituent_rows"] = len(all_rows)
            write_jsonl(run_dir / "constituents.jsonl", all_rows)

            write_manifest(
                run_dir / "manifest.json",
                {
                    "task": "ths-concept",
                    "catalog_url": cfg.catalog_url,
                    "field": cfg.ths_field,
                    "order": cfg.ths_order,
                    "stats": stats,
                    "errors": errors,
                },
            )

            _maybe_persist_ths_concept_crawl(
                cfg,
                ctx,
                run_dir,
                catalog_url=cfg.catalog_url,
                dry_run=False,
                ok=len(errors) == 0,
                message="完成" if not errors else "部分概念失败，见 errors",
                stats=stats,
                errors=errors,
                concepts=list(concepts_payload),
                constituents=list(all_rows),
            )

            return CrawlResult(
                task_id="ths-concept",
                ok=len(errors) == 0,
                message="完成" if not errors else "部分概念失败，见 errors",
                output_dir=run_dir,
                stats=stats,
                errors=errors,
            )
    except Exception as exc:
        logger.exception("ths-concept 抓取失败")
        _maybe_persist_ths_concept_crawl(
            cfg,
            ctx,
            run_dir,
            catalog_url=cfg.catalog_url,
            dry_run=ctx.dry_run,
            ok=False,
            message=str(exc),
            stats=stats,
            errors=errors + [str(exc)],
            concepts=list(concepts_payload),
            constituents=list(all_rows) if all_rows else None,
        )
        return CrawlResult(
            task_id="ths-concept",
            ok=False,
            message=str(exc),
            output_dir=run_dir,
            stats=stats,
            errors=errors + [str(exc)],
        )
