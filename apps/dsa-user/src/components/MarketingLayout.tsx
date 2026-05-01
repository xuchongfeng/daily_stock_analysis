import { Outlet } from 'react-router-dom';

import { MARKETING_NAV } from '../routes/marketingNav';
import { SiteBanner } from './SiteBanner';

export function MarketingLayout() {
  return (
    <div className="app-shell">
      <SiteBanner homeTo="/" nav={MARKETING_NAV} />
      <main className="main marketing-main">
        <Outlet />
      </main>
      <footer className="foot">
        展示信息仅供参考；套餐、限额与计费以部署方或运营公示为准。分析结论仅供研究参考，不构成投资建议。
      </footer>
    </div>
  );
}
