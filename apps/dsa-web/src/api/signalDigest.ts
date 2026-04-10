import apiClient from './index';
import { toCamelCase } from './utils';
import type { SignalDigestResponse } from '../types/signalDigest';

const BASE = '/api/v1/insights/signal-digest';

export type SignalDigestQuery = {
  tradingSessions?: number;
  topK?: number;
  market?: 'cn' | 'hk' | 'us' | 'all';
  excludeBatch?: boolean;
  batchOnly?: boolean;
  adviceFilter?: 'any' | 'buy_or_hold';
  withNarrative?: boolean;
  useCache?: boolean;
  refresh?: boolean;
};

export const signalDigestApi = {
  get: async (params: SignalDigestQuery = {}): Promise<SignalDigestResponse> => {
    const {
      tradingSessions = 14,
      topK = 10,
      market = 'cn',
      excludeBatch = false,
      batchOnly = true,
      adviceFilter = 'buy_or_hold',
      withNarrative = true,
      useCache = true,
      refresh = false,
    } = params;
    const response = await apiClient.get<Record<string, unknown>>(BASE, {
      params: {
        trading_sessions: tradingSessions,
        top_k: topK,
        market,
        exclude_batch: excludeBatch,
        batch_only: batchOnly,
        advice_filter: adviceFilter,
        with_narrative: withNarrative,
        use_cache: useCache,
        refresh,
      },
    });
    return toCamelCase<SignalDigestResponse>(response.data);
  },
};
