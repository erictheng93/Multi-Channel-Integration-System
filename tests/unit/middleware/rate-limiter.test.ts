import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import type { Context } from 'hono'
import {
  getLoginIdentifier,
  getLoginAccountIdentifier,
  loginRateLimiter,
  loginAccountCeiling,
  rememberLoginIp,
  RATE_LIMIT_PRESETS
} from '@/middleware/rate-limiter'

/**
 * Build a minimal Hono-like Context for identifier unit tests.
 * Only the surface that getLoginIdentifier touches is implemented:
 * req.json() (login body) and req.header() (IP fallback).
 */
function mockContext(
  body: unknown,
  headers: Record<string, string> = {},
  jsonThrows = false
): Context {
  return {
    req: {
      json: async () => {
        if (jsonThrows) {
          throw new Error('invalid json')
        }
        return body
      },
      header: (name: string) => headers[name]
    }
  } as unknown as Context
}

describe('getLoginIdentifier', () => {
  it('keys by account email so colleagues behind one office IP get separate buckets', async () => {
    const sharedIp = { 'CF-Connecting-IP': '203.0.113.45' }

    const seanKey = await getLoginIdentifier(mockContext({ email: 'sean@dacit.net' }, sharedIp))
    const oliviaKey = await getLoginIdentifier(mockContext({ email: 'olivia@dacit.net' }, sharedIp))

    // Same office IP, different accounts -> different rate-limit buckets.
    expect(seanKey).not.toBe(oliviaKey)
    expect(seanKey).toBe('account:sean@dacit.net|ip:203.0.113.45')
    expect(oliviaKey).toBe('account:olivia@dacit.net|ip:203.0.113.45')
  })

  it('normalizes email (trim + lowercase) so case/whitespace cannot split or bypass the bucket', async () => {
    const key = await getLoginIdentifier(mockContext({ email: '  Sean@DACIT.net  ' }))
    expect(key).toBe('account:sean@dacit.net|ip:unknown')
  })

  it('falls back to client IP when no email is present in the body', async () => {
    const key = await getLoginIdentifier(mockContext({}, { 'CF-Connecting-IP': '198.51.100.7' }))
    expect(key).toBe('198.51.100.7')
  })

  it('falls back to client IP when the request body is not valid JSON', async () => {
    const key = await getLoginIdentifier(
      mockContext(null, { 'CF-Connecting-IP': '198.51.100.7' }, true)
    )
    expect(key).toBe('198.51.100.7')
  })
})

describe('getLoginAccountIdentifier', () => {
  it('is the same for one email regardless of source IP', async () => {
    const a = await getLoginAccountIdentifier(mockContext({ email: 'Sean@dacit.net' }, { 'CF-Connecting-IP': '1.1.1.1' }))
    const b = await getLoginAccountIdentifier(mockContext({ email: 'sean@dacit.net' }, { 'CF-Connecting-IP': '2.2.2.2' }))
    expect(a).toBe('account:sean@dacit.net')
    expect(b).toBe(a)
  })
})

/**
 * Minimal in-memory RATE_LIMITER namespace: one counter per DO name + clientId,
 * mirroring the DO's check contract.
 */
function fakeRateLimiterNamespace() {
  const counts = new Map<string, number>()
  return {
    idFromName: (name: string) => name,
    get: (name: string) => ({
      fetch: async (_url: string, init: { body: string }) => {
        const { clientId, config } = JSON.parse(init.body) as {
          clientId: string
          config: { maxRequests: number }
        }
        const key = `${name}::${clientId}`
        const n = (counts.get(key) ?? 0) + 1
        counts.set(key, n)
        return new Response(
          JSON.stringify({
            allowed: n <= config.maxRequests,
            limit: config.maxRequests,
            remaining: Math.max(0, config.maxRequests - n),
            reset: Date.now() + 1000,
            retryAfter: 1
          })
        )
      }
    })
  }
}

