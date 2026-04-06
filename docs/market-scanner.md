# A 股榜单扫描（Market scanner）

统一模块：**涨幅榜**（按涨跌幅排序）与 **成交量榜**（按成交量排序，默认 Top 200，共用 `TOP_MOVERS_*` 配置）。流水线、历史写入与通知逻辑一致，仅股票池与 `batch_kind` / 批次号前缀不同。

## 功能说明

### 涨幅榜（`scan_kind=gainers`，`batch_kind=top_movers_daily`，批次号 `tm_YYYYMMDD_*`）

- **股票池数据源（自动）**
  - 若已配置 **`TUSHARE_TOKEN`** 且 Tushare 可用：优先使用 Tushare Pro **`daily`**，按 **`trade_date`** 拉全市场 **`pct_chg`**（EOD）。未指定 `--market-scan-date` 时，交易日取 `get_effective_trading_date('cn')`。
  - **不推荐**用 [`daily_basic`](https://tushare.pro/document/2?doc_id=32) 做涨幅榜：该接口无涨跌幅字段。
  - 若 Tushare 不可用或失败：未指定日期时可回退 AkShare 东财 **`stock_zh_a_spot_em`** 快照；**指定了日期**时若 Tushare 失败则不再回退东财。
- 对排序结果取前 **N** 只（默认 200，上限 500）。

### 成交量榜（`scan_kind=volume`，`batch_kind=top_volume_daily`，批次号 `tv_YYYYMMDD_*`）

- Tushare：**`daily.vol`**（手）降序；东财全表：**「成交量」**列降序（可与成交额次要排序）。
- 历史记录额外写入 **`ref_trade_volume`**（单位与数据源一致）；**`ref_change_pct`** 仍保留当日涨跌幅（若有）。

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

## 配置项

见根目录 `.env.example` 中 `TOP_MOVERS_*` 段与 Web 设置 **榜单扫描**（`market_scan`）分类。

## API

主路径 **`/api/v1/market-scanner`**（`/api/v1/top-movers` 为兼容别名，行为相同）。

- `GET .../batches?limit=30` — 最近批次列表  
- `GET .../batches?scan_kind=all|gainers|volume` — 按榜单类型筛选  
- `GET .../batches?batch_date=2026-04-05` — 按日期段：`tm_*` 与 `tv_*` 均可匹配（与 `scan_kind` 组合）  
- `GET .../batches/{batch_run_id}/items?sort_by=...`  
  - `sort_by`: `sentiment_score` | `rank_in_batch` | `created_at` | `ref_change_pct` | `ref_trade_volume`

## GitHub Actions

工作流「每日股票分析」手动模式可选 **`top-movers`**（涨幅）或 **`top-volume`**（成交量）；均需 `TOP_MOVERS_ENABLED=true`。可选输入 **榜单扫描日期** 对应 `--market-scan-date` / `--top-movers-date`。

## 合规

输出与通知中仍应遵循项目统一的「仅供参考，不构成投资建议」提示。
