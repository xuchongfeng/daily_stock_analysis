/**
 * C 端定价方案：免费、¥19、¥49、¥99 四档。
 * 下表配额与频次为产品与运营侧的**档位目标值**，用于前台对比说明；正式上线以账户后台、计费规则与用户协议为准。
 */

export type PricingTierId = 'free' | 'p19' | 'p49' | 'p99';

export type PricingTierColumn = {
  id: PricingTierId;
  label: string;
  priceHeadline: string;
  periodNote?: string;
  featured?: boolean;
};

export const PRICING_TIER_COLUMNS: PricingTierColumn[] = [
  {
    id: 'free',
    label: '免费',
    priceHeadline: '¥0',
    periodNote: '限额内长期使用',
  },
  {
    id: 'p19',
    label: '入门',
    priceHeadline: '¥19',
    periodNote: '/ 月 · 含税以公示为准',
  },
  {
    id: 'p49',
    label: '进阶',
    priceHeadline: '¥49',
    periodNote: '/ 月 · 含税以公示为准',
    featured: true,
  },
  {
    id: 'p99',
    label: '专业',
    priceHeadline: '¥99',
    periodNote: '/ 月 · 含税以公示为准',
  },
];

/** 对比表一行：首列文案 + 四档格子文案（尽量含可查数字） */
export type PricingCompareRow = { label: string } & Record<PricingTierId, string>;

/**
 * 行顺序说明：
 * - 「AI…」「自选」为硬性配额式数字；
 * - 「每日分析推送」对齐功能页「每日信息汇总与推送」——交易日送达自选/持仓复盘摘要；
 * - 「榜单类推送」对齐「榜单扫描/信号摘要」类摘要推送，与即时异动区分开。
 */
export const PRICING_COMPARE_ROWS: PricingCompareRow[] = [
  {
    label: 'AI 分析与问股合计（次/自然月）',
    free: '30',
    p19: '200',
    p49: '900',
    p99: '3000',
  },
  {
    label: '同时跟踪自选（上限·只）',
    free: '15',
    p19: '50',
    p49: '200',
    p99: '500',
  },
  {
    label: '持仓关联深度解读（次/自然月）',
    free: '—',
    p19: '5',
    p49: '40',
    p99: '150',
  },
  {
    label: '每日分析推送（自选/持仓复盘摘要）',
    free: '不含',
    p19: '每个交易日盘后 1 次 · 绑定 1 个通知渠道',
    p49: '每个交易日盘后 1 次 · 至多 3 个通知渠道',
    p99: '每个交易日 2 次（午间简讯 + 收盘完整复盘）· 至多 5 个通知渠道',
  },
  {
    label: '榜单类推送（信号/扫描主线摘要）',
    free: '不含',
    p19: '每周 1 封（自然周重置）· 单次约 Top20 条目',
    p49: '每个交易日 1 封 · 单次约 Top30 条目',
    p99: '每个交易日 2 封 · 单次约 Top50 条目',
  },
  {
    label: '榜单即时异动提醒（条/自然月）',
    free: '0',
    p19: '20',
    p49: '80',
    p99: '300',
  },
  {
    label: '历史报告与对话留存（天）',
    free: '7',
    p19: '30',
    p49: '90',
    p99: '365',
  },
  {
    label: '分析任务队列优先级',
    free: '标准（P3）',
    p19: '次级优先（P2）',
    p49: '优先（P1）',
    p99: '最高优先（P0）',
  },
  {
    label: '支持响应（工作日工单）',
    free: '仅文档',
    p19: '48 小时内首响',
    p49: '24 小时内首响',
    p99: '12 小时内首响',
  },
];
