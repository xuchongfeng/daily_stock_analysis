import { apiFetch } from './http';
import { createApiError, parseApiError } from './error';
import { toCamelCase } from '../utils/camel';
import type {
  PortfolioAccountCreateRequest,
  PortfolioAccountItem,
  PortfolioAccountListResponse,
  PortfolioCashLedgerCreateRequest,
  PortfolioCashLedgerListResponse,
  PortfolioCorporateActionCreateRequest,
  PortfolioCorporateActionListResponse,
  PortfolioCostMethod,
  PortfolioDeleteResponse,
  PortfolioEventCreatedResponse,
  PortfolioFxRefreshResponse,
  PortfolioImportBrokerListResponse,
  PortfolioImportCommitResponse,
  PortfolioImportParseResponse,
  PortfolioRiskResponse,
  PortfolioSnapshotResponse,
  PortfolioTradeCreateRequest,
  PortfolioTradeListResponse,
} from '../types/portfolio';

function throwHttpError(res: Response, raw: unknown): never {
  const bogus = Object.assign(new Error('request failed'), {
    response: { status: res.status, data: raw },
  });
  throw createApiError(parseApiError(bogus));
}

type SnapshotQuery = { accountId?: number; asOf?: string; costMethod?: PortfolioCostMethod };
type FxRefreshQuery = { accountId?: number; asOf?: string };
type EventQuery = {
  accountId?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

function buildSnapshotParams(query: SnapshotQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (query.accountId != null) p.set('account_id', String(query.accountId));
  if (query.asOf) p.set('as_of', query.asOf);
  if (query.costMethod) p.set('cost_method', query.costMethod);
  return p;
}

function buildFxParams(query: FxRefreshQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (query.accountId != null) p.set('account_id', String(query.accountId));
  if (query.asOf) p.set('as_of', query.asOf);
  return p;
}

function buildEventParams(query: EventQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (query.accountId != null) p.set('account_id', String(query.accountId));
  if (query.dateFrom) p.set('date_from', query.dateFrom);
  if (query.dateTo) p.set('date_to', query.dateTo);
  if (query.page != null) p.set('page', String(query.page));
  if (query.pageSize != null) p.set('page_size', String(query.pageSize));
  return p;
}

async function readJsonOk<T>(res: Response): Promise<T> {
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) throwHttpError(res, raw);
  return toCamelCase<T>(raw);
}

