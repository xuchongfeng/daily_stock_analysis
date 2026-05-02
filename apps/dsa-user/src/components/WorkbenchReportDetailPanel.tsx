import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { AnalysisReport, SectorRankingItem } from '../types/workbenchAnalysis';

const EMPTY = '—';

function sentimentTone(score: number | undefined): 'neg' | 'mid' | 'pos' | 'none' {
  if (score === undefined || score === null || Number.isNaN(Number(score))) return 'none';
  const s = Number(score);
  if (s <= 40) return 'neg';
  if (s <= 60) return 'mid';
  return 'pos';
}

function safeJsonStringify(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

function normalizeBoards(raw: unknown): Array<{ name: string; code?: string; type?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (item && typeof item === 'object' && 'name' in item) {
      const o = item as Record<string, unknown>;
      return {
        name: String(o.name ?? EMPTY),
        code: o.code != null ? String(o.code) : undefined,
        type: o.type != null ? String(o.type) : undefined,
      };
    }
    return { name: typeof item === 'string' ? item : safeJsonStringify(item) };
  });
}

function parseSectorList(x: unknown): SectorRankingItem[] {
  if (!Array.isArray(x)) return [];
  return x.map((row) => {
    if (row && typeof row === 'object' && 'name' in row) {
      const r = row as Record<string, unknown>;
      const pct =
        typeof r.changePct === 'number'
          ? r.changePct
          : typeof r.change_pct === 'number'
            ? r.change_pct
            : undefined;
      return {
        name: String(r.name ?? EMPTY),
        changePct: pct,
      };
    }
    return { name: String(row) };
  });
}

function normalizeSectorRankings(raw: unknown): { top: SectorRankingItem[]; bottom: SectorRankingItem[] } {
  if (!raw || typeof raw !== 'object') return { top: [], bottom: [] };
  const o = raw as Record<string, unknown>;
  return {
    top: parseSectorList(o.top),
    bottom: parseSectorList(o.bottom),
  };
}

function JsonBlock({
  title,
  value,
  className = 'workbench-detail-json',
}: {
  title: string;
  value: unknown;
  className?: string;
}) {
  const empty = isEmptyValue(value);
  return (
    <div className="workbench-detail-json-block">
      {title ? <h4 className="workbench-detail-json-title">{title}</h4> : null}
      {empty ? (
        <p className="workbench-block-text workbench-detail-empty">{EMPTY}</p>
      ) : (
        <pre className={className}>{safeJsonStringify(value)}</pre>
      )}
    </div>
  );
}

function JsonSection({
  title,
  value,
  className = 'workbench-detail-json',
}: {
  title: string;
  value: unknown;
  className?: string;
}) {
  const empty = isEmptyValue(value);
  return (
    <section className="workbench-card-block workbench-detail-section">
      <h3 className="workbench-block-title">{title}</h3>
      {empty ? (
        <p className="workbench-block-text workbench-detail-empty">{EMPTY}</p>
      ) : (
        <pre className={className}>{safeJsonStringify(value)}</pre>
      )}
    </section>
  );
}

