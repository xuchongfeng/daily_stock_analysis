# -*- coding: utf-8 -*-
"""管理端运营指标聚合响应。"""

from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class BusinessMetricsResponse(BaseModel):
    """服务器本地日历日的业务向汇总（详见 docs/business-metrics.md）。"""

    calendar_date: str = Field(..., description="统计日 YYYY-MM-DD（服务器本地时区）")
    page_views_today: int = Field(..., description="页面浏览次数（前端上报）")
    unique_visitors_today: int = Field(..., description="独立访客（当日上报中去重 visitor_id）")
    portal_registrations_today: int = Field(..., description="当日新注册门户账号数")
    portal_users_total: int = Field(..., description="门户注册用户总数")
    agent_chat_user_messages_today: int = Field(..., description="Agent 对话中用户发送消息条数（问股轮次近似）")
    portal_analysis_records_today: int = Field(..., description="当日写入且归属门户用户的分析历史条数")
    user_feedback_submissions_today: int = Field(..., description="当日用户反馈提交条数")


class BusinessMetricsDailyRow(BaseModel):
    """单个日历日的运营指标（与当日卡片口径一致）。"""

    calendar_date: str = Field(..., description="YYYY-MM-DD")
    page_views: int = Field(..., description="PV")
    unique_visitors: int = Field(..., description="UV（visitor_id 去重）")
    portal_registrations: int = Field(..., description="门户新注册")
    agent_chat_user_messages: int = Field(..., description="问股用户消息条数")
    portal_analysis_records: int = Field(..., description="门户归属分析记录新增")
    user_feedback_submissions: int = Field(..., description="用户反馈条数")


class BusinessMetricsDailySeriesResponse(BaseModel):
    """按自然日排列的时间序列（缺日补 0）。"""

    start_date: str = Field(..., description="区间起始日 YYYY-MM-DD（含）")
    end_date: str = Field(..., description="区间结束日 YYYY-MM-DD（含）")
    days: int = Field(..., description="自然日个数（与 series 长度一致）")
    series: List[BusinessMetricsDailyRow] = Field(default_factory=list)
