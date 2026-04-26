import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen,
  LayoutDashboard,
  LineChart,
  PieChart,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { signalDigestApi } from '../api/signalDigest';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import {
  AdviceBadge,
  ApiErrorAlert,
  Badge,
  Button,
  Card,
  EmptyState,
  InlineAlert,
  ScoreHistoryHoverBadge,
} from '../components/common';
import { cn } from '../utils/cn';
import type { SignalDigestPick, SignalDigestResponse } from '../types/signalDigest';
import { xueqiuStockHref } from '../utils/xueqiu';
import { AddToWatchlistButton } from '../components/watchlist/AddToWatchlistButton';

const CONTROL_CLASS =
  'h-10 w-full rounded-xl border border-border/60 bg-background/80 px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:border-[hsl(var(--primary))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]/20';

/** 悬停约 1.5 秒后展示该行分析摘要摘录（避免误触） */
const EXCERPT_HOVER_MS = 1500;

function StatPill({ children, accent }: { children: React.ReactNode; accent?: 'default' | 'muted' | 'ok' | 'info' }) {
  const acc =
    accent === 'ok'
      ? 'border-emerald-600/35 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300/90'
      : accent === 'info'
        ? 'border-[hsl(var(--primary))]/45 bg-[hsl(var(--primary))]/16 text-foreground'
        : accent === 'muted'
          ? 'border-border/80 bg-hover/40 text-secondary-text'
          : 'border-border/80 bg-hover/30 text-foreground';
  return <span className={cn('inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium tabular-nums', acc)}>{children}</span>;
}

function TagCloud({
  items,
  emptyHint,
  variant = 'default',
  linkToConceptBoards = false,
}: {
  items: { name: string; count: number }[];
  emptyHint: string;
  variant?: 'default' | 'compact';
  linkToConceptBoards?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-xs leading-relaxed text-secondary-text/90">{emptyHint}</p>;
  }
  return (
    <div className={cn('flex flex-wrap gap-1.5', variant === 'compact' && 'gap-1')}>
      {items.map((b) => (
        <Badge
          key={b.name}
          variant="default"
          className={cn('border border-border/70 bg-hover/45 font-medium text-foreground shadow-none', variant === 'compact' && 'text-[11px] py-0')}
        >
          {linkToConceptBoards ? (
            <Link
              to={`/concept-boards?boardName=${encodeURIComponent(b.name)}`}
              className="rounded-sm text-[hsl(var(--primary))] underline-offset-2 hover:underline"
            >
              {b.name}
            </Link>
          ) : (
            b.name
          )}
          <span className="ml-1 tabular-nums text-secondary-text/80">×{b.count}</span>
        </Badge>
      ))}
    </div>
  );
}

const SignalDigestPickRow: React.FC<{ pick: SignalDigestPick; index: number }> = ({ pick: p, index }) => {
  const adviceCellRef = useRef<HTMLTableCellElement>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipPos, setTipPos] = useState({ top: 0, left: 0, width: 320 });
  const hoverTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const syncTipPosition = useCallback(() => {
    const el = adviceCellRef.current;
    if (!el) {
      return;
    }
    const r = el.getBoundingClientRect();
    const desiredW = Math.min(Math.max(r.width, 280), 440);
    let left = r.left + (r.width - desiredW) / 2;
    const margin = 8;
    left = Math.max(margin, Math.min(left, window.innerWidth - desiredW - margin));
    setTipPos({ top: r.bottom + 8, left, width: desiredW });
  }, []);

  useLayoutEffect(() => {
    if (!tipOpen) {
      return;
    }
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
    if (!hasExcerpt) {
      return;
    }
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
            className="pointer-events-none fixed z-[120] max-h-[min(42vh,20rem)] overflow-y-auto rounded-xl border border-border/70 bg-elevated/95 px-3 py-2.5 text-left shadow-lg shadow-black/10 backdrop-blur-md dark:shadow-black/30"
            style={{ top: tipPos.top, left: tipPos.left, width: tipPos.width }}
          >
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-secondary-text">分析摘要摘录</div>
            <p className="text-xs leading-relaxed text-foreground">{excerpt}</p>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <tr
        className={cn(
          'border-b border-border/40 transition-colors last:border-0',
          'hover:bg-hover/40',
          index % 2 === 1 && 'bg-hover/10',
        )}
      >
        <td className="px-3 py-2.5 pl-4 font-mono text-xs tabular-nums text-secondary-text sm:px-4">{p.code}</td>
        <td className="px-3 py-2.5 text-foreground sm:px-4">{nameCell(p.code, p.name)}</td>
        <td className="px-3 py-2.5 tabular-nums text-foreground sm:px-4">{p.score.toFixed(1)}</td>
        <td className="px-3 py-2.5 tabular-nums text-secondary-text sm:px-4">{p.appearanceCount}</td>
        <td className="px-3 py-2.5 sm:px-4">
          <ScoreHistoryHoverBadge stockCode={p.code} score={p.sentimentScore} />
        </td>
        <td
          ref={adviceCellRef}
          className={cn('px-3 py-2.5 sm:px-4', hasExcerpt && 'cursor-help')}
          onMouseEnter={handleRowEnter}
          onMouseLeave={handleRowLeave}
        >
          <AdviceBadge advice={p.operationAdvice} />
        </td>
        <td className="max-w-[14rem] truncate px-3 py-2.5 text-xs text-secondary-text sm:max-w-none sm:px-4">
          {(p.conceptTags || []).join('、') || '—'}
        </td>
        <td className="max-w-[7rem] truncate px-3 py-2.5 text-secondary-text sm:max-w-none sm:px-4">{p.trendPrediction ?? '—'}</td>
        <td className="px-2 py-2.5 text-center align-middle sm:pr-4">
          <AddToWatchlistButton stockCode={p.code} stockName={p.name} compact />
        </td>
      </tr>
      {tip}
    </>
  );
};

