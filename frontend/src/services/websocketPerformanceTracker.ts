/**
 * WebSocket Performance Tracking Service
 * 前端 WebSocket 性能追蹤服務
 *
 * Purpose: Track real-time WebSocket performance metrics from client perspective
 * 目的: 從客戶端視角追蹤實時 WebSocket 性能指標
 *
 * Metrics Collected:
 * - Connection time (連接時間)
 * - Message latency (消息延遲)
 * - Error rates (錯誤率)
 * - Reconnection attempts (重連次數)
 * - Connection stability (連接穩定性)
 *
 * @version 1.0.0
 * @date 2025-10-08
 */

// REMOVED: axios import (replaced with native fetch API)

// =================== Type Definitions ===================

interface PerformanceMetric {
  timestamp: number
  metric: string
  value: number
  unit: string
  metadata?: Record<string, unknown>
}

interface ConnectionMetrics {
  connectionId: string
  startTime: number
  endTime?: number
  connectionTime?: number
  errors: ErrorEvent[]
  reconnectionAttempts: number
  messagesReceived: number
  messagesSent: number
  latencyMeasurements: LatencyMeasurement[]
}

interface LatencyMeasurement {
  timestamp: number
  roundTripTime: number
  messageId?: string
}

interface ErrorEvent {
  timestamp: number
  errorType: string
  errorMessage: string
  errorCode?: string | number
}

interface PerformanceReport {
  sessionId: string
  userId: string
  conversationId?: string
  connectionType: 'websocket' | 'sse'
  startTime: number
  endTime: number
  totalDuration: number
  metrics: {
    averageConnectionTime: number
    averageLatency: number
    p50Latency: number
    p95Latency: number
    p99Latency: number
    errorRate: number
    connectionSuccessRate: number
    reconnectionCount: number
    messagesReceived: number
    messagesSent: number
  }
  errors: ErrorEvent[]
  rawMetrics: PerformanceMetric[]
}

// =================== Configuration ===================

const CONFIG = {
  // Performance tracking settings
  enableTracking: true,
  enableDetailedLogging: false,

  // Reporting settings
  reportingInterval: 60000, // 60 seconds
  maxMetricsBufferSize: 1000,

  // Backend endpoints
  reportingEndpoint: '/api/websocket/analytics/client-performance',

  // Latency measurement
  heartbeatInterval: 10000, // 10 seconds
  maxLatencySamples: 100,

  // Storage keys
  sessionIdKey: 'ws_perf_session_id',
  metricsStorageKey: 'ws_perf_metrics'
}

// =================== Performance Tracker Class ===================

export class WebSocketPerformanceTracker {
  private sessionId: string
  private userId: string
  private conversationId?: string
  private connectionType: 'websocket' | 'sse'

  private currentConnection: ConnectionMetrics | null = null
  private metricsBuffer: PerformanceMetric[] = []
  private reportingTimer: NodeJS.Timeout | null = null

  private isTracking = false
  private apiBaseUrl: string

  constructor(
    userId: string,
    connectionType: 'websocket' | 'sse' = 'websocket',
    conversationId?: string
  ) {
    this.sessionId = this.generateSessionId()
    this.userId = userId
    this.conversationId = conversationId
    this.connectionType = connectionType
    // REMOTE-ONLY: Always use remote API
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://multi-channel.imfinethankyouandyou.com'

    this.log('Performance tracker initialized', {
      sessionId: this.sessionId,
      userId,
      connectionType
    })
  }

  // =================== Public Methods ===================

  /**
   * Start tracking performance metrics
   * 開始追蹤性能指標
   */
  start(): void {
    if (this.isTracking) {
      this.log('Tracker already running', {}, 'warn')
      return
    }

    this.isTracking = true
    this.log('Performance tracking started')

    // Start periodic reporting
    this.startPeriodicReporting()

    // Record session start
    this.recordMetric('session_start', Date.now(), 'timestamp')
  }

