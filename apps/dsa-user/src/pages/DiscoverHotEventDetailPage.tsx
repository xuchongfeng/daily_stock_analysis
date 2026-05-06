import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { discoverHotEventsApi } from '../api/discoverHotEvents';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import { PortfolioApiErrorBanner } from '../components/portfolio/UserPortfolioUi';
import type { HotEventDetail, HotEventTimelineItem } from '../types/discoverHotEvent';
import { xueqiuStockHref } from '../utils/xueqiuStockHref';

function timelineKindClass(kind: string | undefined): string {
  const k = (kind || 'news').toLowerCase();
  if (k === 'policy') return 'discover-hot-tl-policy';
  if (k === 'market') return 'discover-hot-tl-market';
  if (k === 'data') return 'discover-hot-tl-data';
  return 'discover-hot-tl-news';
}

function sortTimelineChrono(items: HotEventTimelineItem[]): HotEventTimelineItem[] {
  return [...items].sort((a, b) => {
    const da = a.occurredOn || '';
    const db = b.occurredOn || '';
    if (da !== db) return da.localeCompare(db);
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

export function DiscoverHotEventDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [detail, setDetail] = useState<HotEventDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);

  const load = useCallback(async () => {
    const key = slug.trim();
    if (!key) return;
    setLoading(true);
    setError(null);
    try {
      const d = await discoverHotEventsApi.getDetail(key);
      setDetail(d);
    } catch (e) {
      setError(getParsedApiError(e));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    document.title = detail?.title ? `${detail.title} · 热点` : '热点事件';
  }, [detail?.title]);

  const chronTimeline = useMemo(() => sortTimelineChrono(detail?.timeline || []), [detail?.timeline]);

  return (
    <div className="stack discover-hot-page discover-hot-detail-page">
      <section className="card">
        <Link to="/discover/events" className="user-portfolio-chat-link discover-sector-back-link">
          ← 热点列表
        </Link>
        {loading ? <p className="today-muted">加载中…</p> : null}
        {!loading && detail ? (
          <>
            <h1 className="h1 discover-sector-page-title">{detail.title}</h1>
            <p className="discover-hot-meta">
              <span className="mono">{detail.market ?? 'cn'}</span>
              {detail.startedAt ? (
                <>
                  {' '}
                  · 起于 <span className="mono">{detail.startedAt}</span>
                </>
              ) : null}
              {detail.updatedAt ? (
                <>
                  {' '}
                  · 更新 <span className="mono">{detail.updatedAt}</span>
                </>
              ) : null}
            </p>
            {detail.summary ? <p className="lead discover-hot-lead">{detail.summary}</p> : null}
          </>
        ) : null}
      </section>

      {error ? <PortfolioApiErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      {!loading && detail ? (
        <>
          {(detail.coreMetrics?.length ?? 0) > 0 ? (
            <section className="card discover-hot-section">
              <h2 className="h2 discover-hot-h2">核心数据</h2>
              <div className="discover-hot-metrics">
                {detail.coreMetrics!.map((m, i) => (
                  <div key={`${m.label}-${i}`} className="discover-hot-metric">
                    <div className="discover-hot-metric-label">{m.label}</div>
                    <div className="discover-hot-metric-value">{m.value ?? '—'}</div>
                    {m.hint ? <div className="discover-hot-metric-hint">{m.hint}</div> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {(detail.boards?.length ?? 0) > 0 ? (
            <section className="card discover-hot-section">
              <h2 className="h2 discover-hot-h2">关联板块</h2>
              <ul className="discover-hot-boards">
                {detail.boards!.map((b) => (
                  <li key={b.boardCode}>
                    <Link
                      to={`/discover/sectors?boardCode=${encodeURIComponent(b.boardCode)}`}
                      className="discover-hot-board-link"
                    >
                      <span className="discover-hot-board-name">{b.boardName || b.boardCode}</span>
                      <span className="mono discover-hot-board-code">{b.boardCode}</span>
                      {typeof b.stocksCount === 'number' ? (
                        <span className="today-muted text-xs">{b.stocksCount} 成分</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {(detail.anchorStocks?.length ?? 0) > 0 ? (
            <section className="card discover-hot-section">
              <h2 className="h2 discover-hot-h2">关联个股</h2>
              <table className="watchlist-table discover-hot-stock-table">
                <thead>
                  <tr>
                    <th>代码</th>
                    <th>名称</th>
                    <th>角色</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.anchorStocks!.map((s) => {
                    const href = xueqiuStockHref(s.stockCode);
                    return (
                      <tr key={s.stockCode}>
                        <td className="mono">{s.stockCode}</td>
                        <td>
                          {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="today-link-stock">
                              {s.stockName?.trim() || '—'}
                            </a>
                          ) : (
                            (s.stockName?.trim() || '—')
                          )}
                        </td>
                        <td className="today-muted">{s.role?.trim() || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ) : null}

          <section className="card discover-hot-section">
            <h2 className="h2 discover-hot-h2">事件演进</h2>
            {chronTimeline.length === 0 ? (
              <p className="today-muted">暂无时间线节点。</p>
            ) : (
              <ol className="discover-hot-timeline">
                {chronTimeline.map((t, idx) => (
                  <li key={`${t.occurredOn}-${idx}-${t.headline}`} className="discover-hot-tl-item">
                    <div className={`discover-hot-tl-dot ${timelineKindClass(t.kind)}`} aria-hidden />
                    <div className="discover-hot-tl-body">
                      <div className="discover-hot-tl-date mono">{t.occurredOn || '—'}</div>
                      <div className="discover-hot-tl-headline">{t.headline}</div>
                      {t.body ? <p className="discover-hot-tl-text">{t.body}</p> : null}
                      {t.linkUrl ? (
                        <a
                          href={t.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="today-link-stock discover-hot-tl-link"
                        >
                          参考链接
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {detail.sourceNote ? (
            <section className="card discover-hot-disclaimer">
              <p className="today-muted text-sm discover-hot-disclaimer-p">{detail.sourceNote}</p>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
