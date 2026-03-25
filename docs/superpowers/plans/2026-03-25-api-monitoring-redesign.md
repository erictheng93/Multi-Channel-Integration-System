# API Monitoring Dashboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fake `Math.random()` API monitoring data with real server-side metrics via a Durable Object, and redesign the frontend dashboard to Apple-Native Soft Minimalism Bento Grid layout.

**Architecture:** Hono metrics middleware (after CORS, before auth) records per-request metrics via `waitUntil()` to a `MetricsCollectorDO`. The DO accumulates in-memory counters and flushes to KV hourly. `GET /api/system/api-status` reads from the DO + runs infrastructure/channel probes. Frontend is display-only (no pinging).

**Tech Stack:** Cloudflare Workers, Hono, Durable Objects, KV, Vue 3 Composition API, TypeScript strict mode, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-25-api-monitoring-redesign.md`

**Design Mockup:** `.superpowers/brainstorm/756-1774421832/final-design.html`

---

## File Structure

### Backend (Create)
| File | Responsibility |
|------|---------------|
| `src/durable-objects/MetricsCollectorDO.ts` | In-memory metrics accumulator. Receives data points, aggregates counters, flushes to KV via alarm(). Serves current metrics via `/metrics` route. |
| `src/middleware/metrics.ts` | Hono middleware. Measures request duration + status code, sends to DO via `waitUntil()`. Path normalization. |

### Backend (Modify)
| File | Change |
|------|--------|
| `wrangler.toml` | Add `METRICS_COLLECTOR` DO binding + migration |
| `src/index.ts` | Import + export MetricsCollectorDO; register metrics middleware after CORS |
| `src/constants/durable-objects.ts` | Add `METRICS_COLLECTOR_ROUTES` constants |
| `src/modules/system/handlers/system-health.ts` | Replace `getApiStatus` fake data with DO read + infra probes + channel checks + event derivation |
| `src/handlers/system-settings-router.ts` | Add `jwtAuth` to `/api-status` route |

### Frontend (Create)
| File | Responsibility |
|------|---------------|
| `frontend/src/components/api-monitor/InfrastructureCard.vue` | Infrastructure health card (D1/KV/R2/DO) |
| `frontend/src/components/api-monitor/ChannelIntegrationsCard.vue` | LINE/Facebook/Webhook status card |
| `frontend/src/components/api-monitor/RecentEventsCard.vue` | Color-coded event timeline |
| `frontend/src/components/api-monitor/EndpointDetailPanel.vue` | Expandable detail: p50/p95, mini chart, test button |

### Frontend (Modify)
| File | Change |
|------|--------|
| `frontend/src/types/api-monitor.ts` | Near-complete rewrite: new response shape, Infrastructure/Channel/Event types |
| `frontend/src/composables/useApiMonitorController.ts` | Remove pinging/DEFAULT_APIS/migration; simplified fetch-only controller |
| `frontend/src/components/api-monitor/ApiHeader.vue` | Apple-style large title + status badge + auto-refresh toggle |
| `frontend/src/components/api-monitor/ApiStatsGrid.vue` | 4-column stat cards with progress bars |
| `frontend/src/components/api-monitor/ApiCard.vue` | Rich row with method badge, inline metrics, expandable detail |
| `frontend/src/components/api-monitor/ApiCardList.vue` | Updated to render new ApiCard format |
| `frontend/src/components/api-monitor/ApiFilter.vue` | Capsule filter pills |
| `frontend/src/components/api-monitor/ApiModal.vue` | Update to new data shape |
| `frontend/src/components/api-monitor/index.ts` | Export new components, remove MigrationStatus |
| `frontend/src/views/ApiMonitor.vue` | Bento Grid layout with all 4 monitoring categories |

### Frontend (Remove)
| File | Reason |
|------|--------|
| `frontend/src/components/api-monitor/MigrationStatus.vue` | Migration complete, obsolete |
| `frontend/src/services/api-monitor.ts` | Unused legacy service |
| `frontend/src/views/ApiMonitor.refactored.vue` | Stale copy |

---

## Task 1: MetricsCollectorDO — Durable Object

**Files:**
- Create: `src/durable-objects/MetricsCollectorDO.ts`
- Modify: `wrangler.toml` (add binding + migration)
- Modify: `src/constants/durable-objects.ts` (add route constants)
- Modify: `src/index.ts` (import + export DO class)

**Context:** Follow the existing DO pattern from `LatestMessageCacheCoordinator.ts`. The DO uses `blockConcurrencyWhile()` for init, `fetch()` with pathname switch for routing, and `alarm()` for periodic KV flush.

- [ ] **Step 1: Add DO route constants**

In `src/constants/durable-objects.ts`, add after the last route constants block:

```typescript
export const METRICS_COLLECTOR_ROUTES = {
  INGEST: '/ingest',
  METRICS: '/metrics',
  RESET: '/reset',
  HEALTH: '/health',
} as const
```

- [ ] **Step 2: Create MetricsCollectorDO**

Create `src/durable-objects/MetricsCollectorDO.ts`:

```typescript
/**
 * MetricsCollectorDO — In-memory metrics accumulator
 *
 * Receives per-request metric data points via /ingest (called from metrics middleware).
 * Maintains running counters in memory (single-threaded, no race conditions).
 * Flushes aggregated snapshot to KV every 60 seconds via alarm().
 * Serves current metrics via /metrics for the API status endpoint.
 */

