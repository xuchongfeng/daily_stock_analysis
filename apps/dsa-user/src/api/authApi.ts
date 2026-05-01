import { apiFetch } from './http';

export type AuthStatusResponse = {
  authEnabled: boolean;
  loggedIn: boolean;
  passwordSet?: boolean;
  passwordChangeable?: boolean;
  setupState: 'enabled' | 'password_retained' | 'no_password';
};

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  const res = await apiFetch('/api/v1/auth/status');
  if (!res.ok) {
    throw new Error(`auth status ${res.status}`);
  }
  return res.json() as Promise<AuthStatusResponse>;
}

export async function login(password: string, passwordConfirm?: string): Promise<void> {
  const body: Record<string, string> = { password };
  if (passwordConfirm !== undefined) {
    body.passwordConfirm = passwordConfirm;
  }
  const res = await apiFetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { message?: string };
      if (j.message) {
        msg = j.message;
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

export async function logout(): Promise<void> {
  await apiFetch('/api/v1/auth/logout', { method: 'POST' });
}
