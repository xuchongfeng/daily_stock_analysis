import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  fetchLatestSummariesForCodes,
  pickLatestSummary,
  type LatestAnalysisSummariesResponse,
} from '../api/historySummaries';
import { getParsedApiError } from '../api/error';
import { workbenchAnalysisApi } from '../api/workbenchAnalysis';
import { WatchlistScoreHover } from '../components/WatchlistScoreHover';
import { useWatchlistStore } from '../stores/watchlistStore';
import type { BatchTaskAcceptedResponse } from '../types/workbenchAnalysis';
import { xueqiuStockHref } from '../utils/xueqiuStockHref';

const MAX_WATCHLIST_BATCH = 50;

type SortMode = 'default' | 'score_desc' | 'score_asc';

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
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchHint, setBatchHint] = useState<string | null>(null);

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

  const sortedCodes = useMemo(() => {
    const list = [...codes];
    if (sortMode === 'default') {
      return list;
    }
    return list.sort((a, b) => {
      const sa = pickLatestSummary(snapshots, a)?.sentiment_score;
      const sb = pickLatestSummary(snapshots, b)?.sentiment_score;
      const na = sa == null || !Number.isFinite(Number(sa)) ? null : Number(sa);
      const nb = sb == null || !Number.isFinite(Number(sb)) ? null : Number(sb);
      if (na == null && nb == null) return a.localeCompare(b);
      if (na == null) return 1;
      if (nb == null) return -1;
      const cmp = sortMode === 'score_desc' ? nb - na : na - nb;
      if (cmp !== 0) return cmp;
      return a.localeCompare(b);
    });
  }, [codes, snapshots, sortMode]);

  const runBatchAnalyze = useCallback(
    async (notify: boolean) => {
      if (codes.length === 0 || batchBusy) return;
      setBatchBusy(true);
      setBatchHint(null);
      const list = codes.slice(0, MAX_WATCHLIST_BATCH);
      try {
        const res = await workbenchAnalysisApi.analyzeAsync({
          stockCodes: list,
          notify,
          selectionSource: 'import',
          reportType: 'detailed',
        });
        const batch = res as BatchTaskAcceptedResponse;
        if (batch.accepted && Array.isArray(batch.accepted)) {
          const dup = batch.duplicates?.length ?? 0;
          setBatchHint(
            `已提交 ${batch.accepted.length} 个分析任务${dup ? `，${dup} 只因队列中已有任务跳过` : ''}${notify ? '；已请求推送通知。' : '；未请求推送通知。'}`,
          );
        } else {
          setBatchHint(notify ? '分析任务已提交（含推送请求）。' : '分析任务已提交。');
        }
      } catch (e) {
        setBatchHint(getParsedApiError(e).message || '批量提交失败');
      } finally {
        setBatchBusy(false);
      }
    },
    [batchBusy, codes],
  );

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
        {updatedAt ? <p className="account-hint">最近更新：{updatedAt.replace('T', ' ').slice(0, 19)} UTC</p> : null}
      </header>

      <section className="card watchlist-body">
        {loading ? (
          <p className="today-muted">加载中…</p>
        ) : codes.length === 0 ? (
          <p className="lead">暂无自选。可在「今日」个股表或后续支持自选的页面中点击星标加入。</p>
        ) : (
          <div className="watchlist-table-wrap">
            <div className="watchlist-toolbar">
              <label className="watchlist-sort-label">
                <span className="watchlist-sort-text">排序</span>
                <select
                  className="watchlist-sort-select"
                  value={sortMode}
                  onChange={(ev) => setSortMode(ev.target.value as SortMode)}
                  aria-label="自选排序"
                >
                  <option value="default">默认顺序</option>
                  <option value="score_desc">评分从高到低</option>
                  <option value="score_asc">评分从低到高</option>
                </select>
              </label>
              <button
                type="button"
                className="watchlist-batch-btn"
                disabled={batchBusy}
                onClick={() => void runBatchAnalyze(false)}
              >
                {batchBusy ? '提交中…' : '批量分析'}
              </button>
              <button
                type="button"
                className="watchlist-batch-btn watchlist-batch-btn-primary"
                disabled={batchBusy}
                onClick={() => void runBatchAnalyze(true)}
              >
                {batchBusy ? '提交中…' : '批量分析并推送通知'}
              </button>
              <Link to="/chat" className="watchlist-batch-link">
                在工作台查看任务进度 →
              </Link>
            </div>
            {batchHint ? <p className="watchlist-batch-hint">{batchHint}</p> : null}
            {codes.length > MAX_WATCHLIST_BATCH ? (
              <p className="today-muted watchlist-snap-hint">
                单次批量分析最多 {MAX_WATCHLIST_BATCH} 只，将按当前列表顺序提交前 {MAX_WATCHLIST_BATCH} 只。
              </p>
            ) : null}
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
                {sortedCodes.map((code) => {
                  const name = labels[code]?.trim() || '—';
                  const href = xueqiuStockHref(code);
                  const snap = pickLatestSummary(snapshots, code);
                  const scoreCell =
                    snap?.sentiment_score != null
                      ? `${snap.sentiment_score}${snap.sentiment_label ? `（${snap.sentiment_label}）` : ''}`
                      : '—';
                  const advice = snap?.operation_advice?.trim() || '—';
                  const excerpt = snap?.analysis_summary_excerpt?.trim();
                  const tags = snap?.concept_tags?.filter(Boolean) ?? [];
                  const adviceTitle =
                    excerpt && excerpt.length > 0 ? `${advice}\n\n【摘要】${excerpt}` : advice;

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
                      <td className="watchlist-score-cell">
                        {snap?.sentiment_score != null ? (
                          <WatchlistScoreHover
                            stockCode={(snap.stock_code && snap.stock_code.trim()) || code}
                            label={scoreCell}
                          />
                        ) : (
                          scoreCell
                        )}
                      </td>
                      <td className="watchlist-advice-cell" title={adviceTitle}>
                        {advice}
                      </td>
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
