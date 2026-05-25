import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export function DiscoverPage() {
  useEffect(() => {
    document.title = '发现';
  }, []);

  return (
    <div className="stack discover-hub-page">
      <section className="card">
        <h1 className="h1">发现</h1>
        <p className="lead today-muted">浏览结构化市场线索：板块热度、成分股与 AI 摘要标签（持续接入更多能力）。</p>
      </section>

      <section className="card discover-hub-grid">
        <Link to="/discover/sectors" className="discover-hub-card">
          <h2 className="discover-hub-card-title">板块探索</h2>
          <p className="discover-hub-card-desc">
            概念板块热度排序（买持覆盖、量榜高分、成分数量），查看板块内个股最近评分、操作建议与行业/概念标签。与管理后台「概念板块」同源接口。
          </p>
          <span className="discover-hub-card-cta">进入板块探索 →</span>
        </Link>

        <Link to="/discover/chains" className="discover-hub-card">
          <h2 className="discover-hub-card-title">核心产业链</h2>
          <p className="discover-hub-card-desc">
            重点产业链结构化梳理：名称、介绍、最新新闻/进展与核心个股列表；管理员可在前端直接新增维护，并支持 CSV/文本批量导入个股。
          </p>
          <span className="discover-hub-card-cta">进入核心产业链 →</span>
        </Link>

        <Link to="/discover/events" className="discover-hub-card">
          <h2 className="discover-hub-card-title">热点事件</h2>
          <p className="discover-hub-card-desc">
            策展主题脉络：事件演进时间线、关联概念板块与代表性个股、核心数据摘要；数据由种子 JSON / 脚本导入维护。
          </p>
          <span className="discover-hub-card-cta">查看热点事件 →</span>
        </Link>

        <div className="discover-hub-card discover-hub-card-muted">
          <h2 className="discover-hub-card-title">榜单与市场扫描</h2>
          <p className="discover-hub-card-desc">接入中，后续可与工作台扫描任务联动。</p>
        </div>
      </section>
    </div>
  );
}
