import { API_BASE_URL } from './constants';

const THROTTLE_MS = 2500;
const STORAGE_KEY = 'dsa_pv_last_admin';

/**
 * 路由变化时上报 PV（豁免接口；依赖服务端下发 HttpOnly visitor Cookie）。
 */
export async function reportAdminPageView(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }
  const path = `${window.location.pathname}${window.location.search}`;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const prev = JSON.parse(raw) as { path?: string; t?: number };
      if (prev.path === path && typeof prev.t === 'number' && Date.now() - prev.t < THROTTLE_MS) {
        return;
      }
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ path, t: Date.now() }));
  } catch {
    /* ignore quota */
  }
  const url = `${API_BASE_URL}/api/v1/public/analytics/page-view`;
  try {
    await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ path, surface: 'admin' }),
    });
  } catch {
    /* 埋点失败不影响页面 */
  }
}
