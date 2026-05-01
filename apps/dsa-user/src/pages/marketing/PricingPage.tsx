import { Link } from 'react-router-dom';

import { PRICING_COMPARE_ROWS, PRICING_TIER_COLUMNS } from '../../content/pricingPlans';

/** 定价方案：四档横向对比表 */
export function PricingPage() {
  return (
    <div className="page-stack prose-page">
      <h1 className="page-h1">定价方案</h1>
      <p className="page-lead">
        四档任选：<strong>免费</strong>在限额内长期使用；付费档为每自然月 <strong>¥19 / ¥49 / ¥99</strong>（含税价以公示为准）。
        下表对 <strong>AI 配额、自选规模、每日分析推送、榜单摘要与异动推送、留存与支持</strong> 等给出分档<strong>参考数字</strong>；
        实际到账权益以账户页、订购记录与当期用户协议为准；发票与退款规则按运营方说明执行。
      </p>

      <section className="prose-section compare-section pricing-compare-first">
        <h2 className="compare-table-title">方案对比</h2>
        <div className="table-wrap">
          <table className="compare-table pricing-compare-table">
            <thead>
              <tr>
                <th className="pricing-compare-axis">对比项</th>
                {PRICING_TIER_COLUMNS.map((col) => (
                  <th key={col.id} className={col.featured ? 'compare-col-hit' : undefined}>
                    <span className="pricing-th-name">{col.label}</span>
                    <span className="pricing-th-price">{col.priceHeadline}</span>
                    {col.periodNote ? (
                      <span className="pricing-th-note">{col.periodNote}</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PRICING_COMPARE_ROWS.map((row) => (
                <tr key={row.label}>
                  <td className="pricing-compare-axis">{row.label}</td>
                  {PRICING_TIER_COLUMNS.map((col) => (
                    <td key={col.id} className={col.featured ? 'compare-col-hit' : undefined}>
                      {row[col.id]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="page-disclaimer">
        表中「自然月」「自然周」「交易日」「次/封/条」等为本站产品化计费口径释义；如遇活动叠加或灰度试用，单项数字可能短时与表内略有差异。
        超限时任务可能排队、降级摘要或顺延至次周期；升降级差价与未消费权益结算以当期规则为准。
      </p>

      <p className="back-link">
        <Link to="/login">前往登录</Link> · <Link to="/">返回首页</Link>
      </p>
    </div>
  );
}