import type { Bindings } from '../types'

interface EndpointMetrics {
  method: string
  path: string
  category: string
  description: string
  requestCount: number
  errorCount: number
  totalResponseTime: number
  maxResponseTime: number
  /** Running sorted-ish samples for p50 approximation */
  recentResponseTimes: number[]
  statusCodes: Record<string, number>
  lastRequestTime: number
}

interface MetricDataPoint {
  method: string
  path: string
  statusCode: number
  responseTimeMs: number
  timestamp: number
}

// Endpoint metadata: category + description for known routes
const ENDPOINT_METADATA: Record<string, { category: string; description: string }> = {
  'GET:/api/system/health': { category: 'system', description: 'System health check' },
  'GET:/api/system/info': { category: 'system', description: 'System information' },
  'GET:/api/system/metrics': { category: 'system', description: 'System performance metrics' },
  'POST:/api/auth/login': { category: 'auth', description: 'User authentication' },
  'GET:/api/conversations': { category: 'conversation', description: 'Conversation list' },
  'GET:/api/conversations/:id': { category: 'conversation', description: 'Conversation detail' },
  'GET:/api/conversations/:id/messages': { category: 'message', description: 'Conversation messages' },
  'POST:/api/conversations/:id/messages': { category: 'message', description: 'Send message' },
  'GET:/api/customers': { category: 'customer', description: 'Customer list' },
  'GET:/api/customers/:id': { category: 'customer', description: 'Customer detail' },
  'GET:/api/teams/members': { category: 'team', description: 'Team members' },
  'GET:/api/delayed-messages': { category: 'message', description: 'Delayed messages' },
  'POST:/api/webhook': { category: 'integration', description: 'LINE Webhook' },
  'POST:/api/webhook/facebook': { category: 'integration', description: 'Facebook Webhook' },
}

const MAX_RECENT_SAMPLES = 100
const FLUSH_INTERVAL_MS = 60_000 // 60 seconds
const KV_TTL_SECONDS = 86_400 // 24 hours

export class MetricsCollectorDO {
  private state: DurableObjectState
  private env: Bindings
  private metrics: Map<string, EndpointMetrics> = new Map()
  private initialized = false

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state
    this.env = env

