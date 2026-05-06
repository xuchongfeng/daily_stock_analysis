import { Link } from 'react-router-dom';

import { APP_DISPLAY_NAME } from '../../constants/product';

/** 营销首页：概览 + 进入各子页的入口 */
export function HomePage() {
  return (
    <div className="page-stack page-stack--marketing-home">
      <section className="hero-block">
        <p className="hero-kicker">{APP_DISPLAY_NAME}</p>
        <h1 className="hero-title">AI 赋能 · 智能平权</h1>
        <p className="hero-lead">
          <strong>以 AI 放大研究带宽、压低专业工具的使用门槛</strong>
          ：把复杂行情与研报线索，整理成可追问、可追溯的链路，让个人与小微团队也能接近机构级的信息组织与推演方式——这是我们的「智能平权」主张。
          产品覆盖<strong> A 股、港股与美股 </strong>
          ，贯通大盘与板块语境、标的叙事、量价与风险提示，并支持自然语言的<strong>问答与策略讨论</strong>；无论盯自选、管组合还是从市场广度里找机会，都能落到同一套工作台里。
        </p>
        <div className="hero-cta">
          <Link to="/features" className="btn-cta primary">
            功能介绍
          </Link>
          <Link to="/pricing" className="btn-cta ghost">
            定价方案
          </Link>
          <Link to="/login" className="btn-cta ghost">
            登录
          </Link>
        </div>
      </section>

      <section className="section-card">
        <h2 className="section-title">快速了解</h2>
        <div className="link-card-grid">
          <Link to="/analysis-demo" className="link-card">
            <h3>分析示例</h3>
            <p>无需登录即可浏览至多 3 只个股的分析摘要卡片（榜单样本优先，与工作台报告同源）。</p>
            <span className="link-card-more">查看</span>
          </Link>
          <Link to="/features" className="link-card">
            <h3>功能介绍</h3>
            <p>今日总览、自选与持仓、问股问答、发现与复盘等模块，覆盖看盘、研究与回顾全链路。</p>
            <span className="link-card-more">查看</span>
          </Link>
          <Link to="/pricing" className="link-card">
            <h3>定价方案</h3>
            <p>
              四档任选：<strong>免费</strong>限额内长期使用；付费为每自然月 <strong>¥19 / ¥49 / ¥99</strong>
              （含税以公示为准）。详情页用表格对比 AI 配额、自选上限、每日推送、榜单摘要与异动、留存与支持等。
            </p>
            <span className="link-card-more">查看</span>
          </Link>
          <Link to="/reviews" className="link-card">
            <h3>用户评价</h3>
            <p>来自个人投资者与交易者的使用反馈（示例展示，可替换为真实案例）。</p>
            <span className="link-card-more">查看</span>
          </Link>
          <Link to="/performance" className="link-card">
            <h3>回测效果</h3>
            <p>演示向的胜率、收益与风险指标；正式环境可对接贵司回测流水线。</p>
            <span className="link-card-more">查看</span>
          </Link>
        </div>
      </section>

      <p className="page-disclaimer">
        本站点分析结论仅供研究参考，不构成任何投资建议。市场有风险，决策需谨慎。
      </p>
    </div>
  );
}
