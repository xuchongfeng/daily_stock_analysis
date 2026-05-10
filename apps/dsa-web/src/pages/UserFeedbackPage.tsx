import type React from 'react';
import { useEffect, useState } from 'react';

import { fetchUserFeedbackList, type UserFeedbackItem } from '../api/userFeedback';
import { getParsedApiError, type ParsedApiError } from '../api/error';
import { ApiErrorAlert, Button, EmptyState } from '../components/common';

function shortenUa(ua: string | null, max = 72): string {
  if (!ua) return '—';
  const s = ua.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

const UserFeedbackPage: React.FC = () => {
  const [items, setItems] = useState<UserFeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ParsedApiError | null>(null);

  useEffect(() => {
    document.title = '用户反馈 - DSA';
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchUserFeedbackList({ page, limit });
        if (!cancelled) {
          setItems(res.items);
          setTotal(res.total);
        }
      } catch (e) {
        if (!cancelled) {
          setError(getParsedApiError(e));
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, limit]);

  const maxPage = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">用户反馈</h1>
        <p className="mt-1 text-sm text-secondary-text">来自 C 端站点「意见反馈」入口的提交，按时间倒序。</p>
      </header>

      {error ? (
        <div className="mb-4">
          <ApiErrorAlert error={error} />
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-secondary-text">加载中…</p>
      ) : items.length === 0 && !error ? (
        <EmptyState title="暂无反馈" description="用户提交后会显示在这里。" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card/50 shadow-soft-card">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-base/50 text-xs font-semibold uppercase tracking-wide text-secondary-text">
                  <th className="px-3 py-2.5">时间</th>
                  <th className="px-3 py-2.5">内容</th>
                  <th className="px-3 py-2.5">联系方式</th>
                  <th className="px-3 py-2.5">用户 ID</th>
                  <th className="px-3 py-2.5">注册邮箱</th>
                  <th className="px-3 py-2.5">页面</th>
                  <th className="px-3 py-2.5">UA</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 align-top last:border-0">
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-secondary-text mono">
                      {row.created_at ? row.created_at.replace('T', ' ').slice(0, 19) : '—'}
                    </td>
                    <td className="max-w-md px-3 py-2.5 text-foreground">
                      <span className="whitespace-pre-wrap break-words">{row.message}</span>
                    </td>
                    <td className="px-3 py-2.5 text-secondary-text">{row.contact || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs mono text-secondary-text">
                      {row.portal_user_id != null ? `#${row.portal_user_id}` : '—'}
                    </td>
                    <td className="max-w-[200px] break-all px-3 py-2.5 text-xs text-secondary-text" title={row.portal_email || ''}>
                      {row.portal_email?.trim() ? row.portal_email : '—'}
                    </td>
                    <td className="max-w-[180px] px-3 py-2.5 text-xs text-secondary-text">
                      <span className="break-all" title={row.page_url || ''}>
                        {row.page_url || '—'}
                      </span>
                    </td>
                    <td className="max-w-[200px] px-3 py-2.5 text-xs text-secondary-text" title={row.user_agent || ''}>
                      {shortenUa(row.user_agent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > limit ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-secondary-text">
                共 {total} 条 · 第 {page} / {maxPage} 页
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page >= maxPage}
                  onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                >
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default UserFeedbackPage;