    this.state.blockConcurrencyWhile(async () => {
      await this.loadState()
      this.initialized = true
    })
  }

  private async loadState(): Promise<void> {
    // Restore metrics from storage if DO was evicted
    const stored = await this.state.storage.get<Record<string, EndpointMetrics>>('metrics')
    if (stored) {
      this.metrics = new Map(Object.entries(stored))
    }

    // Ensure alarm is set for periodic flush
    const currentAlarm = await this.state.storage.getAlarm()
    if (!currentAlarm) {
      await this.state.storage.setAlarm(Date.now() + FLUSH_INTERVAL_MS)
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    try {
      switch (url.pathname) {
        case '/ingest':
          return await this.handleIngest(request)
        case '/metrics':
          return await this.handleGetMetrics()
        case '/reset':
          return await this.handleReset()
        case '/health':
          return new Response(JSON.stringify({ status: 'ok', endpoints: this.metrics.size }), {
            headers: { 'Content-Type': 'application/json' }
          })
        default:
          return new Response('Not found', { status: 404 })
      }
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  private async handleIngest(request: Request): Promise<Response> {
    const dataPoint = await request.json() as MetricDataPoint
    const key = `${dataPoint.method}:${dataPoint.path}`

    let endpoint = this.metrics.get(key)
    if (!endpoint) {
      const meta = ENDPOINT_METADATA[key] || { category: 'other', description: dataPoint.path }
      endpoint = {
        method: dataPoint.method,
        path: dataPoint.path,
        category: meta.category,
        description: meta.description,
        requestCount: 0,
        errorCount: 0,
        totalResponseTime: 0,
        maxResponseTime: 0,
        recentResponseTimes: [],
        statusCodes: {},
        lastRequestTime: 0,
      }
      this.metrics.set(key, endpoint)
    }

    // Update counters
    endpoint.requestCount++
    endpoint.totalResponseTime += dataPoint.responseTimeMs
    endpoint.lastRequestTime = dataPoint.timestamp

    if (dataPoint.responseTimeMs > endpoint.maxResponseTime) {
      endpoint.maxResponseTime = dataPoint.responseTimeMs
    }

    // Track response time samples for p50 approximation
    endpoint.recentResponseTimes.push(dataPoint.responseTimeMs)
    if (endpoint.recentResponseTimes.length > MAX_RECENT_SAMPLES) {
      endpoint.recentResponseTimes.shift()
    }

    // Track status codes
    const codeStr = String(dataPoint.statusCode)
    endpoint.statusCodes[codeStr] = (endpoint.statusCodes[codeStr] || 0) + 1

    // Count errors (4xx client errors excluded; 5xx = server errors)
    if (dataPoint.statusCode >= 500) {
      endpoint.errorCount++
    }

    // Persist to DO storage periodically (every 10 ingests)
    if (endpoint.requestCount % 10 === 0) {
      await this.persistState()
    }

    return new Response('ok', { status: 200 })
  }

  private async handleGetMetrics(): Promise<Response> {
    const endpoints = Array.from(this.metrics.entries()).map(([key, m]) => {
      const sorted = [...m.recentResponseTimes].sort((a, b) => a - b)
      const p50 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.5)] : 0
      const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : m.maxResponseTime
      const avg = m.requestCount > 0 ? Math.round(m.totalResponseTime / m.requestCount) : 0
      const successRate = m.requestCount > 0
        ? Math.round(((m.requestCount - m.errorCount) / m.requestCount) * 1000) / 10
        : 100

      // Derive status from metrics
      let status: 'healthy' | 'warning' | 'error' = 'healthy'
      if (successRate < 90 || p95 > 1000) {
        status = 'error'
      } else if (successRate < 95 || p95 > 500) {
        status = 'warning'
      }

      return {
        id: key.replace(/[/:]/g, '-').toLowerCase(),
        endpoint: m.path,
        method: m.method,
        category: m.category,
        description: m.description,
        status,
        responseTime: p95,
        avgResponseTime: avg,
        p50ResponseTime: p50,
        successRate,
        requestCount: m.requestCount,
        errorCount: m.errorCount,
        statusCodes: m.statusCodes,
        lastCheck: new Date(m.lastRequestTime).toISOString(),
      }
    })

    return new Response(JSON.stringify({ endpoints }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  private async handleReset(): Promise<Response> {
    this.metrics.clear()
    await this.state.storage.delete('metrics')
    return new Response('ok', { status: 200 })
  }

  async alarm(): Promise<void> {
    // Flush current snapshot to KV for historical reference
    try {
      const hourBucket = new Date().toISOString().slice(0, 13).replace(/[-:T]/g, '')
      const snapshot = Object.fromEntries(this.metrics)

      // Use CACHE binding (not KV alias — DOs receive raw Worker bindings, not middleware-injected aliases)
      await this.env.CACHE.put(
        `metrics:snapshot:${hourBucket}`,
        JSON.stringify(snapshot),
        { expirationTtl: KV_TTL_SECONDS }
      )

      // Also persist to DO storage
      await this.persistState()
    } catch (error) {
      console.error('MetricsCollectorDO alarm flush failed:', error)
    }

    // Re-schedule next alarm
    await this.state.storage.setAlarm(Date.now() + FLUSH_INTERVAL_MS)
  }

  private async persistState(): Promise<void> {
    const serializable = Object.fromEntries(this.metrics)
    await this.state.storage.put('metrics', serializable)
  }
}
```

- [ ] **Step 3: Add DO binding to wrangler.toml**

After the last `[[durable_objects.bindings]]` block, add:

```toml
# MetricsCollector - Aggregates API request metrics in memory
[[durable_objects.bindings]]
name = "METRICS_COLLECTOR"
class_name = "MetricsCollectorDO"
```

Add a new migration tag after the last `[[migrations]]` block:

```toml
[[migrations]]
tag = "v10"
new_classes = ["MetricsCollectorDO"]
```

(Check the current latest migration tag and increment appropriately.)

- [ ] **Step 4: Add binding to Bindings type**

In `src/types/bindings.ts`, add to the `Bindings` interface near the other DO bindings (around line 50-62):

```typescript
METRICS_COLLECTOR: DurableObjectNamespace
```

Make it required (not optional `?`) — the middleware checks `if (metricsCollector)` defensively, but the `getApiStatus` handler expects it to always exist.

- [ ] **Step 5: Export DO from src/index.ts**

Add import near other DO imports (around line 855):

```typescript
import { MetricsCollectorDO } from './durable-objects/MetricsCollectorDO'
```

Add to the export block (around line 876):

```typescript
export {
  // ... existing exports
  MetricsCollectorDO,
}
```

- [ ] **Step 6: Verify backend compiles**

Run: `cd D:/Code/Multi_Channel_Integration_System && bun run build`

Expected: No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/durable-objects/MetricsCollectorDO.ts src/constants/durable-objects.ts wrangler.toml src/index.ts
git commit -m "feat(monitoring): add MetricsCollectorDO for real-time metrics accumulation"
```

---

## Task 2: Metrics Middleware

**Files:**
- Create: `src/middleware/metrics.ts`
- Modify: `src/index.ts` (register middleware after CORS, before auth)

**Context:** Follow the middleware pattern from `src/middleware/auth.ts`. The middleware wraps `next()` to measure timing, then uses `waitUntil()` to asynchronously send the data point to the MetricsCollectorDO. Path normalization replaces dynamic segments with `:id`.

- [ ] **Step 1: Create metrics middleware**

Create `src/middleware/metrics.ts`:

```typescript
/**
 * Metrics Collection Middleware
 *
 * Records per-request metrics (method, path, status, response time)
 * and sends them to MetricsCollectorDO via waitUntil() (non-blocking).
 *
 * Placement: After CORS middleware, before auth middleware.
 * This ensures we skip OPTIONS preflight and measure all real requests.
 */

import type { Context, Next } from 'hono'
import type { Bindings } from '../types'

/**
 * Normalize request path by replacing dynamic segments with :id
 *
 * Examples:
 *   /api/conversations/abc-123 -> /api/conversations/:id
 *   /api/teams/5/members -> /api/teams/:id/members
 *   /api/conversations/abc-123/messages -> /api/conversations/:id/messages
 */
export function normalizePath(path: string): string {
  return path
    // Replace UUID-like segments (8-4-4-4-12 hex)
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    // Replace numeric-only segments
    .replace(/\/\d+/g, '/:id')
    // Replace remaining alphanumeric IDs (segments that look like IDs: 20+ chars of hex/alphanum)
    .replace(/\/[a-f0-9]{20,}/gi, '/:id')
}

// Paths to skip metrics collection (monitoring endpoints, static assets)
const SKIP_PATHS = [
  '/api/system/api-status',  // Avoid self-referential metrics
  '/api/monitoring/',        // Monitoring endpoints
  '/favicon.ico',
  '/robots.txt',
]

/**
 * Hono middleware that collects request metrics
 */
export async function metricsMiddleware(
  c: Context<{ Bindings: Bindings }>,
  next: Next
): Promise<Response | void> {
  // Skip OPTIONS (CORS preflight) and non-API paths
  if (c.req.method === 'OPTIONS') {
    return await next()
  }

  const path = new URL(c.req.url).pathname

  // Skip monitoring/static paths
  if (SKIP_PATHS.some(skip => path.startsWith(skip))) {
    return await next()
  }

  // Skip non-API paths
  if (!path.startsWith('/api/')) {
    return await next()
  }

  const startTime = Date.now()

  // Execute the actual handler
  await next()

  // After response: collect metrics asynchronously
  const responseTime = Date.now() - startTime
  const statusCode = c.res.status
  const normalizedPath = normalizePath(path)

  // Send to MetricsCollectorDO via waitUntil (non-blocking)
  try {
    const metricsCollector = c.env.METRICS_COLLECTOR
    if (metricsCollector) {
      const doId = metricsCollector.idFromName('global')
      const stub = metricsCollector.get(doId)

      const promise = stub.fetch('http://metrics-collector/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: c.req.method,
          path: normalizedPath,
          statusCode,
          responseTimeMs: responseTime,
          timestamp: Date.now(),
        }),
      }).catch((err: Error) => {
        console.error('Failed to send metrics to DO:', err.message)
      })

      // Non-blocking: use waitUntil so response is not delayed
      c.executionCtx.waitUntil(promise)
    }
  } catch (err) {
    // Never let metrics collection break the request
    console.error('Metrics middleware error:', err)
  }
}
```

- [ ] **Step 2: Register middleware in src/index.ts**

After the CORS middleware registration (around line 65, after `log.info('Global CORS middleware registered successfully')`), add:

```typescript
// ==================== METRICS MIDDLEWARE (after CORS, before auth) ====================
import { metricsMiddleware } from './middleware/metrics'
log.info('Registering metrics collection middleware')
app.use('/api/*', metricsMiddleware)
log.info('Metrics middleware registered')
```

**Important:** This must be AFTER CORS but BEFORE any `jwtAuth` registrations or route registrations.

- [ ] **Step 3: Verify backend compiles**

Run: `cd D:/Code/Multi_Channel_Integration_System && bun run build`

Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/middleware/metrics.ts src/index.ts
git commit -m "feat(monitoring): add metrics collection middleware with DO integration"
```

---

## Task 3: Rewrite getApiStatus Handler

**Files:**
- Modify: `src/modules/system/handlers/system-health.ts` (replace `getApiStatus` function)
- Modify: `src/handlers/system-settings-router.ts` (add `jwtAuth` to route)

**Context:** The current `getApiStatus` (lines 114-241 in system-health.ts) generates fake data with `Math.random()`. Replace it with: (1) read real metrics from MetricsCollectorDO, (2) run infrastructure probes, (3) run channel checks (reusing existing `checkLineIntegration`/`checkFacebookIntegration`), (4) derive events from threshold comparisons.

- [ ] **Step 1: Add jwtAuth to api-status route**

In `src/handlers/system-settings-router.ts`, find the line:
```typescript
router.get('/api-status', getApiStatus)
```

Change to:
```typescript
router.get('/api-status', jwtAuth, getApiStatus)
```

Add the import if not present:
```typescript
import { jwtAuth } from '../middleware/auth'
```

- [ ] **Step 2: Rewrite getApiStatus handler**

In `src/modules/system/handlers/system-health.ts`, replace the entire `getApiStatus` function (from `export const getApiStatus = async` to the closing `}` before `checkLineIntegration`) with:

```typescript
// API monitoring endpoint - get real endpoint statuses from MetricsCollectorDO
export const getApiStatus = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // 1. Read real metrics from MetricsCollectorDO
    let endpoints: Array<Record<string, unknown>> = []
    try {
      const doId = c.env.METRICS_COLLECTOR.idFromName('global')
      const stub = c.env.METRICS_COLLECTOR.get(doId)
      const metricsResponse = await stub.fetch('http://metrics-collector/metrics')
      if (metricsResponse.ok) {
        const data = await metricsResponse.json() as { endpoints: Array<Record<string, unknown>> }
        endpoints = data.endpoints || []
      }
    } catch (err) {
      console.error('Failed to read metrics from DO:', err)
    }

    // 2. Infrastructure health probes (run in parallel)
    const infraProbes = await runInfrastructureProbes(c.env)

    // 3. Channel integration checks (run in parallel)
    const channelChecks = await runChannelChecks(c.env)

    // 4. Derive events from current state
    const events = deriveEvents(endpoints, infraProbes, channelChecks)

    // 5. Compute aggregated stats
    const healthyCount = endpoints.filter((e) => e.status === 'healthy').length
    const warningCount = endpoints.filter((e) => e.status === 'warning').length
    const errorCount = endpoints.filter((e) => e.status === 'error').length
    const totalResponseTime = endpoints.reduce((sum, e) => sum + (Number(e.avgResponseTime) || 0), 0)
    const avgResponseTime = endpoints.length > 0 ? Math.round(totalResponseTime / endpoints.length) : 0

    // Determine overall status
    let overallStatus: 'operational' | 'degraded' | 'outage' = 'operational'
    if (errorCount > 0 || infraProbes.some(p => p.status === 'error')) {
      overallStatus = errorCount > endpoints.length / 2 ? 'outage' : 'degraded'
    } else if (warningCount > 0 || infraProbes.some(p => p.status === 'warning')) {
      overallStatus = 'degraded'
    }

    return successResponse(c, {
      status: overallStatus,
      endpoints,
      infrastructure: infraProbes,
      channels: channelChecks,
      events,
      stats: {
        totalEndpoints: endpoints.length,
        healthyCount,
        warningCount,
        errorCount,
        avgResponseTime,
      },
      timestamp: nowISO(),
    }, 'API status retrieved successfully')
  } catch (error) {
    return handleApiError(error, c)
  }
}

