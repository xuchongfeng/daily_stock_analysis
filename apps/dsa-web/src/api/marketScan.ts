import apiClient from './index';
import { toCamelCase } from './utils';
import type {
  MarketScanBatchItemsResponse,
  MarketScanBatchListResponse,
  MarketScanItem,
  MarketScanKindFilter,
  MarketScanNotifyRequestBody,
  MarketScanNotifyResponse,
  MarketScanResumeResponse,
  VolumeScanDailyGeScoreSeriesResponse,
  VolumeScanStockRatingSeriesResponse,
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

  resumeBatch: async (
    batchRunId: string,
    options?: { dryRun?: boolean; sendNotification?: boolean }
  ): Promise<MarketScanResumeResponse> => {
    const { dryRun = false, sendNotification = true } = options || {};
    const response = await apiClient.post<Record<string, unknown>>(
      `${BASE}/batches/${encodeURIComponent(batchRunId)}/resume`,
      undefined,
      { params: { dry_run: dryRun, send_notification: sendNotification } }
    );
    return toCamelCase<MarketScanResumeResponse>(response.data);
  },

  notifyBatch: async (
    batchRunId: string,
    body: MarketScanNotifyRequestBody
  ): Promise<MarketScanNotifyResponse> => {
    const response = await apiClient.post<Record<string, unknown>>(
      `${BASE}/batches/${encodeURIComponent(batchRunId)}/notify`,
      {
        top_n: body.topN,
        detail_level: body.detailLevel,
      }
    );
    return toCamelCase<MarketScanNotifyResponse>(response.data);
  },

  getVolumeRatingThresholdDaily: async (params?: {
    minScore?: number;
    startDate?: string | null;
    endDate?: string | null;
  }): Promise<VolumeScanDailyGeScoreSeriesResponse> => {
    const q: Record<string, string | number> = {};
    if (params?.minScore != null) q.min_score = params.minScore;
    if (params?.startDate?.trim()) q.start_date = params.startDate.trim();
    if (params?.endDate?.trim()) q.end_date = params.endDate.trim();
    const response = await apiClient.get<Record<string, unknown>>(`${BASE}/stats/volume-rating-threshold-daily`, {
      params: q,
    });
    const data = toCamelCase<VolumeScanDailyGeScoreSeriesResponse>(response.data);
    return { points: data.points || [] };
  },

  getStockVolumeRatingSeries: async (
    stockCode: string,
    params?: { startDate?: string | null; endDate?: string | null }
  ): Promise<VolumeScanStockRatingSeriesResponse> => {
    const q: Record<string, string> = {};
    if (params?.startDate?.trim()) q.start_date = params.startDate.trim();
    if (params?.endDate?.trim()) q.end_date = params.endDate.trim();
    const response = await apiClient.get<Record<string, unknown>>(
      `${BASE}/stocks/${encodeURIComponent(stockCode.trim())}/volume-rating-series`,
      { params: q }
    );
    return toCamelCase<VolumeScanStockRatingSeriesResponse>(response.data);
  },
};
