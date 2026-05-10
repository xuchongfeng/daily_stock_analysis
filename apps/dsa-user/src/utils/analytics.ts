import { apiFetch } from '../api/http';

const THROTTLE_MS = 2500;
const STORAGE_KEY = 'dsa_pv_last_portal';

/** C 端 SPA 路由变化时上报 PV（与后台同源 Cookie 策略一致）。 */
export async function reportPortalPageView(): Promise<void> {
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
    /* ignore */
  }
  try {
    await apiFetch('/api/v1/public/analytics/page-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, surface: 'portal' }),
    });
  } catch {
    /* 埋点失败不影响页面 */
  }
}
