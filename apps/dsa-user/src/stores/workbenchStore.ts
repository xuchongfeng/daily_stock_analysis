import { create } from 'zustand';

import { workbenchAnalysisApi, DuplicateTaskErrorWorkbench } from '../api/workbenchAnalysis';
import { workbenchHistoryApi } from '../api/workbenchHistory';
import { getParsedApiError } from '../api/error';
import { getRecentStartDateWorkbench, getTodayInShanghaiWorkbench } from '../utils/workbenchFormat';
import {
  isObviouslyInvalidStockQueryWorkbench,
  looksLikeStockCodeWorkbench,
  validateStockCodeWorkbench,
} from '../utils/workbenchValidation';
import type { AnalysisReport, HistoryItem, HistoryListResponse, TaskInfo } from '../types/workbenchAnalysis';

const PAGE_SIZE = 20;

type SelectionSource = 'manual' | 'autocomplete' | 'import' | 'image';

type FetchHistoryOptions = {
  autoSelectFirst?: boolean;
  reset?: boolean;
  silent?: boolean;
};

type SubmitAnalysisOptions = {
  stockCode?: string;
  stockName?: string;
  originalQuery?: string;
  selectionSource?: SelectionSource;
  notify?: boolean;
};

let reportRequestSeq = 0;
let analyzeRequestSeq = 0;
let historyRequestSeq = 0;
const dismissedTaskIds = new Set<string>();

export interface WorkbenchPoolState {
  query: string;
  selectionSource: SelectionSource;
  notify: boolean;
  inputError?: string;
  duplicateError: string | null;
  error: ReturnType<typeof getParsedApiError> | null;
  isAnalyzing: boolean;
  historyItems: HistoryItem[];
  selectedHistoryIds: number[];
  isDeletingHistory: boolean;
  isLoadingHistory: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  currentPage: number;
  selectedReport: AnalysisReport | null;
  isLoadingReport: boolean;
  activeTasks: TaskInfo[];
  markdownDrawerOpen: boolean;
  /** 左侧列表：代码/名称关键词（配合 mine 仅看我提交的） */
  historyListFilterQ: string;
  setQuery: (query: string) => void;
  setHistoryListFilterQ: (q: string) => void;
  clearError: () => void;
  clearInlineMessages: () => void;
  openMarkdownDrawer: () => void;
  closeMarkdownDrawer: () => void;
  loadInitialHistory: () => Promise<void>;
  refreshHistory: (silent?: boolean) => Promise<void>;
  loadMoreHistory: () => Promise<void>;
  selectHistoryItem: (recordId: number) => Promise<void>;
  toggleHistorySelection: (recordId: number) => void;
  toggleSelectAllVisible: () => void;
  deleteSelectedHistory: () => Promise<void>;
  submitAnalysis: (options?: SubmitAnalysisOptions) => Promise<void>;
  setNotify: (notify: boolean) => void;
  syncTaskCreated: (task: TaskInfo) => void;
  syncTaskUpdated: (task: TaskInfo) => void;
  syncTaskFailed: (task: TaskInfo) => void;
  removeTask: (taskId: string) => void;
  resetDashboardState: () => void;
}

const initialState = {
  query: '',
  selectionSource: 'manual' as SelectionSource,
  notify: true,
  inputError: undefined,
  duplicateError: null,
  error: null,
  isAnalyzing: false,
  historyItems: [] as HistoryItem[],
  selectedHistoryIds: [] as number[],
  isDeletingHistory: false,
  isLoadingHistory: false,
  isLoadingMore: false,
  hasMore: true,
  currentPage: 1,
  selectedReport: null as AnalysisReport | null,
  isLoadingReport: false,
  activeTasks: [] as TaskInfo[],
  markdownDrawerOpen: false,
  historyListFilterQ: '',
};

function buildHistoryParams(page: number, get: () => WorkbenchPoolState) {
  const q = get().historyListFilterQ.trim();
  return {
    startDate: getRecentStartDateWorkbench(30),
    endDate: getTodayInShanghaiWorkbench(),
    page,
    limit: PAGE_SIZE,
    mine: true,
    ...(q ? { q } : {}),
  };
}

