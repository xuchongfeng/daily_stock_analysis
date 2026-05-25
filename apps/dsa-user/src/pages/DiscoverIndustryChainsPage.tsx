import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { discoverIndustryChainApi } from '../api/discoverIndustryChain';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import { fetchLatestSummariesForCodes, pickLatestSummary } from '../api/historySummaries';
import { useAuth } from '../auth/AuthContext';
import { AddToWatchlistCompact } from '../components/AddToWatchlistCompact';
import { PortfolioApiErrorBanner } from '../components/portfolio/UserPortfolioUi';
import { PortfolioAdviceBadge } from '../components/portfolio/PortfolioSignalBadges';
import { PortfolioScoreHistoryBadge } from '../components/portfolio/PortfolioScoreHistoryBadge';
import type { IndustryChainDetail, IndustryChainStock, IndustryChainSummary } from '../types/discoverIndustryChain';
import { xueqiuStockHref } from '../utils/xueqiuStockHref';

type ChainStockRow = IndustryChainStock & {
  sentimentScore?: number | null;
  operationAdvice?: string | null;
  tagConcept?: string[];
};

function stockNameCell(code: string, name?: string | null) {
  const href = xueqiuStockHref(code);
  const label = name?.trim() || '—';
  if (href && label !== '—') {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="today-link-stock">
        {label}
      </a>
    );
  }
  return label;
}

