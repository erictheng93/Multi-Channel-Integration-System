/**
 * Vue Composable for WebSocket Performance Tracking
 * WebSocket 性能追蹤 Vue Composable
 *
 * Usage Example:
 * ```typescript
 * import { useWebSocketPerformance } from '@/composables/useWebSocketPerformance'
 *
 * const { tracker, startTracking, stopTracking, stats } = useWebSocketPerformance({
 * userId: user.id,
 * conversationId: conversationId.value,
 * connectionType: 'websocket'
 * })
 *
 * // Start tracking
 * startTracking()
 *
 * // Track events
 * tracker.trackConnectionStart()
 * tracker.trackConnectionSuccess()
 * tracker.trackMessageReceived(messageId, sendTimestamp)
 *
 * // Stop tracking (when component unmounts)
 * stopTracking()
 * ```
 */

import { ref, computed, onUnmounted, watch, type Ref } from 'vue'
import {
  getPerformanceTracker,
  clearPerformanceTracker
} from '@/services/websocketPerformanceTracker'
import type { WebSocketPerformanceTracker } from '@/services/websocketPerformanceTracker'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useWebSocketPerformance')

export interface UseWebSocketPerformanceOptions {
  userId: string
  conversationId?: string
  connectionType?: 'websocket' | 'sse'
  autoStart?: boolean
}

export interface PerformanceStats {
  sessionDuration: number
  connectionTime: number | null
  averageLatency: number | null
  messagesSent: number
  messagesReceived: number
  errorCount: number
  reconnectionCount: number
}