async function fetchHistory(
  get: () => WorkbenchPoolState,
  set: (partial: Partial<WorkbenchPoolState>) => void,
  options: FetchHistoryOptions = {},
): Promise<HistoryListResponse | null> {
  const { autoSelectFirst = false, reset = true, silent = false } = options;
  const currentState = get();
  const page = reset ? 1 : currentState.currentPage + 1;
  const requestId = ++historyRequestSeq;

  if (!silent) {
    set(
      reset
        ? { isLoadingHistory: true, isLoadingMore: false, currentPage: 1 }
        : { isLoadingMore: true },
    );
  }

  try {
    const response = await workbenchHistoryApi.getList(buildHistoryParams(page, get));
    if (requestId !== historyRequestSeq) {
      return null;
    }

    if (silent && reset) {
      const existingIds = new Set(get().historyItems.map((item) => item.id));
      const newItems = response.items.filter((item) => !existingIds.has(item.id));
      if (newItems.length > 0) {
        set({ historyItems: [...newItems, ...get().historyItems] });
      }
    } else if (reset) {
      set({
        historyItems: response.items,
        currentPage: 1,
      });
    } else {
      set({
        historyItems: [...get().historyItems, ...response.items],
        currentPage: page,
      });
    }

    if (!silent) {
      const totalLoaded = reset ? response.items.length : get().historyItems.length;
      set({ hasMore: totalLoaded < response.total });
    }

    const visibleIds = new Set(get().historyItems.map((item) => item.id));
    set({
      selectedHistoryIds: get().selectedHistoryIds.filter((id) => visibleIds.has(id)),
    });

    if (autoSelectFirst && response.items.length > 0 && !get().selectedReport) {
      await get().selectHistoryItem(response.items[0].id);
    }

    return response;
  } catch (error) {
    if (requestId !== historyRequestSeq) {
      return null;
    }
    set({ error: getParsedApiError(error) });
    return null;
  } finally {
    if (requestId === historyRequestSeq) {
      set({
        isLoadingHistory: false,
        isLoadingMore: false,
      });
    }
  }
}

