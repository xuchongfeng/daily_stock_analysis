import type React from 'react';
import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Database } from 'lucide-react';
import { ThsConceptDataPanel } from './ThsConceptDataPanel';

const DataCrawlPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const legacySectorTab = searchParams.get('tab') === 'sector-volume';

  useEffect(() => {
    document.title = '数据爬取 - DSA';
  }, []);

  if (legacySectorTab) {
    return <Navigate to="/sector-volume-analysis" replace />;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-gradient text-[hsl(var(--primary-foreground))] shadow-[0_12px_28px_var(--nav-brand-shadow)]">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">数据爬取</h1>
          <p className="mt-1 max-w-3xl text-sm text-secondary-text">
            同花顺概念目录与成分等网页爬取落库结果（<code className="rounded bg-hover px-1 text-xs">crawler_ths_*</code>
            ）。CLI{' '}
            <code className="rounded bg-hover px-1 text-xs">python main.py --crawl ths-concept</code>，详见{' '}
            <code className="rounded bg-hover px-1 text-xs">docs/crawler.md</code>。
            <span className="mt-1 block text-secondary-text">
              仅浏览<strong className="font-medium text-foreground">板块与成分股</strong>（不查看爬取运行明细）请使用侧栏
              <strong className="font-medium text-foreground">「板块与成交量」</strong>。
            </span>
          </p>
        </div>
      </header>

      <ThsConceptDataPanel />
    </div>
  );
};

export default DataCrawlPage;
