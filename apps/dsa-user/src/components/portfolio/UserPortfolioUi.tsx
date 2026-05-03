import type { ReactNode } from 'react';

import type { ParsedApiError } from '../../api/error';

export function PortfolioApiErrorBanner({
  error,
  onDismiss,
}: {
  error: ParsedApiError;
  onDismiss: () => void;
}) {
  return (
    <div className="user-portfolio-alert user-portfolio-alert-danger" role="alert">
      <div className="user-portfolio-alert-body">
        <strong>{error.title}</strong>
        <p>{error.message}</p>
      </div>
      <button type="button" className="user-portfolio-alert-dismiss" onClick={onDismiss}>
        关闭
      </button>
    </div>
  );
}

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export function PortfolioInlineAlert({
  variant = 'info',
  title,
  message,
  className = '',
}: {
  variant?: AlertVariant;
  title?: string;
  message: string;
  className?: string;
}) {
  return (
    <div className={`user-portfolio-alert user-portfolio-alert-${variant} ${className}`.trim()} role="status">
      {title ? <strong className="user-portfolio-alert-title">{title}</strong> : null}
      <p className="user-portfolio-alert-msg">{message}</p>
    </div>
  );
}

export function PortfolioCard({
  children,
  className = '',
  tone,
}: {
  children: ReactNode;
  className?: string;
  /** 与管理端渐变摘要卡视觉类似的强调块 */
  tone?: 'metric';
}) {
  const toneCls = tone === 'metric' ? 'user-portfolio-card-metric' : '';
  return (
    <section className={`card user-portfolio-card ${toneCls} ${className}`.trim()}>{children}</section>
  );
}

export function PortfolioBadge({
  variant,
  children,
}: {
  variant: 'success' | 'warning';
  children: ReactNode;
}) {
  return <span className={`user-portfolio-badge user-portfolio-badge-${variant}`}>{children}</span>;
}

export function PortfolioEmpty({
  title,
  description,
  className = '',
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={`user-portfolio-empty ${className}`.trim()}>
      <p className="user-portfolio-empty-title">{title}</p>
      <p className="user-portfolio-empty-desc">{description}</p>
    </div>
  );
}

export function PortfolioConfirmDialog({
  open,
  title,
  message,
  confirmText,
  cancelText,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="user-portfolio-modal-root" role="presentation">
      <button type="button" className="user-portfolio-modal-backdrop" aria-label="关闭" onClick={onCancel} />
      <div className="user-portfolio-modal-panel" role="dialog" aria-modal aria-labelledby="portfolio-confirm-title">
        <h2 id="portfolio-confirm-title" className="user-portfolio-modal-title">
          {title}
        </h2>
        <p className="user-portfolio-modal-msg">{message}</p>
        <div className="user-portfolio-modal-actions">
          <button type="button" className="user-portfolio-btn user-portfolio-btn-ghost" disabled={loading} onClick={onCancel}>
            {cancelText}
          </button>
          <button type="button" className="user-portfolio-btn user-portfolio-btn-danger" disabled={loading} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
