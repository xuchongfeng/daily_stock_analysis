import { apiFetch } from './http';
import { createApiError, parseApiError } from './error';

export type SubmitUserFeedbackBody = {
  message: string;
  contact?: string;
  page_url?: string;
};

export async function submitUserFeedback(body: SubmitUserFeedbackBody): Promise<{ id: number; ok: boolean }> {
  const res = await apiFetch('/api/v1/public/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      message: body.message,
      contact: body.contact?.trim() || undefined,
      page_url: body.page_url?.trim() || undefined,
    }),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const bogus = Object.assign(new Error('request failed'), {
      response: { status: res.status, data: raw },
    });
    throw createApiError(parseApiError(bogus));
  }
  return raw as { id: number; ok: boolean };
}
