// 🚀 Phase 2: SSE Monitoring API Handler
// RESTful API endpoints for SSE performance monitoring

import { Hono } from 'hono'
import { jwtAuth } from '../middleware/auth'
import type { Bindings } from '../types'
import { createSSEPerformanceMonitor, SSEPerformanceMonitor } from '../monitoring/sse-performance-monitor'

const sseMonitoringHandler = new Hono<{ Bindings: Bindings }>()

// Global monitor instance (created per request)
let monitorCache: WeakMap<Bindings, SSEPerformanceMonitor> = new WeakMap()

function getMonitor(env: Bindings): SSEPerformanceMonitor {
  let monitor = monitorCache.get(env)
  if (!monitor) {
    monitor = createSSEPerformanceMonitor(env)
    monitorCache.set(env, monitor)
  }
  return monitor
}

// 📊 Get Current SSE Metrics
sseMonitoringHandler.get('/metrics', jwtAuth, async (c) => {
  try {
    const user = c.get('user')
    const period = c.req.query('period') || '1m'

    // Only admin and team roles can access metrics
    if (user.role !== 'admin' && user.role !== 'team') {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    const monitor = getMonitor(c.env)
    const metrics = await monitor.getCurrentMetrics(period)

    if (!metrics) {
      return c.json({
        success: true,
        data: null,
        message: 'No metrics available for the specified period'
      })
    }

    return c.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[SSE Monitoring] Error getting metrics:', error)
    return c.json({
      success: false,
      error: 'Failed to retrieve SSE metrics',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// 📈 Get SSE Metrics History
sseMonitoringHandler.get('/metrics/history', jwtAuth, async (c) => {
  try {
    const user = c.get('user')
    const period = c.req.query('period') || '5m'
    const hours = parseInt(c.req.query('hours') || '24', 10)

    // Only admin and team roles can access metrics
    if (user.role !== 'admin' && user.role !== 'team') {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    // Validate parameters
    if (hours < 1 || hours > 168) { // Max 1 week
      return c.json({
        success: false,
        error: 'Hours parameter must be between 1 and 168 (1 week)'
      }, 400)
    }

    const monitor = getMonitor(c.env)
    const history = await monitor.getMetricsHistory(period, hours)

    return c.json({
      success: true,
      data: {
        period,
        hours,
        totalPeriods: history.length,
        metrics: history
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[SSE Monitoring] Error getting metrics history:', error)
    return c.json({
      success: false,
      error: 'Failed to retrieve SSE metrics history',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// 🚨 Get SSE Alert Conditions
sseMonitoringHandler.get('/alerts', jwtAuth, async (c) => {
  try {
    const user = c.get('user')

    // Only admin and team roles can access alerts
    if (user.role !== 'admin' && user.role !== 'team') {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    const monitor = getMonitor(c.env)
    const alerts = await monitor.checkAlertConditions()

    // Categorize alerts by severity
    const categorizedAlerts = {
      critical: alerts.filter(a => a.severity === 'critical'),
      high: alerts.filter(a => a.severity === 'high'),
      medium: alerts.filter(a => a.severity === 'medium'),
      low: alerts.filter(a => a.severity === 'low')
    }

    return c.json({
      success: true,
      data: {
        total: alerts.length,
        alerts: categorizedAlerts,
        summary: {
          critical: categorizedAlerts.critical.length,
          high: categorizedAlerts.high.length,
          medium: categorizedAlerts.medium.length,
          low: categorizedAlerts.low.length
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[SSE Monitoring] Error checking alerts:', error)
    return c.json({
      success: false,
      error: 'Failed to check SSE alerts',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// 📋 Generate Performance Report
sseMonitoringHandler.get('/report', jwtAuth, async (c) => {
  try {
    const user = c.get('user')

    // Only admin and team roles can access reports
    if (user.role !== 'admin' && user.role !== 'team') {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    const monitor = getMonitor(c.env)
    const report = await monitor.generatePerformanceReport()

    return c.json({
      success: true,
      data: report,
      metadata: {
        generatedBy: user.id,
        generatedAt: new Date().toISOString(),
        reportType: 'sse_performance'
      }
    })

  } catch (error) {
    console.error('[SSE Monitoring] Error generating report:', error)
    return c.json({
      success: false,
      error: 'Failed to generate SSE performance report',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// 🧹 Cleanup Old Monitoring Data
sseMonitoringHandler.post('/cleanup', jwtAuth, async (c) => {
  try {
    const user = c.get('user')

    // Only admin can perform cleanup
    if (user.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const retentionDays = parseInt(c.req.query('retention_days') || '7', 10)

    // Validate retention days (between 1 and 30)
    if (retentionDays < 1 || retentionDays > 30) {
      return c.json({
        success: false,
        error: 'Retention days must be between 1 and 30'
      }, 400)
    }

    const monitor = getMonitor(c.env)
    await monitor.cleanup(retentionDays)

    console.log(`[SSE Monitoring] Cleanup completed by ${user.id}, retention: ${retentionDays} days`)

    return c.json({
      success: true,
      message: `Monitoring data cleanup completed`,
      retentionDays,
      cleanedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('[SSE Monitoring] Error during cleanup:', error)
    return c.json({
      success: false,
      error: 'Failed to cleanup monitoring data',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// 📊 Get SSE Health Summary
sseMonitoringHandler.get('/health', async (c) => {
  try {
    // This endpoint is public for health checking
    const monitor = getMonitor(c.env)
    const metrics = await monitor.getCurrentMetrics('1m')
    const alerts = await monitor.checkAlertConditions()

    const healthStatus = {
      status: 'healthy',
      score: metrics?.healthScore || 0,
      activeConnections: metrics?.activeConnections || 0,
      errorRate: metrics?.errorRate || 0,
      averageLatency: metrics?.averageMessageLatency || 0,
      uptime: metrics?.uptime || 0,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length
    }

    // Determine overall status
    if (healthStatus.criticalAlerts > 0 || healthStatus.score < 70) {
      healthStatus.status = 'unhealthy'
    } else if (healthStatus.score < 85 || alerts.filter(a => a.severity === 'high').length > 0) {
      healthStatus.status = 'degraded'
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 :
                      healthStatus.status === 'degraded' ? 207 : 503

    return c.json({
      success: true,
      data: healthStatus,
      timestamp: new Date().toISOString()
    }, statusCode)

  } catch (error) {
    console.error('[SSE Monitoring] Error getting health status:', error)
    return c.json({
      success: false,
      status: 'error',
      error: 'Failed to get SSE health status',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// 🎯 Record SSE Event (Internal API)
sseMonitoringHandler.post('/events', async (c) => {
  try {
    // This is an internal endpoint for recording SSE events
    // Authentication is handled by internal service calls
    const eventData = await c.req.json()

    // Validate event data
    const requiredFields = ['type', 'connectionId', 'timestamp']
    for (const field of requiredFields) {
      if (!eventData[field]) {
        return c.json({
          success: false,
          error: `Missing required field: ${field}`
        }, 400)
      }
    }

    const monitor = getMonitor(c.env)
    await monitor.recordConnectionEvent(eventData)

    return c.json({
      success: true,
      message: 'SSE event recorded successfully'
    })

  } catch (error) {
    console.error('[SSE Monitoring] Error recording event:', error)
    return c.json({
      success: false,
      error: 'Failed to record SSE event',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// 📊 Get Connection Statistics
sseMonitoringHandler.get('/connections', jwtAuth, async (c) => {
  try {
    const user = c.get('user')

    // Only admin and team roles can access connection stats
    if (user.role !== 'admin' && user.role !== 'team') {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    const monitor = getMonitor(c.env)
    const metrics = await monitor.getCurrentMetrics('1m')

    const connectionStats = {
      active: metrics?.activeConnections || 0,
      total: metrics?.totalConnections || 0,
      successful: metrics?.successfulConnections || 0,
      failed: metrics?.failedConnections || 0,
      successRate: metrics?.connectionStability || 0,
      averageConnectionTime: metrics?.averageConnectionTime || 0
    }

    return c.json({
      success: true,
      data: connectionStats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[SSE Monitoring] Error getting connection stats:', error)
    return c.json({
      success: false,
      error: 'Failed to retrieve connection statistics',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// 🔧 Configure Monitoring Settings
sseMonitoringHandler.put('/settings', jwtAuth, async (c) => {
  try {
    const user = c.get('user')

    // Only admin can configure monitoring settings
    if (user.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403)
    }

    const settings = await c.req.json()

    // Store settings in KV
    const settingsKey = 'sse_monitoring_settings'
    await c.env.CACHE?.put(settingsKey, JSON.stringify({
      ...settings,
      updatedBy: user.id,
      updatedAt: new Date().toISOString()
    }))

    console.log(`[SSE Monitoring] Settings updated by ${user.id}:`, settings)

    return c.json({
      success: true,
      message: 'Monitoring settings updated successfully',
      settings
    })

  } catch (error) {
    console.error('[SSE Monitoring] Error updating settings:', error)
    return c.json({
      success: false,
      error: 'Failed to update monitoring settings',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

export default sseMonitoringHandler