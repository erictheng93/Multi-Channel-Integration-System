// Simplified WebSocket Client - Reduces complexity while maintaining functionality
// Project: Multi-Channel Support MVP

import { getBackendUrl } from '@/config/runtime'
import { ref, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export interface WebSocketMessage {
  type: string
  data?: unknown
  timestamp?: number
}

export interface ConnectionConfig {
  url?: string
  conversationId?: string
  autoReconnect?: boolean
  maxReconnectAttempts?: number
}

// Simplified event handlers interface
export interface EventHandlers {
  onMessage?: (_message: WebSocketMessage) => void
  onStateChange?: (_state: ConnectionState) => void
  onError?: (_error: Error) => void
}

export class SimplifiedWebSocketClient {
  private socket: globalThis.WebSocket | null = null
  private config: Required<ConnectionConfig>
  private handlers: EventHandlers = {}
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null

  // Reactive state (simplified to essential properties)
  public readonly connectionState: Ref<ConnectionState> = ref('disconnected')
  public readonly lastError: Ref<Error | null> = ref(null)

  // Default configuration (simplified)
  private static readonly DEFAULT_CONFIG: Required<ConnectionConfig> = {
    url: '',
    conversationId: '',
    autoReconnect: true,
    maxReconnectAttempts: 5
  }

  constructor(config: ConnectionConfig = {}) {
    this.config = { ...SimplifiedWebSocketClient.DEFAULT_CONFIG, ...config }
  }

  // =================== Core Methods (Simplified) ===================

  async connect(url?: string): Promise<boolean> {
    if (this.isConnectedOrConnecting()) {
      return true
    }

    const wsUrl = url || this.buildWebSocketUrl()
    if (!wsUrl) {
      this.handleError(new Error('WebSocket URL is required'))
      return false
    }

    this.updateState('connecting')

    try {
      this.socket = new globalThis.WebSocket(wsUrl)
      this.setupEventListeners()
      return true
    } catch (error) {
      this.handleError(error as Error)
      return false
    }
  }

  disconnect(): void {
    this.cleanup()
    this.updateState('disconnected')
  }

  send(message: WebSocketMessage): boolean {
    if (!this.socket || this.socket.readyState !== globalThis.WebSocket.OPEN) {
      return false
    }

    try {
      this.socket.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }))
      return true
    } catch (error) {
      this.handleError(error as Error)
      return false
    }
  }

  setEventHandlers(handlers: EventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers }
  }

  // =================== Private Methods (Simplified) ===================

  private isConnectedOrConnecting(): boolean {
    return this.connectionState.value === 'connected' ||
           this.connectionState.value === 'connecting'
  }

  private buildWebSocketUrl(): string {
    const authStore = useAuthStore()
    // REMOTE-ONLY: Always use remote API
    const baseUrl = getBackendUrl()
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws'
    const wsBaseUrl = baseUrl.replace(/^https?/, wsProtocol)

    const url = new URL(`${wsBaseUrl}/api/websocket/connect`)

    if (authStore.token) {
      url.searchParams.set('token', authStore.token)
    }

    if (this.config.conversationId) {
      url.searchParams.set('conversationId', this.config.conversationId)
    }

    return url.toString()
  }

  private setupEventListeners(): void {
    if (!this.socket) {return}

    this.socket.onopen = () => {
      this.updateState('connected')
      this.reconnectAttempts = 0
      this.lastError.value = null
    }

    this.socket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        this.handlers.onMessage?.(message)
      } catch (_error) {
        this.handleError(new Error('Failed to parse message'))
      }
    }

    this.socket.onclose = (event) => {
      if (event.code === 1000) {
        this.updateState('disconnected')
      } else {
        this.handleConnectionLoss()
      }
    }

    this.socket.onerror = () => {
      this.handleError(new Error('WebSocket connection error'))
    }
  }

  private handleConnectionLoss(): void {
    if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.updateState('reconnecting')
      this.scheduleReconnect()
    } else {
      this.updateState('error')
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000) // Exponential backoff, max 30s

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect()
    }, delay)
  }

  private handleError(error: Error): void {
    this.lastError.value = error
    this.updateState('error')
    this.handlers.onError?.(error)
    console.error('[WebSocket]', error.message)
  }

  private updateState(state: ConnectionState): void {
    this.connectionState.value = state
    this.handlers.onStateChange?.(state)
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.socket) {
      this.socket.close(1000, 'Client disconnect')
      this.socket = null
    }

    this.reconnectAttempts = 0
  }

  // =================== Public Utilities ===================

  get isConnected(): boolean {
    return this.connectionState.value === 'connected'
  }

  destroy(): void {
    this.cleanup()
    this.handlers = {}
    this.updateState('disconnected')
  }
}

// Factory function for easy creation
export function createSimplifiedWebSocket(config?: ConnectionConfig): SimplifiedWebSocketClient {
  return new SimplifiedWebSocketClient(config)
}