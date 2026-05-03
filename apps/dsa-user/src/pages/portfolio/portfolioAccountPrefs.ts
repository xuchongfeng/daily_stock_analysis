/**
 * 账户级前端偏好（暂无后端字段）：批量体检意图、分析任务是否带推送。
 * 结构变更时请 bump STORAGE_KEY 版本以免脏读。
 */
const STORAGE_KEY = 'dsa_user_portfolio_account_prefs_v1';

export type PortfolioAccountPrefs = {
  /** 是否在汇总表展示「参与体检」偏好（明细页批量体检仍须手动点击） */
  enableBatchCheckup: boolean;
  /** 批量体检/analysisAsync 是否传 notify=true */
  dailyAnalysisNotify: boolean;
};

const DEFAULT_PREFS: PortfolioAccountPrefs = {
  enableBatchCheckup: true,
  dailyAnalysisNotify: false,
};

function readAll(): Record<string, PortfolioAccountPrefs> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, PortfolioAccountPrefs>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, PortfolioAccountPrefs>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export function getPortfolioAccountPrefs(accountId: number): PortfolioAccountPrefs {
  const key = String(accountId);
  const all = readAll();
  const row = all[key];
  if (!row || typeof row !== 'object') return { ...DEFAULT_PREFS };
  return {
    enableBatchCheckup:
      typeof row.enableBatchCheckup === 'boolean' ? row.enableBatchCheckup : DEFAULT_PREFS.enableBatchCheckup,
    dailyAnalysisNotify:
      typeof row.dailyAnalysisNotify === 'boolean' ? row.dailyAnalysisNotify : DEFAULT_PREFS.dailyAnalysisNotify,
  };
}

export function setPortfolioAccountPrefs(accountId: number, patch: Partial<PortfolioAccountPrefs>): PortfolioAccountPrefs {
  const key = String(accountId);
  const all = readAll();
  const next = { ...getPortfolioAccountPrefs(accountId), ...patch };
  all[key] = next;
  writeAll(all);
  return next;
}