// Infrastructure health probes
async function runInfrastructureProbes(env: Bindings): Promise<Array<{
  id: string; name: string; status: 'healthy' | 'warning' | 'error'; latencyMs: number; lastCheck: string
}>> {
  const probes = await Promise.allSettled([
    // D1 Database
    (async () => {
      const start = Date.now()
      await env.DB.prepare('SELECT 1').first()
      return { id: 'd1', name: 'D1 Database', latencyMs: Date.now() - start }
    })(),
    // KV Store (use CACHE binding — available as raw Worker binding)
    (async () => {
      const start = Date.now()
      await env.CACHE.get('health-check-probe')
      return { id: 'kv', name: 'KV Store', latencyMs: Date.now() - start }
    })(),
    // R2 Storage (binding name is R2_BUCKET, not R2)
    (async () => {
      const start = Date.now()
      await env.R2_BUCKET.head('health-check-probe')
      return { id: 'r2', name: 'R2 Storage', latencyMs: Date.now() - start }
    })(),
    // Durable Objects (ping MetricsCollectorDO)
    (async () => {
      const start = Date.now()
      const doId = env.METRICS_COLLECTOR.idFromName('global')
      const stub = env.METRICS_COLLECTOR.get(doId)
      await stub.fetch('http://metrics-collector/health')
      return { id: 'do', name: 'Durable Objects', latencyMs: Date.now() - start }
    })(),
  ])

  return probes.map((result, i) => {
    const fallbackNames = ['D1 Database', 'KV Store', 'R2 Storage', 'Durable Objects']
    const fallbackIds = ['d1', 'kv', 'r2', 'do']

    if (result.status === 'fulfilled') {
      const latency = result.value.latencyMs
      let status: 'healthy' | 'warning' | 'error' = 'healthy'
      if (latency >= 200) status = 'error'
      else if (latency >= 50) status = 'warning'

      return {
        id: result.value.id,
        name: result.value.name,
        status,
        latencyMs: latency,
        lastCheck: new Date().toISOString(),
      }
    }

    return {
      id: fallbackIds[i],
      name: fallbackNames[i],
      status: 'error' as const,
      latencyMs: -1,
      lastCheck: new Date().toISOString(),
    }
  })
}

