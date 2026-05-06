/** 与 /api/v1/market-scanner 列表类响应对齐 */

export type MarketScanBatchSummary = {
  batchRunId: string;
  scanKind: string;
  itemCount: number;
  lastCreatedAt?: string | null;
};

export type MarketScanBatchListResponse = {
  items: MarketScanBatchSummary[];
};

export type MarketScanItem = {
  id?: number | null;
  queryId?: string;
  stockCode: string;
  stockName?: string | null;
  reportType?: string | null;
  sentimentScore?: number | null;
  operationAdvice?: string | null;
  conceptTags?: string[];
  rankInBatch?: number | null;
  refChangePct?: number | null;
  createdAt?: string | null;
};

export type MarketScanBatchItemsResponse = {
  total: number;
  page: number;
  limit: number;
  sortBy: string;
  order: string;
  items: MarketScanItem[];
};
