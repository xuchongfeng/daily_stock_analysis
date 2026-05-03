import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { fetchWatchlistScoreSeries, type WatchlistScorePoint } from '../api/watchlistScoreHistory';

const HOVER_DELAY_MS = 420;
const CACHE_TTL_MS = 5 * 60 * 1000;
const POPOVER_LEAVE_CLOSE_MS = 160;

type CacheEntry = { points: WatchlistScorePoint[]; loadedAt: number };

const seriesCache = new Map<string, CacheEntry>();

type Props = {
  stockCode: string;
  label: string;
};

/** 悬停「最近评分」展示迷你评分曲线（SVG）；浮层挂到 body，避免表格横向滚动容器裁剪 */
export function WatchlistScoreHover({ stockCode, label }: Props) {
  const code = String(stockCode || '').trim();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [points, setPoints] = useState<WatchlistScorePoint[]>([]);
  const [loading, setLoading] = useState(false);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current != null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, POPOVER_LEAVE_CLOSE_MS);
  }, [clearCloseTimer]);

  const loadSeries = useCallback(async () => {
    if (!code) return;
    const key = code.toUpperCase();
    const now = Date.now();
    const cached = seriesCache.get(key);
    if (cached && now - cached.loadedAt <= CACHE_TTL_MS) {
      setPoints(cached.points);
      return;
    }
    setLoading(true);
    try {
      const pts = await fetchWatchlistScoreSeries(code, 56);
      seriesCache.set(key, { points: pts, loadedAt: Date.now() });
      setPoints(pts);
    } catch {
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [code]);

  const onAnchorEnter = useCallback(() => {
    clearCloseTimer();
    if (!code) return;
    clearOpenTimer();
    openTimerRef.current = window.setTimeout(() => {
      setOpen(true);
      void loadSeries();
    }, HOVER_DELAY_MS);
  }, [clearCloseTimer, clearOpenTimer, code, loadSeries]);

  const onAnchorLeave = useCallback(() => {
    clearOpenTimer();
    scheduleClose();
  }, [clearOpenTimer, scheduleClose]);

  const onPopoverEnter = useCallback(() => {
    clearCloseTimer();
  }, [clearCloseTimer]);

  const onPopoverLeave = useCallback(() => {
    clearCloseTimer();
    setOpen(false);
  }, [clearCloseTimer]);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPopoverPos(null);
      return;
    }
    const el = anchorRef.current;
    const updatePos = () => {
      const r = el.getBoundingClientRect();
      setPopoverPos({ top: r.bottom + 6, left: r.left });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, loading, points.length]);

  useEffect(
    () => () => {
      clearOpenTimer();
      clearCloseTimer();
    },
    [clearOpenTimer, clearCloseTimer],
  );

  const w = 200;
  const h = 52;
  const pad = 4;
  let pathD = '';
  if (points.length >= 2) {
    const ys = points.map((p) => p.score);
    const ymin = Math.min(...ys, 0);
    const ymax = Math.max(...ys, 100);
    const ySpan = Math.max(ymax - ymin, 1);
    const xSpan = Math.max(points.length - 1, 1);
    const ix = (i: number) => pad + (i / xSpan) * (w - pad * 2);
    const iy = (v: number) => pad + ((ymax - v) / ySpan) * (h - pad * 2);
    pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${ix(i).toFixed(1)} ${iy(p.score).toFixed(1)}`)
      .join(' ');
  }

  const popover =
    open && popoverPos
      ? createPortal(
          <div
            className="watchlist-score-popover watchlist-score-popover-portal"
            style={{
              position: 'fixed',
              top: popoverPos.top,
              left: popoverPos.left,
              zIndex: 10050,
            }}
            role="tooltip"
            onMouseEnter={onPopoverEnter}
            onMouseLeave={onPopoverLeave}
          >
            {loading ? (
              <span className="watchlist-score-popover-muted">加载曲线…</span>
            ) : points.length < 2 ? (
              <span className="watchlist-score-popover-muted">暂无足够历史点画曲线</span>
            ) : (
              <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="watchlist-score-svg" aria-hidden>
                <path d={pathD} fill="none" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
              </svg>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <span
        ref={anchorRef}
        className="watchlist-score-hover"
        onMouseEnter={onAnchorEnter}
        onMouseLeave={onAnchorLeave}
        onFocus={onAnchorEnter}
        onBlur={onAnchorLeave}
        tabIndex={0}
        role="button"
        aria-label={`${label}，悬停查看评分走势`}
      >
        <span className="watchlist-score-hover-label">{label}</span>
      </span>
      {popover}
    </>
  );
}
