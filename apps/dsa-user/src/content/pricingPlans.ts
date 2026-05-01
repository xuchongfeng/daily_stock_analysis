/**
 * C 端定价方案（与前期产品沟通一致的三档：体验 ¥0、专业 ¥199/月、团队面议）。
 * 限额类条款为产品化表述，落地时由部署方在后台或合同中约定具体数值。
 */

export type PricingPlan = {
  id: string;
  name: string;
  priceDisplay: string;
  periodNote: string;
  summary: string;
  bullets: string[];
  footnote?: string;
  featured?: boolean;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'trial',
    name: '体验',
    priceDisplay: '¥0',
    periodNote: '长期可试用（限额内）',
    summary: '适合先了解产品能力、低频跟踪自选的投资者。',
    bullets: [
      '基础行情与只读能力（随数据源与部署配置变化）',
      '每日分析请求次数与同时跟踪标的数量受限',
      '社区级支持（文档 / 常见问题）',
    ],
    footnote: '体验档不承诺 SLA；超出限额时任务可能排队或降级为摘要输出。',
  },
  {
    id: 'pro',
    name: '专业',
    priceDisplay: '¥199',
    periodNote: '每自然月 · 含税价以运营方公示为准',
    summary: '适合需要稳定复盘、较高频问股与自选管理的个人用户。',
    bullets: [
      '更高频 AI 分析与更大自选池上限（相对体验档提升）',
      '优先队列：同负载下分析任务优先进入执行（若部署开启队列）',
      '扩展存储：更长的历史报告与对话留痕保留周期（若开启持久化）',
      '邮件 / 站内通知等标准支持渠道（以实际开通为准）',
    ],
    footnote: '专业档为连续包月计费；可随时在运营规则允许范围内升降级，已扣费用按公示规则结算。',
    featured: true,
  },
  {
    id: 'team',
    name: '团队',
    priceDisplay: '面议',
    periodNote: '按席位 / 按年 / 定制',
    summary: '适合投研小组、家办与小团队：需要多账号协作与合规留痕。',
    bullets: [
      '多账号与基础角色分工（管理员 / 成员视实现而定）',
      '审计与导出：关键操作留痕、报告批量导出（能力随版本开放）',
      '定制数据源、专线接入与 SLA 另议',
      '可商议发票类型、对公结算与培训交付',
    ],
    footnote: '团队方案需联系部署方或商务；价格与交付范围以合同为准。',
  },
];

/** 与定价页对比表配套（与上表同一产品口径） */
export const PRICING_COMPARE_ROWS: { label: string; trial: string; pro: string; team: string }[] = [
  { label: '定位', trial: '入门体验', pro: '个人深度使用', team: '多人协作 / 机构向' },
  { label: '月费（参考）', trial: '¥0', pro: '¥199 / 月', team: '面议' },
  { label: '分析频次', trial: '低 · 限额内', pro: '高 · 明显提升上限', team: '按合同约定' },
  { label: '自选 / 标的规模', trial: '基础限额', pro: '扩展限额', team: '可定制池与权限' },
  { label: '队列优先级', trial: '标准', pro: '优先', team: '可约定专属或更高优先级' },
  { label: '数据留痕 / 存储', trial: '短周期', pro: '延长保留（若开启）', team: '合规归档与导出' },
  { label: '支持', trial: '自助文档', pro: '标准工单 / 邮件', team: '客户经理 + SLA 另议' },
];
