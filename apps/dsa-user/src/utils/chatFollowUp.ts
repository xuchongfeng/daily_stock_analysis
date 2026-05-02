import { apiFetch } from '../api/http';
import { validateStockCode } from './stockCode';

export interface ChatFollowUpContext {
  stock_code: string;
  stock_name: string | null;
  previous_analysis_summary?: unknown;
  previous_strategy?: unknown;
  previous_price?: number;
  previous_change_pct?: number;
}

const MAX_FOLLOW_UP_NAME_LENGTH = 80;

function hasInvalidFollowUpNameCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

export function sanitizeFollowUpStockCode(stockCode: string | null): string | null {
  if (!stockCode) {
    return null;
  }
  const { valid, normalized } = validateStockCode(stockCode);
  return valid ? normalized : null;
}

export function sanitizeFollowUpStockName(stockName: string | null): string | null {
  const normalized = stockName?.trim().replace(/\s+/g, ' ') ?? '';
  if (!normalized) {
    return null;
  }
  if (normalized.length > MAX_FOLLOW_UP_NAME_LENGTH || hasInvalidFollowUpNameCharacter(normalized)) {
    return null;
  }
  return normalized;
}

/** 从 URL 移除追问参数（stock/name/recordId），保留 tab 等其它查询项 */
export function stripChatFollowUpSearchParams(prev: URLSearchParams): URLSearchParams {
  const n = new URLSearchParams(prev);
  n.delete('stock');
  n.delete('name');
  n.delete('recordId');
  return n;
}

export function parseFollowUpRecordId(recordId: string | null): number | undefined {
  if (!recordId || !/^\d+$/.test(recordId)) {
    return undefined;
  }
  const parsed = Number(recordId);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

export function buildFollowUpPrompt(stockCode: string, stockName: string | null): string {
  const displayName = stockName ? `${stockName}(${stockCode})` : stockCode;
  return `请深入分析 ${displayName}`;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function buildChatFollowUpContext(
  stockCode: string,
  stockName: string | null,
  report?: unknown,
): ChatFollowUpContext {
  const context: ChatFollowUpContext = {
    stock_code: stockCode,
    stock_name: stockName,
  };

  if (!report || typeof report !== 'object' || report === null) {
    return context;
  }

  const r = report as Record<string, unknown>;
  const summary = r.summary ?? r.analysis_summary;
  if (summary !== undefined) {
    context.previous_analysis_summary = summary;
  }
  if (r.strategy !== undefined) {
    context.previous_strategy = r.strategy;
  }

  const meta = r.meta;
  if (meta && typeof meta === 'object' && meta !== null) {
    const m = meta as Record<string, unknown>;
    context.previous_price = num(m.current_price ?? m.currentPrice);
    context.previous_change_pct = num(m.change_pct ?? m.changePct);
  }

  return context;
}

export async function resolveChatFollowUpContext(params: {
  stockCode: string;
  stockName: string | null;
  recordId?: number;
}): Promise<ChatFollowUpContext> {
  const { stockCode, stockName, recordId } = params;
  const base = buildChatFollowUpContext(stockCode, stockName);
  if (!recordId) {
    return base;
  }

  try {
    const response = await apiFetch(`/api/v1/history/${recordId}`);
    if (!response.ok) {
      return base;
    }
    const report: unknown = await response.json();
    return buildChatFollowUpContext(stockCode, stockName, report);
  } catch {
    return base;
  }
}
