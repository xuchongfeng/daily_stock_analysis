import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChartColumnBig, RefreshCw } from 'lucide-react';
import { crawlerThsApi } from '../api/crawlerThs';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import {
  ApiErrorAlert,
  Button,
  Card,
  EmptyState,
  Input,
  Pagination,
  Select,
} from '../components/common';
import type { ThsConceptItem, ThsConceptRunItem } from '../types/crawlerThs';
import { xueqiuStockHref } from '../utils/xueqiu';

const RUNS_LIMIT = 50;
const CONCEPTS_LIMIT = 80;
const CONSTITUENTS_LIMIT = 150;

/** 同花顺板块列表 + 板块成分（默认使用最新入库快照；不展示爬取运行明细） */
const SectorVolumeAnalysisPage: React.FC = () => {
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [runs, setRuns] = useState<ThsConceptRunItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const [conceptsPage, setConceptsPage] = useState(1);
  const [conceptQInput, setConceptQInput] = useState('');
  const [conceptQ, setConceptQ] = useState('');
  const [concepts, setConcepts] = useState<ThsConceptItem[]>([]);
  const [conceptsTotal, setConceptsTotal] = useState(0);
  const [conceptsLoading, setConceptsLoading] = useState(false);

  const [selectedConceptCode, setSelectedConceptCode] = useState<string | null>(null);
  const [selectedConceptName, setSelectedConceptName] = useState<string | null>(null);
  const [constPage, setConstPage] = useState(1);
  const [constItems, setConstItems] = useState<
    { stockCode: string; stockName?: string | null; page: number }[]
  >([]);
  const [constTotal, setConstTotal] = useState(0);
  const [constLoading, setConstLoading] = useState(false);

  const runSelectOptions = useMemo(
    () =>
      runs.map((r) => ({
        value: r.runId,
        label: (r.createdAt && r.createdAt.trim()) || `${r.runId.slice(0, 10)}…`,
      })),
    [runs]
  );

  const conceptsTotalPages = Math.max(1, Math.ceil(conceptsTotal / CONCEPTS_LIMIT));
  const constTotalPages = Math.max(1, Math.ceil(constTotal / CONSTITUENTS_LIMIT));

  const loadRuns = useCallback(async () => {
    setError(null);
    setBootLoading(true);
    try {
      const res = await crawlerThsApi.listRuns({ page: 1, limit: RUNS_LIMIT });
      const items = res.items || [];
      setRuns(items);
      setSelectedRunId((prev) => {
        if (prev && items.some((r) => r.runId === prev)) {
          return prev;
        }
        return items[0]?.runId ?? null;
      });
    } catch (e) {
      setError(getParsedApiError(e));
      setRuns([]);
      setSelectedRunId(null);
    } finally {
      setBootLoading(false);
    }
  }, []);

  const loadConcepts = useCallback(async () => {
    if (!selectedRunId) {
      setConcepts([]);
      setConceptsTotal(0);
      return;
    }
    setConceptsLoading(true);
    setError(null);
    try {
      const res = await crawlerThsApi.listConcepts({
        runId: selectedRunId,
        page: conceptsPage,
        limit: CONCEPTS_LIMIT,
        q: conceptQ.trim() || undefined,
      });
      setConcepts(res.items || []);
      setConceptsTotal(res.total || 0);
    } catch (e) {
      setError(getParsedApiError(e));
      setConcepts([]);
      setConceptsTotal(0);
    } finally {
      setConceptsLoading(false);
    }
  }, [selectedRunId, conceptsPage, conceptQ]);

  const loadConstituents = useCallback(async () => {
    if (!selectedRunId || !selectedConceptCode) {
      setConstItems([]);
      setConstTotal(0);
      return;
    }
    setConstLoading(true);
    setError(null);
    try {
      const res = await crawlerThsApi.listConstituents({
        runId: selectedRunId,
        page: constPage,
        limit: CONSTITUENTS_LIMIT,
        conceptCode: selectedConceptCode,
      });
      const rows = res.items || [];
      setConstItems(
        rows.map((row) => ({
          stockCode: row.stockCode,
          stockName: row.stockName,
          page: row.page,
        }))
      );
      setConstTotal(res.total || 0);
    } catch (e) {
      setError(getParsedApiError(e));
      setConstItems([]);
      setConstTotal(0);
    } finally {
      setConstLoading(false);
    }
  }, [selectedRunId, selectedConceptCode, constPage]);

  useEffect(() => {
    document.title = '板块与成交量 - DSA';
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    setConceptsPage(1);
    setConceptQ('');
    setConceptQInput('');
    setSelectedConceptCode(null);
    setSelectedConceptName(null);
    setConstPage(1);
  }, [selectedRunId]);

  useEffect(() => {
    setConstPage(1);
  }, [selectedConceptCode]);

  useEffect(() => {
    void loadConcepts();
  }, [loadConcepts, refreshTick]);

  useEffect(() => {
    void loadConstituents();
  }, [loadConstituents, refreshTick]);

  const handleRefresh = useCallback(async () => {
    await loadRuns();
    setRefreshTick((t) => t + 1);
  }, [loadRuns]);

  const sectorTitle =
    (selectedConceptName && selectedConceptName.trim()) || selectedConceptCode || '成分股';

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-gradient text-[hsl(var(--primary-foreground))] shadow-[0_12px_28px_var(--nav-brand-shadow)]">
            <ChartColumnBig className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">板块与成交量</h1>
            <p className="mt-1 max-w-3xl text-sm text-secondary-text">
              浏览同花顺概念<strong className="font-medium text-foreground">板块列表</strong>，点击某一板块查看其
              <strong className="font-medium text-foreground">成分股</strong>。默认使用库中
              <strong className="font-medium text-foreground">最新一条</strong>入库数据；有多条时可切换「数据时间」。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3 sm:justify-end">
          {runs.length > 1 ? (
            <div className="min-w-[12rem] sm:max-w-xs">
              <Select
                label="数据时间"
                value={selectedRunId || ''}
                onChange={(v) => setSelectedRunId(v || null)}
                options={runSelectOptions}
              />
            </div>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={bootLoading}
            onClick={() => void handleRefresh()}
          >
            <RefreshCw className={`h-4 w-4 ${bootLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </header>

      {error ? (
        <div className="max-w-xl">
          <ApiErrorAlert error={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}

      {bootLoading && runs.length === 0 ? (
        <p className="py-10 text-center text-sm text-secondary-text">加载中…</p>
      ) : runs.length === 0 || !selectedRunId ? (
        <EmptyState
          title="暂无板块数据"
          description="请先在「数据爬取」或 CLI 完成同花顺概念入库（需 CRAWLER_THS_PERSIST_DB=true）。"
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card padding="md" variant="bordered">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-sm font-semibold text-foreground">板块列表</h2>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[10rem] flex-1 sm:max-w-xs">
                  <Input
                    label="筛选"
                    placeholder="代码或名称"
                    value={conceptQInput}
                    onChange={(e) => setConceptQInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setConceptQ(conceptQInput);
                        setConceptsPage(1);
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setConceptQ(conceptQInput);
                    setConceptsPage(1);
                  }}
                >
                  搜索
                </Button>
              </div>
            </div>
            {conceptsLoading && concepts.length === 0 ? (
              <p className="py-6 text-center text-sm text-secondary-text">加载板块…</p>
            ) : concepts.length === 0 ? (
              <p className="py-6 text-center text-sm text-secondary-text">暂无板块（可调整筛选或换一条数据时间）。</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="border-b border-border/60 text-xs text-secondary-text">
                      <tr>
                        <th className="py-2 pr-3 font-medium">代码</th>
                        <th className="py-2 pr-3 font-medium">名称</th>
                        <th className="py-2 pr-3 font-medium"> </th>
                      </tr>
                    </thead>
                    <tbody>
                      {concepts.map((c) => {
                        const active = c.conceptCode === selectedConceptCode;
                        return (
                          <tr
                            key={c.conceptCode}
                            className={`cursor-pointer border-t border-border/40 ${active ? 'bg-hover/80' : ''}`}
                            onClick={() => {
                              setSelectedConceptCode(c.conceptCode);
                              setSelectedConceptName(c.conceptName ?? null);
                            }}
                          >
                            <td className="py-2 pr-3 font-mono text-xs text-foreground">{c.conceptCode}</td>
                            <td className="max-w-[14rem] truncate py-2 pr-3 text-secondary-text" title={c.conceptName || ''}>
                              {c.conceptName?.trim() || '—'}
                            </td>
                            <td className="py-2 pr-3 text-right">
                              {c.detailUrl ? (
                                <a
                                  href={c.detailUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-medium text-[hsl(var(--primary))] underline-offset-2 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  同花顺
                                </a>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  className="mt-4"
                  currentPage={conceptsPage}
                  totalPages={conceptsTotalPages}
                  onPageChange={setConceptsPage}
                />
              </>
            )}
          </Card>

          <Card padding="md" variant="bordered">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              {selectedConceptCode ? `「${sectorTitle}」成分股` : '成分股'}
            </h2>
            {!selectedConceptCode ? (
              <p className="py-10 text-center text-sm text-secondary-text">请在左侧点击选择一个板块。</p>
            ) : constLoading && constItems.length === 0 ? (
              <p className="py-10 text-center text-sm text-secondary-text">加载成分…</p>
            ) : constItems.length === 0 ? (
              <p className="py-10 text-center text-sm text-secondary-text">该板块暂无成分数据。</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[400px] text-left text-sm">
                    <thead className="border-b border-border/60 text-xs text-secondary-text">
                      <tr>
                        <th className="py-2 pr-3 font-medium">股票代码</th>
                        <th className="py-2 pr-3 font-medium">名称</th>
                        <th className="py-2 pr-3 font-medium tabular-nums">页</th>
                      </tr>
                    </thead>
                    <tbody>
                      {constItems.map((row, idx) => {
                        const href = xueqiuStockHref(row.stockCode);
                        const name = row.stockName?.trim() || '—';
                        return (
                          <tr key={`${row.stockCode}-${idx}`} className="border-t border-border/40">
                            <td className="py-2 pr-3 font-mono text-foreground">{row.stockCode}</td>
                            <td className="max-w-[12rem] truncate py-2 pr-3">
                              {href && name !== '—' ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[hsl(var(--primary))] underline-offset-2 hover:underline"
                                >
                                  {name}
                                </a>
                              ) : (
                                <span className="text-secondary-text">{name}</span>
                              )}
                            </td>
                            <td className="py-2 pr-3 tabular-nums text-secondary-text">{row.page}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  className="mt-4"
                  currentPage={constPage}
                  totalPages={constTotalPages}
                  onPageChange={setConstPage}
                />
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default SectorVolumeAnalysisPage;
