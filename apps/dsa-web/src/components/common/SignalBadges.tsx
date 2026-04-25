import type React from 'react';
import { adviceBadgeVariant, scoreBadgeVariant } from '../../utils/signalBadge';
import { Badge } from './Badge';

export const ScoreBadge: React.FC<{ score?: number | null; emptyText?: string }> = ({ score, emptyText = '—' }) => {
  if (score == null || !Number.isFinite(Number(score))) {
    return <span className="text-secondary-text">{emptyText}</span>;
  }
  return (
    <Badge variant={scoreBadgeVariant(Number(score))} size="sm" className="font-semibold tabular-nums">
      {Number(score)}
    </Badge>
  );
};

export const AdviceBadge: React.FC<{ advice?: string | null; emptyText?: string }> = ({
  advice,
  emptyText = '—',
}) => {
  const text = (advice || '').trim();
  if (!text) return <span className="text-secondary-text">{emptyText}</span>;
  return <Badge variant={adviceBadgeVariant(text)}>{text}</Badge>;
};

