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
import { PortfolioPage } from './pages/PortfolioPage';
import { ReviewPage } from './pages/ReviewPage';
import { TodayPage } from './pages/TodayPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { FeaturesPage } from './pages/marketing/FeaturesPage';
import { HomePage } from './pages/marketing/HomePage';
import { LoginPage } from './pages/marketing/LoginPage';
import { PerformancePage } from './pages/marketing/PerformancePage';
import { PricingPage } from './pages/marketing/PricingPage';
import { ReviewsPage } from './pages/marketing/ReviewsPage';

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
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<Navigate to="/login?tab=register" replace />} />
        </Route>
      </Route>
      <Route element={<SessionShell />}>
        <Route path="today" element={<TodayPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="chat" element={<ChatHubPage />} />
        <Route path="portfolio" element={<PortfolioPage />} />
        <Route path="discover" element={<DiscoverPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>
      <Route path="*" element={<WildcardFallback />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/user">
      <AuthProvider>
        <RouteSync />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
