import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  BarChart3,
  BriefcaseBusiness,
  LayoutDashboard,
  LineChart,
  Bookmark,
  LogOut,
  MessageSquareQuote,
  Settings2,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAgentChatStore } from '../../stores/agentChatStore';
import { cn } from '../../utils/cn';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { StatusDot } from '../common/StatusDot';
import { ThemeToggle } from '../theme/ThemeToggle';

type SidebarNavProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
};

type NavItem = {
  key: string;
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: 'completion';
};

const NAV_ITEMS: NavItem[] = [
  { key: 'signal-digest', label: '信号摘要', to: '/', icon: LayoutDashboard, exact: true },
  { key: 'analyze', label: '分析工作台', to: '/analyze', icon: LineChart },
  { key: 'watchlist', label: '我的自选', to: '/watchlist', icon: Bookmark },
  { key: 'chat', label: '问股', to: '/chat', icon: MessageSquareQuote, badge: 'completion' },
  { key: 'portfolio', label: '持仓', to: '/portfolio', icon: BriefcaseBusiness },
  { key: 'backtest', label: '回测', to: '/backtest', icon: BarChart3 },
  { key: 'market-scanner', label: '榜单扫描', to: '/market-scanner', icon: TrendingUp },
  { key: 'ths-concept-crawl', label: '概念爬取', to: '/ths-concept-crawl', icon: Layers },
  { key: 'settings', label: '设置', to: '/settings', icon: Settings2 },
];

export const SidebarNav: React.FC<SidebarNavProps> = ({ collapsed = false, onNavigate }) => {
  const { authEnabled, logout } = useAuth();
  const completionBadge = useAgentChatStore((state) => state.completionBadge);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className={cn('mb-4 flex items-center gap-2 px-1', collapsed ? 'justify-center' : '')}>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-gradient text-[hsl(var(--primary-foreground))] shadow-[0_12px_28px_var(--nav-brand-shadow)]">
          <BarChart3 className="h-5 w-5" />
        </div>
        {!collapsed ? (
          <p className="min-w-0 truncate text-sm font-semibold text-foreground">DSA</p>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-1.5" aria-label="主导航">
        {NAV_ITEMS.map(({ key, label, to, icon: Icon, exact, badge }) => (
          <NavLink
            key={key}
            to={to}
            end={exact}
            onClick={onNavigate}
            aria-label={label}
            className={({ isActive }) =>
              cn(
                'group relative flex min-w-0 w-full items-stretch border-y border-x-0 text-sm transition-all',
                'h-[var(--nav-item-height)]',
                collapsed ? 'justify-center px-0' : 'gap-1.5 px-2',
                isActive
                  ? 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)] text-[hsl(var(--primary))] font-medium'
                  : 'border-transparent text-secondary-text hover:bg-[var(--nav-hover-bg)] hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                {!collapsed ? (
                  <motion.div
                    layoutId="activeIndicator"
                    className={cn(
                      'my-1 w-[var(--nav-indicator-width)] shrink-0 self-stretch rounded-r-sm',
                      isActive
                        ? 'bg-[var(--nav-indicator-bg)] shadow-[0_0_10px_var(--nav-indicator-shadow)]'
                        : 'pointer-events-none opacity-0',
                    )}
                    aria-hidden
                    initial={false}
                    transition={{ duration: 0.2 }}
                  />
                ) : null}
                <span
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-2',
                    collapsed ? 'justify-center' : '',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      isActive ? 'text-[var(--nav-icon-active)]' : 'text-current',
                    )}
                  />
                  {!collapsed ? (
                    <span className="min-w-0 flex-1 truncate text-left leading-tight">{label}</span>
                  ) : null}
                </span>
                {badge === 'completion' && completionBadge ? (
                  <StatusDot
                    tone="info"
                    data-testid="chat-completion-badge"
                    className={cn(
                      'pointer-events-none absolute right-2 top-1/2 z-[3] -translate-y-1/2 border-2 border-background shadow-[0_0_10px_var(--nav-indicator-shadow)]',
                      collapsed ? 'right-2 top-2 translate-y-0' : '',
                    )}
                    aria-label="问股有新消息"
                  />
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 mb-2">
        <ThemeToggle variant="nav" collapsed={collapsed} />
      </div>

      {authEnabled ? (
        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className={cn(
            'mt-5 flex h-11 w-full cursor-pointer select-none items-center gap-3 rounded-2xl border border-transparent px-3 text-sm text-secondary-text transition-all hover:border-border/70 hover:bg-hover hover:text-foreground',
            collapsed ? 'justify-center px-2' : ''
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed ? <span>退出</span> : null}
        </button>
      ) : null}

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="退出登录"
        message="确认退出当前登录状态吗？退出后需要重新输入密码。"
        confirmText="确认退出"
        cancelText="取消"
        isDanger
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onNavigate?.();
          void logout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
};
