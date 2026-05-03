/* eslint-disable react-hooks/set-state-in-effect -- mount / accountId 变更触发拉取 */
import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { ParsedApiError } from '../../api/error';
import { getParsedApiError } from '../../api/error';
import { portfolioApi } from '../../api/portfolio';
import {
  PortfolioApiErrorBanner,
  PortfolioCard,
  PortfolioConfirmDialog,
  PortfolioEmpty,
  PortfolioInlineAlert,
} from '../../components/portfolio/UserPortfolioUi';
import { toDateInputValue } from '../../utils/toDateInputValue';
import type {
  PortfolioAccountItem,
  PortfolioCashDirection,
  PortfolioCashLedgerListItem,
  PortfolioCorporateActionListItem,
  PortfolioCorporateActionType,
  PortfolioImportBrokerItem,
  PortfolioImportCommitResponse,
  PortfolioImportParseResponse,
  PortfolioSide,
  PortfolioTradeListItem,
} from '../../types/portfolio';
import { formatBrokerLabel, formatCashDirectionLabel, formatCorporateActionLabel, formatSideLabel } from './portfolioFormat';

const DEFAULT_PAGE_SIZE = 20;
const FALLBACK_BROKERS: PortfolioImportBrokerItem[] = [
  { broker: 'huatai', aliases: [], displayName: '华泰' },
  { broker: 'citic', aliases: ['zhongxin'], displayName: '中信' },
  { broker: 'cmb', aliases: ['cmbchina', 'zhaoshang'], displayName: '招商' },
];

type EventType = 'trade' | 'cash' | 'corporate';

type PendingDelete =
  | { eventType: 'trade'; id: number; message: string }
  | { eventType: 'cash'; id: number; message: string }
  | { eventType: 'corporate'; id: number; message: string };

type PortfolioAlertVariant = 'info' | 'success' | 'warning' | 'danger';

const IN = 'user-portfolio-input';
const SEL = 'user-portfolio-input user-portfolio-select';
const FILE_PICK = 'user-portfolio-input user-portfolio-file-label';

function getTodayIso(): string {
  return toDateInputValue(new Date());
}

function getCsvParseVariant(result: PortfolioImportParseResponse): PortfolioAlertVariant {
  return result.errorCount > 0 || result.skippedCount > 0 ? 'warning' : 'info';
}

function getCsvCommitVariant(result: PortfolioImportCommitResponse, isDryRun: boolean): PortfolioAlertVariant {
  if (isDryRun) return 'info';
  return result.failedCount > 0 || result.duplicateCount > 0 ? 'warning' : 'success';
}