// Channel integration checks
async function runChannelChecks(env: Bindings): Promise<Array<{
  id: string; name: string; status: 'connected' | 'disconnected' | 'error'; details: string; latencyMs: number; lastCheck: string
}>> {
  const checks = await Promise.allSettled([
    (async () => {
      const start = Date.now()
      const result = await checkLineIntegration(env)
      return { id: 'line', name: 'LINE Messaging API', ...result, latencyMs: Date.now() - start }
    })(),
    (async () => {
      const start = Date.now()
      const result = await checkFacebookIntegration(env)
      return { id: 'facebook', name: 'Facebook Messenger', ...result, latencyMs: Date.now() - start }
    })(),
  ])

  const channels = checks.map((result) => {
    if (result.status === 'fulfilled') {
      const r = result.value
      return {
        id: r.id,
        name: r.name,
        status: (r.status ? 'connected' : 'disconnected') as 'connected' | 'disconnected' | 'error',
        details: r.message,
        latencyMs: r.latencyMs,
        lastCheck: new Date().toISOString(),
      }
    }
    return {
      id: 'unknown',
      name: 'Unknown',
      status: 'error' as const,
      details: 'Check failed',
      latencyMs: -1,
      lastCheck: new Date().toISOString(),
    }
  })

  // Add webhook delivery status (derived from LINE/FB status)
  const anyConnected = channels.some(ch => ch.status === 'connected')
  channels.push({
    id: 'webhook',
    name: 'Webhook Delivery',
    status: anyConnected ? 'connected' : 'disconnected',
    details: anyConnected ? `Active: ${channels.filter(c => c.status === 'connected').length} channels` : 'No channels connected',
    latencyMs: 0,
    lastCheck: new Date().toISOString(),
  })

  return channels
}

