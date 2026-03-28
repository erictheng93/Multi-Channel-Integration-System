// Health check and monitoring handlers
// healthCheck, getApiStatus

import { Context } from 'hono'
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('SystemHealth')

import type { Bindings } from '@/types'
import {
  isLineBotInfo,
  isFacebookPageInfo,
} from '@/types'
import {
  successResponse,
  handleApiError
} from '@/utils/api-response'
import { createDbClient } from '@/db/drizzle-factory'
import { sql } from 'drizzle-orm'
import { getCredentialsFromKV } from './system-crypto-utils'
import { nowISO, nowMs } from '@/utils/timestamp'

// Health check
export const healthCheck = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = createDbClient(c.env.DB)
    const startTime = nowMs()

    // Check database connection
    let dbCheck = true
    let dbResponseTime = 0
    try {
      const dbStart = nowMs()
      await drizzleDb.get(sql`SELECT 1 as test`)
      dbResponseTime = Date.now() - dbStart
    } catch {
      dbCheck = false
      dbResponseTime = Date.now() - startTime
    }

    // Check KV storage - use CACHE instead of SESSIONS for health check
    let kvCheck = false
    let kvResponseTime = 0
    const kvStart = nowMs()

    if (c.env.CACHE) {
      try {
        // Simplified KV test - only test basic read/write
        const testKey = 'health_check_' + Date.now()
        const testValue = 'healthy'

        // Test write
        await c.env.CACHE.put(testKey, testValue, { expirationTtl: 60 })

        // Test read
        const result = await c.env.CACHE.get(testKey)

        // Test result
        if (result === testValue) {
          kvCheck = true
        }

        // Clean up test data
        await c.env.CACHE.delete(testKey)

      } catch (error) {
        log.error('Cache health check error', {}, error as Error)
        kvCheck = false
      }
    }

    kvResponseTime = Date.now() - kvStart

    // Check platform integration status
    const lineCheck = await checkLineIntegration(c.env)
    const facebookCheck = await checkFacebookIntegration(c.env)

    // Calculate total response time
    const totalResponseTime = Date.now() - startTime

    const health = {
      status: (dbCheck && kvCheck && lineCheck.status && facebookCheck.status) ? 'healthy' as const : 'unhealthy' as const,
      checks: {
        database: {
          status: dbCheck,
          responseTime: dbResponseTime
        },
        cache: {
          status: kvCheck,
          responseTime: kvResponseTime
        },
        integrations: {
          line: {
            status: lineCheck.status,
            message: lineCheck.message
          },
          facebook: {
            status: facebookCheck.status,
            message: facebookCheck.message
          }
        }
      },
      metrics: {
        responseTime: totalResponseTime,
        uptime: Math.floor(Date.now() / 1000),
        version: '2.0.0'
      },
      timestamp: nowISO()
    }

    return successResponse(c, health, 'Health check completed')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// API monitoring endpoint - get all endpoint statuses (real data from MetricsCollectorDO + infra probes)
