import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import { crawlerThsApi } from '../api/crawlerThs';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import {
  ApiErrorAlert,
  Badge,
  Button,
  Card,
  EmptyState,
  InlineAlert,
  Input,
  Pagination,
  Select,
} from '../components/common';
import type { ThsConceptItem, ThsConceptRunItem } from '../types/crawlerThs';
import { xueqiuStockHref } from '../utils/xueqiu';

const RUNS_LIMIT = 20;
const CONCEPTS_LIMIT = 80;
const CONSTITUENTS_LIMIT = 150;

const ThsConceptCrawlPage: React.FC = () => {
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [runsPage, setRunsPage] = useState(1);
  const [runs, setRuns] = useState<ThsConceptRunItem[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const [conceptsPage, setConceptsPage] = useState(1);
  const [conceptQ, setConceptQ] = useState('');
  const [conceptQInput, setConceptQInput] = useState('');
  const [concepts, setConcepts] = useState<ThsConceptItem[]>([]);
  const [conceptsTotal, setConceptsTotal] = useState(0);
  const [conceptsLoading, setConceptsLoading] = useState(false);

  const [constituentConcept, setConstituentConcept] = useState('');
  const [constPage, setConstPage] = useState(1);
  const [constItems, setConstItems] = useState<
    { conceptCode: string; stockCode: string; stockName?: string | null; page: number }[]
  >([]);
  const [constTotal, setConstTotal] = useState(0);
  const [constLoading, setConstLoading] = useState(false);

  const runsTotalPages = Math.max(1, Math.ceil(runsTotal / RUNS_LIMIT));
  const conceptsTotalPages = Math.max(1, Math.ceil(conceptsTotal / CONCEPTS_LIMIT));
  const constTotalPages = Math.max(1, Math.ceil(constTotal / CONSTITUENTS_LIMIT));

  const conceptSelectOptions = useMemo(() => {
    const base = [{ value: '', label: '全部概念' }];
    const seen = new Set<string>();
    for (const c of concepts) {
      if (seen.has(c.conceptCode)) {
        continue;
      }
      seen.add(c.conceptCode);
      const name = (c.conceptName || '').trim() || c.conceptCode;
      base.push({ value: c.conceptCode, label: `${name} (${c.conceptCode})` });
    }
    return base;
  }, [concepts]);

  const loadRuns = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await crawlerThsApi.listRuns({ page: runsPage, limit: RUNS_LIMIT });
      setRuns(res.items || []);
      setRunsTotal(res.total || 0);
      setSelectedRunId((prev) => {
        if (prev && res.items?.some((r) => r.runId === prev)) {
          return prev;
        }
        return res.items?.[0]?.runId ?? null;
      });
    } catch (e) {
      setError(getParsedApiError(e));
      setRuns([]);
      setRunsTotal(0);
      setSelectedRunId(null);
    } finally {
      setLoading(false);
    }
  }, [runsPage]);

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
    if (!selectedRunId) {
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
        conceptCode: constituentConcept || null,
      });
      setConstItems(res.items || []);
      setConstTotal(res.total || 0);
    } catch (e) {
      setError(getParsedApiError(e));
      setConstItems([]);
      setConstTotal(0);
    } finally {
      setConstLoading(false);
    }
  }, [selectedRunId, constPage, constituentConcept]);

  useEffect(() => {
    document.title = '概念爬取 - DSA';
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    setConceptsPage(1);
    setConceptQ('');
    setConceptQInput('');
    setConstituentConcept('');
    setConstPage(1);
  }, [selectedRunId]);

  useEffect(() => {
    void loadConcepts();
  }, [loadConcepts]);

  useEffect(() => {
    void loadConstituents();
  }, [loadConstituents]);

  const selectedRun = runs.find((r) => r.runId === selectedRunId);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-gradient text-[hsl(var(--primary-foreground))] shadow-[0_12px_28px_var(--nav-brand-shadow)]">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">概念爬取</h1>
            <p className="mt-1 max-w-2xl text-sm text-secondary-text">
              展示已写入 SQLite 的 <strong className="font-medium text-foreground">同花顺概念</strong>
              爬虫结果（<code className="rounded bg-hover px-1 text-xs">crawler_ths_*</code>
              表）。用于对照 CLI <code className="rounded bg-hover px-1 text-xs">python main.py --crawl ths-concept</code>{' '}
              与磁盘 <code className="rounded bg-hover px-1 text-xs">data/crawler/ths_concept/&lt;run_id&gt;/</code>
              的进度；数据来自最近一次成功落库的运行可选中查看。
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5 self-start"
          disabled={loading}
          onClick={() => void loadRuns()}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </header>

      {error ? (
        <div className="max-w-xl">
          <ApiErrorAlert error={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}

      <Card padding="md" variant="bordered">
        <h2 className="mb-3 text-sm font-semibold text-foreground">运行记录</h2>
        {loading && runs.length === 0 ? (
          <p className="py-8 text-center text-sm text-secondary-text">加载中…</p>
        ) : runs.length === 0 ? (
          <EmptyState
            title="暂无爬取记录"
            description="尚未将 ths-concept 结果写入数据库（需 CRAWLER_THS_PERSIST_DB=true 且完成至少一次爬取）。"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border/60 text-xs text-secondary-text">
                  <tr>
                    <th className="py-2 pr-3 font-medium">运行 ID</th>
                    <th className="py-2 pr-3 font-medium">时间</th>
                    <th className="py-2 pr-3 font-medium">状态</th>
                    <th className="py-2 pr-3 font-medium tabular-nums">概念数</th>
                    <th className="py-2 pr-3 font-medium tabular-nums">成分条数</th>
                    <th className="py-2 pr-3 font-medium">Dry-run</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => {
                    const active = r.runId === selectedRunId;
                    return (
                      <tr
                        key={r.runId}
                        className={`cursor-pointer border-t border-border/40 ${active ? 'bg-hover/80' : ''}`}
                        onClick={() => setSelectedRunId(r.runId)}
                      >
                        <td className="py-2 pr-3 font-mono text-xs text-foreground">{r.runId}</td>
                        <td className="py-2 pr-3 tabular-nums text-secondary-text">{r.createdAt || '—'}</td>
                        <td className="py-2 pr-3">
                          {r.ok ? (
                            <Badge variant="default" size="sm">
                              成功
                            </Badge>
                          ) : (
                            <Badge variant="default" size="sm" className="border-amber-500/40 text-amber-700">
                              未完成/失败
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{r.conceptCount}</td>
                        <td className="py-2 pr-3 tabular-nums">{r.constituentCount}</td>
                        <td className="py-2 pr-3 text-secondary-text">{r.dryRun ? '是' : '否'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              className="mt-4"
              currentPage={runsPage}
              totalPages={runsTotalPages}
              onPageChange={setRunsPage}
            />
          </>
        )}
      </Card>

      {selectedRun ? (
        <>
          {selectedRun.message || (selectedRun.errors && selectedRun.errors.length > 0) ? (
            <InlineAlert
              variant={selectedRun.ok ? 'info' : 'warning'}
              className="text-sm"
              message={
                selectedRun.message ||
                (Array.isArray(selectedRun.errors) ? JSON.stringify(selectedRun.errors) : '') ||
                ''
              }
            />
          ) : null}

          <Card padding="md" variant="bordered">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">概念（板块）</h2>
                <p className="mt-1 text-xs text-secondary-text">
                  运行 <span className="font-mono">{selectedRun.runId}</span> · 目录{' '}
                  <span className="break-all text-secondary-text">{selectedRun.catalogUrl}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[12rem] flex-1 sm:max-w-xs">
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
              <p className="py-6 text-center text-sm text-secondary-text">加载概念…</p>
            ) : concepts.length === 0 ? (
              <p className="py-6 text-center text-sm text-secondary-text">本运行下暂无概念数据（可能为 dry-run 或未写入）。</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="border-b border-border/60 text-xs text-secondary-text">
                      <tr>
                        <th className="py-2 pr-3 font-medium">概念代码</th>
                        <th className="py-2 pr-3 font-medium">名称</th>
                        <th className="py-2 pr-3 font-medium">详情</th>
                      </tr>
                    </thead>
                    <tbody>
                      {concepts.map((c) => (
                        <tr key={c.conceptCode} className="border-t border-border/40">
                          <td className="py-2 pr-3 font-mono text-foreground">{c.conceptCode}</td>
                          <td className="max-w-[14rem] truncate py-2 pr-3 text-secondary-text" title={c.conceptName || ''}>
                            {c.conceptName?.trim() || '—'}
                          </td>
                          <td className="py-2 pr-3">
                            {c.detailUrl ? (
                              <a
                                href={c.detailUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-[hsl(var(--primary))] underline-offset-2 hover:underline"
                              >
                                打开
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
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
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-sm font-semibold text-foreground">成分股</h2>
              <div className="w-full min-w-[12rem] sm:max-w-sm">
                <Select
                  label="按概念筛选"
                  placeholder=""
                  value={constituentConcept}
                  onChange={(v) => {
                    setConstituentConcept(v);
                    setConstPage(1);
                  }}
                  options={conceptSelectOptions}
                />
              </div>
            </div>
            {constLoading && constItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-secondary-text">加载成分…</p>
            ) : constItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-secondary-text">暂无成分数据。</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-border/60 text-xs text-secondary-text">
                      <tr>
                        <th className="py-2 pr-3 font-medium">概念代码</th>
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
                          <tr key={`${row.conceptCode}-${row.stockCode}-${idx}`} className="border-t border-border/40">
                            <td className="py-2 pr-3 font-mono text-secondary-text">{row.conceptCode}</td>
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
        </>
      ) : null}
    </div>
  );
};

export default ThsConceptCrawlPage;
