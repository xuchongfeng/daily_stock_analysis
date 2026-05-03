/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { ParsedApiError } from '../../api/error';
import { getParsedApiError } from '../../api/error';
import { portfolioApi } from '../../api/portfolio';
import {
  PortfolioApiErrorBanner,
  PortfolioCard,
  PortfolioEmpty,
  PortfolioInlineAlert,
} from '../../components/portfolio/UserPortfolioUi';
import type { PortfolioAccountItem, PortfolioCostMethod, PortfolioRiskResponse } from '../../types/portfolio';
import { formatMoney, formatPct } from './portfolioFormat';

const SEL = 'user-portfolio-input user-portfolio-select';

export function PortfolioRiskPage() {
  useEffect(() => {
    document.title = '持仓 · 风控';
  }, []);

  const params = useParams();
  const accountId = Number(params.accountId);
  const validId = Number.isFinite(accountId) && accountId > 0;

  const [accounts, setAccounts] = useState<PortfolioAccountItem[]>([]);
  const [accountsReady, setAccountsReady] = useState(false);
  const [costMethod, setCostMethod] = useState<PortfolioCostMethod>('fifo');
  const [risk, setRisk] = useState<PortfolioRiskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);

  const accountRecord = validId ? accounts.find((a) => a.id === accountId) : undefined;
  const accountMissing = validId && accountsReady && accounts.length > 0 && !accountRecord;

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

  const loadRisk = useCallback(async () => {
    if (!validId) return;
    setLoading(true);
    try {
      const data = await portfolioApi.getRisk({ accountId, costMethod });
      setRisk(data);
      setError(null);
    } catch (err) {
      setRisk(null);
      setError(getParsedApiError(err));
    } finally {
      setLoading(false);
    }
  }, [accountId, costMethod, validId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    void loadRisk();
  }, [loadRisk]);

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
        <p className="text-sm user-portfolio-muted">加载中…</p>
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
        <PortfolioInlineAlert variant="warning" title="未找到账户" message="该账户不存在或已停用。" />
        <Link to="/portfolio" className="user-portfolio-chat-link">
          ← 返回持仓首页
        </Link>
      </div>
    );
  }

  const cur = risk?.currency || accountRecord?.baseCurrency || 'CNY';
  const thresholdEntries = risk?.thresholds ? Object.entries(risk.thresholds) : [];
  const stopItems = risk?.stopLoss?.items || [];

  return (
    <div className="stack user-portfolio-page">
      <section className="card">
        <Link to={`/portfolio/account/${accountId}`} className="user-portfolio-chat-link text-sm">
          ← 持仓明细
        </Link>
        <h1 className="h1 user-portfolio-page-title mt-1">回撤与止损</h1>
        <p className="lead user-portfolio-muted" style={{ marginBottom: 0 }}>
          {accountRecord ? (
            <>
              <strong>{accountRecord.name}</strong>
              <span className="user-portfolio-muted"> #{accountId}</span>
            </>
          ) : (
            `账户 #${accountId}`
          )}
        </p>
        <div className="flex flex-wrap gap-2 items-end mt-3">
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
            onClick={() => void loadRisk()}
          >
            {loading ? '刷新中…' : '刷新'}
          </button>
          <Link className="user-portfolio-btn user-portfolio-btn-secondary text-sm" to={`/portfolio/account/${accountId}/ledger`}>
            流水录入
          </Link>
        </div>
      </section>

      {error ? <PortfolioApiErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      <PortfolioInlineAlert
        variant="info"
        className="rounded-lg px-3 py-2 text-xs shadow-none"
        title="关于阈值配置"
        message="下列阈值为服务端风险引擎当前使用的参数快照；接口暂未开放用户自定义。若需调整告警灵敏度，请联系管理员或通过后续版本的配置能力。"
      />

      <section className="user-portfolio-grid user-portfolio-risk-row">
        <PortfolioCard>
          <h3 className="text-sm font-semibold user-portfolio-strong mb-2">回撤监控</h3>
          <div className="text-xs user-portfolio-muted space-y-1">
            <div>采样点数: {risk?.drawdown?.seriesPoints ?? '—'}</div>
            <div>最大回撤: {formatPct(risk?.drawdown?.maxDrawdownPct)}</div>
            <div>当前回撤: {formatPct(risk?.drawdown?.currentDrawdownPct)}</div>
            <div>告警: {risk?.drawdown?.alert ? '是' : '否'}</div>
            <div>汇率 stale: {risk?.drawdown?.fxStale ? '是' : '否'}</div>
          </div>
        </PortfolioCard>
        <PortfolioCard>
          <h3 className="text-sm font-semibold user-portfolio-strong mb-2">止损预警汇总</h3>
          <div className="text-xs user-portfolio-muted space-y-1">
            <div>接近告警: {risk?.stopLoss?.nearAlert ? '是' : '否'}</div>
            <div>已触发标的数: {risk?.stopLoss?.triggeredCount ?? 0}</div>
            <div>接近阈值标的数: {risk?.stopLoss?.nearCount ?? 0}</div>
          </div>
        </PortfolioCard>
      </section>

      <PortfolioCard>
        <h3 className="text-sm font-semibold user-portfolio-strong mb-3">服务端阈值快照</h3>
        {thresholdEntries.length === 0 ? (
          <p className="text-xs user-portfolio-muted">暂无数据，请先刷新。</p>
        ) : (
          <ul className="text-xs user-portfolio-muted space-y-1 list-disc pl-4">
            {thresholdEntries.map(([k, v]) => (
              <li key={k}>
                <span className="user-portfolio-mono">{k}</span>：<strong>{String(v)}</strong>
              </li>
            ))}
          </ul>
        )}
      </PortfolioCard>

      <PortfolioCard>
        <h3 className="text-sm font-semibold user-portfolio-strong mb-3">止损接近 / 触发明细</h3>
        {stopItems.length === 0 ? (
          <PortfolioEmpty title="暂无明细" description="当前无接近或触发止损阈值的持仓。" className="border-none bg-transparent py-6 shadow-none" />
        ) : (
          <div className="user-portfolio-scroll-x">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-2">代码</th>
                  <th className="text-right py-2 pr-2">均价</th>
                  <th className="text-right py-2 pr-2">现价</th>
                  <th className="text-right py-2 pr-2">亏损%</th>
                  <th className="text-right py-2 pr-2">接近线%</th>
                  <th className="text-center py-2">已触发</th>
                </tr>
              </thead>
              <tbody>
                {stopItems.map((row) => (
                  <tr key={`${row.accountId}-${row.symbol}`}>
                    <td className="py-2 pr-2 user-portfolio-mono">{row.symbol}</td>
                    <td className="py-2 pr-2 text-right">{formatMoney(row.avgCost, cur)}</td>
                    <td className="py-2 pr-2 text-right">{formatMoney(row.lastPrice, cur)}</td>
                    <td className="py-2 pr-2 text-right">{formatPct(row.lossPct)}</td>
                    <td className="py-2 pr-2 text-right">{formatPct(row.nearThresholdPct)}</td>
                    <td className="py-2 text-center">{row.isTriggered ? '是' : '否'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PortfolioCard>
    </div>
  );
}
