// WebSocket Client Service with Auto-Reconnection and Message Queuing
// Project: Multi-Channel Support MVP
// Created by: WebSocket Migration Developer

import { ref, type Ref } from 'vue'
import { authenticatedFetch } from '@/api/authenticatedFetch'
import { useAuthStore } from '@/stores/auth'
import { getWebSocketUrl, getBackendUrl } from '@/config/runtime'
import { createLogger } from '@/utils/logger'

const log = createLogger('WebSocketClient')

// WebSocket connection states
export type WebSocketConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'closed'

// WebSocket message types matching backend Durable Objects
export interface WebSocketMessage {
  type: string
  data?: unknown
  timestamp?: number
  messageId?: string
  conversationId?: string
  userId?: string
}

// Outgoing message queue item
export interface QueuedMessage extends WebSocketMessage {
  id: string
  retryCount: number
  timestamp: number
}

// WebSocket event handlers
export interface WebSocketEventHandlers {
  onMessage?: (_message: WebSocketMessage) => void
  onConnectionChange?: (_state: WebSocketConnectionState) => void
  onError?: (_error: Error) => void
  onReconnect?: (_attempt: number) => void
  onHeartbeat?: () => void
}

// WebSocket configuration
export interface WebSocketConfig {
  url?: string
  protocols?: string[]
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  heartbeatTimeout?: number
  messageQueueMaxSize?: number
  enableLogging?: boolean
  autoConnect?: boolean
  conversationId?: string
  deviceId?: string
  clientVersion?: string
}

// Default configuration
const DEFAULT_CONFIG: Required<WebSocketConfig> = {
  url: '',
  protocols: [],
  reconnect: true,
  reconnectInterval: 1000, // Start with 1 second
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000, // 30 seconds
  heartbeatTimeout: 35000, // 35 seconds
  messageQueueMaxSize: 100,
  enableLogging: true,
  autoConnect: false,
  conversationId: '',
  deviceId: 'web',
  clientVersion: '1.0.0'
}

// Exponential backoff calculator
const calculateBackoffDelay = (attempt: number, baseDelay: number): number => {
  return Math.min(baseDelay * Math.pow(2, attempt), 30000) // Max 30 seconds
}

export class WebSocketClient {
  private socket: globalThis.WebSocket | null = null
  private config: Required<WebSocketConfig>
  private messageQueue: QueuedMessage[] = []
  private reconnectTimer: number | null = null
  private heartbeatTimer: number | null = null
  private heartbeatTimeoutTimer: number | null = null
  private reconnectAttempts = 0
  private lastHeartbeat = 0
  private handlers: WebSocketEventHandlers = {}

  // Reactive state
  public readonly connectionState: Ref<WebSocketConnectionState> = ref('disconnected')
  public readonly isConnected = ref(false)
  public readonly lastError: Ref<Error | null> = ref(null)
  public readonly lastMessage: Ref<WebSocketMessage | null> = ref(null)
  public readonly queueSize = ref(0)
  public readonly reconnectAttempt = ref(0)

  constructor(config: WebSocketConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.updateConnectionState('disconnected')

    if (this.config.autoConnect) {
      this.connect()
    }
  }

