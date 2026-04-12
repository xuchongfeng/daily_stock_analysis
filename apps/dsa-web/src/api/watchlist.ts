import apiClient from './index';
import { toCamelCase } from './utils';

export type WatchlistApiPayload = {
  codes: string[];
  labels?: Record<string, string>;
};

export type WatchlistApiResponse = {
  codes: string[];
  labels: Record<string, string>;
  updatedAt: string | null;
};

export const watchlistApi = {
  get: async (): Promise<WatchlistApiResponse> => {
    const res = await apiClient.get<Record<string, unknown>>('/api/v1/watchlist');
    return toCamelCase<WatchlistApiResponse>(res.data);
  },

  put: async (body: WatchlistApiPayload): Promise<WatchlistApiResponse> => {
    const res = await apiClient.put<Record<string, unknown>>('/api/v1/watchlist', {
      codes: body.codes,
      labels: body.labels ?? {},
    });
    return toCamelCase<WatchlistApiResponse>(res.data);
  },
};
