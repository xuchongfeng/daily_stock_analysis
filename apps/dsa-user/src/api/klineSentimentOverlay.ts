import type { Time } from 'lightweight-charts';

import { apiFetch } from './http';

export type KlineSentimentOverlaySource = 'volume_scan' | 'history' | 'none';

const HISTORY_PAGE_LIMIT = 100;

function dedupeLinePointsByTime(points: { time: Time; value: number }[]): { time: Time; value: number }[] {
  const m = new Map<string, number>();
  for (const p of points) {
    m.set(String(p.time), p.value);
  }
  return Array.from(m.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, value]) => ({ time: time as Time, value }));
}

async function fetchHistoryOverlayPoints(
  stockCode: string,
  startDate: string,
  endDate: string,
): Promise<{ time: Time; value: number }[]> {
  const latestByDay = new Map<string, number>();
  let page = 1;
  let total = Infinity;

  while ((page - 1) * HISTORY_PAGE_LIMIT < total) {
    const qs = new URLSearchParams({
      stock_code: stockCode,
      start_date: startDate,
      end_date: endDate,
      page: String(page),
      limit: String(HISTORY_PAGE_LIMIT),
    });
    const res = await apiFetch(`/api/v1/history?${qs.toString()}`);
    if (!res.ok) {
      throw new Error(String(res.status));
    }
    const json = (await res.json()) as {
      total?: number;
      items?: Array<{ sentiment_score?: number | null; created_at?: string | null }>;
    };
    total = Number(json.total) || 0;
    const items = json.items || [];
    for (const item of items) {
      const scoreVal = item.sentiment_score;
      if (scoreVal == null || !Number.isFinite(Number(scoreVal))) {
        continue;
      }
      const ymd = String(item.created_at || '').slice(0, 10);
      if (ymd.length < 10) {
        continue;
      }
      if (!latestByDay.has(ymd)) {
        latestByDay.set(ymd, Number(scoreVal));
      }
    }
    if (items.length < HISTORY_PAGE_LIMIT) {
      break;
    }
    page += 1;
    if (page > 40) {
      break;
    }
  }

  return Array.from(latestByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, value]) => ({ time: time as Time, value }));
}

/**
 * 与榜单扫描「评分历史」同源：优先成交量榜 ``volume-rating-series``；无点时回退 ``/api/v1/history``。
 */
export async function fetchKlineSentimentOverlaySeries(
  stockCode: string,
  startDate: string,
  endDate: string,
): Promise<{ points: { time: Time; value: number }[]; source: KlineSentimentOverlaySource }> {
  const code = (stockCode || '').trim();
  const start = (startDate || '').trim();
  const end = (endDate || '').trim();
  if (!code || !start || !end) {
    return { points: [], source: 'none' };
  }

  const volQs = new URLSearchParams();
  volQs.set('start_date', start);
  volQs.set('end_date', end);
  try {
    const res = await apiFetch(
      `/api/v1/market-scanner/stocks/${encodeURIComponent(code)}/volume-rating-series?${volQs.toString()}`,
    );
    if (res.ok) {
      const json = (await res.json()) as {
        points?: Array<{ trade_date?: string; sentiment_score?: number | null }>;
      };
      const raw = (json.points || [])
        .filter((p) => (p.trade_date || '').trim() && Number.isFinite(Number(p.sentiment_score)))
        .map((p) => ({
          time: String(p.trade_date).trim() as Time,
          value: Number(p.sentiment_score),
        }))
        .sort((a, b) => String(a.time).localeCompare(String(b.time)));
      const pts = dedupeLinePointsByTime(raw);
      if (pts.length > 0) {
        return { points: pts, source: 'volume_scan' };
      }
    }
  } catch {
    /* history */
  }

  try {
    const pts = await fetchHistoryOverlayPoints(code, start, end);
    return { points: pts, source: pts.length > 0 ? 'history' : 'none' };
  } catch {
    return { points: [], source: 'none' };
  }
}
