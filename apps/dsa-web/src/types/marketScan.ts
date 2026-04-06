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
