import { apiFetch } from './http';
import {
  createApiError,
  isApiRequestError,
  parseApiError,
} from './error';

export interface ChatStreamOptions {
  signal?: AbortSignal;
}

export interface ChatRequest {
  message: string;
  skills?: string[];
}

export interface ChatStreamRequest extends ChatRequest {
  session_id?: string;
  context?: unknown;
}

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
}

export interface SkillsResponse {
  skills: SkillInfo[];
  default_skill_id: string;
}

export interface ChatSessionItem {
  session_id: string;
  title: string;
  message_count: number;
  created_at: string | null;
  last_active: string | null;
}

export interface ChatSessionMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string | null;
}

async function readErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      return await response.json();
    }
    const text = await response.text();
    return text.trim() || null;
  } catch {
    return null;
  }
}

async function throwForBadResponse(response: Response): Promise<never> {
  const data = await readErrorBody(response);
  throw createApiError(
    parseApiError({
      response: {
        status: response.status,
        statusText: response.statusText,
        data,
      },
    }),
    {
      response: {
        status: response.status,
        statusText: response.statusText,
        data,
      },
    },
  );
}

export const agentApi = {
  async getSkills(): Promise<SkillsResponse> {
    const response = await apiFetch('/api/v1/agent/skills');
    if (!response.ok) {
      await throwForBadResponse(response);
    }
    return response.json() as Promise<SkillsResponse>;
  },

  async getChatSessions(limit = 50): Promise<ChatSessionItem[]> {
    const response = await apiFetch(`/api/v1/agent/chat/sessions?limit=${encodeURIComponent(String(limit))}`);
    if (!response.ok) {
      await throwForBadResponse(response);
    }
    const data = (await response.json()) as { sessions: ChatSessionItem[] };
    return data.sessions;
  },

  async getChatSessionMessages(sessionId: string): Promise<ChatSessionMessage[]> {
    const response = await apiFetch(`/api/v1/agent/chat/sessions/${encodeURIComponent(sessionId)}`);
    if (!response.ok) {
      await throwForBadResponse(response);
    }
    const data = (await response.json()) as { messages: ChatSessionMessage[] };
    return data.messages;
  },

  async deleteChatSession(sessionId: string): Promise<void> {
    const response = await apiFetch(`/api/v1/agent/chat/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      await throwForBadResponse(response);
    }
  },

  async sendChat(content: string): Promise<{ success: boolean }> {
    const response = await apiFetch('/api/v1/agent/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
    };
    if (!response.ok || data.success === false) {
      throw createApiError(
        parseApiError({
          response: {
            status: response.status,
            data,
          },
        }),
        {
          response: { status: response.status, data },
        },
      );
    }
    return { success: true };
  },

  async chatStream(
    payload: ChatStreamRequest,
    options?: ChatStreamOptions,
  ): Promise<Response> {
    try {
      const response = await fetch('/api/v1/agent/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
        signal: options?.signal,
      });

      if (response.ok) {
        return response;
      }

      const contentType = response.headers.get('content-type') || '';
      let responseData: unknown = null;
      if (contentType.includes('application/json')) {
        responseData = await response.json().catch(() => null);
      } else {
        responseData = await response.text().catch(() => null);
      }

      throw createApiError(
        parseApiError({
          response: {
            status: response.status,
            statusText: response.statusText,
            data: responseData,
          },
        }),
        {
          response: {
            status: response.status,
            statusText: response.statusText,
            data: responseData,
          },
        },
      );
    } catch (error: unknown) {
      if (isApiRequestError(error)) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw createApiError(parseApiError(error), { cause: error });
    }
  },
};
