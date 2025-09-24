// 🚀 Phase 2: SSE Performance Monitoring System
// Comprehensive performance monitoring for SSE message system

import type { Bindings } from '../types'

export interface SSEMetrics {
  // Connection Metrics
  totalConnections: number
  activeConnections: number
  successfulConnections: number
  failedConnections: number
  averageConnectionTime: number

  // Message Metrics
  totalMessages: number
  messagesPerSecond: number
  averageMessageLatency: number
  duplicateMessages: number
  lostMessages: number

  // Performance Metrics
  memoryUsage: number
  cpuUsage: number
  responseTimeP50: number
  responseTimeP95: number
  errorRate: number

  // Reliability Metrics
  uptime: number
  reconnectionRate: number
  connectionStability: number
  healthScore: number

  timestamp: number
  period: string // '1m', '5m', '1h', '24h'
}

export interface SSEConnectionEvent {
  type: 'connect' | 'disconnect' | 'message' | 'error' | 'heartbeat'
  connectionId: string
  conversationId?: string
  userId?: string
  timestamp: number
  latency?: number
  error?: string
  metadata?: Record<string, unknown>
}

export class SSEPerformanceMonitor {
  private env: Bindings
  private metrics: Map<string, SSEMetrics> = new Map()
  private connectionEvents: Map<string, SSEConnectionEvent[]> = new Map()
  private startTime: number

  constructor(env: Bindings) {
    this.env = env
    this.startTime = Date.now()
  }

  // 📊 Record SSE Connection Event
  async recordConnectionEvent(event: SSEConnectionEvent): Promise<void> {
    const connectionId = event.connectionId

    // Store event in memory buffer
    if (!this.connectionEvents.has(connectionId)) {
      this.connectionEvents.set(connectionId, [])
    }

    const events = this.connectionEvents.get(connectionId)!
    events.push(event)

    // Keep only last 100 events per connection
    if (events.length > 100) {
      events.shift()
    }

    // Update metrics based on event type
    await this.updateMetricsFromEvent(event)

    // Store in KV for persistence (with TTL)
    try {
      const eventKey = `sse_event:${connectionId}:${event.timestamp}`
      await this.env.CACHE?.put(eventKey, JSON.stringify(event), {
        expirationTtl: 86400 // 24 hours
      })
    } catch (error) {
      console.warn('[SSE Monitor] Failed to store event:', error)
    }
  }

  // 📈 Update Metrics from Event
  private async updateMetricsFromEvent(event: SSEConnectionEvent): Promise<void> {
    const now = Date.now()
    const period = '1m' // 1-minute metrics window
    const metricsKey = `${Math.floor(now / 60000)}_${period}` // Round to minute

    let currentMetrics = this.metrics.get(metricsKey)
    if (!currentMetrics) {
      currentMetrics = this.createEmptyMetrics(period, now)
      this.metrics.set(metricsKey, currentMetrics)
    }

    // Update metrics based on event type
    switch (event.type) {
      case 'connect':
        currentMetrics.totalConnections++
        currentMetrics.activeConnections++
        if (event.latency) {
          currentMetrics.averageConnectionTime = this.updateAverage(
            currentMetrics.averageConnectionTime,
            event.latency,
            currentMetrics.totalConnections
          )
        }
        if (!event.error) {
          currentMetrics.successfulConnections++
        } else {
          currentMetrics.failedConnections++
        }
        break

      case 'disconnect':
        currentMetrics.activeConnections = Math.max(0, currentMetrics.activeConnections - 1)
        break

      case 'message':
        currentMetrics.totalMessages++
        if (event.latency) {
          currentMetrics.averageMessageLatency = this.updateAverage(
            currentMetrics.averageMessageLatency,
            event.latency,
            currentMetrics.totalMessages
          )
        }
        break

      case 'error':
        // Update error rate
        const totalEvents = currentMetrics.totalConnections + currentMetrics.totalMessages
        if (totalEvents > 0) {
          currentMetrics.errorRate = (currentMetrics.failedConnections / totalEvents) * 100
        }
        break

      case 'heartbeat':
        // Heartbeat indicates healthy connection
        break
    }

    // Calculate derived metrics
    this.calculateDerivedMetrics(currentMetrics, now)

    // Persist metrics to KV
    await this.persistMetrics(metricsKey, currentMetrics)
  }

  // 🧮 Calculate Derived Metrics
  private calculateDerivedMetrics(metrics: SSEMetrics, timestamp: number): void {
    const timeElapsed = (timestamp - this.startTime) / 1000 // seconds

    // Messages per second
    if (timeElapsed > 0) {
      metrics.messagesPerSecond = metrics.totalMessages / timeElapsed
    }

    // Connection stability (successful connections / total attempts)
    if (metrics.totalConnections > 0) {
      metrics.connectionStability = (metrics.successfulConnections / metrics.totalConnections) * 100
    }

    // Uptime calculation
    metrics.uptime = timeElapsed

    // Health score (composite metric)
    metrics.healthScore = this.calculateHealthScore(metrics)

    metrics.timestamp = timestamp
  }

