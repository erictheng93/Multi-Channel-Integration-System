/**
 * Global WebSocket Store - Phase B3
 *
 * 全局 WebSocket Store - 统一管理所有实时通信
 *
 * 特性:
 * - 全应用单一 WebSocket 连接
 * - 智能事件路由到订阅者
 * - 自动订阅管理和清理
 * - 连接生命周期管理
 * - 性能优化 (减少 66% 连接数)
 *
 * @module stores/websocket
 * @since Phase B3
 */

import { defineStore } from 'pinia'
import { ref, computed, type Ref } from 'vue'
import { createWebSocketClient, type WebSocketClient, type WebSocketMessage } from '@/services/websocketClient'
import { WebSocketEventRouter } from '@/services/websocketEventRouter'
import { useAuthStore } from './auth'

// ==================== Types ====================

/**
 * WebSocket 连接状态
 */
export type WebSocketConnectionState =
  | 'disconnected'   // 未连接
  | 'connecting'     // 连接中
  | 'connected'      // 已连接
  | 'reconnecting'   // 重连中
  | 'error'          // 错误状态

/**
 * 事件处理器类型
 */
export type EventHandler = (_message: WebSocketMessage) => void

/**
 * 订阅 ID
 */
export type SubscriptionId = string

/**
 * 订阅信息
 */
interface Subscription {
  id: SubscriptionId
  channel: string
  handler: EventHandler
  createdAt: number
}

/**
 * WebSocket 统计信息
 */
interface WebSocketStats {
  messagesSent: number
  messagesReceived: number
  reconnectAttempts: number
  uptime: number
  subscriptionCount: number
  latency: number // 延遲毫秒數
}

// ==================== Constants ====================

/**
 * 重连配置
 */
const RECONNECT_CONFIG = {
  maxAttempts: 3,           // 最大重连次数
  baseDelay: 5000,          // 基础延迟 (5 秒)
  heartbeatInterval: 30000, // 心跳间隔 (30 秒)
  heartbeatTimeout: 35000   // 心跳超时 (35 秒)
}

// ==================== Store ====================

