import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';

import { getParsedApiError } from '../api/error';
import { submitUserFeedback } from '../api/publicFeedback';

export function FeedbackFab() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setErr(null);
    setDone(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    setErr(null);
    setDone(null);
    try {
      await submitUserFeedback({
        message: text,
        contact: contact.trim() || undefined,
        page_url: typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : undefined,
      });
      setDone('感谢反馈，我们已收到。');
      setMessage('');
      setContact('');
    } catch (ex) {
      setErr(getParsedApiError(ex).message || '提交失败');
    } finally {
      setSending(false);
    }
  };

  const modal =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <div className="feedback-fab-overlay" role="presentation">
        <button type="button" className="feedback-fab-backdrop" aria-label="关闭" onClick={close} />
        <div className="feedback-fab-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-fab-title">
          <h2 id="feedback-fab-title" className="feedback-fab-title">
            意见反馈
          </h2>
          <p className="feedback-fab-hint">描述问题或建议，可选填联系方式便于跟进。</p>
          <form onSubmit={(ev) => void onSubmit(ev)}>
            <label className="feedback-fab-field">
              <span className="feedback-fab-label">反馈内容</span>
              <textarea
                className="feedback-fab-textarea"
                rows={5}
                value={message}
                onChange={(ev) => setMessage(ev.target.value)}
                placeholder="请输入…"
                maxLength={8000}
                required
              />
            </label>
            <label className="feedback-fab-field">
              <span className="feedback-fab-label">联系方式（选填）</span>
              <input
                className="feedback-fab-input"
                type="text"
                value={contact}
                onChange={(ev) => setContact(ev.target.value)}
                placeholder="邮箱或微信号"
                maxLength={256}
                autoComplete="email"
              />
            </label>
            {err ? <p className="feedback-fab-err">{err}</p> : null}
            {done ? <p className="feedback-fab-ok">{done}</p> : null}
            <div className="feedback-fab-actions">
              <button type="button" className="feedback-fab-btn feedback-fab-btn-secondary" onClick={close}>
                关闭
              </button>
              <button type="submit" className="feedback-fab-btn feedback-fab-btn-primary" disabled={sending}>
                {sending ? '提交中…' : '提交'}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <button
        type="button"
        className="feedback-fab-trigger"
        title="意见反馈"
        aria-label="打开意见反馈"
        onClick={() => {
          setOpen(true);
          setDone(null);
          setErr(null);
        }}
      >
        反馈
      </button>
      {modal}
    </>
  );
}
