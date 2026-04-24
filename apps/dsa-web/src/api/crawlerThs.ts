import apiClient from './index';
import { toCamelCase } from './utils';
import type {
  ThsConceptListResponse,
  ThsConceptRunListResponse,
  ThsConstituentListResponse,
  ThsVolumeBatchSectorStatsResponse,
} from '../types/crawlerThs';

const BASE = '/api/v1/crawler/ths-concept';

export const crawlerThsApi = {
  listRuns: async (params?: { page?: number; limit?: number }): Promise<ThsConceptRunListResponse> => {
    const { page = 1, limit = 30 } = params || {};
    const res = await apiClient.get<Record<string, unknown>>(`${BASE}/runs`, {
      params: { page, limit },
    });
    return toCamelCase<ThsConceptRunListResponse>(res.data);
  },

  listConcepts: async (params: {
    runId: string;
    page?: number;
    limit?: number;
    q?: string;
  }): Promise<ThsConceptListResponse> => {
    const { runId, page = 1, limit = 100, q } = params;
    const p: Record<string, string | number> = { page, limit };
    if (q && q.trim()) {
      p.q = q.trim();
    }
    const res = await apiClient.get<Record<string, unknown>>(
      `${BASE}/runs/${encodeURIComponent(runId)}/concepts`,
      { params: p }
    );
    return toCamelCase<ThsConceptListResponse>(res.data);
  },

  listConstituents: async (params: {
    runId: string;
    page?: number;
    limit?: number;
    conceptCode?: string | null;
  }): Promise<ThsConstituentListResponse> => {
    const { runId, page = 1, limit = 200, conceptCode } = params;
    const p: Record<string, string | number> = { page, limit };
    if (conceptCode && conceptCode.trim()) {
      p.concept_code = conceptCode.trim();
    }
    const res = await apiClient.get<Record<string, unknown>>(
      `${BASE}/runs/${encodeURIComponent(runId)}/constituents`,
      { params: p }
    );
    return toCamelCase<ThsConstituentListResponse>(res.data);
  },

  volumeBatchSectorStats: async (params: {
    runId: string;
    batchRunId: string;
    limit?: number;
  }): Promise<ThsVolumeBatchSectorStatsResponse> => {
    const { runId, batchRunId, limit = 200 } = params;
    const res = await apiClient.get<Record<string, unknown>>(
      `${BASE}/runs/${encodeURIComponent(runId)}/volume-batch-sector-stats`,
      { params: { batch_run_id: batchRunId, limit } }
    );
    return toCamelCase<ThsVolumeBatchSectorStatsResponse>(res.data);
  },
};
