import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSearchParams } from 'react-router-dom';

import { agentApi, type SkillInfo } from '../api/agent';
import { getParsedApiError, type ParsedApiError } from '../api/error';
import {
  useAgentChatStore,
  type Message,
  type ProgressStep,
} from '../stores/agentChatStore';
import { downloadSession, formatSessionAsMarkdown } from '../utils/chatExport';
import {
  type ChatFollowUpContext,
  buildFollowUpPrompt,
  parseFollowUpRecordId,
  resolveChatFollowUpContext,
  sanitizeFollowUpStockCode,
  sanitizeFollowUpStockName,
  stripChatFollowUpSearchParams,
} from '../utils/chatFollowUp';
import { isNearBottom } from '../utils/chatScroll';

const QUICK_QUESTIONS = [
  { label: '用缠论分析茅台', skill: 'chan_theory' },
  { label: '波浪理论看宁德时代', skill: 'wave_theory' },
  { label: '分析比亚迪趋势', skill: 'bull_trend' },
  { label: '箱体震荡技能看中芯国际', skill: 'box_oscillation' },
  { label: '分析腾讯 hk00700', skill: 'bull_trend' },
  { label: '用情绪周期分析东方财富', skill: 'emotion_cycle' },
];

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function ApiErrorBanner({ error }: { error: ParsedApiError }) {
  return (
    <div className="chat-alert chat-alert-danger" role="alert">
      <strong className="chat-alert-title">{error.title}</strong>
      <p className="chat-alert-msg">{error.message}</p>
    </div>
  );
}

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [input, setInput] = useState('');
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [showSkillDesc, setShowSkillDesc] = useState<string | null>(null);
  /** 策略区展开；选完一项后折叠以腾出消息区高度 */
  const [skillsBarExpanded, setSkillsBarExpanded] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [isFollowUpContextLoading, setIsFollowUpContextLoading] = useState(false);
  const [sendToast, setSendToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [copiedMessages, setCopiedMessages] = useState<Set<string>>(new Set());
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const copyResetTimerRef = useRef<Partial<Record<string, number>>>({});
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendToastTimerRef = useRef<number | null>(null);
  const followUpHydrationTokenRef = useRef(0);
  const followUpContextRef = useRef<ChatFollowUpContext | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const pendingScrollBehaviorRef = useRef<'auto' | 'smooth'>('auto');
  const isMountedRef = useRef(true);

  useEffect(() => {
    const timers = copyResetTimerRef.current;
    return () => {
      if (sendToastTimerRef.current !== null) {
        window.clearTimeout(sendToastTimerRef.current);
      }
      Object.values(timers).forEach((tid) => {
        if (tid !== undefined) window.clearTimeout(tid);
      });
    };
  }, []);

  useEffect(() => {
    if (!skillsBarExpanded) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setSkillsBarExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [skillsBarExpanded]);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const {
    messages,
    loading,
    progressSteps,
    sessionId,
    sessions,
    sessionsLoading,
    chatError,
    loadSessions,
    loadInitialSession,
    switchSession,
    startStream,
    clearCompletionBadge,
    startNewChat,
  } = useAgentChatStore();

  const syncScrollState = useCallback(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    const nearBottom = isNearBottom({
      scrollTop: viewport.scrollTop,
      clientHeight: viewport.clientHeight,
      scrollHeight: viewport.scrollHeight,
    });
    shouldStickToBottomRef.current = nearBottom;
    setShowJumpToBottom((prev) => (nearBottom ? false : prev));
  }, []);

  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const requestScrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'auto') => {
    shouldStickToBottomRef.current = true;
    pendingScrollBehaviorRef.current = behavior;
    setShowJumpToBottom(false);
  }, []);

  const handleMessagesScroll = useCallback(() => {
    syncScrollState();
  }, [syncScrollState]);

  useEffect(() => {
    syncScrollState();
  }, [syncScrollState, sessionId]);

  useEffect(() => {
    const behavior = pendingScrollBehaviorRef.current;
    const shouldAutoScroll = shouldStickToBottomRef.current;
    if (!shouldAutoScroll) {
      if (messages.length > 0 || progressSteps.length > 0 || loading) {
        queueMicrotask(() => setShowJumpToBottom(true));
      }
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      scrollToBottom(behavior);
      pendingScrollBehaviorRef.current = loading ? 'auto' : 'smooth';
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, progressSteps, loading, sessionId, scrollToBottom]);

  useEffect(() => {
    if (!loading) {
      pendingScrollBehaviorRef.current = 'smooth';
    }
  }, [loading]);

  useEffect(() => {
    clearCompletionBadge();
  }, [clearCompletionBadge]);

  useEffect(() => {
    loadInitialSession();
  }, [loadInitialSession]);

  useEffect(() => {
    agentApi
      .getSkills()
      .then((res) => {
        setSkills(res.skills);
        const defaultId = res.default_skill_id || res.skills[0]?.id || '';
        setSelectedSkill(defaultId);
      })
      .catch(() => {
        setSkills([]);
      });
  }, []);

  const availableSkillIds = new Set(skills.map((s) => s.id));
  const quickQuestions = QUICK_QUESTIONS.filter(
    (q) => availableSkillIds.size === 0 || availableSkillIds.has(q.skill),
  );

  const selectedSkillLabel =
    selectedSkill === ''
      ? '通用分析'
      : skills.find((s) => s.id === selectedSkill)?.name ?? selectedSkill;

  const handleSkillPick = useCallback((skillId: string) => {
    setSelectedSkill(skillId);
    setSkillsBarExpanded(false);
  }, []);

  const handleStartNewChat = useCallback(() => {
    followUpContextRef.current = null;
    requestScrollToBottom('auto');
    startNewChat();
    setSidebarOpen(false);
  }, [requestScrollToBottom, startNewChat]);

  const handleSwitchSession = useCallback(
    (targetSessionId: string) => {
      requestScrollToBottom('auto');
      void switchSession(targetSessionId);
      setSidebarOpen(false);
    },
    [requestScrollToBottom, switchSession],
  );

  const confirmDelete = useCallback(() => {
    if (!deleteConfirmId) return;
    void agentApi
      .deleteChatSession(deleteConfirmId)
      .then(() => {
        void loadSessions();
        if (deleteConfirmId === sessionId) {
          handleStartNewChat();
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to delete chat session:', err);
      });
    setDeleteConfirmId(null);
  }, [deleteConfirmId, sessionId, loadSessions, handleStartNewChat]);

  useEffect(() => {
    const stock = sanitizeFollowUpStockCode(searchParams.get('stock'));
    const name = sanitizeFollowUpStockName(searchParams.get('name'));
    const recordId = parseFollowUpRecordId(searchParams.get('recordId'));

    if (!stock) {
      setSearchParams((prev) => stripChatFollowUpSearchParams(prev), { replace: true });
      return;
    }

    const hydrationToken = ++followUpHydrationTokenRef.current;
    followUpContextRef.current = { stock_code: stock, stock_name: name };
    queueMicrotask(() => {
      setInput(buildFollowUpPrompt(stock, name));
      if (recordId !== undefined) {
        setIsFollowUpContextLoading(true);
      }
    });
    void resolveChatFollowUpContext({
      stockCode: stock,
      stockName: name,
      recordId,
    }).then((context) => {
      if (!isMountedRef.current || followUpHydrationTokenRef.current !== hydrationToken) {
        return;
      }
      followUpContextRef.current = context;
    }).finally(() => {
      if (isMountedRef.current && followUpHydrationTokenRef.current === hydrationToken) {
        setIsFollowUpContextLoading(false);
      }
    });
    setSearchParams((prev) => stripChatFollowUpSearchParams(prev), { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSend = useCallback(
    async (overrideMessage?: string, overrideSkill?: string) => {
      const msgText = overrideMessage ?? input.trim();
      if (!msgText || loading) return;
      const usedSkill = overrideSkill ?? selectedSkill;
      const usedSkillName =
        skills.find((s) => s.id === usedSkill)?.name || (usedSkill ? usedSkill : '通用');

      const payload = {
        message: msgText,
        session_id: sessionId,
        skills: usedSkill ? [usedSkill] : undefined,
        context: followUpContextRef.current ?? undefined,
      };
      followUpHydrationTokenRef.current += 1;
      followUpContextRef.current = null;
      setIsFollowUpContextLoading(false);

      setInput('');
      requestScrollToBottom('smooth');
      await startStream(payload, { skillName: usedSkillName });
    },
    [input, loading, requestScrollToBottom, selectedSkill, skills, sessionId, startStream],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleQuickQuestion = (q: (typeof QUICK_QUESTIONS)[0]) => {
    handleSkillPick(q.skill);
    void handleSend(q.label, q.skill);
  };

  const showSendFeedback = useCallback((nextToast: { type: 'success' | 'error'; message: string }, durationMs: number) => {
    if (sendToastTimerRef.current !== null) {
      window.clearTimeout(sendToastTimerRef.current);
    }
    setSendToast(nextToast);
    sendToastTimerRef.current = window.setTimeout(() => {
      setSendToast(null);
      sendToastTimerRef.current = null;
    }, durationMs);
  }, []);

  const toggleThinking = (msgId: string) => {
    setExpandedThinking((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const copyMessageToClipboard = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessages((prev) => new Set(prev).add(msgId));
      const existingTimer = copyResetTimerRef.current[msgId];
      if (existingTimer !== undefined) window.clearTimeout(existingTimer);
      copyResetTimerRef.current[msgId] = window.setTimeout(() => {
        setCopiedMessages((prev) => {
          const next = new Set(prev);
          next.delete(msgId);
          return next;
        });
        delete copyResetTimerRef.current[msgId];
      }, 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const downloadMessageAsMarkdown = useCallback((msg: Message) => {
    const heading =
      msg.role === 'user'
        ? '# 用户消息'
        : `# AI 回复${msg.skillName ? ` · ${msg.skillName}` : ''}`;
    const content = [heading, '', msg.content].join('\n');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${msg.role === 'user' ? 'user' : 'assistant'}-message-${msg.id}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

  const getCurrentStage = (steps: ProgressStep[]): string => {
    if (steps.length === 0) return '正在连接...';
    const last = steps[steps.length - 1];
    if (last.type === 'thinking') return last.message || 'AI 正在思考...';
    if (last.type === 'tool_start') return `${last.display_name || last.tool}...`;
    if (last.type === 'tool_done') return `${last.display_name || last.tool} 完成`;
    if (last.type === 'generating') return last.message || '正在生成最终分析...';
    return '处理中...';
  };

  const renderThinkingBlock = (msg: Message) => {
    if (!msg.thinkingSteps || msg.thinkingSteps.length === 0) return null;
    const isExpanded = expandedThinking.has(msg.id);
    const toolSteps = msg.thinkingSteps.filter((s) => s.type === 'tool_done');
    const totalDuration = toolSteps.reduce((sum, s) => sum + (s.duration || 0), 0);
    const summary = `${toolSteps.length} 个工具调用 · ${totalDuration.toFixed(1)}s`;

    return (
      <button
        type="button"
        onClick={() => toggleThinking(msg.id)}
        className="chat-thinking-toggle"
      >
        <span className={cx('chat-thinking-caret', isExpanded && 'chat-thinking-caret-open')} aria-hidden>
          ›
        </span>
        <span className="chat-thinking-summary">
          <span className="muted">思考过程</span>
          <span className="chat-dot">·</span>
          <span className="muted-soft">{summary}</span>
        </span>
      </button>
    );
  };

  const renderThinkingDetails = (steps: ProgressStep[]) => (
    <div className="chat-thinking-details">
      {steps.map((step, idx) => {
        let text = '';
        let itemClass = 'chat-step-muted';
        if (step.type === 'thinking') {
          text = step.message || `第 ${step.step} 步：思考`;
          itemClass = 'chat-step-thinking';
        } else if (step.type === 'tool_start') {
          text = `${step.display_name || step.tool}...`;
          itemClass = 'chat-step-tool';
        } else if (step.type === 'tool_done') {
          text = `${step.display_name || step.tool} (${step.duration}s)`;
          itemClass = step.success ? 'chat-step-ok' : 'chat-step-err';
        } else if (step.type === 'generating') {
          text = step.message || '生成分析';
          itemClass = 'chat-step-gen';
        }
        return (
          <div key={idx} className={cx('chat-step-row', itemClass)}>
            <span className="chat-step-dot" />
            <span>{text}</span>
          </div>
        );
      })}
    </div>
  );

  const sidebarInner = (
    <>
      <div className="chat-sidebar-head">
        <h2 className="chat-sidebar-title">历史对话</h2>
        <button
          type="button"
          className="chat-icon-btn"
          onClick={handleStartNewChat}
          aria-label="开启新对话"
        >
          +
        </button>
      </div>
      <div className="chat-sidebar-body">
        {sessionsLoading ? (
          <p className="chat-sidebar-hint">加载对话中…</p>
        ) : sessions.length === 0 ? (
          <p className="chat-sidebar-hint">暂无历史会话，提问后将出现在此。</p>
        ) : (
          <ul className="chat-session-list">
            {sessions.map((s) => (
              <li key={s.session_id} className="chat-session-row">
                <button
                  type="button"
                  className={cx('chat-session-item', s.session_id === sessionId && 'active')}
                  onClick={() => handleSwitchSession(s.session_id)}
                >
                  <span className="chat-session-title">{s.title || '对话'}</span>
                  <span className="chat-session-meta">
                    {s.message_count} 条
                    {s.last_active ? (
                      <>
                        {' '}
                        ·{' '}
                        {new Date(s.last_active).toLocaleDateString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </>
                    ) : null}
                  </span>
                </button>
                <button
                  type="button"
                  className="chat-session-del"
                  onClick={() => setDeleteConfirmId(s.session_id)}
                  aria-label={`删除对话 ${s.title}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="chat-header-top">
          <div className="chat-title-row">
            <button
              type="button"
              className="chat-sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="打开历史对话"
            >
              ☰
            </button>
            <h1 className="chat-title">问股</h1>
          </div>
          {messages.length > 0 && (
            <div className="chat-header-actions">
              <button type="button" className="btn-chat-secondary" onClick={() => downloadSession(messages)}>
                导出会话
              </button>
              <button
                type="button"
                className="btn-chat-secondary"
                disabled={sending}
                onClick={async () => {
                  if (sending) return;
                  setSending(true);
                  setSendToast(null);
                  try {
                    const content = formatSessionAsMarkdown(messages);
                    await agentApi.sendChat(content);
                    showSendFeedback({ type: 'success', message: '已发送到通知渠道' }, 3000);
                  } catch (err: unknown) {
                    const parsed = getParsedApiError(err);
                    showSendFeedback({ type: 'error', message: parsed.message || '发送失败' }, 5000);
                  } finally {
                    setSending(false);
                  }
                }}
              >
                {sending ? '发送中…' : '发往通知'}
              </button>
            </div>
          )}
        </div>
        <p className="chat-sub">
          多轮策略问答，基于实时行情与工具链生成决策参考。（需服务端开启 Agent 模式）
        </p>
        {sendToast ? (
          <div
            className={cx(
              'chat-alert chat-alert-compact',
              sendToast.type === 'success' ? 'chat-alert-success' : 'chat-alert-danger',
            )}
            role="status"
          >
            {sendToast.message}
          </div>
        ) : null}
      </header>

      <div className="chat-layout">
        <aside className="chat-sidebar-desktop card chat-sidebar">{sidebarInner}</aside>

        {sidebarOpen ? (
          <div
            className="chat-drawer-backdrop"
            role="presentation"
            onClick={() => setSidebarOpen(false)}
          >
            <aside
              className="chat-drawer card"
              role="dialog"
              aria-modal="true"
              aria-label="历史对话"
              onClick={(e) => e.stopPropagation()}
            >
              {sidebarInner}
            </aside>
          </div>
        ) : null}

        {deleteConfirmId ? (
          <div className="chat-modal-backdrop" role="presentation" onClick={() => setDeleteConfirmId(null)}>
            <div className="chat-modal card" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <h3 className="chat-modal-title">删除对话</h3>
              <p className="chat-modal-desc">删除后不可恢复，确定删除这条会话吗？</p>
              <div className="chat-modal-actions">
                <button type="button" className="btn-chat-secondary" onClick={() => setDeleteConfirmId(null)}>
                  取消
                </button>
                <button type="button" className="btn-chat-danger" onClick={confirmDelete}>
                  删除
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <section className="chat-main card">
          {skills.length > 0 ? (
            <div
              className={cx('chat-skills-bar', !skillsBarExpanded && 'is-collapsed')}
              role="toolbar"
              aria-label="分析策略"
            >
              <div className="chat-skills-compact">
                <button
                  type="button"
                  className="chat-skills-collapse-toggle"
                  onClick={() => setSkillsBarExpanded((v) => !v)}
                  aria-expanded={skillsBarExpanded}
                  aria-controls="chat-skills-panel"
                  id="chat-skills-summary-btn"
                >
                  <span className="chat-skills-label-inline">策略</span>
                  <span className="chat-skills-current-name">{selectedSkillLabel}</span>
                  <span className={cx('chat-skills-chevron', skillsBarExpanded && 'is-open')} aria-hidden />
                </button>
              </div>
              {skillsBarExpanded ? (
                <div
                  className="chat-skills-panel"
                  id="chat-skills-panel"
                  role="region"
                  aria-labelledby="chat-skills-summary-btn"
                >
                  <div className="chat-skills-radios">
                    <label className="chat-skill-label">
                      <input
                        type="radio"
                        name="skill"
                        value=""
                        checked={selectedSkill === ''}
                        onChange={() => handleSkillPick('')}
                      />
                      <span>通用分析</span>
                    </label>
                    {skills.map((s) => (
                      <label
                        key={s.id}
                        className="chat-skill-label"
                        onMouseEnter={() => setShowSkillDesc(s.id)}
                        onMouseLeave={() => setShowSkillDesc(null)}
                        onFocus={() => setShowSkillDesc(s.id)}
                        onBlur={() => setShowSkillDesc(null)}
                      >
                        <input
                          type="radio"
                          name="skill"
                          value={s.id}
                          checked={selectedSkill === s.id}
                          onChange={() => handleSkillPick(s.id)}
                        />
                        <span>{s.name}</span>
                        {showSkillDesc === s.id && s.description ? (
                          <span className="chat-skill-tooltip" role="tooltip">
                            <strong>{s.name}</strong>
                            {s.description}
                          </span>
                        ) : null}
                      </label>
                    ))}
                  </div>
                  <div className="chat-skills-panel-footer">
                    <button type="button" className="chat-skills-fold-btn" onClick={() => setSkillsBarExpanded(false)}>
                      收起
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            className="chat-messages-scroll"
            ref={messagesViewportRef}
            onScroll={handleMessagesScroll}
          >
            {messages.length === 0 && !loading ? (
              <div className="chat-empty">
                <div className="chat-empty-inner">
                  <p className="chat-empty-title">开始问股</p>
                  <p className="chat-empty-desc">
                    输入「分析 600519」或「茅台现在能买吗」，AI 将调用数据工具生成分析。
                  </p>
                  <div className="chat-quick-grid">
                    {quickQuestions.map((q, i) => (
                      <button key={i} type="button" className="chip-question" onClick={() => handleQuickQuestion(q)}>
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={cx('chat-msg-row', msg.role === 'user' && 'user')}>
                  <div className={cx('chat-avatar', msg.role === 'user' ? 'user' : 'ai')}>
                    {msg.role === 'user' ? '我' : 'AI'}
                  </div>
                  <div className={cx('chat-bubble', msg.role === 'user' ? 'user' : 'ai')}>
                    {msg.role === 'assistant' && msg.skillName ? (
                      <div className="chat-skill-pill">{msg.skillName}</div>
                    ) : null}
                    {msg.role === 'assistant' && renderThinkingBlock(msg)}
                    {msg.role === 'assistant' &&
                      expandedThinking.has(msg.id) &&
                      msg.thinkingSteps &&
                      renderThinkingDetails(msg.thinkingSteps)}
                    {msg.role === 'assistant' ? (
                      <div className="chat-msg-body">
                        <div className="chat-msg-actions">
                          <button
                            type="button"
                            className="link-action"
                            onClick={() => copyMessageToClipboard(msg.id, msg.content)}
                          >
                            {copiedMessages.has(msg.id) ? '已复制' : '复制'}
                          </button>
                          <button type="button" className="link-action" onClick={() => downloadMessageAsMarkdown(msg)}>
                            导出
                          </button>
                        </div>
                        <div className="chat-markdown">
                          <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                        </div>
                      </div>
                    ) : (
                      <div className="chat-plain">
                        {msg.content.split('\n').map((line, i) => (
                          <p key={i} className="chat-plain-line">
                            {line || '\u00A0'}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {loading ? (
              <div className="chat-msg-row">
                <div className="chat-avatar ai">AI</div>
                <div className="chat-bubble ai loading-bubble">
                  <span className="chat-spinner" aria-hidden />
                  <span>{getCurrentStage(progressSteps)}</span>
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          {showJumpToBottom ? (
            <div className="chat-float-bottom">
              <button
                type="button"
                className="btn-chat-float"
                onClick={() => {
                  requestScrollToBottom('smooth');
                  scrollToBottom('smooth');
                }}
              >
                回到底部
              </button>
            </div>
          ) : null}

          <footer className="chat-input-pane">
            {chatError ? <ApiErrorBanner error={chatError} /> : null}
            {isFollowUpContextLoading ? (
              <div className="chat-alert chat-alert-info chat-alert-compact" role="status">
                正在加载历史报告上下文…
              </div>
            ) : null}

            <div className="chat-input-row">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="例如：分析 600519（Enter 发送，Shift+Enter 换行）"
                disabled={loading}
                rows={2}
                className="chat-textarea"
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = `${Math.min(t.scrollHeight, 200)}px`;
                }}
              />
              <button
                type="button"
                className="btn-chat-send"
                disabled={!input.trim() || loading}
                onClick={() => void handleSend()}
              >
                {loading ? '…' : '发送'}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