function nameCell(code: string, name?: string | null) {
  const href = xueqiuStockHref(code);
  const label = name?.trim() || '—';
  if (href && label !== '—') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-[hsl(var(--primary))] underline-offset-2 hover:underline"
      >
        {label}
      </a>
    );
  }
  return <span className="font-medium">{label}</span>;
}

function CoInsightCard({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      variant="bordered"
      padding="none"
      className={cn('group overflow-hidden border-border/50 transition-shadow hover:shadow-md hover:shadow-black/5', className)}
    >
      <div className="flex items-start gap-2.5 border-b border-border/40 bg-gradient-to-r from-primary/[0.06] via-transparent to-transparent px-3 py-2.5 sm:px-4">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background/60 text-[hsl(var(--primary))]">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold leading-tight text-foreground">{title}</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-secondary-text">{description}</p>
        </div>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </Card>
  );
}

/** 主内容区按「行」分块：序号 + 标题，整行全宽。 */
function DigestContentRow({ step, title, children }: { step: 1 | 2 | 3 | 4; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/30 pb-2">
        <span className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-border/50 bg-hover/40 text-sm font-bold tabular-nums text-[hsl(var(--primary))]">
          {step}
        </span>
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
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

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
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
        refresh: opts?.refresh === true,
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

  const handleRefresh = useCallback(() => {
    void load({ refresh: true });
  }, [load]);

  const win = data?.window;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-6 p-4 pb-8 md:p-6">
      {/* 背景轻装饰 */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[hsl(var(--primary))]/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/60 px-2.5 py-1 text-[11px] text-secondary-text shadow-sm backdrop-blur">
            <LayoutDashboard className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
            <span>近窗分析聚合</span>
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">信号摘要</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-secondary-text">
            在选定交易日窗口内，对分析记录做规则打分与 <strong className="font-medium text-foreground">行业/概念</strong> 共现；默认聚焦榜单扫描中偏
            <strong className="font-medium text-foreground"> 买入/持有</strong> 类标的。可切换数据源与是否生成 AI 解读。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="gap-2 shadow-sm"
            disabled={loading}
            onClick={handleRefresh}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            刷新
          </Button>
        </div>
      </header>

      <Card variant="bordered" padding="none" className="overflow-hidden border-border/50 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border/40 bg-hover/20 px-4 py-2.5">
          <SlidersHorizontal className="h-4 w-4 text-secondary-text" />
          <span className="text-xs font-medium text-foreground">筛选与选项</span>
        </div>
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-5">
            <label className="flex flex-col gap-1.5 text-[11px] font-medium uppercase tracking-wider text-secondary-text/90">
              交易日窗口
              <select
                className={CONTROL_CLASS}
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
            <label className="flex flex-col gap-1.5 text-[11px] font-medium uppercase tracking-wider text-secondary-text/90">
              Top K
              <select className={CONTROL_CLASS} value={topK} onChange={(e) => setTopK(Number(e.target.value))}>
                {[5, 8, 10, 12, 15, 20, 30].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[11px] font-medium uppercase tracking-wider text-secondary-text/90">
              市场
              <select
                className={CONTROL_CLASS}
                value={market}
                onChange={(e) => setMarket(e.target.value as typeof market)}
              >
                <option value="cn">A 股</option>
                <option value="hk">港股</option>
                <option value="us">美股</option>
                <option value="all">全部</option>
              </select>
            </label>
            <label className="col-span-2 flex flex-col gap-1.5 text-[11px] font-medium uppercase tracking-wider text-secondary-text/90 sm:col-span-1">
              数据来源
              <select
                className={CONTROL_CLASS}
                value={recordScope}
                onChange={(e) => setRecordScope(e.target.value as typeof recordScope)}
              >
                <option value="batch">仅榜单扫描批次</option>
                <option value="all">全部记录</option>
                <option value="manual">仅手工/单股</option>
              </select>
            </label>
            <label className="col-span-2 flex flex-col gap-1.5 text-[11px] font-medium uppercase tracking-wider text-secondary-text/90 sm:col-span-1 lg:col-span-1">
              操作建议
              <select
                className={CONTROL_CLASS}
                value={adviceFilter}
                onChange={(e) => setAdviceFilter(e.target.value as typeof adviceFilter)}
              >
                <option value="buy_or_hold">买入或持有类</option>
                <option value="any">全部建议</option>
              </select>
            </label>
            <div className="col-span-2 flex flex-col justify-end sm:col-span-3 lg:col-span-1">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/50 bg-hover/20 px-3 py-2.5 text-sm text-foreground transition-colors hover:border-border hover:bg-hover/35">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/30"
                  checked={withNarrative}
                  onChange={(e) => setWithNarrative(e.target.checked)}
                />
                <span className="text-[13px]">生成 AI 叙事</span>
              </label>
            </div>
          </div>

          {win ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/30 pt-4">
              <span className="mr-1 text-[11px] font-medium text-secondary-text">窗口</span>
              <StatPill accent="ok">
                锚定 <span className="text-foreground">{win.anchorDate}</span>
              </StatPill>
              <StatPill>
                自 <span className="text-foreground/90">{win.oldestDate}</span>
              </StatPill>
              <StatPill accent="muted">
                拉取 <span className="font-semibold text-foreground">{win.rowsConsidered}</span> 行
              </StatPill>
              {win.rowsAfterAdviceFilter != null && win.rowsAfterAdviceFilter !== win.rowsConsidered ? (
                <StatPill accent="muted">筛后 {win.rowsAfterAdviceFilter} 行</StatPill>
              ) : null}
              <StatPill accent="info">
                标的 <span className="font-semibold text-[hsl(var(--primary))]">{win.distinctStocks}</span> 只
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
        </div>
      </Card>

      {loadError ? (
        <div className="max-w-xl">
          <ApiErrorAlert error={loadError} />
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-hover/10 py-12">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-[hsl(var(--primary))]/20 border-t-[hsl(var(--primary))]" />
          <p className="text-sm text-secondary-text">正在聚合信号与板块…</p>
        </div>
      ) : null}

      {!loading && data && data.picks.length === 0 ? (
        <EmptyState
          title="暂无可用信号"
          description="时间窗内没有符合条件的记录。若使用「仅榜单扫描」，请先在榜单扫描页跑批次；也可改为「全部记录」或「操作建议：全部建议」。"
        />
      ) : null}

      {data && data.picks.length > 0 ? (
        <div className="flex flex-col gap-8">
          <DigestContentRow step={1} title="个股（Top 标的）">
            <Card variant="bordered" padding="none" className="overflow-hidden border-border/50 shadow-sm">
              <div className="flex flex-col gap-1 border-b border-border/40 bg-gradient-to-r from-primary/[0.07] to-transparent px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-background/60">
                    <LineChart className="h-4 w-4 text-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">规则排序后的窗口内强信号</h3>
                    <p className="text-[11px] text-secondary-text">综合得分、出现次数、建议偏向等</p>
                  </div>
                </div>
                {data.picks.some((p) => p.analysisSummaryExcerpt) ? (
                  <p className="text-[11px] text-secondary-text sm:max-w-[16rem] sm:text-right">
                    悬停行约 {EXCERPT_HOVER_MS / 1000} 秒查看摘要
                  </p>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-[11px] font-medium uppercase tracking-wide text-secondary-text/90">
                      <th className="sticky top-0 z-10 bg-background/90 px-3 py-2.5 pl-4 font-medium backdrop-blur-sm sm:px-4">代码</th>
                      <th className="sticky top-0 z-10 bg-background/90 px-3 py-2.5 font-medium backdrop-blur-sm sm:px-4">名称</th>
                      <th className="sticky top-0 z-10 bg-background/90 px-3 py-2.5 font-medium backdrop-blur-sm sm:px-4">得分</th>
                      <th className="sticky top-0 z-10 bg-background/90 px-3 py-2.5 font-medium backdrop-blur-sm sm:px-4">次数</th>
                      <th className="sticky top-0 z-10 bg-background/90 px-3 py-2.5 font-medium backdrop-blur-sm sm:px-4">评分</th>
                      <th className="sticky top-0 z-10 bg-background/90 px-3 py-2.5 font-medium backdrop-blur-sm sm:px-4">建议</th>
                      <th className="sticky top-0 z-10 bg-background/90 px-3 py-2.5 font-medium backdrop-blur-sm sm:px-4">概念标签</th>
                      <th className="sticky top-0 z-10 bg-background/90 px-3 py-2.5 font-medium backdrop-blur-sm sm:px-4">趋势</th>
                      <th className="sticky top-0 z-10 bg-background/90 px-2 py-2.5 text-center font-medium backdrop-blur-sm sm:pr-4">自选</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.picks.map((p, i) => (
                      <SignalDigestPickRow key={p.code} pick={p} index={i} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </DigestContentRow>

          <DigestContentRow step={2} title="概念板块（概念映射共现）">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <CoInsightCard
                icon={LayoutDashboard}
                title="全量"
                description="窗内全部符合条件标的在概念数据中的统计。"
              >
                <TagCloud
                  items={data.conceptHighlightsAll ?? []}
                  emptyHint="暂无概念共现。请确认已导入概念板块数据，或当前标的未命中概念映射。"
                  linkToConceptBoards
                />
              </CoInsightCard>
              <CoInsightCard
                icon={LayoutDashboard}
                title="Top 标的"
                description="仅针对上表 Top 标的的概念归集。"
              >
                <TagCloud items={data.conceptHighlights ?? []} emptyHint="Top 标的中暂无概念共现数据。" linkToConceptBoards />
              </CoInsightCard>
            </div>
          </DigestContentRow>

          <DigestContentRow step={3} title="板块（行业/归属板块共现）">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <CoInsightCard
                icon={PieChart}
                title="全量"
                description={`窗内共 ${win?.distinctStocks ?? '—'} 只标的，与 Top K 无关。`}
              >
                <TagCloud
                  items={data.boardHighlightsAll ?? []}
                  emptyHint="未从分析快照解析到行业/板块归属，或当前窗口无有效板块字段。"
                />
              </CoInsightCard>
              <CoInsightCard
                icon={PieChart}
                title="Top 标的"
                description="仅当前上表内 Top 标的的归属板块。"
              >
                <TagCloud
                  items={data.boardHighlights}
                  emptyHint="Top 标的中暂无解析到的板块信息。"
                />
              </CoInsightCard>
            </div>
          </DigestContentRow>

          <DigestContentRow step={4} title="AI 叙事">
            <Card variant="bordered" padding="none" className="overflow-hidden border-border/50 shadow-sm">
              <div className="border-b border-border/40 bg-gradient-to-r from-violet-500/8 to-transparent px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-background/60">
                    <BookOpen className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">LLM 解读</h3>
                    <p className="text-[11px] text-secondary-text">基于当前聚合、板块与概念标签生成，仅供参考</p>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-5">
                {!withNarrative ? (
                  <p className="text-sm text-secondary-text">已关闭「生成 AI 叙事」。</p>
                ) : data.narrativeMarkdown?.trim() ? (
                  <div
                    className="signal-digest-md prose prose-sm max-w-none rounded-xl border border-border/40 bg-hover/10 px-4 py-3 dark:prose-invert"
                  >
                    <Markdown remarkPlugins={[remarkGfm]}>{data.narrativeMarkdown}</Markdown>
                  </div>
                ) : (
                  <InlineAlert
                    variant="info"
                    title="未生成叙事"
                    message="LLM 未返回内容或未配置密钥。上方结构化数据仍可使用。"
                  />
                )}
              </div>
            </Card>
          </DigestContentRow>
        </div>
      ) : null}
    </div>
  );
};

export default SignalDigestPage;
