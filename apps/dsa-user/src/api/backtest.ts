import { apiFetch } from './http';
import { createApiError, parseApiError } from './error';
import { toCamelCase } from '../utils/camel';
import type {
  BacktestRunRequest,
  BacktestRunResponse,
  BacktestResultsResponse,
  PerformanceMetrics,
} from '../types/backtest';

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

function buildResultsQuery(params: {
  code?: string;
  codes?: string[];
  evalWindowDays?: number;
  analysisDateFrom?: string;
  analysisDateTo?: string;
  page?: number;
  limit?: number;
}): string {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 1));
  q.set('limit', String(params.limit ?? 20));
  if (params.code) q.set('code', params.code);
  if (params.codes?.length) q.set('codes', params.codes.join(','));
  if (params.evalWindowDays != null) q.set('eval_window_days', String(params.evalWindowDays));
  if (params.analysisDateFrom) q.set('analysis_date_from', params.analysisDateFrom);
  if (params.analysisDateTo) q.set('analysis_date_to', params.analysisDateTo);
  return q.toString();
}

function buildPerformanceQuery(params: {
  codes?: string[];
  evalWindowDays?: number;
  analysisDateFrom?: string;
  analysisDateTo?: string;
}): string {
  const q = new URLSearchParams();
  if (params.codes?.length) q.set('codes', params.codes.join(','));
  if (params.evalWindowDays != null) q.set('eval_window_days', String(params.evalWindowDays));
  if (params.analysisDateFrom) q.set('analysis_date_from', params.analysisDateFrom);
  if (params.analysisDateTo) q.set('analysis_date_to', params.analysisDateTo);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const backtestApi = {
  async run(params: BacktestRunRequest = {}): Promise<BacktestRunResponse> {
    const body: Record<string, unknown> = {};
    if (params.code) body.code = params.code;
    if (params.codes?.length) body.codes = params.codes;
    if (params.selectionRule) body.selection_rule = params.selectionRule;
    if (params.force) body.force = params.force;
    if (params.evalWindowDays != null) body.eval_window_days = params.evalWindowDays;
    if (params.minAgeDays != null) body.min_age_days = params.minAgeDays;
    if (params.limit != null) body.limit = params.limit;

    const res = await apiFetch('/api/v1/backtest/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return readJsonOk<BacktestRunResponse>(res);
  },

  async getResults(params: {
    code?: string;
    codes?: string[];
    evalWindowDays?: number;
    analysisDateFrom?: string;
    analysisDateTo?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<BacktestResultsResponse> {
    const qs = buildResultsQuery(params);
    const res = await apiFetch(`/api/v1/backtest/results?${qs}`);
    return readJsonOk<BacktestResultsResponse>(res);
  },

  async getOverallPerformance(params: {
    codes?: string[];
    evalWindowDays?: number;
    analysisDateFrom?: string;
    analysisDateTo?: string;
  } = {}): Promise<PerformanceMetrics | null> {
    const res = await apiFetch(`/api/v1/backtest/performance${buildPerformanceQuery(params)}`);
    if (res.status === 404) return null;
    return readJsonOk<PerformanceMetrics>(res);
  },

  async getStockPerformance(
    code: string,
    params: {
      evalWindowDays?: number;
      analysisDateFrom?: string;
      analysisDateTo?: string;
    } = {},
  ): Promise<PerformanceMetrics | null> {
    const q = new URLSearchParams();
    if (params.evalWindowDays != null) q.set('eval_window_days', String(params.evalWindowDays));
    if (params.analysisDateFrom) q.set('analysis_date_from', params.analysisDateFrom);
    if (params.analysisDateTo) q.set('analysis_date_to', params.analysisDateTo);
    const qs = q.toString();
    const res = await apiFetch(
      `/api/v1/backtest/performance/${encodeURIComponent(code)}${qs ? `?${qs}` : ''}`,
    );
    if (res.status === 404) return null;
    return readJsonOk<PerformanceMetrics>(res);
  },
};
