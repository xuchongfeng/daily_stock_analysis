/** 用户评价子页 */
export function ReviewsPage() {
  return (
    <div className="page-stack prose-page">
      <h1 className="page-h1">用户评价</h1>
      <p className="page-lead">
        以下为示例展示用语，上线后建议替换为可核验的真实评价、案例 logo 与引用来源。
      </p>

      <div className="quote-grid page-quote-grid">
        <blockquote className="quote-card large">
          「复盘摘要省掉自己翻报告的时间，对盯盘节奏有帮助；自选列表和后台统一这一点很省事。」
          <cite>— 个人投资者 · 示例</cite>
        </blockquote>
        <blockquote className="quote-card large">
          「把自选和持仓放在同一套视图里，比单点工具顺手；问股当第二意见够用。」
          <cite>— 量化爱好者 · 示例</cite>
        </blockquote>
        <blockquote className="quote-card large">
          「还在等问股再进化，但目前报告结构和风险提示已经比纯股吧信息可控。」
          <cite>— 兼职交易员 · 示例</cite>
        </blockquote>
      </div>

      <section className="prose-section">
        <h2>我们如何收集评价</h2>
        <p>
          正式运营后，可通过问卷、NPS、可选公开授权访谈等方式收集反馈；本页仅作排版占位，避免使用无法核实的虚假背书。
        </p>
      </section>
    </div>
  );
}
