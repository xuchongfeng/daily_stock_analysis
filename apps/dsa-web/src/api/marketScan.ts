import apiClient from './index';
import { toCamelCase } from './utils';
import type {
  MarketScanBatchItemsResponse,
  MarketScanBatchListResponse,
  MarketScanItem,
  MarketScanKindFilter,
} from '../types/marketScan';

const BASE = '/api/v1/market-scanner';

export const marketScanApi = {
  listBatches: async (
    limit = 30,
    batchDate?: string | null,
    scanKind: MarketScanKindFilter = 'all'
  ): Promise<MarketScanBatchListResponse> => {
    const params: Record<string, string | number> = { limit, scan_kind: scanKind };
    if (batchDate && batchDate.trim()) {
      params.batch_date = batchDate.trim();
    }
    const response = await apiClient.get<Record<string, unknown>>(`${BASE}/batches`, { params });
    return toCamelCase<MarketScanBatchListResponse>(response.data);
  },

  listBatchItems: async (params: {
    batchRunId: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<MarketScanBatchItemsResponse> => {
    const { batchRunId, sortBy = 'sentiment_score', order = 'desc', page = 1, limit = 50 } = params;
    const response = await apiClient.get<Record<string, unknown>>(
      `${BASE}/batches/${encodeURIComponent(batchRunId)}/items`,
      { params: { sort_by: sortBy, order, page, limit } }
    );
    const data = toCamelCase<MarketScanBatchItemsResponse>(response.data);
    return {
      ...data,
      items: (data.items || []).map((item) => toCamelCase<MarketScanItem>(item)),
    };
  },
};
