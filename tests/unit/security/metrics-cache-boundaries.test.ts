import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { metricsMiddleware, __resetMetricsBatchForTest } from '../../../src/middleware/metrics'
import { MetricsCollectorDO } from '../../../src/durable-objects/MetricsCollectorDO'
import { LatestMessageCache } from '../../../src/services/latest-message-cache'
import { LatestMessageCacheCoordinator } from '../../../src/durable-objects/LatestMessageCacheCoordinator'

function storageState(initial: Record<string, unknown> = {}) {
  const values = new Map(Object.entries(initial))
  let ready = Promise.resolve()
  let writes = 0
  let alarm: number | null = null
  const state = {
    blockConcurrencyWhile(fn: () => Promise<void>) { ready = fn() },
    storage: {
      async get(key: string) { return values.get(key) },
      async put(key: string, value: unknown) { writes++; values.set(key, value) },
      async delete(key: string | string[]) { for (const k of [key].flat()) values.delete(k) },
      async list({ prefix }: { prefix: string }) {
        return new Map([...values].filter(([k]) => k.startsWith(prefix)))
      },
      async getAlarm() { return alarm },
      async setAlarm(value: number) { alarm = value },
      async deleteAlarm() { alarm = null },
      async deleteAll() { values.clear(); alarm = null },
    },
  }
  return { state: state as any, ready: () => ready, writes: () => writes, values,
    alarm: () => alarm, consumeAlarm() { alarm = null } }
}

async function ingest(collector: MetricsCollectorDO, path: string, extra = {}) {
  return collector.fetch(new Request('http://metrics/ingest', {
    method: 'POST',
    body: JSON.stringify({ method: 'GET', path, statusCode: 200, responseTimeMs: 5,
      timestamp: Date.now(), ...extra }),
  }))
}

async function snapshot(collector: MetricsCollectorDO) {
  return (await (await collector.fetch(new Request('http://metrics/metrics'))).json() as any).data
}

afterEach(() => vi.useRealTimers())

