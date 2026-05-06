import { apiFetch } from './http';
import { createApiError, parseApiError } from './error';
import { toCamelCase } from '../utils/camel';
import type { ConceptBoardListResponse, ConceptBoardStocksResponse } from '../types/conceptBoard';

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

const BASE = '/api/v1/concept-boards';

export const conceptBoardsApi = {
  async listBoards(limit = 300): Promise<ConceptBoardListResponse> {
    const qs = new URLSearchParams({ limit: String(limit) });
    const res = await apiFetch(`${BASE}?${qs}`);
    return readJsonOk<ConceptBoardListResponse>(res);
  },

  async listBoardStocks(
    boardCode: string,
    params: { limit?: number; offset?: number } = {},
  ): Promise<ConceptBoardStocksResponse> {
    const { limit = 500, offset = 0 } = params;
    const qs = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    const res = await apiFetch(`${BASE}/${encodeURIComponent(boardCode)}/stocks?${qs}`);
    return readJsonOk<ConceptBoardStocksResponse>(res);
  },
};
