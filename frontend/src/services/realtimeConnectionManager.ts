// Unified Real-time Connection Manager
// Automatically switches between WebSocket and SSE based on Feature Flags
// Phase 2.2 - Frontend Feature Toggle Implementation
// Project: Multi-Channel Support MVP

import { ref, computed, type Ref } from 'vue'
import { createWebSocketClient, type WebSocketMessage, type WebSocketConnectionState as WsConnectionState } from './websocketClient'
import type { Message } from '@/types'

// =================== Type Definitions ===================

export type ConnectionType = 'websocket' | 'sse'
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export interface RealtimeConnection {
  // Connection Management
  connect(): Promise<void>
  disconnect(): void
  reconnect(): void

  // Messaging
  send(_message: unknown): boolean
  addMessage(_message: Message): void
  clearMessages(): void

  // Event Handlers
  onMessage(_handler: (_message: unknown) => void): void
  onStateChange(_handler: (_state: ConnectionState) => void): void
  onError(_handler: (_error: Error) => void): void

  // State
  readonly type: ConnectionType
  readonly connectionState: Readonly<Ref<ConnectionState>>
  readonly isConnected: Readonly<Ref<boolean>>
  readonly messages: Readonly<Ref<Message[]>>
  readonly messageCount: Readonly<Ref<number>>
}

export interface MigrationConfig {
  enableWebSocket: boolean
  enableSSE: boolean
  rolloutPercentage: number
  migrationStrategy: 'gradual' | 'complete'
  featureFlags: {
    websocketConnections: boolean
    durableObjectMessaging: boolean
    distributedLocking: boolean
    batchMessageProcessing: boolean
    realTimeTypingIndicators: boolean
  }
}

// =================== Migration Config Fetching ===================

let configCache: MigrationConfig | null = null
let configCacheTimestamp = 0
const CONFIG_CACHE_TTL = 60000 // 60 seconds

export async function fetchMigrationConfig(): Promise<MigrationConfig> {
  // Return cached config if still valid
  const now = Date.now()
  if (configCache && (now - configCacheTimestamp) < CONFIG_CACHE_TTL) {
    return configCache
  }

  try {
    // REMOTE-ONLY: Always use remote API
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://multi-channel.imfinethankyouandyou.com'
    const response = await fetch(`${baseUrl}/api/websocket/migration-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch migration config: ${response.status}`)
    }

    const config = await response.json()

    configCache = {
      enableWebSocket: config.websocketEnabled || false,
      enableSSE: config.sseEnabled !== false, // Default to true
      rolloutPercentage: config.rolloutPercentage || 0,
      migrationStrategy: config.migrationStrategy || 'gradual',
      featureFlags: config.featureFlags || {
        websocketConnections: false,
        durableObjectMessaging: false,
        distributedLocking: false,
        batchMessageProcessing: false,
        realTimeTypingIndicators: false
      }
    }

    configCacheTimestamp = now
    console.log('[RealtimeConnectionManager] Migration config fetched:', configCache)

    return configCache

  } catch (error) {
    console.error('[RealtimeConnectionManager] Failed to fetch migration config:', error)

    // Return safe defaults on error (fallback to SSE)
    return {
      enableWebSocket: false,
      enableSSE: true,
      rolloutPercentage: 0,
      migrationStrategy: 'gradual',
      featureFlags: {
        websocketConnections: false,
        durableObjectMessaging: false,
        distributedLocking: false,
        batchMessageProcessing: false,
        realTimeTypingIndicators: false
      }
    }
  }
}

// Force refresh config cache (useful after manual config changes)
export function refreshMigrationConfig(): void {
  configCache = null
  configCacheTimestamp = 0
}

// =================== User Bucketing Algorithm ===================
// REMOVED: _shouldUserGetWebSocket function (WebSocket is at 100% rollout)

// =================== Connection Factory ===================

/**
 * Creates WebSocket real-time connection
 * 100% WebSocket rollout - SSE support removed
 */
export async function createRealtimeConnection(
  conversationId: string
): Promise<RealtimeConnection> {
  console.log(`[RealtimeConnectionManager] Creating WebSocket connection for conversation: ${conversationId}`)

  // Fetch migration config
  const config = await fetchMigrationConfig()

  // Always use WebSocket (100% rollout)
  console.log(`🚀 [RealtimeConnectionManager] Using WebSocket connection (rollout: ${config.rolloutPercentage}%)`)
  return createWebSocketConnection(conversationId, config)
}

// =================== WebSocket Connection Wrapper ===================

function createWebSocketConnection(
  conversationId: string,
  _config: MigrationConfig
): RealtimeConnection {
  const wsClient = createWebSocketClient({
    conversationId,
    enableLogging: true,
    autoConnect: false,
    heartbeatInterval: 30000,
    maxReconnectAttempts: 10
  })

  // Map WebSocket connection state to RealtimeConnection state
  const mappedState = computed<ConnectionState>(() => {
    const wsState = wsClient.connectionState.value
    // WebSocketConnectionState only has: 'disconnected' | 'connecting' | 'connected'
    // Map to ConnectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
    return wsState as ConnectionState
  })

  // Adapter to match RealtimeConnection interface
  return {
    type: 'websocket',
    connectionState: mappedState,
    isConnected: wsClient.isConnected,
    messages: ref([]), // Messages managed by parent component
    messageCount: ref(0),

    async connect() {
      await wsClient.connect()
    },

    disconnect() {
      wsClient.disconnect()
    },

    reconnect() {
      wsClient.disconnect()
      setTimeout(() => wsClient.connect(), 1000)
    },

    send(_message: unknown): boolean {
      return wsClient.send(_message as WebSocketMessage)
    },

    addMessage(_message: Message) {
      // Messages are typically managed by parent component
      console.log('[WebSocket] Message added (handled by parent):', _message)
    },

    clearMessages() {
      console.log('[WebSocket] Clear messages (handled by parent)')
    },

    onMessage(_handler: (_message: unknown) => void) {
      wsClient.setEventHandlers({
        onMessage: _handler
      })
    },

    onStateChange(_handler: (_state: ConnectionState) => void) {
      wsClient.setEventHandlers({
        onConnectionChange: (_state: WsConnectionState) => {
          // Map WebSocketConnectionState to ConnectionState
          const mappedState: ConnectionState = _state === 'closed' ? 'disconnected' : _state as ConnectionState
          _handler(mappedState)
        }
      })
    },

    onError(_handler: (_error: Error) => void) {
      wsClient.setEventHandlers({
        onError: _handler
      })
    }
  }
}

// =================== Utility Functions ===================

/**
 * Get current connection type (always WebSocket at 100% rollout)
 */
export async function getCurrentConnectionType(): Promise<ConnectionType> {
  return 'websocket'
}

/**
 * Check if user is in WebSocket rollout (always true at 100%)
 */
export async function isUserInWebSocketRollout(): Promise<boolean> {
  return true
}

/**
 * Get migration statistics (100% WebSocket)
 */
export async function getMigrationStats(): Promise<{
  currentType: ConnectionType
  rolloutPercentage: number
  websocketEnabled: boolean
  featureFlags: MigrationConfig['featureFlags']
}> {
  const config = await fetchMigrationConfig()

  return {
    currentType: 'websocket',
    rolloutPercentage: config.rolloutPercentage,
    websocketEnabled: config.enableWebSocket,
    featureFlags: config.featureFlags
  }
}

// =================== Export ===================

export default {
  createRealtimeConnection,
  fetchMigrationConfig,
  refreshMigrationConfig,
  getCurrentConnectionType,
  isUserInWebSocketRollout,
  getMigrationStats
}

