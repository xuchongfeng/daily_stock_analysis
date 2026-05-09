import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
} from 'lightweight-charts';
import type { IChartApi, CandlestickData, Time } from 'lightweight-charts';

import { fetchKlineSentimentOverlaySeries, type KlineSentimentOverlaySource } from '../../api/klineSentimentOverlay';
import { fetchStockDailyHistory, type StockHistoryBar } from '../../api/stockHistory';
import type { ReportLanguage, ReportStrategy } from '../../types/analysis';
import { Card } from '../common';
import { DashboardPanelHeader } from '../dashboard';
import { getReportText, normalizeReportLanguage } from '../../utils/reportLanguage';
import { cn } from '../../utils/cn';
import { rowsHaveTradeVolume, toVolumeHistogramData } from '../../utils/klineVolumeHistogram';
import { buildStrategyPriceLineSpecs } from '../../utils/strategyPriceLines';

export type KlineRangePreset = '1m' | '6m' | '1y';

const KLINE_RANGE_DAYS: Record<KlineRangePreset, number> = {
  '1m': 31,
  '6m': 180,
  '1y': 365,
};

const RANGE_ORDER: KlineRangePreset[] = ['1m', '6m', '1y'];

export interface StockDailyKlineCardProps {
  stockCode: string;
  language?: ReportLanguage;
  defaultRange?: KlineRangePreset;
  /** 与报告「策略点位」一致，用于在 K 线主图绘制价位横线 */
  strategy?: Pick<ReportStrategy, 'idealBuy' | 'secondaryBuy' | 'stopLoss' | 'takeProfit'> | null;
}

