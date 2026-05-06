import { apiFetch } from './http';
import { createApiError, parseApiError } from './error';
import { toCamelCaseWorkbench } from '../utils/workbenchCamel';
import type { AnalysisReport } from '../types/workbenchAnalysis';

function throwHttpError(res: Response, raw: unknown): never {
  const bogus = Object.assign(new Error('request failed'), {
    response: { status: res.status, data: raw },
  });
  throw createApiError(parseApiError(bogus));
}

export interface PublicDemoAnalysisSamplesResponse {
  items: AnalysisReport[];
}

export const publicDemoAnalysisApi = {
  async getSamples(limit = 3): Promise<PublicDemoAnalysisSamplesResponse> {
    const queryParams = new URLSearchParams();
    queryParams.set('limit', String(limit));
    const res = await apiFetch(`/api/v1/public/demo-analysis-samples?${queryParams.toString()}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      throwHttpError(res, raw);
    }
    const data = toCamelCaseWorkbench<{ items: unknown[] }>(raw);
    const items = (data.items || []).map((item) => toCamelCaseWorkbench<AnalysisReport>(item));
    return { items };
  },
};
