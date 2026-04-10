import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LayoutDashboard, RefreshCw } from 'lucide-react';
import { signalDigestApi } from '../api/signalDigest';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import {
  ApiErrorAlert,
  Badge,
  Button,
  Card,
  EmptyState,
  InlineAlert,
} from '../components/common';
import type { SignalDigestResponse } from '../types/signalDigest';
import { xueqiuStockHref } from '../utils/xueqiu';

const CONTROL_CLASS =
  'h-10 rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-[hsl(var(--primary))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]/25';

function nameCell(code: string, name?: string | null) {
  const href = xueqiuStockHref(code);
  const label = name?.trim() || '—';
  if (href && label !== '—') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[hsl(var(--primary))] underline-offset-2 hover:underline"
      >
        {label}
      </a>
    );
  }
  return label;
}

const SignalDigestPage: React.FC = () => {
  const [data, setData] = useState<SignalDigestResponse | null>(null);
  const [loadError, setLoadError] = useState<ParsedApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [tradingSessions, setTradingSessions] = useState(14);
  const [topK, setTopK] = useState(10);
  const [market, setMarket] = useState<'cn' | 'hk' | 'us' | 'all'>('cn');
  const [recordScope, setRecordScope] = useState<'batch' | 'all' | 'manual'>('batch');
  const [adviceFilter, setAdviceFilter] = useState<'any' | 'buy_or_hold'>('buy_or_hold');
  const [withNarrative, setWithNarrative] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await signalDigestApi.get({
        tradingSessions,
        topK,
        market,
        batchOnly: recordScope === 'batch',
        excludeBatch: recordScope === 'manual',
        adviceFilter,
        withNarrative,
      });
      setData(res);
    } catch (e) {
      setLoadError(getParsedApiError(e));
    } finally {
      setLoading(false);
    }
  }, [tradingSessions, topK, market, recordScope, adviceFilter, withNarrative]);

  useEffect(() => {
    document.title = '信号摘要 - DSA';
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const win = data?.window;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-gradient text-[hsl(var(--primary-foreground))] shadow-[0_12px_28px_var(--nav-brand-shadow)]">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground md:text-xl">信号摘要</h1>
            <p className="mt-1 max-w-2xl text-sm text-secondary-text">
              默认汇总<strong className="font-medium text-foreground">榜单扫描</strong>批次中、建议为
              <strong className="font-medium text-foreground">买入或持有</strong>
              类标的；也可切换为全部记录或仅手工分析。规则打分与板块共现；可选 AI 短文。
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 gap-2"
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </header>

      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <label className="flex flex-col gap-1 text-xs text-secondary-text">
            交易日窗口
            <select
              className={`${CONTROL_CLASS} min-w-[8rem]`}
              value={tradingSessions}
              onChange={(e) => setTradingSessions(Number(e.target.value))}
            >
              {[7, 10, 14, 20, 30, 45, 60].map((n) => (
                <option key={n} value={n}>
                  {n} 日
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-secondary-text">
            Top K
            <select
              className={`${CONTROL_CLASS} min-w-[6rem]`}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
            >
              {[5, 8, 10, 12, 15, 20, 30].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-secondary-text">
            市场
            <select
              className={`${CONTROL_CLASS} min-w-[7rem]`}
              value={market}
              onChange={(e) => setMarket(e.target.value as typeof market)}
            >
              <option value="cn">A 股</option>
              <option value="hk">港股</option>
              <option value="us">美股</option>
              <option value="all">全部</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-secondary-text">
            数据来源
            <select
              className={`${CONTROL_CLASS} min-w-[10rem]`}
              value={recordScope}
              onChange={(e) => setRecordScope(e.target.value as typeof recordScope)}
            >
              <option value="batch">仅榜单扫描批次</option>
              <option value="all">全部记录</option>
              <option value="manual">仅手工/单股（无批次）</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-secondary-text">
            操作建议
            <select
              className={`${CONTROL_CLASS} min-w-[9rem]`}
              value={adviceFilter}
              onChange={(e) => setAdviceFilter(e.target.value as typeof adviceFilter)}
            >
              <option value="buy_or_hold">买入或持有类</option>
              <option value="any">全部建议</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={withNarrative}
              onChange={(e) => setWithNarrative(e.target.checked)}
            />
            生成 AI 叙事
          </label>
        </div>
        {win ? (
          <p className="mt-4 text-xs text-secondary-text tabular-nums">
            锚定 {win.anchorDate} · 窗口自 {win.oldestDate} · 库内拉取 {win.rowsConsidered} 行
            {win.rowsAfterAdviceFilter != null && win.rowsAfterAdviceFilter !== win.rowsConsidered
              ? ` · 建议筛选后 ${win.rowsAfterAdviceFilter} 行`
              : ''}{' '}
            · 标的 {win.distinctStocks} 只
            {win.batchOnly ? ' · 仅榜单批次' : ''}
            {win.excludeBatch ? ' · 已排除批次' : ''}
            {win.adviceFilter === 'buy_or_hold' ? ' · 建议: 买入/持有类' : ''}
          </p>
        ) : null}
      </Card>

      {loadError ? (
        <div className="max-w-xl">
          <ApiErrorAlert error={loadError} />
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex flex-1 items-center justify-center py-20 text-secondary-text">加载中…</div>
      ) : null}

      {!loading && data && data.picks.length === 0 ? (
        <EmptyState
          title="暂无可用信号"
          description="时间窗内没有符合条件的记录。若使用「仅榜单扫描」，请先在榜单扫描页跑批次；也可改为「全部记录」或「操作建议：全部建议」。"
        />
      ) : null}

      {data && data.picks.length > 0 ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-0 lg:col-span-2">
            <div className="border-b border-border/60 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Top 标的</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-hover/40 text-xs text-secondary-text">
                  <tr>
                    <th className="px-4 py-2 font-medium">代码</th>
                    <th className="px-4 py-2 font-medium">名称</th>
                    <th className="px-4 py-2 font-medium">得分</th>
                    <th className="px-4 py-2 font-medium">次数</th>
                    <th className="px-4 py-2 font-medium">评分</th>
                    <th className="px-4 py-2 font-medium">建议</th>
                    <th className="px-4 py-2 font-medium">趋势</th>
                  </tr>
                </thead>
                <tbody>
                  {data.picks.map((p) => (
                    <tr key={p.code} className="border-t border-border/50">
                      <td className="px-4 py-2 font-mono text-xs tabular-nums text-foreground">{p.code}</td>
                      <td className="px-4 py-2 text-foreground">{nameCell(p.code, p.name)}</td>
                      <td className="px-4 py-2 tabular-nums text-foreground">{p.score.toFixed(1)}</td>
                      <td className="px-4 py-2 tabular-nums text-secondary-text">{p.appearanceCount}</td>
                      <td className="px-4 py-2 tabular-nums text-secondary-text">
                        {p.sentimentScore ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-secondary-text">{p.operationAdvice ?? '—'}</td>
                      <td className="px-4 py-2 text-secondary-text">{p.trendPrediction ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.picks.some((p) => p.analysisSummaryExcerpt) ? (
              <div className="space-y-3 border-t border-border/60 px-4 py-3">
                <h3 className="text-xs font-medium text-secondary-text">摘要摘录</h3>
                <ul className="space-y-2 text-xs text-secondary-text">
                  {data.picks
                    .filter((p) => p.analysisSummaryExcerpt)
                    .map((p) => (
                      <li key={`${p.code}-ex`}>
                        <span className="font-mono text-foreground">{p.code}</span>：{p.analysisSummaryExcerpt}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <div className="flex flex-col gap-6">
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-foreground">板块共现</h2>
              {data.boardHighlights.length === 0 ? (
                <p className="mt-2 text-xs text-secondary-text">当前 Top 标的未解析到归属板块字段。</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.boardHighlights.map((b) => (
                    <Badge key={b.name} variant="default" className="text-xs">
                      {b.name}
                      <span className="ml-1 tabular-nums opacity-70">×{b.count}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-semibold text-foreground">AI 叙事</h2>
              {!withNarrative ? (
                <p className="mt-2 text-xs text-secondary-text">已关闭「生成 AI 叙事」。</p>
              ) : data.narrativeMarkdown?.trim() ? (
                <div className="signal-digest-md prose prose-sm mt-3 max-w-none dark:prose-invert">
                  <Markdown remarkPlugins={[remarkGfm]}>{data.narrativeMarkdown}</Markdown>
                </div>
              ) : (
                <InlineAlert
                  className="mt-3"
                  variant="info"
                  title="未生成叙事"
                  message="LLM 未返回内容或未配置密钥。结构化表格仍可使用。"
                />
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SignalDigestPage;
