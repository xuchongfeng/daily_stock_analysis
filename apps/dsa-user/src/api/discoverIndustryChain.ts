import { apiFetch } from './http';
import { createApiError, parseApiError } from './error';
import { toCamelCase } from '../utils/camel';
import type {
  IndustryChainDetail,
  IndustryChainListResponse,
  IndustryChainSummary,
  IndustryChainUpsertPayload,
  ParseImportResponse,
} from '../types/discoverIndustryChain';

function throwHttpError(res: Response, raw: unknown): never {
  const bogus = Object.assign(new Error('request failed'), {
    response: { status: res.status, data: raw },
  });
  throw createApiError(parseApiError(bogus));
}

async function readJsonOk<T>(res: Response): Promise<T> {
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) throwHttpError(res, raw);
  return toCamelCase<T>(raw);
}

const BASE = '/api/v1/discover/industry-chains';

function toSnakePayload(body: IndustryChainUpsertPayload): Record<string, unknown> {
  return {
    name: body.name,
    slug: body.slug || undefined,
    introduction: body.introduction ?? '',
    latest_news: body.latestNews ?? '',
    core_stocks: (body.coreStocks ?? []).map((s, idx) => ({
      stock_code: s.stockCode,
      stock_name: s.stockName ?? undefined,
      role: s.role ?? undefined,
      sort_order: s.sortOrder ?? idx,
    })),
    market: body.market ?? 'cn',
    status: body.status ?? 'active',
    sort_order: body.sortOrder ?? 0,
  };
}

export const discoverIndustryChainApi = {
  async list(params: { market?: string; status?: string; limit?: number } = {}): Promise<IndustryChainListResponse> {
    const qs = new URLSearchParams();
    if (params.market) qs.set('market', params.market);
    if (params.status !== undefined && params.status !== '') qs.set('status', params.status);
    if (params.limit != null) qs.set('limit', String(params.limit));
    const q = qs.toString();
    const res = await apiFetch(q ? `${BASE}?${q}` : BASE);
    return readJsonOk<IndustryChainListResponse>(res);
  },

  async getDetail(slug: string): Promise<IndustryChainDetail> {
    const res = await apiFetch(`${BASE}/${encodeURIComponent(slug)}`);
    return readJsonOk<IndustryChainDetail>(res);
  },

  async create(body: IndustryChainUpsertPayload): Promise<{ item: IndustryChainSummary }> {
    const res = await apiFetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSnakePayload(body)),
    });
    return readJsonOk<{ item: IndustryChainSummary }>(res);
  },

  async update(slug: string, body: IndustryChainUpsertPayload): Promise<{ item: IndustryChainSummary }> {
    const res = await apiFetch(`${BASE}/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSnakePayload(body)),
    });
    return readJsonOk<{ item: IndustryChainSummary }>(res);
  },

  async remove(slug: string): Promise<{ deleted: boolean; slug: string }> {
    const res = await apiFetch(`${BASE}/${encodeURIComponent(slug)}`, { method: 'DELETE' });
    return readJsonOk<{ deleted: boolean; slug: string }>(res);
  },
};

export const stocksImportApi = {
  async parseText(text: string): Promise<ParseImportResponse> {
    const res = await apiFetch('/api/v1/stocks/parse-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return readJsonOk<ParseImportResponse>(res);
  },

  async parseFile(file: File): Promise<ParseImportResponse> {
    const form = new FormData();
    form.append('file', file);
    const res = await apiFetch('/api/v1/stocks/parse-import', {
      method: 'POST',
      body: form,
    });
    return readJsonOk<ParseImportResponse>(res);
  },
};