// Derive events from current metrics state
function deriveEvents(
  endpoints: Array<Record<string, unknown>>,
  infrastructure: Array<{ id: string; status: string; name: string; latencyMs: number }>,
  channels: Array<{ id: string; status: string; name: string }>
): Array<{ id: string; type: 'recovery' | 'warning' | 'error' | 'info'; message: string; timestamp: string }> {
  const events: Array<{ id: string; type: 'recovery' | 'warning' | 'error' | 'info'; message: string; timestamp: string }> = []
  const now = new Date().toISOString()

  // Check endpoints for issues
  for (const ep of endpoints) {
    if (ep.status === 'error') {
      events.push({
        id: `ep-error-${ep.id}`,
        type: 'error',
        message: `${ep.method} ${ep.endpoint} error rate exceeds threshold`,
        timestamp: now,
      })
    } else if (ep.status === 'warning') {
      events.push({
        id: `ep-warn-${ep.id}`,
        type: 'warning',
        message: `${ep.method} ${ep.endpoint} p95 latency > 500ms or success rate < 95%`,
        timestamp: now,
      })
    }
  }

  // Check infrastructure
  for (const infra of infrastructure) {
    if (infra.status === 'error') {
      events.push({
        id: `infra-error-${infra.id}`,
        type: 'error',
        message: `${infra.name} health check failed (${infra.latencyMs}ms)`,
        timestamp: now,
      })
    }
  }

  // Check channels
  for (const ch of channels) {
    if (ch.status === 'disconnected' || ch.status === 'error') {
      events.push({
        id: `channel-${ch.id}`,
        type: 'warning',
        message: `${ch.name} is not connected`,
        timestamp: now,
      })
    }
  }

  // If everything is healthy, add an info event
  if (events.length === 0) {
    events.push({
      id: 'all-healthy',
      type: 'info',
      message: 'All systems operational',
      timestamp: now,
    })
  }

  return events
}
```

- [ ] **Step 3: Verify backend compiles**

Run: `cd D:/Code/Multi_Channel_Integration_System && bun run build`

Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

**Note:** Do NOT deploy yet. Adding `jwtAuth` to `/api-status` will break the live frontend until the frontend is also updated (Task 5+). All deployment is deferred to Task 10.

**Note:** Preserve existing imports at the top of `system-health.ts` (`successResponse`, `handleApiError`, `nowISO`, etc.). Only replace the `getApiStatus` function body and add the new helper functions below it.

```bash
git add src/modules/system/handlers/system-health.ts src/handlers/system-settings-router.ts
git commit -m "feat(monitoring): replace fake api-status data with real DO metrics + infra probes"
```

---

## Task 4: Frontend Types Rewrite

**Files:**
- Modify: `frontend/src/types/api-monitor.ts`

**Context:** Near-complete rewrite to match the new API response shape. Add Infrastructure, Channel, Event types. Keep flat field pattern for ApiEndpoint but add `p50ResponseTime` and `statusCodes`.

- [ ] **Step 1: Rewrite types file**

Replace the entire contents of `frontend/src/types/api-monitor.ts` with the new types that match the API response shape from the spec (Section 5). Key types:

- `ApiEndpoint` — flat fields with `responseTime` (p95), `avgResponseTime`, `p50ResponseTime`, `successRate`, `requestCount`, `errorCount`, `statusCodes`, `lastCheck`
- `InfrastructureItem` — `id`, `name`, `status`, `latencyMs`, `lastCheck`
- `ChannelItem` — `id`, `name`, `status` ('connected'|'disconnected'|'error'), `details`, `latencyMs`, `lastCheck`
- `MonitorEvent` — `id`, `type` ('recovery'|'warning'|'error'|'info'), `message`, `timestamp`
- `SystemStatus` — 'operational' | 'degraded' | 'outage'
- `ApiStatusResponse` — full response type matching backend shape
- `ApiStatistics` — `total`, `healthy`, `warning`, `error`, `avgResponseTime`
- Keep: `FilterState`, `ModalState`, `AutoRefreshConfig`, `ApiStatus`, `ApiCategory`
- Remove: `MigrationStatus`, `MigrationStatusResponse`

- [ ] **Step 2: Verify frontend compiles**

Run: `cd D:/Code/Multi_Channel_Integration_System/frontend && bun run type-check`

Expected: Will have errors in controller/components (they still reference old types). That's expected — we fix them in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/api-monitor.ts
git commit -m "refactor(monitoring): rewrite api-monitor types for new response shape"
```

---

## Task 5: Rewrite Controller (useApiMonitorController)

**Files:**
- Modify: `frontend/src/composables/useApiMonitorController.ts`

**Context:** Simplify dramatically. Remove: `DEFAULT_APIS`, `checkApiStatus()`, `fetchMigrationStatus()`, `migrationStatus` ref, `testApi()`. The controller now only: (1) fetches `GET /api/system/api-status` with auth token, (2) manages filter/search/expand state, (3) auto-refresh interval.

- [ ] **Step 1: Rewrite controller**

Replace the entire file. The new controller:

