import { describe, expect, it, vi } from 'vitest'
import { RateLimiterDO } from '../../../src/durable-objects/RateLimiterDO'
import { MetricsCollectorDO } from '../../../src/durable-objects/MetricsCollectorDO'

/**
 * Durable-state contract of the two alarm-backed objects:
 * a counted request is durable BEFORE it is acknowledged (so eviction cannot roll it back),
 * every write touches one small key, and the alarm chain stops by itself.
 */
function harness() {
  const values = new Map<string, unknown>()
  let ready = Promise.resolve()
  let alarm: number | null = null
  const state = {
    blockConcurrencyWhile(fn: () => Promise<void>) { ready = fn() },
    storage: {
      async get(key: string) { return structuredClone(values.get(key)) },
      put: vi.fn(async (key: string, value: unknown) => { values.set(key, structuredClone(value)) }),
      delete: vi.fn(async (key: string | string[]) => {
        for (const k of [key].flat()) values.delete(k)
      }),
      async list({ prefix }: { prefix: string }) {
        return structuredClone(new Map([...values].filter(([k]) => k.startsWith(prefix))))
      },
      async deleteAll() { values.clear(); alarm = null },
      async getAlarm() { return alarm },
      async setAlarm(value: number) { alarm = value },
      async deleteAlarm() { alarm = null },
    },
  }
  return { state: state as any, values, ready: () => ready,
    alarm: () => alarm, consumeAlarm() { alarm = null } }
}

function post(object: { fetch(request: Request): Promise<Response> }, path: string, body: unknown) {
  return object.fetch(new Request(`https://do${path}`, { method: 'POST', body: JSON.stringify(body) }))
}

const check = { action: 'check', clientId: 'ip', config: { maxRequests: 1, windowMs: 60_000 } }
const ingest = (statusCode: number, responseTimeMs: number, path = '/api/test') =>
  ({ method: 'GET', path, statusCode, responseTimeMs, timestamp: Date.now() })