  /**
   * Stop tracking and send final report
   * 停止追蹤並發送最終報告
   */
  async stop(): Promise<void> {
    if (!this.isTracking) {return}

    this.isTracking = false
    this.log('Performance tracking stopped')

    // Stop periodic reporting
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer)
      this.reportingTimer = null
    }

    // Record session end
    this.recordMetric('session_end', Date.now(), 'timestamp')

    // Send final report
    await this.sendPerformanceReport()
  }

  /**
   * Track connection attempt
   * 追蹤連接嘗試
   */
  trackConnectionStart(connectionId?: string): void {
    const connId = connectionId || `conn_${Date.now()}`

    this.currentConnection = {
      connectionId: connId,
      startTime: Date.now(),
      errors: [],
      reconnectionAttempts: 0,
      messagesReceived: 0,
      messagesSent: 0,
      latencyMeasurements: []
    }

    this.log(`Connection tracking started: ${connId}`)
    this.recordMetric('connection_start', Date.now(), 'timestamp', {
      connectionId: connId
    })
  }

  /**
   * Track successful connection
   * 追蹤連接成功
   */
  trackConnectionSuccess(): void {
    if (!this.currentConnection) {
      this.log('No active connection to track success', {}, 'warn')
      return
    }

    const endTime = Date.now()
    const connectionTime = endTime - this.currentConnection.startTime

    this.currentConnection.endTime = endTime
    this.currentConnection.connectionTime = connectionTime

    this.log(`Connection successful: ${connectionTime}ms`, {
      connectionId: this.currentConnection.connectionId
    })

    this.recordMetric('connection_time', connectionTime, 'ms', {
      connectionId: this.currentConnection.connectionId,
      success: true
    })

    this.recordMetric('connection_success', 1, 'count')
  }

  /**
   * Track connection failure
   * 追蹤連接失敗
   */
  trackConnectionError(errorType: string, errorMessage: string, errorCode?: string | number): void {
    if (!this.currentConnection) {
      this.log('No active connection to track error', {}, 'warn')
      return
    }

    const errorEvent: ErrorEvent = {
      timestamp: Date.now(),
      errorType,
      errorMessage,
      errorCode
    }

    this.currentConnection.errors.push(errorEvent)

    this.log(`Connection error: ${errorType} - ${errorMessage}`, {
      connectionId: this.currentConnection.connectionId,
      errorCode
    }, 'error')

    this.recordMetric('connection_error', 1, 'count', {
      connectionId: this.currentConnection.connectionId,
      errorType,
      errorCode
    })
  }

  /**
   * Track reconnection attempt
   * 追蹤重連嘗試
   */
  trackReconnectionAttempt(): void {
    if (!this.currentConnection) {return}

    this.currentConnection.reconnectionAttempts++

    this.log(`Reconnection attempt #${this.currentConnection.reconnectionAttempts}`, {
      connectionId: this.currentConnection.connectionId
    })

    this.recordMetric('reconnection_attempt', 1, 'count', {
      connectionId: this.currentConnection.connectionId,
      attempt: this.currentConnection.reconnectionAttempts
    })
  }

  /**
   * Track message sent
   * 追蹤發送消息
   */
  trackMessageSent(messageId?: string): void {
    if (!this.currentConnection) {return}

    this.currentConnection.messagesSent++

    this.recordMetric('message_sent', 1, 'count', {
      connectionId: this.currentConnection.connectionId,
      messageId
    })
  }

  /**
   * Track message received
   * 追蹤接收消息
   */
  trackMessageReceived(messageId?: string, sendTimestamp?: number): void {
    if (!this.currentConnection) {return}

    this.currentConnection.messagesReceived++

    // Calculate latency if send timestamp is provided
    if (sendTimestamp) {
      const latency = Date.now() - sendTimestamp

      this.currentConnection.latencyMeasurements.push({
        timestamp: Date.now(),
        roundTripTime: latency,
        messageId
      })

      // Limit latency samples
      if (this.currentConnection.latencyMeasurements.length > CONFIG.maxLatencySamples) {
        this.currentConnection.latencyMeasurements.shift()
      }

      this.recordMetric('message_latency', latency, 'ms', {
        connectionId: this.currentConnection.connectionId,
        messageId
      })
    }

    this.recordMetric('message_received', 1, 'count', {
      connectionId: this.currentConnection.connectionId,
      messageId
    })
  }

  /**
   * Measure ping/pong latency
   * 測量 ping/pong 延遲
   */
  async measureLatency(): Promise<number> {
    const startTime = Date.now()

    // This would typically ping the server
    // For now, we'll simulate with a timestamp check
    const latency = Date.now() - startTime

    if (this.currentConnection) {
      this.currentConnection.latencyMeasurements.push({
        timestamp: Date.now(),
        roundTripTime: latency
      })
    }

    this.recordMetric('ping_latency', latency, 'ms')

    return latency
  }

  /**
   * Get current performance statistics
   * 獲取當前性能統計
   */
  getCurrentStats(): {
    sessionDuration: number
    connectionTime: number | null
    averageLatency: number | null
    messagesSent: number
    messagesReceived: number
    errorCount: number
    reconnectionCount: number
  } {
    const now = Date.now()
    const sessionStart = this.metricsBuffer.find(m => m.metric === 'session_start')
    const sessionDuration = sessionStart ? now - sessionStart.value : 0

    const latencyMetrics = this.metricsBuffer.filter(m => m.metric === 'message_latency')
    const averageLatency = latencyMetrics.length > 0
      ? latencyMetrics.reduce((sum, m) => sum + m.value, 0) / latencyMetrics.length
      : null

    return {
      sessionDuration,
      connectionTime: this.currentConnection?.connectionTime || null,
      averageLatency,
      messagesSent: this.currentConnection?.messagesSent || 0,
      messagesReceived: this.currentConnection?.messagesReceived || 0,
      errorCount: this.currentConnection?.errors.length || 0,
      reconnectionCount: this.currentConnection?.reconnectionAttempts || 0
    }
  }

  // =================== Private Methods ===================

  private recordMetric(
    metric: string,
    value: number,
    unit: string,
    metadata?: Record<string, unknown>
  ): void {
    const performanceMetric: PerformanceMetric = {
      timestamp: Date.now(),
      metric,
      value,
      unit,
      metadata
    }

    this.metricsBuffer.push(performanceMetric)

    // Prevent buffer overflow
    if (this.metricsBuffer.length > CONFIG.maxMetricsBufferSize) {
      this.metricsBuffer.shift()
    }

    this.log(`Metric recorded: ${metric} = ${value} ${unit}`, metadata, 'debug')
  }

  private startPeriodicReporting(): void {
    this.reportingTimer = setInterval(() => {
      this.sendPerformanceReport().catch(error => {
        this.log('Failed to send periodic report', { error }, 'error')
      })
    }, CONFIG.reportingInterval)

    this.log(`Periodic reporting started (interval: ${CONFIG.reportingInterval}ms)`)
  }

  private async sendPerformanceReport(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      this.log('No metrics to report', {}, 'debug')
      return
    }

    const report = this.generatePerformanceReport()

    try {
      const authStore = await import('@/stores/auth').then(m => m.useAuthStore())

      await fetch(
        `${this.apiBaseUrl}${CONFIG.reportingEndpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authStore.token}`
          },
          body: JSON.stringify(report)
        }
      )

      this.log(`Performance report sent: ${this.metricsBuffer.length} metrics`)

      // Clear sent metrics
      this.metricsBuffer = []

    } catch (error) {
      this.log('Failed to send performance report', { error }, 'error')
      // Keep metrics for retry
    }
  }

  private generatePerformanceReport(): PerformanceReport {
    const sessionStart = this.metricsBuffer.find(m => m.metric === 'session_start')
    const sessionEnd = this.metricsBuffer.find(m => m.metric === 'session_end')

    const startTime = sessionStart?.value || Date.now()
    const endTime = sessionEnd?.value || Date.now()

    // Calculate metrics
    const connectionTimes = this.metricsBuffer
      .filter(m => m.metric === 'connection_time')
      .map(m => m.value)

    const latencies = this.metricsBuffer
      .filter(m => m.metric === 'message_latency')
      .map(m => m.value)

    const errorCount = this.metricsBuffer
      .filter(m => m.metric === 'connection_error')
      .length

    const connectionAttempts = this.metricsBuffer
      .filter(m => m.metric === 'connection_start')
      .length

    const connectionSuccesses = this.metricsBuffer
      .filter(m => m.metric === 'connection_success')
      .length

    return {
      sessionId: this.sessionId,
      userId: this.userId,
      conversationId: this.conversationId,
      connectionType: this.connectionType,
      startTime,
      endTime,
      totalDuration: endTime - startTime,
      metrics: {
        averageConnectionTime: this.calculateAverage(connectionTimes),
        averageLatency: this.calculateAverage(latencies),
        p50Latency: this.calculatePercentile(latencies, 50),
        p95Latency: this.calculatePercentile(latencies, 95),
        p99Latency: this.calculatePercentile(latencies, 99),
        errorRate: connectionAttempts > 0 ? (errorCount / connectionAttempts) * 100 : 0,
        connectionSuccessRate: connectionAttempts > 0 ? (connectionSuccesses / connectionAttempts) * 100 : 0,
        reconnectionCount: this.currentConnection?.reconnectionAttempts || 0,
        messagesReceived: this.currentConnection?.messagesReceived || 0,
        messagesSent: this.currentConnection?.messagesSent || 0
      },
      errors: this.currentConnection?.errors || [],
      rawMetrics: this.metricsBuffer
    }
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) {return 0}
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) {return 0}

    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1

    return sorted[Math.max(0, index)] ?? 0
  }

  private generateSessionId(): string {
    // Try to reuse existing session ID
    const existing = localStorage.getItem(CONFIG.sessionIdKey)
    if (existing) {return existing}

    // Generate new session ID
    const sessionId = `ws_perf_${Date.now()}_${Math.random().toString(36).substring(2)}`
    localStorage.setItem(CONFIG.sessionIdKey, sessionId)

    return sessionId
  }

  private log(message: string, metadata?: Record<string, unknown>, level: 'log' | 'warn' | 'error' | 'debug' = 'log'): void {
    if (!CONFIG.enableDetailedLogging && level === 'debug') {return}

    const prefix = '[WebSocket Performance]'
    const logData = metadata ? { ...metadata } : {}

    switch (level) {
      case 'error':
        console.error(prefix, message, logData)
        break
      case 'warn':
        console.warn(prefix, message, logData)
        break
      case 'debug':
        console.debug(prefix, message, logData)
        break
      default:
        console.log(prefix, message, logData)
    }
  }
}

// =================== Singleton Instance (Optional) ===================

let globalTracker: WebSocketPerformanceTracker | null = null

export function getPerformanceTracker(
  userId: string,
  connectionType: 'websocket' | 'sse' = 'websocket',
  conversationId?: string
): WebSocketPerformanceTracker {
  if (!globalTracker) {
    globalTracker = new WebSocketPerformanceTracker(userId, connectionType, conversationId)
  }

  return globalTracker
}

export function clearPerformanceTracker(): void {
  if (globalTracker) {
    globalTracker.stop()
    globalTracker = null
  }
}
