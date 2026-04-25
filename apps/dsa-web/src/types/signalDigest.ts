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
};

export type SignalDigestBoardHighlight = {
  name: string;
  count: number;
};

export type SignalDigestResponse = {
  window: SignalDigestWindow;
  picks: SignalDigestPick[];
  boardHighlights: SignalDigestBoardHighlight[];
  /** 窗口内全部符合条件标的的板块共现（不限于 Top-K）；旧缓存可能缺省，前端用 ?? [] */
  boardHighlightsAll?: SignalDigestBoardHighlight[];
  conceptHighlights?: SignalDigestBoardHighlight[];
  conceptHighlightsAll?: SignalDigestBoardHighlight[];
  narrativeMarkdown?: string | null;
  narrativeGenerated: boolean;
  fromCache?: boolean;
  cacheExpiresAt?: string | null;
};
