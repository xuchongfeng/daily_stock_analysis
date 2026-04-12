import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '../common';
import { useWatchlistStore } from '../../stores/watchlistStore';

type AddToWatchlistButtonProps = {
  stockCode: string;
  stockName?: string | null;
  /** 表格等紧凑场景：仅星标图标 */
  compact?: boolean;
  className?: string;
};

function norm(code: string): string {
  return (code || '').trim().toUpperCase();
}

export const AddToWatchlistButton: React.FC<AddToWatchlistButtonProps> = ({
  stockCode,
  stockName,
  compact = false,
  className,
}) => {
  const codes = useWatchlistStore((s) => s.codes);
  const saving = useWatchlistStore((s) => s.saving);
  const add = useWatchlistStore((s) => s.add);
  const [hint, setHint] = useState<string | null>(null);

  const code = norm(stockCode);
  const inList = useMemo(() => (code ? codes.includes(code) : false), [codes, code]);

  const onClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!code || inList) return;
      setHint(null);
      try {
        await add(stockCode, stockName);
        setHint('已加入自选');
        window.setTimeout(() => setHint(null), 2200);
      } catch {
        setHint('加入失败');
        window.setTimeout(() => setHint(null), 3200);
      }
    },
    [add, code, inList, stockCode, stockName],
  );

  if (!code) {
    return null;
  }

  if (inList) {
    if (compact) {
      return (
        <span
          className={`inline-flex items-center text-amber-500 ${className ?? ''}`}
          title="已在自选"
          aria-label="已在自选"
        >
          <Star className="h-4 w-4 fill-current" />
        </span>
      );
    }
    return (
      <Button type="button" variant="ghost" size="sm" disabled className={className}>
        已在自选
      </Button>
    );
  }

  if (compact) {
    return (
      <span className={`inline-flex flex-col items-center gap-0.5 ${className ?? ''}`}>
        <button
          type="button"
          disabled={saving}
          onClick={onClick}
          className="rounded-lg p-1 text-secondary-text transition-colors hover:bg-hover hover:text-amber-500 disabled:opacity-50"
          title="加入自选"
          aria-label="加入自选"
        >
          <Star className="h-4 w-4" />
        </button>
        {hint ? <span className="text-[10px] text-secondary-text">{hint}</span> : null}
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-col items-end gap-0.5 ${className ?? ''}`}>
      <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={onClick}>
        {saving ? '保存中…' : '加入自选'}
      </Button>
      {hint ? <span className="text-[10px] text-secondary-text">{hint}</span> : null}
    </span>
  );
};
