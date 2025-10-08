// Unified Real-time Connection Manager
// Automatically switches between WebSocket and SSE based on Feature Flags
// Phase 2.2 - Frontend Feature Toggle Implementation
// Project: Multi-Channel Support MVP

import { ref, computed, watch, type Ref } from 'vue'
import { createWebSocketClient } from './websocketClient'
import { useSSEMessages } from '@/composables/useSSEMessages'
import { useAuthStore } from '@/stores/auth'
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
  send(message: any): boolean
  addMessage(message: Message): void
  clearMessages(): void

  // Event Handlers
  onMessage(handler: (message: any) => void): void
  onStateChange(handler: (state: ConnectionState) => void): void
  onError(handler: (error: Error) => void): void

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
    const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin
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

/**
 * Consistent hash-based user bucketing
 * Ensures same user always gets same result for given percentage
 */
function shouldUserGetWebSocket(rolloutPercentage: number): boolean {
  if (rolloutPercentage <= 0) return false
  if (rolloutPercentage >= 100) return true

  const authStore = useAuthStore()
  const userId = authStore.currentAgent?.id || 'anonymous'

  // Simple hash function (djb2)
  let hash = 5381
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) + hash) + userId.charCodeAt(i)
  }

  const bucket = Math.abs(hash % 100)
  const result = bucket < rolloutPercentage

  console.log(`[RealtimeConnectionManager] User bucketing: userId=${userId}, bucket=${bucket}, rollout=${rolloutPercentage}%, result=${result ? 'WebSocket' : 'SSE'}`)

  return result
}

// =================== Connection Factory ===================

/**
 * Creates appropriate real-time connection based on migration config
 * Automatically selects WebSocket or SSE
 */
export async function createRealtimeConnection(
  conversationId: string
): Promise<RealtimeConnection> {
  console.log(`[RealtimeConnectionManager] Creating connection for conversation: ${conversationId}`)

  // Fetch migration config
  const config = await fetchMigrationConfig()

  // Determine connection type
  const shouldUseWebSocket = config.enableWebSocket &&
    config.featureFlags.websocketConnections &&
    shouldUserGetWebSocket(config.rolloutPercentage)

  if (shouldUseWebSocket) {
    console.log(`?? [RealtimeConnectionManager] Using WebSocket connection (rollout: ${config.rolloutPercentage}%)`)
    return createWebSocketConnection(conversationId, config)
  } else {
    console.log(`?�� [RealtimeConnectionManager] Using SSE connection (fallback)`)
    return createSSEConnection(conversationId)
  }
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

    send(message: any): boolean {
      return wsClient.send(message)
    },

    addMessage(message: Message) {
      // Messages are typically managed by parent component
      console.log('[WebSocket] Message added (handled by parent):', message)
    },

    clearMessages() {
      console.log('[WebSocket] Clear messages (handled by parent)')
    },

    onMessage(handler: (message: any) => void) {
      wsClient.setEventHandlers({
        onMessage: handler
      })
    },

    onStateChange(handler: (state: ConnectionState) => void) {
      wsClient.setEventHandlers({
        onConnectionChange: handler as any
      })
    },

    onError(handler: (error: Error) => void) {
      wsClient.setEventHandlers({
        onError: handler
      })
    }
  }
}

// =================== SSE Connection Wrapper ===================

function createSSEConnection(conversationId: string): RealtimeConnection {
  const conversationIdRef = ref(conversationId)

  const sseConnection = useSSEMessages(conversationIdRef, {
    autoConnect: false,
    reconnectOnError: true,
    maxReconnectAttempts: 5
  })

  // Map SSE connection state to unified state
  const mappedState = ref<ConnectionState>('disconnected')

  // Store registered handlers
  let stateChangeHandler: ((state: ConnectionState) => void) | null = null

  // Watch SSE state and map to unified state
  const updateMappedState = () => {
    const previousState = mappedState.value

    if (sseConnection.isConnected.value) {
      mappedState.value = 'connected'
    } else if (sseConnection.isConnecting.value) {
      mappedState.value = 'connecting'
    } else if (sseConnection.isReconnecting.value) {
      mappedState.value = 'reconnecting'
    } else if (sseConnection.hasError.value) {
      mappedState.value = 'error'
    } else {
      mappedState.value = 'disconnected'
    }

    // Call registered handler when state changes
    if (stateChangeHandler && previousState !== mappedState.value) {
      console.log(`[SSE Wrapper] State changed: ${previousState} -> ${mappedState.value}`)
      stateChangeHandler(mappedState.value)
    }
  }

  // CRITICAL FIX: Use Vue watch instead of setInterval to prevent infinite updates
  // Watch all SSE state properties and update mappedState reactively
  watch(
    [
      sseConnection.isConnected,
      sseConnection.isConnecting,
      sseConnection.isReconnecting,
      sseConnection.hasError
    ],
    updateMappedState,
    { immediate: true }
  )

  return {
    type: 'sse',
    connectionState: mappedState as Readonly<Ref<ConnectionState>>,
    isConnected: sseConnection.isConnected,
    messages: sseConnection.messages,
    messageCount: sseConnection.messageCount,

    async connect() {
      await sseConnection.connect()
      updateMappedState()
    },

    disconnect() {
      sseConnection.disconnect()
      updateMappedState()
    },

    reconnect() {
      sseConnection.reconnect()
      updateMappedState()
    },

    send(_message: any): boolean {
      // SSE is unidirectional, cannot send messages
      console.warn('[SSE] Cannot send messages via SSE (use HTTP POST instead)')
      return false
    },

    addMessage(message: Message) {
      sseConnection.addMessage(message)
    },

    clearMessages() {
      sseConnection.clearMessages()
    },

    onMessage(_handler: (message: any) => void) {
      // SSE messages are automatically handled by useSSEMessages
      console.log('[SSE] Message handler registered (automatic)')
    },

    onStateChange(handler: (state: ConnectionState) => void) {
      // Store the handler and call immediately with current state
      stateChangeHandler = handler
      console.log(`[SSE] State change handler registered, current state: ${mappedState.value}`)
      // Immediately notify of current state
      handler(mappedState.value)
    },

    onError(_handler: (error: Error) => void) {
      // Errors are automatically handled by useSSEMessages
      console.log('[SSE] Error handler registered (automatic)')
    }
  }
}

// =================== Utility Functions ===================

/**
 * Get current connection type for debugging
 */
export async function getCurrentConnectionType(): Promise<ConnectionType> {
  const config = await fetchMigrationConfig()
  const shouldUseWebSocket = config.enableWebSocket &&
    config.featureFlags.websocketConnections &&
    shouldUserGetWebSocket(config.rolloutPercentage)

  return shouldUseWebSocket ? 'websocket' : 'sse'
}

/**
 * Check if user is in WebSocket rollout
 */
export async function isUserInWebSocketRollout(): Promise<boolean> {
  const config = await fetchMigrationConfig()
  return config.enableWebSocket &&
    config.featureFlags.websocketConnections &&
    shouldUserGetWebSocket(config.rolloutPercentage)
}

/**
 * Get migration statistics
 */
export async function getMigrationStats(): Promise<{
  currentType: ConnectionType
  rolloutPercentage: number
  websocketEnabled: boolean
  sseEnabled: boolean
  featureFlags: MigrationConfig['featureFlags']
}> {
  const config = await fetchMigrationConfig()
  const currentType = await getCurrentConnectionType()

  return {
    currentType,
    rolloutPercentage: config.rolloutPercentage,
    websocketEnabled: config.enableWebSocket,
    sseEnabled: config.enableSSE,
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

