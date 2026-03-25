# API Monitoring Dashboard Redesign

**Date:** 2026-03-25
**Status:** Approved
**Scope:** Backend metrics middleware + Frontend UI redesign

---

## 1. Problem Statement

The current API monitoring dashboard (`/monitoring/api`) displays **simulated data**. The backend `getApiStatus` handler generates random numbers (`Math.random()`) for response times, success rates, and request counts. This provides zero operational value.

Additionally, the current frontend design uses a purple gradient header and layout patterns that do not follow the project's Apple-Native Soft Minimalism design system.

### Current State (What's Wrong)

| Component | Issue |
|-----------|-------|
| `system-health.ts:200-218` | `Math.random()` generates fake metrics |
| Frontend pings (`checkApiStatus`) | HEAD requests from browser = anti-pattern |
| Migration status card | WebSocket migration is 100% complete, card is obsolete |
| Visual design | Purple gradient header, inconsistent with design system |

---

## 2. Architecture: Phased Approach

### Phase 1: Server-Side Passive Metrics (Core)

**Goal:** Replace fake data with real request metrics from a Hono middleware.

```
Real User Request
       │
       ▼
┌─────────────────────────────┐
│  Hono Metrics Middleware     │
│  (after CORS, before auth)   │
│                              │
│  1. Record start time        │
│  2. Call next()              │
│  3. After response:          │
│     - status code            │
│     - response time          │
│     - endpoint path          │
│     - method                 │
│  4. ctx.executionCtx          │
│     .waitUntil(sendToDO())   │
└─────────────────────────────┘
       │
       ▼
  MetricsCollectorDO (Durable Object)
  In-memory accumulator → periodic KV flush
```

**Why a Durable Object, not direct KV writes:**

1. **Race condition:** KV is eventually consistent with no atomic read-modify-write. Concurrent requests incrementing the same counter key lose updates (last-write-wins). A DO provides single-threaded, in-memory state that handles concurrency correctly.
2. **KV list() cost:** Reading `metrics:*` keys per aggregation call is expensive and slow. A DO holds a single aggregated object in memory and flushes to one KV key periodically.
3. **Existing pattern:** The project already uses DOs for coordination (LatestMessageCacheCoordinator, LockCoordinator). A MetricsCollectorDO fits naturally.

**MetricsCollectorDO Design:**

- **In-memory state:** `Map<string, EndpointMetrics>` keyed by `{method}:{normalizedPath}`
- **Ingest:** Receives metric data points via `fetch()` from the middleware's `waitUntil()`
- **Aggregation:** Maintains running counters: requestCount, errorCount, totalResponseTime, maxResponseTime, statusCodes
- **KV flush:** Every 60 seconds via `alarm()`, write aggregated snapshot to a single KV key `metrics:snapshot:{hourBucket}`
- **Read path:** `GET /api/system/api-status` calls the DO's `/metrics` endpoint to read current in-memory state (fast, no KV reads needed)
- **Hourly rotation:** On hour boundary, archive current counters to KV and reset

**Path normalization:**

Replace dynamic segments with `:id` using a mapping table derived from registered routes:
- `/api/conversations/abc-123` -> `/api/conversations/:id`
- `/api/conversations/abc-123/messages` -> `/api/conversations/:id/messages`
- `/api/teams/5/members` -> `/api/teams/:id/members`
- `/api/analytics/comparison/weekly` -> `/api/analytics/comparison/:type`

The mapping is built from the Hono route definitions at startup (route patterns already contain `:id` placeholders).

**Middleware placement:** After CORS middleware (to skip OPTIONS preflight metrics) but before auth middleware. This ensures all authenticated and public requests are measured without recording CORS preflight noise.

**Aggregation endpoint** (`GET /api/system/api-status`, requires `jwtAuth`):

- Calls MetricsCollectorDO to read current in-memory metrics (fast, single fetch)
- Adds infrastructure health probes (D1 `SELECT 1`, KV read, R2 head, DO ping)
- Adds channel integration status (reuse existing `checkLineIntegration()` / `checkFacebookIntegration()`)
- **Auth required:** This endpoint now exposes real operational data (traffic volumes, error rates, infrastructure latency) and must require `jwtAuth` + admin role

### Phase 2: Cron Health Probes (Future)

**Goal:** Detect failures even when no organic traffic exists.

