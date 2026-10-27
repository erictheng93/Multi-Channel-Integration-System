import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import type { Context } from 'hono'
import {
  getLoginIdentifier,
  getLoginAccountIdentifier,
  loginRateLimiter,
  loginAccountRateLimiter
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
  const app = new Hono()
  app.post('/login', loginRateLimiter, loginAccountRateLimiter, (c) => c.json({ ok: true }))

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
    for (let i = 0; i < 20; i++) {
      statuses.push((await attempt(env, 'victim@dacit.net', '198.51.100.9')).status)
    }
    expect(statuses.filter((s) => s === 200)).toHaveLength(5)
    expect(statuses.slice(5).every((s) => s === 429)).toBe(true)
    // The real user (office IP) is unaffected.
    expect((await attempt(env, 'victim@dacit.net', '203.0.113.45')).status).toBe(200)
  })

  it('colleagues behind one NAT do not share a bucket', async () => {
    const env = { RATE_LIMITER: fakeRateLimiterNamespace() }
    for (let i = 0; i < 5; i++) await attempt(env, 'a@dacit.net', '203.0.113.45')
    expect((await attempt(env, 'a@dacit.net', '203.0.113.45')).status).toBe(429)
    expect((await attempt(env, 'b@dacit.net', '203.0.113.45')).status).toBe(200)
  })

  it('distributed guessing across many IPs is capped by the per-account ceiling', async () => {
    const env = { RATE_LIMITER: fakeRateLimiterNamespace() }
    let allowed = 0
    for (let i = 0; i < 100; i++) {
      const res = await attempt(env, 'victim@dacit.net', `192.0.2.${i + 1}`)
      if (res.status === 200) allowed++
    }
    expect(allowed).toBe(40)
  })

  it('emails with dots are not truncated into a shared bucket', async () => {
    const env = { RATE_LIMITER: fakeRateLimiterNamespace() }
    for (let i = 0; i < 5; i++) await attempt(env, 'john.smith@x.co.uk', '203.0.113.45')
    expect((await attempt(env, 'john.smith@x.co.uk', '203.0.113.45')).status).toBe(429)
    expect((await attempt(env, 'john.doe@x.co.uk', '203.0.113.45')).status).toBe(200)
  })
})
