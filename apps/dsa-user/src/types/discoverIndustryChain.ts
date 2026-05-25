export type IndustryChainStock = {
  stockCode: string;
  stockName?: string | null;
  role?: string | null;
  sortOrder?: number;
};

export type IndustryChainSummary = {
  slug: string;
  name: string;
  introduction?: string;
  latestNews?: string;
  market?: string;
  status?: string;
  sortOrder?: number;
  coreStockCount?: number;
  updatedAt?: string | null;
};

export type IndustryChainDetail = IndustryChainSummary & {
  coreStocks?: IndustryChainStock[];
  createdAt?: string | null;
};

export type IndustryChainListResponse = {
  items: IndustryChainSummary[];
};

export type IndustryChainUpsertPayload = {
  name: string;
  slug?: string;
  introduction?: string;
  latestNews?: string;
  coreStocks?: IndustryChainStock[];
  market?: string;
  status?: string;
  sortOrder?: number;
};

export type ParseImportItem = {
  code?: string | null;
  name?: string | null;
  confidence?: string;
};

export type ParseImportResponse = {
  codes?: string[];
  items?: ParseImportItem[];
};
