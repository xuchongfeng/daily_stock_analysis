import { Link } from 'react-router-dom';

import { StockDemoCard } from '../../components/marketing/StockDemoCard';
import { MARKETING_STOCK_DEMO_COUNT, useMarketingStockDemo } from '../../hooks/useMarketingStockDemo';

/** 营销一级页：个股分析示例（公开接口拉取最多 3 条，卡片摘要展示） */
export function StockDemoPage() {
  const { reports, labels, source, loading, error } = useMarketingStockDemo();

  const sourceTag =
    source === 'scanner' ? '榜单样本' : source === 'history' ? '分析库样本' : '示例';

  return (
    <div className="page-stack features-page stock-demo-page">
      <h1 className="page-h1">个股分析示例</h1>
      <p className="page-lead">
        下列为<strong>无需登录</strong>即可浏览的示例摘要（最多 {MARKETING_STOCK_DEMO_COUNT}{' '}
        只），结构与登录后工作台报告同源；完整字段与追问能力请登录后使用。
      </p>

      {loading ? (
        <p className="page-lead stock-demo-page-status" aria-busy="true">
          正在加载示例…
        </p>
      ) : null}

      {error && !loading ? (
        <section className="stock-demo-page-empty">
          <p>
            暂时无法加载示例（{error.message || '网络或服务异常'}）。请确认 API 可访问；亦可{' '}
            <Link to="/login">登录</Link> 后在工作台查看完整报告。
          </p>
        </section>
      ) : null}

      {!loading && !error && reports.length === 0 ? (
        <section className="stock-demo-page-empty">
          <p>
            当前环境暂无榜单扫描数据，且分析历史为空。部署并完成分析或榜单任务后将展示示例卡片；您也可以先{' '}
            <Link to="/login">登录</Link> 使用工作台发起分析。
          </p>
        </section>
      ) : null}

      {!loading && !error && reports.length > 0 ? (
        <>
          {source === 'scanner' ? (
            <p className="page-lead stock-demo-page-source-lead">
              当前样本来自最近<strong>榜单扫描</strong>批次（优先成交量榜），按情绪分取前若干标的对应的分析报告。
            </p>
          ) : source === 'history' ? (
            <p className="page-lead stock-demo-page-source-lead">
              当前暂无可用榜单批次，样本来自<strong>近期公开分析库</strong>记录。
            </p>
          ) : null}
          <div className="feature-grid features-page-grid stock-demo-page-grid">
            {reports.map((r, i) => (
              <StockDemoCard
                key={`${r.meta.queryId}-${i}`}
                report={r}
                headerLabel={labels[i]}
                sourceTag={sourceTag}
              />
            ))}
          </div>
        </>
      ) : null}

      <p className="page-disclaimer stock-demo-page-disclaimer">
        本页为演示摘要，结论仅供研究参考，不构成任何投资建议。市场有风险，决策需谨慎。
      </p>
    </div>
  );
}
