import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { backtestApi } from '../api/backtest';
import { getParsedApiError } from '../api/error';
import { portfolioApi } from '../api/portfolio';
import { PortfolioApiErrorBanner } from '../components/portfolio/UserPortfolioUi';
import { AddToWatchlistCompact } from '../components/AddToWatchlistCompact';
import type { ParsedApiError } from '../api/error';
import type { PortfolioAccountItem, PortfolioSnapshotResponse } from '../types/portfolio';
import type { BacktestResultItem, BacktestRunResponse, PerformanceMetrics } from '../types/backtest';

const PAGE_SIZE = 20;

function pct(value?: number | null): string {
  if (value == null) return '—';
  return `${value.toFixed(1)}%`;
}

function outcomeLabel(o?: string): string {
  if (!o) return '—';
  if (o === 'win') return '胜';
  if (o === 'loss') return '负';
  if (o === 'neutral') return '中性';
  return o;
}

function statusLabel(s: string): string {
  switch (s) {
    case 'completed':
      return '完成';
    case 'insufficient':
    case 'insufficient_data':
      return '数据不足';
    case 'error':
      return '错误';
    default:
      return s;
  }
}

/** 准确率类：越高越好 */
function accuracyStyle(v: number | undefined | null): string {
  if (v == null || Number.isNaN(v)) return 'user-backtest-val-muted';
  if (v >= 55) return 'user-backtest-val-good';
  if (v >= 45) return 'user-backtest-val-caution';
  return 'user-backtest-val-bad';
}

/** 有符号收益率：涨绿跌红 */
function signedReturnStyle(v: number | undefined | null): string {
  if (v == null || Number.isNaN(v)) return 'user-backtest-val-muted';
  if (v > 0.05) return 'user-backtest-val-good';
  if (v < -0.05) return 'user-backtest-val-bad';
  if (v > 0) return 'user-backtest-val-good-soft';
  if (v < 0) return 'user-backtest-val-bad-soft';
  return 'user-backtest-val-muted';
}

/** 止损触发率：偏高偏警戒 */
function stopLossRateStyle(v: number | undefined | null): string {
  if (v == null || Number.isNaN(v)) return 'user-backtest-val-muted';
  if (v >= 28) return 'user-backtest-val-bad';
  if (v >= 14) return 'user-backtest-val-caution';
  return 'user-backtest-val-good-soft';
}

/** 止盈触发率：适度偏高可视为正向兑现 */
function takeProfitRateStyle(v: number | undefined | null): string {
  if (v == null || Number.isNaN(v)) return 'user-backtest-val-muted';
  if (v >= 18) return 'user-backtest-val-good';
  if (v >= 8) return 'user-backtest-val-good-soft';
  return 'user-backtest-val-muted';
}

function perfStatRow(label: string, value: string, valueClass?: string) {
  return (
    <div className="user-backtest-perf-row">
      <span className="user-backtest-perf-label">{label}</span>
      <span className={`user-backtest-perf-value${valueClass ? ` ${valueClass}` : ''}`.trim()}>{value}</span>
    </div>
  );
}

function outcomeRowClass(o?: string): string {
  if (o === 'win') return 'user-backtest-tr-win';
  if (o === 'loss') return 'user-backtest-tr-loss';
  if (o === 'neutral') return 'user-backtest-tr-neutral';
  return '';
}

function outcomeTextClass(o?: string): string {
  if (o === 'win') return 'user-backtest-outcome-win';
  if (o === 'loss') return 'user-backtest-outcome-loss';
  if (o === 'neutral') return 'user-backtest-outcome-neutral';
  return 'user-backtest-val-muted';
}

function evalStatusClass(s: string): string {
  if (s === 'completed') return 'user-backtest-status-ok';
  if (s === 'error') return 'user-backtest-status-err';
  if (s === 'insufficient' || s === 'insufficient_data') return 'user-backtest-status-warn';
  return 'user-backtest-val-muted';
}

