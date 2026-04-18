import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { marketScanApi } from '../api/marketScan';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import { ApiErrorAlert, Button, Card, EmptyState } from '../components/common';
import { ReportMarkdown } from '../components/report/ReportMarkdown';
import { cn } from '../utils/cn';
import type { VolumeScanDailyGeScorePoint, VolumeScanStockRatingPoint } from '../types/marketScan';

const DATE_INPUT_CLASS =
  'h-10 w-full max-w-[11rem] rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground tabular-nums outline-none transition-colors focus-visible:border-[hsl(var(--primary))] focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]/25';

const CHART_COLORS = {
  primary: 'hsl(var(--primary))',
  muted: 'hsl(var(--muted-foreground))',
  grid: 'hsl(var(--border))',
};

/** 本地日历日 YYYY-MM-DD（与 `<input type="date">` 一致） */
function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 结束日为今天、区间共 `calendarDays` 个自然日（含起止） */
function calendarRangeEndingToday(calendarDays: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (calendarDays - 1));
  return { start: formatLocalYmd(start), end: formatLocalYmd(end) };
}

const DATE_RANGE_QUICK_PRESETS: readonly { key: string; label: string; days: number }[] = [
  { key: '1w', label: '最近1周', days: 7 },
  { key: '2w', label: '最近2周', days: 14 },
  { key: '1m', label: '最近1个月', days: 30 },
  { key: '3m', label: '最近3个月', days: 90 },
];

const QUICK_DATE_CHIP =
  'rounded-full border border-border/60 px-2.5 py-1 text-xs font-medium text-secondary-text transition-colors hover:bg-hover hover:text-foreground';

type QuickDatePresetsProps = {
  onPick: (range: { start: string; end: string }) => void;
  onClear: () => void;
  className?: string;
};

const QuickDatePresets: React.FC<QuickDatePresetsProps> = ({ onPick, onClear, className }) => (
  <div className={cn('flex flex-wrap items-center gap-2', className)}>
    <span className="text-xs text-secondary-text">快捷</span>
    {DATE_RANGE_QUICK_PRESETS.map((p) => (
      <button
        key={p.key}
        type="button"
        className={QUICK_DATE_CHIP}
        onClick={() => onPick(calendarRangeEndingToday(p.days))}
      >
        {p.label}
      </button>
    ))}
    <button type="button" className={QUICK_DATE_CHIP} onClick={onClear}>
      全部日期
    </button>
  </div>
);

type ChartRow = { label: string; v1: number };

/** 个股评分折线：携带整日期与记录 id，供 Tooltip 打开报告 */
type StockChartRow = {
  label: string;
  tradeDate: string;
  v1: number;
  recordId: number | null;
  stockName?: string | null;
};

type StockRatingTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: StockChartRow }>;
  stockCode: string;
};

/** 悬停仅展示数值；报告入口在图下固定条或点击圆点（Tooltip 随鼠标移动无法稳定点击） */
const StockRatingTooltip: React.FC<StockRatingTooltipProps> = ({ active, payload, stockCode }) => {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  return (
    <div className="min-w-[11rem] rounded-xl border border-border/80 bg-card px-3 py-2.5 text-xs shadow-md">
      <div className="font-medium text-foreground">{row.tradeDate}</div>
      <div className="mt-1 text-secondary-text">
        {stockCode} · AI 评分{' '}
        <span className="font-medium tabular-nums text-foreground">{row.v1}</span>
      </div>
      {row.stockName ? <div className="mt-0.5 text-secondary-text">{row.stockName}</div> : null}
      {row.recordId != null ? (
        <p className="mt-2 border-t border-border/50 pt-2 text-[11px] leading-snug text-secondary-text">
          点击图上圆点选中该日，在下方操作条打开报告。
        </p>
      ) : null}
    </div>
  );
};

