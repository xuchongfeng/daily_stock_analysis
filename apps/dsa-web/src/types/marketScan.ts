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
