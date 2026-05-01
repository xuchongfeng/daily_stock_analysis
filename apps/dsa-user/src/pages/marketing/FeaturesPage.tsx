/** 功能介绍子页 */
export function FeaturesPage() {
  return (
    <div className="page-stack prose-page">
      <h1 className="page-h1">功能介绍</h1>
      <p className="page-lead">
        以下按模块说明当前产品能力边界；与数据源、模型与部署配置强相关，以您实际环境为准。
      </p>

      <section className="prose-section">
        <h2>今日</h2>
        <p>
          汇总服务健康检查与自选概况，适合每日开盘前后快速「扫一眼」系统状态与关注列表。后续可扩展待办、风险摘要与日历提醒。
        </p>
      </section>

      <section className="prose-section">
        <h2>自选</h2>
        <p>
          与后端自选存储同步（默认 <code>data/watchlist.json</code> 或部署方指定路径）。支持查看代码列表与摘要；若开启认证，仅登录后可拉取完整数据。
        </p>
      </section>

      <section className="prose-section">
        <h2>问股</h2>
        <p>
          面向自然语言的多轮问答与策略讨论；依赖已配置的 LLM 与检索能力。流式输出、会话导出等能力将按版本迭代开放。
        </p>
      </section>

      <section className="prose-section">
        <h2>持仓</h2>
        <p>
          录入持仓与流水后，可输出仓位集中度、盈亏与组合级复盘摘要。与交易接口无关，不自动下单。
        </p>
      </section>

      <section className="prose-section">
        <h2>发现</h2>
        <p>
          榜单、板块与市场扫描等发现类能力将按数据源与权限逐步接入；当前页面可为占位或部分可用能力。
        </p>
      </section>

      <section className="prose-section">
        <h2>复盘</h2>
        <p>
          历史分析留痕、短窗验证与命中率统计，用于对照当时观点与后续走势；周报 / 月报等报告形态可后续扩展。
        </p>
      </section>

      <section className="prose-section">
        <h2>账户</h2>
        <p>
          登录状态、订阅与通知偏好等将随商业化能力接入；当前可与后端可选密码登录（<code>ADMIN_AUTH_ENABLED</code>）联动。
        </p>
      </section>
    </div>
  );
}
