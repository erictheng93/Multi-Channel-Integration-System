import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { metricsMiddleware } from '../../../src/middleware/metrics'
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
      async getAlarm() { return alarm },
      async setAlarm(value: number) { alarm = value },
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
  it('uses route templates and one bucket for unmatched alphabetic paths', async () => {
    const paths: string[] = []
    const pending: Promise<unknown>[] = []
    const app = new Hono<any>()
    app.use('/api/*', metricsMiddleware)
    app.get('/api/conversations/:id', c => c.text('ok'))
    const env = { METRICS_COLLECTOR: {
      idFromName: () => 'global',
      get: () => ({ fetch: async (_url: string, init: RequestInit) => {
        paths.push(JSON.parse(init.body as string).path)
        return new Response('{}')
      } }),
    } }
    for (const path of ['/api/arbitrary-alpha', '/api/arbitrary-beta', '/api/conversations/alice']) {
      await app.fetch(new Request(`http://worker${path}`), env,
        { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {} })
    }
    await Promise.all(pending)
    expect(paths).toEqual(['/api/:unknown', '/api/:unknown', '/api/conversations/:id'])
  })

  it('caps distinct keys while retaining request totals and persists only at the alarm', async () => {
    const state = storageState()
    const collector = new MetricsCollectorDO(state.state, { CACHE: { put: async () => {} } } as any)
    await state.ready()
    for (let i = 0; i < 650; i++) await ingest(collector, `/api/letters-${i}`)
    const data = await snapshot(collector)
    expect(Object.keys(data.endpoints).length).toBeLessThanOrEqual(512)
    expect(data.global.totalRequests).toBe(650)
    expect(state.writes()).toBe(0)
    await collector.alarm()
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

  it('arms the flush alarm only on ingest and never re-arms it when idle', async () => {
    const state = storageState()
    const collector = new MetricsCollectorDO(state.state, { CACHE: { put: async () => {} } } as any)
    await state.ready()
    expect(state.alarm()).toBeNull()
    await ingest(collector, '/api/test')
    expect(state.alarm()).not.toBeNull()
    state.consumeAlarm()
    await collector.alarm()
    expect(state.alarm()).toBeNull()
    await ingest(collector, '/api/test')
    expect(state.alarm()).not.toBeNull()
  })

  it('keeps the persisted snapshot under the 128 KiB storage value limit at the endpoint cap', async () => {
    const { serialize } = await import('node:v8')
    const state = storageState()
    const collector = new MetricsCollectorDO(state.state, { CACHE: { put: async () => {} } } as any)
    await state.ready()
    for (let i = 0; i < 511; i++) {
      for (let j = 0; j < 200; j++) await ingest(collector, `/api/route-${i}`, { responseTimeMs: j * 7 })
    }
    await collector.alarm()
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