export const useWorkbenchStore = create<WorkbenchPoolState>((set, get) => ({
  ...initialState,

  setQuery: (query) => {
    set({
      query,
      selectionSource: 'manual',
      inputError: undefined,
      duplicateError: null,
    });
  },

  clearError: () => set({ error: null }),

  clearInlineMessages: () => set({ inputError: undefined, duplicateError: null }),

  setNotify: (notify) => set({ notify }),

  setHistoryListFilterQ: (historyListFilterQ) => set({ historyListFilterQ }),

  openMarkdownDrawer: () => set({ markdownDrawerOpen: true }),

  closeMarkdownDrawer: () => set({ markdownDrawerOpen: false }),

  loadInitialHistory: async () => {
    await fetchHistory(get, set, { autoSelectFirst: true, reset: true });
  },

  refreshHistory: async (silent = false) => {
    await fetchHistory(get, set, { reset: true, silent });
  },

  loadMoreHistory: async () => {
    const state = get();
    if (state.isLoadingMore || !state.hasMore) {
      return;
    }
    await fetchHistory(get, set, { reset: false });
  },

  selectHistoryItem: async (recordId) => {
    const requestId = ++reportRequestSeq;
    const shouldShowInitialLoading = !get().selectedReport;

    if (shouldShowInitialLoading) {
      set({ isLoadingReport: true });
    }

    try {
      const report = await workbenchHistoryApi.getDetail(recordId);
      if (requestId !== reportRequestSeq) {
        return;
      }

      set({
        selectedReport: report,
        error: null,
        isLoadingReport: false,
      });
    } catch (error) {
      if (requestId !== reportRequestSeq) {
        return;
      }

      set({
        error: getParsedApiError(error),
        isLoadingReport: false,
      });
    }
  },

  toggleHistorySelection: (recordId) => {
    const selected = new Set(get().selectedHistoryIds);
    if (selected.has(recordId)) {
      selected.delete(recordId);
    } else {
      selected.add(recordId);
    }

    set({ selectedHistoryIds: Array.from(selected) });
  },

  toggleSelectAllVisible: () => {
    const visibleIds = get().historyItems.map((item) => item.id);
    const selectedIds = get().selectedHistoryIds;
    const visibleSet = new Set(visibleIds);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    set({
      selectedHistoryIds: allSelected
        ? selectedIds.filter((id) => !visibleSet.has(id))
        : Array.from(new Set([...selectedIds, ...visibleIds])),
    });
  },

  deleteSelectedHistory: async () => {
    const state = get();
    const recordIds = Array.from(new Set(state.selectedHistoryIds));
    if (recordIds.length === 0 || state.isDeletingHistory) {
      return;
    }

    set({ isDeletingHistory: true });
    try {
      await workbenchHistoryApi.deleteRecords(recordIds);

      const deletedIds = new Set(recordIds);
      const selectedWasDeleted =
        state.selectedReport?.meta.id !== undefined && deletedIds.has(state.selectedReport.meta.id);

      set({ selectedHistoryIds: [] });

      const freshPage = await fetchHistory(get, set, { reset: true });

      if (selectedWasDeleted) {
        const nextItem = freshPage?.items?.[0];
        if (nextItem) {
          await get().selectHistoryItem(nextItem.id);
        } else {
          set({ selectedReport: null });
        }
      }
    } catch (error) {
      set({ error: getParsedApiError(error) });
    } finally {
      set({ isDeletingHistory: false });
    }
  },

  submitAnalysis: async (options) => {
    const state = get();
    const rawStockCode = options?.stockCode ?? state.query;
    const stockCodeInput = rawStockCode.trim();
    const stockName = options?.stockName;
    const selectionSource = options?.selectionSource ?? state.selectionSource;
    const originalQuery = (options?.originalQuery ?? state.query).trim();
    const notify = options?.notify ?? state.notify;

    if (!stockCodeInput) {
      set({ inputError: '请输入股票代码', duplicateError: null });
      return;
    }

    if (selectionSource !== 'autocomplete' && isObviouslyInvalidStockQueryWorkbench(stockCodeInput)) {
      set({ inputError: '请输入有效的股票代码或股票名称', duplicateError: null });
      return;
    }

    let normalizedStockCode = stockCodeInput;
    if (selectionSource === 'autocomplete' || looksLikeStockCodeWorkbench(stockCodeInput)) {
      const { valid, message, normalized } = validateStockCodeWorkbench(stockCodeInput);
      if (!valid) {
        set({ inputError: message, duplicateError: null });
        return;
      }
      normalizedStockCode = normalized;
    }

    set({
      inputError: undefined,
      duplicateError: null,
      error: null,
      isAnalyzing: true,
    });

    const requestId = ++analyzeRequestSeq;
    try {
      await workbenchAnalysisApi.analyzeAsync({
        stockCode: normalizedStockCode,
        reportType: 'detailed',
        stockName,
        originalQuery: originalQuery || stockCodeInput,
        selectionSource,
        notify,
      });

      if (requestId !== analyzeRequestSeq) {
        return;
      }

      set({
        query: '',
        selectionSource: 'manual',
      });
    } catch (error) {
      if (requestId !== analyzeRequestSeq) {
        return;
      }

      if (error instanceof DuplicateTaskErrorWorkbench) {
        set({
          duplicateError: `股票 ${error.stockCode} 正在分析中，请等待完成`,
        });
        return;
      }

      set({ error: getParsedApiError(error) });
    } finally {
      if (requestId === analyzeRequestSeq) {
        set({ isAnalyzing: false });
      }
    }
  },

  syncTaskCreated: (task) => {
    if (dismissedTaskIds.has(task.taskId)) {
      return;
    }
    if (get().activeTasks.some((item) => item.taskId === task.taskId)) {
      return;
    }
    set({ activeTasks: [...get().activeTasks, task] });
  },

  syncTaskUpdated: (task) => {
    if (dismissedTaskIds.has(task.taskId)) {
      return;
    }
    const nextTasks = [...get().activeTasks];
    const index = nextTasks.findIndex((item) => item.taskId === task.taskId);
    if (index >= 0) {
      nextTasks[index] = task;
      set({ activeTasks: nextTasks });
    }
  },

  syncTaskFailed: (task) => {
    get().syncTaskUpdated(task);
    set({ error: getParsedApiError(task.error || '分析失败') });
  },

  removeTask: (taskId) => {
    dismissedTaskIds.add(taskId);
    set({ activeTasks: get().activeTasks.filter((task) => task.taskId !== taskId) });
  },

  resetDashboardState: () => {
    historyRequestSeq += 1;
    reportRequestSeq = 0;
    analyzeRequestSeq = 0;
    dismissedTaskIds.clear();
    set({ ...initialState });
  },
}));
