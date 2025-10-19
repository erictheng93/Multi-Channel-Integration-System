/**
 * 即時通訊 Composable
 * Phase 3: WebSocket-only real-time communication
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
// Phase 3: SSE removed - WebSocket only, no feature detection needed
import { realtimeConfig, getCurrentProtocol } from '@/config/realtime'
import { useAuthStore } from '@/stores/auth'

// WebSocket 客戶端 (動態導入)
import type { WebSocketManager as WebSocketManagerClass } from '@/services/websocketManager'
type WebSocketManagerType = typeof WebSocketManagerClass
let WebSocketManager: WebSocketManagerType | null = null

// REMOVED: SSEConnectionState interface (Phase 1-2 cleanup - SSE removed, WebSocket only)

/**
 * 即時通訊連線 Composable
 */
export function useRealtime(conversationId?: string) {
  const authStore = useAuthStore()

  // 連線狀態 (Phase 3: WebSocket only, no SSE)
  const protocol = ref<'websocket' | null>(null)
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const lastError = ref<Error | null>(null)
  const connectionUptime = ref(0)

  // WebSocket 管理器實例
  type WebSocketManagerInstance = InstanceType<WebSocketManagerType>
  let wsManager: WebSocketManagerInstance | null = null
  // REMOVED: SSE 連線實例 (Phase 1-2 cleanup - SSE removed, WebSocket only)

  /**
   * 連線到即時通訊服務
   * Phase 3: WebSocket only, no SSE fallback
   */
  async function connect() {
    if (isConnecting.value || isConnected.value) {
      console.warn('⚠️ [Realtime] Already connecting or connected')
      return
    }

    isConnecting.value = true
    lastError.value = null

    try {
      // Phase 3: WebSocket only (SSE removed)
      protocol.value = 'websocket'

      console.log(`🔌 [Realtime] Connecting using WebSocket...`)

      await connectWebSocket()

      isConnected.value = true
      isConnecting.value = false

      console.log(`✅ [Realtime] Connected successfully using WebSocket`)
    } catch (error) {
      console.error(`❌ [Realtime] Connection failed:`, error)
      lastError.value = error instanceof Error ? error : new Error('Connection failed')
      isConnecting.value = false
      throw error
    }
  }

  /**
   * 連線到 WebSocket
   */
  async function connectWebSocket() {
    try {
      // 動態導入 WebSocket Manager
      if (!WebSocketManager) {
        const module = await import('@/services/websocketManager')
        WebSocketManager = module.WebSocketManager
      }

      // 創建 WebSocket 管理器
      wsManager = new WebSocketManager()

      // 設置事件監聽器
      wsManager.setEventCallbacks({
        onConversationMessage: (_conversationId, message) => handleWebSocketMessage(message),
        onTypingStart: (_conversationId, userId) => handleTypingStart({ conversationId: _conversationId, userId }),
        onTypingStop: (_conversationId, userId) => handleTypingStop({ conversationId: _conversationId, userId }),
        onError: handleWebSocketError,
        onConnectionStateChange: (_state) => handleWebSocketDisconnect()
      })

      // 連線
      await wsManager.connect()

      // 如果有指定對話 ID，加入該對話
      if (conversationId) {
        wsManager.joinConversation(conversationId)
      }

      isConnected.value = true
    } catch (error) {
      console.error('❌ [Realtime] WebSocket connection failed:', error)
      throw error
    }
  }


  /**
   * 斷開連線
   * Phase 3: WebSocket only
   */
  function disconnect() {
    if (wsManager) {
      wsManager.disconnect()
      wsManager = null
    }

    isConnected.value = false
    protocol.value = null
  }

  /**
   * 發送訊息 (僅 WebSocket)
   */
  async function sendMessage(message: unknown) {
    if (protocol.value === 'websocket' && wsManager && conversationId) {
      const content = typeof message === 'string' ? message : JSON.stringify(message)
      wsManager.sendMessage(conversationId, content)
    } else {
      console.warn('⚠️ [Realtime] Sending messages is only supported in WebSocket mode with a conversation ID')
    }
  }

  /**
   * 發送打字指示器 (僅 WebSocket)
   */
  async function sendTypingIndicator(isTyping: boolean) {
    if (protocol.value === 'websocket' && wsManager && conversationId) {
      if (isTyping) {
        wsManager.startTyping(conversationId)
      } else {
        wsManager.stopTyping(conversationId)
      }
    }
  }

  // =================== Event Handlers ===================

  function handleWebSocketMessage(data: unknown) {
    console.log('📨 [Realtime] WebSocket message:', data)
    // 觸發自定義事件或更新 store
  }

  function handleTypingStart(data: unknown) {
    console.log('⌨️ [Realtime] Typing started:', data)
  }

  function handleTypingStop(data: unknown) {
    console.log('⌨️ [Realtime] Typing stopped:', data)
  }

  function handleWebSocketError(error: Error) {
    console.error('❌ [Realtime] WebSocket error:', error)
    lastError.value = error
  }

  function handleWebSocketDisconnect() {
    console.log('🔌 [Realtime] WebSocket disconnected')
    isConnected.value = false
  }

  // REMOVED: handleSSEMessage and handleSSEError (Phase 1-2 cleanup - SSE removed, WebSocket only)

  // =================== Lifecycle ===================

  onMounted(() => {
    // 自動連線 (可選)
    // connect()
  })

  onUnmounted(() => {
    disconnect()
  })

  // 監聽認證狀態變化
  watch(() => authStore.isAuthenticated, (isAuth) => {
    if (!isAuth && isConnected.value) {
      disconnect()
    }
  })

  // =================== Return ===================

  return {
    // 狀態
    protocol: computed(() => protocol.value),
    isConnected: computed(() => isConnected.value),
    isConnecting: computed(() => isConnecting.value),
    lastError: computed(() => lastError.value),
    connectionUptime: computed(() => connectionUptime.value),

    // 配置資訊
    config: computed(() => ({
      protocol: getCurrentProtocol(),
      websocketEnabled: realtimeConfig.websocketEnabled
      // REMOVED: fallbackEnabled (Phase 1-2 cleanup - SSE removed, WebSocket only)
    })),

    // 方法
    connect,
    disconnect,
    sendMessage,
    sendTypingIndicator
  }
}
