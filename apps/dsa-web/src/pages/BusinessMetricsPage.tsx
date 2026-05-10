import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchBusinessMetrics,
  fetchBusinessMetricsDaily,
  type BusinessMetricsDTO,
  type BusinessMetricsDailySeriesDTO,
} from '../api/businessMetrics';
import { ApiErrorAlert, Button } from '../components/common';
import { getParsedApiError, type ParsedApiError } from '../api/error';
import { cn } from '../utils/cn';

const CHART_COLORS = {
  primary: 'hsl(var(--primary))',
  uv: 'hsl(199 89% 48%)',
  registrations: 'hsl(142 71% 45%)',
  chat: 'hsl(271 81% 56%)',
  analysis: 'hsl(38 92% 50%)',
  feedback: 'hsl(346 77% 49%)',
  muted: 'hsl(var(--muted-foreground))',
  grid: 'hsl(var(--border))',
};

const RANGE_PRESETS = [
  { label: '7 天', days: 7 },
  { label: '14 天', days: 14 },
  { label: '30 天', days: 30 },
  { label: '90 天', days: 90 },
] as const;

function MetricCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-soft-card">
      <p className="text-xs font-medium uppercase tracking-wide text-secondary-text">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-secondary-text">{hint}</p> : null}
    </div>
  );
}

function chartTickLabel(iso: string): string {
  return iso.length >= 10 ? iso.slice(5, 10) : iso;
}

