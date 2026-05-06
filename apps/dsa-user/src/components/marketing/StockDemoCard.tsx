import type { AnalysisReport } from '../../types/workbenchAnalysis';

function truncateText(s: string, max: number): string {
  const t = s.trim();
  if (!t.length) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

function formatChangePct(pct: number | undefined): string {
  if (pct === undefined || pct === null || Number.isNaN(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

type StockDemoCardProps = {
  report: AnalysisReport;
  /** 与榜单/扫描一致的展示标签（可与 meta 略有不同） */
  headerLabel?: string;
  /** 样本来源：用于左上角角标文案 */
  sourceTag: string;
};

/** 营销「分析示例」页：单只个股信息卡片（摘要级，非完整报告面板） */
export function StockDemoCard({ report, headerLabel, sourceTag }: StockDemoCardProps) {
  const { meta, summary, strategy } = report;
  const title =
    headerLabel?.trim() ||
    `${meta.stockCode}${meta.stockName ? ` · ${meta.stockName}` : ''}`;
  const price = meta.currentPrice;
  const ch = meta.changePct;
  const changeUp = ch !== undefined && ch !== null && ch > 0;
  const changeDown = ch !== undefined && ch !== null && ch < 0;

  const excerpt = truncateText(summary.analysisSummary || summary.operationAdvice || '—', 240);

  const stratParts: string[] = [];
  if (strategy?.idealBuy) stratParts.push(`理想买点 ${strategy.idealBuy}`);
  if (strategy?.stopLoss) stratParts.push(`止损 ${strategy.stopLoss}`);
  if (strategy?.takeProfit) stratParts.push(`止盈 ${strategy.takeProfit}`);
  const stratLine = stratParts.join(' · ');

  return (
    <article className="feature-card features-capability-card stock-demo-card">
      <span className="feature-card-tag" aria-hidden="true">
        {sourceTag}
      </span>
      <h2 className="feature-card-heading">{title}</h2>

      <div className="stock-demo-card-meta">
        {price !== undefined && price !== null ? (
          <div className="stock-demo-card-price-row">
            <span className="stock-demo-card-price-num">{Number(price).toFixed(3)}</span>
            <span
              className={`stock-demo-card-change ${changeUp ? 'stock-demo-card-change--up' : ''} ${changeDown ? 'stock-demo-card-change--down' : ''}`.trim()}
            >
              {formatChangePct(ch)}
            </span>
          </div>
        ) : null}
        <div className="stock-demo-card-sentiment">
          <span className="stock-demo-card-sentiment-score">{summary.sentimentScore}</span>
          <span className="stock-demo-card-sentiment-label">{summary.sentimentLabel ?? '情绪'}</span>
        </div>
      </div>

      <div className="feature-card-desc stock-demo-card-excerpt">{excerpt}</div>

      {stratLine ? (
        <p className="stock-demo-card-strategy" title={stratLine}>
          {truncateText(stratLine, 120)}
        </p>
      ) : null}

      {summary.operationAdvice && summary.operationAdvice !== excerpt ? (
        <p className="stock-demo-card-hint">{truncateText(summary.operationAdvice, 100)}</p>
      ) : null}
    </article>
  );
}
