import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { historyApi } from '../../api/history';
import { ScoreBadge } from './SignalBadges';

const HOVER_DELAY_MS = 1000;
const DEFAULT_DAYS = 14;
const CACHE_TTL_MS = 5 * 60 * 1000;
const HISTORY_FETCH_LIMIT = 100;

type ScoreHistoryPoint = {
  date: string;
  score: number;
  advice?: string | null;
};

type CacheEntry = {
  points: ScoreHistoryPoint[];
  loadedAt: number;
};

const historyCache = new Map<string, CacheEntry>();

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calcStartDate(days: number): string {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (Math.max(1, days) - 1));
  return toYmd(start);
}

function formatDisplayDate(ymd: string): string {
  return ymd.length >= 10 ? ymd.slice(5) : ymd;
}

type ChartPoint = {
  label: string;
  score: number;
};

type ScoreHistoryHoverBadgeProps = {
  stockCode?: string | null;
  score?: number | null;
  emptyText?: string;
  days?: number;
  className?: string;
};

export const ScoreHistoryHoverBadge: React.FC<ScoreHistoryHoverBadgeProps> = ({
  stockCode,
  score,
  emptyText = '—',
  days = DEFAULT_DAYS,
  className,
}) => {
  const code = (stockCode || '').trim();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [points, setPoints] = useState<ScoreHistoryPoint[]>([]);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [tipPos, setTipPos] = useState({ top: 0, left: 0, width: 256 });
  const hoverTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current != null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!code) {
      setPoints([]);
      setLoadError('无股票代码');
      return;
    }
    const cached = historyCache.get(code);
    const now = Date.now();
    if (cached && now - cached.loadedAt <= CACHE_TTL_MS) {
      setPoints(cached.points);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const startDate = calcStartDate(days);
      const res = await historyApi.getList({
        stockCode: code,
        startDate,
        page: 1,
        limit: HISTORY_FETCH_LIMIT,
      });
      const latestByDate = new Map<string, ScoreHistoryPoint>();
      for (const item of res.items || []) {
        const scoreVal = item.sentimentScore;
        if (scoreVal == null || !Number.isFinite(Number(scoreVal))) {
          continue;
        }
        const createdAt = String(item.createdAt || '');
        const ymd = createdAt.slice(0, 10);
        if (!ymd) {
          continue;
        }
        if (!latestByDate.has(ymd)) {
          latestByDate.set(ymd, {
            date: ymd,
            score: Number(scoreVal),
            advice: item.operationAdvice || null,
          });
        }
      }
      const normalized = Array.from(latestByDate.values())
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, Math.max(1, days));
      historyCache.set(code, { points: normalized, loadedAt: now });
      setPoints(normalized);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '加载失败');
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [code, days]);

  useEffect(() => () => clearHoverTimer(), [clearHoverTimer]);

  const syncTipPosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) {
      return;
    }
    const r = el.getBoundingClientRect();
    const w = 256;
    const margin = 8;
    const left = Math.max(margin, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - margin));
    setTipPos({ top: r.top - 8, left, width: w });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    syncTipPosition();
    const onViewport = () => syncTipPosition();
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);
    return () => {
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
    };
  }, [open, syncTipPosition]);

  const onEnter = useCallback(() => {
    if (score == null || !Number.isFinite(Number(score))) {
      return;
    }
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null;
      void loadHistory();
      setOpen(true);
    }, HOVER_DELAY_MS);
  }, [clearHoverTimer, loadHistory, score]);

  const onLeave = useCallback(() => {
    clearHoverTimer();
    setOpen(false);
  }, [clearHoverTimer]);

  const tooltipContent = useMemo(() => {
    if (loading) {
      return <div className="text-xs text-secondary-text">正在加载近 {days} 天评分…</div>;
    }
    if (loadError) {
      return <div className="text-xs text-danger">评分历史加载失败：{loadError}</div>;
    }
    if (points.length === 0) {
      return <div className="text-xs text-secondary-text">近 {days} 天无评分记录</div>;
    }
    const chartData: ChartPoint[] = points
      .slice()
      .reverse()
      .map((p) => ({
        label: formatDisplayDate(p.date),
        score: p.score,
      }));
    const latest = points[0]?.score;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className="font-semibold text-secondary-text">最近 {days} 天评分曲线</span>
          <span className="font-semibold tabular-nums text-foreground">最新 {latest}</span>
        </div>
        <div className="h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                tickCount={5}
                width={28}
                stroke="hsl(var(--muted-foreground))"
              />
              <RechartsTooltip
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                  fontSize: '12px',
                }}
                formatter={(value) => [`${value ?? '—'}`, '评分']}
                labelFormatter={(label) => `日期 ${label}`}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }, [days, loadError, loading, points]);

  const tip =
    open && typeof document !== 'undefined'
      ? createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[120] rounded-xl border border-border/70 bg-elevated/95 p-2.5 text-xs leading-5 text-foreground shadow-[0_16px_40px_rgba(3,8,20,0.18)] backdrop-blur-xl"
            style={{
              top: tipPos.top,
              left: tipPos.left,
              width: tipPos.width,
              transform: 'translateY(-100%)',
            }}
          >
            {tooltipContent}
          </span>,
          document.body,
        )
      : null;

  return (
    <>
      <span ref={anchorRef} className={className} onMouseEnter={onEnter} onMouseLeave={onLeave}>
        <ScoreBadge score={score} emptyText={emptyText} />
      </span>
      {tip}
    </>
  );
};

