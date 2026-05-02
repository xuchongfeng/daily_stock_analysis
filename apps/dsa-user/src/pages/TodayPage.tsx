import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { ParsedApiError } from '../api/error';
import { getParsedApiError } from '../api/error';
import { signalDigestApi } from '../api/signalDigestApi';
import { AddToWatchlistCompact } from '../components/AddToWatchlistCompact';
import type { SignalDigestPick, SignalDigestResponse } from '../types/signalDigest';
import { adviceBadgeVariant, scoreBadgeVariant, type SignalBadgeVariant } from '../utils/signalBadge';
import { xueqiuStockHref } from '../utils/xueqiuStockHref';

const EXCERPT_HOVER_MS = 1500;

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function badgeClass(v: SignalBadgeVariant): string {
  switch (v) {
    case 'success':
      return 'today-badge today-badge-success';
    case 'info':
      return 'today-badge today-badge-info';
    case 'warning':
      return 'today-badge today-badge-warn';
    case 'danger':
      return 'today-badge today-badge-danger';
    default:
      return 'today-badge today-badge-default';
  }
}

function ApiErrorBanner({ error }: { error: ParsedApiError }) {
  return (
    <div className="chat-alert chat-alert-danger today-alert" role="alert">
      <strong className="chat-alert-title">{error.title}</strong>
      <p className="chat-alert-msg">{error.message}</p>
    </div>
  );
}

function StatPill({
  children,
  accent,
}: {
  children: ReactNode;
  accent?: 'default' | 'muted' | 'ok' | 'info';
}) {
  return (
    <span
      className={cx(
        'today-stat-pill',
        accent === 'ok' && 'today-stat-pill-ok',
        accent === 'info' && 'today-stat-pill-info',
        accent === 'muted' && 'today-stat-pill-muted',
      )}
    >
      {children}
    </span>
  );
}

function TagCloud({
  items,
  emptyHint,
}: {
  items: { name: string; count: number }[];
  emptyHint: string;
}) {
  if (items.length === 0) {
    return <p className="today-tag-empty">{emptyHint}</p>;
  }
  return (
    <div className="today-tag-cloud">
      {items.map((b) => (
        <span key={b.name} className="today-tag">
          <span>{b.name}</span>
          <span className="today-tag-count">×{b.count}</span>
        </span>
      ))}
    </div>
  );
}

function nameCell(code: string, name?: string | null) {
  const href = xueqiuStockHref(code);
  const label = name?.trim() || '—';
  if (href && label !== '—') {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="today-link-stock">
        {label}
      </a>
    );
  }
  return <span>{label}</span>;
}

function PickRow({ pick: p, index }: { pick: SignalDigestPick; index: number }) {
  const adviceCellRef = useRef<HTMLTableCellElement>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipPos, setTipPos] = useState({ top: 0, left: 0, width: 320 });
  const hoverTimerRef = useRef<number | null>(null);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const syncTipPosition = useCallback(() => {
    const el = adviceCellRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const desiredW = Math.min(Math.max(r.width, 280), 440);
    let left = r.left + (r.width - desiredW) / 2;
    const margin = 8;
    left = Math.max(margin, Math.min(left, window.innerWidth - desiredW - margin));
    setTipPos({ top: r.bottom + 8, left, width: desiredW });
  }, []);

  useLayoutEffect(() => {
    if (!tipOpen) return;
    syncTipPosition();
    const onViewport = () => syncTipPosition();
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);
    return () => {
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
    };
  }, [tipOpen, syncTipPosition]);

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer]);

  const excerpt = p.analysisSummaryExcerpt?.trim();
  const hasExcerpt = Boolean(excerpt);

  const handleRowEnter = () => {
    if (!hasExcerpt) return;
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null;
      syncTipPosition();
      setTipOpen(true);
    }, EXCERPT_HOVER_MS);
  };

  const handleRowLeave = () => {
    clearHoverTimer();
    setTipOpen(false);
  };

  const tip =
    tipOpen && excerpt && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="tooltip"
            className="today-excerpt-tooltip"
            style={{ top: tipPos.top, left: tipPos.left, width: tipPos.width }}
          >
            <div className="today-excerpt-tooltip-label">分析摘要摘录</div>
            <p className="today-excerpt-tooltip-body">{excerpt}</p>
          </div>,
          document.body,
        )
      : null;

  const adv = (p.operationAdvice || '').trim();
  const advVar = adviceBadgeVariant(p.operationAdvice);
  const sc = p.sentimentScore;

  return (
    <>
      <tr className={cx('today-tr', index % 2 === 1 && 'alt')}>
        <td className="today-td mono">{p.code}</td>
        <td className="today-td">{nameCell(p.code, p.name)}</td>
        <td className="today-td num">{p.score.toFixed(1)}</td>
        <td className="today-td num muted">{p.appearanceCount}</td>
        <td className="today-td">
          {sc != null && Number.isFinite(Number(sc)) ? (
            <span className={badgeClass(scoreBadgeVariant(Number(sc)))}>{Number(sc)}</span>
          ) : (
            <span className="today-muted">—</span>
          )}
        </td>
        <td
          ref={adviceCellRef}
          className={cx('today-td', hasExcerpt && 'has-tip')}
          onMouseEnter={handleRowEnter}
          onMouseLeave={handleRowLeave}
        >
          {adv ? <span className={badgeClass(advVar)}>{adv}</span> : <span className="today-muted">—</span>}
        </td>
        <td className="today-td truncate muted">{(p.conceptTags || []).join('、') || '—'}</td>
        <td className="today-td truncate muted">{p.trendPrediction ?? '—'}</td>
        <td className="today-td center">
          <AddToWatchlistCompact stockCode={p.code} stockName={p.name} />
        </td>
      </tr>
      {tip}
    </>
  );
}

