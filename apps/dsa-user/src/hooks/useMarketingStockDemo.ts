import { useCallback, useEffect, useState } from 'react';

import { marketScannerPublicApi } from '../api/marketScannerPublic';
import { publicDemoAnalysisApi } from '../api/publicDemoAnalysis';
import { workbenchHistoryApi } from '../api/workbenchHistory';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import type { AnalysisReport, HistoryItem } from '../types/workbenchAnalysis';
import type { MarketScanItem } from '../types/marketScanner';

export const MARKETING_STOCK_DEMO_COUNT = 3;

function pickUniqueTopItems(items: MarketScanItem[], max: number): MarketScanItem[] {
  const out: MarketScanItem[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const id = it.id;
    if (typeof id !== 'number' || id <= 0) continue;
    const code = (it.stockCode || '').trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(it);
    if (out.length >= max) break;
  }
  return out;
}

function pickUniqueHistory(items: HistoryItem[], max: number): HistoryItem[] {
  const out: HistoryItem[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const code = (it.stockCode || '').trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(it);
    if (out.length >= max) break;
  }
  return out;
}

async function resolveDemoBatchId(): Promise<string | null> {
  try {
    const vol = await marketScannerPublicApi.listBatches({ limit: 12, scanKind: 'volume' });
    const vhit = (vol.items || []).find((b) => (b.itemCount ?? 0) > 0);
    if (vhit?.batchRunId) return vhit.batchRunId;
  } catch {
    /* fallback below */
  }
  try {
    const all = await marketScannerPublicApi.listBatches({ limit: 12, scanKind: 'all' });
    const hit = (all.items || []).find((b) => (b.itemCount ?? 0) > 0);
    return hit?.batchRunId ?? null;
  } catch {
    return null;
  }
}

async function fetchReportsForIds(
  ids: number[],
  labelFn: (i: number) => string,
): Promise<{ reports: AnalysisReport[]; labels: string[] } | null> {
  if (ids.length === 0) return null;
  const settled = await Promise.allSettled(ids.map((id) => workbenchHistoryApi.getDetail(id)));
  const reports: AnalysisReport[] = [];
  const labels: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      reports.push(r.value);
      labels.push(labelFn(i));
    }
  });
  return reports.length > 0 ? { reports, labels } : null;
}

export type MarketingStockDemoSource = 'public' | 'scanner' | 'history';

export function useMarketingStockDemo() {
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [source, setSource] = useState<MarketingStockDemoSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ParsedApiError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReports([]);
    setLabels([]);
    setSource(null);
    try {
      try {
        const pub = await publicDemoAnalysisApi.getSamples(MARKETING_STOCK_DEMO_COUNT);
        const picked = (pub.items || []).slice(0, MARKETING_STOCK_DEMO_COUNT);
        if (picked.length > 0) {
          setReports(picked);
          setLabels(
            picked.map((r) => {
              const code = (r.meta?.stockCode || '').trim();
              const name = (r.meta?.stockName || '').trim();
              return `${code}${name ? ` · ${name}` : ''}` || '示例';
            }),
          );
          setSource('public');
          return;
        }
      } catch {
        /* 无样本或接口失败时回退榜单 / 历史 */
      }

      const batchId = await resolveDemoBatchId();
      if (batchId) {
        const batchItems = await marketScannerPublicApi.listBatchItems(batchId, {
          sortBy: 'sentiment_score',
          order: 'desc',
          limit: 40,
          page: 1,
        });
        const picked = pickUniqueTopItems(batchItems.items || [], MARKETING_STOCK_DEMO_COUNT);
        if (picked.length > 0) {
          const ids = picked.map((p) => p.id as number);
          const lab = (i: number) =>
            `${picked[i].stockCode}${picked[i].stockName ? ` · ${picked[i].stockName}` : ''}`;
          const result = await fetchReportsForIds(ids, lab);
          if (result) {
            setReports(result.reports);
            setLabels(result.labels);
            setSource('scanner');
            return;
          }
        }
      }

      const hist = await workbenchHistoryApi.getList({ limit: 24, page: 1 });
      const pickedH = pickUniqueHistory(hist.items || [], MARKETING_STOCK_DEMO_COUNT);
      if (pickedH.length === 0) {
        return;
      }
      const ids = pickedH.map((p) => p.id);
      const lab = (i: number) =>
        `${pickedH[i].stockCode}${pickedH[i].stockName ? ` · ${pickedH[i].stockName}` : ''}`;
      const result = await fetchReportsForIds(ids, lab);
      if (result) {
        setReports(result.reports);
        setLabels(result.labels);
        setSource('history');
      }
    } catch (e) {
      setError(getParsedApiError(e));
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return { reports, labels, source, loading, error, reload: load };
}
