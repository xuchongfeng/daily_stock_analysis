import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

import { APP_DISPLAY_NAME, APP_TAGLINE } from '../constants/product';

export type BannerNavItem = {
  to: string;
  label: string;
  end?: boolean;
};

type SiteBannerProps = {
  /** 点击品牌回到的路径 */
  homeTo: string;
  nav: readonly BannerNavItem[];
  trailing?: ReactNode;
};

/** 复用同一套雪球风顶栏；营销站与登录后 App 仅导航项不同 */
export function SiteBanner({ homeTo, nav, trailing }: SiteBannerProps) {
  return (
    <header className="header">
      <div className="header-inner">
        <Link to={homeTo} className="brand brand-link" aria-label="返回首页">
          <span className="logo">{APP_DISPLAY_NAME}</span>
          <span className="sep" aria-hidden>
            ·
          </span>
          <span className="sub">{APP_TAGLINE}</span>
        </Link>
        <nav className="nav" aria-label="导航">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'navlink navlink-active' : 'navlink')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        {trailing ? <div className="header-actions">{trailing}</div> : null}
      </div>
    </header>
  );
}
