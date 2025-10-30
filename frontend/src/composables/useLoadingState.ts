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

  // 🔧 追蹤是否已經經歷過加載過程（loading 從 true 變為 false）
  const hasEverLoaded = ref(false)

  // 🎯 優化的初始載入狀態管理
  // 關鍵改進：只在真正完成過一次加載後才標記為已加載
  // 避免 WebSocket 連接成功但 HTTP 請求未完成時顯示錯誤的空狀態
  watch(
    [
      () => sseIsConnected.value,
      () => httpMessagesCount.value,
      () => shouldUseWebSocket.value && wsIsJoined.value,
      () => isLoading.value
    ],
    ([_sseConnected, messagesCount, _wsConnected, loading]) => {
      // 🔧 追蹤加載過程：當 loading = true 時，標記已經開始加載
      if (loading) {
        hasEverLoaded.value = true
      }

      const hasMessages = messagesCount > 0
      const loadingCompleted = hasEverLoaded.value && !loading

      // 標記為已加載的條件（修復後）：
      // 1. 有消息已加載 (messagesCount > 0)
      // 2. 或者已經完成過一次加載（loading 曾經是 true，現在是 false）
      //
      // ❌ 移除的錯誤邏輯：(hasConnection && !loading)
      //    這會在 WebSocket 連接成功但 HTTP 未完成時觸發
      const shouldMarkLoaded = hasMessages || loadingCompleted

      if (shouldMarkLoaded && !hasLoadedInitially.value) {
        hasLoadedInitially.value = true
        isInitialLoading.value = false
      } else if (!shouldMarkLoaded && loading) {
        // 仍在加載中
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
    hasEverLoaded.value = false // 🔧 重置加載追蹤狀態
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