- Cloudflare Cron Trigger: `*/1 * * * *` (every minute)
- `scheduled` handler in Worker entry point
- Probes: D1 `SELECT 1`, KV read/write, R2 head, LINE Bot API `/v2/bot/info`, Facebook Graph API `/me`
- Results written to same KV metrics store
- No auth needed — runs inside the Worker with full env access

### Phase 3: Frontend Display Only

**Goal:** Frontend calls ONE endpoint and renders the result.

- `GET /api/system/api-status` returns all data
- Frontend does zero health pinging
- Auto-refresh every 15 seconds (calls the single endpoint)
- The existing `checkApiStatus` (HEAD requests from browser) is removed

---

## 3. Frontend Design: Bento Grid Dashboard

### Layout: 4-Column Bento Grid

```
┌──────────┬──────────┬──────────┬──────────┐
│ Healthy  │ Warnings │  Errors  │ Avg Resp │  ← Row 1: Stat cards
│    9     │    0     │    0     │   89ms   │
├──────────┴──────────┴──────────┼──────────┤
│                                │          │
│       API Endpoints            │ Infra-   │  ← Row 2: Endpoints + Infrastructure
│       (rich rows,              │ structure│
│        expandable detail)      │ Health   │
│                                │          │
├──────────────────┬─────────────┴──────────┤
│   Channel        │    Recent Events       │  ← Row 3: Channels + Events
│   Integrations   │                        │
└──────────────────┴────────────────────────┘
```

### Design System Compliance

| Element | Specification |
|---------|--------------|
| Page background | `#F2F2F7` (iOS system gray) |
| Cards | `bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)]` |
| Card gap | `16px` (`gap-4`) |
| Page padding | `20px` (`px-5`) |
| No hard borders | Shadow + background color difference only |
| Buttons/pills | `rounded-full` capsule shape |
| Primary text | `#1C1C1E` (never pure black) |
| Secondary text | `#8E8E93` |
| Healthy | `#34C759` |
| Warning | `#FF9500` |
| Error | `#FF3B30` |
| Accent | `#007AFF` |
| Animations | 200-350ms ease-out |

### Page Header

- Large title: "System Status" (34px, font-bold, `#1C1C1E`)
- Subtitle: "Real-time monitoring powered by server-side metrics"
- Right side: Auto-refresh toggle (green dot + "15s"), overall status badge ("All Systems Operational" / "Degraded"), refresh button

**Removed:** Purple gradient banner, "API Monitoring Dashboard" Chinese title

### Row 1: Stat Cards (4 cards)

Each card shows:
- Uppercase label (11px, `#8E8E93`)
- Large number (36px, font-bold, semantic color)
- Thin progress bar (4px, `rounded-full`)

Cards: Healthy Endpoints, Warnings, Errors, Avg Response Time

### Row 2: API Endpoints Card (spans 3 columns)

**Section header:** "API Endpoints" + filter pills (All / System / Auth / Business / Integration)

**Each endpoint row (Rich):**
- Status dot (8px, color-coded)
- Method badge (`GET` blue / `POST` green, `rounded-md`)
- Endpoint path (monospace font, 13px, font-semibold)
- Description (11px, `#8E8E93`)
- Metrics: p95 latency, success rate, req/h, last check time
- Chevron (right arrow, rotates 90deg when expanded)

**Expandable detail panel (on click):**
- Detail metrics grid (4 cols): p50 latency, p95 latency, requests/h, errors/h
- Mini bar chart: response time history (last 1h)
- Actions: "Last checked: Xs ago" + "Test Now" button (blue capsule)
- Background: `#FAFBFC`, top border: `1px solid #F2F2F7`

**Row background:** Alternating `#FAFAFA` / `#FFFFFF`, hover `#F2F2F7`
**Warning row expanded:** Background tinted `#FFF9F0`

### Row 2: Infrastructure Card (spans 1 column)

**Title:** "Infrastructure"

Each item shows:
- Colored icon box (32px, rounded-lg) with label (D1/KV/R2/DO/Q)
- Service name
- Latency value (color-coded: green < 50ms, orange < 200ms, red >= 200ms)

Services: D1 Database (`SELECT 1`), KV Store (read test key), R2 Storage (`head` test), Durable Objects (ping MetricsCollectorDO)

Note: Queue is excluded — Cloudflare Queues have no health-check API. Queue health can be inferred from message processing metrics in Phase 2.

### Row 3: Channel Integrations Card (spans 2 columns)

