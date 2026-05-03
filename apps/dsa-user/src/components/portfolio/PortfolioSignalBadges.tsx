import { adviceBadgeVariant, scoreBadgeVariant, type SignalBadgeVariant } from '../../utils/signalBadge';

function badgeClass(v: SignalBadgeVariant): string {
  switch (v) {
    case 'success':
      return 'user-portfolio-chip user-portfolio-chip-success';
    case 'warning':
      return 'user-portfolio-chip user-portfolio-chip-warning';
    case 'danger':
      return 'user-portfolio-chip user-portfolio-chip-danger';
    case 'info':
      return 'user-portfolio-chip user-portfolio-chip-info';
    default:
      return 'user-portfolio-chip user-portfolio-chip-neutral';
  }
}

export function PortfolioScoreBadge({ score, emptyText = '—' }: { score?: number | null; emptyText?: string }) {
  if (score == null || !Number.isFinite(Number(score))) {
    return <span className="user-portfolio-muted">{emptyText}</span>;
  }
  const v = scoreBadgeVariant(Number(score));
  return (
    <span className={`${badgeClass(v)} user-portfolio-chip-tabular`}>{Number(score)}</span>
  );
}

export function PortfolioAdviceBadge({ advice, emptyText = '—' }: { advice?: string | null; emptyText?: string }) {
  const text = (advice || '').trim();
  if (!text) return <span className="user-portfolio-muted">{emptyText}</span>;
  const v = adviceBadgeVariant(text);
  return <span className={badgeClass(v)}>{text}</span>;
}
