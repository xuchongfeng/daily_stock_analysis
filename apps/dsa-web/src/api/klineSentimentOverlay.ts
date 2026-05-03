import type { Time } from 'lightweight-charts';

import { historyApi } from './history';
import { marketScanApi } from './marketScan';

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
    const res = await historyApi.getList({
      stockCode,
      startDate,
      endDate,
      page,
      limit: HISTORY_PAGE_LIMIT,
    });
    total = Number(res.total) || 0;
    const items = res.items || [];
    for (const item of items) {
      const scoreVal = item.sentimentScore;
      if (scoreVal == null || !Number.isFinite(Number(scoreVal))) {
        continue;
      }
      const ymd = String(item.createdAt || '').slice(0, 10);
      if (ymd.length < 10) {
        continue;
      }
      // 列表按 created_at 倒序；同日保留首次出现的快照（与 ScoreHistoryHoverBadge 一致）
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
 * 与榜单扫描「评分历史」同源：优先 ``volume-rating-series``；无点时回退 ``/api/v1/history`` 按日聚合。
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

  try {
    const vol = await marketScanApi.getStockVolumeRatingSeries(code, {
      startDate: start,
      endDate: end,
    });
    const raw = (vol.points || [])
      .filter((p) => p.tradeDate && Number.isFinite(Number(p.sentimentScore)))
      .map((p) => ({
        time: p.tradeDate.trim() as Time,
        value: Number(p.sentimentScore),
      }))
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));
    const pts = dedupeLinePointsByTime(raw);
    if (pts.length > 0) {
      return { points: pts, source: 'volume_scan' };
    }
  } catch {
    /* 降级 history */
  }

  try {
    const pts = await fetchHistoryOverlayPoints(code, start, end);
    return { points: pts, source: pts.length > 0 ? 'history' : 'none' };
  } catch {
    return { points: [], source: 'none' };
  }
}