export const portfolioApi = {
  async getAccounts(includeInactive = false): Promise<PortfolioAccountListResponse> {
    const qs = new URLSearchParams({ include_inactive: includeInactive ? 'true' : 'false' });
    const res = await apiFetch(`/api/v1/portfolio/accounts?${qs}`);
    return readJsonOk(res);
  },

  async createAccount(payload: PortfolioAccountCreateRequest): Promise<PortfolioAccountItem> {
    const res = await apiFetch('/api/v1/portfolio/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name,
        broker: payload.broker,
        market: payload.market,
        base_currency: payload.baseCurrency,
        owner_id: payload.ownerId,
      }),
    });
    return readJsonOk(res);
  },

  async getSnapshot(query: SnapshotQuery = {}): Promise<PortfolioSnapshotResponse> {
    const q = buildSnapshotParams(query).toString();
    const res = await apiFetch(`/api/v1/portfolio/snapshot${q ? `?${q}` : ''}`);
    return readJsonOk(res);
  },

  async getRisk(query: SnapshotQuery = {}): Promise<PortfolioRiskResponse> {
    const q = buildSnapshotParams(query).toString();
    const res = await apiFetch(`/api/v1/portfolio/risk${q ? `?${q}` : ''}`);
    return readJsonOk(res);
  },

  async refreshFx(query: FxRefreshQuery = {}): Promise<PortfolioFxRefreshResponse> {
    const q = buildFxParams(query).toString();
    const res = await apiFetch(`/api/v1/portfolio/fx/refresh${q ? `?${q}` : ''}`, { method: 'POST' });
    return readJsonOk(res);
  },

  async createTrade(payload: PortfolioTradeCreateRequest): Promise<PortfolioEventCreatedResponse> {
    const res = await apiFetch('/api/v1/portfolio/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: payload.accountId,
        symbol: payload.symbol,
        trade_date: payload.tradeDate,
        side: payload.side,
        quantity: payload.quantity,
        price: payload.price,
        fee: payload.fee ?? 0,
        tax: payload.tax ?? 0,
        market: payload.market,
        currency: payload.currency,
        trade_uid: payload.tradeUid,
        note: payload.note,
      }),
    });
    return readJsonOk(res);
  },

  async deleteTrade(tradeId: number): Promise<PortfolioDeleteResponse> {
    const res = await apiFetch(`/api/v1/portfolio/trades/${tradeId}`, { method: 'DELETE' });
    return readJsonOk(res);
  },

  async createCashLedger(payload: PortfolioCashLedgerCreateRequest): Promise<PortfolioEventCreatedResponse> {
    const res = await apiFetch('/api/v1/portfolio/cash-ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: payload.accountId,
        event_date: payload.eventDate,
        direction: payload.direction,
        amount: payload.amount,
        currency: payload.currency,
        note: payload.note,
      }),
    });
    return readJsonOk(res);
  },

  async deleteCashLedger(entryId: number): Promise<PortfolioDeleteResponse> {
    const res = await apiFetch(`/api/v1/portfolio/cash-ledger/${entryId}`, { method: 'DELETE' });
    return readJsonOk(res);
  },

  async createCorporateAction(
    payload: PortfolioCorporateActionCreateRequest,
  ): Promise<PortfolioEventCreatedResponse> {
    const res = await apiFetch('/api/v1/portfolio/corporate-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: payload.accountId,
        symbol: payload.symbol,
        effective_date: payload.effectiveDate,
        action_type: payload.actionType,
        market: payload.market,
        currency: payload.currency,
        cash_dividend_per_share: payload.cashDividendPerShare,
        split_ratio: payload.splitRatio,
        note: payload.note,
      }),
    });
    return readJsonOk(res);
  },

  async deleteCorporateAction(actionId: number): Promise<PortfolioDeleteResponse> {
    const res = await apiFetch(`/api/v1/portfolio/corporate-actions/${actionId}`, { method: 'DELETE' });
    return readJsonOk(res);
  },

  async listTrades(
    query: EventQuery & { symbol?: string; side?: 'buy' | 'sell' } = {},
  ): Promise<PortfolioTradeListResponse> {
    const p = buildEventParams(query);
    if (query.symbol) p.set('symbol', query.symbol);
    if (query.side) p.set('side', query.side);
    const res = await apiFetch(`/api/v1/portfolio/trades?${p}`);
    return readJsonOk(res);
  },

  async listCashLedger(query: EventQuery & { direction?: 'in' | 'out' } = {}): Promise<PortfolioCashLedgerListResponse> {
    const p = buildEventParams(query);
    if (query.direction) p.set('direction', query.direction);
    const res = await apiFetch(`/api/v1/portfolio/cash-ledger?${p}`);
    return readJsonOk(res);
  },

  async listCorporateActions(
    query: EventQuery & { symbol?: string; actionType?: 'cash_dividend' | 'split_adjustment' } = {},
  ): Promise<PortfolioCorporateActionListResponse> {
    const p = buildEventParams(query);
    if (query.symbol) p.set('symbol', query.symbol);
    if (query.actionType) p.set('action_type', query.actionType);
    const res = await apiFetch(`/api/v1/portfolio/corporate-actions?${p}`);
    return readJsonOk(res);
  },

  async listImportBrokers(): Promise<PortfolioImportBrokerListResponse> {
    const res = await apiFetch('/api/v1/portfolio/imports/csv/brokers');
    return readJsonOk(res);
  },

  async parseCsvImport(broker: string, file: File): Promise<PortfolioImportParseResponse> {
    const formData = new FormData();
    formData.append('broker', broker);
    formData.append('file', file);
    const res = await apiFetch('/api/v1/portfolio/imports/csv/parse', { method: 'POST', body: formData });
    return readJsonOk(res);
  },

  async commitCsvImport(
    accountId: number,
    broker: string,
    file: File,
    dryRun = false,
  ): Promise<PortfolioImportCommitResponse> {
    const formData = new FormData();
    formData.append('account_id', String(accountId));
    formData.append('broker', broker);
    formData.append('dry_run', dryRun ? 'true' : 'false');
    formData.append('file', file);
    const res = await apiFetch('/api/v1/portfolio/imports/csv/commit', { method: 'POST', body: formData });
    return readJsonOk(res);
  },
};