- State: `data` (full API response), `loading`, `isRefreshing`, `error`, `filters`, `modal`, `autoRefresh`, `expandedCard`
- Computed: `filteredApis` (filter endpoints by status/category/search), `stats` (from `data.stats`)
- Methods: `initialize()`, `refreshAll()`, `toggleCard()`, `showStatDetails()`, `closeModal()`, `toggleAutoRefresh()`, `cleanup()`
- `refreshAll()` fetches from `/api/system/api-status` with auth header from the auth store (`useAuthStore`)
- No `DEFAULT_APIS`, no `checkApiStatus`, no `fetchMigrationStatus`, no `testApi`

Key change in `refreshAll`:
```typescript
const authStore = useAuthStore()
const baseUrl = import.meta.env.DEV ? '' : getBackendUrl()
const response = await fetch(`${baseUrl}/api/system/api-status`, {
  headers: {
    'Authorization': `Bearer ${authStore.token}`,
  },
})
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd D:/Code/Multi_Channel_Integration_System/frontend && bun run type-check`

Expected: Component errors remain (they reference old controller API). Controller itself should compile.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/composables/useApiMonitorController.ts
git commit -m "refactor(monitoring): simplify controller to fetch-only pattern"
```

---

## Task 6: New Frontend Components

**Files:**
- Create: `frontend/src/components/api-monitor/InfrastructureCard.vue`
- Create: `frontend/src/components/api-monitor/ChannelIntegrationsCard.vue`
- Create: `frontend/src/components/api-monitor/RecentEventsCard.vue`
- Create: `frontend/src/components/api-monitor/EndpointDetailPanel.vue`
- Modify: `frontend/src/components/api-monitor/index.ts`

**Context:** Follow the design from the mockup (`.superpowers/brainstorm/756-1774421832/final-design.html`). All components must follow Apple-Native Soft Minimalism: `rounded-2xl`, soft shadow `shadow-[0_4px_16px_rgba(0,0,0,0.04)]`, `#F2F2F7` backgrounds, semantic colors, no hard borders, `rounded-full` pills.

- [ ] **Step 1: Create InfrastructureCard.vue**

Props: `infrastructure: InfrastructureItem[]`

Shows a white card with title "Infrastructure" and a list of items. Each item: colored icon box (D1/KV/R2/DO), service name, latency value color-coded (green < 50ms, orange < 200ms, red >= 200ms).

- [ ] **Step 2: Create ChannelIntegrationsCard.vue**

Props: `channels: ChannelItem[]`

Shows channel items with brand-colored icons (LINE `#06C755`, FB `#1877F2`, Webhook `#007AFF`), name, connection status, latency, status dot.

- [ ] **Step 3: Create RecentEventsCard.vue**

Props: `events: MonitorEvent[]`

Timeline list with color-coded dots (green=recovery, orange=warning, red=error, blue=info), message text, relative time using `Intl.RelativeTimeFormat` or simple "Xs ago" computation.

- [ ] **Step 4: Create EndpointDetailPanel.vue**

Props: `endpoint: ApiEndpoint`

Shown when an endpoint row is expanded. Contains:
- 4-column detail metrics grid: p50, p95, requests/h, errors/h
- Mini bar chart (CSS-only bars representing `statusCodes` distribution or placeholder)
- "Last checked" timestamp + "Test Now" button (emits event, disabled for Phase 1)

- [ ] **Step 5: Update barrel exports**

In `frontend/src/components/api-monitor/index.ts`, add exports for new components and remove `MigrationStatus`:

```typescript
export { default as InfrastructureCard } from './InfrastructureCard.vue'
export { default as ChannelIntegrationsCard } from './ChannelIntegrationsCard.vue'
export { default as RecentEventsCard } from './RecentEventsCard.vue'
export { default as EndpointDetailPanel } from './EndpointDetailPanel.vue'
// Remove: export { default as MigrationStatus } from './MigrationStatus.vue'
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/api-monitor/
git commit -m "feat(monitoring): add Infrastructure, Channel, Events, and DetailPanel components"
```

---

## Task 7: Redesign Existing Components

**Files:**
- Modify: `frontend/src/components/api-monitor/ApiHeader.vue`
- Modify: `frontend/src/components/api-monitor/ApiStatsGrid.vue`
- Modify: `frontend/src/components/api-monitor/ApiCard.vue`
- Modify: `frontend/src/components/api-monitor/ApiCardList.vue`
- Modify: `frontend/src/components/api-monitor/ApiFilter.vue`
- Modify: `frontend/src/components/api-monitor/ApiModal.vue`

**Context:** Follow the mockup. All components redesigned to Apple-Native Soft Minimalism.

- [ ] **Step 1: Redesign ApiHeader.vue**

Replace the current gradient banner with:
- Large title "System Status" (34px, font-bold, `text-[#1C1C1E]`)
- Subtitle line with last update time
- Right side: auto-refresh toggle (green dot + interval), overall status badge (`rounded-full`, bg color per status), refresh icon button

Props: `loading`, `autoRefresh`, `systemStatus` ('operational'|'degraded'|'outage')
Emits: `refresh`, `toggle-auto-refresh`

- [ ] **Step 2: Redesign ApiStatsGrid.vue**

Replace the current stats cards with a 4-column grid. Each card:
- `bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] p-5`
- Uppercase label (11px, `text-[#8E8E93]`, tracking-wide)
- Large number (36px, font-bold, semantic color)
- Thin progress bar (4px, `rounded-full`, fill width proportional to count/total)

