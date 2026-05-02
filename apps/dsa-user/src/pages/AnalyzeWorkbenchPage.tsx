import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';

import { AddToWatchlistCompact } from '../components/AddToWatchlistCompact';
import { WorkbenchReportDetailPanel } from '../components/WorkbenchReportDetailPanel';
import { WorkbenchStockAutocomplete } from '../components/WorkbenchStockAutocomplete';
import { formatParsedApiError, getParsedApiError } from '../api/error';
import { workbenchHistoryApi } from '../api/workbenchHistory';
import { useWorkbenchDashboardLifecycle } from '../hooks/useWorkbenchDashboardLifecycle';
import { useWorkbenchDashboardState } from '../hooks/useWorkbenchDashboardState';
import { formatReportTypeWorkbench, formatWorkbenchDateTime } from '../utils/workbenchFormat';
import type { HistoryItem } from '../types/workbenchAnalysis';
import type { ParsedApiError } from '../api/error';

function sentimentTone(score: number | undefined): 'neg' | 'mid' | 'pos' | 'none' {
  if (score === undefined || score === null || Number.isNaN(Number(score))) return 'none';
  const s = Number(score);
  if (s <= 40) return 'neg';
  if (s <= 60) return 'mid';
  return 'pos';
}

function WorkbenchBanner({ parsed, onDismiss }: { parsed: ParsedApiError; onDismiss?: () => void }) {
  return (
    <div className="workbench-banner workbench-banner-danger" role="alert">
      <div className="workbench-banner-body">
        <strong>{parsed.title}</strong>
        <p>{parsed.message}</p>
      </div>
      {onDismiss ? (
        <button type="button" className="workbench-banner-dismiss" onClick={onDismiss}>
          关闭
        </button>
      ) : null}
    </div>
  );
}

export function AnalyzeWorkbenchPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [markdownLoading, setMarkdownLoading] = useState(false);
  const [markdownText, setMarkdownText] = useState<string | null>(null);
  const listFilterDebounceSkipRef = useRef(true);

  const {
    query,
    inputError,
    duplicateError,
    error,
    isAnalyzing,
    historyItems,
    selectedHistoryIds,
    isDeletingHistory,
    isLoadingHistory,
    isLoadingMore,
    hasMore,
    selectedReport,
    isLoadingReport,
    activeTasks,
    markdownDrawerOpen,
    historyListFilterQ,
    setQuery,
    clearError,
    loadInitialHistory,
    refreshHistory,
    loadMoreHistory,
    selectHistoryItem,
    toggleHistorySelection,
    toggleSelectAllVisible,
    deleteSelectedHistory,
    submitAnalysis,
    notify,
    setNotify,
    syncTaskCreated,
    syncTaskUpdated,
    syncTaskFailed,
    removeTask,
    openMarkdownDrawer,
    closeMarkdownDrawer,
    selectedIds,
    setHistoryListFilterQ,
  } = useWorkbenchDashboardState();

  useEffect(() => {
    if (listFilterDebounceSkipRef.current) {
      listFilterDebounceSkipRef.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      void refreshHistory(false);
    }, 380);
    return () => window.clearTimeout(t);
  }, [historyListFilterQ, refreshHistory]);

  useWorkbenchDashboardLifecycle({
    loadInitialHistory,
    refreshHistory,
    syncTaskCreated,
    syncTaskUpdated,
    syncTaskFailed,
    removeTask,
    enabled: true,
  });

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (!markdownDrawerOpen || !selectedReport?.meta?.id) {
        setMarkdownText(null);
        return;
      }
      setMarkdownLoading(true);
      void workbenchHistoryApi
        .getMarkdown(selectedReport.meta.id as number)
        .then((md) => {
          if (!cancelled) setMarkdownText(md || '');
        })
        .catch((e) => {
          if (!cancelled) setMarkdownText(`加载失败：${formatParsedApiError(getParsedApiError(e))}`);
        })
        .finally(() => {
          if (!cancelled) setMarkdownLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [markdownDrawerOpen, selectedReport?.meta?.id]);

  const handleSubmit = useCallback(() => {
    void submitAnalysis();
  }, [submitAnalysis]);

  const handleStockQuerySubmit = useCallback(
    (code: string, name?: string, source?: 'manual' | 'autocomplete') => {
      if (source === 'autocomplete') {
        void submitAnalysis({
          stockCode: code,
          stockName: name,
          selectionSource: 'autocomplete',
        });
        return;
      }
      void submitAnalysis({ selectionSource: 'manual' });
    },
    [submitAnalysis],
  );

  const handleAskFollowUp = useCallback(() => {
    if (selectedReport?.meta.id === undefined) return;
    const code = selectedReport.meta.stockCode;
    const name = selectedReport.meta.stockName;
    const rid = selectedReport.meta.id;
    const qs = new URLSearchParams({
      tab: 'chat',
      stock: code,
      name: name ?? '',
      recordId: String(rid),
    });
    navigate(`/chat?${qs.toString()}`);
  }, [navigate, selectedReport]);

  const sidebarInner = (
    <div className="workbench-side-inner">
      <section className="workbench-panel">
        <header className="workbench-panel-head">分析任务</header>
        <div className="workbench-panel-body">
          {activeTasks.length === 0 ? (
            <p className="today-muted workbench-muted">暂无进行中的异步分析</p>
          ) : (
            <ul className="workbench-task-list">
              {activeTasks.map((t) => {
                const p = Math.max(0, Math.min(100, t.progress ?? 0));
                const label = t.status === 'processing' ? '分析中' : '等待中';
                return (
                  <li key={t.taskId} className="workbench-task-item">
                    <div className="workbench-task-top">
                      <span className="workbench-task-name">{t.stockName || t.stockCode}</span>
                      <span className="workbench-task-badge">{label}</span>
                    </div>
                    <span className="mono workbench-task-code">{t.stockCode}</span>
                    {t.message ? <p className="workbench-task-msg">{t.message}</p> : null}
                    <div className="workbench-progress">
                      <div className="workbench-progress-fill" style={{ width: `${p}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="workbench-panel workbench-history-panel">
        <header className="workbench-panel-head workbench-history-head">
          <span>股票列表</span>
          {historyItems.length > 0 ? (
            <label className="workbench-history-selectall">
              <input
                type="checkbox"
                checked={historyItems.length > 0 && historyItems.every((h) => selectedIds.has(h.id))}
                ref={(el) => {
                  if (el) el.indeterminate = historyItems.some((h) => selectedIds.has(h.id)) && !historyItems.every((h) => selectedIds.has(h.id));
                }}
                onChange={() => toggleSelectAllVisible()}
              />
              全选
            </label>
          ) : null}
        </header>
        <div className="workbench-list-scope-bar">
          <label className="workbench-list-filter">
            <span className="workbench-list-filter-label">搜索</span>
            <input
              type="search"
              className="workbench-list-filter-input"
              placeholder="代码或名称"
              value={historyListFilterQ}
              onChange={(e) => setHistoryListFilterQ(e.target.value)}
              enterKeyHint="search"
              autoComplete="off"
            />
          </label>
          <p className="workbench-list-scope-note">仅展示当前登录账号在本站发起的分析（未登录时列表为空）。</p>
        </div>
        <div className="workbench-panel-body workbench-history-body">
          {isLoadingHistory && historyItems.length === 0 ? (
            <p className="today-muted workbench-muted">加载历史...</p>
          ) : historyItems.length === 0 ? (
            <p className="today-muted workbench-muted">暂无历史记录</p>
          ) : (
            <ul className="workbench-history-list">
              {historyItems.map((h: HistoryItem) => {
                const active = selectedReport?.meta.id === h.id;
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      className={active ? 'workbench-history-row is-active' : 'workbench-history-row'}
                      onClick={() => void selectHistoryItem(h.id)}
                    >
                      <span
                        className="workbench-history-check"
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          toggleHistorySelection(h.id);
                        }}
                        role="presentation"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(h.id)}
                          onChange={() => toggleHistorySelection(h.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`选择 ${h.stockCode}`}
                        />
                      </span>
                      <span className="workbench-history-main">
                        <span className="workbench-history-title">{h.stockName || h.stockCode}</span>
                        <span className="mono workbench-history-sub">{h.stockCode}</span>
                        <span className="workbench-history-meta">{formatWorkbenchDateTime(h.createdAt)}</span>
                      </span>
                      {typeof h.sentimentScore === 'number' ? (
                        <span className={`workbench-score workbench-score-${sentimentTone(h.sentimentScore)}`}>
                          {h.sentimentScore}
                        </span>
                      ) : (
                        <span className="workbench-score-none">—</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {historyItems.length > 0 ? (
            <div className="workbench-history-footer">
              {selectedHistoryIds.length > 0 ? (
                <button
                  type="button"
                  className="workbench-btn-danger"
                  disabled={isDeletingHistory}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  {isDeletingHistory ? '删除中…' : `删除所选 (${selectedHistoryIds.length})`}
                </button>
              ) : null}
              {hasMore ? (
                <button
                  type="button"
                  className="workbench-btn-ghost"
                  disabled={isLoadingMore}
                  onClick={() => void loadMoreHistory()}
                >
                  {isLoadingMore ? '加载中…' : '加载更多'}
                </button>
              ) : (
                <span className="today-muted workbench-end-hint">已加载全部</span>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );

  const reportLangZh = selectedReport?.meta.reportLanguage !== 'en';

  return (
    <div className="workbench-page">
      <header className="workbench-toolbar card">
        <button
          type="button"
          className="workbench-drawer-trigger"
          aria-label="历史与任务"
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>
        <WorkbenchStockAutocomplete
          value={query}
          onChange={setQuery}
          onSubmit={(code, name, src) => {
            if (!isAnalyzing) handleStockQuerySubmit(code, name, src);
          }}
          disabled={isAnalyzing}
          placeholder="输入股票代码或名称，如 600519、贵州茅台、AAPL"
          className="workbench-query-input"
        />
        <label className="workbench-notify">
          <input type="checkbox" checked={notify} onChange={(ev) => setNotify(ev.target.checked)} />
          推送通知
        </label>
        <button type="button" className="workbench-submit" disabled={!query.trim() || isAnalyzing} onClick={handleSubmit}>
          {isAnalyzing ? '分析中…' : '分析'}
        </button>
      </header>

      {(inputError || duplicateError) && (
        <div className="workbench-inline-alerts card">
          {inputError ? <p className="workbench-alert workbench-alert-err">{inputError}</p> : null}
          {!inputError && duplicateError ? <p className="workbench-alert workbench-alert-warn">{duplicateError}</p> : null}
        </div>
      )}

      <div className="workbench-main">
        <aside className="workbench-desktop-side card">{sidebarInner}</aside>

        {sidebarOpen ? (
          <div
            className="chat-drawer-backdrop"
            role="presentation"
            onClick={() => setSidebarOpen(false)}
          >
            <aside
              className="chat-drawer card workbench-drawer"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              {sidebarInner}
            </aside>
          </div>
        ) : null}

        <section className="workbench-content card">
          {error ? <WorkbenchBanner parsed={error} onDismiss={clearError} /> : null}
          {isLoadingReport ? (
            <p className="today-muted workbench-muted">加载报告中…</p>
          ) : selectedReport ? (
            <div className="workbench-report">
              <div className="workbench-report-head">
                <div>
                  <h2 className="workbench-stock-title">
                    {selectedReport.meta.stockName || selectedReport.meta.stockCode}
                  </h2>
                  <p className="workbench-stock-meta mono">
                    {selectedReport.meta.stockCode}
                    {' · '}
                    {formatReportTypeWorkbench(selectedReport.meta.reportType)}
                    {' · '}
                    {formatWorkbenchDateTime(selectedReport.meta.createdAt)}
                  </p>
                  {typeof selectedReport.meta.changePct === 'number' ? (
                    <p className="workbench-change">
                      {selectedReport.meta.currentPrice !== undefined ? (
                        <span>{selectedReport.meta.currentPrice}</span>
                      ) : null}
                      {selectedReport.meta.changePct !== undefined ? (
                        <span
                          className={
                            selectedReport.meta.changePct > 0 ? 'price-up' : selectedReport.meta.changePct < 0 ? 'price-down' : ''
                          }
                        >
                          {selectedReport.meta.changePct > 0 ? '+' : ''}
                          {selectedReport.meta.changePct.toFixed(2)}%
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <div className="workbench-report-actions">
                  <AddToWatchlistCompact
                    stockCode={selectedReport.meta.stockCode}
                    stockName={selectedReport.meta.stockName}
                  />
                  <button type="button" className="workbench-btn-secondary" onClick={handleAskFollowUp}>
                    追问 AI
                  </button>
                  <button
                    type="button"
                    className="workbench-btn-secondary"
                    disabled={selectedReport.meta.id === undefined}
                    onClick={() => openMarkdownDrawer()}
                  >
                    完整报告
                  </button>
                </div>
              </div>

              <WorkbenchReportDetailPanel report={selectedReport} reportLangZh={reportLangZh} />
            </div>
          ) : (
            <div className="workbench-empty">
              <p className="workbench-empty-title">开始分析</p>
              <p className="today-muted">输入股票代码发起分析，或从左侧选择历史报告。</p>
            </div>
          )}
        </section>
      </div>

      {markdownDrawerOpen && selectedReport?.meta.id ? (
        <div
          className="workbench-md-modal-back"
          role="presentation"
          onClick={() => closeMarkdownDrawer()}
        >
          <div
            className="workbench-md-modal card"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="workbench-md-modal-head">
              <h3>完整报告 · {selectedReport.meta.stockName || selectedReport.meta.stockCode}</h3>
              <button type="button" className="workbench-icon-close" onClick={() => closeMarkdownDrawer()} aria-label="关闭">
                ×
              </button>
            </header>
            <div className="workbench-md-modal-body">
              {markdownLoading ? (
                <p className="today-muted">加载 Markdown…</p>
              ) : (
                <div className="workbench-md">
                  <Markdown remarkPlugins={[remarkGfm]}>{markdownText || ''}</Markdown>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showDeleteConfirm ? (
        <div className="chat-modal-backdrop" role="presentation" onClick={() => setShowDeleteConfirm(false)}>
          <div className="chat-modal card" role="alertdialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="chat-modal-title">删除历史记录</h3>
            <p className="chat-modal-desc">
              {selectedHistoryIds.length === 1
                ? '确认删除这条记录吗？'
                : `确认删除选中的 ${selectedHistoryIds.length} 条记录吗？`}
            </p>
            <div className="chat-modal-actions">
              <button type="button" className="btn-chat-secondary" onClick={() => setShowDeleteConfirm(false)}>
                取消
              </button>
              <button
                type="button"
                className="btn-chat-danger"
                disabled={isDeletingHistory}
                onClick={() => {
                  void deleteSelectedHistory();
                  setShowDeleteConfirm(false);
                }}
              >
                {isDeletingHistory ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
