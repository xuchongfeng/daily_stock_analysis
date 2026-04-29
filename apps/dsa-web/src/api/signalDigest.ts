import apiClient from './index';
import { toCamelCase } from './utils';
import type {
  PortfolioSelectionResponse,
  SignalDigestResponse,
  SignalDigestSnapshotDatesResponse,
  SignalDigestTaskAcceptedResponse,
  SignalDigestTaskStatusResponse,
} from '../types/signalDigest';

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
  wait?: boolean;
};

const POLL_INTERVAL_MS = 1200;
const MAX_POLL_ROUNDS = 180;

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
      wait = false,
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
        wait,
      },
    });
    const first = toCamelCase<SignalDigestResponse & SignalDigestTaskAcceptedResponse>(response.data);
    if (typeof first.taskId !== 'string' || !first.taskId) {
      return first as SignalDigestResponse;
    }
    for (let i = 0; i < MAX_POLL_ROUNDS; i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
      const taskRsp = await apiClient.get<Record<string, unknown>>(`${BASE}/tasks/${encodeURIComponent(first.taskId)}`);
      const task = toCamelCase<SignalDigestTaskStatusResponse>(taskRsp.data);
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
    const {
      tradingSessions = 14,
      topK = 100,
      market = 'cn',
      excludeBatch = false,
      batchOnly = true,
      adviceFilter = 'buy_or_hold',
    } = params;
    const response = await apiClient.get<Record<string, unknown>>(`${BASE}/snapshots`, {
      params: {
        snapshot_date: snapshotDate,
        trading_sessions: tradingSessions,
        top_k: topK,
        market,
        exclude_batch: excludeBatch,
        batch_only: batchOnly,
        advice_filter: adviceFilter,
      },
    });
    return toCamelCase<SignalDigestResponse>(response.data);
  },
  listSnapshotDates: async (
    params: Omit<SignalDigestQuery, 'refresh' | 'useCache' | 'withNarrative'> = {},
  ): Promise<SignalDigestSnapshotDatesResponse> => {
    const {
      tradingSessions = 14,
      topK = 100,
      market = 'cn',
      excludeBatch = false,
      batchOnly = true,
      adviceFilter = 'buy_or_hold',
    } = params;
    const response = await apiClient.get<Record<string, unknown>>(`${BASE}/snapshot-dates`, {
      params: {
        trading_sessions: tradingSessions,
        top_k: topK,
        market,
        exclude_batch: excludeBatch,
        batch_only: batchOnly,
        advice_filter: adviceFilter,
      },
    });
    return toCamelCase<SignalDigestSnapshotDatesResponse>(response.data);
  },
  getPortfolioSelection: async (
    params: Omit<SignalDigestQuery, 'withNarrative' | 'useCache' | 'refresh'> & {
      strategyId?: 'strategy_1';
      backtestEvalWindowDays?: number;
      signalDate?: string;
    } = {},
  ): Promise<PortfolioSelectionResponse> => {
    const {
      tradingSessions = 14,
      topK = 100,
      market = 'cn',
      excludeBatch = false,
      batchOnly = true,
      adviceFilter = 'buy_or_hold',
      strategyId = 'strategy_1',
      backtestEvalWindowDays = 10,
      signalDate,
    } = params;
    const response = await apiClient.get<Record<string, unknown>>(`${BASE}/portfolio-selection`, {
      params: {
        trading_sessions: tradingSessions,
        top_k: topK,
        market,
        exclude_batch: excludeBatch,
        batch_only: batchOnly,
        advice_filter: adviceFilter,
        strategy_id: strategyId,
        backtest_eval_window_days: backtestEvalWindowDays,
        signal_date: signalDate || undefined,
      },
    });
    return toCamelCase<PortfolioSelectionResponse>(response.data);
  },
};
