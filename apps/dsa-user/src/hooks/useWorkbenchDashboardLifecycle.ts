import { useEffect, useRef } from 'react';

import type { TaskInfo } from '../types/workbenchAnalysis';
import { useWorkbenchTaskStream } from './useWorkbenchTaskStream';

type Options = {
  loadInitialHistory: () => Promise<void>;
  refreshHistory: (silent?: boolean) => Promise<void>;
  syncTaskCreated: (task: TaskInfo) => void;
  syncTaskUpdated: (task: TaskInfo) => void;
  syncTaskFailed: (task: TaskInfo) => void;
  removeTask: (taskId: string) => void;
  enabled?: boolean;
};

export function useWorkbenchDashboardLifecycle({
  loadInitialHistory,
  refreshHistory,
  syncTaskCreated,
  syncTaskUpdated,
  syncTaskFailed,
  removeTask,
  enabled = true,
}: Options): void {
  const removalTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void loadInitialHistory();
  }, [enabled, loadInitialHistory]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void refreshHistory(true);
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [enabled, refreshHistory]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshHistory(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, refreshHistory]);

  useEffect(() => {
    return () => {
      removalTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      removalTimeoutsRef.current = [];
    };
  }, []);

  const scheduleTaskRemoval = (taskId: string, delayMs: number) => {
    const timeoutId = window.setTimeout(() => {
      removeTask(taskId);
      removalTimeoutsRef.current = removalTimeoutsRef.current.filter((item) => item !== timeoutId);
    }, delayMs);
    removalTimeoutsRef.current.push(timeoutId);
  };

  useWorkbenchTaskStream({
    onTaskCreated: syncTaskCreated,
    onTaskStarted: syncTaskUpdated,
    onTaskProgress: syncTaskUpdated,
    onTaskCompleted: (task) => {
      syncTaskUpdated(task);
      void refreshHistory(true);
      scheduleTaskRemoval(task.taskId, 2_000);
    },
    onTaskFailed: (task) => {
      syncTaskFailed(task);
      scheduleTaskRemoval(task.taskId, 5_000);
    },
    onError: () => {
      console.warn('Workbench SSE disconnected, reconnecting...');
    },
    enabled,
  });
}