describe('metrics resource boundary', () => {
  function middlewareApp() {
    const calls: Array<{ url: string; samples: Array<{ path: string }> }> = []
    const pending: Promise<unknown>[] = []
    const app = new Hono<any>()
    app.use('/api/*', metricsMiddleware)
    app.get('/api/conversations/:id', c => c.text('ok'))
    app.get('/api/ping', c => c.text('ok'))
    const env = { METRICS_COLLECTOR: {
      idFromName: () => 'global',
      get: () => ({ fetch: async (url: string, init: RequestInit) => {
        calls.push({ url, samples: JSON.parse(init.body as string).samples })
        return new Response('{}')
      } }),
    } }
    const hit = (path: string) => app.fetch(new Request(`http://worker${path}`), env,
      { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {} })
    return { calls, hit, settle: () => Promise.all(pending) }
  }

  it('uses route templates and one bucket for unmatched alphabetic paths', async () => {
    vi.useFakeTimers()
    __resetMetricsBatchForTest()
    const { calls, hit, settle } = middlewareApp()
    for (const path of ['/api/arbitrary-alpha', '/api/arbitrary-beta', '/api/conversations/alice']) {
      await hit(path)
      vi.setSystemTime(Date.now() + 31_000) // past the batch interval: each request flushes
    }
    await settle()
    expect(calls.flatMap(c => c.samples.map(s => s.path)))
      .toEqual(['/api/:unknown', '/api/:unknown', '/api/conversations/:id'])
    expect(calls.every(c => c.url.endsWith('/ingest-batch'))).toBe(true)
  })

  it('sends the first request at once, then one batch per interval instead of one call per request', async () => {
    vi.useFakeTimers()
    __resetMetricsBatchForTest()
    const { calls, hit, settle } = middlewareApp()
    await hit('/api/ping')
    await settle()
    expect(calls).toHaveLength(1)

    for (let i = 0; i < 25; i++) await hit('/api/ping')
    await settle()
    expect(calls).toHaveLength(1) // 25 requests inside the interval cost no DO call

    vi.setSystemTime(Date.now() + 31_000)
    await hit('/api/ping')
    await settle()
    expect(calls).toHaveLength(2)
    expect(calls[1].samples).toHaveLength(26)
  })

  it('flushes early when a batch is full so memory stays bounded', async () => {
    vi.useFakeTimers()
    __resetMetricsBatchForTest()
    const { calls, hit, settle } = middlewareApp()
    await hit('/api/ping') // first request flushes at once
    for (let i = 0; i < 200; i++) await hit('/api/ping')
    await settle()
    expect(calls).toHaveLength(2)
    expect(calls[1].samples).toHaveLength(200)
  })

  it('caps distinct keys while retaining request totals and persists before acknowledging ingest', async () => {
    const state = storageState()
    const collector = new MetricsCollectorDO(state.state, { CACHE: { put: async () => {} } } as any)
    await state.ready()
    for (let i = 0; i < 650; i++) await ingest(collector, `/api/letters-${i}`)
    const data = await snapshot(collector)
    expect(Object.keys(data.endpoints).length).toBeLessThanOrEqual(512)
    expect(data.global.totalRequests).toBe(650)
    // One small write per ingest call.
    expect(state.writes()).toBe(650)
    expect(state.values.has('metricsState')).toBe(true)
    const restored = new MetricsCollectorDO(state.state, {} as any)
    await state.ready()
    expect((await snapshot(restored)).global.totalRequests).toBe(650)
  })

  it('expires inactive endpoints using collector time, not a supplied future timestamp', async () => {
    vi.useFakeTimers()
    const state = storageState()
    const collector = new MetricsCollectorDO(state.state, {} as any)
    await state.ready()
    await ingest(collector, '/api/old', { timestamp: Date.now() + 10 * 86_400_000 })
    vi.setSystemTime(Date.now() + 86_400_001)
    expect((await snapshot(collector)).endpoints).toEqual({})
  })

  it('bounds legacy persisted endpoint maps when the collector restarts', async () => {
    const metrics = Array.from({ length: 650 }, (_, i) => [`GET:/api/legacy-${i}`, {
      requestCount: 1, errorCount: 0, totalResponseTime: 5, maxResponseTime: 5,
      recentResponseTimes: [5], statusCodes: { 200: 1 }, lastRequestAt: Date.now(),
    }])
    const state = storageState({ metricsState: { metrics, startedAt: Date.now() } })
    const collector = new MetricsCollectorDO(state.state, {} as any)
    await state.ready()
    expect(Object.keys((await snapshot(collector)).endpoints).length).toBeLessThanOrEqual(512)
  })

  it('never arms an alarm: persistence happens per call, not from a timer', async () => {
    const state = storageState()
    const collector = new MetricsCollectorDO(state.state, {} as any)
    await state.ready()
    await ingest(collector, '/api/test')
    expect(state.alarm()).toBeNull()
    await collector.alarm() // a leftover alarm from an older deployment
    expect(state.alarm()).toBeNull()
  })

  it('keeps the persisted snapshot far under the 128 KiB storage value limit at the endpoint cap', async () => {
    const { serialize } = await import('node:v8')
    const state = storageState()
    const collector = new MetricsCollectorDO(state.state, { CACHE: { put: async () => {} } } as any)
    await state.ready()
    for (let i = 0; i < 511; i++) {
      for (let j = 0; j < 200; j++) await ingest(collector, `/api/route-${i}`, { responseTimeMs: j * 7 })
    }
    expect(serialize(state.values.get('metricsState')).length).toBeLessThan(128 * 1024)
  })

  it('rejects invalid status values instead of creating unbounded nested counters', async () => {
    const state = storageState()
    const collector = new MetricsCollectorDO(state.state, {} as any)
    await state.ready()
    expect((await ingest(collector, '/api/test', { statusCode: 'attacker-key' })).status).toBe(400)
    expect((await snapshot(collector)).global.totalRequests).toBe(0)
  })
})

it('coordinator alarm populates KV and the next latest-message read avoids D1 and rescheduling', async () => {
  const state = storageState()
  const kv = new Map<string, string>()
  let queries = 0
  let schedules = 0
  const row = { conversationId: 'conversation-a', messageId: 'message-a', content: 'latest',
    createdAt: '2026-01-01T00:00:00Z', senderType: 'customer', messageType: 'text' }
  let coordinator: LatestMessageCacheCoordinator
  const env = {
    CACHE: {
      async get(key: string) { const value = kv.get(key); return value ? JSON.parse(value) : null },
      async put(key: string, value: string) { kv.set(key, value) },
      async delete(key: string) { kv.delete(key) },
    },
    DB: { prepare: () => {
      const statement = {
        bind: () => statement,
        async all() { queries++; return { results: [row], success: true, meta: {} } },
      }
      return statement
    } },
    LATEST_MESSAGE_COORDINATOR: {
      idFromName: () => 'global',
      get: () => ({ fetch: async (url: string, init: RequestInit) => {
        schedules++
        return coordinator.fetch(new Request(url, init))
      } }),
    },
  }
  coordinator = new LatestMessageCacheCoordinator(state.state, env as any)
  await state.ready()
  await coordinator.fetch(new Request('http://coordinator/schedule', {
    method: 'POST', body: JSON.stringify({ conversationId: 'conversation-a' }),
  }))
  await coordinator.alarm()
  expect(JSON.parse(kv.get('latest_msg:conversation-a') ?? 'null')?.messageId).toBe('message-a')
  const latest = await new LatestMessageCache(env as any).getLatestMessage('conversation-a')
  expect(latest?.content).toBe('latest')
  expect(queries).toBe(1)
  expect(schedules).toBe(0)
  const status = await (await coordinator.fetch(new Request('http://coordinator/status'))).json() as any
  expect(status.queueSize).toBe(0)
})
