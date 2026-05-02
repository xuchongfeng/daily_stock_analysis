import { createApiError, parseApiError } from './error';
import { apiFetch } from './http';
import { toCamelCase } from '../utils/camel';
import type {
  SignalDigestResponse,
  SignalDigestSnapshotDatesResponse,
  SignalDigestTaskAcceptedResponse,
  SignalDigestTaskStatusResponse,
} from '../types/signalDigest';

const BASE = '/api/v1/insights/signal-digest';
const POLL_INTERVAL_MS = 1200;
const MAX_POLL_ROUNDS = 180;

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
  wait?: boolean;
};

type CoreFilters = Pick<
  SignalDigestQuery,
  'tradingSessions' | 'topK' | 'market' | 'excludeBatch' | 'batchOnly' | 'adviceFilter'
>;

async function fetchJsonParsed(pathWithQuery: string, init?: Parameters<typeof fetch>[1]): Promise<unknown> {
  const response = await apiFetch(pathWithQuery, init);
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    /* empty */
  }
  if (!response.ok) {
    throw createApiError(
      parseApiError({
        response: {
          status: response.status,
          statusText: response.statusText,
          data,
        },
      }),
      {
        response: {
          status: response.status,
          statusText: response.statusText,
          data,
        },
      },
    );
  }
  return data;
}

function appendCoreFilters(qs: URLSearchParams, p: CoreFilters & Record<string, unknown> = {}) {
  const tradingSessions = p.tradingSessions ?? 14;
  const topK = p.topK ?? 100;
  const market = p.market ?? 'cn';
  const excludeBatch = p.excludeBatch ?? false;
  const batchOnly = p.batchOnly ?? true;
  const adviceFilter = p.adviceFilter ?? 'buy_or_hold';
  qs.set('trading_sessions', String(tradingSessions));
  qs.set('top_k', String(topK));
  qs.set('market', market);
  qs.set('exclude_batch', excludeBatch ? 'true' : 'false');
  qs.set('batch_only', batchOnly ? 'true' : 'false');
  qs.set('advice_filter', adviceFilter);
}

export const signalDigestApi = {
  get: async (params: SignalDigestQuery = {}): Promise<SignalDigestResponse> => {
    const qs = new URLSearchParams();
    appendCoreFilters(qs, params);
    qs.set('with_narrative', params.withNarrative !== false ? 'true' : 'false');
    qs.set('use_cache', params.useCache !== false ? 'true' : 'false');
    qs.set('refresh', params.refresh === true ? 'true' : 'false');
    qs.set('wait', params.wait === true ? 'true' : 'false');

    const raw = await fetchJsonParsed(`${BASE}?${qs}`);
    const first = toCamelCase<SignalDigestResponse & SignalDigestTaskAcceptedResponse>(raw);
    if (typeof first.taskId !== 'string' || !first.taskId) {
      return first as SignalDigestResponse;
    }

    for (let i = 0; i < MAX_POLL_ROUNDS; i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
      const taskRaw = await fetchJsonParsed(`${BASE}/tasks/${encodeURIComponent(first.taskId)}`);
      const task = toCamelCase<SignalDigestTaskStatusResponse>(taskRaw);
      if (task.status === 'succeeded' && task.result) {
        return task.result;
      }
      if (task.status === 'failed') {
        throw new Error(task.error || 'signal_digest_task_failed');
      }
    }
    throw new Error('signal_digest_task_timeout');
  },

  getSnapshot: async (
    snapshotDate: string,
    params: Omit<SignalDigestQuery, 'refresh' | 'useCache' | 'withNarrative'> = {},
  ): Promise<SignalDigestResponse> => {
    const qs = new URLSearchParams();
    qs.set('snapshot_date', snapshotDate);
    appendCoreFilters(qs, params);
    const raw = await fetchJsonParsed(`${BASE}/snapshots?${qs}`);
    return toCamelCase<SignalDigestResponse>(raw);
  },

  listSnapshotDates: async (
    params: Omit<SignalDigestQuery, 'refresh' | 'useCache' | 'withNarrative'> = {},
  ): Promise<SignalDigestSnapshotDatesResponse> => {
    const qs = new URLSearchParams();
    appendCoreFilters(qs, params);
    const raw = await fetchJsonParsed(`${BASE}/snapshot-dates?${qs}`);
    return toCamelCase<SignalDigestSnapshotDatesResponse>(raw);
  },
};
