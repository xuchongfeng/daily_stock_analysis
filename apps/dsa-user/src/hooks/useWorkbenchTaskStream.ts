import { useEffect, useRef, useCallback, useState } from 'react';

import { workbenchAnalysisApi } from '../api/workbenchAnalysis';
import type { TaskInfo } from '../types/workbenchAnalysis';

export type WorkbenchSSEEventType =
  | 'connected'
  | 'task_created'
  | 'task_started'
  | 'task_progress'
  | 'task_completed'
  | 'task_failed'
  | 'heartbeat';

export interface UseWorkbenchTaskStreamOptions {
  onTaskCreated?: (task: TaskInfo) => void;
  onTaskStarted?: (task: TaskInfo) => void;
  onTaskCompleted?: (task: TaskInfo) => void;
  onTaskProgress?: (task: TaskInfo) => void;
  onTaskFailed?: (task: TaskInfo) => void;
  onConnected?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  enabled?: boolean;
}

function toTaskInfo(data: Record<string, unknown>): TaskInfo {
  return {
    taskId: data.task_id as string,
    stockCode: data.stock_code as string,
    stockName: data.stock_name as string | undefined,
    status: data.status as TaskInfo['status'],
    progress: data.progress as number,
    message: data.message as string | undefined,
    reportType: data.report_type as string,
    createdAt: data.created_at as string,
    startedAt: data.started_at as string | undefined,
    completedAt: data.completed_at as string | undefined,
    error: data.error as string | undefined,
    originalQuery: data.original_query as string | undefined,
    selectionSource: data.selection_source as string | undefined,
  };
}

export function useWorkbenchTaskStream(options: UseWorkbenchTaskStreamOptions = {}): {
  isConnected: boolean;
  reconnect: () => void;
  disconnect: () => void;
} {
  const {
    onTaskCreated,
    onTaskStarted,
    onTaskCompleted,
    onTaskProgress,
    onTaskFailed,
    onConnected,
    onError,
    autoReconnect = true,
    reconnectDelay = 3000,
    enabled = true,
  } = options;

  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<() => void>(() => {});

  const callbacksRef = useRef({
    onTaskCreated,
    onTaskStarted,
    onTaskCompleted,
    onTaskProgress,
    onTaskFailed,
    onConnected,
    onError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onTaskCreated,
      onTaskStarted,
      onTaskCompleted,
      onTaskProgress,
      onTaskFailed,
      onConnected,
      onError,
    };
  });

  const parseEventData = useCallback((eventData: string): TaskInfo | null => {
    try {
      const data = JSON.parse(eventData) as Record<string, unknown>;
      return toTaskInfo(data);
    } catch (e) {
      console.error('Failed to parse SSE event data:', e);
      return null;
    }
  }, []);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = workbenchAnalysisApi.getTaskStreamUrl();
    const eventSource = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', () => {
      setIsConnected(true);
      callbacksRef.current.onConnected?.();
    });

    eventSource.addEventListener('task_created', (e) => {
      const task = parseEventData(e.data);
      if (task) callbacksRef.current.onTaskCreated?.(task);
    });

    eventSource.addEventListener('task_started', (e) => {
      const task = parseEventData(e.data);
      if (task) callbacksRef.current.onTaskStarted?.(task);
    });

    eventSource.addEventListener('task_progress', (e) => {
      const task = parseEventData(e.data);
      if (task) callbacksRef.current.onTaskProgress?.(task);
    });

    eventSource.addEventListener('task_completed', (e) => {
      const task = parseEventData(e.data);
      if (task) callbacksRef.current.onTaskCompleted?.(task);
    });

    eventSource.addEventListener('task_failed', (e) => {
      const task = parseEventData(e.data);
      if (task) callbacksRef.current.onTaskFailed?.(task);
    });

    eventSource.addEventListener('heartbeat', () => {});

    eventSource.onerror = (error) => {
      setIsConnected(false);
      callbacksRef.current.onError?.(error);

      if (autoReconnect && enabled) {
        eventSource.close();
        reconnectTimeoutRef.current = setTimeout(() => {
          connectRef.current();
        }, reconnectDelay);
      }
    };
  }, [autoReconnect, reconnectDelay, enabled, parseEventData]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    queueMicrotask(() => setIsConnected(false));
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    connect();
  }, [disconnect, connect]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    reconnect,
    disconnect,
  };
}