describe('login rate limiting chain (lockout resistance)', () => {
  const TIGHT = RATE_LIMIT_PRESETS.login.maxRequests
  const CEILING = RATE_LIMIT_PRESETS.loginAccount.maxRequests

  it('uses the agreed limits: 15 per 5 min per email+IP, 300 per 15 min per email', () => {
    expect(RATE_LIMIT_PRESETS.login).toEqual({ maxRequests: 15, windowMs: 5 * 60 * 1000 })
    expect(RATE_LIMIT_PRESETS.loginAccount).toEqual({ maxRequests: 300, windowMs: 15 * 60 * 1000 })
  })

  const app = new Hono()
  app.post('/login', loginRateLimiter, loginAccountCeiling, (c) => c.json({ ok: true }))

  const attempt = (env: unknown, email: string, ip: string) =>
    app.request(
      '/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
        body: JSON.stringify({ email, password: 'x' })
      },
      env as never
    )

  it('an attacker spamming a victim email cannot lock the victim out from another IP', async () => {
    const env = { RATE_LIMITER: fakeRateLimiterNamespace() }
    const statuses: number[] = []
    for (let i = 0; i < TIGHT + 15; i++) {
      statuses.push((await attempt(env, 'victim@dacit.net', '198.51.100.9')).status)
    }
    expect(statuses.filter((s) => s === 200)).toHaveLength(TIGHT)
    expect(statuses.slice(TIGHT).every((s) => s === 429)).toBe(true)
    // The real user (office IP) is unaffected.
    expect((await attempt(env, 'victim@dacit.net', '203.0.113.45')).status).toBe(200)
  })

  it('colleagues behind one NAT do not share a bucket', async () => {
    const env = { RATE_LIMITER: fakeRateLimiterNamespace() }
    for (let i = 0; i < TIGHT; i++) await attempt(env, 'a@dacit.net', '203.0.113.45')
    expect((await attempt(env, 'a@dacit.net', '203.0.113.45')).status).toBe(429)
    expect((await attempt(env, 'b@dacit.net', '203.0.113.45')).status).toBe(200)
  })

  it('distributed guessing across many IPs is capped by the per-account ceiling', async () => {
    const env = { RATE_LIMITER: fakeRateLimiterNamespace() }
    let allowed = 0
    for (let i = 0; i < CEILING + 50; i++) {
      const res = await attempt(env, 'victim@dacit.net', `192.0.2.${i + 1}`)
      if (res.status === 200) allowed++
    }
    expect(allowed).toBe(CEILING)
  })

  it('emails with dots are not truncated into a shared bucket', async () => {
    const env = { RATE_LIMITER: fakeRateLimiterNamespace() }
    for (let i = 0; i < TIGHT; i++) await attempt(env, 'john.smith@x.co.uk', '203.0.113.45')
    expect((await attempt(env, 'john.smith@x.co.uk', '203.0.113.45')).status).toBe(429)
    expect((await attempt(env, 'john.doe@x.co.uk', '203.0.113.45')).status).toBe(200)
  })

  function fakeKv() {
    const store = new Map<string, string>()
    return { store, get: async (k: string) => store.get(k) ?? null, put: async (k: string, v: string) => { store.set(k, v) } }
  }

  async function tripCeiling(env: unknown) {
    for (let i = 0; i < CEILING; i++) await attempt(env, 'victim@dacit.net', `192.0.2.${i % 250}.${Math.floor(i / 250)}`)
  }

  it('an IP that logged in before keeps getting in after the ceiling is tripped', async () => {
    const CACHE = fakeKv()
    const env = { RATE_LIMITER: fakeRateLimiterNamespace(), CACHE }
    const known = new Hono<{ Bindings: { CACHE: typeof CACHE } }>()
    known.post('/ok', async (c) => { await rememberLoginIp(c as never, ' Victim@Dacit.net '); return c.json({ ok: true }) })
    await known.request('/ok', { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.45' } }, env as never)

    await tripCeiling(env)
    expect((await attempt(env, 'victim@dacit.net', '198.51.100.200')).status).toBe(429)
    expect((await attempt(env, 'victim@dacit.net', '203.0.113.45')).status).toBe(200)
  })

  it('a forged X-Forwarded-For cannot claim a known IP', async () => {
    const CACHE = fakeKv()
    CACHE.store.set('login-known-ip:victim@dacit.net|203.0.113.45', '1')
    const env = { RATE_LIMITER: fakeRateLimiterNamespace(), CACHE }
    await tripCeiling(env)
    const res = await app.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.45' },
      body: JSON.stringify({ email: 'victim@dacit.net', password: 'x' })
    }, env as never)
    expect(res.status).toBe(429)
  })
})
