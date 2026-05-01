import { apiFetch } from './http';

export type AuthStatusResponse = {
  authEnabled: boolean;
  loggedIn: boolean;
  passwordSet?: boolean;
  passwordChangeable?: boolean;
  setupState: 'enabled' | 'password_retained' | 'no_password';
  /** 与开关解耦：表示 C 端邮箱能力常驻；仍为 true */
  portalAuthEnabled?: boolean;
  portalLoggedIn?: boolean;
  userEmail?: string | null;
  userName?: string | null;
};

/** 仅管理员认证开启时需先登录再放行应用 Shell。门户邮箱登录不单独触发此门槛。 */
export function gatewayRequiresLogin(status: AuthStatusResponse): boolean {
  return Boolean(status.authEnabled);
}

/** 不需管理员门禁时已视为可进应用；需门禁时需管理员会话或门户 Cookie。 */
export function isGatewayLoggedIn(status: AuthStatusResponse): boolean {
  if (!gatewayRequiresLogin(status)) {
    return true;
  }
  if (status.authEnabled && status.loggedIn) {
    return true;
  }
  return Boolean(status.portalLoggedIn);
}

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  const res = await apiFetch('/api/v1/auth/status');
  if (!res.ok) {
    throw new Error(`auth status ${res.status}`);
  }
  return res.json() as Promise<AuthStatusResponse>;
}

export async function portalLogin(email: string, password: string): Promise<void> {
  const res = await apiFetch('/api/v1/auth/portal/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
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

export async function portalRegister(
  username: string,
  email: string,
  password: string,
  passwordConfirm: string,
): Promise<void> {
  const res = await apiFetch('/api/v1/auth/portal/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email,
      password,
      passwordConfirm,
    }),
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

export async function logout(status: Pick<AuthStatusResponse, 'authEnabled' | 'loggedIn'>): Promise<void> {
  await apiFetch('/api/v1/auth/portal/logout', { method: 'POST' }).catch(() => undefined);
  if (status.authEnabled && status.loggedIn) {
    await apiFetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
  }
}
