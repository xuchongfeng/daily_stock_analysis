# 爬虫模块（`src/crawler`）

本模块用于**主动抓取网页**（与 `data_provider` 的 API/SDK 拉取分离），默认**不随主流程运行**。首期任务为**同花顺（10jqka）概念板块目录 + 各概念成分股分页**。

## 合规与风险

- 同花顺页面受服务条款、反爬与 `hexin-v` 校验约束；请仅用于**你有权访问的数据**，并自行承担合规责任。
- 默认带请求间隔（`CRAWLER_DELAY_MS`，**未配置时默认 2000 ms**，即约 2 秒一次 HTTP），避免过高并发触发 WAF。

## 同花顺概念（`ths-concept`）

### 数据来源

1. **概念目录（HTML）**  
   默认 `CRAWLER_THS_CATALOG_URL`：`https://q.10jqka.com.cn/gn/detail/code/308718/`  
   页面内链接 `/gn/detail/code/{code}/` 被解析为子概念列表。

2. **成分股（AJAX HTML 片段）**  
   `GET https://q.10jqka.com.cn/gn/detail/field/{field}/order/{order}/page/{n}/ajax/1/code/{concept_code}`  
   需 **`hexin-v`**（与 Cookie **`v`** 通常一致）及有效会话 Cookie；请求头对齐 **在地址栏直接打开该 URL 的 Chrome 顶层导航**（`Sec-Fetch-Dest: document`、`Mode: navigate`、`Sec-Fetch-Site: none`），**不**再伪装为 `XMLHttpRequest` + `cors`（易被 WAF 判 401/403）。可选预检：拉成分前 **`GET`** 该概念详情页（`CRAWLER_THS_PREFLIGHT_DETAIL`）以写入会话 Cookie。

### Cookie / hexin-v 获取方式

