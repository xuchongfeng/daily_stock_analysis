import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { discoverIndustryChainApi, stocksImportApi } from '../api/discoverIndustryChain';
import { getParsedApiError } from '../api/error';
import type { ParsedApiError } from '../api/error';
import { PortfolioApiErrorBanner } from '../components/portfolio/UserPortfolioUi';
import type { IndustryChainStock } from '../types/discoverIndustryChain';

const EMPTY_FORM = {
  name: '',
  slug: '',
  introduction: '',
  latestNews: '',
  market: 'cn',
  status: 'active',
  sortOrder: 0,
};

function mergeImportedStocks(existing: IndustryChainStock[], imported: IndustryChainStock[]): IndustryChainStock[] {
  const map = new Map<string, IndustryChainStock>();
  existing.forEach((s, idx) => {
    if (s.stockCode) map.set(s.stockCode, { ...s, sortOrder: s.sortOrder ?? idx });
  });
  imported.forEach((s, idx) => {
    if (!s.stockCode) return;
    const prev = map.get(s.stockCode);
    map.set(s.stockCode, {
      stockCode: s.stockCode,
      stockName: s.stockName || prev?.stockName || null,
      role: prev?.role || s.role || null,
      sortOrder: prev?.sortOrder ?? existing.length + idx,
    });
  });
  return Array.from(map.values()).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function DiscoverIndustryChainEditPage() {
  const location = useLocation();
  const { slug = '' } = useParams<{ slug: string }>();
  /** 静态路由 chains/new 不会注入 slug，需结合 pathname 判断 */
  const isNew = slug === 'new' || location.pathname.replace(/\/$/, '').endsWith('/chains/new');
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [stocks, setStocks] = useState<IndustryChainStock[]>([]);
  const [importText, setImportText] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<ParsedApiError | null>(null);
  const [importHint, setImportHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isNew) {
      setLoading(false);
      return;
    }
    const key = slug.trim();
    if (!key) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await discoverIndustryChainApi.getDetail(key);
      setForm({
        name: d.name,
        slug: d.slug,
        introduction: d.introduction ?? '',
        latestNews: d.latestNews ?? '',
        market: d.market ?? 'cn',
        status: d.status ?? 'active',
        sortOrder: d.sortOrder ?? 0,
      });
      setStocks(d.coreStocks ?? []);
    } catch (e) {
      setError(getParsedApiError(e));
    } finally {
      setLoading(false);
    }
  }, [isNew, slug]);

  useEffect(() => {
    document.title = isNew ? '新增产业链' : '编辑产业链';
  }, [isNew]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const handleImportText = async () => {
    const text = importText.trim();
    if (!text) {
      setImportHint('请先粘贴代码列表或 CSV 内容');
      return;
    }
    setImporting(true);
    setImportHint(null);
    setError(null);
    try {
      const res = await stocksImportApi.parseText(text);
      const imported: IndustryChainStock[] = (res.items ?? [])
        .filter((it) => it.code)
        .map((it, idx) => ({
          stockCode: String(it.code),
          stockName: it.name ?? null,
          sortOrder: stocks.length + idx,
        }));
      if (imported.length === 0) {
        setImportHint('未解析到有效股票代码');
        return;
      }
      setStocks((prev) => mergeImportedStocks(prev, imported));
      setImportHint(`已导入 ${imported.length} 只股票（重复代码已合并）`);
      setImportText('');
    } catch (e) {
      setError(getParsedApiError(e));
    } finally {
      setImporting(false);
    }
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    setImportHint(null);
    setError(null);
    try {
      const res = await stocksImportApi.parseFile(file);
      const imported: IndustryChainStock[] = (res.items ?? [])
        .filter((it) => it.code)
        .map((it, idx) => ({
          stockCode: String(it.code),
          stockName: it.name ?? null,
          sortOrder: stocks.length + idx,
        }));
      if (imported.length === 0) {
        setImportHint('文件中未解析到有效股票代码');
        return;
      }
      setStocks((prev) => mergeImportedStocks(prev, imported));
      setImportHint(`已从文件导入 ${imported.length} 只股票`);
    } catch (e) {
      setError(getParsedApiError(e));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateStock = (index: number, patch: Partial<IndustryChainStock>) => {
    setStocks((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const removeStock = (index: number) => {
    setStocks((prev) => prev.filter((_, i) => i !== index));
  };

  const addEmptyStock = () => {
    setStocks((prev) => [...prev, { stockCode: '', stockName: '', role: '', sortOrder: prev.length }]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError(getParsedApiError(new Error('请填写产业链名称')));
      return;
    }
    const payload = {
      name,
      slug: form.slug.trim() || undefined,
      introduction: form.introduction.trim(),
      latestNews: form.latestNews.trim(),
      market: form.market as 'cn' | 'hk' | 'us' | 'all',
      status: form.status as 'active' | 'archived',
      sortOrder: Number(form.sortOrder) || 0,
      coreStocks: stocks
        .map((s, idx) => ({
          ...s,
          stockCode: s.stockCode.trim(),
          sortOrder: idx,
        }))
        .filter((s) => s.stockCode),
    };
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const res = await discoverIndustryChainApi.create(payload);
        navigate(`/discover/chains/${encodeURIComponent(res.item.slug)}`, { replace: true });
      } else {
        await discoverIndustryChainApi.update(slug, payload);
        navigate(`/discover/chains/${encodeURIComponent(slug)}`, { replace: true });
      }
    } catch (err) {
      setError(getParsedApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="stack discover-chain-page">
        <section className="card">
          <p className="today-muted">加载中…</p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack discover-chain-page discover-chain-edit-page">
      <section className="card">
        <Link
          to={isNew ? '/discover/chains' : `/discover/chains/${encodeURIComponent(slug)}`}
          className="user-portfolio-chat-link discover-sector-back-link"
        >
          ← 返回
        </Link>
        <h1 className="h1 discover-sector-page-title">{isNew ? '新增核心产业链' : '编辑核心产业链'}</h1>
        <p className="lead today-muted discover-sector-lead">
          填写名称、介绍与最新进展；核心个股可手工添加，或通过 CSV / 文本批量导入（复用系统股票解析接口）。
        </p>
      </section>

      {error ? <PortfolioApiErrorBanner error={error} onDismiss={() => setError(null)} /> : null}

      <form className="card discover-chain-form" onSubmit={(ev) => void handleSubmit(ev)}>
        <div className="discover-chain-form-grid">
          <label className="discover-chain-field">
            <span>名称 *</span>
            <input
              className="discover-chain-input"
              value={form.name}
              onChange={(ev) => setForm((f) => ({ ...f, name: ev.target.value }))}
              required
              maxLength={256}
            />
          </label>
          <label className="discover-chain-field">
            <span>URL 标识（slug，可选）</span>
            <input
              className="discover-chain-input mono"
              value={form.slug}
              onChange={(ev) => setForm((f) => ({ ...f, slug: ev.target.value }))}
              placeholder="留空则自动生成"
              disabled={!isNew}
            />
          </label>
          <label className="discover-chain-field wide">
            <span>介绍</span>
            <textarea
              className="discover-chain-textarea"
              rows={4}
              value={form.introduction}
              onChange={(ev) => setForm((f) => ({ ...f, introduction: ev.target.value }))}
            />
          </label>
          <label className="discover-chain-field wide">
            <span>最新新闻 / 进展</span>
            <textarea
              className="discover-chain-textarea"
              rows={3}
              value={form.latestNews}
              onChange={(ev) => setForm((f) => ({ ...f, latestNews: ev.target.value }))}
            />
          </label>
          <label className="discover-chain-field">
            <span>市场</span>
            <select
              className="discover-chain-input"
              value={form.market}
              onChange={(ev) => setForm((f) => ({ ...f, market: ev.target.value }))}
            >
              <option value="cn">A 股</option>
              <option value="hk">港股</option>
              <option value="us">美股</option>
              <option value="all">全部</option>
            </select>
          </label>
          <label className="discover-chain-field">
            <span>排序权重</span>
            <input
              className="discover-chain-input"
              type="number"
              min={0}
              max={9999}
              value={form.sortOrder}
              onChange={(ev) => setForm((f) => ({ ...f, sortOrder: Number(ev.target.value) }))}
            />
          </label>
        </div>

        <section className="discover-chain-stocks-section">
          <div className="discover-chain-stocks-head">
            <h2 className="h2 discover-hot-h2">核心个股</h2>
            <button type="button" className="discover-chain-add-btn discover-chain-add-btn-secondary" onClick={addEmptyStock}>
              + 添加一行
            </button>
          </div>

          <div className="discover-chain-import-box">
            <h3 className="discover-chain-import-title">批量导入</h3>
            <p className="today-muted text-sm">
              支持粘贴代码列表、CSV（含 code/股票代码 列）或上传 CSV/Excel；与设置页智能导入同源解析。
            </p>
            <textarea
              className="discover-chain-textarea"
              rows={3}
              placeholder={'600519,贵州茅台\n00700 腾讯控股'}
              value={importText}
              onChange={(ev) => setImportText(ev.target.value)}
            />
            <div className="discover-chain-import-actions">
              <button
                type="button"
                className="discover-chain-add-btn discover-chain-add-btn-secondary"
                disabled={importing}
                onClick={() => void handleImportText()}
              >
                {importing ? '解析中…' : '解析并导入'}
              </button>
              <label className="discover-chain-file-btn">
                选择 CSV/Excel
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  className="discover-chain-file-input"
                  onChange={(ev) => void handleImportFile(ev.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            {importHint ? <p className="discover-chain-import-hint">{importHint}</p> : null}
          </div>

          {stocks.length === 0 ? (
            <p className="today-muted">尚未添加核心个股，可手工添加或使用上方导入。</p>
          ) : (
            <div className="discover-chain-stock-table-wrap">
              <table className="discover-chain-stock-table discover-chain-stock-table-edit">
                <thead>
                  <tr>
                    <th>代码</th>
                    <th>名称</th>
                    <th>定位（龙头/配套等）</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((s, idx) => (
                    <tr key={`${s.stockCode}-${idx}`}>
                      <td>
                        <input
                          className="discover-chain-input mono"
                          value={s.stockCode}
                          onChange={(ev) => updateStock(idx, { stockCode: ev.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="discover-chain-input"
                          value={s.stockName ?? ''}
                          onChange={(ev) => updateStock(idx, { stockName: ev.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="discover-chain-input"
                          value={s.role ?? ''}
                          onChange={(ev) => updateStock(idx, { role: ev.target.value })}
                        />
                      </td>
                      <td>
                        <button type="button" className="discover-chain-row-remove" onClick={() => removeStock(idx)}>
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="discover-chain-form-actions">
          <button type="submit" className="discover-chain-add-btn" disabled={saving}>
            {saving ? '保存中…' : isNew ? '创建' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
