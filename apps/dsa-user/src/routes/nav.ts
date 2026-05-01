/** 主导航（登录后可见），路径为 basename 下的绝对段 */
export const MAIN_NAV = [
  { to: '/today', label: '今日' },
  { to: '/watchlist', label: '自选' },
  { to: '/chat', label: '问股' },
  { to: '/portfolio', label: '持仓' },
  { to: '/discover', label: '发现' },
  { to: '/review', label: '复盘' },
  { to: '/account', label: '账户' },
] as const;
