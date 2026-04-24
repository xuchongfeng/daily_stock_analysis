export type ThsConceptRunItem = {
  runId: string;
  taskId: string;
  catalogUrl: string;
  dryRun: boolean;
  ok: boolean;
  message?: string | null;
  stats: Record<string, unknown>;
  errors: unknown[];
  outputPath?: string | null;
  createdAt?: string | null;
  conceptCount: number;
  constituentCount: number;
};

export type ThsConceptRunListResponse = {
  items: ThsConceptRunItem[];
  total: number;
  page: number;
  limit: number;
};

export type ThsConceptItem = {
  conceptCode: string;
  conceptName?: string | null;
  detailUrl?: string | null;
  crawledAt?: string | null;
};

export type ThsConceptListResponse = {
  items: ThsConceptItem[];
  total: number;
  page: number;
  limit: number;
  runId: string;
};

export type ThsConstituentItem = {
  conceptCode: string;
  stockCode: string;
  stockName?: string | null;
  page: number;
  rowIndex: number;
  crawledAt?: string | null;
};

export type ThsConstituentListResponse = {
  items: ThsConstituentItem[];
  total: number;
  page: number;
  limit: number;
  runId: string;
  conceptCode?: string | null;
};

export type ThsVolumeBatchSectorStatItem = {
  conceptCode: string;
  conceptName?: string | null;
  stocksInBatch: number;
  avgSentimentScore?: number | null;
  avgChangePct?: number | null;
  bestRankInBatch?: number | null;
  avgRefTradeVolume?: number | null;
};

export type ThsVolumeBatchSectorStatsResponse = {
  runId: string;
  batchRunId: string;
  batchStockCount: number;
  items: ThsVolumeBatchSectorStatItem[];
};
