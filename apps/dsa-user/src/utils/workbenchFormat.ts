/** 与后台一致：按上海时区返回 YYYY-MM-DD */
export function getRecentStartDateWorkbench(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(date);
}

export function getTodayInShanghaiWorkbench(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

export function formatWorkbenchDateTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatReportTypeWorkbench(value?: string): string {
  if (!value) return '—';
  if (value === 'simple') return '普通';
  if (value === 'detailed') return '标准';
  return value;
}