Each channel shows:
- Brand-colored icon (36px, rounded-lg): LINE green `#06C755`, FB blue `#1877F2`
- Channel name + connection status
- Latency + status dot

Channels: LINE Messaging API, Facebook Messenger, Webhook Delivery

### Row 3: Recent Events Card (spans 2 columns)

**Header:** "Recent Events" + "View All" link (blue)

Timeline list:
- Color-coded dot (6px): green=recovery, orange=warning, red=error, blue=info
- Event description (13px)
- Relative time (11px, `#8E8E93`)

---

## 4. Backend Changes

### New: Metrics Middleware

**File:** `src/middleware/metrics.ts`

```typescript
// Hono middleware that records request metrics
// Runs on ALL routes (outermost middleware)
// Uses waitUntil() for async KV writes
```

Collected per request:
- `method` (GET/POST/etc)
- `path` (normalized, e.g., `/api/conversations` not `/api/conversations/123`)
- `statusCode`
- `responseTimeMs`
- `timestamp`

Path normalization: Replace UUID/numeric segments with `:id` (e.g., `/api/conversations/abc-123` becomes `/api/conversations/:id`)

### Modified: `getApiStatus` handler

**File:** `src/modules/system/handlers/system-health.ts`

Replace `Math.random()` block (lines 200-218) with:
1. Read KV metrics for all tracked endpoints
2. Aggregate into response format
3. Add infrastructure health probes (D1 `SELECT 1`, KV read, etc.)
4. Add channel integration status (reuse existing `checkLineIntegration()` / `checkFacebookIntegration()`)

### Modified: Worker entry

**File:** `src/index.ts`

- Register metrics middleware as outermost middleware (before auth, before routes)

### Removed from Frontend

- `checkApiStatus()` in `useApiMonitorController.ts` — no more frontend HEAD requests
- `DEFAULT_APIS` hardcoded list — endpoints come from backend
- Individual `testApi()` that does browser HEAD requests — removed entirely (deferred to Phase 2 as `POST /api/system/api-test/:endpointId`)
- `fetchMigrationStatus()` and `migrationStatus` ref — migration is complete
- `MigrationStatus` type in `api-monitor.ts`

### Retained from Frontend

- Auto-refresh (15s interval calling `GET /api/system/api-status`)
- Filter/search functionality (client-side filtering of backend data)
- Expandable card toggle

### Events Generation (Read-Time Derivation)

Events are **not** stored separately. The `getApiStatus` handler generates events at read-time by:
1. Comparing current metrics against thresholds (e.g., success rate < 95% -> warning event)
2. Detecting status transitions by comparing current snapshot against previous hour's KV snapshot (e.g., endpoint was warning, now healthy -> "recovered" event)
3. Including infrastructure/channel probe results as events when they fail

This avoids needing a separate event write path in Phase 1. Phase 2 Cron probes can write persistent events to KV.

---

## 5. API Response Shape

### `GET /api/system/api-status`

```typescript
{
  success: true,
  data: {
    // Overall status
    status: 'operational' | 'degraded' | 'outage',

    // Endpoint metrics (flat fields — matches existing ApiEndpoint type pattern)
    endpoints: [{
      id: string,
      endpoint: string,        // e.g., "/api/conversations"
      method: string,          // e.g., "GET"
      category: string,        // "system" | "auth" | "conversation" | "customer" | "team" | "message" | "integration"
      description: string,
      status: 'healthy' | 'warning' | 'error',
      responseTime: number,         // p95 response time (primary display)
      avgResponseTime: number,      // average response time
      p50ResponseTime: number,      // median (for detail panel)
      successRate: number,          // percentage 0-100
      requestCount: number,         // last hour
      errorCount: number,           // last hour
      statusCodes: Record<string, number>,  // for detail panel
      lastCheck: string             // ISO timestamp
    }],

    // Infrastructure health (from direct probes)
    infrastructure: [{
      id: string,              // "d1" | "kv" | "r2" | "do" | "queue"
      name: string,
      status: 'healthy' | 'warning' | 'error',
      latencyMs: number,
      lastCheck: string
    }],

    // Channel integrations (from API checks)
    channels: [{
      id: string,              // "line" | "facebook" | "webhook"
      name: string,
      status: 'connected' | 'disconnected' | 'error',
      details: string,         // e.g., "Connected: MyBot"
      latencyMs: number,
      lastCheck: string
    }],

    // Recent events (from KV event log)
    events: [{
      id: string,
      type: 'recovery' | 'warning' | 'error' | 'info',
      message: string,
      timestamp: string
    }],

    // Aggregated stats
    stats: {
      totalEndpoints: number,
      healthyCount: number,
      warningCount: number,
      errorCount: number,
      avgResponseTime: number
    },

    timestamp: string
  }
}
```

