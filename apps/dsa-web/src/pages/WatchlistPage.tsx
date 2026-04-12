import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, RefreshCw, Sparkles } from 'lucide-react';
import { analysisApi } from '../api/analysis';
import { historyApi } from '../api/history';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import {
  ApiErrorAlert,
  Badge,
  Button,
  Card,
  EmptyState,
  InlineAlert,
  Tooltip,
} from '../components/common';
import type { HistoryItem } from '../types/analysis';
import { getSentimentColor } from '../types/analysis';
import { useWatchlistStore } from '../stores/watchlistStore';

const BATCH_SIZE = 50;
/** 并发拉取历史摘要，避免自选数量较多时瞬间打满连接 */
const INSIGHT_CONCURRENCY = 8;

function operationAdviceShortLabel(advice?: string | null): string {
  const normalized = advice?.trim();
  if (!normalized) {
    return '—';
  }
  if (normalized.includes('减仓')) return '减仓';
  if (normalized.includes('卖')) return '卖出';
  if (normalized.includes('观望') || normalized.includes('等待')) return '观望';
  if (normalized.includes('买') || normalized.includes('布局')) return '买入';
  return normalized.split(/[，。；、\s]/)[0] || '—';
}

const WatchlistPage: React.FC = () => {
  const codes = useWatchlistStore((s) => s.codes);
  const labels = useWatchlistStore((s) => s.labels);
  const updatedAt = useWatchlistStore((s) => s.updatedAt);
  const loading = useWatchlistStore((s) => s.loading);
  const saving = useWatchlistStore((s) => s.saving);
  const fetch = useWatchlistStore((s) => s.fetch);
  const remove = useWatchlistStore((s) => s.remove);

  const [error, setError] = useState<ParsedApiError | null>(null);
  const [analyzeHint, setAnalyzeHint] = useState<string | null>(null);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [latestByCode, setLatestByCode] = useState<Record<string, HistoryItem | null>>({});
  const [insightsLoading, setInsightsLoading] = useState(false);

  const codesKey = useMemo(() => codes.join('\0'), [codes]);

  const loadLatestInsights = useCallback(async (list: string[]) => {
    if (list.length === 0) {
      setLatestByCode({});
      return;
    }
    setInsightsLoading(true);
    const next: Record<string, HistoryItem | null> = {};
    try {
      for (let i = 0; i < list.length; i += INSIGHT_CONCURRENCY) {
        const chunk = list.slice(i, i + INSIGHT_CONCURRENCY);
        await Promise.all(
          chunk.map(async (code) => {
            try {
              const res = await historyApi.getList({ stockCode: code, page: 1, limit: 1 });
              next[code] = res.items[0] ?? null;
            } catch {
              next[code] = null;
            }
          }),
        );
      }
      setLatestByCode(next);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = '我的自选 - DSA';
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  useEffect(() => {
    void loadLatestInsights(codes);
  }, [codesKey, loadLatestInsights, codes]);

  const handleAnalyzeAll = useCallback(async () => {
    if (codes.length === 0) return;
    setError(null);
    setAnalyzeBusy(true);
    setAnalyzeHint(null);
    try {
      for (let i = 0; i < codes.length; i += BATCH_SIZE) {
        const batch = codes.slice(i, i + BATCH_SIZE);
        await analysisApi.analyzeAsync({
          stockCodes: batch,
          reportType: 'detailed',
          asyncMode: true,
          notify: false,
          selectionSource: 'manual',
        });
      }
      setAnalyzeHint(
        `已提交 ${codes.length} 只股票的异步分析（每批最多 ${BATCH_SIZE} 只），请在「分析工作台」查看任务与历史；全部完成后在本页点击「刷新」可更新评分与建议。`,
      );
    } catch (e) {
      setError(getParsedApiError(e));
    } finally {
      setAnalyzeBusy(false);
    }
  }, [codes]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-gradient text-[hsl(var(--primary-foreground))] shadow-[0_12px_28px_var(--nav-brand-shadow)]">
            <Bookmark className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">我的自选</h1>
            <p className="mt-1 max-w-2xl text-sm text-secondary-text">
              列表保存在服务端 JSON 文件（默认 <code className="rounded bg-hover px-1 text-xs">data/watchlist.json</code>
              ，可用环境变量 <code className="rounded bg-hover px-1 text-xs">WATCHLIST_FILE</code>
              覆盖）。表格中<strong className="font-medium text-foreground">评分、建议</strong>来自该股在分析历史中
              <strong className="font-medium text-foreground">最新一条</strong>记录；命令行可执行{' '}
              <code className="rounded bg-hover px-1 text-xs">python main.py --my-watchlist</code> 对自选批量跑分析以更新。
            </p>
            {updatedAt ? (
              <p className="mt-2 text-xs text-secondary-text tabular-nums">最近更新：{updatedAt}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={loading}
            onClick={() => {
              void fetch().then(() => void loadLatestInsights(useWatchlistStore.getState().codes));
            }}
          >
            <RefreshCw className={`h-4 w-4 ${loading || insightsLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="gap-1.5"
            disabled={codes.length === 0 || analyzeBusy}
            onClick={() => void handleAnalyzeAll()}
          >
            <Sparkles className="h-4 w-4" />
            {analyzeBusy ? '提交中…' : '批量分析更新评分'}
          </Button>
        </div>
      </header>

      {error ? (
        <div className="max-w-xl">
          <ApiErrorAlert error={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}

      {analyzeHint ? (
        <InlineAlert variant="info" className="text-sm" message={analyzeHint} />
      ) : null}

      <Card padding="md" variant="bordered">
        {loading && codes.length === 0 ? (
          <p className="py-10 text-center text-sm text-secondary-text">加载中…</p>
        ) : codes.length === 0 ? (
          <EmptyState
            title="暂无自选"
            description="在信号摘要、分析工作台、榜单扫描等页面使用「加入自选」即可写入本列表。"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border/60 text-xs text-secondary-text">
                <tr>
                  <th className="py-2 pr-3 font-medium">代码</th>
                  <th className="py-2 pr-3 font-medium">名称</th>
                  <th className="py-2 pr-3 font-medium">AI 评分</th>
                  <th className="py-2 pr-3 font-medium">买卖建议</th>
                  <th className="py-2 pr-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => {
                  const latest = latestByCode[c];
                  const score = latest?.sentimentScore;
                  const advice = latest?.operationAdvice;
                  const scoreColor =
                    score !== undefined && score !== null ? getSentimentColor(Number(score)) : null;
                  const nameCell = labels[c]?.trim() || latest?.stockName?.trim() || '—';
                  return (
                    <tr key={c} className="border-t border-border/40">
                      <td className="py-2 pr-3 font-mono text-foreground">{c}</td>
                      <td className="max-w-[10rem] truncate py-2 pr-3 text-secondary-text" title={nameCell}>
                        {nameCell}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {score !== undefined && score !== null ? (
                          <Badge
                            variant="default"
                            size="sm"
                            className="font-semibold tabular-nums"
                            style={{
                              color: scoreColor || undefined,
                              borderColor: scoreColor ? `${scoreColor}40` : undefined,
                              backgroundColor: scoreColor ? `${scoreColor}14` : undefined,
                            }}
                          >
                            {score}
                          </Badge>
                        ) : (
                          <span className="text-secondary-text">—</span>
                        )}
                      </td>
                      <td className="max-w-[14rem] py-2 pr-3 text-xs text-foreground">
                        {advice?.trim() ? (
                          <Tooltip content={advice.trim()} focusable>
                            <span className="block cursor-default truncate font-medium">
                              {operationAdviceShortLabel(advice)}
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="text-secondary-text">暂无分析</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to="/analyze"
                            className="text-xs font-medium text-[hsl(var(--primary))] underline-offset-2 hover:underline"
                          >
                            去分析
                          </Link>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={saving}
                            onClick={() => void remove(c)}
                          >
                            移除
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default WatchlistPage;
