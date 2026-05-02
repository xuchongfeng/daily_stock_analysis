export type SignalDigestBoardRef = {
  name: string;
  code?: string | null;
  type?: string | null;
};

export type SignalDigestWindow = {
  tradingSessions: number;
  anchorDate: string;
  oldestDate: string;
  rowsConsidered: number;
  rowsAfterAdviceFilter?: number;
  distinctStocks: number;
  marketFilter: string;
  excludeBatch: boolean;
  batchOnly?: boolean;
  adviceFilter?: string;
};

export type SignalDigestPick = {
  code: string;
  name?: string | null;
  score: number;
  appearanceCount: number;
  latestCreatedAt?: string | null;
  sentimentScore?: number | null;
  operationAdvice?: string | null;
  trendPrediction?: string | null;
  analysisSummaryExcerpt?: string | null;
  boards: SignalDigestBoardRef[];
  conceptTags?: string[];
};

export type SignalDigestBoardHighlight = {
  name: string;
  count: number;
};

export type SignalDigestResponse = {
  window: SignalDigestWindow;
  picks: SignalDigestPick[];
  boardHighlights: SignalDigestBoardHighlight[];
  boardHighlightsAll?: SignalDigestBoardHighlight[];
  conceptHighlights?: SignalDigestBoardHighlight[];
  conceptHighlightsAll?: SignalDigestBoardHighlight[];
  narrativeMarkdown?: string | null;
  narrativeGenerated: boolean;
  fromCache?: boolean;
  cacheExpiresAt?: string | null;
};

export type SignalDigestSnapshotDatesResponse = {
  items: string[];
};

export type SignalDigestTaskAcceptedResponse = {
  taskId: string;
  status: 'queued' | 'running';
  submittedAt: string;
  message?: string;
};

export type SignalDigestTaskStatusResponse = {
  taskId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  submittedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  error?: string | null;
  result?: SignalDigestResponse | null;
};