export function BacktestPage() {
  useEffect(() => {
    document.title = '回测';
  }, []);

  const [accounts, setAccounts] = useState<PortfolioAccountItem[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [portfolioMode, setPortfolioMode] = useState<'all' | string>('all');
  const [snapshot, setSnapshot] = useState<PortfolioSnapshotResponse | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const [codeFilter, setCodeFilter] = useState('');
  const [selectionRule, setSelectionRule] = useState<'' | 'signal_digest_top30_14d'>('');
  const [analysisDateFrom, setAnalysisDateFrom] = useState('');
  const [analysisDateTo, setAnalysisDateTo] = useState('');
  const [evalDays, setEvalDays] = useState('');
  const [forceRerun, setForceRerun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<BacktestRunResponse | null>(null);
  const [runError, setRunError] = useState<ParsedApiError | null>(null);
  const [pageError, setPageError] = useState<ParsedApiError | null>(null);

  const [results, setResults] = useState<BacktestResultItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  const [overallPerf, setOverallPerf] = useState<PerformanceMetrics | null>(null);
  const [stockPerf, setStockPerf] = useState<PerformanceMetrics | null>(null);
  const [isLoadingPerf, setIsLoadingPerf] = useState(false);

  const portfolioCodes = useMemo(() => {
    if (portfolioMode === 'all') return undefined;
    const id = Number(portfolioMode);
    if (!Number.isFinite(id)) return undefined;
    const acc = snapshot?.accounts?.find((a) => a.accountId === id);
    if (!acc?.positions?.length) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of acc.positions) {
      if (!p || !(Number(p.quantity) > 0)) continue;
      const s = String(p.symbol || '').trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
      if (out.length >= 80) break;
    }
    return out;
  }, [portfolioMode, snapshot]);

  const scopeCodes = portfolioMode === 'all' ? undefined : portfolioCodes;
  const portfolioLocked = portfolioMode !== 'all';

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setAccountsLoading(true);
    });
    portfolioApi
      .getAccounts(false)
      .then((r) => {
        if (!cancelled) setAccounts(r.accounts || []);
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      })
      .finally(() => {
        if (!cancelled) setAccountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (portfolioMode === 'all') {
      void Promise.resolve().then(() => setSnapshot(null));
      return;
    }
    const id = Number(portfolioMode);
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setSnapshotLoading(true);
    });
    portfolioApi
      .getSnapshot({ accountId: id })
      .then((s) => {
        if (!cancelled) setSnapshot(s);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      })
      .finally(() => {
        if (!cancelled) setSnapshotLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [portfolioMode]);

  const fetchResults = useCallback(
    async (
      page = 1,
      opts: {
        code?: string;
        codes?: string[];
        windowDays?: number;
        startDate?: string;
        endDate?: string;
      } = {},
    ) => {
      setIsLoadingResults(true);
      try {
        const response = await backtestApi.getResults({
          code: opts.code,
          codes: opts.codes,
          evalWindowDays: opts.windowDays,
          analysisDateFrom: opts.startDate,
          analysisDateTo: opts.endDate,
          page,
          limit: PAGE_SIZE,
        });
        setResults(response.items);
        setTotalResults(response.total);
        setCurrentPage(response.page);
        setPageError(null);
      } catch (err) {
        setPageError(getParsedApiError(err));
      } finally {
        setIsLoadingResults(false);
      }
    },
    [],
  );

  const fetchPerformance = useCallback(
    async (opts: {
      code?: string;
      codes?: string[];
      windowDays?: number;
      startDate?: string;
      endDate?: string;
    }) => {
      setIsLoadingPerf(true);
      try {
        const overall = await backtestApi.getOverallPerformance({
          codes: opts.codes,
          evalWindowDays: opts.windowDays,
          analysisDateFrom: opts.startDate,
          analysisDateTo: opts.endDate,
        });
        setOverallPerf(overall);

        if (opts.code) {
          const stock = await backtestApi.getStockPerformance(opts.code, {
            evalWindowDays: opts.windowDays,
            analysisDateFrom: opts.startDate,
            analysisDateTo: opts.endDate,
          });
          setStockPerf(stock);
        } else {
          setStockPerf(null);
        }
        setPageError(null);
      } catch (err) {
        setPageError(getParsedApiError(err));
      } finally {
        setIsLoadingPerf(false);
      }
    },
    [],
  );

  const queryOpts = useCallback(() => {
    const windowDays = evalDays ? parseInt(evalDays, 10) : undefined;
    const code = portfolioLocked ? undefined : codeFilter.trim() || undefined;
    const codes = portfolioLocked ? scopeCodes : undefined;
    return {
      code,
      codes: codes?.length ? codes : undefined,
      windowDays: Number.isFinite(windowDays as number) ? windowDays : undefined,
      startDate: analysisDateFrom || undefined,
      endDate: analysisDateTo || undefined,
    };
  }, [evalDays, codeFilter, portfolioLocked, scopeCodes, analysisDateFrom, analysisDateTo]);

  useEffect(() => {
    const init = async () => {
      try {
        const overall = await backtestApi.getOverallPerformance();
        setOverallPerf(overall);
        const w = overall?.evalWindowDays;
        if (w && !evalDays) setEvalDays(String(w));
        await fetchResults(1, {
          windowDays: w,
        });
      } catch (err) {
        setPageError(getParsedApiError(err));
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 首次加载仅执行一次
  }, []);

  useEffect(() => {
    if (portfolioMode === 'all') return;
    if (snapshotLoading) return;
    const id = Number(portfolioMode);
    const acc = snapshot?.accounts?.find((a) => a.accountId === id);
    const codes: string[] = [];
    const seen = new Set<string>();
    if (acc?.positions?.length) {
      for (const p of acc.positions) {
        if (!p || !(Number(p.quantity) > 0)) continue;
        const s = String(p.symbol || '').trim();
        if (!s || seen.has(s)) continue;
        seen.add(s);
        codes.push(s);
        if (codes.length >= 80) break;
      }
    }
    if (codes.length === 0) {
      void Promise.resolve().then(() => {
        setResults([]);
        setTotalResults(0);
        setOverallPerf(null);
        setStockPerf(null);
      });
      return;
    }
    const windowDays = evalDays ? parseInt(evalDays, 10) : undefined;
    const o = {
      codes,
      windowDays: Number.isFinite(windowDays as number) ? windowDays : undefined,
      startDate: analysisDateFrom || undefined,
      endDate: analysisDateTo || undefined,
    };
    void Promise.resolve().then(() => {
      setCurrentPage(1);
      void fetchResults(1, o);
      void fetchPerformance(o);
    });
  }, [
    portfolioMode,
    snapshot,
    snapshotLoading,
    evalDays,
    analysisDateFrom,
    analysisDateTo,
    fetchResults,
    fetchPerformance,
  ]);

  const handleRun = async () => {
    setIsRunning(true);
    setRunResult(null);
    setRunError(null);
    try {
      const windowDays = evalDays ? parseInt(evalDays, 10) : undefined;
      const o = queryOpts();
      const response = await backtestApi.run({
        code: o.code,
        codes: o.codes,
        selectionRule: !o.code && !o.codes?.length ? selectionRule || undefined : undefined,
        force: forceRerun || undefined,
        minAgeDays: forceRerun ? 0 : undefined,
        evalWindowDays: Number.isFinite(windowDays as number) ? windowDays : undefined,
      });
      setRunResult(response);
      setCurrentPage(1);
      await fetchResults(1, o);
      await fetchPerformance({ ...o, code: o.code });
    } catch (err) {
      setRunError(getParsedApiError(err));
    } finally {
      setIsRunning(false);
    }
  };

  const handleFilter = () => {
    const o = queryOpts();
    setCurrentPage(1);
    void fetchResults(1, o);
    void fetchPerformance({ ...o, code: o.code });
  };

  const handlePortfolioChange = (v: string) => {
    const next = v === 'all' ? 'all' : v;
    setPortfolioMode(next);
    if (v !== 'all') {
      setCodeFilter('');
      setSelectionRule('');
      return;
    }
    setCodeFilter('');
    setSelectionRule('');
    const windowDays = evalDays ? parseInt(evalDays, 10) : undefined;
    setCurrentPage(1);
    void fetchResults(1, {
      windowDays: Number.isFinite(windowDays as number) ? windowDays : undefined,
      startDate: analysisDateFrom || undefined,
      endDate: analysisDateTo || undefined,
    });
    void fetchPerformance({
      windowDays: Number.isFinite(windowDays as number) ? windowDays : undefined,
      startDate: analysisDateFrom || undefined,
      endDate: analysisDateTo || undefined,
    });
  };

  const totalPages = Math.ceil(totalResults / PAGE_SIZE) || 1;
  const handlePageChange = (page: number) => {
    void fetchResults(page, queryOpts());
  };

  const perfTitle =
    portfolioLocked && scopeCodes?.length
      ? `组合表现（${scopeCodes.length} 只）`
      : portfolioLocked
        ? '组合表现'
        : '整体表现';

  return (
    <div className="stack user-backtest-page">
      <header className="card">
        <h1 className="h1">回测</h1>
        <p className="lead today-muted">
          基于历史 AI 分析报告与日线数据，评估建议方向与模拟路径表现（与管理后台同源引擎）。可选择持仓账户，仅统计组合内标的。
        </p>
      </header>

      <section className="card user-backtest-toolbar">
        <div className="user-backtest-toolbar-grid">
          <label className="user-backtest-field">
            <span className="user-backtest-label">持仓范围</span>
            <select
              className="user-backtest-select"
              value={portfolioMode}
              onChange={(e) => handlePortfolioChange(e.target.value)}
              disabled={isRunning || accountsLoading}
            >
              <option value="all">全部（已有回测记录）</option>
              {(accounts || []).map((a) => (
                <option key={a.id} value={String(a.id)}>
                  账户：{a.name || `#${a.id}`}
                </option>
              ))}
            </select>
          </label>
          {portfolioMode !== 'all' ? (
            <p className="user-backtest-portfolio-meta today-muted">
              {snapshotLoading ? '加载持仓快照…' : null}
              {!snapshotLoading && portfolioCodes?.length === 0 ? (
                <>
                  当前账户无持仓代码。
                  <Link to={`/portfolio/account/${portfolioMode}/ledger`} className="today-link-stock">
                    去录入流水
                  </Link>
                </>
              ) : null}
              {!snapshotLoading && portfolioCodes && portfolioCodes.length > 0 ? (
                <>共 {portfolioCodes.length} 只标的参与筛选。</>
              ) : null}
            </p>
          ) : (
            <p className="user-backtest-portfolio-meta today-muted">
              未选账户时与后台一致，面向全市场已写入的回测结果；手动代码筛选如下。
            </p>
          )}

          <label className="user-backtest-field">
            <span className="user-backtest-label">股票代码</span>
            <input
              type="text"
              className="user-backtest-input"
              value={codeFilter}
              onChange={(e) => setCodeFilter(e.target.value.toUpperCase())}
              placeholder={portfolioLocked ? '已锁定为持仓组合' : '可选，单票筛选'}
              disabled={isRunning || portfolioLocked}
            />
          </label>

          <label className="user-backtest-field">
            <span className="user-backtest-label">选股规则</span>
            <select
              className="user-backtest-select"
              value={selectionRule}
              onChange={(e) => setSelectionRule(e.target.value as '' | 'signal_digest_top30_14d')}
              disabled={isRunning || portfolioLocked || Boolean(codeFilter.trim())}
            >
              <option value="">无（默认候选集）</option>
              <option value="signal_digest_top30_14d">信号摘要 14 日 Top30</option>
            </select>
          </label>

          <label className="user-backtest-field">
            <span className="user-backtest-label">评估窗口（交易日）</span>
            <input
              type="number"
              min={1}
              max={120}
              className="user-backtest-input user-backtest-input-narrow"
              value={evalDays}
              onChange={(e) => setEvalDays(e.target.value)}
              placeholder="如 10"
              disabled={isRunning}
            />
          </label>

          <label className="user-backtest-field">
            <span className="user-backtest-label">分析日 From</span>
            <input
              type="date"
              className="user-backtest-input"
              value={analysisDateFrom}
              onChange={(e) => setAnalysisDateFrom(e.target.value)}
              disabled={isRunning}
            />
          </label>

          <label className="user-backtest-field">
            <span className="user-backtest-label">分析日 To</span>
            <input
              type="date"
              className="user-backtest-input"
              value={analysisDateTo}
              onChange={(e) => setAnalysisDateTo(e.target.value)}
              disabled={isRunning}
            />
          </label>
        </div>

        <div className="user-backtest-actions">
          <button type="button" className="user-portfolio-btn user-portfolio-btn-secondary text-sm" onClick={handleFilter} disabled={isLoadingResults}>
            应用筛选
          </button>
          <label className="user-backtest-check">
            <input type="checkbox" checked={forceRerun} onChange={(e) => setForceRerun(e.target.checked)} disabled={isRunning} />
            <span>强制重算</span>
          </label>
          <button
            type="button"
            className="user-portfolio-btn user-portfolio-btn-secondary text-sm"
            onClick={() => void handleRun()}
            disabled={
              isRunning ||
              snapshotLoading ||
              (portfolioLocked && !snapshotLoading && (portfolioCodes?.length ?? 0) === 0)
            }
          >
            {isRunning ? '执行中…' : '运行回测'}
          </button>
          <Link to="/portfolio" className="user-portfolio-chat-link text-sm">
            管理持仓账户 →
          </Link>
        </div>

        {runResult ? (
          <p className="today-muted text-sm mt-3">
            候选 {runResult.processed} · 写入 {runResult.saved} · 完成 {runResult.completed} · 数据不足{' '}
            {runResult.insufficient}
            {runResult.errors > 0 ? ` · 错误 ${runResult.errors}` : ''}
          </p>
        ) : null}
        {runError ? (
          <div className="mt-3">
            <PortfolioApiErrorBanner error={runError} onDismiss={() => setRunError(null)} />
          </div>
        ) : null}
      </section>

      {pageError ? <PortfolioApiErrorBanner error={pageError} onDismiss={() => setPageError(null)} /> : null}

      <div className="user-backtest-main">
        <aside className="card user-backtest-side">
          {isLoadingPerf ? (
            <p className="today-muted">加载指标…</p>
          ) : overallPerf ? (
            <>
              <h2 className="user-backtest-perf-title">{perfTitle}</h2>
              <div className="user-backtest-perf-stats">
                {perfStatRow('方向准确率', pct(overallPerf.directionAccuracyPct), accuracyStyle(overallPerf.directionAccuracyPct))}
                {perfStatRow('胜率（含中性）', pct(overallPerf.winRatePct), accuracyStyle(overallPerf.winRatePct))}
                {perfStatRow(
                  '平均模拟收益',
                  pct(overallPerf.avgSimulatedReturnPct),
                  signedReturnStyle(overallPerf.avgSimulatedReturnPct),
                )}
                {perfStatRow(
                  '平均标的涨跌',
                  pct(overallPerf.avgStockReturnPct),
                  signedReturnStyle(overallPerf.avgStockReturnPct),
                )}
                {perfStatRow(
                  '止损触发率',
                  pct(overallPerf.stopLossTriggerRate),
                  stopLossRateStyle(overallPerf.stopLossTriggerRate),
                )}
                {perfStatRow(
                  '止盈触发率',
                  pct(overallPerf.takeProfitTriggerRate),
                  takeProfitRateStyle(overallPerf.takeProfitTriggerRate),
                )}
                {perfStatRow(
                  '完成 / 总评估',
                  `${overallPerf.completedCount} / ${overallPerf.totalEvaluations}`,
                  overallPerf.totalEvaluations > 0 && overallPerf.completedCount >= overallPerf.totalEvaluations * 0.85
                    ? 'user-backtest-val-good-soft'
                    : 'user-backtest-val-info',
                )}
                <div className="user-backtest-perf-row user-backtest-perf-row-foot">
                  <span className="user-backtest-perf-label">胜 / 负 / 中性</span>
                  <span className="user-backtest-perf-value user-backtest-perf-wln">
                    <span className="user-backtest-wln-win">{overallPerf.winCount}</span>
                    <span className="user-backtest-perf-wln-sep">/</span>
                    <span className="user-backtest-wln-loss">{overallPerf.lossCount}</span>
                    <span className="user-backtest-perf-wln-sep">/</span>
                    <span className="user-backtest-wln-neutral">{overallPerf.neutralCount}</span>
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="today-muted">暂无汇总指标。请先运行回测或放宽筛选。</p>
          )}

          {stockPerf && stockPerf.code ? (
            <div className="user-backtest-perf-subcard">
              <h3 className="user-backtest-perf-subtitle">单票：{stockPerf.code}</h3>
              <div className="user-backtest-perf-stats">
                {perfStatRow('方向准确率', pct(stockPerf.directionAccuracyPct), accuracyStyle(stockPerf.directionAccuracyPct))}
                {perfStatRow('胜率', pct(stockPerf.winRatePct), accuracyStyle(stockPerf.winRatePct))}
              </div>
            </div>
          ) : null}
        </aside>

        <section className="card user-backtest-table-card">
          {isLoadingResults ? (
            <p className="today-muted">加载明细…</p>
          ) : results.length === 0 ? (
            <p className="lead today-muted">暂无记录。可运行回测或调整持仓范围 / 日期。</p>
          ) : (
            <>
              <div className="watchlist-table-wrap user-backtest-table-shell">
                <table className="watchlist-table user-backtest-table user-backtest-table-enhanced">
                  <thead>
                    <tr>
                      <th>代码</th>
                      <th>分析日</th>
                      <th>预测 / 建议</th>
                      <th className="right">窗口涨跌</th>
                      <th className="user-backtest-th-center">方向</th>
                      <th className="user-backtest-th-center">结果</th>
                      <th className="user-backtest-th-center">状态</th>
                      <th className="center">自选</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row) => {
                      const ret = row.actualReturnPct ?? row.stockReturnPct;
                      return (
                        <tr
                          key={`${row.analysisHistoryId}-${row.evalWindowDays}-${row.engineVersion}`}
                          className={outcomeRowClass(row.outcome)}
                        >
                          <td className="mono user-backtest-td-code">
                            <div className="user-backtest-code-main">{row.code}</div>
                            {row.stockName ? <div className="user-backtest-code-sub">{row.stockName}</div> : null}
                          </td>
                          <td className="user-backtest-td-date">{row.analysisDate ?? '—'}</td>
                          <td
                            className="user-backtest-predict-cell"
                            title={[row.trendPrediction, row.operationAdvice].filter(Boolean).join(' / ')}
                          >
                            <div className="user-backtest-predict-trend">{row.trendPrediction ?? '—'}</div>
                            <div className="user-backtest-predict-advice">{row.operationAdvice ?? ''}</div>
                          </td>
                          <td className={`right user-backtest-num ${signedReturnStyle(ret)}`}>{pct(ret)}</td>
                          <td className="user-backtest-td-center">
                            <span
                              className={
                                row.directionCorrect === true
                                  ? 'user-backtest-dir-yes'
                                  : row.directionCorrect === false
                                    ? 'user-backtest-dir-no'
                                    : 'user-backtest-dir-na'
                              }
                              aria-hidden
                            >
                              {row.directionCorrect === true ? '✓' : row.directionCorrect === false ? '✗' : '—'}
                            </span>
                          </td>
                          <td className={`user-backtest-td-center user-backtest-outcome-cell ${outcomeTextClass(row.outcome)}`}>
                            {outcomeLabel(row.outcome)}
                          </td>
                          <td className={`user-backtest-td-center ${evalStatusClass(row.evalStatus)}`}>{statusLabel(row.evalStatus)}</td>
                          <td className="center">
                            <AddToWatchlistCompact stockCode={row.code} stockName={row.stockName} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="user-backtest-pagination">
                <button
                  type="button"
                  className="user-portfolio-btn user-portfolio-btn-secondary text-sm"
                  disabled={currentPage <= 1 || isLoadingResults}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  上一页
                </button>
                <span className="today-muted text-sm">
                  {currentPage} / {totalPages} · 共 {totalResults} 条
                </span>
                <button
                  type="button"
                  className="user-portfolio-btn user-portfolio-btn-secondary text-sm"
                  disabled={currentPage >= totalPages || isLoadingResults}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  下一页
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
