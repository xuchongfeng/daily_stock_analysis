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
  /** 窗口内全部符合条件标的的板块共现（不限于 Top-K）；旧缓存可能缺省，前端用 ?? [] */
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

export type PortfolioSelectionStrategy = {
  strategyId: string;
  name: string;
  description: string;
  topBoardCount: number;
  perBoardCandidate: number;
  targetCount: number;
  minPerBoard: number;
  highScoreThreshold: number;
  shrinkK: number;
};

export type PortfolioSelectionBoardStat = {
  name: string;
  boardStrength: number;
  stockCount: number;
  highScoreCount: number;
  highScoreRatioAdj: number;
  candidateCount: number;
  quota: number;
};

export type PortfolioSelectionPick = SignalDigestPick & {
  boardName: string;
  selectedReason: '板块保底' | '全局补位' | '候选外补位' | string;
};

export type PortfolioSelectionResponse = {
  window: SignalDigestWindow;
  strategy: PortfolioSelectionStrategy;
  strategyOptions: PortfolioSelectionStrategy[];
  boards: PortfolioSelectionBoardStat[];
  selected: PortfolioSelectionPick[];
  backtestOverview: {
    evalWindowDays: number;
    signalDate?: string;
    selectedCount: number;
    coveredCount: number;
    avgWinRatePct?: number | null;
    avgDirectionAccuracyPct?: number | null;
    avgSimulatedReturnPct?: number | null;
  };
  backtestByStock: Array<{
    code: string;
    hasData: boolean;
    totalEvaluations?: number;
    completedCount?: number;
    winRatePct?: number | null;
    directionAccuracyPct?: number | null;
    avgSimulatedReturnPct?: number | null;
  }>;
};
