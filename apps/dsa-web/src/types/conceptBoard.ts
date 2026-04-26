export type ConceptBoardItem = {
  boardCode: string;
  boardName: string;
  stocksCount: number;
  volumeGe75Count?: number;
  buyOrHoldCount?: number;
  updatedAt?: string | null;
};

export type ConceptBoardListResponse = {
  items: ConceptBoardItem[];
};

export type ConceptBoardStockItem = {
  stockCode: string;
  stockName?: string | null;
  sentimentScore?: number | null;
  operationAdvice?: string | null;
  latestScoredAt?: string | null;
  tagIndustry: string[];
  tagConcept: string[];
};

export type ConceptBoardStocksResponse = {
  board: ConceptBoardItem;
  total: number;
  limit: number;
  offset: number;
  items: ConceptBoardStockItem[];
};
