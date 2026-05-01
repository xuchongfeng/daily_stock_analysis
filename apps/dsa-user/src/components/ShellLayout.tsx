import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { logout } from '../api/authApi';
import { MAIN_NAV } from '../routes/nav';
import { SiteBanner } from './SiteBanner';

export function ShellLayout({ children }: { children: ReactNode }) {
  const { status, refresh } = useAuth();
  const navigate = useNavigate();
  const showLogout = Boolean(status?.authEnabled && status?.loggedIn);

  async function onLogout() {
    try {
      await logout();
    } catch {
      /* ignore */
    }
    await refresh();
    navigate('/', { replace: true });
  }

  const appNav = MAIN_NAV.map((item) => ({
    to: item.to,
    label: item.label,
    end: item.to === '/today',
  }));

  return (
    <div className="app-shell">
      <SiteBanner
        homeTo="/today"
        nav={appNav}
        trailing={
          showLogout ? (
            <button type="button" className="btn-logout" onClick={() => void onLogout()}>
              退出登录
            </button>
          ) : null
        }
      />
      <main className="main">{children}</main>
      <footer className="foot">本页为使用者站点；能力与数据以部署环境与账号权限为准。</footer>
    </div>
  );
}
