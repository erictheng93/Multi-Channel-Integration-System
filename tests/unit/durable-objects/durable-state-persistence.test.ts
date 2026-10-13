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
    expect((await post(first, '/', check)).status).toBe(200)
    expect(h.alarm()).toBeNull() // durable immediately; no timer is needed to make it so

    const restored = new RateLimiterDO(h.state, {})
    await h.ready()
    expect((await post(restored, '/', check)).status).toBe(429)

    const evictedAgain = new RateLimiterDO(h.state, {})
    await h.ready()
    expect((await post(evictedAgain, '/', check)).status).toBe(429)
    expect(h.alarm()).toBeNull()
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

  it('arms no alarm, and a leftover alarm from an older release ends the chain', async () => {
    const h = harness()
    const limiter = new RateLimiterDO(h.state, {})
    await h.ready()
    for (let i = 0; i < 3; i++) await post(limiter, '/', { ...check, clientId: `c${i}` })
    expect(h.alarm()).toBeNull()

    await h.state.storage.setAlarm(Date.now() + 1000) // armed by the previous release
    h.consumeAlarm()
    const writes = h.state.storage.put.mock.calls.length
    await limiter.alarm()
    expect(h.alarm()).toBeNull()
    expect(h.state.storage.put.mock.calls.length).toBe(writes) // the alarm wrote nothing
  })

  it('cleans up inline when the entry count passes the cap, without a timer', async () => {
    vi.useFakeTimers()
    try {
      const h = harness()
      const limiter = new RateLimiterDO(h.state, {})
      await h.ready()
      const cap = (limiter as unknown as { MAX_ENTRIES: number }).MAX_ENTRIES
      const stale = { count: 1, windowStart: 0, prevCount: 0, lastAccess: 0 }
      for (let i = 0; i < cap + 5; i++) {
        ;(limiter as unknown as { rateLimits: Map<string, unknown> }).rateLimits.set(`old-${i}`, stale)
      }
      vi.setSystemTime(Date.now() + 10 * 60_000 + 1)
      await post(limiter, '/', check)
      const size = ((limiter as unknown as { rateLimits: Map<string, unknown> }).rateLimits).size
      expect(size).toBe(1)
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
  const env = {} as any
  const batch = (...samples: ReturnType<typeof ingest>[]) => ({ samples })
  const metricWrites = (h: ReturnType<typeof harness>) =>
    h.state.storage.put.mock.calls.filter((c: unknown[]) => c[0] === 'metricsState')

  it('restores every acknowledged increment after eviction', async () => {
    const h = harness()
    const collector = new MetricsCollectorDO(h.state, env)
    await h.ready()
    const res = await post(collector, '/ingest-batch', batch(ingest(200, 10), ingest(500, 30)))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ accepted: 2, rejected: 0 })

    const restored = new MetricsCollectorDO(h.state, env)
    await h.ready()
    const data = (await (await restored.fetch(new Request('https://do/metrics'))).json() as any).data
    expect(data.global).toMatchObject({ totalRequests: 2, totalErrors: 1, avgResponseTime: 20 })
    expect(data.endpoints['GET:/api/test']).toMatchObject({
      requestCount: 2, totalResponseTime: 40, statusCodes: { 200: 1, 500: 1 },
    })
  })

  it('costs one storage write per batch, however many samples and endpoints it holds', async () => {
    const h = harness()
    const collector = new MetricsCollectorDO(h.state, env)
    await h.ready()
    const samples = Array.from({ length: 150 }, (_, i) => ingest(200, 5, `/api/route-${i % 30}`))
    await post(collector, '/ingest-batch', batch(...samples))
    expect(h.state.storage.put).toHaveBeenCalledTimes(1)

    // The persisted value stays small: counters only, no latency samples.
    const stored = h.values.get('metricsState') as { metrics: Array<[string, { recentResponseTimes: number[] }]> }
    expect(stored.metrics).toHaveLength(30)
    expect(stored.metrics.every(([, m]) => m.recentResponseTimes.length === 0)).toBe(true)
    expect(JSON.stringify(stored).length).toBeLessThan(16 * 1024)
  })

  it('writes nothing for a batch without a valid sample', async () => {
    const h = harness()
    const collector = new MetricsCollectorDO(h.state, env)
    await h.ready()
    await post(collector, '/ingest-batch', batch({ ...ingest(200, 5), statusCode: 'x' } as any))
    expect(h.state.storage.put).not.toHaveBeenCalled()
  })

  it('arms no alarm, and a leftover alarm from an older release ends the chain', async () => {
    const h = harness()
    const collector = new MetricsCollectorDO(h.state, env)
    await h.ready()
    await post(collector, '/ingest-batch', batch(ingest(200, 5)))
    await post(collector, '/ingest', ingest(200, 5))
    expect(h.alarm()).toBeNull()

    await h.state.storage.setAlarm(Date.now() + 1000) // armed by the previous release
    h.consumeAlarm()
    await collector.alarm()
    expect(h.alarm()).toBeNull()
    expect(metricWrites(h)).toHaveLength(2) // the alarm itself wrote nothing
  })

  it('bounds one batch and rejects invalid samples without failing the batch', async () => {
    const h = harness()
    const collector = new MetricsCollectorDO(h.state, env)
    await h.ready()
    const many = Array.from({ length: 500 }, () => ingest(200, 5))
    const res = await post(collector, '/ingest-batch', batch(...many, { ...ingest(200, 5), statusCode: 'x' } as any))
    expect(await res.json()).toMatchObject({ accepted: 200 })
    expect((await post(collector, '/ingest-batch', { samples: 'nope' })).status).toBe(400)
  })

  it('drops the per-endpoint leftovers of an interim release instead of reading them', async () => {
    const h = harness()
    h.values.set('m:GET:/api/old', { requestCount: 9 })
    h.values.set('startedAt', 1)
    const collector = new MetricsCollectorDO(h.state, env)
    await h.ready()
    expect(h.values.size).toBe(0)
    const data = (await (await collector.fetch(new Request('https://do/metrics'))).json() as any).data
    expect(data.global.totalRequests).toBe(0)
  })

  it('answers 500 when a batch cannot be stored and creates no alarm', async () => {
    const h = harness()
    const collector = new MetricsCollectorDO(h.state, env)
    await h.ready()
    h.state.storage.put.mockRejectedValue(new Error('storage unavailable'))
    expect((await post(collector, '/ingest-batch', batch(ingest(200, 5)))).status).toBe(500)
    expect(h.alarm()).toBeNull()
  })

  it('reset clears persisted metrics and leaves no alarm', async () => {
    const h = harness()
    const collector = new MetricsCollectorDO(h.state, env)
    await h.ready()
    await post(collector, '/ingest-batch', batch(ingest(200, 5)))
    expect((await post(collector, '/reset', {})).status).toBe(200)
    expect(h.alarm()).toBeNull()
    const restored = new MetricsCollectorDO(h.state, env)
    await h.ready()
    const result = await (await restored.fetch(new Request('https://do/metrics'))).json() as any
    expect(result.data.global.totalRequests).toBe(0)
  })
})
