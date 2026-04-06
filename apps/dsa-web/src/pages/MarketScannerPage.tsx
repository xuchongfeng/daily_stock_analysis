import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { marketScanApi } from '../api/marketScan';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import {
  ApiErrorAlert,
  Badge,
  Button,
  Card,
  EmptyState,
  Pagination,
  Select,
} from '../components/common';
import { ReportMarkdown } from '../components/report/ReportMarkdown';
import type { MarketScanBatchSummary, MarketScanItem, MarketScanKindFilter } from '../types/marketScan';

const DATE_INPUT_CLASS =
  'h-10 w-full max-w-[11rem] rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground tabular-nums outline-none transition-colors focus-visible:border-[hsl(var(--primary))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]/25';

const SCAN_TABS: { id: MarketScanKindFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'gainers', label: '涨幅榜' },
  { id: 'volume', label: '成交量榜' },
];

function sortOptionsForBatch(batch: MarketScanBatchSummary | undefined) {
  const base = [
    { value: 'sentiment_score', label: 'AI 评分' },
    { value: 'rank_in_batch', label: '榜单名次' },
    { value: 'ref_change_pct', label: '当日涨跌幅' },
    { value: 'created_at', label: '分析时间' },
  ];
  if (batch?.scanKind === 'volume') {
    return [
      { value: 'sentiment_score', label: 'AI 评分' },
      { value: 'ref_trade_volume', label: '参考成交量' },
      { value: 'rank_in_batch', label: '榜单名次' },
      { value: 'ref_change_pct', label: '当日涨跌幅' },
      { value: 'created_at', label: '分析时间' },
    ];
  }
  return base;
}

