import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('@/modules/integrations/services/webhook-media-service', () => ({ processLineMedia: vi.fn() }))
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(function () {
    return { broadcastMessageEvent: vi.fn() }
  }),
}))

import { getSystemHealth } from '../../../../src/modules/system/handlers/health-main'
import { healthCheckService } from '../../../../src/services/health-check-service'
import {
  R2HealthChecker,
  DurableObjectHealthChecker,
  QueueHealthChecker,
} from '../../../../src/health-checkers/infrastructure-checkers'
import { LineMessageQueueConsumer } from '../../../../src/modules/queue/handlers/line-message-queue'

const queueSend = vi.fn().mockResolvedValue(undefined)
const doFetch = vi.fn().mockResolvedValue(new Response('{}'))
const r2Head = vi.fn().mockResolvedValue(null)
const kv = new Map<string, string>()

const env = {
  JWT_SECRET: 'x'.repeat(32),
  LINE_CHANNEL_ACCESS_TOKEN: 'line-token',
  DB: { prepare: () => ({ first: async () => ({ test: 1 }) }) },
  CACHE: {
    get: async (k: string) => kv.get(k) ?? null,
    put: async (k: string, v: string) => { kv.set(k, v) },
    delete: async (k: string) => { kv.delete(k) },
  },
  R2_BUCKET: { head: r2Head },
  MESSAGE_BROADCASTER: { idFromName: () => 'id', get: () => ({ fetch: doFetch }) },
  LINE_MESSAGE_QUEUE: { send: queueSend },
} as never

function appFor(role: string) {
  const app = new Hono()
  app.use('*', async (c, next) => { c.set('user' as never, { role } as never); await next() })
  app.get('/system', getSystemHealth as never)
  return app
}

afterEach(() => vi.unstubAllGlobals())

describe('H1: /health/system', () => {
  it('reports R2, Durable Object and Queue with measured latency and no fake zero metrics', async () => {
    const res = await appFor('agent').request('/system', {}, env)
    const body = await res.json() as { data: any }
    const names = body.data.components.map((c: any) => c.component)
    expect(names).toEqual(expect.arrayContaining(['database', 'cache', 'r2', 'durable_object', 'queue']))
    expect(body.data.infrastructure.r2.status).toBe('healthy')
    expect(body.data.infrastructure.durableObject.status).toBe('healthy')
    expect(body.data.infrastructure.queue.status).toBe('healthy')
    expect(queueSend).toHaveBeenCalledWith(expect.objectContaining({ type: 'health_probe' }))
    expect(doFetch).toHaveBeenCalled()
    // cacheHitRate has no source: omitted, not 0
    expect(body.data.performance).not.toHaveProperty('cacheHitRate')
    expect(typeof body.data.performance.databaseQueryTime).toBe('number')
    // D1 wording: nothing invented
    const db = body.data.components.find((c: any) => c.component === 'database')
    expect(db.status.details).not.toHaveProperty('connectionPool')
    // deep block only on request
    expect(body.data).not.toHaveProperty('deep')
  })

  it('deep=1 is admin-only and never runs the LINE webhook test for agents', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    const res = await appFor('agent').request('/system?deep=1', {}, env)
    expect(res.status).toBe(403)
    expect(f).not.toHaveBeenCalled()
  })

  it('deep=1 for admin runs a timed LINE webhook test and reports LINE result', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true, timestamp: '2026-10-29T00:00:00Z', statusCode: 200, reason: 'OK', detail: '200',
    })))
    vi.stubGlobal('fetch', f)
    const res = await appFor('admin').request('/system?deep=1', {}, env)
    const body = await res.json() as { data: any }
    expect(f).toHaveBeenCalledTimes(1)
    expect(f.mock.calls[0][0]).toBe('https://api.line.me/v2/bot/channel/webhook/test')
    expect((f.mock.calls[0][1] as RequestInit).method).toBe('POST')
    expect(body.data.deep.lineWebhook).toMatchObject({ status: 'success', statusCode: 200 })
    expect(typeof body.data.deep.lineWebhook.latencyMs).toBe('number')
  })

  it('deep=1 reports a failed LINE webhook test as failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false, statusCode: 502, reason: 'COULD_NOT_CONNECT', detail: 'x',
    }))))
    const res = await appFor('admin').request('/system?deep=1', {}, env)
    const body = await res.json() as { data: any }
    expect(body.data.deep.lineWebhook.status).toBe('failure')
    expect(body.data.deep.lineWebhook.reason).toBe('COULD_NOT_CONNECT')
  })
})

describe('H1: infrastructure checkers', () => {
  it('are never self-scheduled', () => {
    for (const c of [new R2HealthChecker(undefined), new DurableObjectHealthChecker(undefined), new QueueHealthChecker(undefined)]) {
      expect(c.getConfig().enabled).toBe(false)
    }
  })

  it('missing bindings are unknown, failures are critical', async () => {
    expect((await new R2HealthChecker(undefined).check()).status).toBe('unknown')
    const bad = new R2HealthChecker({ head: async () => { throw new Error('boom') } } as never)
    expect((await bad.check()).status).toBe('critical')
    const badDo = new DurableObjectHealthChecker({
      idFromName: () => 'i',
      get: () => ({ fetch: async () => new Response('x', { status: 500 }) }),
    } as never)
    expect((await badDo.check()).status).toBe('critical')
  })

  it('the DO check only calls the read-only /health route', async () => {
    const calls: string[] = []
    const checker = new DurableObjectHealthChecker({
      idFromName: () => 'i',
      get: () => ({ fetch: async (u: string) => { calls.push(u); return new Response('{}') } }),
    } as never)
    await checker.check()
    expect(calls).toEqual(['https://do.internal/health'])
  })

  it('healthCheckService is still a singleton instance', () => {
    expect(healthCheckService).toBeDefined()
  })
})

describe('H1: queue consumer ignores health_probe', () => {
  it('acks without processing or retrying', async () => {
    const ack = vi.fn()
    const retry = vi.fn()
    const consumer = new LineMessageQueueConsumer({ DB: {} } as never)
    await consumer.processBatch({
      messages: [{ body: { type: 'health_probe', enqueuedAt: 1 }, ack, retry }],
    } as never)
    expect(ack).toHaveBeenCalledTimes(1)
    expect(retry).not.toHaveBeenCalled()
  })
})
