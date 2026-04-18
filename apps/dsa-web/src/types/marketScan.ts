export type MarketScanKindFilter = 'all' | 'gainers' | 'volume';

export interface MarketScanBatchSummary {
  batchRunId: string;
  scanKind: 'gainers' | 'volume';
  itemCount: number;
  lastCreatedAt?: string | null;
}

export interface MarketScanBatchListResponse {
  items: MarketScanBatchSummary[];
}

export interface MarketScanItem {
  id?: number | null;
  queryId: string;
  stockCode: string;
  stockName?: string | null;
  reportType?: string | null;
  sentimentScore?: number | null;
  operationAdvice?: string | null;
  rankInBatch?: number | null;
  refChangePct?: number | null;
  refTradeVolume?: number | null;
  createdAt?: string | null;
}

export interface MarketScanBatchItemsResponse {
  total: number;
  page: number;
  limit: number;
  sortBy: string;
  order: string;
  items: MarketScanItem[];
}

/** POST /batches/{batch_run_id}/resume 响应（续跑未完成的榜单分析） */
export interface MarketScanResumeResponse {
  skipped: boolean;
  reason?: string | null;
  detail?: string | null;
  batchRunId: string;
  scanKind?: string | null;
  tradeDate?: string | null;
  universeSize: number;
  alreadyCompletedBefore: number;
  pendingResume: number;
  resumeAttempted: number;
  successCount: number;
  failureCount: number;
  notificationSent: boolean;
}

export type MarketScanNotifyDetailLevel = 'summary' | 'detailed';

export interface MarketScanNotifyRequestBody {
  topN: number;
  detailLevel: MarketScanNotifyDetailLevel;
}

/** POST /batches/{batch_run_id}/notify 响应 */
export interface MarketScanNotifyResponse {
  skipped: boolean;
  reason?: string | null;
  detail?: string | null;
  batchRunId: string;
  scanKind?: string | null;
  itemsIncluded: number;
  totalInBatch: number;
  notificationSent: boolean;
  detailLevel?: string | null;
  topNRequested: number;
}

export interface VolumeScanDailyGeScorePoint {
  tradeDate: string;
  stockCount: number;
  minScore: number;
}

export interface VolumeScanDailyGeScoreSeriesResponse {
  points: VolumeScanDailyGeScorePoint[];
}

export interface VolumeScanStockRatingPoint {
  /** analysis_history 主键，用于打开报告抽屉 */
  id?: number | null;
  tradeDate: string;
  sentimentScore: number;
  batchRunId: string;
  rankInBatch?: number | null;
  stockName?: string | null;
  createdAt?: string | null;
}

export interface VolumeScanStockRatingSeriesResponse {
  stockCode: string;
  points: VolumeScanStockRatingPoint[];
}
