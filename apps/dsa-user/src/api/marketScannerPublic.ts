import { apiFetch } from './http';
import { createApiError, parseApiError } from './error';
import { toCamelCase } from '../utils/camel';
import type {
  MarketScanBatchItemsResponse,
  MarketScanBatchListResponse,
} from '../types/marketScanner';

function throwHttpError(res: Response, raw: unknown): never {
  const bogus = Object.assign(new Error('request failed'), {
    response: { status: res.status, data: raw },
  });
  throw createApiError(parseApiError(bogus));
}

async function readJsonOk<T>(res: Response): Promise<T> {
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) throwHttpError(res, raw);
  return toCamelCase<T>(raw);
}

const BASE = '/api/v1/market-scanner';

export const marketScannerPublicApi = {
  async listBatches(params: {
    limit?: number;
    scanKind?: 'all' | 'gainers' | 'volume';
    batchDate?: string;
  } = {}): Promise<MarketScanBatchListResponse> {
    const qs = new URLSearchParams();
    qs.set('limit', String(params.limit ?? 15));
    qs.set('scan_kind', params.scanKind ?? 'volume');
    if (params.batchDate) qs.set('batch_date', params.batchDate);
    const res = await apiFetch(`${BASE}/batches?${qs}`);
    return readJsonOk<MarketScanBatchListResponse>(res);
  },

  async listBatchItems(
    batchRunId: string,
    params: {
      sortBy?: string;
      order?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    } = {},
  ): Promise<MarketScanBatchItemsResponse> {
    const qs = new URLSearchParams();
    qs.set('sort_by', params.sortBy ?? 'sentiment_score');
    qs.set('order', params.order ?? 'desc');
    qs.set('page', String(params.page ?? 1));
    qs.set('limit', String(params.limit ?? 30));
    const res = await apiFetch(
      `${BASE}/batches/${encodeURIComponent(batchRunId)}/items?${qs}`,
    );
    return readJsonOk<MarketScanBatchItemsResponse>(res);
  },
};
