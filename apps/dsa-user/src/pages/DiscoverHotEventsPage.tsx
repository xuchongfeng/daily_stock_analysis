import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { discoverHotEventsApi } from '../api/discoverHotEvents';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import { PortfolioApiErrorBanner } from '../components/portfolio/UserPortfolioUi';
import type { HotEventSummary } from '../types/discoverHotEvent';

function heatClass(score: number): string {
  if (score >= 70) return 'discover-hot-heat-high';
  if (score >= 40) return 'discover-hot-heat-mid';
  return 'discover-hot-heat-low';
}

export function DiscoverHotEventsPage() {
  const [items, setItems] = useState<HotEventSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await discoverHotEventsApi.list({ limit: 80 });
      setItems(res.items || []);
    } catch (e) {
      setError(getParsedApiError(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = '发现 · 热点事件';
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return (
    <div className="stack discover-hot-page">
      <section className="card">
        <Link to="/discover" className="user-portfolio-chat-link discover-sector-back-link">
          ← 返回发现
        </Link>
        <h1 className="h1 discover-sector-page-title">热点事件</h1>
        <p className="lead today-muted discover-sector-lead">
          跟进主题脉络、关联板块与代表性个股；内容由运营策展导入，持续更新。
        </p>
      </section>

      {error ? <PortfolioApiErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      <section className="card discover-hot-list-card">
        <div className="discover-hot-list-head">
          <h2 className="h2 discover-hot-h2">进行中主题</h2>
          {loading ? <span className="today-muted text-sm">加载中…</span> : null}
        </div>
        {!loading && items.length === 0 ? (
          <p className="today-muted discover-hot-empty">
            暂无热点条目。部署后可运行仓库脚本{' '}
            <code className="mono text-xs">python scripts/seed_discover_hot_events.py</code>{' '}
            导入示例数据，或替换 <span className="mono text-xs">data/discover_hot_events_seed.json</span>{' '}
            后重新导入。
          </p>
        ) : (
          <ul className="discover-hot-cards">
            {items.map((ev) => (
              <li key={ev.slug}>
                <Link to={`/discover/events/${encodeURIComponent(ev.slug)}`} className="discover-hot-card">
                  <div className="discover-hot-card-top">
                    <span className={`discover-hot-heat ${heatClass(Number(ev.heatScore ?? 0))}`}>
                      热度 {ev.heatScore ?? 0}
                    </span>
                    <span className="discover-hot-market">{ev.market ?? 'cn'}</span>
                  </div>
                  <h3 className="discover-hot-card-title">{ev.title}</h3>
                  {ev.summary ? <p className="discover-hot-card-sum">{ev.summary}</p> : null}
                  {(ev.boardCodes?.length ?? 0) > 0 ? (
                    <div className="discover-hot-chips">
                      {ev.boardCodes!.slice(0, 6).map((c) => (
                        <span key={c} className="discover-hot-chip">
                          {c}
                        </span>
                      ))}
                      {(ev.boardCodes!.length ?? 0) > 6 ? (
                        <span className="discover-hot-chip-muted">+{ev.boardCodes!.length - 6}</span>
                      ) : null}
                    </div>
                  ) : null}
                  <span className="discover-hot-card-cta">查看演进与关联 →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