export function useWebSocketPerformance(options: UseWebSocketPerformanceOptions) {
  const {
    userId,
    conversationId,
    connectionType = 'websocket',
    autoStart = true
  } = options

  // State
  const tracker = ref<WebSocketPerformanceTracker | null>(null)
  const isTracking = ref(false)
  const stats = ref<PerformanceStats>({
    sessionDuration: 0,
    connectionTime: null,
    averageLatency: null,
    messagesSent: 0,
    messagesReceived: 0,
    errorCount: 0,
    reconnectionCount: 0
  })

  let statsUpdateInterval: NodeJS.Timeout | null = null

  // =================== Public Methods ===================

  /**
   * Initialize and start performance tracking
   * 初始化並開始性能追蹤
   */
  const startTracking = (): void => {
    if (isTracking.value) {
      console.warn('[useWebSocketPerformance] Already tracking')
      return
    }

    // Create tracker instance
    tracker.value = getPerformanceTracker(userId, connectionType, conversationId)

    // Start tracking
    tracker.value.start()
    isTracking.value = true

    // Start stats update timer
    startStatsUpdate()

    frontendLogger.debug('[useWebSocketPerformance] Tracking started')
  }

  /**
   * Stop performance tracking
   * 停止性能追蹤
   */
  const stopTracking = async (): Promise<void> => {
    if (!isTracking.value || !tracker.value) {return}

    // Stop stats update
    stopStatsUpdate()

    // Stop tracker
    await tracker.value.stop()

    isTracking.value = false

    // Clear global tracker
    clearPerformanceTracker()

    frontendLogger.debug('[useWebSocketPerformance] Tracking stopped')
  }

  /**
   * Pause tracking (keep tracker but stop collecting metrics)
   * 暫停追蹤(保留 tracker 但停止收集指標)
   */
  const pauseTracking = (): void => {
    stopStatsUpdate()
    frontendLogger.debug('[useWebSocketPerformance] Tracking paused')
  }

  /**
   * Resume tracking
   * 恢復追蹤
   */
  const resumeTracking = (): void => {
    if (tracker.value) {
      startStatsUpdate()
      frontendLogger.debug('[useWebSocketPerformance] Tracking resumed')
    }
  }

  /**
   * Refresh current stats
   * 刷新當前統計數據
   */
  const refreshStats = (): void => {
    if (tracker.value) {
      stats.value = tracker.value.getCurrentStats()
    }
  }

  // =================== Connection Event Helpers ===================

  /**
   * Track connection start
   * 追蹤連接開始
   */
  const onConnectionStart = (connectionId?: string): void => {
    tracker.value?.trackConnectionStart(connectionId)
  }

  /**
   * Track successful connection
   * 追蹤連接成功
   */
  const onConnectionSuccess = (): void => {
    tracker.value?.trackConnectionSuccess()
    refreshStats()
  }

  /**
   * Track connection error
   * 追蹤連接錯誤
   */
  const onConnectionError = (
    errorType: string,
    errorMessage: string,
    errorCode?: string | number
  ): void => {
    tracker.value?.trackConnectionError(errorType, errorMessage, errorCode)
    refreshStats()
  }

  /**
   * Track reconnection attempt
   * 追蹤重連嘗試
   */
  const onReconnectionAttempt = (): void => {
    tracker.value?.trackReconnectionAttempt()
    refreshStats()
  }

  // =================== Message Event Helpers ===================

  /**
   * Track message sent
   * 追蹤發送消息
   */
  const onMessageSent = (messageId?: string): void => {
    tracker.value?.trackMessageSent(messageId)
    refreshStats()
  }

  /**
   * Track message received
   * 追蹤接收消息
   */
  const onMessageReceived = (messageId?: string, sendTimestamp?: number): void => {
    tracker.value?.trackMessageReceived(messageId, sendTimestamp)
    refreshStats()
  }

  /**
   * Measure current latency
   * 測量當前延遲
   */
  const measureLatency = async (): Promise<number> => {
    if (!tracker.value) {return 0}
    return await tracker.value.measureLatency()
  }

  // =================== Computed Properties ===================

  const performanceScore = computed(() => {
    // Calculate overall performance score (0-100)
    let score = 100

    // Deduct for high latency
    if (stats.value.averageLatency !== null) {
      if (stats.value.averageLatency > 500) {score -= 30}
      else if (stats.value.averageLatency > 200) {score -= 15}
      else if (stats.value.averageLatency > 100) {score -= 5}
    }

    // Deduct for errors
    if (stats.value.errorCount > 0) {
      score -= Math.min(20, stats.value.errorCount * 5)
    }

    // Deduct for reconnections
    if (stats.value.reconnectionCount > 0) {
      score -= Math.min(15, stats.value.reconnectionCount * 5)
    }

    // Deduct for slow connection
    if (stats.value.connectionTime !== null && stats.value.connectionTime > 2000) {
      score -= 10
    }

    return Math.max(0, score)
  })

  const performanceGrade = computed(() => {
    const score = performanceScore.value

    if (score >= 90) {return 'A'} // Excellent
    if (score >= 80) {return 'B'} // Good
    if (score >= 70) {return 'C'} // Fair
    if (score >= 60) {return 'D'} // Poor
    return 'F' // Critical
  })

  const performanceStatus = computed<'excellent' | 'good' | 'fair' | 'poor' | 'critical'>(() => {
    const score = performanceScore.value

    if (score >= 90) {return 'excellent'}
    if (score >= 80) {return 'good'}
    if (score >= 70) {return 'fair'}
    if (score >= 60) {return 'poor'}
    return 'critical'
  })

  const hasErrors = computed(() => stats.value.errorCount > 0)
  const hasReconnections = computed(() => stats.value.reconnectionCount > 0)

  const latencyStatus = computed<'excellent' | 'good' | 'fair' | 'poor'>(() => {
    const latency = stats.value.averageLatency

    if (latency === null) {return 'good'}
    if (latency < 100) {return 'excellent'}
    if (latency < 200) {return 'good'}
    if (latency < 500) {return 'fair'}
    return 'poor'
  })

  // =================== Internal Methods ===================

  const startStatsUpdate = (): void => {
    // Update stats every second
    statsUpdateInterval = setInterval(() => {
      refreshStats()
    }, 1000)
  }

  const stopStatsUpdate = (): void => {
    if (statsUpdateInterval) {
      clearInterval(statsUpdateInterval)
      statsUpdateInterval = null
    }
  }

  // =================== Lifecycle Hooks ===================

  // Auto-start if requested
  if (autoStart) {
    startTracking()
  }

  // Cleanup on unmount
  onUnmounted(async () => {
    await stopTracking()
  })

  // Watch for conversation changes
  watch(
    () => conversationId,
    async (newId, oldId) => {
      if (oldId && oldId !== newId) {
        // Conversation changed, restart tracking
        await stopTracking()
        startTracking()
      }
    }
  )

  // =================== Return API ===================

  return {
    // State
    tracker: tracker as Ref<WebSocketPerformanceTracker | null>,
    isTracking: computed(() => isTracking.value),
    stats: computed(() => stats.value),

    // Computed metrics
    performanceScore: computed(() => performanceScore.value),
    performanceGrade: computed(() => performanceGrade.value),
    performanceStatus: computed(() => performanceStatus.value),
    hasErrors: computed(() => hasErrors.value),
    hasReconnections: computed(() => hasReconnections.value),
    latencyStatus: computed(() => latencyStatus.value),

    // Control methods
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    refreshStats,

    // Connection event methods
    onConnectionStart,
    onConnectionSuccess,
    onConnectionError,
    onReconnectionAttempt,

    // Message event methods
    onMessageSent,
    onMessageReceived,
    measureLatency
  }
}

// =================== Helper Hook for Auto-tracking ===================

/**
 * Automatically track WebSocket events for a connection
 * 自動追蹤 WebSocket 連接的事件
 *
 * This composable integrates directly with WebSocket connection state
 */
export function useAutoWebSocketPerformance(
  userId: Ref<string>,
  conversationId: Ref<string | undefined>,
  connectionState: Ref<{
    status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
    error?: string
  }>
) {
  const performance = useWebSocketPerformance({
    userId: userId.value,
    conversationId: conversationId.value,
    connectionType: 'websocket',
    autoStart: true
  })

  // Watch connection state changes
  watch(
    () => connectionState.value.status,
    (newStatus, oldStatus) => {
      switch (newStatus) {
        case 'connecting':
          if (oldStatus !== 'reconnecting') {
            performance.onConnectionStart()
          }
          break

        case 'connected':
          performance.onConnectionSuccess()
          break

        case 'reconnecting':
          performance.onReconnectionAttempt()
          break

        case 'error':
          if (connectionState.value.error) {
            performance.onConnectionError(
              'connection_error',
              connectionState.value.error
            )
          }
          break
      }
    },
    { immediate: true }
  )

  return performance
}
