/**
 * Stock index types for workbench autocomplete (aligned with dsa-web).
 */

export type Market = 'CN' | 'HK' | 'US' | 'INDEX' | 'ETF' | 'BSE';
export type AssetType = 'stock' | 'index' | 'etf';

export interface StockIndexItem {
  canonicalCode: string;
  displayCode: string;
  nameZh: string;
  nameEn?: string;
  pinyinFull?: string;
  pinyinAbbr?: string;
  aliases?: string[];
  market: Market;
  assetType: AssetType;
  active: boolean;
  popularity?: number;
}

export interface StockSuggestion {
  canonicalCode: string;
  displayCode: string;
  nameZh: string;
  market: Market;
  matchType: 'exact' | 'prefix' | 'contains' | 'fuzzy';
  matchField: 'code' | 'name' | 'pinyin' | 'alias';
  score: number;
}

export type StockIndexTuple = [
  string,
  string,
  string,
  string | undefined,
  string | undefined,
  string[],
  Market,
  AssetType,
  boolean,
  number | undefined,
];

export type StockIndexData = StockIndexItem[] | StockIndexTuple[];
