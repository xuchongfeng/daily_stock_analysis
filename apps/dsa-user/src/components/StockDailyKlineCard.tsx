import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
} from 'lightweight-charts';
import type { IChartApi, CandlestickData, Time } from 'lightweight-charts';

import { fetchKlineSentimentOverlaySeries, type KlineSentimentOverlaySource } from '../api/klineSentimentOverlay';
import { apiFetch } from '../api/http';
import type { ReportStrategy } from '../types/workbenchAnalysis';
import { rowsHaveTradeVolume, toVolumeHistogramData } from '../utils/klineVolumeHistogram';
import { buildStrategyPriceLineSpecs } from '../utils/strategyPriceLines';

/* eslint-disable react-hooks/set-state-in-effect --
 * K 线拉取与 lightweight-charts 挂载：需在 effect 内同步重置加载态与 chartErr。
 */

/** 与 ``GET /api/v1/stocks/{code}/history`` 的 ``days``（自然日，上限 365）对应 */
export type KlineRangePreset = '1m' | '6m' | '1y';

const KLINE_RANGE_DAYS: Record<KlineRangePreset, number> = {
  '1m': 31,
  '6m': 180,
  '1y': 365,
};

const RANGE_ORDER: KlineRangePreset[] = ['1m', '6m', '1y'];

export interface StockDailyKlineCardProps {
  stockCode: string;
  reportLangZh: boolean;
  /** 默认时间区间 */
  defaultRange?: KlineRangePreset;
  strategy?: Pick<ReportStrategy, 'idealBuy' | 'secondaryBuy' | 'stopLoss' | 'takeProfit'> | null;
}

interface HistoryBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