- **默认（推荐先试）**：未设置 `CRAWLER_THS_HEXIN_V` 与 `CRAWLER_THS_COOKIE` 时，首次请求前会自动 **GET** **`CRAWLER_THS_BOOTSTRAP_URL`**（默认 [同花顺主站首页](https://www.10jqka.com.cn/)，使用与浏览器一致的导航类请求头、`Referer: https://q.10jqka.com.cn/`），由响应 `Set-Cookie` 写入会话，并从中读取 **`v`** 作为 `hexin-v` 与后续请求的 Cookie。若站点策略变化导致预取无 `v` 或 AJAX 仍被拦截，再用手动配置兜底。
- **手动**：浏览器开发者工具复制 Cookie `v` → `CRAWLER_THS_HEXIN_V`，或整段 `CRAWLER_THS_COOKIE`。

### Web 系统设置

在 Web **系统设置** 中新增 **「网页爬虫」** 分类，可编辑 `CRAWLER_THS_COOKIE`（完整 Cookie 多行文本）、`CRAWLER_THS_HEXIN_V` 及预取、输出、超时等项；保存后写入 `.env`，CLI 爬虫需重启或等待配置重载后生效。

### Web「数据爬取」与「板块与成交量」页

- **数据爬取**：侧栏 **「数据爬取」**，路由 **`/data-crawl`**（旧路由 `/ths-concept-crawl` 会重定向到本页）。页面为 **同花顺概念数据** 只读视图：已写入 SQLite 的 **`crawler_ths_concept_run` / `crawler_ths_concept` / `crawler_ths_concept_constituent`**（运行记录、概念列表、成分股；支持分页与筛选）。需 **`CRAWLER_THS_PERSIST_DB=true`** 且已执行过至少一次 `python main.py --crawl ths-concept`。
- **板块与成交量**（侧栏一级菜单，路由 **`/sector-volume-analysis`**）：仅展示同花顺 **板块（概念）列表** 与 **选中板块的成分股**；默认使用库中最新入库快照，有多条入库记录时可切换「数据时间」。**不**展示爬取运行明细、**不**与成交量榜批次关联。历史书签 **`/data-crawl?tab=sector-volume`** 会在前端 **重定向** 到 **`/sector-volume-analysis`**（`Navigate replace`）。

只读 REST（需已启动带 Web 的 API，与站点认证策略一致）：

- `GET /api/v1/crawler/ths-concept/runs?page=&limit=`
- `GET /api/v1/crawler/ths-concept/runs/{run_id}/concepts?page=&limit=&q=`
- `GET /api/v1/crawler/ths-concept/runs/{run_id}/constituents?page=&limit=&concept_code=`
- `GET /api/v1/crawler/ths-concept/runs/{run_id}/volume-batch-sector-stats?batch_run_id=tv_...&limit=` — 可选：同花顺板块成分与某日成交量榜 `tv_*` 批次交集统计（`batch_run_id` 必填）；当前 Web「板块与成交量」页不使用。

### 环境变量（参见根目录 `.env.example`）

| 变量 | 说明 |
|------|------|
| `CRAWLER_THS_AUTO_BOOTSTRAP` | 默认 `true`：无 Cookie/hexin 时先请求 `CRAWLER_THS_BOOTSTRAP_URL` 取 `v`；`false` 则必须手动配置 |
| `CRAWLER_THS_BOOTSTRAP_URL` | 预取 Cookie 的页面，默认 `https://www.10jqka.com.cn/` |
| `CRAWLER_THS_HEXIN_V` | 可选：与浏览器 Cookie `v` 相同（不填则依赖自动预取或 `CRAWLER_THS_COOKIE`） |
| `CRAWLER_THS_COOKIE` | 可选：完整 `Cookie` 头字符串（优先级高于自动预取） |
| `CRAWLER_THS_CATALOG_URL` | 概念目录页 URL |
| `CRAWLER_THS_FIELD` / `CRAWLER_THS_ORDER` | AJAX 路径参数，默认 `199112` / `desc` |
| `CRAWLER_OUTPUT_DIR` | 输出根目录，默认 `./data/crawler` |
| `CRAWLER_DELAY_MS` | 两次请求之间休眠毫秒数；**未设置时默认 2000**（2 秒/次），仍被拦截可调大 |
| `CRAWLER_THS_AUTH_MAX_RETRIES` | 成分 AJAX 返回 **HTTP 401/403** 或 **chameleon 反爬页** 时，在首次请求之外最多再试几次（默认 **3**）；每次重试前**额外**休眠 **10s × 已失败次数**（第 1 次重试前 10s，第 2 次前 20s，依此类推），**另加**上面的 `CRAWLER_DELAY_MS`。设为 **0** 关闭重试。 |
| `CRAWLER_THS_MAX_PAGES` | 每个概念最多翻页数（可选） |
| `CRAWLER_THS_MAX_CONCEPTS` | 最多处理多少个概念（可选） |
| `CRAWLER_THS_PREFLIGHT_DETAIL` | 默认 `true`：每个概念在拉成分 AJAX 前先 `GET` 一次该概念详情页，降低 WAF 403 |
| `CRAWLER_HTTP_VERIFY_SSL` | 默认 `true`（**校验证书**）；仅当需要跳过校验时设为 `false` / `0` / `off`（抓包或代理自签链；有 MITM 风险）。 |
| `CRAWLER_THS_EXCLUDE_CATALOG_HUB` | 是否从概念列表中排除目录 URL 自身的 `code`（默认 `true`） |
| `CRAWLER_THS_EXCLUDE_CONCEPT_CODES` | 额外排除的 concept code，逗号分隔 |
| `CRAWLER_SAVE_RAW_HTML` | `true` 时保存原始 HTML 到本次 run 目录 |
| `CRAWLER_THS_PERSIST_DB` | 默认 `true`：将本次运行写入应用 SQLite（与 `DATABASE_PATH` 同一库）；`false` 仅写磁盘 jsonl |

CLI 爬取时 **INFO** 日志前缀 `同花顺概念爬取进度` 汇总：板块总数、已完板块数、当前板块代码与名称、成分分页、本板块股票条数（按总页数×本页条数**粗估**）、本板块已入库条数、全局成分已入库条数。已移除原 `CRAWLER_LOG_REQUEST_HEADERS` 逐请求打印完整请求头。

### 数据库表（`CRAWLER_THS_PERSIST_DB=true`）

与 `src/storage.py` 中 ORM 一致，由 `DatabaseManager` 在启动时 `create_all` 自动建表：

| 表名 | 说明 |
|------|------|
| `crawler_ths_concept_run` | 单次运行：`run_id`（PK）、`task_id`、`catalog_url`、`dry_run`、`ok`、`message`、`stats_json`、`errors_json`、`output_path`、`created_at` |
| `crawler_ths_concept` | 该次运行解析到的概念：`run_id` + `concept_code` 唯一，含 `concept_name`、`detail_url`、`crawled_at` |
| `crawler_ths_concept_constituent` | 成分股：`run_id` + `concept_code` + `stock_code` 唯一，含 `stock_name`、`page`、`row_index`、`crawled_at` |

同一 `run_id` 再次写入时会先删后插（幂等）。**dry-run** 只写入运行表 + 概念表，无成分表数据。

示例查询（将 `YOUR_RUN_ID` 换成 `manifest` 旁目录名或日志中的 run）：

```sql
SELECT * FROM crawler_ths_concept_run ORDER BY created_at DESC LIMIT 5;
SELECT concept_code, concept_name FROM crawler_ths_concept WHERE run_id = 'YOUR_RUN_ID' LIMIT 20;
SELECT * FROM crawler_ths_concept_constituent WHERE run_id = 'YOUR_RUN_ID' AND stock_code = '600519';
```

### 成分接口 HTTP 401 / 403

常见原因是 **WAF 判定非浏览器流量** 或 **Cookie / `v` 无效**。本项目已默认：

- 使用 **桌面 Chrome 风格** `User-Agent`（仅当未设置 `CRAWLER_USER_AGENT` 时）；
- 成分 AJAX 使用与浏览器 **顶层文档导航** 一致的 **`Sec-Fetch-*` / `Accept` / `Accept-Language`**（见 `http_client._ths_constituent_ajax_nav_headers`），**不**发送 `Origin`、`X-Requested-With`；
- 每个概念拉成分前 **`CRAWLER_THS_PREFLIGHT_DETAIL`**（默认 true）可先打开详情页以建立会话。

若仍 401/403：继续 **增大 `CRAWLER_DELAY_MS`**（如 3000～5000），或在浏览器登录后复制 **`CRAWLER_THS_COOKIE` / `CRAWLER_THS_HEXIN_V`**。亦可依赖 **`CRAWLER_THS_AUTH_MAX_RETRIES`** 对单次成分请求做**有限次**退避重试（仅缓解偶发拦截，不能替代有效 Cookie）。

### 成分数据与 SQLite

正常完成非 dry-run 任务且 **`CRAWLER_THS_PERSIST_DB=true`** 时，`run_ths_concept_crawl` 在解析各页 `m-pager-table` 后累积 `all_rows`，最终调用 `DatabaseManager.save_ths_concept_crawl(..., constituents=list(all_rows))`：先按 `run_id` 删除旧行再插入 **`crawler_ths_concept`** 与 **`crawler_ths_concept_constituent`**（成分字段含 `concept_code`、`stock_code`、`stock_name`、`page`、`row_index`）。某一概念在某一页遇 **不可恢复** 的 `CrawlAuthError`（重试仍失败）时，该概念后续页不再抓取，**已解析行的成分仍会写入**；未抓取到的板块不会有对应成分行。

### CLI

```bash
# 仅解析目录，不请求成分 AJAX（若目录页被反爬，可开自动预取或手动配置 CRAWLER_THS_HEXIN_V / COOKIE）
python main.py --crawl ths-concept --dry-run

# 全量（需已配置 hexin-v）
python main.py --crawl ths-concept

# 指定输出目录与上限
python main.py --crawl ths-concept --crawl-output-dir ./data/my_crawl --crawl-max-concepts 5 --crawl-max-pages 3
```

### 产出结构

```
${CRAWLER_OUTPUT_DIR}/ths_concept/<run_id>/
  concepts.jsonl       # 每行：concept_code, concept_name, detail_url, crawled_at
  constituents.jsonl   # 每行：concept_code, stock_code, stock_name, page, row_index, crawled_at
  manifest.json        # 统计与错误摘要
  raw/                 # 仅当 CRAWLER_SAVE_RAW_HTML=true
```

## 扩展其他任务

在 `src/crawler/tasks/` 下新增子包，并在 `src/crawler/runner.py` 的 `run_crawl_cli` 中注册 `choices` 与 `main.py` 的 `--crawl` 选项。
