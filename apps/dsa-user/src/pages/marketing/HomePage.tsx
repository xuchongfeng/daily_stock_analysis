import { Link } from 'react-router-dom';

import { APP_DISPLAY_NAME } from '../../constants/product';

/** 营销首页：概览 + 进入各子页的入口 */
export function HomePage() {
  return (
    <div className="page-stack">
      <section className="hero-block">
        <h1 className="hero-title">{APP_DISPLAY_NAME}</h1>
        <p className="hero-lead">
          面向自选股与持仓的 AI 复盘与决策辅助。先通过下方入口了解能力边界与方案；开启访问控制后，请前往「登录」进入今日、自选、问股等功能。
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
          <Link to="/features" className="link-card">
            <h3>功能介绍</h3>
            <p>今日、自选、问股、持仓、发现、复盘等模块说明与适用场景。</p>
            <span className="link-card-more">查看</span>
          </Link>
          <Link to="/pricing" className="link-card">
            <h3>定价方案</h3>
            <p>体验（¥0）、专业（¥199/月）、团队（面议）三档能力与对比。</p>
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
