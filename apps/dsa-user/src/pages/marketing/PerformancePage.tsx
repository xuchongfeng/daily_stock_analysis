/** 回测与实战效果子页 */
export function PerformancePage() {
  return (
    <div className="page-stack prose-page">
      <h1 className="page-h1">回测效果与实战指标</h1>
      <p className="page-lead">
        下列数值为<strong>演示向</strong>示例，用于说明可展示的统计维度；正式环境应接入贵司回测任务或统一披露样本区间、费用假设与幸存者偏差处理。
      </p>

      <div className="stats-row page-stats-row">
        <div className="stat-pill">
          <div className="num">62%</div>
          <div className="lbl">示例：信号方向胜率（近窗，扣费前）</div>
        </div>
        <div className="stat-pill">
          <div className="num">+4.2%</div>
          <div className="lbl">示例：中位模拟收益（同窗，简化假设）</div>
        </div>
        <div className="stat-pill">
          <div className="num">1.05</div>
          <div className="lbl">示例：盈亏比（演示口径）</div>
        </div>
      </div>

      <section className="prose-section">
        <h2>指标说明（占位）</h2>
        <ul className="prose-list">
          <li>
            <strong>样本期</strong>：应披露起止日期与交易日数量，避免用「历史最佳区间」误导。
          </li>
          <li>
            <strong>标的池</strong>：与信号摘要、自选或全市场扫描的范围应一致声明。
          </li>
          <li>
            <strong>费用与滑点</strong>：是否计入佣金、印花税、最小价差；是否采用收盘价成交等假设。
          </li>
          <li>
            <strong>前视偏差</strong>：确保信号时点与可交易时点一致，回测引擎与实盘链路应对齐。
          </li>
        </ul>
      </section>

      <section className="prose-section">
        <h2>后续接入建议</h2>
        <p>
          可将本页与后端回测结果 API 或静态发布任务对接，按季度刷新「官方披露」数字，并在脚注中附方法论文档链接。
        </p>
      </section>
    </div>
  );
}
