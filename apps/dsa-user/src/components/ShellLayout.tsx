import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';

import { useAuth } from '../auth/AuthContext';
import { MAIN_NAV } from '../routes/nav';
import { useWatchlistStore } from '../stores/watchlistStore';
import { SiteBanner } from './SiteBanner';
import { ShellUserMenu } from './ShellUserMenu';

export function ShellLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  /** 门户 / 管理员会话切换时重拉自选来源（门户为每用户 DB，否则全局文件） */
  const watchScopeKey = useMemo(
    () =>
      [
        status?.portalLoggedIn === true ? '1' : '0',
        status?.loggedIn === true ? '1' : '0',
        status?.userEmail ?? '',
      ].join('|'),
    [status?.portalLoggedIn, status?.loggedIn, status?.userEmail],
  );

  useEffect(() => {
    void useWatchlistStore.getState().fetch();
  }, [watchScopeKey]);

  const appNav = MAIN_NAV.map((item) => ({
    to: item.to,
    label: item.label,
    end: item.to === '/today',
  }));

  return (
    <div className="app-shell">
      <SiteBanner homeTo="/today" nav={appNav} trailing={<ShellUserMenu />} />
      <main className="main">{children}</main>
      <footer className="foot">本页为使用者站点；能力与数据以部署环境与账号权限为准。</footer>
    </div>
  );
}
