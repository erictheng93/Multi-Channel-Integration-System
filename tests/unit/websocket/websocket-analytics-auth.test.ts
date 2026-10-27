import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(),
  recordConnectionQuality: vi.fn()
}))

// Stand-in for jwtAuth: 401 unless the test sends x-test-auth, otherwise injects a user.
vi.mock('@/middleware/auth', () => ({
  jwtAuth: async (c: any, next: any) => {
    if (!c.req.header('x-test-auth')) return c.json({ error: 'Unauthorized' }, 401)
    c.set('user', { id: 'u-1', role: 'agent' })
    await next()
  }
}))

vi.mock('@/monitoring/websocket-analytics-service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/monitoring/websocket-analytics-service')>()
  return {
    ...actual,
    createAnalyticsService: () => ({
      recordError: mocks.recordError,
      recordConnectionQuality: mocks.recordConnectionQuality
    })
  }
})

import handler, { ANALYTICS_LIMITS } from '@modules/websocket/handlers/websocket-analytics-main'
import { WebSocketAnalyticsService } from '@/monitoring/websocket-analytics-service'

const app = new Hono()
app.route('/api/websocket/analytics', handler)

const post = (path: string, body: unknown, auth = true, raw?: string) =>
  app.request(`/api/websocket/analytics${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(auth ? { 'x-test-auth': '1' } : {}) },
    body: raw ?? JSON.stringify(body)
  }, {} as never)

const goodError = { timestamp: 1700000000000, errorCode: 1006, errorType: 'abnormal_close', message: 'm' }
const goodQuality = {
  timestamp: 1700000000000, connectionId: 'c1', latency: 40, connectionTime: 100,
  messagesPerSecond: 1, errorRate: 0.01, isStable: true
}

describe('websocket analytics write endpoints', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects unauthenticated /errors and /quality without writing', async () => {
    expect((await post('/errors', goodError, false)).status).toBe(401)
    expect((await post('/quality', goodQuality, false)).status).toBe(401)
    expect(mocks.recordError).not.toHaveBeenCalled()
    expect(mocks.recordConnectionQuality).not.toHaveBeenCalled()
  })

  it('accepts a valid authenticated error and stamps userId from the session', async () => {
    const res = await post('/errors', { ...goodError, userId: 'victim', clientIP: '1.2.3.4' })
    expect(res.status).toBe(200)
    const arg = mocks.recordError.mock.calls[0][0]
    expect(arg.userId).toBe('u-1')
    expect(arg.clientIP).toBeUndefined()
  })

  it('overrides body userId on /quality with the session user', async () => {
    const res = await post('/quality', { ...goodQuality, userId: 'victim' })
    expect(res.status).toBe(200)
    expect(mocks.recordConnectionQuality.mock.calls[0][0].userId).toBe('u-1')
  })

  it('rejects oversized fields and bodies', async () => {
    const long = 'x'.repeat(ANALYTICS_LIMITS.maxShortString + 1)
    expect((await post('/errors', { ...goodError, errorType: long })).status).toBe(400)
    expect((await post('/errors', { ...goodError, message: 'y'.repeat(ANALYTICS_LIMITS.maxMessage + 1) })).status).toBe(400)
    const big = JSON.stringify({ ...goodError, pad: 'z'.repeat(ANALYTICS_LIMITS.maxBodyBytes) })
    expect((await post('/errors', null, true, big)).status).toBe(413)
    expect((await post('/quality', null, true, big)).status).toBe(413)
    expect(mocks.recordError).not.toHaveBeenCalled()
  })

  it('rejects malformed, wrong-typed and out-of-range input', async () => {
    expect((await post('/errors', null, true, '{nope')).status).toBe(400)
    expect((await post('/errors', { ...goodError, errorCode: 'x' })).status).toBe(400)
    expect((await post('/quality', { ...goodQuality, errorRate: 5 })).status).toBe(400)
    expect((await post('/quality', { ...goodQuality, latency: -1 })).status).toBe(400)
    expect((await post('/quality', { ...goodQuality, connectionId: undefined })).status).toBe(400)
  })
})

describe('WebSocketAnalyticsService hourly array cap', () => {
  it('keeps the hourly errors[] bounded while errorCount keeps counting', async () => {
    const store = new Map<string, string>()
    const env = {
      CACHE: {
        get: async (k: string) => store.get(k) ?? null,
        put: async (k: string, v: string) => { store.set(k, v) }
      }
    }
    const svc = new WebSocketAnalyticsService(env as never)
    const total = WebSocketAnalyticsService.MAX_HOURLY_ERROR_ENTRIES + 50
    for (let i = 0; i < total; i++) {
      await (svc as any).updateHourlyStats({ timestamp: i, errorCode: 1006, errorType: 't', message: '' })
    }
    const key = [...store.keys()].find(k => k.includes('hourly'))!
    const stats = JSON.parse(store.get(key)!)
    expect(stats.errors.length).toBe(WebSocketAnalyticsService.MAX_HOURLY_ERROR_ENTRIES)
    expect(stats.errorCount).toBe(total)
    expect(stats.errors[stats.errors.length - 1].timestamp).toBe(total - 1)
  })
})