  // Public methods
  public async connect(url?: string): Promise<void> {
    if (this.socket?.readyState === globalThis.WebSocket.CONNECTING || this.socket?.readyState === globalThis.WebSocket.OPEN) {
      this.log('WebSocket already connecting or connected')
      return
    }

    // 增強版連接前預檢機制
    try {
      this.log('Performing pre-connection checks...')
      const preCheckResult = await this.performPreConnectionChecks()
      if (!preCheckResult.success) {
        const error = new Error(`Pre-connection check failed: ${preCheckResult.error}`)
        this.log(`Pre-connection check failed: ${preCheckResult.error}`)
        this.updateConnectionState('error')
        this.lastError.value = error
        throw error
      }
      this.log(`Pre-connection checks passed: ${preCheckResult.details}`)
    } catch (error) {
      this.log(`Pre-connection error: ${error}`)
      this.updateConnectionState('error')
      this.lastError.value = error instanceof Error ? error : new Error(String(error))
      throw error
    }

    const wsUrl = url || this.config.url || this.buildWebSocketUrl()
    if (!wsUrl) {
      throw new Error('WebSocket URL is required')
    }

    this.log(`Connecting to WebSocket: ${wsUrl}`)
    this.updateConnectionState('connecting')

    try {
      this.socket = new globalThis.WebSocket(wsUrl, this.config.protocols)
      this.setupEventListeners()
    } catch (error) {
      const err = error as Error
      this.log(`Connection failed: ${err.message}`)
      this.updateConnectionState('error')
      this.lastError.value = err
      this.handleReconnect()
      throw err
    }
  }

  public disconnect(): void {
    this.log('Disconnecting WebSocket')
    this.cleanup()
    this.updateConnectionState('disconnected')
  }

  public send(message: WebSocketMessage): boolean {
    const messageWithId: QueuedMessage = {
      ...message,
      id: this.generateMessageId(),
      retryCount: 0,
      timestamp: Date.now()
    }

    if (this.isConnected.value && this.socket?.readyState === globalThis.WebSocket.OPEN) {
      return this.sendMessage(messageWithId)
    } else {
      // Queue message for later delivery
      this.queueMessage(messageWithId)
      this.log(`Message queued (connection not ready): ${message.type}`)
      return false
    }
  }

