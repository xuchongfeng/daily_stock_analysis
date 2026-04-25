import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { marketScanApi } from '../api/marketScan';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import {
  ApiErrorAlert,
  AdviceBadge,
  Badge,
  Button,
  Card,
  EmptyState,
  Pagination,
  ScoreBadge,
  Select,
} from '../components/common';
import { ReportMarkdown } from '../components/report/ReportMarkdown';
import type { MarketScanBatchSummary, MarketScanItem, MarketScanKindFilter } from '../types/marketScan';
import { xueqiuStockHref } from '../utils/xueqiu';
import { AddToWatchlistButton } from '../components/watchlist/AddToWatchlistButton';
import { MarketScanRatingHistoryPanel } from './MarketScanRatingHistoryPanel';

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

function marketScanNameCell(code: string, name?: string | null) {
  const href = xueqiuStockHref(code);
  const label = name ?? '—';
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

type MarketScannerMainTab = 'batches' | 'rating';
const MarketScannerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const mainTab: MarketScannerMainTab =
    searchParams.get('view') === 'rating' ? 'rating' : 'batches';

  const setMainTab = useCallback(
    (tab: MarketScannerMainTab) => {
      const next = new URLSearchParams(searchParams);
      if (tab === 'rating') {
        next.set('view', 'rating');
      } else {
        next.delete('view');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

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
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeHint, setResumeHint] = useState<string | null>(null);
  const [notifyTopN, setNotifyTopN] = useState(15);
  const [notifyDetailLevel, setNotifyDetailLevel] = useState<'summary' | 'detailed'>('summary');
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyHint, setNotifyHint] = useState<string | null>(null);

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

  const handleResumeBatch = useCallback(async () => {
    if (!selectedBatchId) {
      return;
    }
    setResumeLoading(true);
    setResumeHint(null);
    setLoadError(null);
    try {
      const r = await marketScanApi.resumeBatch(selectedBatchId);
      if (r.skipped) {
        if (r.reason === 'nothing_to_resume') {
          setResumeHint(
            `当前批次无需补全：榜单内标的均已写入分析记录（已记录 ${r.alreadyCompletedBefore} 只，池 ${r.universeSize} 只）。`
          );
        } else if (r.reason === 'invalid_batch_run_id') {
          setResumeHint(r.detail || '批次号格式无效（应为 tm_YYYYMMDD_* 或 tv_YYYYMMDD_*）。');
        } else if (r.reason === 'empty_universe') {
          setResumeHint('无法重建该交易日的榜单股票池，请检查数据源与日期。');
        } else {
          setResumeHint(r.detail || r.reason || '未执行续跑。');
        }
      } else {
        setResumeHint(
          `续跑完成：本次尝试 ${r.resumeAttempted} 只，成功 ${r.successCount}，失败 ${r.failureCount}。` +
            (r.notificationSent ? ' 已发送汇总通知。' : '')
        );
      }
      await loadBatches();
      await loadItems();
    } catch (e) {
      setLoadError(getParsedApiError(e));
    } finally {
      setResumeLoading(false);
    }
  }, [selectedBatchId, loadBatches, loadItems]);

  const handleNotifyBatch = useCallback(async () => {
    if (!selectedBatchId) {
      return;
    }
    const n = Math.min(200, Math.max(1, Math.floor(Number(notifyTopN)) || 15));
    setNotifyLoading(true);
    setNotifyHint(null);
    setLoadError(null);
    try {
      const r = await marketScanApi.notifyBatch(selectedBatchId, {
        topN: n,
        detailLevel: notifyDetailLevel,
      });
      if (r.skipped) {
        if (r.reason === 'notifier_unavailable') {
          setNotifyHint('未配置可用通知渠道，请在环境变量中配置微信/飞书/Telegram/邮件等后再试。');
        } else if (r.reason === 'empty_batch') {
          setNotifyHint('该批次暂无分析记录，无法推送。');
        } else if (r.reason === 'invalid_batch_run_id') {
          setNotifyHint(r.detail || '批次号格式无效。');
        } else {
          setNotifyHint(r.detail || r.reason || '未发送。');
        }
      } else if (r.notificationSent) {
        setNotifyHint(
          `通知已发送：按评分取前 ${r.itemsIncluded} 条（本批次共 ${r.totalInBatch} 条）。`
        );
      } else {
        setNotifyHint(
          `推送未完成：已选取 ${r.itemsIncluded} 条，请检查服务端通知日志与渠道配置。`
        );
      }
    } catch (e) {
      setLoadError(getParsedApiError(e));
    } finally {
      setNotifyLoading(false);
    }
  }, [selectedBatchId, notifyTopN, notifyDetailLevel]);

  useEffect(() => {
    if (mainTab !== 'batches') {
      return;
    }
    void loadBatches();
  }, [mainTab, loadBatches]);

  useEffect(() => {
    if (mainTab !== 'batches') {
      return;
    }
    void loadItems();
  }, [mainTab, loadItems]);

  useEffect(() => {
    setSortBy('sentiment_score');
    setPage(1);
    setResumeHint(null);
    setNotifyHint(null);
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

      <div className="flex flex-wrap gap-2 border-b border-border/50 pb-3">
        <button
          type="button"
          onClick={() => setMainTab('batches')}
          className={`ui-tab-pill rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            mainTab === 'batches'
              ? 'ui-tab-pill-active'
              : ''
          }`}
        >
          批次浏览
        </button>
        <button
          type="button"
          onClick={() => setMainTab('rating')}
          className={`ui-tab-pill rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            mainTab === 'rating'
              ? 'ui-tab-pill-active'
              : ''
          }`}
        >
          评分历史
        </button>
      </div>

      {mainTab === 'rating' ? (
        <MarketScanRatingHistoryPanel />
      ) : null}

      {mainTab === 'batches' && loadError ? (
        <ApiErrorAlert error={loadError} />
      ) : null}

      {mainTab === 'batches' ? (
        <>
          <div className="flex flex-wrap gap-2">
            {SCAN_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setScanKindTab(t.id);
                  setPage(1);
                }}
                className={`ui-tab-pill rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  scanKindTab === t.id
                    ? 'ui-tab-pill-active'
                    : ''
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
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!selectedBatchId || resumeLoading}
              onClick={() => void handleResumeBatch()}
            >
              {resumeLoading ? '续跑中…' : '重跑（补全未完成）'}
            </Button>
            <div className="min-w-[5.5rem]">
              <label className="mb-1 block text-xs text-secondary-text" htmlFor="market-scan-notify-topn">
                推送条数
              </label>
              <input
                id="market-scan-notify-topn"
                type="number"
                min={1}
                max={200}
                value={notifyTopN}
                onChange={(e) => setNotifyTopN(Number(e.target.value))}
                className={DATE_INPUT_CLASS}
                aria-label="通知纳入的股票条数上限"
              />
            </div>
            <div className="min-w-[10rem]">
              <label className="mb-1 block text-xs text-secondary-text">通知内容</label>
              <Select
                value={notifyDetailLevel}
                onChange={(v) => setNotifyDetailLevel(v as 'summary' | 'detailed')}
                options={[
                  { value: 'summary', label: '仅摘要列表' },
                  { value: 'detailed', label: '含 AI 分析摘要' },
                ]}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!selectedBatchId || notifyLoading}
              onClick={() => void handleNotifyBatch()}
            >
              {notifyLoading ? '发送中…' : '发送通知'}
            </Button>
          </div>

          {resumeHint ? (
            <p className="mb-4 rounded-xl border border-border/60 bg-hover/30 px-3 py-2 text-sm text-foreground">
              {resumeHint}
            </p>
          ) : null}

          {notifyHint ? (
            <p className="mb-4 rounded-xl border border-border/60 bg-hover/30 px-3 py-2 text-sm text-foreground">
              {notifyHint}
            </p>
          ) : null}

          {!selectedBatchId ? (
            <EmptyState title="请选择批次" />
          ) : itemsLoading ? (
            <div className="py-12 text-center text-sm text-secondary-text">加载中…</div>
          ) : items.length === 0 ? (
            <EmptyState title="本批次无记录" />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-border/60">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-hover/50 text-xs text-secondary-text">
                    <tr>
                      <th className="w-12 px-2 py-2 text-right tabular-nums">序号</th>
                      <th className="px-3 py-2">名次</th>
                      <th className="px-3 py-2">代码</th>
                      <th className="px-3 py-2">名称</th>
                      {showVolCol ? <th className="px-3 py-2">参考成交量</th> : null}
                      <th className="px-3 py-2">涨跌%</th>
                      <th className="px-3 py-2">评分</th>
                      <th className="px-3 py-2">建议</th>
                      <th className="w-12 px-2 py-2 text-center">自选</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, idx) => (
                      <tr key={row.id ?? row.queryId} className="border-t border-border/40">
                        <td className="px-2 py-2 text-right font-mono text-xs tabular-nums text-secondary-text">
                          {(page - 1) * limit + idx + 1}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{row.rankInBatch ?? '—'}</td>
                        <td className="px-3 py-2 font-mono">{row.stockCode}</td>
                        <td className="px-3 py-2">{marketScanNameCell(row.stockCode, row.stockName)}</td>
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
                        <td className="px-3 py-2">
                          <ScoreBadge score={row.sentimentScore} />
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <AdviceBadge advice={row.operationAdvice} />
                        </td>
                        <td className="px-2 py-2 text-center align-middle">
                          <AddToWatchlistButton stockCode={row.stockCode} stockName={row.stockName} compact />
                        </td>
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
        </>
      ) : null}

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