export const MarketScanRatingHistoryPanel: React.FC = () => {
  const [loadError, setLoadError] = useState<ParsedApiError | null>(null);
  const [minScore, setMinScore] = useState(70);
  const [curveStart, setCurveStart] = useState('');
  const [curveEnd, setCurveEnd] = useState('');
  const [dailyPoints, setDailyPoints] = useState<VolumeScanDailyGeScorePoint[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);

  const [stockInput, setStockInput] = useState('');
  const [seriesStart, setSeriesStart] = useState('');
  const [seriesEnd, setSeriesEnd] = useState('');
  const [stockPoints, setStockPoints] = useState<VolumeScanStockRatingPoint[]>([]);
  const [stockResolvedCode, setStockResolvedCode] = useState('');
  const [stockLoading, setStockLoading] = useState(false);
  const [reportPreview, setReportPreview] = useState<{
    recordId: number;
    stockCode: string;
    stockName: string;
  } | null>(null);
  /** 点击折线圆点选中；报告按钮放在图下固定区域，避免随 Tooltip 移动无法点击 */
  const [selectedStockRow, setSelectedStockRow] = useState<StockChartRow | null>(null);

  const loadDaily = useCallback(async () => {
    setDailyLoading(true);
    setLoadError(null);
    try {
      const res = await marketScanApi.getVolumeRatingThresholdDaily({
        minScore: Math.min(100, Math.max(0, Math.floor(Number(minScore)) || 70)),
        startDate: curveStart || null,
        endDate: curveEnd || null,
      });
      setDailyPoints(res.points || []);
    } catch (e) {
      setLoadError(getParsedApiError(e));
    } finally {
      setDailyLoading(false);
    }
  }, [minScore, curveStart, curveEnd]);

  const loadStock = useCallback(
    async (rangeOverride?: { start: string; end: string }) => {
      const code = stockInput.trim();
      if (!code) {
        setStockPoints([]);
        setStockResolvedCode('');
        setLoadError(null);
        return;
      }
      setStockLoading(true);
      setLoadError(null);
      const startDate = rangeOverride?.start ?? seriesStart;
      const endDate = rangeOverride?.end ?? seriesEnd;
      try {
        const res = await marketScanApi.getStockVolumeRatingSeries(code, {
          startDate: startDate || null,
          endDate: endDate || null,
        });
        setStockPoints(res.points || []);
        setStockResolvedCode(res.stockCode || code);
      } catch (e) {
        setLoadError(getParsedApiError(e));
      } finally {
        setStockLoading(false);
      }
    },
    [stockInput, seriesStart, seriesEnd]
  );

  useEffect(() => {
    void loadDaily();
  }, [loadDaily]);

  const dailyChartData: ChartRow[] = useMemo(
    () =>
      (dailyPoints || []).map((p) => ({
        label: p.tradeDate.slice(5),
        v1: p.stockCount,
      })),
    [dailyPoints]
  );

  const stockChartData: StockChartRow[] = useMemo(
    () =>
      (stockPoints || []).map((p) => ({
        label: p.tradeDate.slice(5),
        tradeDate: p.tradeDate,
        v1: p.sentimentScore,
        recordId: p.id ?? null,
        stockName: p.stockName,
      })),
    [stockPoints]
  );

  useEffect(() => {
    setSelectedStockRow((prev) => {
      if (!prev) {
        return null;
      }
      const still = stockChartData.some((p) => p.tradeDate === prev.tradeDate && p.recordId === prev.recordId);
      return still ? prev : null;
    });
  }, [stockChartData]);

  return (
    <div className="flex flex-col gap-6">
      {loadError ? <ApiErrorAlert error={loadError} /> : null}

      <Card padding="md" variant="bordered">
        <h2 className="mb-1 text-sm font-semibold text-foreground">成交量榜：高分股数量</h2>
        <p className="mb-4 text-xs text-secondary-text">
          每个交易日取各股在当日所有成交量榜批次中的最高 AI 评分，再统计评分不低于阈值的
          <span className="tabular-nums">去重股票数</span>。
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-secondary-text" htmlFor="mscan-rh-min">
              评分下限（含）
            </label>
            <input
              id="mscan-rh-min"
              type="number"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="h-10 w-24 rounded-xl border border-border/60 bg-background px-3 text-sm tabular-nums outline-none focus-visible:border-[hsl(var(--primary))]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-secondary-text">开始日</span>
            <input
              type="date"
              value={curveStart}
              onChange={(e) => setCurveStart(e.target.value)}
              className={DATE_INPUT_CLASS}
              aria-label="曲线开始日期"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-secondary-text">结束日</span>
            <input
              type="date"
              value={curveEnd}
              onChange={(e) => setCurveEnd(e.target.value)}
              className={DATE_INPUT_CLASS}
              aria-label="曲线结束日期"
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void loadDaily()} disabled={dailyLoading}>
            {dailyLoading ? '加载中…' : '刷新'}
          </Button>
        </div>
        <QuickDatePresets
          className="mb-4"
          onPick={({ start, end }) => {
            setCurveStart(start);
            setCurveEnd(end);
          }}
          onClear={() => {
            setCurveStart('');
            setCurveEnd('');
          }}
        />
        {dailyChartData.length === 0 ? (
          <EmptyState
            title="暂无数据"
            description="尚无成交量榜（tv_*）批次记录，或当前筛选下无满足条件的交易日。"
          />
        ) : (
          <div className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" opacity={0.6} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke={CHART_COLORS.muted} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke={CHART_COLORS.muted} width={36} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                  }}
                  formatter={(value) => [`${value ?? '—'} 只`, '高分股数']}
                  labelFormatter={(l) => `月-日 ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="v1"
                  name="stockCount"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card padding="md" variant="bordered">
        <h2 className="mb-1 text-sm font-semibold text-foreground">个股：成交量榜 AI 评分</h2>
        <p className="mb-4 text-xs text-secondary-text">
          仅统计出现在成交量榜扫描（批次号 tv_*）中的记录；同一交易日多次分析时取最新一条。悬停查看数值；点击圆点在图下打开报告（避免 Tooltip 随鼠标移动导致按钮无法点中）。
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex min-w-[10rem] flex-1 flex-col gap-1 sm:max-w-xs">
            <label className="text-xs text-secondary-text" htmlFor="mscan-rh-code">
              股票代码
            </label>
            <input
              id="mscan-rh-code"
              type="text"
              placeholder="如 600519"
              value={stockInput}
              onChange={(e) => setStockInput(e.target.value)}
              className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:border-[hsl(var(--primary))]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-secondary-text">开始日</span>
            <input
              type="date"
              value={seriesStart}
              onChange={(e) => setSeriesStart(e.target.value)}
              className={DATE_INPUT_CLASS}
              aria-label="个股曲线开始"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-secondary-text">结束日</span>
            <input
              type="date"
              value={seriesEnd}
              onChange={(e) => setSeriesEnd(e.target.value)}
              className={DATE_INPUT_CLASS}
              aria-label="个股曲线结束"
            />
          </div>
          <Button type="button" size="sm" onClick={() => void loadStock()} disabled={stockLoading || !stockInput.trim()}>
            {stockLoading ? '查询中…' : '查询'}
          </Button>
        </div>
        <QuickDatePresets
          className="mb-4"
          onPick={({ start, end }) => {
            setSeriesStart(start);
            setSeriesEnd(end);
            if (stockInput.trim()) {
              void loadStock({ start, end });
            }
          }}
          onClear={() => {
            setSeriesStart('');
            setSeriesEnd('');
            if (stockInput.trim()) {
              void loadStock({ start: '', end: '' });
            }
          }}
        />
        {stockResolvedCode && stockChartData.length > 0 ? (
          <p className="mb-2 text-xs text-secondary-text">
            当前展示：<span className="font-medium text-foreground">{stockResolvedCode}</span>
            {stockPoints.length && stockPoints[stockPoints.length - 1]?.stockName
              ? ` · ${stockPoints[stockPoints.length - 1]?.stockName}`
              : null}
          </p>
        ) : null}
        {stockChartData.length === 0 && stockResolvedCode ? (
          <EmptyState title="无成交量榜评分记录" description="该代码在筛选范围内未出现在 tv_* 批次中，或尚无 AI 评分。" />
        ) : null}
        {stockChartData.length === 0 && !stockResolvedCode ? (
          <EmptyState title="输入代码后查询" description="将展示该股票在成交量榜扫描中的按日评分曲线。" />
        ) : null}
        {stockChartData.length > 0 ? (
          <div className="w-full min-w-0">
            <div className="h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stockChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" opacity={0.6} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke={CHART_COLORS.muted} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke={CHART_COLORS.muted} width={32} />
                  <ReferenceLine y={70} stroke={CHART_COLORS.muted} strokeDasharray="4 4" />
                  <Tooltip
                    content={(tooltipProps) => (
                      <StockRatingTooltip {...tooltipProps} stockCode={stockResolvedCode} />
                    )}
                    cursor={{ stroke: CHART_COLORS.primary, strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="v1"
                    name="score"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    dot={(dotProps: { cx?: number; cy?: number; payload?: StockChartRow }) => {
                      const { cx, cy, payload } = dotProps;
                      if (cx == null || cy == null || !payload) {
                        return null;
                      }
                      const sel =
                        selectedStockRow?.tradeDate === payload.tradeDate &&
                        selectedStockRow?.recordId === payload.recordId;
                      const canOpen = payload.recordId != null;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={sel ? 6 : 3}
                          fill={CHART_COLORS.primary}
                          stroke="hsl(var(--background))"
                          strokeWidth={sel ? 2 : 1}
                          style={{ cursor: canOpen ? 'pointer' : 'default' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!canOpen) {
                              return;
                            }
                            setSelectedStockRow((prev) =>
                              prev?.tradeDate === payload.tradeDate && prev?.recordId === payload.recordId
                                ? null
                                : payload
                            );
                          }}
                        />
                      );
                    }}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {selectedStockRow?.recordId != null ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-hover/25 px-3 py-2.5 text-xs">
                <span className="text-secondary-text">
                  已选{' '}
                  <span className="font-medium text-foreground">{selectedStockRow.tradeDate}</span>
                  {selectedStockRow.stockName ? (
                    <span className="text-secondary-text"> · {selectedStockRow.stockName}</span>
                  ) : null}
                  <span className="tabular-nums text-secondary-text">
                    {' '}
                    · AI 评分 <span className="font-medium text-foreground">{selectedStockRow.v1}</span>
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    const rid = selectedStockRow.recordId;
                    if (rid == null) {
                      return;
                    }
                    setReportPreview({
                      recordId: rid,
                      stockCode: stockResolvedCode,
                      stockName: selectedStockRow.stockName || stockResolvedCode,
                    });
                  }}
                >
                  查看报告
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedStockRow(null)}>
                  清除选中
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-secondary-text">提示：点击折线上的圆点可选中某日，再点「查看报告」。</p>
            )}
          </div>
        ) : null}
      </Card>

      {reportPreview ? (
        <ReportMarkdown
          recordId={reportPreview.recordId}
          stockName={reportPreview.stockName}
          stockCode={reportPreview.stockCode}
          onClose={() => setReportPreview(null)}
        />
      ) : null}
    </div>
  );
};
