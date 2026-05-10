# 业务运营指标说明

本文说明当前系统**已在代码中落地的汇总指标**、统计口径，以及**还可以扩展统计的业务维度**（便于产品与运营规划）。

## 一、管理端「运营指标」页 / API

- **页面路径（管理端 SPA）**：`/admin/business-metrics`（侧栏在「用户反馈」之后、「设置」之前；条目较多时需滚动侧栏）
- **接口**：`GET /api/v1/system/business-metrics`  
  - 开启 `ADMIN_AUTH_ENABLED` 时需要**管理员会话**；关闭门禁时接口仍可调用（与设置页等行为一致）。
- **按日序列（图表）**：`GET /api/v1/system/business-metrics/daily?days=30`  
  - 查询参数：`days`，范围 1–90，默认 30；返回从「今天」往回共 `days` 个自然日的序列，**缺日补 0**。  
  - 字段与下表「按日」口径一致（`page_views`、`unique_visitors`、`portal_registrations` 等）；**不含**累计字段 `portal_users_total`（累计仅当日卡片展示）。
- **统计日**：服务器**本地时区**的自然日 00:00–24:00。

### 已汇总字段（当日）

| 字段 | 含义 | 数据来源 | 口径说明 |
|------|------|----------|----------|
| `page_views_today` | PV | `page_view_events` | 前端在路由变化时调用 `POST /api/v1/public/analytics/page-view` 上报；同一用户多次打开、刷新会计多条。 |
| `unique_visitors_today` | UV | `page_view_events` | 按 Cookie `dsa_visitor_id`（HttpOnly）在当日内去重。清除 Cookie、换浏览器、隐私模式会导致 UV 偏高。 |
| `portal_registrations_today` | 今日新注册 | `portal_users.created_at` | C 端邮箱注册成功写入的一条记录。 |
| `portal_users_total` | 门户用户总数 | `portal_users` 全表计数 | 累计注册用户数。 |
| `agent_chat_user_messages_today` | 问股（用户发言） | `conversation_messages` 且 `role=user` | **近似**「用户发起的问答次数」：每条用户消息计 1；一轮多句对话会大于「会话数」。管理端问股与 C 端问股共用 Agent 时都会写入该表。 |
| `portal_analysis_records_today` | 门户分析记录（今日） | `analysis_history` 且 `portal_user_id` 非空 | 当日新建的、归属门户用户的分析报告条数（含工作台触发等）。 |
| `user_feedback_submissions_today` | 用户反馈（今日） | `user_feedback.created_at` | C 端等手段提交的反馈条数。 |

### PV/UV 埋点说明

- **管理端**：`apps/dsa-web` 在路由变化时自动上报，`surface=admin`。
- **C 端**：`apps/dsa-user` 在路由变化时自动上报，`surface=portal`。
- 公开接口路径：`POST /api/v1/public/analytics/page-view`（在开启 API 门禁时仍**豁免**，否则未登录用户无法计入 PV）。
- 前端对**相同 path**在约 **2.5 秒**内做了节流，减轻 React Strict Mode 双调用带来的重复上报。

---

## 二、还可扩展的业务指标（尚未全部接入「运营指标」页）

以下数据在仓库中**已有表或可推导**，可按需增加「按日聚合」或接入 BI：

### 用户与账户

- **门户**：按套餐档位（`plan_tier`）用户数、升级意向订单（`portal_plan_upgrade_requests`）数量与状态分布。
- **持仓**：`portfolio_accounts` / 流水笔数、当日导入次数等（偏重度用户行为）。
- **自选**：`watchlist` 相关接口调用或持久化变更次数（若有审计需求需额外埋点）。

### 分析与问股

- **全站分析次数**（不限门户）：`analysis_history` 当日插入总数（当前汇总仅「门户归属」子集）。
- **榜单/批量任务**：`analysis_history.batch_kind` / `batch_run_id` 维度统计扫描任务量。
- **Agent 会话数**：对 `conversation_messages` 按 `session_id` 去重计数（比「用户消息条数」更接近「会话次数」）。
- **LLM 用量**：`llm_usage` 按 `call_type`（analysis / agent / market_review）与日聚合 token 与调用次数。

### 内容与互动

- **信号摘要/复盘**：`signal_digest_snapshots` 或相关表的生成、读取频率（若需 PV 以外维度可打点后聚合）。
- **发现 / 热点事件**：详情访问可在前端增加与 PV 类似的上报，或解析访问日志。
- **回测**：`backtest` 运行次数、参与代码数（已有 API 与存储时可聚合）。
- **概念板块**：列表/成分接口调用量（当前无独立审计表，需日志或网关指标）。

### 流量与质量（通常建议基建层）

- **真实全站 PV/UV**：除应用内埋点外，可在 **Nginx / CDN / 可观测平台** 按路径统计，与应用内 PV 互为补充。
- **错误率、延迟、429**：网关与应用日志，用于稳定性而不仅是业务漏斗。

---

## 三、隐私与合规提示

- UV 依赖一方 Cookie，请在面向用户的隐私政策中说明用途（统计分析、区分独立访客）。
- 不建议在未经脱敏的情况下把原始 IP 写入业务库作为默认 UV 方案；当前实现以匿名 `dsa_visitor_id` 为主。

---

## 四、相关代码位置（维护参考）

| 模块 | 路径 |
|------|------|
| 页面浏览模型与聚合 | `src/storage.py`：`PageViewEvent`、`insert_page_view`、`get_business_metrics_snapshot` |
| 公开埋点 API | `api/v1/endpoints/analytics_public.py` |
| 运营汇总 API | `api/v1/endpoints/business_metrics.py` |
| 门禁豁免 | `api/middlewares/auth.py`：`/api/v1/public/analytics/page-view` |
| 管理端上报 | `apps/dsa-web/src/utils/analytics.ts`、`App.tsx` |
| C 端上报 | `apps/dsa-user/src/utils/analytics.ts`、`App.tsx` |
| 管理端展示页 | `apps/dsa-web/src/pages/BusinessMetricsPage.tsx` |
| 按日聚合实现 | `src/storage.py`：`get_business_metrics_daily_series` |
| 按日序列 API | `api/v1/endpoints/business_metrics.py`：`GET .../business-metrics/daily` |