function SectorHalf({
  title,
  items,
  reportLangZh,
}: {
  title: string;
  items: SectorRankingItem[];
  reportLangZh: boolean;
}) {
  return (
    <div className="workbench-detail-sector-half">
      <h4 className="workbench-detail-subtitle">{title}</h4>
      {!items.length ? (
        <p className="workbench-block-text workbench-detail-empty">{EMPTY}</p>
      ) : (
        <ul className="workbench-detail-sector-list">
          {items.map((row, i) => (
            <li key={`${row.name}-${i}`}>
              <span className="workbench-detail-sector-name">{row.name}</span>
              {typeof row.changePct === 'number' ? (
                <span
                  className={
                    row.changePct > 0
                      ? 'price-up'
                      : row.changePct < 0
                        ? 'price-down'
                        : 'workbench-detail-muted'
                  }
                >
                  {row.changePct > 0 ? '+' : ''}
                  {row.changePct.toFixed(2)}%
                </span>
              ) : (
                <span className="workbench-detail-muted">{reportLangZh ? '涨跌 —' : '—'}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface WorkbenchReportDetailPanelProps {
  report: AnalysisReport;
  reportLangZh: boolean;
}

export function WorkbenchReportDetailPanel({ report, reportLangZh }: WorkbenchReportDetailPanelProps) {
  const L = {
    meta: reportLangZh ? '报告元数据' : 'Report meta',
    snapshot: reportLangZh ? '行情快照' : 'Market snapshot',
    sentiment: reportLangZh ? '市场情绪' : 'Sentiment',
    advice: reportLangZh ? '操作建议' : 'Advice',
    trend: reportLangZh ? '趋势预测' : 'Trend',
    insight: reportLangZh ? '核心洞察' : 'Insights',
    strategy: reportLangZh ? '策略点位' : 'Levels',
    news: reportLangZh ? '新闻摘要' : 'News digest',
    boards: reportLangZh ? '关联板块 / 概念' : 'Related boards',
    sector: reportLangZh ? '板块涨跌榜' : 'Sector movers',
    sectorTop: reportLangZh ? '领涨' : 'Top',
    sectorBottom: reportLangZh ? '领跌' : 'Bottom',
    financial: reportLangZh ? '财报摘要' : 'Financial snapshot',
    dividend: reportLangZh ? '分红指标' : 'Dividend metrics',
    context: reportLangZh ? '上下文快照（JSON）' : 'Context snapshot (JSON)',
    raw: reportLangZh ? '原始分析结果（JSON）' : 'Raw analysis (JSON)',
    recordId: reportLangZh ? '记录 ID' : 'Record ID',
    queryId: reportLangZh ? '查询 ID' : 'Query ID',
    reportType: reportLangZh ? '报告类型' : 'Report type',
    language: reportLangZh ? '报告语言' : 'Language',
    model: reportLangZh ? '使用模型' : 'Model',
    created: reportLangZh ? '创建时间' : 'Created',
    price: reportLangZh ? '分析时价格' : 'Price at analysis',
    change: reportLangZh ? '涨跌幅' : 'Change %',
    idealBuy: reportLangZh ? '理想买入' : 'Ideal buy',
    secondaryBuy: reportLangZh ? '二次买入' : 'Secondary buy',
    stopLoss: reportLangZh ? '止损' : 'Stop loss',
    takeProfit: reportLangZh ? '止盈' : 'Take profit',
    advancedFold: reportLangZh
      ? '报告元数据、上下文快照与原始分析结果（默认折叠）'
      : 'Report meta, context snapshot & raw JSON (collapsed by default)',
  };

  const { meta, summary, strategy, details } = report;
  const boards = normalizeBoards(details?.belongBoards);
  const sectors = normalizeSectorRankings(details?.sectorRankings);

  const strategyRows: { label: string; value: string }[] = [
    { label: L.idealBuy, value: strategy?.idealBuy?.trim() || EMPTY },
    { label: L.secondaryBuy, value: strategy?.secondaryBuy?.trim() || EMPTY },
    { label: L.stopLoss, value: strategy?.stopLoss?.trim() || EMPTY },
    { label: L.takeProfit, value: strategy?.takeProfit?.trim() || EMPTY },
  ];

  const changePctText =
    typeof meta.changePct === 'number'
      ? `${meta.changePct > 0 ? '+' : ''}${meta.changePct.toFixed(2)}%`
      : EMPTY;

  return (
    <div className="workbench-detail-panel">
      <section className="workbench-card-block workbench-detail-section">
        <h3 className="workbench-block-title">{L.snapshot}</h3>
        <dl className="workbench-dl">
          <div className="workbench-dl-row">
            <dt>{L.price}</dt>
            <dd>{meta.currentPrice !== undefined ? String(meta.currentPrice) : EMPTY}</dd>
          </div>
          <div className="workbench-dl-row">
            <dt>{L.change}</dt>
            <dd>
              {typeof meta.changePct === 'number' ? (
                <span
                  className={
                    meta.changePct > 0 ? 'price-up' : meta.changePct < 0 ? 'price-down' : ''
                  }
                >
                  {changePctText}
                </span>
              ) : (
                EMPTY
              )}
            </dd>
          </div>
        </dl>
      </section>

      <div className="workbench-summary-grid">
        <div className="workbench-card-block">
          <h3 className="workbench-block-title">{L.sentiment}</h3>
          <div className="workbench-sentiment">
            <span className={`workbench-big-score workbench-score-${sentimentTone(summary.sentimentScore)}`}>
              {summary.sentimentScore !== undefined && summary.sentimentScore !== null
                ? String(summary.sentimentScore)
                : EMPTY}
            </span>
            {summary.sentimentLabel ? (
              <span className="workbench-sent-label">{summary.sentimentLabel}</span>
            ) : null}
          </div>
        </div>
        <div className="workbench-card-block">
          <h3 className="workbench-block-title">{L.advice}</h3>
          <p className="workbench-block-text">{summary.operationAdvice?.trim() || EMPTY}</p>
        </div>
        <div className="workbench-card-block">
          <h3 className="workbench-block-title">{L.trend}</h3>
          <p className="workbench-block-text">{summary.trendPrediction?.trim() || EMPTY}</p>
        </div>
      </div>

      <section className="workbench-card-block workbench-insight-block workbench-detail-section">
        <h3 className="workbench-block-title">{L.insight}</h3>
        <div className="workbench-md">
          {summary.analysisSummary?.trim() ? (
            <Markdown remarkPlugins={[remarkGfm]}>{summary.analysisSummary}</Markdown>
          ) : (
            <p className="workbench-block-text">{EMPTY}</p>
          )}
        </div>
      </section>

      <section className="workbench-card-block workbench-detail-section">
        <h3 className="workbench-block-title">{L.strategy}</h3>
        <dl className="workbench-dl">
          {strategyRows.map((row) => (
            <div key={row.label} className="workbench-dl-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="workbench-card-block workbench-detail-section">
        <h3 className="workbench-block-title">{L.news}</h3>
        <div className="workbench-md">
          {details?.newsContent?.trim() ? (
            <Markdown remarkPlugins={[remarkGfm]}>{details.newsContent}</Markdown>
          ) : (
            <p className="workbench-block-text">{EMPTY}</p>
          )}
        </div>
      </section>

      <section className="workbench-card-block workbench-detail-section">
        <h3 className="workbench-block-title">{L.boards}</h3>
        {!boards.length ? (
          <p className="workbench-block-text workbench-detail-empty">{EMPTY}</p>
        ) : (
          <div className="workbench-detail-board-chips" role="list">
            {boards.map((b, i) => {
              const sub = [b.code, b.type].filter(Boolean).join(' · ');
              const title = sub ? `${b.name} (${sub})` : b.name;
              return (
                <span key={`${b.name}-${i}`} className="workbench-detail-board-chip" role="listitem" title={title}>
                  <span className="workbench-detail-board-chip-name">{b.name}</span>
                  {sub ? <span className="workbench-detail-board-chip-sub mono">{sub}</span> : null}
                </span>
              );
            })}
          </div>
        )}
      </section>

      <section className="workbench-card-block workbench-detail-section">
        <h3 className="workbench-block-title">{L.sector}</h3>
        <div className="workbench-detail-sector-grid">
          <SectorHalf title={L.sectorTop} items={sectors.top} reportLangZh={reportLangZh} />
          <SectorHalf title={L.sectorBottom} items={sectors.bottom} reportLangZh={reportLangZh} />
        </div>
      </section>

      <JsonSection title={L.financial} value={details?.financialReport} />
      <JsonSection title={L.dividend} value={details?.dividendMetrics} />

      <details className="workbench-card-block workbench-detail-fold">
        <summary className="workbench-detail-fold-summary">{L.advancedFold}</summary>
        <div className="workbench-detail-fold-body">
          <section className="workbench-detail-section workbench-detail-meta">
            <h3 className="workbench-block-title">{L.meta}</h3>
            <dl className="workbench-dl">
              <div className="workbench-dl-row">
                <dt>{L.recordId}</dt>
                <dd className="mono">{meta.id != null ? String(meta.id) : EMPTY}</dd>
              </div>
              <div className="workbench-dl-row">
                <dt>{L.queryId}</dt>
                <dd className="mono workbench-detail-break">{meta.queryId || EMPTY}</dd>
              </div>
              <div className="workbench-dl-row">
                <dt>{L.reportType}</dt>
                <dd>{meta.reportType || EMPTY}</dd>
              </div>
              <div className="workbench-dl-row">
                <dt>{L.language}</dt>
                <dd>{meta.reportLanguage || EMPTY}</dd>
              </div>
              <div className="workbench-dl-row">
                <dt>{L.model}</dt>
                <dd className="workbench-detail-break">{meta.modelUsed || EMPTY}</dd>
              </div>
              <div className="workbench-dl-row">
                <dt>{L.created}</dt>
                <dd>{meta.createdAt || EMPTY}</dd>
              </div>
            </dl>
          </section>
          <JsonBlock title={L.context} value={details?.contextSnapshot} />
          <JsonBlock title={L.raw} value={details?.rawResult} />
        </div>
      </details>
    </div>
  );
}
