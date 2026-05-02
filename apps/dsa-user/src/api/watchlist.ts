import { createApiError, parseApiError } from './error';
import { apiFetch } from './http';
import { toCamelCase } from '../utils/camel';

export type WatchlistPayload = {
  codes: string[];
  labels?: Record<string, string>;
};

export type WatchlistResponse = {
  codes: string[];
  labels: Record<string, string>;
  updatedAt: string | null;
};

async function readJsonOrThrow(res: Response): Promise<unknown> {
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!res.ok) {
    throw createApiError(
      parseApiError({
        response: {
          status: res.status,
          statusText: res.statusText,
          data,
        },
      }),
      { response: { status: res.status, data } },
    );
  }
  return data;
}

export const watchlistApi = {
  get: async (): Promise<WatchlistResponse> => {
    const res = await apiFetch('/api/v1/watchlist');
    const data = await readJsonOrThrow(res);
    return toCamelCase<WatchlistResponse>(data);
  },

  put: async (body: WatchlistPayload): Promise<WatchlistResponse> => {
    const res = await apiFetch('/api/v1/watchlist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codes: body.codes,
        labels: body.labels ?? {},
      }),
    });
    const data = await readJsonOrThrow(res);
    return toCamelCase<WatchlistResponse>(data);
  },
};