function normalizeHistoryBars(rows: StockHistoryBar[]): StockHistoryBar[] {
  const byDate = new Map<string, StockHistoryBar>();
  for (const r of rows) {
    const d = (r.date || '').trim();
    if (!d) continue;
    byDate.set(d, r);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

function toCandleData(rows: StockHistoryBar[]): CandlestickData<Time>[] {
  return rows.map((r) => ({
    time: r.date as Time,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
  }));
}

const RANGE_LABEL_KEY: Record<KlineRangePreset, 'dailyKline1m' | 'dailyKline6m' | 'dailyKline1y'> = {
  '1m': 'dailyKline1m',
  '6m': 'dailyKline6m',
  '1y': 'dailyKline1y',
};

/**
 * 报告详情内日 K 线图（数据来自 ``GET /api/v1/stocks/{code}/history``，后端优先读库再补齐）。
 */
export const StockDailyKlineCard: React.FC<StockDailyKlineCardProps> = ({
  stockCode,
  language = 'zh',
  defaultRange = '1m',
  strategy = null,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<KlineRangePreset>(defaultRange);
  const days = KLINE_RANGE_DAYS[range];

  const [rows, setRows] = useState<StockHistoryBar[] | null>(null);
  const [fetchErr, setFetchErr] = useState(false);
  const [chartErr, setChartErr] = useState(false);
  const [scoreLine, setScoreLine] = useState<{
    points: { time: Time; value: number }[];
    source: KlineSentimentOverlaySource;
  }>({ points: [], source: 'none' });

  const reportLanguage = normalizeReportLanguage(language);
  const text = getReportText(reportLanguage);

  const strategyLineSpecs = useMemo(
    () =>
      buildStrategyPriceLineSpecs(
        strategy,
        {
          idealBuy: text.idealBuy,
          secondaryBuy: text.secondaryBuy,
          stopLoss: text.stopLoss,
          takeProfit: text.takeProfit,
        },
        reportLanguage,
      ),
    [
      strategy,
      reportLanguage,
      text.idealBuy,
      text.secondaryBuy,
      text.stopLoss,
      text.takeProfit,
    ],
  );

  const showVolumePane = useMemo(() => (rows != null && rows.length > 0 ? rowsHaveTradeVolume(rows) : false), [rows]);

  useEffect(() => {
    const code = (stockCode || '').trim();
    if (!code) {
      setRows([]);
       
      setFetchErr(true);
      return;
    }

    let cancelled = false;
     
    setRows(null);
     
    setFetchErr(false);
     
    setChartErr(false);
     
    setScoreLine({ points: [], source: 'none' });

    void (async () => {
      try {
        const raw = await fetchStockDailyHistory(code, days);
        const data = normalizeHistoryBars(raw);
        if (!cancelled) {
          setRows(data);
          setFetchErr(false);
        }
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setFetchErr(true);
          console.warn('[StockDailyKlineCard] fetch failed', e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stockCode, days]);

  useEffect(() => {
    const code = (stockCode || '').trim();
    if (!code || !rows || rows.length === 0) {
      return;
    }
    const start = rows[0].date;
    const end = rows[rows.length - 1].date;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetchKlineSentimentOverlaySeries(code, start, end);
        if (!cancelled) {
          setScoreLine({ points: r.points, source: r.source });
        }
      } catch {
        if (!cancelled) {
          setScoreLine({ points: [], source: 'none' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stockCode, rows]);

  useLayoutEffect(() => {
    setChartErr(false);
    if (rows === null || rows.length === 0) {
      chartRef.current?.remove();
      chartRef.current = null;
      return;
    }

    const el = wrapRef.current;
    if (!el) return;

    chartRef.current?.remove();
    chartRef.current = null;

    const w = Math.max(el.clientWidth, el.offsetWidth, 280);

    const scorePts = scoreLine.points;
    const hasVol = rowsHaveTradeVolume(rows);
    const chartHeight = hasVol ? 320 : 280;

    try {
      const chart = createChart(el, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: 'var(--text-secondary-text, #64748b)',
        },
        grid: {
          vertLines: { color: 'var(--border-subtle, #e2e8f0)' },
          horzLines: { color: 'var(--border-subtle, #e2e8f0)' },
        },
        leftPriceScale: {
          visible: scorePts.length > 0,
          borderColor: 'var(--border-default, #cbd5e1)',
        },
        rightPriceScale: { borderColor: 'var(--border-default, #cbd5e1)' },
        timeScale: { borderColor: 'var(--border-default, #cbd5e1)' },
        width: w,
        height: chartHeight,
      });
      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#16a34a',
        downColor: '#dc2626',
        borderVisible: false,
        wickUpColor: '#16a34a',
        wickDownColor: '#dc2626',
      });
      series.setData(toCandleData(rows));
      series.priceScale().applyOptions({
        scaleMargins: hasVol ? { top: 0.06, bottom: 0.32 } : { top: 0.06, bottom: 0.06 },
      });
      for (const pl of strategyLineSpecs) {
        series.createPriceLine({
          price: pl.price,
          color: pl.color,
          lineWidth: 2,
          axisLabelVisible: true,
          title: '',
        });
      }
      if (hasVol) {
        const volSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'vol',
          priceLineVisible: false,
          lastValueVisible: false,
        });
        volSeries.setData(toVolumeHistogramData(rows));
        chart.priceScale('vol').applyOptions({
          scaleMargins: { top: 0.76, bottom: 0 },
        });
      }
      if (scorePts.length > 0) {
        const line = chart.addSeries(LineSeries, {
          color: '#06b6d4',
          lineWidth: 2,
          priceScaleId: 'score',
          lastValueVisible: true,
          priceLineVisible: false,
        });
        line.setData(scorePts);
        chart.priceScale('score').applyOptions({
          scaleMargins: { top: 0.12, bottom: 0.12 },
        });
      }
      chart.timeScale().fitContent();
      chartRef.current = chart;
      setChartErr(false);
    } catch (e) {
      console.warn('[StockDailyKlineCard] createChart failed', e);
      setChartErr(true);
    }

    const cw = el.clientWidth;
    if (cw < 32 && chartRef.current) {
      requestAnimationFrame(() => {
        if (!chartRef.current) return;
        const nw = Math.max(el.clientWidth, el.offsetWidth, 280);
        chartRef.current.applyOptions({ width: nw });
        chartRef.current.timeScale().fitContent();
      });
    }

    return () => {
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [rows, stockCode, scoreLine.points, strategyLineSpecs]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const cw = el.clientWidth;
      if (cw > 0 && chartRef.current) {
        chartRef.current.applyOptions({ width: cw });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const loading = rows === null;
  const empty = !loading && rows.length === 0 && !fetchErr;
  const failed = fetchErr && !loading;
  const showCanvas = !loading && rows.length > 0;
  const scoreCaption =
    scoreLine.source === 'volume_scan'
      ? text.dailyKlineScoreCaptionVolume
      : scoreLine.source === 'history'
        ? text.dailyKlineScoreCaptionHistory
        : null;

  const chartPixelHeight = showVolumePane ? 320 : 280;

  return (
    <Card padding="md" variant="bordered" className="animate-fade-in">
      <DashboardPanelHeader title={text.dailyKlineTitle} />
      <div
        className="mt-2 flex flex-wrap gap-2"
        role="group"
        aria-label={text.dailyKlineRangeAria}
      >
        {RANGE_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            disabled={!stockCode.trim()}
            aria-pressed={range === key}
            onClick={() => setRange(key)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors',
              range === key
                ? 'border-cyan/50 bg-cyan/12 text-cyan shadow-sm'
                : 'border-white/12 bg-background/60 text-muted-text hover:bg-muted/35',
            )}
          >
            {text[RANGE_LABEL_KEY[key]]}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="mt-2 text-sm text-muted-text">{text.dailyKlineLoading}</p>
      ) : null}
      {failed ? (
        <p className="mt-2 text-sm text-danger">{text.dailyKlineFail}</p>
      ) : null}
      {empty ? (
        <p className="mt-2 text-sm text-muted-text">{text.dailyKlineEmpty}</p>
      ) : null}
      {chartErr && showCanvas ? (
        <p className="mt-2 text-sm text-danger">{text.dailyKlineChartFail}</p>
      ) : null}
      <div
        ref={wrapRef}
        className="report-kline-chart mt-2 w-full"
        style={{
          height: chartPixelHeight,
          visibility: showCanvas && !chartErr ? 'visible' : 'hidden',
          pointerEvents: showCanvas && !chartErr ? 'auto' : 'none',
        }}
        aria-hidden={loading || !rows?.length || chartErr}
      />
      {showVolumePane ? (
        <p className="mt-2 text-xs text-muted-text">{text.dailyKlineVolumeCaption}</p>
      ) : null}
      {scoreCaption ? <p className="mt-2 text-xs text-muted-text">{scoreCaption}</p> : null}
    </Card>
  );
};
