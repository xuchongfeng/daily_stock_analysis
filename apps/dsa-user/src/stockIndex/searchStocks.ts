import type { StockIndexItem, StockSuggestion } from './types';
import { normalizeQuery } from './normalizeQuery';
import { MATCH_SCORE, SEARCH_CONFIG } from './stockIndexFields';

export interface SearchOptions {
  limit?: number;
  activeOnly?: boolean;
}

export function searchStocks(
  query: string,
  index: StockIndexItem[],
  options: SearchOptions = {},
): StockSuggestion[] {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return [];
  }
  const limit = options.limit || SEARCH_CONFIG.DEFAULT_LIMIT;
  const activeOnly = options.activeOnly !== false;

  const filteredIndex = index.filter((item) => {
    if (activeOnly && !item.active) return false;
    return true;
  });

  const suggestions = filteredIndex.map((item) => ({
    item,
    score: calculateMatchScore(normalizedQuery, item),
  }));

  const matched = suggestions.filter((s) => s.score > 0);

  matched.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return (b.item.popularity || 0) - (a.item.popularity || 0);
  });

  return matched.slice(0, limit).map((s) => ({
    canonicalCode: s.item.canonicalCode,
    displayCode: s.item.displayCode,
    nameZh: s.item.nameZh,
    market: s.item.market,
    matchType: determineMatchType(s.score),
    matchField: determineMatchField(normalizedQuery, s.item),
    score: s.score,
  }));
}

function calculateMatchScore(query: string, item: StockIndexItem): number {
  let score = 0;
  const q = query.toLowerCase();
  const normalizedCanonicalCode = normalizeQuery(item.canonicalCode);
  const normalizedDisplayCode = normalizeQuery(item.displayCode);
  const normalizedName = normalizeQuery(item.nameZh);
  const normalizedPinyinFull = normalizeQuery(item.pinyinFull || '');
  const normalizedPinyinAbbr = normalizeQuery(item.pinyinAbbr || '');
  const normalizedAliases = item.aliases?.map((alias) => normalizeQuery(alias)) || [];

  if (q === normalizedCanonicalCode) return 100;
  if (q === normalizedDisplayCode) return 99;
  if (q === normalizedName) return 98;
  if (normalizedAliases.some((a) => a === q)) return 97;
  if (q === normalizedPinyinAbbr) return 96;

  if (normalizedDisplayCode.startsWith(q)) score = Math.max(score, 80);
  if (normalizedName.startsWith(q)) score = Math.max(score, 79);
  if (normalizedPinyinAbbr.startsWith(q)) score = Math.max(score, 78);
  if (normalizedAliases.some((a) => a.startsWith(q))) score = Math.max(score, 77);

  if (normalizedDisplayCode.includes(q)) score = Math.max(score, 60);
  if (normalizedName.includes(q)) score = Math.max(score, 59);
  if (normalizedPinyinFull.includes(q)) score = Math.max(score, 58);
  if (normalizedAliases.some((a) => a.includes(q))) score = Math.max(score, 57);

  return score;
}

function determineMatchType(score: number): 'exact' | 'prefix' | 'contains' | 'fuzzy' {
  if (score >= MATCH_SCORE.EXACT_MIN) return 'exact';
  if (score >= MATCH_SCORE.PREFIX_MIN) return 'prefix';
  if (score >= MATCH_SCORE.CONTAINS_MIN) return 'contains';
  return 'fuzzy';
}

function determineMatchField(query: string, item: StockIndexItem): 'code' | 'name' | 'pinyin' | 'alias' {
  const q = query.toLowerCase();
  const normalizedCanonicalCode = normalizeQuery(item.canonicalCode);
  const normalizedDisplayCode = normalizeQuery(item.displayCode);
  const normalizedName = normalizeQuery(item.nameZh);
  const normalizedPinyinFull = normalizeQuery(item.pinyinFull || '');
  const normalizedPinyinAbbr = normalizeQuery(item.pinyinAbbr || '');
  const normalizedAliases = item.aliases?.map((alias) => normalizeQuery(alias)) || [];

  if (normalizedCanonicalCode.includes(q) || normalizedDisplayCode.includes(q)) {
    return 'code';
  }
  if (normalizedName.includes(q)) return 'name';
  if (normalizedPinyinFull.includes(q) || normalizedPinyinAbbr.includes(q)) {
    return 'pinyin';
  }
  if (normalizedAliases.some((a) => a.includes(q))) return 'alias';
  return 'name';
}
