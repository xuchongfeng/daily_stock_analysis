import type React from 'react';
import { Navigate } from 'react-router-dom';

/** @deprecated 使用 /data-crawl */
const ThsConceptCrawlPage: React.FC = () => <Navigate to="/data-crawl" replace />;

export default ThsConceptCrawlPage;
