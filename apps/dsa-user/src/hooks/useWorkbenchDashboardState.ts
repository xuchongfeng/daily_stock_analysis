import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useWorkbenchStore } from '../stores/workbenchStore';

export function useWorkbenchDashboardState() {
  const dashboardState = useWorkbenchStore(
    useShallow((state) => ({
      query: state.query,
      inputError: state.inputError,
      duplicateError: state.duplicateError,
      error: state.error,
      isAnalyzing: state.isAnalyzing,
      historyItems: state.historyItems,
      selectedHistoryIds: state.selectedHistoryIds,
      isDeletingHistory: state.isDeletingHistory,
      isLoadingHistory: state.isLoadingHistory,
      isLoadingMore: state.isLoadingMore,
      hasMore: state.hasMore,
      selectedReport: state.selectedReport,
      isLoadingReport: state.isLoadingReport,
      activeTasks: state.activeTasks,
      markdownDrawerOpen: state.markdownDrawerOpen,
      historyListFilterQ: state.historyListFilterQ,
      notify: state.notify,
      setQuery: state.setQuery,
      setNotify: state.setNotify,
      setHistoryListFilterQ: state.setHistoryListFilterQ,
      clearError: state.clearError,
      loadInitialHistory: state.loadInitialHistory,
      refreshHistory: state.refreshHistory,
      loadMoreHistory: state.loadMoreHistory,
      selectHistoryItem: state.selectHistoryItem,
      toggleHistorySelection: state.toggleHistorySelection,
      toggleSelectAllVisible: state.toggleSelectAllVisible,
      deleteSelectedHistory: state.deleteSelectedHistory,
      submitAnalysis: state.submitAnalysis,
      syncTaskCreated: state.syncTaskCreated,
      syncTaskUpdated: state.syncTaskUpdated,
      syncTaskFailed: state.syncTaskFailed,
      removeTask: state.removeTask,
      openMarkdownDrawer: state.openMarkdownDrawer,
      closeMarkdownDrawer: state.closeMarkdownDrawer,
    })),
  );

  const selectedIds = useMemo(
    () => new Set(dashboardState.selectedHistoryIds),
    [dashboardState.selectedHistoryIds],
  );

  return {
    ...dashboardState,
    selectedIds,
  };
}