const MarketScannerPage: React.FC = () => {
  const [loadError, setLoadError] = useState<ParsedApiError | null>(null);
  const [batches, setBatches] = useState<MarketScanBatchSummary[]>([]);
  const [scanKindTab, setScanKindTab] = useState<MarketScanKindFilter>('all');
  const [batchDateFilter, setBatchDateFilter] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [items, setItems] = useState<MarketScanItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(30);
  const [sortBy, setSortBy] = useState('sentiment_score');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [itemsLoading, setItemsLoading] = useState(false);
  const [preview, setPreview] = useState<MarketScanItem | null>(null);

  const selectedBatch = useMemo(
    () => batches.find((b) => b.batchRunId === selectedBatchId),
    [batches, selectedBatchId]
  );

  const loadBatches = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await marketScanApi.listBatches(40, batchDateFilter || null, scanKindTab);
      const list = res.items || [];
      setBatches(list);
      setSelectedBatchId((prev) => {
        if (list.length === 0) {
          return null;
        }
        if (prev && list.some((b) => b.batchRunId === prev)) {
          return prev;
        }
        return list[0]?.batchRunId ?? null;
      });
    } catch (e) {
      setLoadError(getParsedApiError(e));
    }
  }, [batchDateFilter, scanKindTab]);

  const loadItems = useCallback(async () => {
    if (!selectedBatchId) {
      setItems([]);
      setTotal(0);
      return;
    }
    setItemsLoading(true);
    setLoadError(null);
    try {
      const res = await marketScanApi.listBatchItems({
        batchRunId: selectedBatchId,
        sortBy,
        order,
        page,
        limit,
      });
      setItems(res.items || []);
      setTotal(res.total);
    } catch (e) {
      setLoadError(getParsedApiError(e));
    } finally {
      setItemsLoading(false);
    }
  }, [selectedBatchId, sortBy, order, page, limit]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    setSortBy('sentiment_score');
    setPage(1);
  }, [selectedBatchId]);

  const showVolCol = selectedBatch?.scanKind === 'volume';

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-gradient text-[hsl(var(--primary-foreground))]">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">榜单扫描</h1>
          <p className="text-sm text-secondary-text">
            涨幅榜与成交量 Top N 批量分析批次；可按类型与交易日筛选，支持按评分、名次、涨跌幅与成交量排序。
          </p>
        </div>
      </div>

      {loadError ? (
        <ApiErrorAlert error={loadError} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {SCAN_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setScanKindTab(t.id);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              scanKindTab === t.id
                ? 'border-[hsl(var(--primary))] bg-[var(--nav-active-bg)] text-foreground'
                : 'border-border/60 text-secondary-text hover:bg-hover'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(220px,280px)_1fr]">
        <Card padding="md" variant="bordered">
          <h2 className="mb-3 text-sm font-semibold text-foreground">批次</h2>
          <div className="mb-3 flex flex-col gap-2">
            <label className="text-xs text-secondary-text" htmlFor="market-scan-batch-date">
              按交易日筛选
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="market-scan-batch-date"
                type="date"
                value={batchDateFilter}
                onChange={(e) => {
                  setBatchDateFilter(e.target.value);
                  setPage(1);
                }}
                className={DATE_INPUT_CLASS}
                aria-label="按批次交易日筛选"
              />
              {batchDateFilter ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBatchDateFilter('');
                    setPage(1);
                  }}
                >
                  清除
                </Button>
              ) : null}
            </div>
          </div>
          {batches.length === 0 ? (
            <EmptyState
              title={batchDateFilter ? '该交易日暂无批次' : '暂无批次'}
              description={
                batchDateFilter
                  ? '请换一天或清除筛选；涨幅批次 tm_YYYYMMDD_*，成交量批次 tv_YYYYMMDD_*'
                  : '运行 python main.py --market-scan gainers 或 --market-scan volume 后此处将显示记录'
              }
            />
          ) : (
            <ul className="flex max-h-[480px] flex-col gap-1 overflow-y-auto">
              {batches.map((b) => (
                <li key={b.batchRunId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBatchId(b.batchRunId);
                      setPage(1);
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-all ${
                      selectedBatchId === b.batchRunId
                        ? 'border-[hsl(var(--primary))] bg-[var(--nav-active-bg)] text-foreground'
                        : 'border-border/60 hover:bg-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-secondary-text">{b.batchRunId}</span>
                      <Badge variant={b.scanKind === 'volume' ? 'default' : 'success'}>
                        {b.scanKind === 'volume' ? '成交量' : '涨幅'}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-secondary-text">
                      {b.itemCount} 条 · {b.lastCreatedAt?.slice(0, 19) ?? '—'}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="md" variant="bordered">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[140px]">
              <label className="mb-1 block text-xs text-secondary-text">排序字段</label>
              <Select
                value={sortBy}
                onChange={(v) => {
                  setSortBy(v);
                  setPage(1);
                }}
                options={sortOptionsForBatch(selectedBatch)}
              />
            </div>
            <div className="min-w-[120px]">
              <label className="mb-1 block text-xs text-secondary-text">顺序</label>
              <Select
                value={order}
                onChange={(v) => {
                  setOrder(v as 'asc' | 'desc');
                  setPage(1);
                }}
                options={[
                  { value: 'desc', label: '降序' },
                  { value: 'asc', label: '升序' },
                ]}
              />
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => void loadItems()}>
              刷新
            </Button>
          </div>

          {!selectedBatchId ? (
            <EmptyState title="请选择批次" />
          ) : itemsLoading ? (
            <div className="py-12 text-center text-sm text-secondary-text">加载中…</div>
          ) : items.length === 0 ? (
            <EmptyState title="本批次无记录" />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-hover/50 text-xs text-secondary-text">
                    <tr>
                      <th className="px-3 py-2">名次</th>
                      <th className="px-3 py-2">代码</th>
                      <th className="px-3 py-2">名称</th>
                      {showVolCol ? <th className="px-3 py-2">参考成交量</th> : null}
                      <th className="px-3 py-2">涨跌%</th>
                      <th className="px-3 py-2">评分</th>
                      <th className="px-3 py-2">建议</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.id ?? row.queryId} className="border-t border-border/40">
                        <td className="px-3 py-2 font-mono text-xs">{row.rankInBatch ?? '—'}</td>
                        <td className="px-3 py-2 font-mono">{row.stockCode}</td>
                        <td className="px-3 py-2">{row.stockName ?? '—'}</td>
                        {showVolCol ? (
                          <td className="px-3 py-2 font-mono text-xs">
                            {row.refTradeVolume != null ? row.refTradeVolume.toLocaleString() : '—'}
                          </td>
                        ) : null}
                        <td className="px-3 py-2">
                          {row.refChangePct != null ? (
                            <Badge variant={row.refChangePct >= 0 ? 'success' : 'danger'}>
                              {row.refChangePct.toFixed(2)}%
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2">{row.sentimentScore ?? '—'}</td>
                        <td className="px-3 py-2 text-xs">{row.operationAdvice ?? '—'}</td>
                        <td className="px-3 py-2 text-right">
                          {row.id != null ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(row)}>
                              报告
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <Pagination
                  currentPage={page}
                  totalPages={Math.max(1, Math.ceil(total / limit))}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </Card>
      </div>

      {preview?.id != null ? (
        <ReportMarkdown
          recordId={preview.id}
          stockName={preview.stockName || preview.stockCode}
          stockCode={preview.stockCode}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
};

export default MarketScannerPage;
