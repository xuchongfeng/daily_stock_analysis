# -*- coding: utf-8 -*-
"""信号摘要重算完成后的可选多渠道推送（Markdown）。"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


def format_signal_digest_push_markdown(payload: Dict[str, Any]) -> str:
    """将 signal_digest 聚合结果格式化为推送正文。"""
    window = payload.get("window") or {}
    anchor = window.get("anchor_date") or ""
    picks: List[Dict[str, Any]] = list(payload.get("picks") or [])
    lines = [
        "# 信号摘要已更新",
        "",
        f"锚定交易日：**{anchor}**",
        f"入选标的：**{len(picks)}** 只（当前筛选条件下）",
        "",
    ]
    for i, p in enumerate(picks[:20], 1):
        code = str(p.get("code") or "").strip()
        name = str(p.get("name") or code).strip()
        score = p.get("score")
        advice = str(p.get("operation_advice") or "").strip()
        adv_suffix = f" · {advice}" if advice else ""
        lines.append(f"{i}. **{name}** ({code}) · 分 {score}{adv_suffix}")
    if len(picks) > 20:
        lines.append("")
        lines.append(f"*… 另有 {len(picks) - 20} 只未列出，请在「信号摘要」页查看全文。*")

    narrative = (payload.get("narrative_markdown") or "").strip()
    if narrative:
        cap = 3500
        if len(narrative) > cap:
            narrative = narrative[:cap].rstrip() + "\n\n…（叙事已截断）"
        lines.extend(["", "---", "", "### AI 解读摘录", "", narrative])

    lines.extend(["", "", "*仅供参考，不构成投资建议。*"])
    return "\n".join(lines)


def send_signal_digest_refresh_notification(payload: Dict[str, Any]) -> bool:
    """
    向已配置的 Webhook/邮件等渠道发送信号摘要简报。

    Returns:
        是否至少有一个渠道投递成功（无渠道配置时为 False）。
    """
    from src.notification import NotificationService

    content = format_signal_digest_push_markdown(payload)
    notifier = NotificationService()
    if not notifier.is_available():
        logger.warning("signal_digest 推送跳过：未检测到可用通知渠道（请配置 Webhook 等）")
        return False
    ok = notifier.send(content, email_send_to_all=True)
    if ok:
        logger.info("signal_digest 重算后推送已发送")
    else:
        logger.warning("signal_digest 重算后推送未完成（请检查渠道日志与 FEISHU_WEBHOOK_URL / CUSTOM_WEBHOOK_URLS 等）")
    return bool(ok)
