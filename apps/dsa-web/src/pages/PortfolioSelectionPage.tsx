import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { signalDigestApi } from '../api/signalDigest';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import type { PortfolioSelectionResponse } from '../types/signalDigest';
import {
  AdviceBadge,
  ApiErrorAlert,
  Badge,
  Button,
  Card,
  EmptyState,
  ScoreHistoryHoverBadge,
} from '../components/common';
import { xueqiuStockHref } from '../utils/xueqiu';

const TARGET_COUNT = 12;

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

const PortfolioSelectionPage: React.FC = () => {
  const [strategyId, setStrategyId] = useState<'strategy_1'>('strategy_1');
  const [tradingSessions, setTradingSessions] = useState(14);
  const [backtestEvalWindowDays, setBacktestEvalWindowDays] = useState(10);
  const [signalDate, setSignalDate] = useState('');
  const [signalDateOptions, setSignalDateOptions] = useState<string[]>([]);
  const [data, setData] = useState<PortfolioSelectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    const refresh = Boolean(opts?.refresh);
    setError(null);
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const payload = await signalDigestApi.getPortfolioSelection({
        strategyId,
        tradingSessions,
        backtestEvalWindowDays,
        signalDate: signalDate || undefined,
        topK: 100,
        market: 'cn',
        excludeBatch: false,
        batchOnly: true,
        adviceFilter: 'buy_or_hold',
      });
      setData(payload);
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [strategyId, tradingSessions, backtestEvalWindowDays, signalDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const fetchSignalDates = async () => {
      try {
        const rsp = await signalDigestApi.listSnapshotDates({
          tradingSessions,
          topK: 100,
          market: 'cn',
          excludeBatch: false,
          batchOnly: true,
          adviceFilter: 'buy_or_hold',
        });
        setSignalDateOptions(rsp.items ?? []);
      } catch {
        setSignalDateOptions([]);
      }
    };
    void fetchSignalDates();
  }, [tradingSessions]);

  const selected = useMemo(() => (data?.selected ?? []).slice(0, TARGET_COUNT), [data]);
  const boardStats = useMemo(() => data?.boards ?? [], [data]);
  const backtestByCode = useMemo(() => {
    const map = new Map<string, {
      code: string;
      hasData: boolean;
      totalEvaluations?: number;
      completedCount?: number;
      winRatePct?: number | null;
      directionAccuracyPct?: number | null;
      avgSimulatedReturnPct?: number | null;
    }>();
    (data?.backtestByStock ?? []).forEach((row) => {
      if (row.code) {
        map.set(row.code, row);
      }
    });
    return map;
  }, [data]);

  return (
    <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-4 p-4 md:p-5">
      <Card className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">组合选股</h1>
            <p className="mt-1 text-sm text-secondary-text">支持多策略扩展，当前已上线策略1（概念强度配额精选）。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground"
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value as 'strategy_1')}
              disabled={loading || refreshing}
            >
              {(data?.strategyOptions ?? []).map((opt) => (
                <option key={opt.strategyId} value={opt.strategyId}>
                  {opt.name}
                </option>
              ))}
              {(data?.strategyOptions ?? []).length === 0 ? (
                <option value="strategy_1">策略1：概念强度配额精选</option>
              ) : null}
            </select>
            <select
              className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground"
              value={backtestEvalWindowDays}
              onChange={(e) => setBacktestEvalWindowDays(Number(e.target.value))}
              disabled={loading || refreshing}
            >
              {[5, 10, 20].map((v) => (
                <option key={v} value={v}>
                  回测窗口 {v} 日
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground"
              value={tradingSessions}
              onChange={(e) => setTradingSessions(Number(e.target.value))}
              disabled={loading || refreshing}
            >
              {[3, 14, 30, 60].map((v) => (
                <option key={v} value={v}>
                  交易日窗口 {v} 日
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground"
              value={signalDate}
              onChange={(e) => setSignalDate(e.target.value)}
              disabled={loading || refreshing}
            >
              <option value="">信号日期：最新</option>
              {signalDateOptions.map((d) => (
                <option key={d} value={d}>
                  信号日期：{d}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              onClick={() => void load({ refresh: true })}
              disabled={loading || refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-border/60 bg-hover/20 p-3">
          <div className="text-sm font-medium text-foreground">{data?.strategy.name ?? '策略1：概念强度配额精选'}</div>
          <div className="mt-1 text-xs leading-relaxed text-secondary-text">
            {data?.strategy.description ??
              '先按概念板块强度选 Top4，再按每板块 Top5 候选形成 20 只池子，按板块样本比例配额并保证每板块至少2只，最终选出12只。'}
          </div>
        </div>
      </Card>

      {error ? <ApiErrorAlert error={error} /> : null}

      {boardStats.length > 0 ? (
        <Card className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">板块强度与配额</h2>
            <Badge variant="default" className="border-border/70 bg-hover/40 text-foreground">
              Top{data?.strategy.topBoardCount ?? 4}
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {boardStats.map((board) => (
              <div key={board.name} className="rounded-xl border border-border/60 bg-hover/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-foreground">{board.name}</div>
                  <Badge variant="default" className="border-border/70 bg-background/70 text-foreground">
                    配额 {board.quota}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-secondary-text">
                  <span>强度 {board.boardStrength.toFixed(3)}</span>
                  <span>样本 {board.stockCount}</span>
                  <span>75+ {board.highScoreCount}</span>
                  <span>75+占比(修正) {(board.highScoreRatioAdj * 100).toFixed(1)}%</span>
                  <span>候选 {board.candidateCount}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">回测概览</h2>
          <Badge variant="default" className="border-border/70 bg-hover/40 text-foreground">
            窗口 {data?.backtestOverview?.evalWindowDays ?? backtestEvalWindowDays} 日
          </Badge>
        </div>
        <div className="mb-3 rounded-xl border border-border/60 bg-hover/20 px-3 py-2 text-xs text-secondary-text">
          当前展示为：基于信号日期
          <span className="mx-1 font-mono text-foreground">
            {data?.backtestOverview?.signalDate ?? data?.window?.anchorDate ?? '—'}
          </span>
          生成的榜单股票，并按该信号日期过滤回测结果后展示统计。
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-5">
          <div className="rounded-xl border border-border/60 bg-hover/20 p-3">
            <div className="text-xs text-secondary-text">入选股票</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{data?.backtestOverview?.selectedCount ?? 0}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-hover/20 p-3">
            <div className="text-xs text-secondary-text">有回测数据</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{data?.backtestOverview?.coveredCount ?? 0}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-hover/20 p-3">
            <div className="text-xs text-secondary-text">平均胜率</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {data?.backtestOverview?.avgWinRatePct != null ? `${data.backtestOverview.avgWinRatePct.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-hover/20 p-3">
            <div className="text-xs text-secondary-text">平均方向准确率</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {data?.backtestOverview?.avgDirectionAccuracyPct != null
                ? `${data.backtestOverview.avgDirectionAccuracyPct.toFixed(1)}%`
                : '—'}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-hover/20 p-3">
            <div className="text-xs text-secondary-text">平均模拟收益</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {data?.backtestOverview?.avgSimulatedReturnPct != null
                ? `${data.backtestOverview.avgSimulatedReturnPct.toFixed(2)}%`
                : '—'}
            </div>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border border-border/70 bg-card/95 p-0 shadow-sm">
        <div className="border-b border-border/50 px-4 py-3 text-sm text-secondary-text">
          {data?.window ? (
            <span>
              统计窗口：{data.window.oldestDate} 至 {data.window.anchorDate}（{data.window.tradingSessions}个交易日）
            </span>
          ) : (
            '暂无窗口信息'
          )}
        </div>
        {loading ? (
          <div className="px-4 py-8 text-sm text-secondary-text">加载中...</div>
        ) : selected.length === 0 ? (
          <EmptyState title="暂无可用选股结果" description="请先刷新一次信号摘要数据后再查看。" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-hover/20 text-left text-xs uppercase tracking-wide text-secondary-text">
                  <th className="px-4 py-2.5">代码</th>
                  <th className="px-4 py-2.5">名称</th>
                  <th className="px-4 py-2.5">综合分</th>
                  <th className="px-4 py-2.5">评分</th>
                  <th className="px-4 py-2.5">建议</th>
                  <th className="px-4 py-2.5">归属板块</th>
                  <th className="px-4 py-2.5">入选原因</th>
                  <th className="px-4 py-2.5">回测样本/完成</th>
                  <th className="px-4 py-2.5">回测胜率</th>
                  <th className="px-4 py-2.5">回测方向准确率</th>
                  <th className="px-4 py-2.5">回测平均模拟收益</th>
                  <th className="px-4 py-2.5">概念标签</th>
                </tr>
              </thead>
              <tbody>
                {selected.map((pick, index) => {
                  const bt = backtestByCode.get(pick.code);
                  return (
                    <tr
                      key={`${pick.code}-${index}`}
                      className={`border-b border-border/40 text-foreground last:border-0 ${
                        index % 2 === 1 ? 'bg-hover/10' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-secondary-text">{pick.code}</td>
                      <td className="px-4 py-2.5">{nameCell(pick.code, pick.name)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{pick.score.toFixed(1)}</td>
                      <td className="px-4 py-2.5">
                        <ScoreHistoryHoverBadge stockCode={pick.code} score={pick.sentimentScore} />
                      </td>
                      <td className="px-4 py-2.5">
                        <AdviceBadge advice={pick.operationAdvice} />
                      </td>
                      <td className="px-4 py-2.5 text-xs">{pick.boardName}</td>
                      <td className="px-4 py-2.5 text-xs text-secondary-text">{pick.selectedReason}</td>
                      <td className="px-4 py-2.5 text-xs tabular-nums">
                        {bt?.hasData ? `${bt.totalEvaluations ?? 0} / ${bt.completedCount ?? 0}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {bt?.winRatePct != null ? `${bt.winRatePct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {bt?.directionAccuracyPct != null ? `${bt.directionAccuracyPct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {bt?.avgSimulatedReturnPct != null ? `${bt.avgSimulatedReturnPct.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-secondary-text">
                        {(pick.conceptTags ?? []).join('、') || '—'}
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

export default PortfolioSelectionPage;