Props: `stats: ApiStatistics`
Emits: `stat-click(type)`

- [ ] **Step 3: Redesign ApiCard.vue**

Replace the current card with a rich row:
- Status dot (8px, color-coded) + method badge (GET blue/POST green, `rounded-md`) + path (monospace) + description
- Right side: p95 latency, success %, req/h, last check, chevron
- Click to expand `EndpointDetailPanel`
- Alternating row backgrounds, hover state
- Warning rows tinted `#FFF9F0` when expanded

Props: `endpoint: ApiEndpoint`, `expanded: boolean`
Emits: `toggle`, `test`

- [ ] **Step 4: Update ApiCardList.vue**

Update to pass new props to `ApiCard`. Ensure it renders the endpoint list section header + filter pills area.

- [ ] **Step 5: Redesign ApiFilter.vue**

Replace with capsule pills (`rounded-full`). Active pill: `bg-[#007AFF] text-white`. Inactive: `bg-[#F2F2F7] text-[#8E8E93]`.

Categories: All, System, Auth, Business, Integration

- [ ] **Step 6: Update ApiModal.vue**

Update to work with new `ApiEndpoint` type (flat fields with `p50ResponseTime`, `statusCodes`).

- [ ] **Step 7: Verify frontend compiles**

Run: `cd D:/Code/Multi_Channel_Integration_System/frontend && bun run type-check`

Expected: May still have errors in `ApiMonitor.vue` (next task). Components should compile.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/api-monitor/
git commit -m "feat(monitoring): redesign existing components to Apple-Native Soft Minimalism"
```

---

## Task 8: Bento Grid Layout (ApiMonitor.vue)

**Files:**
- Modify: `frontend/src/views/ApiMonitor.vue`

**Context:** Replace the current vertical layout with a 4-column Bento Grid. Import all new components and wire them to the controller.

- [ ] **Step 1: Rewrite ApiMonitor.vue template**

The template should be:

```html
<AppLayout>
  <div class="max-w-[1400px] mx-auto px-5">
    <!-- Header -->
    <ApiHeader ... />

    <!-- Bento Grid (responsive: 1 col mobile, 2 col tablet, 4 col desktop) -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Row 1: Stat Cards -->
      <ApiStatsGrid ... />  <!-- renders 4 cards internally, each is grid item -->

      <!-- Row 2: Endpoints (span 3) + Infrastructure (span 1) -->
      <div class="col-span-1 md:col-span-2 lg:col-span-3 bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] p-5">
        <ApiFilter ... />
        <ApiCardList ... />
      </div>
      <InfrastructureCard class="col-span-1" ... />

      <!-- Row 3: Channels (span 2) + Events (span 2) -->
      <ChannelIntegrationsCard class="col-span-1 md:col-span-1 lg:col-span-2" ... />
      <RecentEventsCard class="col-span-1 md:col-span-1 lg:col-span-2" ... />
    </div>

    <!-- Modal -->
    <ApiModal v-if="..." ... />
  </div>
</AppLayout>
```

Wire all props from `controller.data` to each component.

- [ ] **Step 2: Verify full frontend compiles**

Run: `cd D:/Code/Multi_Channel_Integration_System/frontend && bun run type-check && bun run lint`

Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/views/ApiMonitor.vue
git commit -m "feat(monitoring): implement Bento Grid layout for API monitoring dashboard"
```

---

## Task 9: Cleanup Dead Code

**Files:**
- Remove: `frontend/src/components/api-monitor/MigrationStatus.vue`
- Remove: `frontend/src/services/api-monitor.ts`
- Remove: `frontend/src/views/ApiMonitor.refactored.vue`

- [ ] **Step 1: Delete dead files**

```bash
rm frontend/src/components/api-monitor/MigrationStatus.vue
rm frontend/src/services/api-monitor.ts
rm frontend/src/views/ApiMonitor.refactored.vue
```

- [ ] **Step 2: Verify no broken imports**

Run: `cd D:/Code/Multi_Channel_Integration_System/frontend && bun run type-check && bun run lint`

Expected: All pass. No references to deleted files.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(monitoring): remove dead code (MigrationStatus, legacy service, refactored view)"
```

---

## Task 10: Visual QA & Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Deploy backend**

Run: `cd D:/Code/Multi_Channel_Integration_System && bun run deploy`

- [ ] **Step 2: Build and deploy frontend**

Run: `cd D:/Code/Multi_Channel_Integration_System/frontend && bun run build`

- [ ] **Step 3: Visual QA in browser**

Open `http://localhost:5173/monitoring/api` and verify:
- Bento Grid layout renders correctly
- 4 stat cards show data (initially 0s until traffic flows)
- API Endpoints section shows endpoints from DO metrics
- Infrastructure card shows real D1/KV/R2/DO latency
- Channel Integrations shows LINE/Facebook connection status
- Recent Events shows derived events
- Auto-refresh updates every 15s
- Filter pills work (status + category filtering)
- Endpoint rows are clickable and expand to show detail panel
- No purple gradient, no migration card
- Design matches mockup

- [ ] **Step 4: Full type-check**

Run both:
```bash
cd D:/Code/Multi_Channel_Integration_System && bun run build
cd D:/Code/Multi_Channel_Integration_System/frontend && bun run type-check && bun run lint
```

Expected: All pass, zero errors.
