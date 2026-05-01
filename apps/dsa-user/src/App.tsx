import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import { AuthProvider, useAuth } from './auth/AuthContext';
import { MarketingLayout } from './components/MarketingLayout';
import { ShellLayout } from './components/ShellLayout';
import { AccountPage } from './pages/AccountPage';
import { ChatPage } from './pages/ChatPage';
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

/** 仅未登录可访问营销站；已登录访问任一路由均进应用首页 */
function GuestOnly() {
  const { loading, status } = useAuth();
  if (loading || !status) {
    return <Loading />;
  }
  if (status.loggedIn) {
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
  if (status.authEnabled && !status.loggedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return (
    <ShellLayout>
      <Outlet />
    </ShellLayout>
  );
}

/** 未匹配路径：未登录回营销首页；已登录回今日；未启用认证回今日 */
function WildcardFallback() {
  const { loading, status } = useAuth();
  if (loading || !status) {
    return <Loading />;
  }
  if (!status.authEnabled) {
    return <Navigate to="/today" replace />;
  }
  if (status.loggedIn) {
    return <Navigate to="/today" replace />;
  }
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  const { loading, status } = useAuth();
  if (loading || !status) {
    return <Loading />;
  }

  if (!status.authEnabled) {
    return (
      <Routes>
        <Route element={<SessionShell />}>
          <Route path="today" element={<TodayPage />} />
          <Route path="watchlist" element={<WatchlistPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="discover" element={<DiscoverPage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route element={<MarketingLayout />}>
          <Route index element={<HomePage />} />
          <Route path="features" element={<FeaturesPage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="performance" element={<PerformancePage />} />
          <Route path="login" element={<LoginPage />} />
        </Route>
      </Route>
      <Route element={<SessionShell />}>
        <Route path="today" element={<TodayPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="chat" element={<ChatPage />} />
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
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
