import apiClient from './index';

export type BusinessMetricsDTO = {
  calendar_date: string;
  page_views_today: number;
  unique_visitors_today: number;
  portal_registrations_today: number;
  portal_users_total: number;
  agent_chat_user_messages_today: number;
  portal_analysis_records_today: number;
  user_feedback_submissions_today: number;
};

export type BusinessMetricsDailyRowDTO = {
  calendar_date: string;
  page_views: number;
  unique_visitors: number;
  portal_registrations: number;
  agent_chat_user_messages: number;
  portal_analysis_records: number;
  user_feedback_submissions: number;
};

export type BusinessMetricsDailySeriesDTO = {
  start_date: string;
  end_date: string;
  days: number;
  series: BusinessMetricsDailyRowDTO[];
};

export async function fetchBusinessMetrics(): Promise<BusinessMetricsDTO> {
  const res = await apiClient.get<BusinessMetricsDTO>('/api/v1/system/business-metrics');
  return res.data;
}

export async function fetchBusinessMetricsDaily(days: number): Promise<BusinessMetricsDailySeriesDTO> {
  const res = await apiClient.get<BusinessMetricsDailySeriesDTO>('/api/v1/system/business-metrics/daily', {
    params: { days },
  });
  return res.data;
}
