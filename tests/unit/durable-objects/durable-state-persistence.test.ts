import { describe, expect, it, vi } from 'vitest'
import { RateLimiterDO } from '../../../src/durable-objects/RateLimiterDO'

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