describe('RateLimiterDO durable state', () => {
  it('keeps an exhausted limit through eviction before the cleanup alarm', async () => {
    const h = harness()
    const first = new RateLimiterDO(h.state, {})
    await h.ready()
    expect(h.alarm()).toBeNull()
    expect((await post(first, '/', check)).status).toBe(200)

    const restored = new RateLimiterDO(h.state, {})
    await h.ready()
    expect((await post(restored, '/', check)).status).toBe(429)

    h.consumeAlarm()
    await restored.alarm()
    expect(h.alarm()).toBeNull()
    const afterAlarm = new RateLimiterDO(h.state, {})
    await h.ready()
    expect((await post(afterAlarm, '/', check)).status).toBe(429)
  })

  it('writes one small entry per counted request and nothing for a blocked one', async () => {
    const h = harness()
    const limiter = new RateLimiterDO(h.state, {})
    await h.ready()
    for (const id of ['a', 'b', 'c']) {
      await post(limiter, '/', { ...check, clientId: id })
    }
    expect(h.state.storage.put.mock.calls.map((c: unknown[]) => c[0]).sort()).toEqual(['rl:a', 'rl:b', 'rl:c'])

    h.state.storage.put.mockClear()
    expect((await post(limiter, '/', { ...check, clientId: 'a' })).status).toBe(429)
    expect(h.state.storage.put).not.toHaveBeenCalled()
    expect(JSON.stringify(h.values.get('rl:a')).length).toBeLessThan(256)
  })

  it('cleans expired entries out of storage on the alarm and does not re-arm', async () => {
    vi.useFakeTimers()
    try {
      const h = harness()
      const limiter = new RateLimiterDO(h.state, {})
      await h.ready()
      await post(limiter, '/', check)
      expect(h.alarm()).not.toBeNull()
      expect(h.values.has('rl:ip')).toBe(true)

      vi.setSystemTime(Date.now() + 10 * 60_000 + 1)
      h.consumeAlarm()
      await limiter.alarm()
      expect(h.values.has('rl:ip')).toBe(false)
      expect(h.alarm()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('drops entries that expired while evicted when the object restarts', async () => {
    vi.useFakeTimers()
    try {
      const h = harness()
      const limiter = new RateLimiterDO(h.state, {})
      await h.ready()
      await post(limiter, '/', check)
      vi.setSystemTime(Date.now() + 10 * 60_000 + 1)
      new RateLimiterDO(h.state, {})
      await h.ready()
      expect(h.values.has('rl:ip')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('persists a reset and cancels the alarm when no entries remain', async () => {
    const h = harness()
    const limiter = new RateLimiterDO(h.state, {})
    await h.ready()
    await post(limiter, '/', check)
    expect((await post(limiter, '/', { action: 'reset' })).status).toBe(200)
    expect(h.alarm()).toBeNull()
    expect([...h.values.keys()].some((k) => k.startsWith('rl:'))).toBe(false)
    const restored = new RateLimiterDO(h.state, {})
    await h.ready()
    expect((await post(restored, '/', check)).status).toBe(200)
  })

  it('migrates the previous whole-map snapshot once and keeps its counters', async () => {
    const h = harness()
    const now = Date.now()
    h.values.set('rateLimits', new Map([['ip', { count: 1, windowStart: now, prevCount: 0, lastAccess: now }]]))
    const limiter = new RateLimiterDO(h.state, {})
    await h.ready()
    expect(h.values.has('rateLimits')).toBe(false)
    expect(h.values.has('rl:ip')).toBe(true)
    expect((await post(limiter, '/', check)).status).toBe(429)
  })

  it('fails open on the request whose counter cannot be stored and arms no alarm', async () => {
    const h = harness()
    const limiter = new RateLimiterDO(h.state, {})
    await h.ready()
    h.state.storage.put.mockRejectedValue(new Error('storage unavailable'))
    const failed = await post(limiter, '/', check)
    expect(failed.status).toBe(500)
    expect((await failed.json() as { allowed: boolean }).allowed).toBe(true)
    expect(h.alarm()).toBeNull()
  })
})

describe('MetricsCollectorDO durable state', () => {
  const env = (put: (key: string, value: string) => Promise<unknown> = async () => {}) =>
    ({ CACHE: { put } }) as any

  it('restores every acknowledged increment before the dashboard alarm', async () => {
    const h = harness()
    const put = vi.fn(async (_key: string, _value: string) => {})
    const collector = new MetricsCollectorDO(h.state, env(put))
    await h.ready()
    expect(h.alarm()).toBeNull()
    for (const [statusCode, ms] of [[200, 10], [500, 30]]) {
      expect((await post(collector, '/ingest', ingest(statusCode, ms))).status).toBe(200)
    }

    const restored = new MetricsCollectorDO(h.state, env(put))
    await h.ready()
    h.consumeAlarm()
    await restored.alarm()
    const snapshot = JSON.parse(put.mock.calls[0][1])
    expect(snapshot.global).toMatchObject({ totalRequests: 2, totalErrors: 1, avgResponseTime: 20 })
    expect(snapshot.endpoints['GET:/api/test']).toMatchObject({
      requestCount: 2, totalResponseTime: 40, statusCodes: { 200: 1, 500: 1 },
    })
    expect(h.alarm()).toBeNull()
  })

  it('writes only the touched endpoint, not the whole snapshot', async () => {
    const h = harness()
    const collector = new MetricsCollectorDO(h.state, env())
    await h.ready()
    for (let i = 0; i < 50; i++) await post(collector, '/ingest', ingest(200, 5, `/api/route-${i}`))
    h.state.storage.put.mockClear()

    await post(collector, '/ingest', ingest(200, 5, '/api/route-7'))
    expect(h.state.storage.put).toHaveBeenCalledTimes(1)
    expect(h.state.storage.put.mock.calls[0][0]).toBe('m:GET:/api/route-7')
    expect(JSON.stringify(h.state.storage.put.mock.calls[0][1]).length).toBeLessThan(1024)
  })

  it('migrates the previous single-value snapshot once', async () => {
    const h = harness()
    const endpoint = { requestCount: 3, errorCount: 0, totalResponseTime: 30, maxResponseTime: 12,
      recentResponseTimes: [10], statusCodes: { 200: 3 }, lastRequestAt: Date.now() }
    h.values.set('metricsState', { metrics: [['GET:/api/legacy', endpoint]], startedAt: 1234 })
    const collector = new MetricsCollectorDO(h.state, env())
    await h.ready()
    expect(h.values.has('metricsState')).toBe(false)
    expect(h.values.has('m:GET:/api/legacy')).toBe(true)
    expect(h.values.get('startedAt')).toBe(1234)
    const data = (await (await collector.fetch(new Request('https://do/metrics'))).json() as any).data
    expect(data.endpoints['GET:/api/legacy'].requestCount).toBe(3)
    expect(data.global.startedAt).toBe(1234)
  })

  it('rejects an ingest that cannot be stored and creates no idle alarm chain', async () => {
    const h = harness()
    const collector = new MetricsCollectorDO(h.state, {} as any)
    await h.ready()
    h.state.storage.put.mockRejectedValue(new Error('storage unavailable'))
    for (let i = 0; i < 3; i++) {
      expect((await post(collector, '/ingest', ingest(200, 5))).status).toBe(500)
    }
    expect(h.alarm()).toBeNull()
  })

  it('keeps durable metrics when the dashboard flush fails and does not re-arm', async () => {
    const h = harness()
    const failing = env(vi.fn().mockRejectedValue(new Error('KV unavailable')))
    const collector = new MetricsCollectorDO(h.state, failing)
    await h.ready()
    await post(collector, '/ingest', ingest(200, 5))
    h.consumeAlarm()
    await collector.alarm()
    expect(h.alarm()).toBeNull()

    const restored = new MetricsCollectorDO(h.state, failing)
    await h.ready()
    const result = await (await restored.fetch(new Request('https://do/metrics'))).json() as any
    expect(result.data.global.totalRequests).toBe(1)
  })

  it('cancels a pending flush on reset and restores an empty collector', async () => {
    const h = harness()
    const collector = new MetricsCollectorDO(h.state, {} as any)
    await h.ready()
    await post(collector, '/ingest', ingest(200, 5))
    expect(h.alarm()).not.toBeNull()
    expect((await post(collector, '/reset', {})).status).toBe(200)
    expect(h.alarm()).toBeNull()
    const restored = new MetricsCollectorDO(h.state, {} as any)
    await h.ready()
    const result = await (await restored.fetch(new Request('https://do/metrics'))).json() as any
    expect(result.data.global.totalRequests).toBe(0)
    expect(h.alarm()).toBeNull()
  })
})