const BusinessMetricsPage: React.FC = () => {
  const [data, setData] = useState<BusinessMetricsDTO | null>(null);
  const [seriesPayload, setSeriesPayload] = useState<BusinessMetricsDailySeriesDTO | null>(null);
  const [seriesDays, setSeriesDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ParsedApiError | null>(null);

  const trafficChartData = useMemo(() => {
    const rows = seriesPayload?.series ?? [];
    return rows.map((r) => ({
      ...r,
      tick: chartTickLabel(r.calendar_date),
    }));
  }, [seriesPayload]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [snap, daily] = await Promise.all([
        fetchBusinessMetrics(),
        fetchBusinessMetricsDaily(seriesDays),
      ]);
      setData(snap);
      setSeriesPayload(daily);
    } catch (e) {
      setError(getParsedApiError(e));
      setData(null);
      setSeriesPayload(null);
    } finally {
      setLoading(false);
    }
  }, [seriesDays]);

  useEffect(() => {
    document.title = '运营指标 - DSA';
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tooltipStyles = {
    borderRadius: 12,
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--card))',
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">运营指标</h1>
          <p className="mt-1 text-sm text-secondary-text">
            统计日为服务器本地日历日。PV/UV 依赖前端上报；图表为按日聚合。口径见{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">docs/business-metrics.md</code>
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" isLoading={loading} onClick={() => void load()}>
          刷新
        </Button>
      </div>

      {error ? (
        <div className="mb-6">
          <ApiErrorAlert error={error} />
        </div>
      ) : null}

      {data ? (
        <>
          <p className="mb-4 text-sm text-secondary-text">
            当前汇总日期：<span className="font-mono text-foreground">{data.calendar_date}</span>
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="PV（页面浏览）"
              value={data.page_views_today}
              hint="前端路由上报次数；多次刷新同一页会计多次。"
            />
            <MetricCard
              label="UV（独立访客）"
              value={data.unique_visitors_today}
              hint="按 Cookie dsa_visitor_id 当日去重；清除 Cookie 会重复计数。"
            />
            <MetricCard label="今日新注册（门户）" value={data.portal_registrations_today} />
            <MetricCard label="门户用户总数" value={data.portal_users_total} />
            <MetricCard
              label="问股（用户发言条数）"
              value={data.agent_chat_user_messages_today}
              hint="Agent 对话表中 role=user 的消息数，近似用户发起的问答轮次。"
            />
            <MetricCard
              label="门户分析记录（今日）"
              value={data.portal_analysis_records_today}
              hint="analysis_history 中带 portal_user_id 的新增条数。"
            />
            <MetricCard label="用户反馈（今日）" value={data.user_feedback_submissions_today} />
          </div>

          <section className="mt-10">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">按日趋势</h2>
                <p className="mt-1 text-xs text-secondary-text">
                  区间 {seriesPayload?.start_date ?? '—'} ~ {seriesPayload?.end_date ?? '—'}（共 {seriesDays}{' '}
                  天）
                </p>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="图表天数">
                {RANGE_PRESETS.map((p) => (
                  <button
                    key={p.days}
                    type="button"
                    disabled={loading}
                    onClick={() => setSeriesDays(p.days)}
                    className={cn(
                      'rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors',
                      seriesDays === p.days
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/12 text-foreground'
                        : 'border-border/70 bg-card/60 text-secondary-text hover:bg-hover hover:text-foreground',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-1">
              <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-soft-card sm:p-5">
                <h3 className="mb-1 text-sm font-medium text-foreground">流量（PV / UV）</h3>
                <p className="mb-4 text-xs text-secondary-text">PV 为上报次数；UV 为当日 visitor_id 去重。</p>
                <div className="h-72 w-full min-w-0">
                  {trafficChartData.length === 0 ? (
                    <p className="text-sm text-secondary-text">暂无序列数据</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trafficChartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" opacity={0.6} />
                        <XAxis dataKey="tick" tick={{ fontSize: 11 }} stroke={CHART_COLORS.muted} interval="preserveStartEnd" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke={CHART_COLORS.muted} width={40} />
                        <Tooltip
                          contentStyle={tooltipStyles}
                          formatter={(value, name) => [`${value ?? '—'}`, `${name ?? ''}`]}
                          labelFormatter={(_, payload) => {
                            const raw = payload?.[0]?.payload?.calendar_date as string | undefined;
                            return raw ? `日期 ${raw}` : '';
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line
                          type="monotone"
                          dataKey="page_views"
                          name="PV"
                          stroke={CHART_COLORS.primary}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="unique_visitors"
                          name="UV"
                          stroke={CHART_COLORS.uv}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-soft-card sm:p-5">
                <h3 className="mb-1 text-sm font-medium text-foreground">业务（注册 / 问股 / 分析 / 反馈）</h3>
                <p className="mb-4 text-xs text-secondary-text">与上方卡片口径一致，按自然日汇总。</p>
                <div className="h-80 w-full min-w-0">
                  {trafficChartData.length === 0 ? (
                    <p className="text-sm text-secondary-text">暂无序列数据</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trafficChartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" opacity={0.6} />
                        <XAxis dataKey="tick" tick={{ fontSize: 11 }} stroke={CHART_COLORS.muted} interval="preserveStartEnd" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke={CHART_COLORS.muted} width={40} />
                        <Tooltip
                          contentStyle={tooltipStyles}
                          formatter={(value, name) => [`${value ?? '—'}`, `${name ?? ''}`]}
                          labelFormatter={(_, payload) => {
                            const raw = payload?.[0]?.payload?.calendar_date as string | undefined;
                            return raw ? `日期 ${raw}` : '';
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line
                          type="monotone"
                          dataKey="portal_registrations"
                          name="门户新注册"
                          stroke={CHART_COLORS.registrations}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="agent_chat_user_messages"
                          name="问股用户消息"
                          stroke={CHART_COLORS.chat}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="portal_analysis_records"
                          name="门户分析记录"
                          stroke={CHART_COLORS.analysis}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="user_feedback_submissions"
                          name="用户反馈"
                          stroke={CHART_COLORS.feedback}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : !loading ? (
        <p className="text-sm text-secondary-text">暂无数据</p>
      ) : (
        <p className="text-sm text-secondary-text">加载中…</p>
      )}
    </div>
  );
};

export default BusinessMetricsPage;
