import { apiFetch } from './http';
import { createApiError, parseApiError } from './error';
import { toCamelCaseWorkbench } from '../utils/workbenchCamel';
import type { AnalysisRequest, AnalyzeAsyncResponse, AnalysisReport } from '../types/workbenchAnalysis';

function throwHttpError(res: Response, raw: unknown): never {
  const bogus = Object.assign(new Error('request failed'), {
    response: { status: res.status, data: raw },
  });
  throw createApiError(parseApiError(bogus));
}

export class DuplicateTaskErrorWorkbench extends Error {
  stockCode: string;
  existingTaskId: string;

  constructor(stockCode: string, existingTaskId: string, message?: string) {
    super(message || `股票 ${stockCode} 正在分析中`);
    this.name = 'DuplicateTaskErrorWorkbench';
    this.stockCode = stockCode;
    this.existingTaskId = existingTaskId;
  }
}

export const workbenchAnalysisApi = {
  analyzeAsync: async (data: AnalysisRequest): Promise<AnalyzeAsyncResponse> => {
    const requestData: Record<string, unknown> = {
      stock_code: data.stockCode,
      stock_codes: data.stockCodes,
      report_type: data.reportType || 'detailed',
      force_refresh: data.forceRefresh || false,
      async_mode: true,
      stock_name: data.stockName,
      original_query: data.originalQuery,
      selection_source: data.selectionSource,
    };
    if (data.notify !== undefined) {
      requestData.notify = data.notify;
    }

    const res = await apiFetch('/api/v1/analysis/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(requestData),
    });

    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (res.status === 409) {
      const err = toCamelCaseWorkbench<{
        stockCode: string;
        existingTaskId: string;
        message?: string;
      }>(raw);
      throw new DuplicateTaskErrorWorkbench(err.stockCode, err.existingTaskId, err.message);
    }

    if (!res.ok) {
      throwHttpError(res, raw);
    }

    return toCamelCaseWorkbench<AnalyzeAsyncResponse>(raw);
  },

  getTaskStreamUrl: (): string => '/api/v1/analysis/tasks/stream',
};

export type { AnalysisReport };