export const getApiStatus = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const env = c.env
    const now = nowISO()

    type MetricsEndpoint = {
      endpoint: string
      method: string
      category: string
      requestCount: number
      errorCount: number
      avgResponseTime: number
      successRate: number
      lastCheck: string
      status: 'healthy' | 'warning' | 'error'
    }

    // Run all three groups in parallel
    const [metricsResult, infraProbes, channelResults] = await Promise.all([
      // 1. Metrics from DO
      (async () => {
        const start = nowMs()
        try {
          const doId = env.METRICS_COLLECTOR.idFromName('global')
          const stub = env.METRICS_COLLECTOR.get(doId)
          const metricsResponse = await stub.fetch('http://metrics-collector/metrics')
          const latencyMs = nowMs() - start
          if (metricsResponse.ok) {
            const data = await metricsResponse.json() as { endpoints?: MetricsEndpoint[] }
            return { ok: true as const, endpoints: data.endpoints ?? [], latencyMs }
          }
          return { ok: false as const, endpoints: [] as MetricsEndpoint[], latencyMs }
        } catch (err) {
          log.error('Failed to fetch metrics from MetricsCollectorDO', {}, err as Error)
          return { ok: false as const, endpoints: [] as MetricsEndpoint[], latencyMs: nowMs() - start }
        }
      })(),
      // 2. Infra probes (D1, KV, R2 -- no separate DO probe)
      Promise.allSettled([
        // D1
        (async () => {
          const start = nowMs()
          await env.DB.prepare('SELECT 1').first()
          return nowMs() - start
        })(),
        // KV
        (async () => {
          const start = nowMs()
          await env.CACHE.get('health-check-probe')
          return nowMs() - start
        })(),
        // R2
        (async () => {
          const start = nowMs()
          await env.R2_BUCKET.head('health-check-probe')
          return nowMs() - start
        })(),
      ]),
      // 3. Channel checks
      Promise.allSettled([
        (async () => {
          const start = nowMs()
          const result = await checkLineIntegration(env)
          return { ...result, latencyMs: nowMs() - start }
        })(),
        (async () => {
          const start = nowMs()
          const result = await checkFacebookIntegration(env)
          return { ...result, latencyMs: nowMs() - start }
        })(),
      ]),
    ])

    const metricsEndpoints = metricsResult.endpoints

    const infraNames = ['D1 Database', 'KV Cache', 'R2 Storage']
    const infraIds = ['d1', 'kv', 'r2']

    const latencyToStatus = (ms: number): 'green' | 'orange' | 'red' =>
      ms < 50 ? 'green' : ms < 200 ? 'orange' : 'red'

    const infrastructure = infraProbes.map((result, i) => {
      if (result.status === 'fulfilled') {
        return {
          id: infraIds[i],
          name: infraNames[i],
          status: latencyToStatus(result.value) as 'green' | 'orange' | 'red',
          latencyMs: result.value,
          lastCheck: now,
        }
      }
      return {
        id: infraIds[i],
        name: infraNames[i],
        status: 'red' as const,
        latencyMs: -1,
        lastCheck: now,
      }
    })

    // Derive DO health from metrics fetch result
    infrastructure.push({
      id: 'durable-objects',
      name: 'Durable Objects',
      status: metricsResult.ok ? latencyToStatus(metricsResult.latencyMs) : 'red' as const,
      latencyMs: metricsResult.latencyMs,
      lastCheck: now,
    })

    const [lineResult, fbResult] = channelResults

    const mapChannelResult = (
      settledResult: PromiseSettledResult<{ status: boolean; message: string; latencyMs: number }>,
      id: string,
      name: string,
    ) => {
      if (settledResult.status === 'fulfilled') {
        const r = settledResult.value
        return {
          id,
          name,
          status: r.status ? 'connected' as const : 'disconnected' as const,
          details: r.message,
          latencyMs: r.latencyMs,
          lastCheck: now,
        }
      }
      return {
        id,
        name,
        status: 'error' as const,
        details: settledResult.reason instanceof Error ? settledResult.reason.message : 'Unknown error',
        latencyMs: -1,
        lastCheck: now,
      }
    }

    const lineChannel = mapChannelResult(lineResult, 'line', 'LINE')
    const fbChannel = mapChannelResult(fbResult, 'facebook', 'Facebook Messenger')

    // Webhook delivery status derived from channel status
    const webhookDelivery = {
      id: 'webhook-delivery',
      name: 'Webhook Delivery',
      status: (lineChannel.status === 'connected' || fbChannel.status === 'connected')
        ? 'connected' as const
        : 'disconnected' as const,
      details: lineChannel.status === 'connected' && fbChannel.status === 'connected'
        ? 'All webhook channels operational'
        : 'Some webhook channels unavailable',
      latencyMs: Math.max(
        lineChannel.latencyMs > 0 ? lineChannel.latencyMs : 0,
        fbChannel.latencyMs > 0 ? fbChannel.latencyMs : 0,
      ),
      lastCheck: now,
    }

    const channels = [lineChannel, fbChannel, webhookDelivery]

    // 4. Derive events at read-time
    const events: Array<{ type: 'error' | 'warning' | 'info'; source: string; message: string; timestamp: string }> = []

    for (const ep of metricsEndpoints) {
      if (ep.status === 'error') {
        events.push({ type: 'error', source: ep.endpoint, message: `Endpoint ${ep.method} ${ep.endpoint} is in error state`, timestamp: now })
      } else if (ep.status === 'warning') {
        events.push({ type: 'warning', source: ep.endpoint, message: `Endpoint ${ep.method} ${ep.endpoint} has elevated latency or error rate`, timestamp: now })
      }
    }

    for (const infra of infrastructure) {
      if (infra.status === 'red') {
        events.push({ type: 'error', source: infra.name, message: `${infra.name} is unhealthy (latency: ${infra.latencyMs}ms)`, timestamp: now })
      } else if (infra.status === 'orange') {
        events.push({ type: 'warning', source: infra.name, message: `${infra.name} has elevated latency (${infra.latencyMs}ms)`, timestamp: now })
      }
    }

    for (const ch of channels) {
      if (ch.status === 'disconnected' || ch.status === 'error') {
        events.push({ type: 'error', source: ch.name, message: `${ch.name}: ${ch.details}`, timestamp: now })
      }
    }

    if (events.length === 0) {
      events.push({ type: 'info', source: 'system', message: 'All systems operational', timestamp: now })
    }

    // 5. Compute aggregated stats
    const totalEndpoints = metricsEndpoints.length
    const healthyCount = metricsEndpoints.filter(e => e.status === 'healthy').length
    const warningCount = metricsEndpoints.filter(e => e.status === 'warning').length
    const errorCount = metricsEndpoints.filter(e => e.status === 'error').length
    const avgResponseTime = totalEndpoints > 0
      ? Math.round(metricsEndpoints.reduce((sum, e) => sum + e.avgResponseTime, 0) / totalEndpoints)
      : 0

    const stats = { totalEndpoints, healthyCount, warningCount, errorCount, avgResponseTime }

    // 6. Determine overall status
    const infraRedCount = infrastructure.filter(i => i.status === 'red').length
    let overallStatus: 'operational' | 'degraded' | 'outage'
    if (infraRedCount >= 2 || errorCount > totalEndpoints / 2) {
      overallStatus = 'outage'
    } else if (infraRedCount >= 1 || errorCount > 0 || warningCount > 0) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'operational'
    }

    return successResponse(c, {
      overallStatus,
      endpoints: metricsEndpoints,
      infrastructure,
      channels,
      events,
      stats,
      timestamp: now,
    }, 'API status retrieved successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// Check LINE integration status (private helper)
async function checkLineIntegration(env: Bindings): Promise<{ status: boolean; message: string }> {
  try {
    const credentials = await getCredentialsFromKV(env, 'line')
    const accessToken = credentials?.accessToken || env.LINE_CHANNEL_ACCESS_TOKEN

    if (!accessToken) {
      return { status: false, message: 'LINE Access Token not configured' }
    }

    const response = await fetch('https://api.line.me/v2/bot/info', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      signal: AbortSignal.timeout(5000)
    })

    if (response.ok) {
      const botInfo = await response.json()
      const botName = isLineBotInfo(botInfo) ? botInfo.displayName : 'Unknown Bot'
      return { status: true, message: `LINE Bot connected: ${botName}` }
    } else {
      await response.text().catch(() => '')
      let errorMessage = `LINE API error: ${response.status}`
      if (response.status === 401) {
        errorMessage += ' (Invalid or expired access token)'
      } else if (response.status === 403) {
        errorMessage += ' (Insufficient permissions)'
      }
      return { status: false, message: errorMessage }
    }
  } catch (error) {
    log.error(`LINE check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return {
      status: false,
      message: `LINE check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Check Facebook integration status (private helper)
async function checkFacebookIntegration(env: Bindings): Promise<{ status: boolean; message: string }> {
  try {
    // Try to get credentials from KV
    const credentials = await getCredentialsFromKV(env, 'facebook')
    const pageToken = credentials?.pageToken || env.FB_PAGE_ACCESS_TOKEN

    if (!pageToken) {
      return { status: false, message: 'Facebook Page Token not configured' }
    }

    // Simple page info check
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${pageToken}`,
      {
        signal: AbortSignal.timeout(5000)
      }
    )

    if (response.ok) {
      const pageInfo = await response.json()
      const pageName = isFacebookPageInfo(pageInfo) ? pageInfo.name : 'Unknown Page'
      return { status: true, message: `Facebook Page connected: ${pageName}` }
    } else {
      return { status: false, message: `Facebook API error: ${response.status}` }
    }
  } catch (error) {
    return {
      status: false,
      message: `Facebook check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}
