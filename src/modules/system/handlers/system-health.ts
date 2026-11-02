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
import { ROLES } from '@/constants/roles'
import { getApiMetricsSummary } from '../services/api-metrics-service'

// Public liveness check (unauthenticated: load balancers, CI deploy gate, `health:check`).
// Cheap and side-effect free by design: one D1 SELECT 1 and one KV read. It makes NO outbound
// calls (LINE/FB detail lives behind admin auth in getApiStatus, cached 60 s), does no KV writes,
// and exposes only up/down plus response times, never messages, ids or secrets.
export const healthCheck = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const drizzleDb = createDbClient(c.env.DB)
    const startTime = nowMs()

    let dbCheck = true
    let dbResponseTime: number
    try {
      const dbStart = nowMs()
      await drizzleDb.get(sql`SELECT 1 as test`)
      dbResponseTime = nowMs() - dbStart
    } catch {
      dbCheck = false
      dbResponseTime = nowMs() - startTime
    }

    let kvCheck = false
    const kvStart = nowMs()
    if (c.env.CACHE) {
      try {
        await c.env.CACHE.get('health-check-probe')
        kvCheck = true
      } catch (error) {
        log.error('Cache health check error', {}, error as Error)
      }
    }
    const kvResponseTime = nowMs() - kvStart

    const health = {
      status: (dbCheck && kvCheck) ? 'healthy' as const : 'unhealthy' as const,
      checks: {
        database: { status: dbCheck, responseTime: dbResponseTime },
        cache: { status: kvCheck, responseTime: kvResponseTime }
      },
      metrics: {
        responseTime: nowMs() - startTime,
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

// Outbound LINE/FB checks cost an external API call each; the status page polls, so cache the result.
export const CHANNEL_CHECK_TTL_SECONDS = 60

export interface ChannelCheckResult {
  status: boolean
  message: string
  latencyMs: number
  checkedAt: string
}

async function cachedChannelCheck(
  env: Bindings,
  platform: 'line' | 'facebook',
  check: (env: Bindings) => Promise<{ status: boolean; message: string }>
): Promise<ChannelCheckResult> {
  const key = `api-status:channel:${platform}`
  try {
    const cached = await env.CACHE?.get(key)
    if (cached) return JSON.parse(cached) as ChannelCheckResult
  } catch {
    // cache miss on any KV/parse failure: fall through to a live check
  }

  const start = nowMs()
  const result = await check(env)
  const fresh: ChannelCheckResult = { ...result, latencyMs: nowMs() - start, checkedAt: nowISO() }
  try {
    await env.CACHE?.put(key, JSON.stringify(fresh), { expirationTtl: CHANNEL_CHECK_TTL_SECONDS })
  } catch (error) {
    log.warn('Failed to cache channel check', { platform, error: error instanceof Error ? error.message : String(error) })
  }
  return fresh
}

// API monitoring endpoint (admin-only, enforced on the route and again here): infra probes + channel checks
// + per-endpoint metrics from Workers Analytics Engine
export const getApiStatus = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const user = c.get('user') as { role?: string } | undefined
    if (user?.role !== ROLES.ADMIN) {
      return c.json({ success: false, error: 'Admin access required' }, 403)
    }
    const env = c.env
    const now = nowISO()

    // Run both groups in parallel
    const [infraProbes, channelResults] = await Promise.all([
      // 1. Infra probes (D1, KV, R2)
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
      // 2. Channel checks
      Promise.allSettled([
        cachedChannelCheck(env, 'line', checkLineIntegration),
        cachedChannelCheck(env, 'facebook', checkFacebookIntegration),
      ]),
    ])

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

    const [lineResult, fbResult] = channelResults

    const mapChannelResult = (
      settledResult: PromiseSettledResult<ChannelCheckResult>,
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
          lastCheck: r.checkedAt,
        }
      }
      return {
        id,
        name,
        status: 'error' as const,
        details: 'Channel check failed',
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

    // 3. Per-endpoint metrics + derived events from Analytics Engine (real data only;
    //    unconfigured -> metrics.configured=false, empty lists, no fake numbers)
    const metrics = await getApiMetricsSummary(env, now)
    const events = metrics.events
    const stats = metrics.stats

    // 5. Determine overall status
    const infraRedCount = infrastructure.filter(i => i.status === 'red').length
    let overallStatus: 'operational' | 'degraded' | 'outage'
    if (infraRedCount >= 2) {
      overallStatus = 'outage'
    } else if (infraRedCount >= 1) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'operational'
    }

    return successResponse(c, {
      overallStatus,
      endpoints: metrics.endpoints,
      metrics: {
        configured: metrics.configured,
        windowMinutes: metrics.windowMinutes,
        generatedAt: metrics.generatedAt,
        ...(metrics.error ? { error: metrics.error } : {}),
      },
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
      message: 'LINE check failed'
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
    // The request URL carries the page token, so the exception text must not be returned or logged
    return {
      status: false,
      message: 'Facebook check failed'
    }
  }
}
