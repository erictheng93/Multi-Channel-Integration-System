import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'

interface LoadingStateOptions {
  sseIsConnected: ComputedRef<boolean> | { value: boolean }
  wsIsJoined: ComputedRef<boolean> | { value: boolean }
  httpMessagesCount: ComputedRef<number> | { value: number }
  shouldUseWebSocket: ComputedRef<boolean> | { value: boolean }
  isLoading: ComputedRef<boolean> | { value: boolean }
}

export interface LoadingState {
  // 載入狀態
  hasLoadedInitially: Ref<boolean>
  isInitialLoading: Ref<boolean>
  loadingHistory: Ref<boolean>

  // 載入控制函數
  markAsLoaded: () => void
  resetLoadingState: () => void
  setHistoryLoading: (_loading: boolean) => void

  // 狀態檢查
  isFullyLoaded: ComputedRef<boolean>
  loadingProgress: ComputedRef<number>
}

/**
 * 統一的載入狀態管理 composable
 * 管理初始載入、歷史載入等狀態
 */
export function useLoadingState(options: LoadingStateOptions): LoadingState {
  const {
    sseIsConnected,
    wsIsJoined,
    httpMessagesCount,
    shouldUseWebSocket,
    isLoading
  } = options

  // 載入狀態
  const hasLoadedInitially = ref(false)
  const isInitialLoading = ref(true)
  const loadingHistory = ref(false)

  // 自動同步初始載入狀態
  watch(
    [
      () => sseIsConnected.value,
      () => httpMessagesCount.value,
      () => shouldUseWebSocket.value && wsIsJoined.value,
      () => isLoading.value
    ],
    ([sseConnected, messagesCount, wsConnected, loading]) => {
      const shouldMarkLoaded = sseConnected || messagesCount > 0 || wsConnected

      if (shouldMarkLoaded && !hasLoadedInitially.value) {
        hasLoadedInitially.value = true
        isInitialLoading.value = false
      } else if (!shouldMarkLoaded && loading) {
        isInitialLoading.value = !hasLoadedInitially.value
      }
    },
    { immediate: true }
  )

  // 載入控制函數
  const markAsLoaded = () => {
    hasLoadedInitially.value = true
    isInitialLoading.value = false
  }

  const resetLoadingState = () => {
    hasLoadedInitially.value = false
    isInitialLoading.value = true
    loadingHistory.value = false
  }

  const setHistoryLoading = (loading: boolean) => {
    loadingHistory.value = loading
  }

  // 計算屬性
  const isFullyLoaded = computed(() => {
    return hasLoadedInitially.value && !isInitialLoading.value && !loadingHistory.value
  })

  const loadingProgress = computed(() => {
    if (!hasLoadedInitially.value) {return 0}
    if (isInitialLoading.value) {return 50}
    if (loadingHistory.value) {return 75}
    return 100
  })

  return {
    // 載入狀態
    hasLoadedInitially,
    isInitialLoading,
    loadingHistory,

    // 控制函數
    markAsLoaded,
    resetLoadingState,
    setHistoryLoading,

    // 計算屬性
    isFullyLoaded,
    loadingProgress
  }
}