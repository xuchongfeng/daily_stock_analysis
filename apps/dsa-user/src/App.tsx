import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from './auth/AuthContext';
import { useAgentChatStore } from './stores/agentChatStore';
import { gatewayRequiresLogin, isGatewayLoggedIn } from './api/authApi';
import { MarketingLayout } from './components/MarketingLayout';
import { ShellLayout } from './components/ShellLayout';
import { AccountPage } from './pages/AccountPage';
import { ChatHubPage } from './pages/ChatHubPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { DiscoverConceptBoardsPage } from './pages/DiscoverConceptBoardsPage';
import { DiscoverIndustryChainDetailPage } from './pages/DiscoverIndustryChainDetailPage';
import { DiscoverIndustryChainEditPage } from './pages/DiscoverIndustryChainEditPage';
import { DiscoverIndustryChainsPage } from './pages/DiscoverIndustryChainsPage';
import { DiscoverHotEventDetailPage } from './pages/DiscoverHotEventDetailPage';
import { DiscoverHotEventsPage } from './pages/DiscoverHotEventsPage';
import { PortfolioAccountDetailPage } from './pages/portfolio/PortfolioAccountDetailPage';
import { PortfolioHubPage } from './pages/portfolio/PortfolioHubPage';
import { PortfolioLedgerPage } from './pages/portfolio/PortfolioLedgerPage';
import { PortfolioRiskPage } from './pages/portfolio/PortfolioRiskPage';
import { BacktestPage } from './pages/BacktestPage';
import { TodayPage } from './pages/TodayPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { FeaturesPage } from './pages/marketing/FeaturesPage';
import { HomePage } from './pages/marketing/HomePage';
import { LoginPage } from './pages/marketing/LoginPage';
import { PerformancePage } from './pages/marketing/PerformancePage';
import { PricingPage } from './pages/marketing/PricingPage';
import { ReviewsPage } from './pages/marketing/ReviewsPage';
import { StockDemoPage } from './pages/marketing/StockDemoPage';
import { reportPortalPageView } from './utils/analytics';

function Loading() {
  return <div className="loading-screen">加载中…</div>;
}

function RouteSync() {
  const location = useLocation();
  useEffect(() => {
    useAgentChatStore.getState().setCurrentRoute(location.pathname);
  }, [location.pathname]);
  return null;
}

function PortalAnalyticsBeacon() {
  const location = useLocation();
  useEffect(() => {
    void reportPortalPageView();
  }, [location.pathname, location.search]);
  return null;
}

/** requireGuest=true（管理员门禁开）时已登录则不能逛营销路由；关闭门禁时照常展示营销页。 */
function MarketingEntryGate({ requireGuest }: { requireGuest: boolean }) {
  const { loading, status } = useAuth();
  if (!requireGuest) {
    return <Outlet />;
  }
  if (loading || !status) {
    return <Loading />;
  }
  if (isGatewayLoggedIn(status)) {
    return <Navigate to="/today" replace />;
  }
  return <Outlet />;
}

function SessionShell() {
  const { loading, status } = useAuth();
  const location = useLocation();
  if (loading || !status) {
    return <Loading />;
  }
  if (gatewayRequiresLogin(status) && !isGatewayLoggedIn(status)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return (
    <ShellLayout>
      <Outlet />
    </ShellLayout>
  );
}

function WildcardFallback() {
  const { loading, status } = useAuth();
  if (loading || !status) {
    return <Loading />;
  }
  if (!gatewayRequiresLogin(status)) {
    return <Navigate to="/today" replace />;
  }
  if (isGatewayLoggedIn(status)) {
    return <Navigate to="/today" replace />;
  }
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  const { loading, status } = useAuth();
  if (loading || !status) {
    return <Loading />;
  }

  const requireGuestGate = gatewayRequiresLogin(status);

  return (
    <Routes>
      <Route element={<MarketingEntryGate requireGuest={requireGuestGate} />}>
        <Route element={<MarketingLayout />}>
          <Route index element={<HomePage />} />
          <Route path="features" element={<FeaturesPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="performance" element={<PerformancePage />} />
          <Route path="analysis-demo" element={<StockDemoPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<Navigate to="/login?tab=register" replace />} />
        </Route>
      </Route>
      <Route element={<SessionShell />}>
        <Route path="today" element={<TodayPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="chat" element={<ChatHubPage />} />
        <Route path="portfolio" element={<Outlet />}>
          <Route index element={<PortfolioHubPage />} />
          <Route path="account/:accountId" element={<PortfolioAccountDetailPage />} />
          <Route path="account/:accountId/ledger" element={<PortfolioLedgerPage />} />
          <Route path="account/:accountId/risk" element={<PortfolioRiskPage />} />
        </Route>
        <Route path="discover" element={<Outlet />}>
          <Route index element={<DiscoverPage />} />
          <Route path="sectors" element={<DiscoverConceptBoardsPage />} />
          <Route path="chains/new" element={<DiscoverIndustryChainEditPage />} />
          <Route path="chains/:slug/edit" element={<DiscoverIndustryChainEditPage />} />
          <Route path="chains/:slug" element={<DiscoverIndustryChainDetailPage />} />
          <Route path="chains" element={<DiscoverIndustryChainsPage />} />
          <Route path="events" element={<DiscoverHotEventsPage />} />
          <Route path="events/:slug" element={<DiscoverHotEventDetailPage />} />
        </Route>
        <Route path="backtest" element={<BacktestPage />} />
        <Route path="review" element={<Navigate to="/backtest" replace />} />
        <Route path="account" element={<AccountPage />} />
      </Route>
      <Route path="*" element={<WildcardFallback />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PortalAnalyticsBeacon />
        <RouteSync />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
