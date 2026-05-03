/* eslint-disable react-hooks/set-state-in-effect -- mount 拉取与 Web 持仓一致 */
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import type { ParsedApiError } from '../../api/error';
import { getParsedApiError } from '../../api/error';
import { portfolioApi } from '../../api/portfolio';
import {
  PortfolioApiErrorBanner,
  PortfolioCard,
  PortfolioInlineAlert,
} from '../../components/portfolio/UserPortfolioUi';
import type { PortfolioAccountItem, PortfolioCostMethod, PortfolioSnapshotResponse } from '../../types/portfolio';
import { formatMoney } from './portfolioFormat';
import { getPortfolioAccountPrefs, setPortfolioAccountPrefs } from './portfolioAccountPrefs';

const SEL = 'user-portfolio-input user-portfolio-select';

export function PortfolioHubPage() {
  useEffect(() => {
    document.title = '持仓';
  }, []);

  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<PortfolioAccountItem[]>([]);
  const [costMethod, setCostMethod] = useState<PortfolioCostMethod>('fifo');
  const [snapshot, setSnapshot] = useState<PortfolioSnapshotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);

  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [accountCreating, setAccountCreating] = useState(false);
  const [accountCreateError, setAccountCreateError] = useState<string | null>(null);
  const [accountCreateSuccess, setAccountCreateSuccess] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState({
    name: '',
    broker: 'Demo',
    market: 'cn' as 'cn' | 'hk' | 'us',
    baseCurrency: 'CNY',
  });

  /** 本地偏好变更后触发账户行重渲染 */
  const [prefsTick, setPrefsTick] = useState(0);

  const loadAccounts = useCallback(async () => {
    try {
      const response = await portfolioApi.getAccounts(false);
      const items = response.accounts || [];
      setAccounts(items);
      if (items.length === 0) setShowCreateAccount(true);
    } catch (err) {
      setError(getParsedApiError(err));
    }
  }, []);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portfolioApi.getSnapshot({ costMethod });
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setSnapshot(null);
      setError(getParsedApiError(err));
    } finally {
      setLoading(false);
    }
  }, [costMethod]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const accountRows = useMemo(() => snapshot?.accounts || [], [snapshot]);
  const hubRows = accountRows.map((row) => ({
    row,
    prefs: getPortfolioAccountPrefs(row.accountId),
  }));
  const currency = snapshot?.currency || 'CNY';
  const hasAccounts = accounts.length > 0;

  const handleCreateAccount = async (e: FormEvent) => {
    e.preventDefault();
    const name = accountForm.name.trim();
    if (!name) {
      setAccountCreateError('账户名称不能为空。');
      setAccountCreateSuccess(null);
      return;
    }
    try {
      setAccountCreating(true);
      setAccountCreateError(null);
      setAccountCreateSuccess(null);
      const created = await portfolioApi.createAccount({
        name,
        broker: accountForm.broker.trim() || undefined,
        market: accountForm.market,
        baseCurrency: accountForm.baseCurrency.trim() || 'CNY',
      });
      await loadAccounts();
      setShowCreateAccount(false);
      setAccountForm((prev) => ({ ...prev, name: '' }));
      setAccountCreateSuccess(`账户「${created.name}」已创建。`);
      navigate(`/portfolio/account/${created.id}`);
    } catch (err) {
      const parsed = getParsedApiError(err);
      setAccountCreateError(parsed.message || '创建账户失败，请稍后重试。');
      setAccountCreateSuccess(null);
    } finally {
      setAccountCreating(false);
    }
  };

  const bumpPrefs = (accountId: number, patch: Parameters<typeof setPortfolioAccountPrefs>[1]) => {
    setPortfolioAccountPrefs(accountId, patch);
    setPrefsTick((t) => t + 1);
  };

  return (
    <div className="stack user-portfolio-page">
      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="h1 user-portfolio-page-title">持仓</h1>
            <p className="lead user-portfolio-muted" style={{ marginBottom: 0 }}>
              按账户查看总市值与盈亏；点一行进入持仓明细。流水录入与回撤/止损请在子页操作。
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <p className="text-xs user-portfolio-muted mb-1">成本口径</p>
              <select
                className={SEL}
                value={costMethod}
                onChange={(e) => setCostMethod(e.target.value as PortfolioCostMethod)}
              >
                <option value="fifo">FIFO</option>
                <option value="avg">均价</option>
              </select>
            </div>
            <button
              type="button"
              className="user-portfolio-btn user-portfolio-btn-secondary text-sm"
              disabled={loading}
              onClick={() => void Promise.all([loadAccounts(), loadSnapshot()])}
            >
              {loading ? '刷新中…' : '刷新'}
            </button>
            <button
              type="button"
              className="user-portfolio-btn user-portfolio-btn-secondary text-sm"
              onClick={() => {
                setShowCreateAccount((v) => !v);
                setAccountCreateError(null);
              }}
            >
              {showCreateAccount ? '收起新建' : '新建账户'}
            </button>
          </div>
        </div>
      </section>

      {error ? <PortfolioApiErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      {(showCreateAccount || !hasAccounts) && (
        <PortfolioCard>
          <h2 className="text-sm font-semibold user-portfolio-strong">新建账户</h2>
          {accountCreateError ? (
            <PortfolioInlineAlert variant="danger" className="mt-2 text-xs" title="失败" message={accountCreateError} />
          ) : null}
          {accountCreateSuccess ? (
            <PortfolioInlineAlert variant="success" className="mt-2 text-xs" title="成功" message={accountCreateSuccess} />
          ) : null}
          <form className="mt-3 user-portfolio-grid user-portfolio-form-grid" onSubmit={handleCreateAccount}>
            <input
              className="user-portfolio-input md:col-span-2"
              placeholder="账户名称"
              value={accountForm.name}
              onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              className="user-portfolio-input"
              placeholder="券商（可选）"
              value={accountForm.broker}
              onChange={(e) => setAccountForm((p) => ({ ...p, broker: e.target.value }))}
            />
            <input
              className="user-portfolio-input"
              placeholder="基准币"
              value={accountForm.baseCurrency}
              onChange={(e) => setAccountForm((p) => ({ ...p, baseCurrency: e.target.value.toUpperCase() }))}
            />
            <select
              className={SEL}
              value={accountForm.market}
              onChange={(e) => setAccountForm((p) => ({ ...p, market: e.target.value as 'cn' | 'hk' | 'us' }))}
            >
              <option value="cn">A 股</option>
              <option value="hk">港股</option>
              <option value="us">美股</option>
            </select>
            <button type="submit" className="user-portfolio-btn user-portfolio-btn-secondary text-sm" disabled={accountCreating}>
              {accountCreating ? '创建中…' : '创建'}
            </button>
          </form>
        </PortfolioCard>
      )}

      <PortfolioCard>
        <div className="flex flex-wrap justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold user-portfolio-strong">账户一览</h2>
          <span className="text-xs user-portfolio-muted">
            合并计价 {currency} · {loading ? '加载中…' : `共 ${accountRows.length} 个账户`}
          </span>
        </div>
        {accountRows.length === 0 && !loading ? (
          <p className="text-sm user-portfolio-muted">暂无快照数据，请先创建账户并在「流水」中录入交易。</p>
        ) : (
          <div className="user-portfolio-scroll-x">
            <table className="w-full text-sm user-portfolio-hub-table">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-2">账户</th>
                  <th className="text-right py-2 pr-2">总市值</th>
                  <th className="text-right py-2 pr-2">持仓股数</th>
                  <th className="text-right py-2 pr-2">浮动盈亏</th>
                  <th className="text-right py-2 pr-2">已实现</th>
                  <th className="text-center py-2 pr-2">体检分析</th>
                  <th className="text-center py-2 pr-2">分析推送</th>
                  <th className="text-left py-2">操作</th>
                </tr>
              </thead>
              <tbody key={prefsTick}>
                {hubRows.map(({ row, prefs }) => {
                  const posCount = (row.positions || []).filter((p) => Number(p.quantity) > 0).length;
                  return (
                    <tr
                      key={row.accountId}
                      className="user-portfolio-hub-row"
                      onClick={() => navigate(`/portfolio/account/${row.accountId}`)}
                    >
                      <td className="py-2 pr-2 user-portfolio-strong">
                        {row.accountName}
                        <span className="user-portfolio-muted text-xs font-normal"> #{row.accountId}</span>
                      </td>
                      <td className="py-2 pr-2 text-right">{formatMoney(row.totalMarketValue, currency)}</td>
                      <td className="py-2 pr-2 text-right">{posCount}</td>
                      <td
                        className={`py-2 pr-2 text-right ${row.unrealizedPnl >= 0 ? 'user-portfolio-pos-pnl-pos' : 'user-portfolio-pos-pnl-neg'}`}
                      >
                        {formatMoney(row.unrealizedPnl, currency)}
                      </td>
                      <td className="py-2 pr-2 text-right user-portfolio-muted">{formatMoney(row.realizedPnl, currency)}</td>
                      <td className="py-2 pr-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={prefs.enableBatchCheckup}
                          aria-label="参与批量体检"
                          onChange={(e) => bumpPrefs(row.accountId, { enableBatchCheckup: e.target.checked })}
                        />
                      </td>
                      <td className="py-2 pr-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={prefs.dailyAnalysisNotify}
                          aria-label="批量分析推送通知"
                          onChange={(e) => bumpPrefs(row.accountId, { dailyAnalysisNotify: e.target.checked })}
                        />
                      </td>
                      <td className="py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-2">
                          <Link className="user-portfolio-chat-link text-xs" to={`/portfolio/account/${row.accountId}/ledger`}>
                            流水
                          </Link>
                          <Link className="user-portfolio-chat-link text-xs" to={`/portfolio/account/${row.accountId}/risk`}>
                            风控
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs user-portfolio-muted mt-3">
          「体检分析」「分析推送」为本地偏好：明细页发起批量体检时，若开启推送则 analysis 任务带 notify；阈值类风控由服务端计算，详见「风控」页。
        </p>
      </PortfolioCard>
    </div>
  );
}
