import type { ReactNode } from 'react';

import { MAIN_NAV } from '../routes/nav';
import { SiteBanner } from './SiteBanner';
import { ShellUserMenu } from './ShellUserMenu';

export function ShellLayout({ children }: { children: ReactNode }) {
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
