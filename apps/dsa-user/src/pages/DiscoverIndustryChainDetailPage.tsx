import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { discoverIndustryChainApi } from '../api/discoverIndustryChain';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import { useAuth } from '../auth/AuthContext';
import { PortfolioApiErrorBanner } from '../components/portfolio/UserPortfolioUi';
import type { IndustryChainDetail } from '../types/discoverIndustryChain';
import { xueqiuStockHref } from '../utils/xueqiuStockHref';

export function DiscoverIndustryChainDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { status } = useAuth();
  const isAdmin = Boolean(status?.loggedIn);
  const [detail, setDetail] = useState<IndustryChainDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const key = slug.trim();
    if (!key) return;
    setLoading(true);
    setError(null);
    try {
      const d = await discoverIndustryChainApi.getDetail(key);
      setDetail(d);
    } catch (e) {
      setError(getParsedApiError(e));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    document.title = detail?.name ? `${detail.name} · 产业链` : '核心产业链';
  }, [detail?.name]);

  const handleDelete = async () => {
    if (!detail?.slug) return;
    if (!window.confirm(`确定删除「${detail.name}」？此操作不可撤销。`)) return;
    setDeleting(true);
    setError(null);
    try {
      await discoverIndustryChainApi.remove(detail.slug);
      navigate('/discover/chains', { replace: true });
    } catch (e) {
      setError(getParsedApiError(e));
    } finally {
      setDeleting(false);
    }
  };

  const stocks = detail?.coreStocks ?? [];

  return (
    <div className="stack discover-chain-page discover-chain-detail-page">
      <section className="card">
        <Link to="/discover/chains" className="user-portfolio-chat-link discover-sector-back-link">
          ← 产业链列表
        </Link>
        {loading ? <p className="today-muted">加载中…</p> : null}
        {!loading && detail ? (
          <>
            <div className="discover-chain-detail-head">
              <div>
                <h1 className="h1 discover-sector-page-title">{detail.name}</h1>
                <p className="discover-hot-meta">
                  <span className="mono">{detail.market ?? 'cn'}</span>
                  {detail.updatedAt ? (
                    <>
                      {' '}
                      · 更新 <span className="mono">{detail.updatedAt.slice(0, 10)}</span>
                    </>
                  ) : null}
                </p>
              </div>
              {isAdmin ? (
                <div className="discover-chain-detail-actions">
                  <Link
                    to={`/discover/chains/${encodeURIComponent(detail.slug)}/edit`}
                    className="discover-chain-add-btn discover-chain-add-btn-secondary"
                  >
                    编辑
                  </Link>
                  <button
                    type="button"
                    className="discover-chain-delete-btn"
                    disabled={deleting}
                    onClick={() => void handleDelete()}
                  >
                    {deleting ? '删除中…' : '删除'}
                  </button>
                </div>
              ) : null}
            </div>
            {detail.introduction ? (
              <section className="discover-hot-section">
                <h2 className="h2 discover-hot-h2">产业链介绍</h2>
                <p className="discover-chain-prose">{detail.introduction}</p>
              </section>
            ) : null}
            {detail.latestNews ? (
              <section className="discover-hot-section">
                <h2 className="h2 discover-hot-h2">最新新闻 / 进展</h2>
                <p className="discover-chain-prose discover-chain-news">{detail.latestNews}</p>
              </section>
            ) : null}
          </>
        ) : null}
      </section>

      {error ? <PortfolioApiErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      {!loading && detail ? (
        <section className="card discover-hot-section">
          <h2 className="h2 discover-hot-h2">核心个股（{stocks.length}）</h2>
          {stocks.length === 0 ? (
            <p className="today-muted">暂无核心个股。</p>
          ) : (
            <div className="discover-chain-stock-table-wrap">
              <table className="discover-chain-stock-table">
                <thead>
                  <tr>
                    <th>代码</th>
                    <th>名称</th>
                    <th>定位</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((s) => {
                    const href = xueqiuStockHref(s.stockCode);
                    return (
                      <tr key={s.stockCode}>
                        <td className="mono">{s.stockCode}</td>
                        <td>
                          {href && s.stockName ? (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="today-link-stock">
                              {s.stockName}
                            </a>
                          ) : (
                            s.stockName || '—'
                          )}
                        </td>
                        <td>{s.role || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
