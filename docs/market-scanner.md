# A 股榜单扫描（Market scanner）

统一模块：**涨幅榜**（按涨跌幅排序）与 **成交量榜**（按成交量排序，默认 Top 1000，共用 `TOP_MOVERS_*` 配置）。流水线、历史写入与通知逻辑一致，仅股票池与 `batch_kind` / 批次号前缀不同。

## 功能说明

### 涨幅榜（`scan_kind=gainers`，`batch_kind=top_movers_daily`，批次号 `tm_YYYYMMDD_*`）

- **股票池数据源（自动）**
  - 若已配置 **`TUSHARE_TOKEN`** 且 Tushare 可用：优先使用 Tushare Pro **`daily`**，按 **`trade_date`** 拉全市场 **`pct_chg`**（EOD）。未指定 `--market-scan-date` 时，交易日取 `get_effective_trading_date('cn')`。
  - **不推荐**用 [`daily_basic`](https://tushare.pro/document/2?doc_id=32) 做涨幅榜：该接口无涨跌幅字段。
  - 若 Tushare 不可用或失败：未指定日期时可回退 AkShare 东财 **`stock_zh_a_spot_em`** 快照；**指定了日期**时若 Tushare 失败则不再回退东财。
- 对排序结果取前 **N** 只（默认 1000，上限 1000）。

### 成交量榜（`scan_kind=volume`，`batch_kind=top_volume_daily`，批次号 `tv_YYYYMMDD_*`）

- **排序规则（核心）**：先按**成交额**全市场降序，再取前 **N**（默认 1000）；**成交额相同**时按**成交量**降序。Tushare 为 `daily.amount`（千元）+ `vol`（手）；东财为「成交额」+「成交量」。
- **实现说明**：Tushare `daily` 按交易日全市场拉取时，接口单次最多约 **6000 行**；代码侧已用 `limit/offset` **分页拼齐全市场**后再按 `vol`（及次要 `amount`）排序取 Top N，避免只在「首屏 6000 行」内排序导致榜单失真。
- 历史记录额外写入 **`ref_trade_volume`**（单位与数据源一致）；**`ref_change_pct`** 仍保留当日涨跌幅（若有）。
- 批量任务日志中的「成交额(亿)」：Tushare 由 `daily.amount`（千元）换算；东财快照「成交额」列按**元**换算。若与行情软件不一致，先核对数据源口径。

### 共用

- 对股票池执行与自选相同的 AI 分析流水线，结果写入 `analysis_history`（`batch_run_id`、`rank_in_batch` 等）。
- 可选与 `STOCK_LIST` 去重（`TOP_MOVERS_DEDUPE_WATCHLIST`）、排除 ST（`TOP_MOVERS_EXCLUDE_ST`）。

## 运行方式

```bash
python main.py --market-scan gainers
python main.py --market-scan volume
python main.py --top-movers                    # 等价 --market-scan gainers
python main.py --market-scan gainers --dry-run
python main.py --market-scan volume --top-movers-limit 50 --no-notify --force-run
python main.py --market-scan gainers --market-scan-date 2026-04-03
# --top-movers-date 与 --market-scan-date 为同一参数（别名）
```

CLI 会**忽略** `TOP_MOVERS_ENABLED`；该开关主要用于 GitHub Actions 等编排前的显式启用。

### 排查：成交量 Top N「看起来不对」

1. **与自选股去重**：默认 `TOP_MOVERS_DEDUPE_WATCHLIST=true` 会剔除已在 `STOCK_LIST` 中的代码，最终数量可能 **少于 `TOP_MOVERS_LIMIT`**。需要完整 N 只在 `.env` 中设为 `false` 或临时清空自选股。
2. **数据源**：有 `TUSHARE_TOKEN` 时走 Tushare 日线 EOD；无 Token 时走东财 **盘中/快照**「成交量」，与收盘口径可能不一致，排序也会与 Tushare 不完全相同。
3. **日志**：运行后搜索 `[成交量榜][Tushare] daily 全市场行数=`，应对应为当日有行情的股票数量级（通常五千余）；若明显只有 6000 且未分页，请升级至已含分页拼表的版本。

**建议验证命令（只拉股票池、不跑 AI）：**

```bash
python main.py --market-scan volume --dry-run --force-run --top-movers-limit 1000
# 指定交易日（需为 A 股交易日，且 Tushare 有该日 daily）
python main.py --market-scan volume --dry-run --force-run --top-movers-limit 1000 --market-scan-date 2026-04-03
```

日志中会出现 `[成交量榜] 使用 Tushare daily` 或东财回退说明；`dry-run` 仅获取数据与股票池，不调用 LLM。

### 日志：为何出现「请求窗口=某日~某日」而不是单日？

批量分析每一只股票时，流水线会调用 **单股日线** `get_daily_data`（默认约 30 个交易日，按日历日回推 `days*2` 作为请求起止），用于均线等指标；日志里的 `请求窗口=开始~结束` 指的是 **这根 K 线请求**，**不是** `--market-scan-date` 的榜单交易日。榜单日期只决定 `tv_YYYYMMDD_*` / `tm_YYYYMMDD_*` 批次号与 Tushare `daily` 全市场拉取所用的 `trade_date`。

### 前端「成交量榜」筛不到批次？

列表与明细 API 原先用 `batch_kind IN (...)` 过滤；若历史行里 **`batch_kind` 为空**（旧库或未写入），即使用 `tv_*` 批次号也会被排除。当前实现会在 `batch_kind` 为空时根据 **`batch_run_id` 前缀 `tv_`/`tm_`** 兼容识别。若仍无数据，请先运行至少一次 `python main.py --market-scan volume` 写入 `analysis_history`。

## 配置项

见根目录 `.env.example` 中 `TOP_MOVERS_*` 段与 Web 设置 **榜单扫描**（`market_scan`）分类。

## API

主路径 **`/api/v1/market-scanner`**（`/api/v1/top-movers` 为兼容别名，行为相同）。

- `GET .../batches?limit=30` — 最近批次列表  
- `GET .../batches?scan_kind=all|gainers|volume` — 按榜单类型筛选  
- `GET .../batches?batch_date=2026-04-05` — 按日期段：`tm_*` 与 `tv_*` 均可匹配（与 `scan_kind` 组合）  
- `GET .../batches/{batch_run_id}/items?sort_by=...`  
  - `sort_by`: `sentiment_score` | `rank_in_batch` | `created_at` | `ref_change_pct` | `ref_trade_volume`
- `POST .../batches/{batch_run_id}/resume?dry_run=false&send_notification=true` — **续跑**：按批次内交易日与榜单类型重建股票池，**排除**该 `batch_run_id` 已在 `analysis_history` 落库的代码，对其余标的继续分析并仍写入同一批次；`dry_run=true` 时只拉数据不跑 LLM。Web「榜单扫描」页提供「重跑（补全未完成）」按钮。
- `POST .../batches/{batch_run_id}/notify` — **手动推送通知**：从 `analysis_history` 读取该批次已落库记录，按 **AI 评分（sentiment_score）降序** 取前 `top_n` 条（请求体 JSON：`top_n` 默认 15、上限 200；`detail_level`：`summary` 仅列表行，`detailed` 每只股票下附带 `analysis_summary` 摘要，单股摘要过长会截断）。与跑批结束时的自动汇总不同：**不依赖** `TOP_MOVERS_NOTIFY_ENABLED`，但仍需已配置至少一种通知渠道。Web「榜单扫描」页提供「推送条数」「通知内容」「发送通知」控件。

续跑使用**当前** `TOP_MOVERS_LIMIT`、去重与排除 ST 等配置重建池子，若与首次跑批时不一致，待补全集合可能与当时略有差异。

## GitHub Actions

工作流「每日股票分析」手动模式可选 **`top-movers`**（涨幅）或 **`top-volume`**（成交量）；均需 `TOP_MOVERS_ENABLED=true`。可选输入 **榜单扫描日期** 对应 `--market-scan-date` / `--top-movers-date`。

## 合规

输出与通知中仍应遵循项目统一的「仅供参考，不构成投资建议」提示。
