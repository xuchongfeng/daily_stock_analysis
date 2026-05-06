import { apiFetch } from './http';

export type PortalNotificationPrefs = {
  emailEnabled: boolean;
  dingtalkWebhook: string;
  feishuWebhook: string;
  dailyDigest: boolean;
  analysisPush: boolean;
};

export type PortalAccountLimits = {
  aiAnalysisMonth: number;
  watchlistMax: number;
  stockSearchMonth: number;
};

export type PortalAccountUsage = {
  calendarMonth: string;
  analysisCountMonth: number;
  stockSearchCountMonth: number;
};

export type PortalAccountResponse = {
  email: string;
  username: string;
  avatarUrl: string | null;
  notificationPrefs: PortalNotificationPrefs;
  planTier: string;
  planLabel: string;
  limits: PortalAccountLimits;
  usage: PortalAccountUsage;
};

export type PortalAccountPatchBody = {
  username?: string;
  avatarUrl?: string | null;
  notificationPrefs?: Partial<PortalNotificationPrefs>;
};

export type StockSearchUsageResponse = {
  calendarMonth: string;
  stockSearchCountMonth: number;
  stockSearchMonthLimit: number;
  overLimit: boolean;
};

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { message?: string };
    return j.message || res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function getPortalAccount(): Promise<PortalAccountResponse> {
  const res = await apiFetch('/api/v1/auth/portal/account');
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json() as Promise<PortalAccountResponse>;
}

export async function patchPortalAccount(body: PortalAccountPatchBody): Promise<PortalAccountResponse> {
  const res = await apiFetch('/api/v1/auth/portal/account', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json() as Promise<PortalAccountResponse>;
}

export async function changePortalPassword(
  currentPassword: string,
  newPassword: string,
  newPasswordConfirm: string,
): Promise<void> {
  const res = await apiFetch('/api/v1/auth/portal/account/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentPassword,
      newPassword,
      newPasswordConfirm,
    }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
}

/** 从自动补全选中一支股票时调用；失败静默（未登录或网络错误）。 */
export type PortalPlanUpgradeResponse = {
  orderId: number;
  message: string;
};

/** 提交套餐升级意向（无在线支付，后端落库后由客服跟进）。 */
export async function submitPortalPlanUpgrade(body: {
  targetTier: string;
  note?: string;
}): Promise<PortalPlanUpgradeResponse> {
  const payload: Record<string, unknown> = { targetTier: body.targetTier };
  if (body.note != null && String(body.note).trim() !== '') {
    payload.note = String(body.note).trim();
  }
  const res = await apiFetch('/api/v1/auth/portal/account/plan-upgrade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json() as Promise<PortalPlanUpgradeResponse>;
}

export async function recordPortalStockSearch(): Promise<StockSearchUsageResponse | null> {
  const res = await apiFetch('/api/v1/auth/portal/account/usage/stock-search', {
    method: 'POST',
  });
  if (!res.ok) {
    return null;
  }
  return res.json() as Promise<StockSearchUsageResponse>;
}
