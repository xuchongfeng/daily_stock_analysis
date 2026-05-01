import { Link } from 'react-router-dom';

import { PRICING_COMPARE_ROWS, PRICING_PLANS } from '../../content/pricingPlans';

/** 定价与方案子页（三档与前期沟通一致） */
export function PricingPage() {
  return (
    <div className="page-stack prose-page">
      <h1 className="page-h1">定价方案</h1>
      <p className="page-lead">
        我们采用「体验 · 专业 · 团队」三档结构：体验档免费在限额内试用；专业档 <strong>¥199/月</strong> 面向高频个人用户；团队档面议，面向多账号与合规需求。具体限额与开票方式以部署方公示或合同为准。
      </p>

      <div className="pricing-grid page-pricing-grid">
        {PRICING_PLANS.map((plan) => (
          <article
            key={plan.id}
            className={`price-card page-price-card ${plan.featured ? 'featured' : ''}`}
          >
            <div className="tier">{plan.name}</div>
            <div className="amount-row">
              <span className="amount">{plan.priceDisplay}</span>
              {plan.periodNote ? <span className="period">{plan.periodNote}</span> : null}
            </div>
            <p className="plan-summary">{plan.summary}</p>
            <ul className="plan-list">
              {plan.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            {plan.footnote ? <p className="plan-footnote">{plan.footnote}</p> : null}
          </article>
        ))}
      </div>

      <section className="prose-section compare-section">
        <h2>档位对比（摘要）</h2>
        <div className="table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>维度</th>
                <th>体验</th>
                <th>专业</th>
                <th>团队</th>
              </tr>
            </thead>
            <tbody>
              {PRICING_COMPARE_ROWS.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.trial}</td>
                  <td>{row.pro}</td>
                  <td>{row.team}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="page-disclaimer">
        价格与权益可能随版本与运营活动调整；支付、发票与退款规则以运营方最新说明为准。若需团队方案，请通过部署方提供的商务渠道沟通。
      </p>

      <p className="back-link">
        <Link to="/login">前往登录</Link> · <Link to="/">返回首页</Link>
      </p>
    </div>
  );
}
