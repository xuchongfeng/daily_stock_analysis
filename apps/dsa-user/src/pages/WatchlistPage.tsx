import { useCallback, useEffect, useState } from 'react';

import {
  fetchLatestSummariesForCodes,
  pickLatestSummary,
  type LatestAnalysisSummariesResponse,
} from '../api/historySummaries';
import { useWatchlistStore } from '../stores/watchlistStore';
import { xueqiuStockHref } from '../utils/xueqiuStockHref';

export function WatchlistPage() {
  const codes = useWatchlistStore((s) => s.codes);
  const labels = useWatchlistStore((s) => s.labels);
  const updatedAt = useWatchlistStore((s) => s.updatedAt);
  const loading = useWatchlistStore((s) => s.loading);
  const saving = useWatchlistStore((s) => s.saving);
  const fetch = useWatchlistStore((s) => s.fetch);
  const remove = useWatchlistStore((s) => s.remove);
  const [removing, setRemoving] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<LatestAnalysisSummariesResponse['items']>({});
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);

  useEffect(() => {
    document.title = '自选';
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (loading) return;
      if (codes.length === 0) {
        setSnapshots({});
        setSnapError(null);
        setSnapLoading(false);
        return;
      }
      setSnapLoading(true);
      setSnapError(null);
      void fetchLatestSummariesForCodes(codes)
        .then((r) => {
          if (!cancelled) setSnapshots(r.items || {});
        })
        .catch(() => {
          if (!cancelled) {
            setSnapshots({});
            setSnapError('概要加载失败（评分/板块将显示为「—」）');
          }
        })
        .finally(() => {
          if (!cancelled) setSnapLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [loading, codes]);

  const onRemove = useCallback(
    async (code: string) => {
      setRemoving(code);
      try {
        await remove(code);
      } catch {
        /* optional toast */
      } finally {
        setRemoving(null);
      }
    },
    [remove],
  );

  return (
    <div className="stack watchlist-page">
      <header className="card watchlist-header">
        <h1 className="h1">自选</h1>
        <p className="lead">
          与后端同步；<strong>门户邮箱登录</strong>时为<strong>您个人</strong>的自选（与管理员工作台的全局自选文件隔离）。
        </p>
        {updatedAt ? <p className="account-hint">最近更新：{updatedAt.replace('T', ' ').slice(0, 19)} UTC</p> : null}
      </header>

      <section className="card watchlist-body">
        {loading ? (
          <p className="today-muted">加载中…</p>
        ) : codes.length === 0 ? (
          <p className="lead">暂无自选。可在「今日」个股表或后续支持自选的页面中点击星标加入。</p>
        ) : (
          <div className="watchlist-table-wrap">
            {snapError ? <p className="today-muted watchlist-snap-hint">{snapError}</p> : null}
            {snapLoading ? <p className="today-muted watchlist-snap-hint">正在加载评分与板块…</p> : null}
            <table className="watchlist-table">
              <thead>
                <tr>
                  <th>代码</th>
                  <th>名称</th>
                  <th>最近评分</th>
                  <th>买入评级</th>
                  <th>概念板块</th>
                  <th className="right">操作</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => {
                  const name = labels[code]?.trim() || '—';
                  const href = xueqiuStockHref(code);
                  const snap = pickLatestSummary(snapshots, code);
                  const scoreCell =
                    snap?.sentiment_score != null
                      ? `${snap.sentiment_score}${snap.sentiment_label ? `（${snap.sentiment_label}）` : ''}`
                      : '—';
                  const advice = snap?.operation_advice?.trim() || '—';
                  const tags = snap?.concept_tags?.filter(Boolean) ?? [];

                  return (
                    <tr key={code}>
                      <td className="mono">{code}</td>
                      <td>
                        {href && name !== '—' ? (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="today-link-stock">
                            {name}
                          </a>
                        ) : (
                          name
                        )}
                      </td>
                      <td className="watchlist-score-cell">{scoreCell}</td>
                      <td>{advice}</td>
                      <td className="watchlist-tags-cell">
                        {tags.length ? (
                          <span className="watchlist-concept-tags">
                            {tags.map((t) => (
                              <span key={t} className="watchlist-concept-chip">
                                {t}
                              </span>
                            ))}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="right">
                        <button
                          type="button"
                          className="watchlist-remove"
                          disabled={saving && removing === code}
                          onClick={() => void onRemove(code)}
                        >
                          {removing === code ? '移除中…' : '移除'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