  // 🏥 Calculate Health Score
  private calculateHealthScore(metrics: SSEMetrics): number {
    let score = 100

    // Penalize high error rates
    score -= metrics.errorRate * 2

    // Penalize low connection stability
    score -= (100 - metrics.connectionStability) * 0.5

    // Penalize high latency
    if (metrics.averageMessageLatency > 3000) {
      score -= (metrics.averageMessageLatency - 3000) / 100
    }

    // Penalize high reconnection rate
    if (metrics.reconnectionRate > 10) {
      score -= (metrics.reconnectionRate - 10) * 2
    }

    return Math.max(0, Math.min(100, score))
  }

  // 📊 Get Current Metrics
  async getCurrentMetrics(period: string = '1m'): Promise<SSEMetrics | null> {
    const now = Date.now()
    const metricsKey = `${Math.floor(now / this.getPeriodMs(period))}_${period}`

    // Try memory first
    let metrics = this.metrics.get(metricsKey)
    if (metrics) {
      return metrics
    }

    // Try KV storage
    try {
      const storedMetrics = await this.env.CACHE?.get(`sse_metrics:${metricsKey}`)
      if (storedMetrics) {
        metrics = JSON.parse(storedMetrics) as SSEMetrics
        this.metrics.set(metricsKey, metrics)
        return metrics
      }
    } catch (error) {
      console.warn('[SSE Monitor] Failed to retrieve metrics:', error)
    }

    return null
  }

  // 📈 Get Metrics History
  async getMetricsHistory(period: string, hours: number = 24): Promise<SSEMetrics[]> {
    const history: SSEMetrics[] = []
    const now = Date.now()
    const periodMs = this.getPeriodMs(period)
    const totalPeriods = Math.floor((hours * 60 * 60 * 1000) / periodMs)

    for (let i = totalPeriods; i >= 0; i--) {
      const timestamp = now - (i * periodMs)
      const metricsKey = `${Math.floor(timestamp / periodMs)}_${period}`

      try {
        const storedMetrics = await this.env.CACHE?.get(`sse_metrics:${metricsKey}`)
        if (storedMetrics) {
          history.push(JSON.parse(storedMetrics))
        }
      } catch (error) {
        console.warn(`[SSE Monitor] Failed to retrieve metrics for ${metricsKey}:`, error)
      }
    }

    return history
  }

  // 🚨 Get Alert Conditions
  async checkAlertConditions(): Promise<Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' | 'critical' }>> {
    const alerts: Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' | 'critical' }> = []
    const currentMetrics = await this.getCurrentMetrics('1m')

    if (!currentMetrics) {
      return alerts
    }

    // High error rate
    if (currentMetrics.errorRate > 10) {
      alerts.push({
        type: 'error_rate',
        message: `SSE error rate is ${currentMetrics.errorRate.toFixed(1)}% (threshold: 10%)`,
        severity: 'critical'
      })
    } else if (currentMetrics.errorRate > 5) {
      alerts.push({
        type: 'error_rate',
        message: `SSE error rate is ${currentMetrics.errorRate.toFixed(1)}% (threshold: 5%)`,
        severity: 'high'
      })
    }

    // High message latency
    if (currentMetrics.averageMessageLatency > 5000) {
      alerts.push({
        type: 'latency',
        message: `SSE message latency is ${currentMetrics.averageMessageLatency}ms (threshold: 5000ms)`,
        severity: 'high'
      })
    } else if (currentMetrics.averageMessageLatency > 3000) {
      alerts.push({
        type: 'latency',
        message: `SSE message latency is ${currentMetrics.averageMessageLatency}ms (threshold: 3000ms)`,
        severity: 'medium'
      })
    }

    // Low connection stability
    if (currentMetrics.connectionStability < 90) {
      alerts.push({
        type: 'stability',
        message: `SSE connection stability is ${currentMetrics.connectionStability.toFixed(1)}% (threshold: 90%)`,
        severity: 'high'
      })
    } else if (currentMetrics.connectionStability < 95) {
      alerts.push({
        type: 'stability',
        message: `SSE connection stability is ${currentMetrics.connectionStability.toFixed(1)}% (threshold: 95%)`,
        severity: 'medium'
      })
    }

    // Low health score
    if (currentMetrics.healthScore < 70) {
      alerts.push({
        type: 'health',
        message: `SSE health score is ${currentMetrics.healthScore.toFixed(1)} (threshold: 70)`,
        severity: 'critical'
      })
    } else if (currentMetrics.healthScore < 85) {
      alerts.push({
        type: 'health',
        message: `SSE health score is ${currentMetrics.healthScore.toFixed(1)} (threshold: 85)`,
        severity: 'medium'
      })
    }