---

## 6. Files to Create/Modify

### Create
| File | Purpose |
|------|---------|
| `src/middleware/metrics.ts` | Request metrics collection middleware |
| `src/durable-objects/MetricsCollectorDO.ts` | In-memory metrics accumulator DO |
| `frontend/src/components/api-monitor/InfrastructureCard.vue` | Infrastructure health card |
| `frontend/src/components/api-monitor/ChannelIntegrationsCard.vue` | Channel status card |
| `frontend/src/components/api-monitor/RecentEventsCard.vue` | Events timeline card |
| `frontend/src/components/api-monitor/EndpointDetailPanel.vue` | Expandable detail with chart |

### Modify
| File | Change |
|------|--------|
| `src/index.ts` | Register metrics middleware (after CORS, before auth); add MetricsCollectorDO export |
| `wrangler.toml` | Add MetricsCollectorDO binding |
| `src/modules/system/handlers/system-health.ts` | Replace fake data with DO reads + infra probes; add `jwtAuth` to `getApiStatus` route |
| `src/handlers/system-settings-router.ts` | Add `jwtAuth` middleware to `/api-status` route |
| `frontend/src/views/ApiMonitor.vue` | New Bento Grid layout, new components |
| `frontend/src/composables/useApiMonitorController.ts` | Remove frontend pinging, update types, add infrastructure/channels/events state; remove `migrationStatus`, `fetchMigrationStatus`, `checkApiStatus`, `DEFAULT_APIS` |
| `frontend/src/types/api-monitor.ts` | Near-complete rewrite: add Infrastructure, Channel, Event types; update ApiEndpoint with p50; update ApiStatusResponse to match new response shape |
| `frontend/src/components/api-monitor/index.ts` | Export new components, remove MigrationStatus export |
| `frontend/src/components/api-monitor/ApiHeader.vue` | Redesign to Apple-style large title with status badge |
| `frontend/src/components/api-monitor/ApiStatsGrid.vue` | Redesign to 4-column stat cards |
| `frontend/src/components/api-monitor/ApiCard.vue` | Rich row + expandable EndpointDetailPanel |
| `frontend/src/components/api-monitor/ApiCardList.vue` | Update to render new ApiCard format |
| `frontend/src/components/api-monitor/ApiFilter.vue` | Redesign to capsule filter pills |
| `frontend/src/components/api-monitor/ApiModal.vue` | Update to work with new data shape |

### Remove
| File/Code | Reason |
|-----------|--------|
| `frontend/src/components/api-monitor/MigrationStatus.vue` | Migration complete (100%), card obsolete |
| `DEFAULT_APIS` in controller | Endpoints come from backend |
| `checkApiStatus()` browser HEAD requests | Anti-pattern replaced by server-side metrics |
| `fetchMigrationStatus()` in controller | Migration complete, no longer needed |
| `MigrationStatus` type in `api-monitor.ts` | Dead type after card removal |
| `frontend/src/services/api-monitor.ts` | Already unused legacy service (verified: no imports) |
| `frontend/src/views/ApiMonitor.refactored.vue` | Stale refactored copy, not in use |

---

## 7. Success Criteria

1. **No fake data:** Dashboard shows only real metrics from server-side middleware
2. **Zero frontend pinging:** Browser makes no HEAD/GET requests to monitored endpoints
3. **Design system compliance:** All UI elements follow Apple-Native Soft Minimalism
4. **4 monitoring categories visible:** API endpoints, infrastructure, channels, events
5. **Rich + expandable endpoint rows:** Inline metrics + detail panel on click
6. **Non-blocking metrics:** `waitUntil()` ensures zero latency impact on user requests
7. **Type-safe:** All new code passes `tsc --noEmit` and `vue-tsc --noEmit`

---

## 8. Out of Scope (Phase 2+)

- Cron Trigger health probes (Phase 2)
- Historical trend charts with real time-series data
- Alert configuration / notification rules
- Cloudflare Analytics Engine integration
- Response time percentile calculation (Phase 1 uses max as p95 approximation)
