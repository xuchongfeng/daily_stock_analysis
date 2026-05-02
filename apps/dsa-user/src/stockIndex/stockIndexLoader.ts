import type { StockIndexData, StockIndexItem, StockIndexTuple } from './types';
import { INDEX_FIELD } from './stockIndexFields';

export interface IndexLoadResult {
  data: StockIndexItem[];
  loaded: boolean;
  error?: Error;
  fallback: boolean;
}

export async function loadStockIndex(): Promise<IndexLoadResult> {
  try {
    const response = await fetch(`/stocks.index.json?_t=${Math.floor(Date.now() / 3600000)}`);

    if (!response.ok) {
      throw new Error(`Failed to load index: ${response.status} ${response.statusText}`);
    }

    const data: StockIndexData = await response.json();

    const items = isCompressedFormat(data)
      ? unpackTuples(data as StockIndexTuple[])
      : (data as StockIndexItem[]);

    return {
      data: items,
      loaded: true,
      fallback: false,
    };
  } catch (error) {
    console.error('[StockIndexLoader] Failed to load stock index:', error);
    return {
      data: [],
      loaded: false,
      error: error as Error,
      fallback: true,
    };
  }
}

function isCompressedFormat(data: StockIndexData): data is StockIndexTuple[] {
  if (!Array.isArray(data) || data.length === 0) return false;
  const firstItem = data[0];
  return Array.isArray(firstItem) && typeof firstItem[0] === 'string';
}

function unpackTuples(tuples: StockIndexTuple[]): StockIndexItem[] {
  return tuples.map((tuple) => ({
    canonicalCode: tuple[INDEX_FIELD.CANONICAL_CODE],
    displayCode: tuple[INDEX_FIELD.DISPLAY_CODE],
    nameZh: tuple[INDEX_FIELD.NAME_ZH],
    pinyinFull: tuple[INDEX_FIELD.PINYIN_FULL],
    pinyinAbbr: tuple[INDEX_FIELD.PINYIN_ABBR],
    aliases: tuple[INDEX_FIELD.ALIASES],
    market: tuple[INDEX_FIELD.MARKET],
    assetType: tuple[INDEX_FIELD.ASSET_TYPE],
    active: tuple[INDEX_FIELD.ACTIVE],
    popularity: tuple[INDEX_FIELD.POPULARITY],
  }));
}
