import { apiFetch } from './http';

export type LatestAnalysisSummaryItem = {
  stock_code: string;
  sentiment_score: number | null;
  sentiment_label: string | null;
  operation_advice: string | null;
  concept_tags: string[];
  analyzed_at: string | null;
};

export type LatestAnalysisSummariesResponse = {
  items: Record<string, LatestAnalysisSummaryItem>;
};

export async function fetchLatestSummariesForCodes(codes: string[]): Promise<LatestAnalysisSummariesResponse> {
  if (!codes.length) return { items: {} };
  const qs = new URLSearchParams();
  codes.forEach((c) => {
    const s = String(c ?? '').trim();
    if (s) qs.append('codes', s);
  });
  const path = `/api/v1/history/latest-summaries${qs.size ? `?${qs}` : ''}`;
  const res = await apiFetch(path);
  if (!res.ok) throw new Error((await res.text()) || `${res.status}`);
  return res.json();
}

/** 后端 `items` 的键为标准化大写代码 */
export function pickLatestSummary(
  items: Record<string, LatestAnalysisSummaryItem>,
  code: string,
): LatestAnalysisSummaryItem | undefined {
  const k = String(code ?? '').trim().toUpperCase();
  return items[k];
}
