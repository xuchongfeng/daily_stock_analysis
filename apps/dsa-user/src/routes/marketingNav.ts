/** 未登录营销站主导航（与 App 内功能 Tab 分离） */
export const MARKETING_NAV = [
  { to: '/', label: '首页', end: true },
  { to: '/features', label: '功能介绍' },
  { to: '/pricing', label: '定价方案' },
  { to: '/reviews', label: '用户评价' },
  { to: '/performance', label: '回测效果' },
  { to: '/login', label: '登录 / 注册' },
] as const;