function sortStockRows(rows: ChainStockRow[]): ChainStockRow[] {
  return [...rows].sort((a, b) => {
    const sa = a.sentimentScore;
    const sb = b.sentimentScore;
    const aHas = sa != null && Number.isFinite(Number(sa));
    const bHas = sb != null && Number.isFinite(Number(sb));
    if (aHas && bHas) return Number(sb) - Number(sa);
    if (aHas) return -1;
    if (bHas) return 1;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

export function DiscoverIndustryChainsPage() {
  const { status } = useAuth();
  const isAdmin = Boolean(status?.loggedIn);
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<IndustryChainSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [selectedDetail, setSelectedDetail] = useState<IndustryChainDetail | null>(null);
  const [stockRows, setStockRows] = useState<ChainStockRow[]>([]);

  const [loadingChains, setLoadingChains] = useState(false);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);

  const desiredSlug = (searchParams.get('chain') || '').trim().toLowerCase();

  const loadChains = useCallback(async () => {
    setLoadingChains(true);
    setError(null);
    try {
      const res = await discoverIndustryChainApi.list({ limit: 100 });
      const list = res.items || [];
      setItems(list);
      const target = (desiredSlug && list.find((x) => x.slug === desiredSlug)) || list[0];
      if (target) {
        setSelectedSlug(target.slug);
      } else {
        setSelectedSlug('');
        setSelectedDetail(null);
        setStockRows([]);
      }
    } catch (e) {
      setError(getParsedApiError(e));
      setItems([]);
      setSelectedSlug('');
    } finally {
      setLoadingChains(false);
    }
  }, [desiredSlug]);

  const loadStocks = useCallback(async (slug: string) => {
    if (!slug) {
      setSelectedDetail(null);
      setStockRows([]);
      return;
    }
    setLoadingStocks(true);
    setError(null);
    try {
      const detail = await discoverIndustryChainApi.getDetail(slug);
      setSelectedDetail(detail);
      const core = detail.coreStocks ?? [];
      const codes = core.map((s) => s.stockCode).filter(Boolean);
      let summaryMap: Record<string, import('../api/historySummaries').LatestAnalysisSummaryItem> = {};
      if (codes.length > 0) {
        const sumRes = await fetchLatestSummariesForCodes(codes);
        summaryMap = sumRes.items ?? {};
      }
      const merged: ChainStockRow[] = core.map((s) => {
        const sum = pickLatestSummary(summaryMap, s.stockCode);
        return {
          ...s,
          stockName: s.stockName || null,
          sentimentScore: sum?.sentiment_score ?? null,
          operationAdvice: sum?.operation_advice ?? null,
          tagConcept: sum?.concept_tags ?? [],
        };
      });
      setStockRows(sortStockRows(merged));
    } catch (e) {
      setError(getParsedApiError(e));
      setSelectedDetail(null);
      setStockRows([]);
    } finally {
      setLoadingStocks(false);
    }
  }, []);

  useEffect(() => {
    document.title = '发现 · 核心产业链';
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadChains());
  }, [loadChains]);

  useEffect(() => {
    if (!selectedSlug) return;
    queueMicrotask(() => void loadStocks(selectedSlug));
  }, [selectedSlug, loadStocks]);

  useEffect(() => {
    if (!selectedSlug) return;
    if (searchParams.get('chain') === selectedSlug) return;
    const next = new URLSearchParams(searchParams);
    next.set('chain', selectedSlug);
    setSearchParams(next, { replace: true });
  }, [selectedSlug, searchParams, setSearchParams]);

  const chainSummary = useMemo(() => `${items.length} 条产业链`, [items.length]);

  const refreshAll = () => {
    void loadChains();
    if (selectedSlug) void loadStocks(selectedSlug);
  };

  const selectedName = selectedDetail?.name || items.find((x) => x.slug === selectedSlug)?.name || '产业链个股';

  return (
    <div className="stack discover-sector-page discover-chain-page">
      <section className="card">
        <Link to="/discover" className="user-portfolio-chat-link discover-sector-back-link">
          ← 返回发现
        </Link>
        <div className="discover-chain-list-head">
          <div>
            <h1 className="h1 discover-sector-page-title">核心产业链</h1>
            <p className="lead today-muted discover-sector-lead">
              左侧选择产业链，右侧展示核心个股及最近 AI 评分、操作建议与<strong>产业链内定位</strong>；评分与板块探索同源（最近分析记录）。
            </p>
          </div>
          {isAdmin ? (
            <Link to="/discover/chains/new" className="discover-chain-add-btn">
              + 新增产业链
            </Link>
          ) : null}
        </div>
        <div className="discover-sector-toolbar">
          <button
            type="button"
            className="user-portfolio-btn user-portfolio-btn-secondary text-sm"
            disabled={loadingChains || loadingStocks}
            onClick={() => refreshAll()}
          >
            {loadingChains || loadingStocks ? '刷新中…' : '刷新数据'}
          </button>
          {selectedSlug ? (
            <Link
              to={`/discover/chains/${encodeURIComponent(selectedSlug)}`}
              className="user-portfolio-btn user-portfolio-btn-secondary text-sm discover-chain-toolbar-link"
            >
              查看详情页
            </Link>
          ) : null}
          {isAdmin && selectedSlug ? (
            <Link
              to={`/discover/chains/${encodeURIComponent(selectedSlug)}/edit`}
              className="user-portfolio-btn user-portfolio-btn-secondary text-sm discover-chain-toolbar-link"
            >
              编辑当前产业链
            </Link>
          ) : null}
        </div>
      </section>

      {error ? <PortfolioApiErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      <div className="discover-sector-layout">
        <section className="card discover-sector-boards">
          <div className="discover-sector-panel-head">
            <h2 className="text-base font-semibold">产业链目录</h2>
            <p className="today-muted text-xs mt-1">{chainSummary} · 按排序权重与更新时间</p>
          </div>
          <div className="discover-sector-board-list">
            {items.length === 0 && !loadingChains ? (
              <p className="today-muted text-sm px-2 py-6">
                暂无产业链条目。
                {isAdmin ? ' 点击上方「新增产业链」开始录入。' : ''}
              </p>
            ) : (
              <ul className="discover-sector-board-ul">
                {items.map((chain) => (
                  <li key={chain.slug}>
                    <button
                      type="button"
                      className={`discover-sector-board-btn ${selectedSlug === chain.slug ? 'discover-sector-board-btn-active' : ''}`.trim()}
                      onClick={() => setSelectedSlug(chain.slug)}
                    >
                      <span className="discover-sector-board-title">{chain.name}</span>
                      <span className="discover-sector-board-meta discover-sector-heat-cool">
                        {chain.market ?? 'cn'} · 核心股 {chain.coreStockCount ?? 0}
                      </span>
                      {chain.latestNews ? (
                        <span className="discover-chain-board-news">{chain.latestNews}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {loadingChains ? <p className="today-muted text-xs px-2 py-2">加载产业链…</p> : null}
          </div>
        </section>

        <section className="card discover-sector-stocks">
          <div className="discover-sector-panel-head">
            <h2 className="text-base font-semibold">{selectedName}</h2>
            {selectedDetail?.introduction ? (
              <p className="discover-chain-panel-intro today-muted text-xs mt-1">{selectedDetail.introduction}</p>
            ) : null}
            {selectedDetail?.latestNews ? (
              <p className="discover-chain-panel-news text-xs mt-1">
                <span className="discover-chain-latest-label">最新进展</span>
                {selectedDetail.latestNews}
              </p>
            ) : null}
            <p className="today-muted text-xs mt-1">评分列为最近一条分析记录；未评分排在末尾。</p>
          </div>
          <div className="watchlist-table-wrap">
            <table className="watchlist-table discover-sector-table">
              <thead>
                <tr>
                  <th>代码</th>
                  <th>名称</th>
                  <th>产业链定位</th>
                  <th>评分</th>
                  <th>建议</th>
                  <th>概念标签</th>
                  <th className="discover-sector-th-center">自选</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((s) => (
                  <tr key={s.stockCode}>
                    <td className="mono">{s.stockCode}</td>
                    <td className="discover-sector-name-cell">{stockNameCell(s.stockCode, s.stockName)}</td>
                    <td>
                      {s.role?.trim() ? (
                        <span className="discover-chain-role-badge">{s.role.trim()}</span>
                      ) : (
                        <span className="today-muted">—</span>
                      )}
                    </td>
                    <td className="discover-sector-score-cell">
                      <PortfolioScoreHistoryBadge stockCode={s.stockCode} score={s.sentimentScore} />
                    </td>
                    <td>{s.operationAdvice ? <PortfolioAdviceBadge advice={s.operationAdvice} /> : '—'}</td>
                    <td className="today-muted text-xs discover-sector-tags">{(s.tagConcept || []).join('、') || '—'}</td>
                    <td className="discover-sector-td-center">
                      <AddToWatchlistCompact stockCode={s.stockCode} stockName={s.stockName} />
                    </td>
                  </tr>
                ))}
                {!loadingStocks && stockRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="today-muted text-center py-10">
                      {selectedSlug ? '该产业链暂无核心个股' : '请选择左侧产业链'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {loadingStocks ? <p className="today-muted text-xs mt-2 px-1">加载个股…</p> : null}
        </section>
      </div>
    </div>
  );
}