  public setEventHandlers(handlers: WebSocketEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers }
  }

  public clearEventHandlers(): void {
    this.handlers = {}
  }

  public getConfig(): Required<WebSocketConfig> {
    return { ...this.config }
  }

  public updateConfig(newConfig: Partial<WebSocketConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  // Private methods
  private hasAuthenticatedSession(authStore: ReturnType<typeof useAuthStore>): boolean {
    return authStore.isAuthenticated || authStore.validateSession()
  }

  private async performPreConnectionChecks(): Promise<{success: boolean, error?: string, details?: string}> {
    const checks = []
    const authStore = useAuthStore()

    try {
      // 檢查 1: cookie-backed session metadata
      if (!this.hasAuthenticatedSession(authStore)) {
        return { success: false, error: 'No authenticated session available' }
      }
      checks.push('Authenticated session present')

      // 檢查 2: cookie session 是否需要主動刷新
      if (authStore.shouldRefreshToken()) {
        this.log('Session is near expiry, attempting cookie refresh before connecting...')

        const refreshResult = await authStore.refreshAuthToken()
        if (refreshResult.success) {
          this.log('Cookie session refreshed successfully')
          checks.push('Session refreshed')
        } else {
          return { success: false, error: `Session refresh failed: ${refreshResult.error}` }
        }
      } else {
        checks.push('Session refresh not required')
      }

      // 檢查 3: 網路連接性預檢（可選）
      try {
        // 使用 Vite proxy 在開發模式，避免 CORS 問題
        // 開發模式使用相對 URL (通過 Vite proxy)，生產模式使用完整 URL
        const healthUrl = import.meta.env.DEV
          ? '/api/websocket/health'
          : `${getBackendUrl()}/api/websocket/health`

        // Create AbortController for timeout handling
        // eslint-disable-next-line no-undef
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

        const response = await authenticatedFetch(healthUrl, {
          method: 'GET',
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          const healthData = await response.json()
          // Fix: Check correct nested path with fallback for backward compatibility
          const isWebSocketEnabled = healthData.configuration?.websocketEnabled ??
                                     healthData.websocketEnabled ??
                                     false
          if (isWebSocketEnabled) {
            checks.push('WebSocket service available')
          } else {
            return { success: false, error: 'WebSocket service disabled on server' }
          }
        } else {
          // Health check failed, but we'll continue anyway as it's not critical
          this.log(`Health check failed with status ${response.status}, continuing anyway`)
          checks.push('Health check skipped (non-critical failure)')
        }
      } catch (healthError) {
        // Health check is optional, don't fail the entire pre-check
        this.log(`Health check failed: ${healthError}, continuing anyway`)
        checks.push('Health check skipped (connection error)')
      }

      return {
        success: true,
        details: checks.join(', ')
      }

    } catch (error) {
      return {
        success: false,
        error: `Pre-check system error: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  private buildWebSocketUrl(): string {
    // Layer 3: 使用運行時配置層
    // 不再硬編碼 URL，自動適配開發/生產環境
    const wsBaseUrl = getWebSocketUrl()

    // Build WebSocket URL matching backend Durable Objects architecture
    const url = new URL(`${wsBaseUrl}/api/websocket/connect`)

    // Add conversation context
    if (this.config.conversationId) {
      url.searchParams.set('conversationId', this.config.conversationId)
    }

    // Add device information
    if (this.config.deviceId) {
      url.searchParams.set('deviceId', this.config.deviceId)
    }

    // Add client version
    if (this.config.clientVersion) {
      url.searchParams.set('clientVersion', this.config.clientVersion)
    }

    return url.toString()
  }

  private setupEventListeners(): void {
    if (!this.socket) {return}

    this.socket.onopen = () => {
      this.log('WebSocket connected successfully')
      this.updateConnectionState('connected')
      this.reconnectAttempts = 0
      this.lastError.value = null
      this.startHeartbeat()
      this.processMessageQueue()
    }

    this.socket.onmessage = (event) => {
      this.handleMessage(event)
    }

    this.socket.onclose = (event) => {
      this.log(`WebSocket closed: ${event.code} - ${event.reason}`)
      this.stopHeartbeat()

      // 詳細錯誤代碼處理
      switch (event.code) {
        case 1000:
          // Normal closure
          this.log('WebSocket closed normally')
          this.updateConnectionState('closed')
          break

        case 1001:
          // Going away
          this.log('WebSocket closed: endpoint going away')
          this.updateConnectionState('error')
          this.handleReconnect()
          break

        case 1006:
          // Abnormal closure - 主要修復目標
          this.log('WebSocket abnormal closure (1006) - likely authentication or connection issue')
          this.updateConnectionState('error')
          // 對於 1006 錯誤，我們等待更長時間後重連，給服務器時間處理
          this.handleReconnectWithDelay(2000) // 2 seconds delay for 1006 errors
          break

        case 1008:
          // Policy violation
          this.log('WebSocket closed due to policy violation (likely authentication)')
          this.updateConnectionState('error')
          this.handleAuthenticationFailure('Policy violation')
          break

        // 自定義錯誤代碼處理（與後端中間件對應）
        case 4401:
          this.log('WebSocket closed: No authentication token provided')
          this.updateConnectionState('error')
          this.handleAuthenticationFailure('Missing token')
          break

        case 4402:
          this.log('WebSocket closed: Invalid token format')
          this.updateConnectionState('error')
          this.handleAuthenticationFailure('Invalid token format')
          break

        case 4403:
          this.log('WebSocket closed: Invalid or expired token')
          this.updateConnectionState('error')
          this.handleAuthenticationFailure('Invalid/expired token')
          break

        case 4404:
          this.log('WebSocket closed: Token expired')
          this.updateConnectionState('error')
          this.handleAuthenticationFailure('Token expired')
          break

        case 4405:
          this.log('WebSocket closed: Token expiring soon')
          this.updateConnectionState('error')
          this.handleAuthenticationFailure('Token expiring soon')
          break

        case 4406:
          this.log('WebSocket closed: Invalid user data in token')
          this.updateConnectionState('error')
          this.handleAuthenticationFailure('Invalid user data')
          break

        case 4407:
          this.log('WebSocket closed: Invalid role in token')
          this.updateConnectionState('error')
          this.handleAuthenticationFailure('Invalid role')
          break

        case 4500:
          this.log('WebSocket closed: Server authentication error')
          this.updateConnectionState('error')
          // Server error - wait longer before retry
          this.handleReconnectWithDelay(5000) // 5 seconds delay for server errors
          break

        default:
          // Other unexpected closures
          this.log(`WebSocket closed with unexpected code: ${event.code}`)
          this.updateConnectionState('error')
          this.handleReconnect()
          break
      }
    }

    this.socket.onerror = () => {
      const error = new Error('WebSocket connection error')
      this.log(`WebSocket error: ${error.message}`)
      this.lastError.value = error
      this.updateConnectionState('error')
      this.handlers.onError?.(error)
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data)
      this.lastMessage.value = message

      // Handle system messages
      if (message.type === 'heartbeat') {
        this.lastHeartbeat = Date.now()
        this.handlers.onHeartbeat?.()
        return
      }

      if (message.type === 'connection_ack') {
        this.log('Connection acknowledged by server')
        return
      }

      // Handle application messages
      this.log(`Received message: ${message.type}`)
      this.handlers.onMessage?.(message)

    } catch (error) {
      this.log(`Failed to parse WebSocket message: ${error}`)
    }
  }

  private sendMessage(message: QueuedMessage): boolean {
    if (!this.socket || this.socket.readyState !== globalThis.WebSocket.OPEN) {
      return false
    }

    try {
      this.socket.send(JSON.stringify(message))
      this.log(`Message sent: ${message.type}`)
      return true
    } catch (error) {
      this.log(`Failed to send message: ${error}`)
      this.queueMessage(message)
      return false
    }
  }

  private queueMessage(message: QueuedMessage): void {
    if (this.messageQueue.length >= this.config.messageQueueMaxSize) {
      // Remove oldest message to make room
      this.messageQueue.shift()
      this.log('Message queue full, removed oldest message')
    }

    this.messageQueue.push(message)
    this.queueSize.value = this.messageQueue.length
  }

  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) {return}

    this.log(`Processing message queue: ${this.messageQueue.length} messages`)

    const messagesToSend = [...this.messageQueue]
    this.messageQueue = []
    this.queueSize.value = 0

    for (const message of messagesToSend) {
      if (!this.sendMessage(message)) {
        // If sending fails, re-queue the message
        this.queueMessage(message)
      }
    }
  }

  private async handleReconnect(): Promise<void> {
    this.handleReconnectWithDelay()
  }

  private async handleReconnectWithDelay(customDelay?: number): Promise<void> {
    if (!this.config.reconnect || this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.log('Max reconnection attempts reached or reconnection disabled')
      this.updateConnectionState('error')
      return
    }

    this.reconnectAttempts++
    this.reconnectAttempt.value = this.reconnectAttempts
    this.updateConnectionState('reconnecting')

    const delay = customDelay || calculateBackoffDelay(this.reconnectAttempts - 1, this.config.reconnectInterval)
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`)

    this.handlers.onReconnect?.(this.reconnectAttempts)

    this.reconnectTimer = setTimeout(async () => {
      // 在重新連接前檢查並刷新令牌
      try {
        const authStore = useAuthStore()

        if (!this.hasAuthenticatedSession(authStore)) {
          this.log('No authenticated session available, cannot reconnect')
          this.updateConnectionState('error')
          return
        }

        // 檢查 cookie session 是否需要刷新
        if (authStore.shouldRefreshToken()) {
          this.log('Session needs refresh, attempting to refresh before reconnection...')
          const refreshResult = await authStore.refreshAuthToken()

          if (refreshResult.success) {
            this.log('Session refreshed successfully, proceeding with reconnection')
          } else {
            this.log(`Session refresh failed: ${refreshResult.error}`)
            // 如果 session 刷新失敗，停止重連並要求重新登入
            this.updateConnectionState('error')
            return
          }
        }

        // session 有效或刷新成功，繼續連接
        this.connect()
      } catch (error) {
        this.log(`Error during session refresh: ${error}`)
        this.updateConnectionState('error')
      }
    }, delay) as unknown as number
  }

  private async handleAuthenticationFailure(reason: string): Promise<void> {
    this.log(`Authentication failure detected: ${reason}`)

    // 設置特定的錯誤狀態
    this.lastError.value = new Error(`Authentication failed: ${reason}`)

    const authStore = useAuthStore()

    // 嘗試 cookie session 刷新（如果本地 session metadata 仍有效）
    if (authStore.validateSession()) {
      this.log('Attempting to refresh expired/invalid cookie session...')

      try {
        const refreshResult = await authStore.refreshAuthToken()

        if (refreshResult.success) {
          this.log('Session refreshed successfully after auth failure, retrying connection...')
          // 重置重連計數器，因為這是認證問題，不是網絡問題
          this.reconnectAttempts = 0
          this.reconnectAttempt.value = 0

          // 立即嘗試重新連接
          setTimeout(() => {
            this.connect().catch(error => {
              this.log(`Connection retry after token refresh failed: ${error}`)
            })
          }, 1000) // 等待 1 秒後重試

          return
        } else {
          this.log(`Session refresh failed: ${refreshResult.error}`)
        }
      } catch (refreshError) {
        this.log(`Session refresh error: ${refreshError}`)
      }
    }

    // 如果無法刷新 session，或刷新失敗，停止重連
    this.log('Cannot recover from authentication failure - user needs to re-login')
    this.updateConnectionState('error')

    // 觸發認證失敗事件給應用程序
    this.handlers.onError?.(new Error(`Authentication failed: ${reason}. Please re-login.`))

    // 清空重連計時器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.lastHeartbeat = Date.now()

    // Send heartbeat
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected.value) {
        this.send({ type: 'ping', timestamp: Date.now() })
      }
    }, this.config.heartbeatInterval) as unknown as number

    // Check for heartbeat timeout
    this.heartbeatTimeoutTimer = setInterval(() => {
      if (this.isConnected.value) {
        const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat
        if (timeSinceLastHeartbeat > this.config.heartbeatTimeout) {
          this.log('Heartbeat timeout, reconnecting...')
          this.handleReconnect()
        }
      }
    }, this.config.heartbeatTimeout / 2) as unknown as number
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.heartbeatTimeoutTimer) {
      clearInterval(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.stopHeartbeat()

    if (this.socket) {
      this.socket.close(1000, 'Client disconnect')
      this.socket = null
    }

    this.reconnectAttempts = 0
    this.reconnectAttempt.value = 0
  }

  private updateConnectionState(state: WebSocketConnectionState): void {
    // Update state synchronously for immediate UI feedback
    this.connectionState.value = state
    this.isConnected.value = state === 'connected'
    this.log(`Connection state changed to: ${state}`)

    // Defer callback execution to prevent infinite recursion
    // This breaks the synchronous execution chain that could trigger cascading updates
    if (this.handlers.onConnectionChange) {
      import('vue').then(({ nextTick }) => {
        nextTick(() => {
          this.handlers.onConnectionChange?.(state)
        })
      })
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      log.debug(message)
    }
  }

  // Cleanup on destruction
  public destroy(): void {
    this.log('Destroying WebSocket client')
    this.cleanup()
    this.clearEventHandlers()
  }
}

// Factory function for creating WebSocket clients
export function createWebSocketClient(config?: WebSocketConfig): WebSocketClient {
  return new WebSocketClient(config)
}

// Singleton instance for global use
let globalWebSocketClient: WebSocketClient | null = null

export function getGlobalWebSocketClient(config?: WebSocketConfig): WebSocketClient {
  if (!globalWebSocketClient) {
    globalWebSocketClient = new WebSocketClient(config)
  }
  return globalWebSocketClient
}

export function destroyGlobalWebSocketClient(): void {
  if (globalWebSocketClient) {
    globalWebSocketClient.destroy()
    globalWebSocketClient = null
  }
}
