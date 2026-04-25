export type SignalBadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export function scoreBadgeVariant(score?: number | null): SignalBadgeVariant {
  if (score == null || !Number.isFinite(Number(score))) return 'default';
  const s = Number(score);
  if (s >= 80) return 'success';
  if (s >= 60) return 'info';
  if (s >= 40) return 'warning';
  return 'danger';
}

export function adviceBadgeVariant(advice?: string | null): SignalBadgeVariant {
  const text = (advice || '').trim();
  if (!text) return 'default';
  if (text.includes('卖') || text.includes('清仓') || text.includes('止损')) return 'danger';
  if (text.includes('减仓') || text.includes('谨慎') || text.includes('回避')) return 'warning';
  if (text.includes('持有') || text.includes('观望') || text.includes('等待')) return 'info';
  if (text.includes('买') || text.includes('加仓') || text.includes('布局')) return 'success';
  return 'default';
}
