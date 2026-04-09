import type { TaskStatus } from '../types/analysis';

const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_MAX_WAIT_MS = 15 * 60 * 1000;

/**
 * 轮询异步分析任务直到完成、失败或超时。
 */
export async function pollAnalysisTask(
  taskId: string,
  getStatus: (id: string) => Promise<TaskStatus>,
  options?: { intervalMs?: number; maxWaitMs?: number; signal?: AbortSignal }
): Promise<TaskStatus> {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxWaitMs = options?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const signal = options?.signal;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    if (signal?.aborted) {
      throw new Error('Aborted');
    }
    const status = await getStatus(taskId);
    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }

  throw new Error(`分析任务等待超时（>${Math.round(maxWaitMs / 60000)} 分钟）`);
}
