import { computed, type ComputedRef } from 'vue'

interface ConnectionStateOptions {
  sseIsConnected: ComputedRef<boolean> | { value: boolean }
  sseIsConnecting: ComputedRef<boolean> | { value: boolean }
  sseIsReconnecting: ComputedRef<boolean> | { value: boolean }
  sseHasError: ComputedRef<boolean> | { value: boolean }
  wsIsJoined: ComputedRef<boolean> | { value: boolean }
  wsIsConnecting: ComputedRef<boolean> | { value: boolean }
  shouldUseWebSocket: ComputedRef<boolean> | { value: boolean }
}

export interface ConnectionState {
  // 主要連接狀態
  isConnected: ComputedRef<boolean>
  currentProtocol: ComputedRef<'sse' | 'websocket' | 'http'>
  connectionQuality: ComputedRef<'excellent' | 'good' | 'poor' | 'offline'>

  // 詳細狀態
  connectionState: ComputedRef<string>
  isAnyConnecting: ComputedRef<boolean>
  hasAnyError: ComputedRef<boolean>

  // 狀態檢查函數
  isUsingSSE: ComputedRef<boolean>
  isUsingWebSocket: ComputedRef<boolean>
  isUsingHTTP: ComputedRef<boolean>
}

/**
 * 統一的連接狀態管理 composable
 * 整合 SSE、WebSocket 和 HTTP 的連接狀態
 */
export function useConnectionState(options: ConnectionStateOptions): ConnectionState {
  const {
    sseIsConnected,
    sseIsConnecting,
    sseIsReconnecting,
    sseHasError,
    wsIsJoined,
    wsIsConnecting,
    shouldUseWebSocket
  } = options

  // 主要連接狀態
  const isConnected = computed(() => {
    return sseIsConnected.value ||
           (shouldUseWebSocket.value && wsIsJoined.value) ||
           (!shouldUseWebSocket.value && !sseHasError.value)
  })

  // 當前使用的協議
  const currentProtocol = computed((): 'sse' | 'websocket' | 'http' => {
    if (sseIsConnected.value) {return 'sse'}
    if (shouldUseWebSocket.value && wsIsJoined.value) {return 'websocket'}
    return 'http'
  })

  // 連接品質評估
  const connectionQuality = computed((): 'excellent' | 'good' | 'poor' | 'offline' => {
    if (sseIsConnected.value) {return 'excellent'} // SSE is always stable
    if (shouldUseWebSocket.value && wsIsJoined.value) {return 'good'}
    if (sseIsReconnecting.value || wsIsConnecting.value) {return 'poor'}
    if (sseHasError.value) {return 'offline'}
    return 'good' // HTTP fallback
  })

  // 詳細連接狀態
  const connectionState = computed(() => {
    if (sseIsConnected.value) {return 'sse_connected'}
    if (sseIsConnecting.value) {return 'sse_connecting'}
    if (sseIsReconnecting.value) {return 'sse_reconnecting'}
    if (shouldUseWebSocket.value && wsIsJoined.value) {return 'websocket_connected'}
    if (shouldUseWebSocket.value && wsIsConnecting.value) {return 'websocket_connecting'}
    if (sseHasError.value) {return 'error'}
    return 'http_fallback'
  })

  // 是否有任何連接正在進行
  const isAnyConnecting = computed(() => {
    return sseIsConnecting.value || sseIsReconnecting.value || wsIsConnecting.value
  })

  // 是否有任何錯誤
  const hasAnyError = computed(() => {
    return sseHasError.value
  })

  // 狀態檢查函數
  const isUsingSSE = computed(() => sseIsConnected.value)
  const isUsingWebSocket = computed(() => shouldUseWebSocket.value && wsIsJoined.value)
  const isUsingHTTP = computed(() => currentProtocol.value === 'http')

  return {
    // 主要狀態
    isConnected,
    currentProtocol,
    connectionQuality,

    // 詳細狀態
    connectionState,
    isAnyConnecting,
    hasAnyError,

    // 檢查函數
    isUsingSSE,
    isUsingWebSocket,
    isUsingHTTP
  }
}