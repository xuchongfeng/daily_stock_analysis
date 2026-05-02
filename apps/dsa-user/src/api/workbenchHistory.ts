import { apiFetch } from './http';
import { createApiError, parseApiError } from './error';
import { toCamelCaseWorkbench } from '../utils/workbenchCamel';
import type {
  AnalysisReport,
  HistoryFilters,
  HistoryItem,
  HistoryListResponse,
} from '../types/workbenchAnalysis';

function throwHttpError(res: Response, raw: unknown): never {
  const bogus = Object.assign(new Error('request failed'), {
    response: { status: res.status, data: raw },
  });
  throw createApiError(parseApiError(bogus));
}

export interface GetHistoryListParamsWorkbench extends HistoryFilters {
  page?: number;
  limit?: number;
}

export const workbenchHistoryApi = {
  getList: async (params: GetHistoryListParamsWorkbench = {}): Promise<HistoryListResponse> => {
    const { stockCode, startDate, endDate, page = 1, limit = 20, mine, q } = params;
    const queryParams = new URLSearchParams();
    queryParams.set('page', String(page));
    queryParams.set('limit', String(limit));
    if (stockCode) queryParams.set('stock_code', stockCode);
    if (startDate) queryParams.set('start_date', startDate);
    if (endDate) queryParams.set('end_date', endDate);
    if (mine === true) queryParams.set('mine', 'true');
    const qq = typeof q === 'string' ? q.trim() : '';
    if (qq) queryParams.set('q', qq.slice(0, 64));

    const res = await apiFetch(`/api/v1/history?${queryParams.toString()}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      throwHttpError(res, raw);
    }
    const data = toCamelCaseWorkbench<{
      total: number;
      page: number;
      limit: number;
      items: HistoryItem[];
    }>(raw);
    return {
      total: data.total,
      page: data.page,
      limit: data.limit,
      items: data.items.map((item) => toCamelCaseWorkbench<HistoryItem>(item)),
    };
  },

  getDetail: async (recordId: number): Promise<AnalysisReport> => {
    const res = await apiFetch(`/api/v1/history/${recordId}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      throwHttpError(res, raw);
    }
    return toCamelCaseWorkbench<AnalysisReport>(raw);
  },

  getMarkdown: async (recordId: number): Promise<string> => {
    const res = await apiFetch(`/api/v1/history/${recordId}/markdown`);
    const raw = (await res.json().catch(() => ({}))) as { content?: string };
    if (!res.ok) {
      throwHttpError(res, raw);
    }
    return typeof raw.content === 'string' ? raw.content : '';
  },

  deleteRecords: async (recordIds: number[]): Promise<{ deleted: number }> => {
    const res = await apiFetch('/api/v1/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ record_ids: recordIds }),
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      throwHttpError(res, raw);
    }
    return toCamelCaseWorkbench<{ deleted: number }>(raw);
  },
};
