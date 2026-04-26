import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { conceptBoardsApi } from '../api/conceptBoards';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import { AdviceBadge, ApiErrorAlert, Button, Card, EmptyState, ScoreBadge } from '../components/common';
import { AddToWatchlistButton } from '../components/watchlist/AddToWatchlistButton';
import type { ConceptBoardItem, ConceptBoardStockItem } from '../types/conceptBoard';
import { xueqiuStockHref } from '../utils/xueqiu';

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

const ConceptBoardsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [boards, setBoards] = useState<ConceptBoardItem[]>([]);
  const [stocks, setStocks] = useState<ConceptBoardStockItem[]>([]);
  const [selectedBoardCode, setSelectedBoardCode] = useState<string>('');
  const [selectedBoardName, setSelectedBoardName] = useState<string>('');
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const desiredBoardCode = (searchParams.get('boardCode') || '').trim();
  const desiredBoardName = (searchParams.get('boardName') || '').trim();

  const loadBoards = useCallback(async () => {
    setLoadingBoards(true);
    setError(null);
    try {
      const res = await conceptBoardsApi.listBoards();
      const list = res.items || [];
      setBoards(list);
      const byCode = desiredBoardCode
        ? list.find((x) => x.boardCode === desiredBoardCode)
        : undefined;
      const byName = !byCode && desiredBoardName
        ? list.find((x) => x.boardName === desiredBoardName)
        : undefined;
      const target = byCode || byName || list[0];
      if (target) {
        setSelectedBoardCode(target.boardCode);
        setSelectedBoardName(target.boardName);
      }
    } catch (e) {
      setError(getParsedApiError(e));
    } finally {
      setLoadingBoards(false);
    }
  }, [desiredBoardCode, desiredBoardName]);

  const loadStocks = useCallback(async (boardCode: string) => {
    if (!boardCode) {
      setStocks([]);
      return;
    }
    setLoadingStocks(true);
    setError(null);
    try {
      const res = await conceptBoardsApi.listBoardStocks(boardCode, { limit: 1000, offset: 0 });
      setStocks(res.items || []);
      setSelectedBoardName(res.board?.boardName || boardCode);
    } catch (e) {
      setError(getParsedApiError(e));
      setStocks([]);
    } finally {
      setLoadingStocks(false);
    }
  }, []);

  useEffect(() => {
    document.title = '概念板块 - DSA';
  }, []);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    if (!selectedBoardCode) return;
    void loadStocks(selectedBoardCode);
  }, [selectedBoardCode, loadStocks]);

  useEffect(() => {
    if (!selectedBoardCode) return;
    const next = new URLSearchParams();
    next.set('boardCode', selectedBoardCode);
    if (selectedBoardName) {
      next.set('boardName', selectedBoardName);
    }
    setSearchParams(next, { replace: true });
  }, [selectedBoardCode, selectedBoardName, setSearchParams]);

  const boardCountText = useMemo(() => `${boards.length} 个板块`, [boards.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-gradient text-[hsl(var(--primary-foreground))] shadow-[0_12px_28px_var(--nav-brand-shadow)]">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground md:text-xl">概念板块</h1>
            <p className="mt-1 text-sm text-secondary-text">
              左侧板块按「最近一次分析为买入或持有的个股数」倒序；右侧个股按最近一次 AI 评分排序，未评分自动排末尾。
            </p>
          </div>
        </div>
        <Button type="button" variant="secondary" className="shrink-0 gap-2" disabled={loadingBoards || loadingStocks} onClick={() => { void loadBoards(); if (selectedBoardCode) void loadStocks(selectedBoardCode); }}>
          <RefreshCw className={`h-4 w-4 ${(loadingBoards || loadingStocks) ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </header>

      {error ? (
        <div className="max-w-xl">
          <ApiErrorAlert error={error} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="p-0 lg:col-span-1">
          <div className="border-b border-border/60 px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">板块列表</h2>
            <p className="mt-1 text-xs text-secondary-text">{boardCountText}</p>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {boards.length === 0 && !loadingBoards ? (
              <EmptyState title="暂无板块数据" description="请先执行概念板块初始化脚本导入数据。" />
            ) : (
              <ul className="space-y-1">
                {boards.map((b) => (
                  <li key={b.boardCode}>
                    <button
                      type="button"
                      onClick={() => setSelectedBoardCode(b.boardCode)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        selectedBoardCode === b.boardCode ? 'bg-hover text-foreground' : 'text-secondary-text hover:bg-hover/60 hover:text-foreground'
                      }`}
                    >
                      <div className="truncate font-medium">{b.boardName}</div>
                      <div className="mt-0.5 text-xs opacity-70">
                        {b.boardCode} · {b.stocksCount} 只 · 买持 {b.buyOrHoldCount ?? 0} · 量榜 &gt;75 {b.volumeGe75Count ?? 0}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="p-0 lg:col-span-3">
          <div className="border-b border-border/60 px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">{selectedBoardName || '板块个股'}</h2>
            <p className="mt-1 text-xs text-secondary-text">
              最近评分为空的个股会自动置于列表末尾。
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-hover/40 text-xs text-secondary-text">
                <tr>
                  <th className="w-[7rem] px-4 py-2 font-medium">代码</th>
                  <th className="w-[6rem] px-4 py-2 font-medium">名称</th>
                  <th className="px-4 py-2 font-medium">评分</th>
                  <th className="w-[10rem] px-4 py-2 font-medium">建议</th>
                  <th className="w-[14rem] px-4 py-2 font-medium">行业标签</th>
                  <th className="w-[20rem] px-4 py-2 font-medium">概念标签</th>
                  <th className="px-2 py-2 font-medium text-center">自选</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((s) => (
                  <tr key={s.stockCode} className="border-t border-border/50">
                    <td className="px-4 py-2 font-mono text-xs tabular-nums text-foreground">{s.stockCode}</td>
                    <td className="max-w-[6rem] px-4 py-2 text-foreground">
                      <span className="block truncate" title={s.stockName || s.stockCode}>
                        {nameCell(s.stockCode, s.stockName)}
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-secondary-text">
                      {s.sentimentScore != null ? <ScoreBadge score={s.sentimentScore} /> : '—'}
                    </td>
                    <td className="min-w-[10rem] px-4 py-2 text-secondary-text">
                      {s.operationAdvice ? <AdviceBadge advice={s.operationAdvice} /> : '—'}
                    </td>
                    <td className="max-w-[14rem] px-4 py-2 text-xs text-secondary-text">{(s.tagIndustry || []).join('、') || '—'}</td>
                    <td className="max-w-[20rem] px-4 py-2 text-xs text-secondary-text">{(s.tagConcept || []).join('、') || '—'}</td>
                    <td className="px-2 py-2 text-center align-middle">
                      <AddToWatchlistButton stockCode={s.stockCode} stockName={s.stockName} compact />
                    </td>
                  </tr>
                ))}
                {!loadingStocks && stocks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-secondary-text">暂无个股数据</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ConceptBoardsPage;
