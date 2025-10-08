/**
 * 即時通訊配置模組
 * 統一管理 WebSocket 和 SSE 配置
 */

export interface RealtimeConfig {
  // WebSocket 配置 (100% rollout, SSE removed in Phase 1-2)
  websocketEnabled: boolean
  websocketUrl: string
  websocketAutoReconnect: boolean
  websocketDebug: boolean

  // REMOVED: SSE 配置 (Phase 1-2 cleanup)
  // fallbackToSSE: boolean
  // sseUrl: string

  // 通用配置
  heartbeatInterval: number
  maxReconnectAttempts: number
  reconnectDelay: number
  connectionTimeout: number
}

/**
 * 從環境變數載入即時通訊配置
 */
export function loadRealtimeConfig(): RealtimeConfig {
  // REMOTE-ONLY: Always use remote API
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://multi-channel.imfinethankyouandyou.com'

  // 解析 WebSocket URL (將 https:// 轉換為 wss://)
  const websocketUrl = import.meta.env.VITE_WEBSOCKET_URL ||
    `${apiBaseUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')  }/ws`

  return {
    // WebSocket 配置 (100% rollout)
    websocketEnabled: import.meta.env.VITE_WEBSOCKET_ENABLED !== 'false', // Default to true
    websocketUrl,
    websocketAutoReconnect: import.meta.env.VITE_WEBSOCKET_AUTO_RECONNECT !== 'false',
    websocketDebug: import.meta.env.VITE_WEBSOCKET_DEBUG === 'true',

    // 通用配置
    heartbeatInterval: 30000, // 30 seconds
    maxReconnectAttempts: 10,
    reconnectDelay: 2000, // 2 seconds
    connectionTimeout: 10000 // 10 seconds
  }
}

/**
 * 即時通訊配置實例 (單例模式)
 */
export const realtimeConfig = loadRealtimeConfig()

/**
 * 檢查是否應該使用 WebSocket (Always true at 100% rollout)
 */
export function shouldUseWebSocket(): boolean {
  return realtimeConfig.websocketEnabled
}

// REMOVED: SSE fallback functions (Phase 1-2 cleanup)
// export function shouldFallbackToSSE(): boolean {
//   return realtimeConfig.fallbackToSSE
// }

/**
 * 取得當前使用的通訊協議 (WebSocket only)
 */
export function getCurrentProtocol(): 'websocket' {
  return 'websocket'
}

/**
 * 取得連線 URL (WebSocket only)
 */
export function getConnectionUrl(): string {
  return realtimeConfig.websocketUrl
}

/**
 * 即時通訊配置資訊 (WebSocket only)
 */
export function getConfigInfo() {
  return {
    protocol: getCurrentProtocol(),
    url: getConnectionUrl(),
    websocketEnabled: realtimeConfig.websocketEnabled,
    debug: realtimeConfig.websocketDebug
  }
}
