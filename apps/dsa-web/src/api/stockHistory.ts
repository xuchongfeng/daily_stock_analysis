import apiClient from './index';

export interface StockHistoryBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
  amount?: number | null;
  change_percent?: number | null;
}

export async function fetchStockDailyHistory(
  stockCode: string,
  days = 120,
): Promise<StockHistoryBar[]> {
  const code = (stockCode || '').trim();
  if (!code) return [];

  const { data: body } = await apiClient.get<{ data?: StockHistoryBar[] }>(
    `/api/v1/stocks/${encodeURIComponent(code)}/history`,
    { params: { period: 'daily', days } },
  );
  return Array.isArray(body?.data) ? body.data : [];
}