    return alerts
  }

  // 📊 Generate Performance Report
  async generatePerformanceReport(): Promise<{
    summary: SSEMetrics
    history: SSEMetrics[]
    alerts: Array<{ type: string; message: string; severity: string }>
    recommendations: string[]
  }> {
    const currentMetrics = await this.getCurrentMetrics('1m')
    const history = await this.getMetricsHistory('5m', 24)
    const alerts = await this.checkAlertConditions()
    const recommendations = this.generateRecommendations(currentMetrics, history)

    return {
      summary: currentMetrics || this.createEmptyMetrics('1m', Date.now()),
      history,
      alerts,
      recommendations
    }
  }

  // 💡 Generate Recommendations
  private generateRecommendations(current: SSEMetrics | null, history: SSEMetrics[]): string[] {
    const recommendations: string[] = []

    if (!current) {
      recommendations.push('Unable to generate recommendations - no current metrics available')
      return recommendations
    }

    // High error rate recommendations
    if (current.errorRate > 5) {
      recommendations.push('Consider investigating authentication failures and network connectivity issues')
      recommendations.push('Review server logs for SSE connection errors')
    }

    // High latency recommendations
    if (current.averageMessageLatency > 3000) {
      recommendations.push('Consider reducing SSE polling interval from 3 seconds to 2 seconds')
      recommendations.push('Review database query performance for message retrieval')
    }

    // Connection stability recommendations
    if (current.connectionStability < 95) {
      recommendations.push('Implement more robust error handling in SSE client')
      recommendations.push('Consider adjusting reconnection backoff strategy')
    }

    // High active connections
    if (current.activeConnections > 1000) {
      recommendations.push('Monitor memory usage closely with high connection count')
      recommendations.push('Consider implementing connection pooling or load balancing')
    }

    // Performance trending
    if (history.length > 10) {
      const recentAvgLatency = history.slice(-5).reduce((sum, m) => sum + m.averageMessageLatency, 0) / 5
      const olderAvgLatency = history.slice(-10, -5).reduce((sum, m) => sum + m.averageMessageLatency, 0) / 5

      if (recentAvgLatency > olderAvgLatency * 1.2) {
        recommendations.push('Latency is trending upward - investigate potential performance degradation')
      }
    }

    return recommendations
  }

  // Helper methods
  private createEmptyMetrics(period: string, timestamp: number): SSEMetrics {
    return {
      totalConnections: 0,
      activeConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      averageConnectionTime: 0,
      totalMessages: 0,
      messagesPerSecond: 0,
      averageMessageLatency: 0,
      duplicateMessages: 0,
      lostMessages: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      responseTimeP50: 0,
      responseTimeP95: 0,
      errorRate: 0,
      uptime: 0,
      reconnectionRate: 0,
      connectionStability: 100,
      healthScore: 100,
      timestamp,
      period
    }
  }

  private updateAverage(currentAvg: number, newValue: number, count: number): number {
    return (currentAvg * (count - 1) + newValue) / count
  }

  private getPeriodMs(period: string): number {
    switch (period) {
      case '1m': return 60 * 1000
      case '5m': return 5 * 60 * 1000
      case '1h': return 60 * 60 * 1000
      case '24h': return 24 * 60 * 60 * 1000
      default: return 60 * 1000
    }
  }

  private async persistMetrics(key: string, metrics: SSEMetrics): Promise<void> {
    try {
      const cacheKey = `sse_metrics:${key}`
      await this.env.CACHE?.put(cacheKey, JSON.stringify(metrics), {
        expirationTtl: 86400 * 7 // 7 days
      })
    } catch (error) {
      console.warn('[SSE Monitor] Failed to persist metrics:', error)
    }
  }

  // Cleanup old data
  async cleanup(retentionDays: number = 7): Promise<void> {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000)

    // Clean up connection events
    for (const [connectionId, events] of this.connectionEvents.entries()) {
      const recentEvents = events.filter(event => event.timestamp > cutoffTime)
      if (recentEvents.length === 0) {
        this.connectionEvents.delete(connectionId)
      } else {
        this.connectionEvents.set(connectionId, recentEvents)
      }
    }

    // Clean up in-memory metrics
    for (const [key, metrics] of this.metrics.entries()) {
      if (metrics.timestamp < cutoffTime) {
        this.metrics.delete(key)
      }
    }
  }
}

// Export monitoring utilities
export function createSSEPerformanceMonitor(env: Bindings): SSEPerformanceMonitor {
  return new SSEPerformanceMonitor(env)
}

// SSE monitoring middleware for Hono
export function sseMonitoringMiddleware(monitor: SSEPerformanceMonitor) {
  return async (c: any, next: () => Promise<void>) => {
    const start = Date.now()
    const connectionId = `sse_${start}_${Math.random().toString(36).substr(2, 9)}`

    // Record connection attempt
    await monitor.recordConnectionEvent({
      type: 'connect',
      connectionId,
      conversationId: c.req.param('conversationId'),
      userId: c.get('user')?.id,
      timestamp: start
    })

    try {
      await next()

      // Record successful connection
      const duration = Date.now() - start
      await monitor.recordConnectionEvent({
        type: 'connect',
        connectionId,
        conversationId: c.req.param('conversationId'),
        userId: c.get('user')?.id,
        timestamp: Date.now(),
        latency: duration
      })

    } catch (error) {
      // Record connection error
      await monitor.recordConnectionEvent({
        type: 'error',
        connectionId,
        conversationId: c.req.param('conversationId'),
        userId: c.get('user')?.id,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      })

      throw error
    }
  }
}