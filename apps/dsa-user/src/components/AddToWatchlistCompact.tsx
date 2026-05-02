import { useCallback, useMemo, useState } from 'react';
import { useWatchlistStore } from '../stores/watchlistStore';

function norm(code: string): string {
  return (code || '').trim().toUpperCase();
}

type Props = {
  stockCode: string;
  stockName?: string | null;
};

export function AddToWatchlistCompact({ stockCode, stockName }: Props) {
  const codes = useWatchlistStore((s) => s.codes);
  const saving = useWatchlistStore((s) => s.saving);
  const add = useWatchlistStore((s) => s.add);
  const [hint, setHint] = useState<string | null>(null);

  const code = norm(stockCode);
  const inList = useMemo(() => (code ? codes.includes(code) : false), [codes, code]);

  const onClick = useCallback(
    async () => {
      if (!code || inList) return;
      setHint(null);
      try {
        await add(stockCode, stockName);
        setHint('已加入');
        window.setTimeout(() => setHint(null), 2200);
      } catch {
        setHint('失败');
        window.setTimeout(() => setHint(null), 3200);
      }
    },
    [add, code, inList, stockCode, stockName],
  );

  if (!code) return null;

  if (inList) {
    return (
      <span className="today-watch-done" title="已在自选">
        ★
      </span>
    );
  }

  return (
    <span className="today-watch-cell">
      <button
        type="button"
        className="today-watch-add"
        disabled={saving}
        onClick={() => void onClick()}
        title="加入自选"
        aria-label="加入自选"
      >
        ☆
      </button>
      {hint ? <span className="today-watch-hint">{hint}</span> : null}
    </span>
  );
}