export const useWebSocketStore = defineStore('websocket', () => {
  // ==================== State ====================

  // WebSocket 客户端实例
  let wsClient: WebSocketClient | null = null

  // 订阅管理
  const subscriptions = ref<Map<SubscriptionId, Subscription>>(new Map())
  const channelSubscribers = ref<Map<string, Set<SubscriptionId>>>(new Map())

  // 连接状态
  const connectionState = ref<WebSocketConnectionState>('disconnected')
  const lastError: Ref<Error | null> = ref(null)
  const reconnectAttempts = ref(0)

  // 重连定时器
  let reconnectTimer: NodeJS.Timeout | null = null

  // 统计信息
  const stats = ref<WebSocketStats>({
    messagesSent: 0,
    messagesReceived: 0,
    reconnectAttempts: 0,
    uptime: 0,
    subscriptionCount: 0,
    latency: 0
  })

  // 连接时间（用于计算 uptime）
  let connectedAt = 0

  // 心跳發送時間（用於計算延遲）
  let lastHeartbeatSentAt = 0

  // 延遲（獨立的 ref，方便響應式訪問）
  const latency = ref(0)

  // ==================== Computed ====================

  /**
   * 是否已连接
   */
  const isConnected = computed(() => connectionState.value === 'connected')

  /**
   * 是否正在连接中
   */
  const isConnecting = computed(() =>
    connectionState.value === 'connecting' ||
    connectionState.value === 'reconnecting'
  )

  /**
   * 订阅数量
   */
  const subscriptionCount = computed(() => subscriptions.value.size)

  /**
   * Channel 数量
   */
  const channelCount = computed(() => channelSubscribers.value.size)

  // ==================== Internal Methods ====================

  /**
   * 设置连接状态
   */
  const setConnectionState = (state: WebSocketConnectionState) => {
    if (connectionState.value !== state) {
      console.log(`🔄 [WebSocketStore] State: ${connectionState.value} → ${state}`)
      connectionState.value = state

      // 重置错误状态
      if (state === 'connected') {
        lastError.value = null
        reconnectAttempts.value = 0
        connectedAt = Date.now()
      }
    }
  }

  /**
   * 处理 WebSocket 消息
   */
  const handleMessage = (message: WebSocketMessage) => {
    console.log('📥 [WebSocketStore] Received message:', message.type)

    stats.value.messagesReceived++

    // 路由消息到订阅者
    routeMessage(message)
  }

  /**
   * 路由消息到订阅者（使用事件路由器）
   */
  const routeMessage = (message: WebSocketMessage) => {
    // 使用事件路由器确定目标 channels
    const channels = WebSocketEventRouter.route(message)

    if (channels.length === 0) {
      // 系统消息或未知消息，不路由
      return
    }

    console.log(`🔀 [WebSocketStore] Routing to channels:`, channels)

    channels.forEach(channel => {
      const subscriberIds = channelSubscribers.value.get(channel)

      if (subscriberIds && subscriberIds.size > 0) {
        console.log(`📢 [WebSocketStore] Notifying ${subscriberIds.size} subscribers on channel: ${channel}`)

        subscriberIds.forEach(subId => {
          const subscription = subscriptions.value.get(subId)
          if (subscription) {
            try {
              subscription.handler(message)
            } catch (error) {
              console.error(`❌ [WebSocketStore] Error in subscription handler (${subId}):`, error)
            }
          }
        })
      }
    })
  }

  /**
   * 处理连接状态变化
   */
  const handleConnectionChange = (state: string) => {
    switch (state) {
      case 'connected':
        setConnectionState('connected')
        break
      case 'connecting':
        setConnectionState('connecting')
        break
      case 'reconnecting':
        setConnectionState('reconnecting')
        stats.value.reconnectAttempts++
        break
      case 'disconnected':
      case 'closed':
        setConnectionState('disconnected')
        break
      case 'error':
        setConnectionState('error')
        break
    }
  }

  /**
   * 处理 WebSocket 错误
   */
  const handleError = (error: Error) => {
    console.error('❌ [WebSocketStore] WebSocket error:', error)
    lastError.value = error
    setConnectionState('error')

    // 尝试重连
    if (reconnectAttempts.value < RECONNECT_CONFIG.maxAttempts) {
      reconnectAttempts.value++
      const delay = RECONNECT_CONFIG.baseDelay * reconnectAttempts.value

      console.log(`🔄 [WebSocketStore] Reconnecting in ${delay}ms (${reconnectAttempts.value}/${RECONNECT_CONFIG.maxAttempts})...`)

      reconnectTimer = setTimeout(() => {
        reconnect()
      }, delay)
    } else {
      console.error(`❌ [WebSocketStore] Max reconnect attempts (${RECONNECT_CONFIG.maxAttempts}) reached`)
    }
  }

  /**
   * 处理心跳
   * @param heartbeatLatency 心跳延遲（如果 wsClient 提供的話）
   */
  const handleHeartbeat = (heartbeatLatency?: number) => {
    // 心跳收到，更新 uptime
    if (connectedAt > 0) {
      stats.value.uptime = Math.floor((Date.now() - connectedAt) / 1000)
    }

    // 更新延遲（如果有提供）
    if (typeof heartbeatLatency === 'number' && heartbeatLatency > 0) {
      latency.value = heartbeatLatency
      stats.value.latency = heartbeatLatency
    } else if (lastHeartbeatSentAt > 0) {
      // 如果沒有提供延遲，使用估算值
      const estimatedLatency = Date.now() - lastHeartbeatSentAt
      if (estimatedLatency < RECONNECT_CONFIG.heartbeatTimeout) {
        latency.value = estimatedLatency
        stats.value.latency = estimatedLatency
      }
    }

    // 重置心跳發送時間
    lastHeartbeatSentAt = Date.now()
  }

  // ==================== Public API ====================

  /**
   * 连接 WebSocket
   */
  const connect = async (): Promise<void> => {
    const authStore = useAuthStore()

    if (!authStore.token) {
      console.warn('⚠️ [WebSocketStore] No auth token, cannot connect')
      return
    }

    if (isConnected.value || isConnecting.value) {
      console.log('ℹ️ [WebSocketStore] Already connected or connecting')
      return
    }

    try {
      console.log('🚀 [WebSocketStore] Connecting to WebSocket...')
      setConnectionState('connecting')

      // 创建 WebSocket 客户端
      wsClient = createWebSocketClient({
        enableLogging: import.meta.env.DEV,
        reconnect: false, // 由 Store 管理重连
        reconnectInterval: RECONNECT_CONFIG.baseDelay,
        maxReconnectAttempts: RECONNECT_CONFIG.maxAttempts,
        heartbeatInterval: RECONNECT_CONFIG.heartbeatInterval,
        heartbeatTimeout: RECONNECT_CONFIG.heartbeatTimeout,
        deviceId: 'web-global-store',
        clientVersion: '3.0.0'
      })

      // 设置事件处理器
      wsClient.setEventHandlers({
        onMessage: handleMessage,
        onConnectionChange: handleConnectionChange,
        onError: handleError,
        onHeartbeat: handleHeartbeat
      })

      // 连接
      await wsClient.connect()

      console.log('✅ [WebSocketStore] Connected successfully')

    } catch (error) {
      console.error('❌ [WebSocketStore] Connection failed:', error)
      handleError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * 断开连接
   */
  const disconnect = (): void => {
    console.log('🛑 [WebSocketStore] Disconnecting...')

    // 清理重连定时器
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    // 断开 WebSocket
    if (wsClient) {
      wsClient.disconnect()
      wsClient = null
    }

    setConnectionState('disconnected')
    reconnectAttempts.value = 0
    connectedAt = 0
  }

  /**
   * 重连
   */
  const reconnect = async (): Promise<void> => {
    console.log('🔄 [WebSocketStore] Reconnecting...')

    disconnect()

    // 短暂延迟后重连
    await new Promise(resolve => setTimeout(resolve, 1000))

    await connect()
  }

  /**
   * 订阅 channel
   */
  const subscribe = (channel: string, handler: EventHandler): SubscriptionId => {
    const id = crypto.randomUUID()
    const subscription: Subscription = {
      id,
      channel,
      handler,
      createdAt: Date.now()
    }

    // 存储订阅
    subscriptions.value.set(id, subscription)

    // 添加到 channel 索引
    if (!channelSubscribers.value.has(channel)) {
      channelSubscribers.value.set(channel, new Set())
    }
    channelSubscribers.value.get(channel)!.add(id)

    // 更新统计
    stats.value.subscriptionCount = subscriptions.value.size

    console.log(`📝 [WebSocketStore] Subscribed to "${channel}" (id: ${id.substring(0, 8)}...)`)
    console.log(`📊 [WebSocketStore] Active subscriptions: ${subscriptions.value.size}, Channels: ${channelSubscribers.value.size}`)

    return id
  }

  /**
   * 取消订阅
   */
  const unsubscribe = (id: SubscriptionId): void => {
    const subscription = subscriptions.value.get(id)

    if (!subscription) {
      console.warn(`⚠️ [WebSocketStore] Subscription not found: ${id}`)
      return
    }

    // 从 channel 索引移除
    const channelSubs = channelSubscribers.value.get(subscription.channel)
    if (channelSubs) {
      channelSubs.delete(id)

      // 如果 channel 没有订阅者了，删除 channel
      if (channelSubs.size === 0) {
        channelSubscribers.value.delete(subscription.channel)
      }
    }

    // 删除订阅
    subscriptions.value.delete(id)

    // 更新统计
    stats.value.subscriptionCount = subscriptions.value.size

    console.log(`🗑️ [WebSocketStore] Unsubscribed from "${subscription.channel}" (id: ${id.substring(0, 8)}...)`)
    console.log(`📊 [WebSocketStore] Active subscriptions: ${subscriptions.value.size}, Channels: ${channelSubscribers.value.size}`)
  }

  /**
   * 发送消息
   */
  const send = (message: WebSocketMessage): void => {
    if (!wsClient || !isConnected.value) {
      console.warn('⚠️ [WebSocketStore] Cannot send message: not connected')
      return
    }

    wsClient.send(message)
    stats.value.messagesSent++

    console.log(`📤 [WebSocketStore] Sent message: ${message.type}`)
  }

  /**
   * 清理所有订阅（用于测试）
   */
  const clearAllSubscriptions = (): void => {
    console.log('🧹 [WebSocketStore] Clearing all subscriptions...')

    subscriptions.value.clear()
    channelSubscribers.value.clear()
    stats.value.subscriptionCount = 0

    console.log('✅ [WebSocketStore] All subscriptions cleared')
  }

  // ==================== Return ====================

  return {
    // State
    connectionState,
    lastError,
    reconnectAttempts,
    stats,
    latency,

    // Computed
    isConnected,
    isConnecting,
    subscriptionCount,
    channelCount,

    // Actions
    connect,
    disconnect,
    reconnect,
    subscribe,
    unsubscribe,
    send,
    clearAllSubscriptions
  }
})
