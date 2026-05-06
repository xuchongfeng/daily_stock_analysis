/** 与 /api/v1/discover/hot-events 响应对齐 */

export type HotEventBoardRef = {
  boardCode: string;
  boardName?: string | null;
  stocksCount?: number | null;
};

export type HotEventSummary = {
  slug: string;
  title: string;
  summary?: string;
  market?: string;
  status?: string;
  heatScore?: number;
  boardCodes?: string[];
  startedAt?: string | null;
  updatedAt?: string | null;
};

export type HotEventListResponse = {
  items: HotEventSummary[];
};

export type HotEventTimelineItem = {
  occurredOn?: string | null;
  sortOrder?: number;
  headline: string;
  body?: string;
  linkUrl?: string | null;
  kind?: string;
};

export type HotEventAnchorStock = {
  stockCode: string;
  stockName?: string | null;
  role?: string | null;
};

export type HotEventCoreMetric = {
  label: string;
  value?: string;
  hint?: string | null;
};

export type HotEventDetail = HotEventSummary & {
  boards?: HotEventBoardRef[];
  anchorStocks?: HotEventAnchorStock[];
  coreMetrics?: HotEventCoreMetric[];
  timeline?: HotEventTimelineItem[];
  sourceNote?: string | null;
};
