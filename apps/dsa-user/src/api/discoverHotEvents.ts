import { apiFetch } from './http';
import { createApiError, parseApiError } from './error';
import { toCamelCase } from '../utils/camel';
import type { HotEventDetail, HotEventListResponse } from '../types/discoverHotEvent';

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

const BASE = '/api/v1/discover/hot-events';

export const discoverHotEventsApi = {
  async list(params: {
    market?: string;
    status?: string;
    limit?: number;
  } = {}): Promise<HotEventListResponse> {
    const qs = new URLSearchParams();
    if (params.market) qs.set('market', params.market);
    if (params.status !== undefined && params.status !== '') qs.set('status', params.status);
    if (params.limit != null) qs.set('limit', String(params.limit));
    const q = qs.toString();
    const res = await apiFetch(q ? `${BASE}?${q}` : BASE);
    return readJsonOk<HotEventListResponse>(res);
  },

  async getDetail(slug: string): Promise<HotEventDetail> {
    const res = await apiFetch(`${BASE}/${encodeURIComponent(slug)}`);
    return readJsonOk<HotEventDetail>(res);
  },
};
