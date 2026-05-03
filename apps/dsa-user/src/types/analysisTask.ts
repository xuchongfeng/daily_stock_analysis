import type { AnalysisReport } from './workbenchAnalysis';

/** 与 `/api/v1/analysis/status/{taskId}` 对齐（camelCase 由客户端转换） */
export interface AnalysisTaskResultBody {
  queryId: string;
  stockCode: string;
  stockName: string;
  report: AnalysisReport;
  createdAt: string;
}

export interface TaskStatusBody {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: AnalysisTaskResultBody;
  error?: string;
  stockName?: string;
  originalQuery?: string;
  selectionSource?: string;
}
