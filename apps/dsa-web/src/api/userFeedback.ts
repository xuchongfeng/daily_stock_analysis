import apiClient from './index';

export type UserFeedbackItem = {
  id: number;
  message: string;
  contact: string | null;
  portal_user_id: number | null;
  /** 门户登录用户提交时的注册邮箱 */
  portal_email: string | null;
  page_url: string | null;
  user_agent: string | null;
  created_at: string;
};

export type UserFeedbackListResponse = {
  total: number;
  page: number;
  limit: number;
  items: UserFeedbackItem[];
};

export async function fetchUserFeedbackList(params: {
  page?: number;
  limit?: number;
}): Promise<UserFeedbackListResponse> {
  const res = await apiClient.get<UserFeedbackListResponse>('/api/v1/system/user-feedback', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
    },
  });
  return res.data;
}