function CoCard({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="card today-co-card">
      <div className="today-co-head">
        <span className="today-co-icon" aria-hidden>
          {icon}
        </span>
        <div>
          <h3 className="today-co-title">{title}</h3>
          <p className="today-co-desc">{description}</p>
        </div>
      </div>
      <div className="today-co-body">{children}</div>
    </section>
  );
}

function DigestSection({ step, title, children }: { step: 1 | 2 | 3 | 4; title: string; children: ReactNode }) {
  return (
    <section className="today-digest-section">
      <div className="today-digest-heading">
        <span className="today-digest-step">{step}</span>
        <h2 className="today-digest-section-title">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function TodayPage() {
  const [data, setData] = useState<SignalDigestResponse | null>(null);
  const [loadError, setLoadError] = useState<ParsedApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [tradingSessions, setTradingSessions] = useState(14);
  const [topK, setTopK] = useState(100);
  const [market, setMarket] = useState<'cn' | 'hk' | 'us' | 'all'>('cn');
  const [recordScope, setRecordScope] = useState<'batch' | 'all' | 'manual'>('batch');
  const [adviceFilter, setAdviceFilter] = useState<'any' | 'buy_or_hold'>('buy_or_hold');
  const [withNarrative, setWithNarrative] = useState(true);
  const [snapshotDate, setSnapshotDate] = useState('');
  const [snapshotDates, setSnapshotDates] = useState<string[]>([]);

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      setLoading(true);
      setLoadError(null);
      try {
        const commonParams = {
          tradingSessions,
          topK,
          market,
          batchOnly: recordScope === 'batch',
          excludeBatch: recordScope === 'manual',
          adviceFilter,
        };
        const res = snapshotDate
          ? await signalDigestApi.getSnapshot(snapshotDate, commonParams)
          : await signalDigestApi.get({
              ...commonParams,
              withNarrative,
              refresh: opts?.refresh === true,
            });
        setData(res);
      } catch (e: unknown) {
        setLoadError(getParsedApiError(e));
      } finally {
        setLoading(false);
      }
    },
    [tradingSessions, topK, market, recordScope, adviceFilter, withNarrative, snapshotDate],
  );

  useEffect(() => {
    document.title = '今日';
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    const run = async () => {
      try {
        const commonParams = {
          tradingSessions,
          topK,
          market,
          batchOnly: recordScope === 'batch',
          excludeBatch: recordScope === 'manual',
          adviceFilter,
        };
        const r = await signalDigestApi.listSnapshotDates(commonParams);
        setSnapshotDates(r.items || []);
      } catch {
        setSnapshotDates([]);
      }
    };
    void run();
  }, [tradingSessions, topK, market, recordScope, adviceFilter]);

  useEffect(() => {
    if (snapshotDate && !snapshotDates.includes(snapshotDate)) {
      queueMicrotask(() => setSnapshotDate(''));
    }
  }, [snapshotDate, snapshotDates]);

  const handleRefresh = useCallback(() => {
    void load({ refresh: true });
  }, [load]);

  const win = data?.window;
  const CONTROL = 'today-select';

  return (
    <div className="today-page stack">
      <header className="today-header card">
        <div className="today-header-row">
          <div>
            <span className="today-kicker">近窗聚合</span>
            <h1 className="today-title">今日</h1>
            <p className="today-intro lead">
              对应工作台「信号摘要」：在所选交易日窗口内对分析记录打分与<strong>行业 / 概念</strong>共现；默认偏重
              <strong> 买入 / 持有</strong>类标的；可切换市场、数据来源及是否生成 AI 解读。
            </p>
          </div>
          <button type="button" className="today-refresh-btn" disabled={loading} onClick={handleRefresh}>
            {loading ? '刷新中…' : '刷新'}
          </button>
        </div>
      </header>

      <section className="card today-filters">
        <div className="today-filters-cap">筛选与选项</div>
        <div className="today-filters-grid">
          <label className="today-field">
            交易日窗口
            <select
              className={CONTROL}
              value={tradingSessions}
              onChange={(e) => setTradingSessions(Number(e.target.value))}
            >
              {[3, 14, 30, 60].map((n) => (
                <option key={n} value={n}>
                  {n} 日
                </option>
              ))}
            </select>
          </label>
          <label className="today-field">
            Top K
            <select className={CONTROL} value={topK} onChange={(e) => setTopK(Number(e.target.value))}>
              {[10, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="today-field">
            市场
            <select className={CONTROL} value={market} onChange={(e) => setMarket(e.target.value as typeof market)}>
              <option value="cn">A 股</option>
              <option value="hk">港股</option>
              <option value="us">美股</option>
              <option value="all">全部</option>
            </select>
          </label>
          <label className="today-field">
            数据来源
            <select
              className={CONTROL}
              value={recordScope}
              onChange={(e) => setRecordScope(e.target.value as typeof recordScope)}
            >
              <option value="batch">仅榜单扫描批次</option>
              <option value="all">全部记录</option>
              <option value="manual">仅手工 / 单股</option>
            </select>
          </label>
          <label className="today-field">
            操作建议
            <select
              className={CONTROL}
              value={adviceFilter}
              onChange={(e) => setAdviceFilter(e.target.value as typeof adviceFilter)}
            >
              <option value="buy_or_hold">买入或持有类</option>
              <option value="any">全部建议</option>
            </select>
          </label>
          <label className="today-field wide">
            历史日期（已持久化排名）
            <select className={CONTROL} value={snapshotDate} onChange={(e) => setSnapshotDate(e.target.value)}>
              <option value="">实时（当前窗口）</option>
              {snapshotDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <div className="today-field checkbox-field">
            <label className="today-checkbox-row">
              <input
                type="checkbox"
                checked={withNarrative}
                onChange={(e) => setWithNarrative(e.target.checked)}
                disabled={Boolean(snapshotDate)}
              />
              <span>生成 AI 叙事</span>
            </label>
          </div>
        </div>

        {win ? (
          <div className="today-window-pills">
            <span className="today-muted small">窗口</span>
            <StatPill accent="ok">
              锚定 <strong>{win.anchorDate}</strong>
            </StatPill>
            <StatPill>
              自 <strong>{win.oldestDate}</strong>
            </StatPill>
            <StatPill accent="muted">
              拉取 <strong>{win.rowsConsidered}</strong> 行
            </StatPill>
            {win.rowsAfterAdviceFilter != null && win.rowsAfterAdviceFilter !== win.rowsConsidered ? (
              <StatPill accent="muted">筛后 {win.rowsAfterAdviceFilter} 行</StatPill>
            ) : null}
            <StatPill accent="info">
              标的 <strong>{win.distinctStocks}</strong> 只
            </StatPill>
            {win.batchOnly ? <StatPill>仅批次</StatPill> : null}
            {win.excludeBatch ? <StatPill>无批次</StatPill> : null}
            {win.adviceFilter === 'buy_or_hold' ? <StatPill>买入/持有</StatPill> : null}
            {data?.fromCache ? <StatPill accent="muted">服务端缓存</StatPill> : null}
            {data?.cacheExpiresAt ? (
              <StatPill accent="muted">至 {data.cacheExpiresAt.slice(0, 19).replace('T', ' ')}</StatPill>
            ) : null}
          </div>
        ) : null}
      </section>

      {loadError ? <ApiErrorBanner error={loadError} /> : null}

      {loading && !data ? (
        <section className="card today-loading">
          <span className="today-spinner" />
          <p>正在聚合信号与板块…</p>
        </section>
      ) : null}

      {!loading && data && data.picks.length === 0 ? (
        <section className="card today-empty-card">
          <h2 className="h1">暂无可用信号</h2>
          <p className="lead">
            时间窗内没有符合条件的记录。若使用「仅榜单扫描批次」，请先跑榜单扫描批次；也可改为「全部记录」或「操作建议：全部建议」。
          </p>
        </section>
      ) : null}

      {data && data.picks.length > 0 ? (
        <div className="today-blocks">
          <DigestSection step={1} title="个股（Top 标的）">
            <section className="card today-table-card">
              <div className="today-table-cap">
                <span className="today-table-cap-ico" aria-hidden>
                  📊
                </span>
                <div>
                  <h3 className="today-table-cap-title">规则排序后的窗口内强信号</h3>
                  <p className="today-table-cap-desc">综合得分、出现次数与建议偏向等</p>
                </div>
                {data.picks.some((p) => p.analysisSummaryExcerpt) ? (
                  <p className="today-table-hint">
                    悬停「建议」约 {EXCERPT_HOVER_MS / 1000} 秒可查看摘要摘录
                  </p>
                ) : null}
              </div>
              <div className="today-table-scroll">
                <table className="today-table">
                  <thead>
                    <tr>
                      <th>代码</th>
                      <th>名称</th>
                      <th>得分</th>
                      <th>次数</th>
                      <th>评分</th>
                      <th>建议</th>
                      <th>概念标签</th>
                      <th>趋势</th>
                      <th className="center">自选</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.picks.map((p, i) => (
                      <PickRow key={`${p.code}-${i}`} pick={p} index={i} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </DigestSection>

          <DigestSection step={2} title="概念板块（概念映射共现）">
            <div className="today-co-grid">
              <CoCard
                icon="⊞"
                title="全量"
                description="窗内全部符合条件标的在概念数据中的统计。"
              >
                <TagCloud
                  items={data.conceptHighlightsAll ?? []}
                  emptyHint="暂无概念共现。请确认已导入概念板块数据，或当前标的未命中概念映射。"
                />
              </CoCard>
              <CoCard
                icon="⊞"
                title="Top 标的"
                description="仅针对上表 Top 标的的概念归集。"
              >
                <TagCloud items={data.conceptHighlights ?? []} emptyHint="Top 标的中暂无概念共现数据。" />
              </CoCard>
            </div>
          </DigestSection>

          <DigestSection step={3} title="板块（行业 / 归属板块共现）">
            <div className="today-co-grid">
              <CoCard icon="◧" title="全量" description={`窗内共 ${win?.distinctStocks ?? '—'} 只标的，与 Top K 无关。`}>
                <TagCloud
                  items={data.boardHighlightsAll ?? []}
                  emptyHint="未从分析快照解析到行业/板块归属，或当前窗口无有效板块字段。"
                />
              </CoCard>
              <CoCard icon="◧" title="Top 标的" description="仅当前上表内 Top 标的的归属板块。">
                <TagCloud items={data.boardHighlights} emptyHint="Top 标的中暂无解析到的板块信息。" />
              </CoCard>
            </div>
          </DigestSection>

          <DigestSection step={4} title="AI 叙事">
            <section className="card today-narrative">
              <div className="today-narrative-cap">
                <span aria-hidden>📖</span>
                <div>
                  <h3 className="today-narrative-title">LLM 解读</h3>
                  <p className="today-narrative-sub">基于当前聚合、板块与概念标签生成，仅供参考</p>
                </div>
              </div>
              <div className="today-narrative-body">
                {!withNarrative ? (
                  <p className="muted">已关闭「生成 AI 叙事」。</p>
                ) : data.narrativeMarkdown?.trim() ? (
                  <div className="today-markdown">
                    <Markdown remarkPlugins={[remarkGfm]}>{data.narrativeMarkdown}</Markdown>
                  </div>
                ) : (
                  <div className="chat-alert chat-alert-info">
                    <strong className="chat-alert-title">未生成叙事</strong>
                    <p className="chat-alert-msg">LLM 未返回内容或未配置密钥。上方结构化数据仍可使用。</p>
                  </div>
                )}
              </div>
            </section>
          </DigestSection>
        </div>
      ) : null}
    </div>
  );
}