/** 按日期升序、同日保留最后一条，避免 lightweight-charts 因乱序/重复时间报错 */
function normalizeHistoryBars(rows: HistoryBar[]): HistoryBar[] {
  const byDate = new Map<string, HistoryBar>();
  for (const r of rows) {
    const d = (r.date || '').trim();
    if (!d) continue;
    byDate.set(d, r);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

function toCandleData(rows: HistoryBar[]): CandlestickData<Time>[] {
  return rows.map((r) => ({
    time: r.date as Time,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
  }));
}

export function StockDailyKlineCard({
  stockCode,
  reportLangZh,
  defaultRange = '1m',
  strategy = null,
}: StockDailyKlineCardProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<KlineRangePreset>(defaultRange);
  const days = KLINE_RANGE_DAYS[range];

  /** null = 加载中；[] = 无数据；非空 = 可绘图 */
  const [rows, setRows] = useState<HistoryBar[] | null>(null);
  const [fetchErr, setFetchErr] = useState(false);
  const [chartErr, setChartErr] = useState(false);
  const [scoreLine, setScoreLine] = useState<{
    points: { time: Time; value: number }[];
    source: KlineSentimentOverlaySource;
  }>({ points: [], source: 'none' });

  const title = reportLangZh ? '日 K 线图' : 'Daily candles';
  const loadingText = reportLangZh ? '加载 K 线…' : 'Loading chart…';
  const emptyText = reportLangZh ? '暂无日线数据' : 'No daily bars';
  const failText = reportLangZh ? '加载失败' : 'Failed to load';
  const chartFailText = reportLangZh ? '图表渲染失败' : 'Chart render failed';

  const rangeLabels: Record<KlineRangePreset, string> = reportLangZh
    ? { '1m': '1 个月', '6m': '6 个月', '1y': '1 年' }
    : { '1m': '1M', '6m': '6M', '1y': '1Y' };

  const strategyLineSpecs = useMemo(
    () =>
      buildStrategyPriceLineSpecs(
        strategy,
        {
          idealBuy: reportLangZh ? '理想买入' : 'Ideal buy',
          secondaryBuy: reportLangZh ? '二次买入' : 'Secondary buy',
          stopLoss: reportLangZh ? '止损' : 'Stop loss',
          takeProfit: reportLangZh ? '止盈' : 'Take profit',
        },
        reportLangZh,
      ),
    [strategy, reportLangZh],
  );

  const showVolumePane = useMemo(() => (rows != null && rows.length > 0 ? rowsHaveTradeVolume(rows) : false), [rows]);

  const volumeCaption = showVolumePane
    ? reportLangZh
      ? '底部柱状：成交量（绿涨红跌；右侧刻度为缩写数量级）。'
      : 'Bottom bars: volume (green up / red down; axis uses compact suffixes).'
    : null;

  const scoreCaption =
    scoreLine.source === 'volume_scan'
      ? reportLangZh
        ? '青色折线：AI 评分（左轴，与榜单扫描「评分历史」同源：成交量榜批次）。'
        : 'Cyan line: AI score (left), same as Market Scanner volume-batch rating history.'
      : scoreLine.source === 'history'
        ? reportLangZh
          ? '青色折线：AI 评分（左轴，本区间无成交量榜记录时已回退为分析历史按日）。'
          : 'Cyan line: AI score (left); fell back to daily analysis history in this range.'
        : null;

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

    const url = `/api/v1/stocks/${encodeURIComponent(code)}/history?period=daily&days=${encodeURIComponent(String(days))}`;

    void (async () => {
      try {
        const res = await apiFetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { data?: HistoryBar[] };
        const raw = Array.isArray(json.data) ? json.data : [];
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
          background: { type: ColorType.Solid, color: '#f8fafc' },
          textColor: '#475569',
        },
        grid: {
          vertLines: { color: '#e2e8f0' },
          horzLines: { color: '#e2e8f0' },
        },
        leftPriceScale: {
          visible: scorePts.length > 0,
          borderColor: '#cbd5e1',
        },
        rightPriceScale: { borderColor: '#cbd5e1' },
        timeScale: { borderColor: '#cbd5e1' },
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
    if (cw < 32) {
      requestAnimationFrame(() => {
        if (chartRef.current && rows.length > 0) {
          const nw = Math.max(el.clientWidth, el.offsetWidth, 280);
          chartRef.current.applyOptions({ width: nw });
          chartRef.current.timeScale().fitContent();
        }
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
      const iw = el.clientWidth;
      if (iw > 0 && chartRef.current) {
        chartRef.current.applyOptions({ width: iw });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const loading = rows === null;
  const empty = !loading && rows.length === 0 && !fetchErr;
  const failed = fetchErr && !loading;
  const showCanvas = !loading && rows.length > 0;
  const chartPixelHeight = showVolumePane ? 320 : 280;

  return (
    <section className="workbench-card-block workbench-detail-section">
      <h3 className="workbench-block-title">{title}</h3>
      <div className="workbench-kline-range" role="group" aria-label={reportLangZh ? 'K 线时间区间' : 'Chart range'}>
        {RANGE_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className={`workbench-kline-range-btn${range === key ? ' is-active' : ''}`}
            disabled={!stockCode.trim()}
            aria-pressed={range === key}
            onClick={() => setRange(key)}
          >
            {rangeLabels[key]}
          </button>
        ))}
      </div>
      {loading ? <p className="workbench-block-text workbench-detail-muted">{loadingText}</p> : null}
      {failed ? <p className="workbench-block-text workbench-detail-empty">{failText}</p> : null}
      {empty ? <p className="workbench-block-text workbench-detail-empty">{emptyText}</p> : null}
      {chartErr && showCanvas ? (
        <p className="workbench-block-text workbench-detail-empty">{chartFailText}</p>
      ) : null}
      <div
        ref={wrapRef}
        className="workbench-kline-chart"
        style={{
          width: '100%',
          height: chartPixelHeight,
          marginTop: showCanvas ? 6 : 0,
          visibility: showCanvas && !chartErr ? 'visible' : 'hidden',
          pointerEvents: showCanvas && !chartErr ? 'auto' : 'none',
        }}
        aria-hidden={!showCanvas || chartErr}
      />
      {volumeCaption ? <p className="workbench-block-text workbench-detail-muted mt-2 text-xs">{volumeCaption}</p> : null}
      {scoreCaption ? <p className="workbench-block-text workbench-detail-muted mt-2 text-xs">{scoreCaption}</p> : null}
    </section>
  );
}
