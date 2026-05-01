import type { ReactNode } from 'react';

type FeatureItem = {
  id: string;
  title: string;
  tag?: string;
  body: ReactNode;
};

/** 以「能做什么」组织，面向使用者表述，不涉及实现细节或路径 */
const FEATURE_ITEMS: FeatureItem[] = [
  {
    id: 'markets-context',
    title: '跨市场行情与上下文整合',
    tag: '研究',
    body: (
      <>
        聚合 <strong>A 股、港股、美股</strong> 等市场行情与研究线索，串联大盘、板块与单票叙事，把零散公开信息收成一条<strong>可看、可查、可追溯</strong>的脉络。
      </>
    ),
  },
  {
    id: 'hotspot-events',
    title: '热点事件跟进与影响分析',
    tag: '热点',
    body: (
      <>
        对市场中的<strong>重大事件与舆情热点</strong>做<strong>持续性跟进</strong>：厘清时间线、主要矛盾与可能影响路径，并给出<strong>影响评估与风险提示</strong>。同时挑出与事件<strong>关联紧密的个股</strong>，把其与大盘、同行业及自身近期量价走势<strong>放在一起对照</strong>，帮助你看清「市场在交易什么逻辑」，而非只剩标题党式碎片。
      </>
    ),
  },
  {
    id: 'nlp-research',
    title: '自然语言研究与问策',
    tag: '交互',
    body: (
      <>
        用日常语言发起多轮<strong>提问、追问与策略讨论</strong>；在模型与检索能力就绪时，可围绕技术面、新闻与风险维度持续对话，把「想问的」说清楚、跟到底。
      </>
    ),
  },
  {
    id: 'watch-follow',
    title: '关注标的与日常跟踪',
    tag: '追踪',
    body: (
      <>
        建立属于你的<strong>关注清单</strong>，把真正在意的标的收在一处：集中查看动向、备忘录式要点与市场提示，适合做中长期跟踪，不必在零散收藏与聊天转发里翻来翻去。
      </>
    ),
  },
  {
    id: 'portfolio-insight',
    title: '持仓透视与组合摘要',
    tag: '组合',
    body: (
      <>
        在你愿意登记<strong>持仓与成本概况</strong>的前提下，从整体上看<strong>集中度、盈亏轮廓与风险提示</strong>；产品本身<strong>不涉及下单或代交易</strong>，只做研究与复盘辅助。
      </>
    ),
  },
  {
    id: 'holding-stock-analysis',
    title: '持仓关联的个股解读',
    tag: '个股',
    body: (
      <>
        针对你已持有的标的，按需生成<strong>更贴近仓位视角</strong>的解读：近况摘要、关键因素与与你的成本/仓位相匹配的复盘提示，帮助你把「单票噪音」拉回「这轮持有到底在等什么」。
      </>
    ),
  },
  {
    id: 'market-discovery',
    title: '榜单扫描与市场发现',
    tag: '发现',
    body: (
      <>
        按涨幅、成交、题材等维度做<strong>榜单与市场扫描</strong>，从更广的池子里发现线索；具体榜单类型与数据源以当期开放为准，并可与自选、持仓的研究路径衔接。
      </>
    ),
  },
  {
    id: 'daily-digest-push',
    title: '每日信息汇总与推送',
    tag: '日报',
    body: (
      <>
        将你关心的自选、持仓与市场要点，收成<strong>按日整理的摘要与时间线</strong>；可选通过<strong>消息推送或站内提醒</strong>送达（是否开通、频次与偏好以站点设置为准），减少漏看与通勤时的信息焦虑。
      </>
    ),
  },
  {
    id: 'audit-trace',
    title: '分析留痕与效果核对',
    tag: '验证',
    body: (
      <>
        对重要的分析结论与市场节点<strong>留痕存档</strong>，支持回看与对错照；命中率等统计可按版本披露方法说明，帮助你少靠记忆、多靠记录做复盘迭代。
      </>
    ),
  },
];

/** 功能介绍子页 · 卡片栅格（聚焦能力，而非界面模块） */
export function FeaturesPage() {
  return (
    <div className="page-stack features-page">
      <h1 className="page-h1">功能介绍</h1>
      <p className="page-lead">
        下列条目描述产品<strong>提供的能力与价值</strong>
        ，写的是「能帮用户做什么」，不绑定某一菜单名称；实际是否开放与您当前站点版本及服务配置有关。
      </p>

      <div className="feature-grid features-page-grid">
        {FEATURE_ITEMS.map((item) => (
          <article key={item.id} className="feature-card features-capability-card">
            {item.tag ? (
              <span className="feature-card-tag" aria-hidden="true">
                {item.tag}
              </span>
            ) : null}
            <h2 className="feature-card-heading">{item.title}</h2>
            <div className="feature-card-desc">{item.body}</div>
          </article>
        ))}
      </div>
    </div>
  );
}
