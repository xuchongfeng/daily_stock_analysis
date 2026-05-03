/* eslint-disable react-hooks/set-state-in-effect -- mount / accountId / costMethod 触发拉取 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pie, PieChart, ResponsiveContainer, Tooltip, Legend, Cell } from 'recharts';

import type { ParsedApiError } from '../../api/error';
import { getParsedApiError } from '../../api/error';
import { portfolioApi } from '../../api/portfolio';
import { DuplicateTaskErrorWorkbench, workbenchAnalysisApi } from '../../api/workbenchAnalysis';
import { workbenchHistoryApi } from '../../api/workbenchHistory';
import { AddToWatchlistCompact } from '../../components/AddToWatchlistCompact';
import {
  PortfolioApiErrorBanner,
  PortfolioBadge,
  PortfolioCard,
  PortfolioEmpty,
  PortfolioInlineAlert,
} from '../../components/portfolio/UserPortfolioUi';
import { PortfolioAdviceBadge } from '../../components/portfolio/PortfolioSignalBadges';
import { PortfolioScoreHistoryBadge } from '../../components/portfolio/PortfolioScoreHistoryBadge';
import { pollAnalysisTask } from '../../utils/analysisTaskPoll';
import type {
  PortfolioAccountItem,
  PortfolioCostMethod,
  PortfolioFxRefreshResponse,
  PortfolioPositionItem,
  PortfolioRiskResponse,
  PortfolioSnapshotResponse,
} from '../../types/portfolio';
import { formatMoney, formatPct } from './portfolioFormat';
import { getPortfolioAccountPrefs } from './portfolioAccountPrefs';

const PIE_COLORS = ['#00d4ff', '#00ff88', '#ffaa00', '#ff7a45', '#7f8cff', '#ff4466'];
const MAX_PORTFOLIO_CHECKUP_STOCKS = 50;

type FlatPosition = PortfolioPositionItem & {
  accountId: number;
  accountName: string;
};

type PortfolioCheckupRow = {
  symbol: string;
  status: 'queued' | 'completed' | 'failed' | 'duplicate' | 'error';
  stockName?: string | null;
  sentimentScore?: number | null;
  operationAdvice?: string | null;
  conceptTags?: string[];
  analysisSummary?: string | null;
  error?: string | null;
};

function truncateSummaryText(text: string, maxLen: number): string {
  const s = (text || '').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
}

function portfolioSymbolsLooselyEqual(a: string, b: string): boolean {
  const x = (a || '').trim().toUpperCase();
  const y = (b || '').trim().toUpperCase();
  if (x === y) return true;
  const strip = (s: string) => s.replace(/^(SH|SZ|HK|US|BJ)/, '');
  return strip(x) === strip(y);
}

function portfolioCheckupStatusLabel(row: PortfolioCheckupRow, checkupRunning: boolean): string {
  if (row.status === 'duplicate') return '跳过(队列中已有)';
  if (row.status === 'queued' && checkupRunning) return '分析中…';
  if (row.status === 'queued') return '排队';
  if (row.status === 'completed') return '完成';
  if (row.status === 'failed' || row.status === 'error') return '失败';
  return '—';
}

type FxRefreshFeedback = { tone: 'neutral' | 'success' | 'warning'; text: string };
type FxRefreshContext = { viewKey: string; requestId: number };

function buildFxRefreshFeedback(data: PortfolioFxRefreshResponse): FxRefreshFeedback {
  if (data.refreshEnabled === false) {
    return { tone: 'neutral', text: '汇率在线刷新已被禁用。' };
  }
  if (data.pairCount === 0) {
    return { tone: 'neutral', text: '当前范围无可刷新的汇率对。' };
  }
  if (data.updatedCount > 0 && data.staleCount === 0 && data.errorCount === 0) {
    return { tone: 'success', text: `汇率已刷新，共更新 ${data.updatedCount} 对。` };
  }
  const summary = `更新 ${data.updatedCount} 对，仍过期 ${data.staleCount} 对，失败 ${data.errorCount} 对。`;
  if (data.staleCount > 0) {
    return { tone: 'warning', text: `已尝试刷新，但仍有部分货币对使用 stale/fallback 汇率。${summary}` };
  }
  return { tone: 'warning', text: `在线刷新未完全成功。${summary}` };
}

function fxVariant(tone: FxRefreshFeedback['tone']): 'info' | 'success' | 'warning' {
  if (tone === 'success') return 'success';
  if (tone === 'warning') return 'warning';
  return 'info';
}

const SEL = 'user-portfolio-input user-portfolio-select';

export function PortfolioAccountDetailPage() {
  useEffect(() => {
    document.title = '持仓 · 明细';
  }, []);

  const params = useParams();
  const accountId = Number(params.accountId);
  const validId = Number.isFinite(accountId) && accountId > 0;

  const [accounts, setAccounts] = useState<PortfolioAccountItem[]>([]);
  const [accountsReady, setAccountsReady] = useState(false);
  const [costMethod, setCostMethod] = useState<PortfolioCostMethod>('fifo');
  const [snapshot, setSnapshot] = useState<PortfolioSnapshotResponse | null>(null);
  const [risk, setRisk] = useState<PortfolioRiskResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fxRefreshing, setFxRefreshing] = useState(false);
  const [fxRefreshFeedback, setFxRefreshFeedback] = useState<FxRefreshFeedback | null>(null);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [riskWarning, setRiskWarning] = useState<string | null>(null);

  const [checkupLoading, setCheckupLoading] = useState(false);
  const [checkupRows, setCheckupRows] = useState<PortfolioCheckupRow[]>([]);
  const [checkupBanner, setCheckupBanner] = useState<string | null>(null);
  const checkupAbortRef = useRef<AbortController | null>(null);

  const queryAccountId = validId ? accountId : undefined;
  const refreshViewKey = validId ? `account:${accountId}:cost:${costMethod}` : 'invalid';
  const refreshContextRef = useRef<FxRefreshContext>({ viewKey: refreshViewKey, requestId: 0 });
  const hasAccounts = accounts.length > 0;
  const accountRecord = validId ? accounts.find((a) => a.id === accountId) : undefined;
  const accountMissing = validId && accounts.length > 0 && !accountRecord;

  const accountPrefs = validId ? getPortfolioAccountPrefs(accountId) : null;

  const isActiveRefreshContext = (requestedViewKey: string, requestedRequestId: number) =>
    refreshContextRef.current.viewKey === requestedViewKey && refreshContextRef.current.requestId === requestedRequestId;

  const loadAccounts = useCallback(async () => {
    try {
      const response = await portfolioApi.getAccounts(false);
      setAccounts(response.accounts || []);
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setAccountsReady(true);
    }
  }, []);

  const loadSnapshotAndRisk = useCallback(async () => {
    if (!validId) return;
    setIsLoading(true);
    setRiskWarning(null);
    try {
      const snapshotData = await portfolioApi.getSnapshot({
        accountId,
        costMethod,
      });
      setSnapshot(snapshotData);
      setError(null);
      try {
        const riskData = await portfolioApi.getRisk({
          accountId,
          costMethod,
        });
        setRisk(riskData);
      } catch (riskErr) {
        setRisk(null);
        const parsed = getParsedApiError(riskErr);
        setRiskWarning(parsed.message || '风险数据获取失败，已降级为仅展示快照数据。');
      }
    } catch (err) {
      setSnapshot(null);
      setRisk(null);
      setError(getParsedApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [accountId, costMethod, validId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    void loadSnapshotAndRisk();
  }, [loadSnapshotAndRisk]);

  useEffect(() => {
    refreshContextRef.current = {
      viewKey: refreshViewKey,
      requestId: refreshContextRef.current.requestId + 1,
    };
    setFxRefreshing(false);
    setFxRefreshFeedback(null);
  }, [refreshViewKey]);

  const reloadSnapshotAndRiskForScope = useCallback(
    async (
      requestedViewKey: string,
      requestedRequestId: number,
      requestedAccountId: number | undefined,
      requestedCostMethod: PortfolioCostMethod,
    ): Promise<boolean> => {
      if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) return false;
      setRiskWarning(null);
      try {
        const snapshotData = await portfolioApi.getSnapshot({
          accountId: requestedAccountId,
          costMethod: requestedCostMethod,
        });
        if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) return false;
        setSnapshot(snapshotData);
        setError(null);
        try {
          const riskData = await portfolioApi.getRisk({
            accountId: requestedAccountId,
            costMethod: requestedCostMethod,
          });
          if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) return false;
          setRisk(riskData);
          setRiskWarning(null);
        } catch (riskErr) {
          if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) return false;
          setRisk(null);
          const parsed = getParsedApiError(riskErr);
          setRiskWarning(parsed.message || '风险数据获取失败，已降级为仅展示快照数据。');
        }
        return true;
      } catch (err) {
        if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) return false;
        setSnapshot(null);
        setRisk(null);
        setError(getParsedApiError(err));
        return false;
      }
    },
    [],
  );

  const handleRefreshFx = async () => {
    if (!validId || !hasAccounts || isLoading || fxRefreshing) return;
    const requestedViewKey = refreshViewKey;
    const requestedAccountId = queryAccountId;
    const requestedCostMethod = costMethod;
    const requestedRequestId = refreshContextRef.current.requestId + 1;
    refreshContextRef.current = { viewKey: requestedViewKey, requestId: requestedRequestId };

    try {
      setFxRefreshing(true);
      setFxRefreshFeedback(null);
      const result = await portfolioApi.refreshFx({ accountId: requestedAccountId });
      if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) return;
      const reloaded = await reloadSnapshotAndRiskForScope(
        requestedViewKey,
        requestedRequestId,
        requestedAccountId,
        requestedCostMethod,
      );
      if (!reloaded || !isActiveRefreshContext(requestedViewKey, requestedRequestId)) return;
      setFxRefreshFeedback(buildFxRefreshFeedback(result));
    } catch (err) {
      if (!isActiveRefreshContext(requestedViewKey, requestedRequestId)) return;
      setError(getParsedApiError(err));
    } finally {
      if (isActiveRefreshContext(requestedViewKey, requestedRequestId)) {
        setFxRefreshing(false);
      }
    }
  };

  const handleRefresh = async () => {
    await Promise.all([loadAccounts(), loadSnapshotAndRisk()]);
  };

  const positionRows: FlatPosition[] = useMemo(() => {
    if (!snapshot) return [];
    const rows: FlatPosition[] = [];
    for (const account of snapshot.accounts || []) {
      for (const position of account.positions || []) {
        rows.push({
          ...position,
          accountId: account.accountId,
          accountName: account.accountName,
        });
      }
    }
    rows.sort((a, b) => Number(b.marketValueBase || 0) - Number(a.marketValueBase || 0));
    return rows;
  }, [snapshot]);

  const checkupUniqueSymbols = useMemo(
    () => Array.from(new Set(positionRows.map((r) => r.symbol.trim()).filter(Boolean))),
    [positionRows],
  );

  const sectorPieData = useMemo(() => {
    const sectors = risk?.sectorConcentration?.topSectors || [];
    return sectors
      .slice(0, 6)
      .map((item) => ({ name: item.sector, value: Number(item.weightPct || 0) }))
      .filter((item) => item.value > 0);
  }, [risk]);

  const positionFallbackPieData = useMemo(() => {
    if (!risk?.concentration?.topPositions?.length) return [];
    return risk.concentration.topPositions
      .slice(0, 6)
      .map((item) => ({ name: item.symbol, value: Number(item.weightPct || 0) }))
      .filter((item) => item.value > 0);
  }, [risk]);

  const concentrationPieData = sectorPieData.length > 0 ? sectorPieData : positionFallbackPieData;
  const concentrationMode = sectorPieData.length > 0 ? 'sector' : 'position';

  useEffect(() => {
    return () => {
      checkupAbortRef.current?.abort();
    };
  }, []);

  const handlePortfolioCheckup = useCallback(async () => {
    if (!validId) return;
    const prefs = getPortfolioAccountPrefs(accountId);
    if (!prefs.enableBatchCheckup) return;

    const symbols = Array.from(new Set(positionRows.map((r) => r.symbol.trim()).filter(Boolean)));
    if (symbols.length === 0) return;

    const codes = symbols.slice(0, MAX_PORTFOLIO_CHECKUP_STOCKS);
    const truncated = symbols.length > MAX_PORTFOLIO_CHECKUP_STOCKS;

    checkupAbortRef.current?.abort();
    const ac = new AbortController();
    checkupAbortRef.current = ac;

    setCheckupLoading(true);
    setCheckupRows([]);
    setCheckupBanner(null);

    try {
      const resp = await workbenchAnalysisApi.analyzeAsync({
        stockCodes: codes,
        reportType: 'simple',
        notify: prefs.dailyAnalysisNotify,
        asyncMode: true,
        selectionSource: 'manual',
      });

      const bannerParts: string[] = [];
      if (truncated) {
        bannerParts.push(
          `去重共 ${symbols.length} 只，单次最多 ${MAX_PORTFOLIO_CHECKUP_STOCKS} 只，已分析前 ${MAX_PORTFOLIO_CHECKUP_STOCKS} 只。`,
        );
      }
      if (prefs.dailyAnalysisNotify) {
        bannerParts.push('已按账户偏好尝试发送分析完成通知（取决于服务端通知渠道配置）。');
      }
      if ('message' in resp && typeof resp.message === 'string' && resp.message.trim()) {
        bannerParts.push(resp.message.trim());
      }
      setCheckupBanner(bannerParts.length ? bannerParts.join(' ') : null);

      const duplicates = 'duplicates' in resp && resp.duplicates ? resp.duplicates : [];
      const dupMap = new Map(duplicates.map((d) => [d.stockCode, d.message || '已在分析队列中'] as const));

      let taskList: { taskId: string; stockCode: string }[] = [];
      if ('accepted' in resp && Array.isArray(resp.accepted)) {
        taskList = resp.accepted.map((a) => ({ taskId: a.taskId, stockCode: a.stockCode }));
      } else if ('taskId' in resp && resp.taskId) {
        taskList = [{ taskId: resp.taskId, stockCode: codes[0] }];
      }

      const initialRows: PortfolioCheckupRow[] = codes.map((sym) => {
        if (dupMap.has(sym)) {
          return { symbol: sym, status: 'duplicate', error: dupMap.get(sym)! };
        }
        const task = taskList.find((t) => portfolioSymbolsLooselyEqual(t.stockCode, sym));
        if (!task) {
          return { symbol: sym, status: 'error', error: '未能提交分析任务' };
        }
        return { symbol: sym, status: 'queued' };
      });
      setCheckupRows(initialRows);

      if (taskList.length === 0) return;

      await Promise.all(
        taskList.map(async ({ taskId, stockCode }) => {
          const matchRow = (row: PortfolioCheckupRow) => portfolioSymbolsLooselyEqual(row.symbol, stockCode);
          try {
            const final = await pollAnalysisTask(taskId, workbenchAnalysisApi.getStatus, {
              signal: ac.signal,
              intervalMs: 2000,
              maxWaitMs: 15 * 60 * 1000,
            });
            if (ac.signal.aborted) return;

            if (final.status === 'failed') {
              setCheckupRows((prev) =>
                prev.map((row) =>
                  matchRow(row) ? { ...row, status: 'failed', error: final.error || '分析失败' } : row,
                ),
              );
              return;
            }

            const result = final.result;
            const summary = result?.report?.summary;
            if (!result || !summary) {
              setCheckupRows((prev) =>
                prev.map((row) =>
                  matchRow(row) ? { ...row, status: 'failed', error: '未返回有效报告' } : row,
                ),
              );
              return;
            }

            let conceptTags: string[] = [];
            try {
              const latest = await workbenchHistoryApi.getList({
                stockCode: result.stockCode || stockCode || '',
                page: 1,
                limit: 1,
              });
              conceptTags = latest.items?.[0]?.conceptTags || [];
            } catch {
              conceptTags = [];
            }

            setCheckupRows((prev) =>
              prev.map((row) =>
                matchRow(row)
                  ? {
                      ...row,
                      status: 'completed',
                      stockName: result.stockName || result.report?.meta?.stockName || null,
                      sentimentScore: summary.sentimentScore,
                      operationAdvice: summary.operationAdvice,
                      conceptTags,
                      analysisSummary: summary.analysisSummary,
                    }
                  : row,
              ),
            );
          } catch (e) {
            if (ac.signal.aborted) return;
            const msg = e instanceof Error ? e.message : String(e);
            setCheckupRows((prev) =>
              prev.map((row) => (matchRow(row) ? { ...row, status: 'error', error: msg } : row)),
            );
          }
        }),
      );
    } catch (e) {
      if (e instanceof DuplicateTaskErrorWorkbench) {
        setCheckupBanner(e.message);
        setError(null);
      } else {
        setError(getParsedApiError(e));
      }
    } finally {
      setCheckupLoading(false);
    }
  }, [accountId, positionRows, validId]);

  if (!validId) {
    return (
      <div className="stack user-portfolio-page">
        <PortfolioInlineAlert variant="danger" title="参数错误" message="无效的账户 ID。" />
        <Link to="/portfolio" className="user-portfolio-chat-link">
          ← 返回持仓首页
        </Link>
      </div>
    );
  }

  if (!accountsReady) {
    return (
      <div className="stack user-portfolio-page">
        <p className="text-sm user-portfolio-muted">加载账户信息…</p>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="stack user-portfolio-page">
        <PortfolioInlineAlert variant="warning" title="暂无账户" message="请先在持仓首页创建账户。" />
        <Link to="/portfolio" className="user-portfolio-chat-link">
          ← 返回持仓首页
        </Link>
      </div>
    );
  }

  if (accountMissing) {
    return (
      <div className="stack user-portfolio-page">
        <PortfolioInlineAlert variant="warning" title="未找到账户" message="该账户不存在或已被停用。" />
        <Link to="/portfolio" className="user-portfolio-chat-link">
          ← 返回持仓首页
        </Link>
      </div>
    );
  }

  const cur = snapshot?.currency || 'CNY';

  return (
    <div className="stack user-portfolio-page">
      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/portfolio" className="user-portfolio-chat-link text-sm">
              ← 账户一览
            </Link>
            <h1 className="h1 user-portfolio-page-title mt-1">持仓明细</h1>
            <p className="lead user-portfolio-muted" style={{ marginBottom: 0 }}>
              {accountRecord ? (
                <>
                  <strong>{accountRecord.name}</strong>
                  <span className="user-portfolio-muted"> #{accountId}</span>
                </>
              ) : (
                `账户 #${accountId}`
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <Link className="user-portfolio-btn user-portfolio-btn-secondary text-sm" to={`/portfolio/account/${accountId}/ledger`}>
              流水录入
            </Link>
            <button
              type="button"
              className="user-portfolio-btn user-portfolio-btn-secondary text-sm"
              disabled={isLoading || fxRefreshing}
              onClick={() => void handleRefresh()}
            >
              {isLoading ? '刷新中…' : '刷新'}
            </button>
          </div>
        </div>
      </section>

      {error ? <PortfolioApiErrorBanner error={error} onDismiss={() => setError(null)} /> : null}
      {riskWarning ? <PortfolioInlineAlert variant="warning" title="风险模块降级" message={riskWarning} /> : null}

      <section className="user-portfolio-grid user-portfolio-detail-metrics-row">
        <PortfolioCard tone="metric">
          <p className="text-xs user-portfolio-muted">总收益</p>
          <p className="mt-1 text-xl font-semibold user-portfolio-strong">
            {formatMoney((snapshot?.unrealizedPnl ?? 0) + (snapshot?.realizedPnl ?? 0), cur)}
          </p>
          <p className="mt-1 text-xs user-portfolio-muted leading-snug">
            浮动 {formatMoney(snapshot?.unrealizedPnl, cur)} · 已实现 {formatMoney(snapshot?.realizedPnl, cur)}
          </p>
        </PortfolioCard>
        <PortfolioCard tone="metric">
          <p className="text-xs user-portfolio-muted">总市值</p>
          <p className="mt-1 text-xl font-semibold user-portfolio-strong">{formatMoney(snapshot?.totalMarketValue, cur)}</p>
        </PortfolioCard>
        <PortfolioCard tone="metric">
          <p className="text-xs user-portfolio-muted">总现金</p>
          <p className="mt-1 text-xl font-semibold user-portfolio-strong">{formatMoney(snapshot?.totalCash, cur)}</p>
        </PortfolioCard>
        <PortfolioCard tone="metric">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs user-portfolio-muted">汇率</p>
            <button
              type="button"
              className="user-portfolio-btn user-portfolio-btn-secondary !px-3 !py-1 !text-xs shrink-0"
              onClick={() => void handleRefreshFx()}
              disabled={!hasAccounts || isLoading || fxRefreshing}
            >
              {fxRefreshing ? '刷新中…' : '刷新汇率'}
            </button>
          </div>
          <div className="mt-2">{snapshot?.fxStale ? <PortfolioBadge variant="warning">过期</PortfolioBadge> : <PortfolioBadge variant="success">最新</PortfolioBadge>}</div>
          {fxRefreshFeedback ? (
            <PortfolioInlineAlert
              variant={fxVariant(fxRefreshFeedback.tone)}
              title="汇率刷新"
              message={fxRefreshFeedback.text}
              className="mt-3 rounded-xl px-3 py-2 text-xs shadow-none"
            />
          ) : null}
        </PortfolioCard>
        <PortfolioCard tone="metric" className="user-portfolio-metric-cost-method">
          <p className="text-xs user-portfolio-muted mb-1">成本口径</p>
          <select
            className={SEL}
            value={costMethod}
            onChange={(e) => setCostMethod(e.target.value as PortfolioCostMethod)}
          >
            <option value="fifo">FIFO</option>
            <option value="avg">均价</option>
          </select>
          <p className="text-xs user-portfolio-muted mt-2 leading-snug">影响持仓成本与浮动盈亏计算。</p>
        </PortfolioCard>
      </section>

      <section className="user-portfolio-grid user-portfolio-main-row">
        <PortfolioCard className="user-portfolio-span-2">
          <div className="user-portfolio-positions-head flex flex-wrap items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-sm font-semibold user-portfolio-strong">个股列表</h2>
                <span className="text-xs user-portfolio-muted">共 {positionRows.length} 只</span>
              </div>
              <p className="text-xs user-portfolio-muted mt-1 max-w-xl leading-snug hidden sm:block">
                是否在汇总表勾选「体检分析」「分析推送」决定批量体检与 notify；单次最多 {MAX_PORTFOLIO_CHECKUP_STOCKS} 只。
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="text-xs font-semibold user-portfolio-strong user-portfolio-nowrap">AI 体检</div>
              <div className="user-portfolio-checkup-actions flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="user-portfolio-btn user-portfolio-btn-secondary user-portfolio-btn-sm shrink-0"
                  disabled={
                    !hasAccounts || positionRows.length === 0 || checkupLoading || !(accountPrefs?.enableBatchCheckup ?? false)
                  }
                  onClick={() => void handlePortfolioCheckup()}
                  title={!(accountPrefs?.enableBatchCheckup ?? false) ? '请先在持仓首页为该账户勾选「体检分析」' : undefined}
                >
                  {checkupLoading ? '分析中…' : '开始体检'}
                </button>
                <Link to="/chat" className="user-portfolio-chat-link text-sm leading-none pt-1">
                  工作台任务 →
                </Link>
              </div>
            </div>
          </div>
          {positionRows.length === 0 ? (
            <PortfolioEmpty
              title="暂无持仓"
              description="请到「流水录入」添加交易或导入 CSV。"
              className="border-none bg-transparent px-4 py-8 shadow-none"
            />
          ) : (
            <div className="user-portfolio-scroll-x">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-2">代码</th>
                    <th className="text-right py-2 pr-2">数量</th>
                    <th className="text-right py-2 pr-2">均价</th>
                    <th className="text-right py-2 pr-2">现价</th>
                    <th className="text-right py-2 pr-2">市值</th>
                    <th className="text-right py-2 pr-2">浮动盈亏</th>
                    <th className="text-center py-2 w-12">自选</th>
                  </tr>
                </thead>
                <tbody>
                  {positionRows.map((row) => (
                    <tr key={`${row.accountId}-${row.symbol}-${row.market}`}>
                      <td className="py-2 pr-2 user-portfolio-mono user-portfolio-strong">{row.symbol}</td>
                      <td className="py-2 pr-2 text-right">{row.quantity.toFixed(2)}</td>
                      <td className="py-2 pr-2 text-right">{row.avgCost.toFixed(4)}</td>
                      <td className="py-2 pr-2 text-right">{row.lastPrice.toFixed(4)}</td>
                      <td className="py-2 pr-2 text-right">{formatMoney(row.marketValueBase, row.valuationCurrency)}</td>
                      <td className={`py-2 pr-2 text-right ${row.unrealizedPnlBase >= 0 ? 'user-portfolio-pos-pnl-pos' : 'user-portfolio-pos-pnl-neg'}`}>
                        {formatMoney(row.unrealizedPnlBase, row.valuationCurrency)}
                      </td>
                      <td className="py-2 text-center align-middle">
                        <AddToWatchlistCompact stockCode={row.symbol} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="user-portfolio-positions-checkup mt-4 pt-4 border-t border-black/10 dark:border-white/10">
            {!(accountPrefs?.enableBatchCheckup ?? false) ? (
              <PortfolioInlineAlert
                variant="info"
                className="mb-3 rounded-lg px-3 py-2 text-xs shadow-none"
                message="当前账户在首页关闭了「体检分析」，如需批量体检请先在一览表勾选。"
              />
            ) : null}
            {checkupBanner ? (
              <PortfolioInlineAlert variant="info" className="mb-3 rounded-lg px-3 py-2 text-xs shadow-none" message={checkupBanner} />
            ) : null}
            {checkupRows.length === 0 && !checkupLoading ? (
              <p className="text-xs user-portfolio-muted mb-0">
                {positionRows.length === 0 ? '无持仓，无法体检。' : `共 ${checkupUniqueSymbols.length} 只标的，可点击「开始体检」。`}
              </p>
            ) : null}
            {checkupRows.length > 0 ? (
              <div className="user-portfolio-checkup-table-wrap user-portfolio-scroll-x">
                <table className="w-full user-portfolio-table-wide text-sm">
                  <thead>
                    <tr>
                      <th className="text-left py-2 pr-2">代码</th>
                      <th className="text-left py-2 pr-2">名称</th>
                      <th className="text-right py-2 pr-2">AI 评分</th>
                      <th className="text-left py-2 pr-2">操作建议</th>
                      <th className="text-left py-2 pr-2">概念</th>
                      <th className="text-left py-2 pr-2">摘要</th>
                      <th className="text-left py-2">状态</th>
                      <th className="text-center py-2 w-12">自选</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkupRows.map((row) => (
                      <tr key={row.symbol} style={{ verticalAlign: 'top' }}>
                        <td className="py-2 pr-2 user-portfolio-mono user-portfolio-strong">{row.symbol}</td>
                        <td className="py-2 pr-2 user-portfolio-muted">{row.stockName ?? '—'}</td>
                        <td className="py-2 pr-2 text-right">
                          {row.status === 'completed' ? (
                            <PortfolioScoreHistoryBadge stockCode={row.symbol} score={row.sentimentScore} />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2 pr-2 user-portfolio-text-xs user-portfolio-strong">
                          {row.status === 'completed' ? <PortfolioAdviceBadge advice={row.operationAdvice} /> : '—'}
                        </td>
                        <td className="py-2 pr-2 user-portfolio-text-xs user-portfolio-muted">
                          <div className="user-portfolio-truncate" title={(row.conceptTags || []).join('、')}>
                            {(row.conceptTags || []).join('、') || '—'}
                          </div>
                        </td>
                        <td className="py-2 pr-2 user-portfolio-text-xs user-portfolio-muted user-portfolio-summary-cell">
                          {row.status === 'completed' && row.analysisSummary ? (
                            truncateSummaryText(row.analysisSummary, 160)
                          ) : row.error ? (
                            <span className="user-portfolio-pos-pnl-neg">{row.error}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2 user-portfolio-text-xs user-portfolio-muted user-portfolio-nowrap">
                          {portfolioCheckupStatusLabel(row, checkupLoading)}
                        </td>
                        <td className="py-2 text-center align-middle">
                          <AddToWatchlistCompact stockCode={row.symbol} stockName={row.stockName} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </PortfolioCard>

        <PortfolioCard>
          <h2 className="text-sm font-semibold user-portfolio-strong mb-3">
            {concentrationMode === 'sector' ? '行业集中度' : '个股集中度（降级）'}
          </h2>
          {concentrationPieData.length > 0 ? (
            <div className="user-portfolio-pie">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={concentrationPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                    {concentrationPieData.map((entry, index) => (
                      <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <PortfolioEmpty title="暂无集中度" description="风险计算完成后展示。" className="border-none bg-transparent px-4 py-10 shadow-none" />
          )}
          <div className="mt-3 text-xs user-portfolio-muted space-y-1">
            <div>板块告警: {risk?.sectorConcentration?.alert ? '是' : '否'}</div>
            <div>Top1 权重: {formatPct(risk?.sectorConcentration?.topWeightPct ?? risk?.concentration?.topWeightPct)}</div>
          </div>
        </PortfolioCard>
      </section>

      <section className="user-portfolio-grid user-portfolio-risk-row">
        <PortfolioCard>
          <h3 className="text-sm font-semibold user-portfolio-strong mb-2">回撤监控（摘要）</h3>
          <div className="text-xs user-portfolio-muted space-y-1">
            <div>最大回撤: {formatPct(risk?.drawdown?.maxDrawdownPct)}</div>
            <div>当前回撤: {formatPct(risk?.drawdown?.currentDrawdownPct)}</div>
            <div>告警: {risk?.drawdown?.alert ? '是' : '否'}</div>
          </div>
          <Link className="user-portfolio-chat-link text-xs mt-2 inline-block" to={`/portfolio/account/${accountId}/risk`}>
            查看明细与阈值 →
          </Link>
        </PortfolioCard>
        <PortfolioCard>
          <h3 className="text-sm font-semibold user-portfolio-strong mb-2">止损预警（摘要）</h3>
          <div className="text-xs user-portfolio-muted space-y-1">
            <div>触发数: {risk?.stopLoss?.triggeredCount ?? 0}</div>
            <div>接近数: {risk?.stopLoss?.nearCount ?? 0}</div>
            <div>告警: {risk?.stopLoss?.nearAlert ? '是' : '否'}</div>
          </div>
          <Link className="user-portfolio-chat-link text-xs mt-2 inline-block" to={`/portfolio/account/${accountId}/risk`}>
            查看触发列表 →
          </Link>
        </PortfolioCard>
      </section>
    </div>
  );
}
