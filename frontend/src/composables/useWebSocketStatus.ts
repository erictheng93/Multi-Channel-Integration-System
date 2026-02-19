// WebSocket Status and Health Monitoring Composable
// Project: Multi-Channel Support MVP
// Created by: WebSocket Migration Developer

import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'
import { useWebSocket } from './useWebSocket'
import type { WebSocketConnectionState } from '@/services/websocketClient'
import { nowISO } from '@/utils/timestamp'

export interface ConnectionHealth {
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'offline'
  latency: number
  uptime: number
  reconnectCount: number
  messagesSent: number
  messagesReceived: number
  lastError: Error | null
}

export interface WebSocketStatusIndicator {
  state: WebSocketConnectionState
  color: string
  icon: string
  label: string
  description: string
  showPulse: boolean
}

export function useWebSocketStatus() {
  const webSocket = useWebSocket({ autoConnect: false })

  // Health monitoring state
  const latency = ref(0)
  const messagesSent = ref(0)
  const messagesReceived = ref(0)
  const lastPingTime = ref(0)
  const healthCheckInterval: { value: NodeJS.Timeout | null } = { value: null }

  // Computed connection health
  const connectionHealth = computed((): ConnectionHealth => {
    const stats = webSocket.stats.value

    let quality: ConnectionHealth['quality'] = 'offline'

    if (webSocket.isConnected.value) {
      if (latency.value < 100 && stats.queueSize < 3) {
        quality = 'excellent'
      } else if (latency.value < 300 && stats.queueSize < 10) {
        quality = 'good'
      } else if (latency.value < 800 && stats.queueSize < 20) {
        quality = 'fair'
      } else {
        quality = 'poor'
      }
    }

    return {
      quality,
      latency: latency.value,
      uptime: stats.uptime,
      reconnectCount: webSocket.connectionAttempts.value,
      messagesSent: messagesSent.value,
      messagesReceived: messagesReceived.value,
      lastError: webSocket.lastConnectionError.value
    }
  })

  // Visual status indicator
  const statusIndicator = computed((): WebSocketStatusIndicator => {
    const state = webSocket.connectionState.value

    const indicators: Record<WebSocketConnectionState, Omit<WebSocketStatusIndicator, 'state'>> = {
      disconnected: {
        color: 'text-gray-400',
        icon: '⚫',
        label: '離線',
        description: 'WebSocket 未連接',
        showPulse: false
      },
      connecting: {
        color: 'text-yellow-500',
        icon: '🟡',
        label: '連接中',
        description: '正在建立 WebSocket 連接',
        showPulse: true
      },
      connected: {
        color: 'text-green-500',
        icon: '🟢',
        label: '已連接',
        description: 'WebSocket 連接正常',
        showPulse: false
      },
      reconnecting: {
        color: 'text-orange-500',
        icon: '🟠',
        label: '重連中',
        description: '正在重新建立連接',
        showPulse: true
      },
      error: {
        color: 'text-red-500',
        icon: '🔴',
        label: '錯誤',
        description: 'WebSocket 連接發生錯誤',
        showPulse: false
      },
      closed: {
        color: 'text-gray-500',
        icon: '⚪',
        label: '已關閉',
        description: 'WebSocket 連接已關閉',
        showPulse: false
      }
    }

    return {
      state,
      ...indicators[state]
    }
  })

  // Connection quality badge
  const qualityBadge = computed(() => {
    const health = connectionHealth.value

    const badges = {
      excellent: {
        color: 'bg-green-100 text-green-800 border-green-200',
        label: '優秀',
        icon: '⚡'
      },
      good: {
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        label: '良好',
        icon: '✓'
      },
      fair: {
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        label: '一般',
        icon: '⚠'
      },
      poor: {
        color: 'bg-red-100 text-red-800 border-red-200',
        label: '較差',
        icon: '⚠'
      },
      offline: {
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        label: '離線',
        icon: '⚫'
      }
    }

    return badges[health.quality]
  })

  // Detailed status information
  const detailedStatus = computed(() => {
    const stats = webSocket.stats.value
    const health = connectionHealth.value

    return {
      connection: {
        state: statusIndicator.value.label,
        uptime: formatUptime(health.uptime),
        quality: qualityBadge.value.label,
        latency: `${health.latency}ms`
      },
      traffic: {
        sent: health.messagesSent,
        received: health.messagesReceived,
        queued: stats.queueSize,
        conversations: stats.connectedConversations
      },
      users: {
        online: stats.onlineUsers,
        total: stats.onlineUsers // This could be expanded with total user count
      },
      errors: {
        reconnectCount: health.reconnectCount,
        lastError: health.lastError?.message || null
      }
    }
  })

  // Performance warnings
  const performanceWarnings = computed(() => {
    const warnings: string[] = []
    const health = connectionHealth.value
    const stats = webSocket.stats.value

    if (health.latency > 1000) {
      warnings.push('網路延遲過高')
    }

    if (stats.queueSize > 20) {
      warnings.push('訊息佇列堆積')
    }

    if (health.reconnectCount > 5) {
      warnings.push('頻繁重連')
    }

    if (!webSocket.isConnected.value && health.reconnectCount > 0) {
      warnings.push('連接不穩定')
    }

    return warnings
  })

  // Methods
  const measureLatency = async (): Promise<number> => {
    if (!webSocket.isConnected.value) { return -1 }

    const startTime = Date.now()
    lastPingTime.value = startTime

    try {
      // Send ping and wait for response (this would need WebSocket implementation)
      // For now, simulate with a small delay
      await new Promise(resolve => setTimeout(resolve, 50))

      const endTime = Date.now()
      const measuredLatency = endTime - startTime
      latency.value = measuredLatency

      return measuredLatency
    } catch (error) {
      console.error('[useWebSocketStatus] Latency measurement failed:', error)
      return -1
    }
  }

  const startHealthMonitoring = (): void => {
    if (healthCheckInterval.value) { return }

    healthCheckInterval.value = setInterval(async () => {
      if (webSocket.isConnected.value) {
        await measureLatency()
      }
    }, 30000) // Check every 30 seconds
  }

  const stopHealthMonitoring = (): void => {
    if (healthCheckInterval.value) {
      clearInterval(healthCheckInterval.value)
      healthCheckInterval.value = null
    }
  }

  const resetStats = (): void => {
    messagesSent.value = 0
    messagesReceived.value = 0
    latency.value = 0
  }

  const exportDiagnostics = () => {
    return {
      timestamp: nowISO(),
      connection: detailedStatus.value,
      health: connectionHealth.value,
      warnings: performanceWarnings.value,
      userAgent: navigator.userAgent,
      url: window.location.href
    }
  }

  // Setup event tracking
  const setupEventTracking = (): void => {
    webSocket.setEventCallbacks({
      onConnectionStateChange: (state) => {
        console.log(`[useWebSocketStatus] Connection state changed to: ${state}`)
      },
      onError: (error) => {
        console.error('[useWebSocketStatus] WebSocket error:', error)
      }
    })
  }

  // Lifecycle
  onMounted(() => {
    setupEventTracking()
    startHealthMonitoring()
  })

  onUnmounted(() => {
    stopHealthMonitoring()
  })

  return {
    // State
    connectionHealth: readonly(connectionHealth),
    statusIndicator: readonly(statusIndicator),
    qualityBadge: readonly(qualityBadge),
    detailedStatus: readonly(detailedStatus),
    performanceWarnings: readonly(performanceWarnings),

    // Raw metrics
    latency: readonly(latency),
    messagesSent: readonly(messagesSent),
    messagesReceived: readonly(messagesReceived),

    // WebSocket state passthrough
    connectionState: webSocket.connectionState,
    isConnected: webSocket.isConnected,
    isConnecting: webSocket.isConnecting,
    isReconnecting: webSocket.isReconnecting,
    connectionQuality: webSocket.connectionQuality,

    // Methods
    measureLatency,
    startHealthMonitoring,
    stopHealthMonitoring,
    resetStats,
    exportDiagnostics
  }
}

// Utility functions
function formatUptime(milliseconds: number): string {
  if (milliseconds < 1000) { return `${milliseconds}ms` }

  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) { return `${days}天 ${hours % 24}小時` }
  if (hours > 0) { return `${hours}小時 ${minutes % 60}分鐘` }
  if (minutes > 0) { return `${minutes}分鐘 ${seconds % 60}秒` }
  return `${seconds}秒`
}

// Helper function to make refs readonly
function readonly<T>(ref: Ref<T>): Readonly<Ref<T>> {
  return ref as Readonly<Ref<T>>
}