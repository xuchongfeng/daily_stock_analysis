import { apiFetch } from './http';

export type WatchlistScorePoint = { ymd: string; score: number };

/** 拉取该股分析历史并聚合为按日评分序列（列表按时间倒序时，同日保留首次＝当日最新一次分析），用于自选评分迷你曲线 */
export async function fetchWatchlistScoreSeries(stockCode: string, limit = 56): Promise<WatchlistScorePoint[]> {
  const code = String(stockCode || '').trim();
  if (!code) return [];
  const qs = new URLSearchParams({
    stock_code: code,
    page: '1',
    limit: String(Math.min(Math.max(1, limit), 100)),
  });
  const res = await apiFetch(`/api/v1/history?${qs.toString()}`);
  if (!res.ok) return [];
  const json = (await res.json()) as {
    items?: Array<{
      sentiment_score?: number | null;
      created_at?: string | null;
      sentimentScore?: number | null;
      createdAt?: string | null;
    }>;
  };
  const latestByDay = new Map<string, number>();
  for (const item of json.items || []) {
    const sc = item.sentiment_score ?? item.sentimentScore;
    if (sc == null || !Number.isFinite(Number(sc))) continue;
    const ymd = String(item.created_at ?? item.createdAt ?? '').slice(0, 10);
    if (ymd.length < 10) continue;
    if (!latestByDay.has(ymd)) {
      latestByDay.set(ymd, Number(sc));
    }
  }
  return Array.from(latestByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ymd, score]) => ({ ymd, score }));
}