export function PortfolioLedgerPage() {
  useEffect(() => {
    document.title = '持仓 · 流水';
  }, []);

  const params = useParams();
  const accountId = Number(params.accountId);

  const [accounts, setAccounts] = useState<PortfolioAccountItem[]>([]);
  const [accountsReady, setAccountsReady] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [accountMissing, setAccountMissing] = useState(false);

  const [brokers, setBrokers] = useState<PortfolioImportBrokerItem[]>([]);
  const [selectedBroker, setSelectedBroker] = useState('huatai');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvDryRun, setCsvDryRun] = useState(true);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvCommitting, setCsvCommitting] = useState(false);
  const [csvParseResult, setCsvParseResult] = useState<PortfolioImportParseResponse | null>(null);
  const [csvCommitResult, setCsvCommitResult] = useState<PortfolioImportCommitResponse | null>(null);
  const [brokerLoadWarning, setBrokerLoadWarning] = useState<string | null>(null);

  const [eventType, setEventType] = useState<EventType>('trade');
  const [eventDateFrom, setEventDateFrom] = useState('');
  const [eventDateTo, setEventDateTo] = useState('');
  const [eventSymbol, setEventSymbol] = useState('');
  const [eventSide, setEventSide] = useState<'' | PortfolioSide>('');
  const [eventDirection, setEventDirection] = useState<'' | PortfolioCashDirection>('');
  const [eventActionType, setEventActionType] = useState<'' | PortfolioCorporateActionType>('');
  const [eventPage, setEventPage] = useState(1);
  const [eventTotal, setEventTotal] = useState(0);
  const [eventLoading, setEventLoading] = useState(false);
  const [tradeEvents, setTradeEvents] = useState<PortfolioTradeListItem[]>([]);
  const [cashEvents, setCashEvents] = useState<PortfolioCashLedgerListItem[]>([]);
  const [corporateEvents, setCorporateEvents] = useState<PortfolioCorporateActionListItem[]>([]);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [tradeForm, setTradeForm] = useState({
    symbol: '',
    tradeDate: getTodayIso(),
    side: 'buy' as PortfolioSide,
    quantity: '',
    price: '',
    fee: '',
    tax: '',
    tradeUid: '',
    note: '',
  });
  const [cashForm, setCashForm] = useState({
    eventDate: getTodayIso(),
    direction: 'in' as PortfolioCashDirection,
    amount: '',
    currency: '',
    note: '',
  });
  const [corpForm, setCorpForm] = useState({
    symbol: '',
    effectiveDate: getTodayIso(),
    actionType: 'cash_dividend' as PortfolioCorporateActionType,
    cashDividendPerShare: '',
    splitRatio: '',
    note: '',
  });

  const validId = Number.isFinite(accountId) && accountId > 0;
  const writableAccount = validId ? accounts.find((item) => item.id === accountId) : undefined;
  const writableAccountId = writableAccount?.id;
  const totalEventPages = Math.max(1, Math.ceil(eventTotal / DEFAULT_PAGE_SIZE));
  const currentEventCount =
    eventType === 'trade'
      ? tradeEvents.length
      : eventType === 'cash'
        ? cashEvents.length
        : corporateEvents.length;

  const loadAccounts = useCallback(async () => {
    try {
      const response = await portfolioApi.getAccounts(false);
      setAccounts(response.accounts || []);
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setAccountsReady(true);
    }
  }, []);

  const loadBrokers = useCallback(async () => {
    try {
      const response = await portfolioApi.listImportBrokers();
      const brokerItems = response.brokers || [];
      if (brokerItems.length === 0) {
        setBrokers(FALLBACK_BROKERS);
        setBrokerLoadWarning('券商列表接口返回为空，已回退内置列表。');
        return;
      }
      setBrokers(brokerItems);
      setBrokerLoadWarning(null);
    } catch {
      setBrokers(FALLBACK_BROKERS);
      setBrokerLoadWarning('券商列表不可用，已回退内置列表。');
    }
  }, []);

  const loadEventsPage = useCallback(
    async (page: number) => {
      if (!validId) return;
      setEventLoading(true);
      try {
        if (eventType === 'trade') {
          const response = await portfolioApi.listTrades({
            accountId,
            dateFrom: eventDateFrom || undefined,
            dateTo: eventDateTo || undefined,
            symbol: eventSymbol || undefined,
            side: eventSide || undefined,
            page,
            pageSize: DEFAULT_PAGE_SIZE,
          });
          setTradeEvents(response.items || []);
          setEventTotal(response.total || 0);
        } else if (eventType === 'cash') {
          const response = await portfolioApi.listCashLedger({
            accountId,
            dateFrom: eventDateFrom || undefined,
            dateTo: eventDateTo || undefined,
            direction: eventDirection || undefined,
            page,
            pageSize: DEFAULT_PAGE_SIZE,
          });
          setCashEvents(response.items || []);
          setEventTotal(response.total || 0);
        } else {
          const response = await portfolioApi.listCorporateActions({
            accountId,
            dateFrom: eventDateFrom || undefined,
            dateTo: eventDateTo || undefined,
            symbol: eventSymbol || undefined,
            actionType: eventActionType || undefined,
            page,
            pageSize: DEFAULT_PAGE_SIZE,
          });
          setCorporateEvents(response.items || []);
          setEventTotal(response.total || 0);
        }
      } catch (err) {
        setError(getParsedApiError(err));
      } finally {
        setEventLoading(false);
      }
    },
    [accountId, eventActionType, eventDateFrom, eventDateTo, eventDirection, eventSide, eventSymbol, eventType, validId],
  );

  const loadEvents = useCallback(async () => {
    await loadEventsPage(eventPage);
  }, [eventPage, loadEventsPage]);

  const refreshAfterWrite = useCallback(
    async (page = eventPage) => {
      await Promise.all([loadAccounts(), loadEventsPage(page)]);
    },
    [eventPage, loadAccounts, loadEventsPage],
  );

  useEffect(() => {
    void loadAccounts();
    void loadBrokers();
  }, [loadAccounts, loadBrokers]);

  useEffect(() => {
    if (!validId || !accountsReady || accounts.length === 0) return;
    setAccountMissing(!accounts.some((a) => a.id === accountId));
  }, [accountId, accounts, accountsReady, validId]);

  useEffect(() => {
    if (!validId || !accountsReady || accountMissing) return;
    void loadEvents();
  }, [accountMissing, accountsReady, loadEvents, validId]);

  useEffect(() => {
    setEventPage(1);
  }, [eventType, accountId, eventDateFrom, eventDateTo, eventSymbol, eventSide, eventDirection, eventActionType]);

  const handleTradeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!writableAccountId) return;
    try {
      await portfolioApi.createTrade({
        accountId: writableAccountId,
        symbol: tradeForm.symbol,
        tradeDate: tradeForm.tradeDate,
        side: tradeForm.side,
        quantity: Number(tradeForm.quantity),
        price: Number(tradeForm.price),
        fee: Number(tradeForm.fee || 0),
        tax: Number(tradeForm.tax || 0),
        tradeUid: tradeForm.tradeUid || undefined,
        note: tradeForm.note || undefined,
      });
      await refreshAfterWrite();
      setTradeForm((prev) => ({ ...prev, symbol: '', tradeUid: '', note: '' }));
    } catch (err) {
      setError(getParsedApiError(err));
    }
  };

  const handleCashSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!writableAccountId) return;
    try {
      await portfolioApi.createCashLedger({
        accountId: writableAccountId,
        eventDate: cashForm.eventDate,
        direction: cashForm.direction,
        amount: Number(cashForm.amount),
        currency: cashForm.currency || undefined,
        note: cashForm.note || undefined,
      });
      await refreshAfterWrite();
      setCashForm((prev) => ({ ...prev, note: '' }));
    } catch (err) {
      setError(getParsedApiError(err));
    }
  };

  const handleCorporateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!writableAccountId) return;
    try {
      await portfolioApi.createCorporateAction({
        accountId: writableAccountId,
        symbol: corpForm.symbol,
        effectiveDate: corpForm.effectiveDate,
        actionType: corpForm.actionType,
        cashDividendPerShare: corpForm.cashDividendPerShare ? Number(corpForm.cashDividendPerShare) : undefined,
        splitRatio: corpForm.splitRatio ? Number(corpForm.splitRatio) : undefined,
        note: corpForm.note || undefined,
      });
      await refreshAfterWrite();
      setCorpForm((prev) => ({ ...prev, symbol: '', note: '' }));
    } catch (err) {
      setError(getParsedApiError(err));
    }
  };

  const handleParseCsv = async () => {
    if (!csvFile) return;
    try {
      setCsvParsing(true);
      const parsed = await portfolioApi.parseCsvImport(selectedBroker, csvFile);
      setCsvParseResult(parsed);
      setCsvCommitResult(null);
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setCsvParsing(false);
    }
  };

  const handleCommitCsv = async () => {
    if (!csvFile || !writableAccountId) return;
    try {
      setCsvCommitting(true);
      const committed = await portfolioApi.commitCsvImport(writableAccountId, selectedBroker, csvFile, csvDryRun);
      setCsvCommitResult(committed);
      if (!csvDryRun) {
        await refreshAfterWrite();
      }
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setCsvCommitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || deleteLoading || !writableAccountId) return;
    const nextPage = currentEventCount === 1 && eventPage > 1 ? eventPage - 1 : eventPage;
    try {
      setDeleteLoading(true);
      if (pendingDelete.eventType === 'trade') {
        await portfolioApi.deleteTrade(pendingDelete.id);
      } else if (pendingDelete.eventType === 'cash') {
        await portfolioApi.deleteCashLedger(pendingDelete.id);
      } else {
        await portfolioApi.deleteCorporateAction(pendingDelete.id);
      }
      setPendingDelete(null);
      if (nextPage !== eventPage) {
        setEventPage(nextPage);
      }
      await refreshAfterWrite(nextPage);
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!validId) {
    return (
      <div className="stack user-portfolio-page">
        <PortfolioInlineAlert variant="danger" title="参数错误" message="无效的账户 ID。" />
        <Link to="/portfolio" className="user-portfolio-chat-link">
          ← 返回持仓首页
        </Link>
      </div>
    );
  }

  if (!accountsReady) {
    return (
      <div className="stack user-portfolio-page">
        <p className="text-sm user-portfolio-muted">加载账户信息…</p>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="stack user-portfolio-page">
        <PortfolioInlineAlert variant="warning" title="暂无账户" message="请先在持仓首页创建账户。" />
        <Link to="/portfolio" className="user-portfolio-chat-link">
          ← 返回持仓首页
        </Link>
      </div>
    );
  }

  if (accountMissing) {
    return (
      <div className="stack user-portfolio-page">
        <PortfolioInlineAlert variant="warning" title="未找到账户" message="该账户不存在或已被停用。" />
        <Link to="/portfolio" className="user-portfolio-chat-link">
          ← 返回持仓首页
        </Link>
      </div>
    );
  }

  return (
    <div className="stack user-portfolio-page">
      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/portfolio" className="user-portfolio-chat-link text-sm">
              ← 账户一览
            </Link>
            <h1 className="h1 user-portfolio-page-title mt-1">流水录入</h1>
            <p className="lead user-portfolio-muted" style={{ marginBottom: 0 }}>
              {writableAccount ? (
                <>
                  账户 <strong>{writableAccount.name}</strong>
                  <span className="user-portfolio-muted"> #{accountId}</span>
                </>
              ) : (
                `账户 #${accountId}`
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <Link className="user-portfolio-btn user-portfolio-btn-secondary text-sm" to={`/portfolio/account/${accountId}`}>
              持仓明细
            </Link>
            <Link className="user-portfolio-btn user-portfolio-btn-secondary text-sm" to={`/portfolio/account/${accountId}/risk`}>
              回撤 / 止损
            </Link>
            <button
              type="button"
              className="user-portfolio-btn user-portfolio-btn-secondary text-sm"
              onClick={() => void refreshAfterWrite()}
            >
              刷新
            </button>
          </div>
        </div>
      </section>

      {error ? <PortfolioApiErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      <section className="user-portfolio-grid user-portfolio-ledger-manual-row">
        <div className="user-portfolio-ledger-manual-cluster">
        <PortfolioCard>
          <h3 className="text-sm font-semibold user-portfolio-strong mb-3">手工录入：交易</h3>
          <form className="space-y-2" onSubmit={handleTradeSubmit}>
            <input
              className={IN}
              placeholder="股票代码（例如 600519）"
              value={tradeForm.symbol}
              onChange={(e) => setTradeForm((prev) => ({ ...prev, symbol: e.target.value }))}
              required
            />
            <div className="user-portfolio-grid-2">
              <input
                className={IN}
                type="date"
                value={tradeForm.tradeDate}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, tradeDate: e.target.value }))}
                required
              />
              <select
                className={SEL}
                value={tradeForm.side}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, side: e.target.value as PortfolioSide }))}
              >
                <option value="buy">买入</option>
                <option value="sell">卖出</option>
              </select>
            </div>
            <div className="user-portfolio-grid-2">
              <input
                className={IN}
                type="number"
                min="0"
                step="0.0001"
                placeholder="数量（必填）"
                value={tradeForm.quantity}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, quantity: e.target.value }))}
                required
              />
              <input
                className={IN}
                type="number"
                min="0"
                step="0.0001"
                placeholder="成交价（必填）"
                value={tradeForm.price}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, price: e.target.value }))}
                required
              />
            </div>
            <div className="user-portfolio-grid-2">
              <input
                className={IN}
                type="number"
                min="0"
                step="0.0001"
                placeholder="手续费（可选）"
                value={tradeForm.fee}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, fee: e.target.value }))}
              />
              <input
                className={IN}
                type="number"
                min="0"
                step="0.0001"
                placeholder="税费（可选）"
                value={tradeForm.tax}
                onChange={(e) => setTradeForm((prev) => ({ ...prev, tax: e.target.value }))}
              />
            </div>
            <button type="submit" className="user-portfolio-btn user-portfolio-btn-secondary w-full" disabled={!writableAccountId}>
              提交交易
            </button>
          </form>
        </PortfolioCard>

        <PortfolioCard>
          <h3 className="text-sm font-semibold user-portfolio-strong mb-3">手工录入：资金流水</h3>
          <form className="space-y-2" onSubmit={handleCashSubmit}>
            <div className="user-portfolio-grid-2">
              <input
                className={IN}
                type="date"
                value={cashForm.eventDate}
                onChange={(e) => setCashForm((prev) => ({ ...prev, eventDate: e.target.value }))}
                required
              />
              <select
                className={SEL}
                value={cashForm.direction}
                onChange={(e) => setCashForm((prev) => ({ ...prev, direction: e.target.value as PortfolioCashDirection }))}
              >
                <option value="in">流入</option>
                <option value="out">流出</option>
              </select>
            </div>
            <input
              className={IN}
              type="number"
              min="0"
              step="0.0001"
              placeholder="金额"
              value={cashForm.amount}
              onChange={(e) => setCashForm((prev) => ({ ...prev, amount: e.target.value }))}
              required
            />
            <input
              className={IN}
              placeholder={`币种（可选，默认 ${writableAccount?.baseCurrency || '账户基准币'}）`}
              value={cashForm.currency}
              onChange={(e) => setCashForm((prev) => ({ ...prev, currency: e.target.value }))}
            />
            <button type="submit" className="user-portfolio-btn user-portfolio-btn-secondary w-full" disabled={!writableAccountId}>
              提交资金流水
            </button>
          </form>
        </PortfolioCard>

        <PortfolioCard>
          <h3 className="text-sm font-semibold user-portfolio-strong mb-3">手工录入：公司行为</h3>
          <form className="space-y-2" onSubmit={handleCorporateSubmit}>
            <input
              className={IN}
              placeholder="股票代码"
              value={corpForm.symbol}
              onChange={(e) => setCorpForm((prev) => ({ ...prev, symbol: e.target.value }))}
              required
            />
            <div className="user-portfolio-grid-2">
              <input
                className={IN}
                type="date"
                value={corpForm.effectiveDate}
                onChange={(e) => setCorpForm((prev) => ({ ...prev, effectiveDate: e.target.value }))}
                required
              />
              <select
                className={SEL}
                value={corpForm.actionType}
                onChange={(e) =>
                  setCorpForm((prev) => ({ ...prev, actionType: e.target.value as PortfolioCorporateActionType }))
                }
              >
                <option value="cash_dividend">现金分红</option>
                <option value="split_adjustment">拆并股调整</option>
              </select>
            </div>
            {corpForm.actionType === 'cash_dividend' ? (
              <input
                className={IN}
                type="number"
                min="0"
                step="0.000001"
                placeholder="每股分红"
                value={corpForm.cashDividendPerShare}
                onChange={(e) =>
                  setCorpForm((prev) => ({ ...prev, cashDividendPerShare: e.target.value, splitRatio: '' }))
                }
                required
              />
            ) : (
              <input
                className={IN}
                type="number"
                min="0"
                step="0.000001"
                placeholder="拆并股比例"
                value={corpForm.splitRatio}
                onChange={(e) =>
                  setCorpForm((prev) => ({ ...prev, splitRatio: e.target.value, cashDividendPerShare: '' }))
                }
                required
              />
            )}
            <button type="submit" className="user-portfolio-btn user-portfolio-btn-secondary w-full" disabled={!writableAccountId}>
              提交企业行为
            </button>
          </form>
        </PortfolioCard>
        </div>
      </section>

      <section className="user-portfolio-grid user-portfolio-ledger-csv-row">
        <PortfolioCard className="user-portfolio-ledger-csv-card">
          <h3 className="text-sm font-semibold user-portfolio-strong mb-1">券商 CSV 导入</h3>
          <p className="user-portfolio-ledger-csv-lead">
            选择券商导出模板后上传 CSV；建议先「解析文件」核对，再决定是否写入（可勾选预演）。
          </p>
          <div className="user-portfolio-ledger-csv-body">
            {brokerLoadWarning ? (
              <PortfolioInlineAlert variant="warning" className="rounded-lg px-3 py-2 text-xs shadow-none" message={brokerLoadWarning} />
            ) : null}
            <div className="user-portfolio-ledger-csv-grid">
              <div className="user-portfolio-ledger-csv-field">
                <span className="user-portfolio-ledger-csv-label">券商模板</span>
                <select className={`${IN} ${SEL}`} value={selectedBroker} onChange={(e) => setSelectedBroker(e.target.value)}>
                  {brokers.length > 0 ? (
                    brokers.map((item) => (
                      <option key={item.broker} value={item.broker}>
                        {formatBrokerLabel(item.broker, item.displayName)}
                      </option>
                    ))
                  ) : (
                    <option value="huatai">huatai（华泰）</option>
                  )}
                </select>
              </div>
              <div className="user-portfolio-ledger-csv-field">
                <span className="user-portfolio-ledger-csv-label">CSV 文件</span>
                <label className={`${FILE_PICK} user-portfolio-ledger-csv-file-btn`}>
                  {csvFile ? csvFile.name : '点击选择 .csv 文件'}
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => setCsvFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                  />
                </label>
              </div>
            </div>
            <div className="user-portfolio-ledger-csv-actions">
              <label className="user-portfolio-ledger-csv-dryrun user-portfolio-muted" htmlFor="csv-dry-run">
                <input id="csv-dry-run" type="checkbox" checked={csvDryRun} onChange={(e) => setCsvDryRun(e.target.checked)} />
                <span>仅预演（不写入数据库）</span>
              </label>
              <div className="user-portfolio-ledger-csv-buttons">
                <button type="button" className="user-portfolio-btn user-portfolio-btn-secondary" disabled={!csvFile || csvParsing} onClick={() => void handleParseCsv()}>
                  {csvParsing ? '解析中…' : '解析文件'}
                </button>
                <button type="button" className="user-portfolio-btn user-portfolio-btn-secondary" disabled={!csvFile || !writableAccountId || csvCommitting} onClick={() => void handleCommitCsv()}>
                  {csvCommitting ? '提交中…' : '提交导入'}
                </button>
              </div>
            </div>
            {csvParseResult ? (
              <PortfolioInlineAlert
                variant={getCsvParseVariant(csvParseResult)}
                title="CSV 解析结果"
                message={`有效 ${csvParseResult.recordCount} 条，跳过 ${csvParseResult.skippedCount} 条，错误 ${csvParseResult.errorCount} 条。`}
                className="rounded-lg px-3 py-2 text-xs shadow-none"
              />
            ) : null}
            {csvCommitResult ? (
              <PortfolioInlineAlert
                variant={getCsvCommitVariant(csvCommitResult, csvDryRun)}
                title={csvDryRun ? 'CSV 预演结果' : 'CSV 提交结果'}
                message={`${csvDryRun ? '预演检查' : '实际写入'}：写入 ${csvCommitResult.insertedCount} 条，重复 ${csvCommitResult.duplicateCount} 条，失败 ${csvCommitResult.failedCount} 条。`}
                className="rounded-lg px-3 py-2 text-xs shadow-none"
              />
            ) : null}
          </div>
        </PortfolioCard>
      </section>

      <section className="user-portfolio-grid user-portfolio-ledger-events-row">
        <PortfolioCard className="user-portfolio-ledger-events-card">
          <h3 className="text-sm font-semibold user-portfolio-strong mb-3">事件记录</h3>
          <div className="space-y-2">
            <div className="user-portfolio-grid-2">
              <select className={SEL} value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
                <option value="trade">交易流水</option>
                <option value="cash">资金流水</option>
                <option value="corporate">公司行为</option>
              </select>
              <button type="button" className="user-portfolio-btn user-portfolio-btn-secondary text-sm" onClick={() => void loadEvents()} disabled={eventLoading}>
                {eventLoading ? '加载中...' : '刷新流水'}
              </button>
            </div>
            <div className="user-portfolio-grid-2">
              <input className={IN} type="date" value={eventDateFrom} onChange={(e) => setEventDateFrom(e.target.value)} />
              <input className={IN} type="date" value={eventDateTo} onChange={(e) => setEventDateTo(e.target.value)} />
            </div>
            {(eventType === 'trade' || eventType === 'corporate') ? (
              <input className={IN} placeholder="按股票代码筛选" value={eventSymbol} onChange={(e) => setEventSymbol(e.target.value)} />
            ) : null}
            {eventType === 'trade' ? (
              <select className={SEL} value={eventSide} onChange={(e) => setEventSide(e.target.value as '' | PortfolioSide)}>
                <option value="">全部买卖方向</option>
                <option value="buy">买入</option>
                <option value="sell">卖出</option>
              </select>
            ) : null}
            {eventType === 'cash' ? (
              <select className={SEL} value={eventDirection} onChange={(e) => setEventDirection(e.target.value as '' | PortfolioCashDirection)}>
                <option value="">全部资金方向</option>
                <option value="in">流入</option>
                <option value="out">流出</option>
              </select>
            ) : null}
            {eventType === 'corporate' ? (
              <select className={SEL} value={eventActionType} onChange={(e) => setEventActionType(e.target.value as '' | PortfolioCorporateActionType)}>
                <option value="">全部公司行为</option>
                <option value="cash_dividend">现金分红</option>
                <option value="split_adjustment">拆并股调整</option>
              </select>
            ) : null}
            <div className="user-portfolio-events-scroll user-portfolio-ledger-events-scroll">
              {eventType === 'trade' &&
                tradeEvents.map((item) => (
                  <div key={`t-${item.id}`} className="user-portfolio-events-row">
                    <div className="user-portfolio-events-msg">
                      {item.tradeDate} {formatSideLabel(item.side)} {item.symbol} 数量={item.quantity} 价格={item.price}
                    </div>
                    <button
                      type="button"
                      className="user-portfolio-btn user-portfolio-btn-secondary user-portfolio-btn-xs shrink-0"
                      onClick={() =>
                        setPendingDelete({
                          eventType: 'trade',
                          id: item.id,
                          message: `确认删除 ${item.tradeDate} 的${formatSideLabel(item.side)}流水 ${item.symbol}（数量 ${item.quantity}，价格 ${item.price}）吗？`,
                        })
                      }
                    >
                      删除
                    </button>
                  </div>
                ))}
              {eventType === 'cash' &&
                cashEvents.map((item) => (
                  <div key={`c-${item.id}`} className="user-portfolio-events-row">
                    <div className="user-portfolio-events-msg">
                      {item.eventDate} {formatCashDirectionLabel(item.direction)} {item.amount} {item.currency}
                    </div>
                    <button
                      type="button"
                      className="user-portfolio-btn user-portfolio-btn-secondary user-portfolio-btn-xs shrink-0"
                      onClick={() =>
                        setPendingDelete({
                          eventType: 'cash',
                          id: item.id,
                          message: `确认删除 ${item.eventDate} 的资金流水（${formatCashDirectionLabel(item.direction)} ${item.amount} ${item.currency}）吗？`,
                        })
                      }
                    >
                      删除
                    </button>
                  </div>
                ))}
              {eventType === 'corporate' &&
                corporateEvents.map((item) => (
                  <div key={`ca-${item.id}`} className="user-portfolio-events-row">
                    <div className="user-portfolio-events-msg">
                      {item.effectiveDate} {formatCorporateActionLabel(item.actionType)} {item.symbol}
                    </div>
                    <button
                      type="button"
                      className="user-portfolio-btn user-portfolio-btn-secondary user-portfolio-btn-xs shrink-0"
                      onClick={() =>
                        setPendingDelete({
                          eventType: 'corporate',
                          id: item.id,
                          message: `确认删除 ${item.effectiveDate} 的公司行为 ${formatCorporateActionLabel(item.actionType)}（${item.symbol}）吗？`,
                        })
                      }
                    >
                      删除
                    </button>
                  </div>
                ))}
              {!eventLoading &&
              ((eventType === 'trade' && tradeEvents.length === 0) ||
                (eventType === 'cash' && cashEvents.length === 0) ||
                (eventType === 'corporate' && corporateEvents.length === 0)) ? (
                <PortfolioEmpty title="暂无流水" description="调整筛选或先录入交易。" className="border-none bg-transparent px-3 py-6 shadow-none" />
              ) : null}
            </div>
            <div className="user-portfolio-flex-between user-portfolio-text-xs user-portfolio-muted">
              <span>
                第 {eventPage} / {totalEventPages} 页
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="user-portfolio-btn user-portfolio-btn-secondary text-xs px-3 py-1" disabled={eventPage <= 1} onClick={() => setEventPage((prev) => Math.max(1, prev - 1))}>
                  上一页
                </button>
                <button
                  type="button"
                  className="user-portfolio-btn user-portfolio-btn-secondary text-xs px-3 py-1"
                  disabled={eventPage >= totalEventPages}
                  onClick={() => setEventPage((prev) => Math.min(totalEventPages, prev + 1))}
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        </PortfolioCard>
      </section>

      <PortfolioConfirmDialog
        open={Boolean(pendingDelete)}
        title="删除流水"
        message={pendingDelete?.message || '确认删除？'}
        confirmText={deleteLoading ? '删除中...' : '确认删除'}
        cancelText="取消"
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => {
          if (!deleteLoading) setPendingDelete(null);
        }}
      />
    </div>
  );
}
