import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { conceptBoardsApi } from '../api/conceptBoards';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import { AddToWatchlistCompact } from '../components/AddToWatchlistCompact';
import { PortfolioApiErrorBanner } from '../components/portfolio/UserPortfolioUi';
import { PortfolioAdviceBadge } from '../components/portfolio/PortfolioSignalBadges';
import { PortfolioScoreHistoryBadge } from '../components/portfolio/PortfolioScoreHistoryBadge';
import type { ConceptBoardItem, ConceptBoardStockItem } from '../types/conceptBoard';
import { xueqiuStockHref } from '../utils/xueqiuStockHref';

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

/** 热度：买持越多越高亮（与管理端列表排序一致） */
function boardHeatClass(b: ConceptBoardItem): string {
  const n = Number(b.buyOrHoldCount ?? 0);
  if (n >= 12) return 'discover-sector-heat-hot';
  if (n >= 5) return 'discover-sector-heat-warm';
  return 'discover-sector-heat-cool';
}

export function DiscoverConceptBoardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [boards, setBoards] = useState<ConceptBoardItem[]>([]);
  const [stocks, setStocks] = useState<ConceptBoardStockItem[]>([]);
  const [selectedBoardCode, setSelectedBoardCode] = useState('');
  const [selectedBoardName, setSelectedBoardName] = useState('');
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);

  const desiredBoardCode = (searchParams.get('boardCode') || '').trim();
  const desiredBoardName = (searchParams.get('boardName') || '').trim();

  const loadBoards = useCallback(async () => {
    void Promise.resolve().then(() => setLoadingBoards(true));
    setError(null);
    try {
      const res = await conceptBoardsApi.listBoards();
      const list = res.items || [];
      setBoards(list);
      const byCode = desiredBoardCode ? list.find((x) => x.boardCode === desiredBoardCode) : undefined;
      const byName = !byCode && desiredBoardName ? list.find((x) => x.boardName === desiredBoardName) : undefined;
      const target = byCode || byName || list[0];
      if (target) {
        setSelectedBoardCode(target.boardCode);
        setSelectedBoardName(target.boardName);
      } else {
        setSelectedBoardCode('');
        setSelectedBoardName('');
      }
    } catch (e) {
      setError(getParsedApiError(e));
    } finally {
      void Promise.resolve().then(() => setLoadingBoards(false));
    }
  }, [desiredBoardCode, desiredBoardName]);

  const loadStocks = useCallback(async (boardCode: string) => {
    if (!boardCode) {
      void Promise.resolve().then(() => setStocks([]));
      return;
    }
    void Promise.resolve().then(() => setLoadingStocks(true));
    setError(null);
    try {
      const res = await conceptBoardsApi.listBoardStocks(boardCode, { limit: 800, offset: 0 });
      setStocks(res.items || []);
      setSelectedBoardName(res.board?.boardName || boardCode);
    } catch (e) {
      setError(getParsedApiError(e));
      setStocks([]);
    } finally {
      void Promise.resolve().then(() => setLoadingStocks(false));
    }
  }, []);

  useEffect(() => {
    document.title = '发现 · 板块探索';
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadBoards());
  }, [loadBoards]);

  useEffect(() => {
    if (!selectedBoardCode) return;
    queueMicrotask(() => void loadStocks(selectedBoardCode));
  }, [selectedBoardCode, loadStocks]);

  useEffect(() => {
    if (!selectedBoardCode) return;
    const next = new URLSearchParams();
    next.set('boardCode', selectedBoardCode);
    if (selectedBoardName) next.set('boardName', selectedBoardName);
    setSearchParams(next, { replace: true });
  }, [selectedBoardCode, selectedBoardName, setSearchParams]);

  const boardSummary = useMemo(() => `${boards.length} 个板块`, [boards.length]);

  const refreshAll = () => {
    void loadBoards();
    if (selectedBoardCode) void loadStocks(selectedBoardCode);
  };

  return (
    <div className="stack discover-sector-page">
      <section className="card">
        <Link to="/discover" className="user-portfolio-chat-link discover-sector-back-link">
          ← 发现首页
        </Link>
        <h1 className="h1 discover-sector-page-title">板块探索</h1>
        <p className="lead today-muted discover-sector-lead">
          基于与管理后台「概念板块」相同的数据源：左侧按{' '}
          <strong>最近分析为买入/持有的成分股数量</strong> 倒序，辅以量榜高分覆盖；右侧展示板块内个股最近 AI 评分与标签。
        </p>
        <div className="discover-sector-toolbar">
          <button
            type="button"
            className="user-portfolio-btn user-portfolio-btn-secondary text-sm"
            disabled={loadingBoards || loadingStocks}
            onClick={() => refreshAll()}
          >
            {loadingBoards || loadingStocks ? '刷新中…' : '刷新数据'}
          </button>
        </div>
      </section>

      {error ? <PortfolioApiErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      <div className="discover-sector-layout">
        <section className="card discover-sector-boards">
          <div className="discover-sector-panel-head">
            <h2 className="text-base font-semibold">板块热度</h2>
            <p className="today-muted text-xs mt-1">{boardSummary} · 热度参考：买持家数、量榜&gt;75、成分总数</p>
          </div>
          <div className="discover-sector-board-list">
            {boards.length === 0 && !loadingBoards ? (
              <p className="today-muted text-sm px-2 py-6">暂无板块数据。需服务端已导入概念板块映射并有分析记录。</p>
            ) : (
              <ul className="discover-sector-board-ul">
                {boards.map((b) => (
                  <li key={b.boardCode}>
                    <button
                      type="button"
                      className={`discover-sector-board-btn ${selectedBoardCode === b.boardCode ? 'discover-sector-board-btn-active' : ''}`.trim()}
                      onClick={() => setSelectedBoardCode(b.boardCode)}
                    >
                      <span className="discover-sector-board-title">{b.boardName}</span>
                      <span className={`discover-sector-board-meta ${boardHeatClass(b)}`.trim()}>
                        成分 {b.stocksCount} · 买持 {b.buyOrHoldCount ?? 0} · 量榜&gt;75 {b.volumeGe75Count ?? 0}
                      </span>
                      <span className="discover-sector-board-code">{b.boardCode}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {loadingBoards ? <p className="today-muted text-xs px-2 py-2">加载板块列表…</p> : null}
          </div>
        </section>

        <section className="card discover-sector-stocks">
          <div className="discover-sector-panel-head">
            <h2 className="text-base font-semibold">{selectedBoardName || '板块个股'}</h2>
            <p className="today-muted text-xs mt-1">评分列为最近一条分析记录；未评分排在末尾（与服务端排序一致）。</p>
          </div>
          <div className="watchlist-table-wrap">
            <table className="watchlist-table discover-sector-table">
              <thead>
                <tr>
                  <th>代码</th>
                  <th>名称</th>
                  <th>评分</th>
                  <th>建议</th>
                  <th>行业</th>
                  <th>概念标签</th>
                  <th className="discover-sector-th-center">自选</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((s) => (
                  <tr key={s.stockCode}>
                    <td className="mono">{s.stockCode}</td>
                    <td className="discover-sector-name-cell">{stockNameCell(s.stockCode, s.stockName)}</td>
                    <td className="discover-sector-score-cell">
                      <PortfolioScoreHistoryBadge stockCode={s.stockCode} score={s.sentimentScore} />
                    </td>
                    <td>{s.operationAdvice ? <PortfolioAdviceBadge advice={s.operationAdvice} /> : '—'}</td>
                    <td className="today-muted text-xs discover-sector-tags">{(s.tagIndustry || []).join('、') || '—'}</td>
                    <td className="today-muted text-xs discover-sector-tags">{(s.tagConcept || []).join('、') || '—'}</td>
                    <td className="discover-sector-td-center">
                      <AddToWatchlistCompact stockCode={s.stockCode} stockName={s.stockName} />
                    </td>
                  </tr>
                ))}
                {!loadingStocks && stocks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="today-muted text-center py-10">
                      {selectedBoardCode ? '暂无个股数据' : '请选择左侧板块'}
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
