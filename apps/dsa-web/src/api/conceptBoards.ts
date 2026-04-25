import apiClient from './index';
import { toCamelCase } from './utils';
import type { ConceptBoardListResponse, ConceptBoardStocksResponse } from '../types/conceptBoard';

const BASE = '/api/v1/concept-boards';

export const conceptBoardsApi = {
  listBoards: async (limit = 300): Promise<ConceptBoardListResponse> => {
    const res = await apiClient.get<Record<string, unknown>>(BASE, { params: { limit } });
    return toCamelCase<ConceptBoardListResponse>(res.data);
  },
  listBoardStocks: async (
    boardCode: string,
    params: { limit?: number; offset?: number } = {},
  ): Promise<ConceptBoardStocksResponse> => {
    const { limit = 500, offset = 0 } = params;
    const res = await apiClient.get<Record<string, unknown>>(`${BASE}/${encodeURIComponent(boardCode)}/stocks`, {
      params: { limit, offset },
    });
    return toCamelCase<ConceptBoardStocksResponse>(res.data);
  },
};
