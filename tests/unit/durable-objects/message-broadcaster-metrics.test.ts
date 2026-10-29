import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageBroadcaster } from '../../../src/durable-objects/MessageBroadcaster'

function harness() {
  let alarm: number | null = null
  let ready = Promise.resolve()
  const values = new Map<string, unknown>()
  const state = {
    blockConcurrencyWhile(fn: () => Promise<void>) { ready = fn() },
    storage: {
      async get(key: string) { return values.get(key) },
      async put(key: string, value: unknown) { values.set(key, value) },
      async delete(key: string) { values.delete(key) },
      async getAlarm() { return alarm },
      async setAlarm(value: number) { alarm = value },
    },
  }
  const roomOk = { current: true }
  const env = {
    USER_CONNECTION: { idFromName: (n: string) => n, get: () => ({ fetch: async () => Response.json({}) }) },
    CONVERSATION_ROOM: {
      idFromName: (n: string) => n,
      get: () => ({ fetch: async () => {
        if (!roomOk.current) throw new Error('room down')
        return Response.json({ deliveredCount: 1 })
      } }),
    },
  }
  const broadcaster = new MessageBroadcaster(state as never, env as never)
  const call = async (path: string, body?: unknown) => {
    const response = await broadcaster.fetch(new Request(`http://b${path}`, body ? { method: 'POST', body: JSON.stringify(body) } : undefined))
    return response.json() as Promise<Record<string, unknown>>
  }
  return { broadcaster, ready: () => ready, alarm: () => alarm, call, roomOk, values, state, env }
}

const event = { id: 'e1', type: 'new_message', data: {}, timestamp: Date.now(), priority: 'high' }
const send = (h: ReturnType<typeof harness>) => h.call('/broadcast', { event, targets: [{ type: 'conversation', targets: ['c1'] }] })
const drain = async (h: ReturnType<typeof harness>) => { for (let i = 0; i < 6 && h.alarm() !== null; i++) await h.broadcaster.alarm() }
const registerUser = (h: ReturnType<typeof harness>, id: string) => h.call('/register-connection', { type: 'user', id })

describe('MessageBroadcaster metrics', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T00:00:00Z')) })
  afterEach(() => { vi.useRealTimers() })

  it('reports no rate (null, window 0) on the first read instead of a fake number', async () => {
    const h = harness(); await h.ready()
    const m = await h.call('/metrics')
    expect(m.windowSeconds).toBe(0)
    expect(m.eventsInPerSecond).toBeNull()
    expect(m.eventsOutPerSecond).toBeNull()
    expect(m.errorRate).toBeNull()
  })

  it('computes eventsPerSecond as a delta over the window, split in/out', async () => {
    const h = harness(); await h.ready()
    await h.call('/metrics')
    vi.setSystemTime(Date.now() + 60_000)
    for (let i = 0; i < 6; i++) await send(h)
    await drain(h)
    const m = await h.call('/metrics')
    expect(m.windowSeconds).toBe(60)
    expect(m.eventsInPerSecond).toBeCloseTo(0.1, 5)
    // outbound counts deliveries: the 6 events were batched into one delivery to the room
    expect(m.eventsIn).toBe(6)
    expect(m.eventsOut).toBe(1)
    expect(m.eventsOutPerSecond).toBeCloseTo(1 / 60, 5)
    expect(m.errorRate).toBe(0)
  })

  it('uses a recent-window error rate, not since-forever', async () => {
    const h = harness(); await h.ready()
    await h.call('/metrics')
    h.roomOk.current = false
    for (let i = 0; i < 10; i++) await send(h)
    await drain(h)
    vi.setSystemTime(Date.now() + 120_000)
    const failing = await h.call('/metrics')
    expect(failing.errorRate).toBe(1)
    h.roomOk.current = true
    for (let i = 0; i < 10; i++) await send(h)
    await drain(h)
    vi.setSystemTime(Date.now() + 120_000)
    const recent = await h.call('/metrics')
    expect(recent.errorRate).toBe(0)
    expect(recent.errorRateLifetime as number).toBeGreaterThan(0)
  })

  it('does not report a rate from a reference younger than 30 seconds', async () => {
    const h = harness(); await h.ready()
    await h.call('/metrics')
    vi.setSystemTime(Date.now() + 10_000)
    expect((await h.call('/metrics')).windowSeconds).toBe(0)
  })

  it('relabels connections: registered connections plus a distinct online agent count', async () => {
    const h = harness(); await h.ready()
    await registerUser(h, 'a1')
    await registerUser(h, 'a1')
    await registerUser(h, 'a2')
    await h.call('/register-connection', { type: 'conversation', id: 'c1' })
    const m = await h.call('/metrics')
    expect(m.onlineAgents).toBe(2)
    expect(m.registeredConnections).toBe(3)
    expect(m.activeConnections).toBe(3)
    expect(m).not.toHaveProperty('performance')
  })

  it('exposes online users as a proper route', async () => {
    const h = harness(); await h.ready()
    await registerUser(h, 'a1'); await registerUser(h, 'a2')
    await h.call('/unregister-connection', { type: 'user', id: 'a1' })
    const online = await h.call('/online-users')
    expect(online.userIds).toEqual(['a2'])
    expect(online.count).toBe(1)
  })

  it('never arms an alarm from metrics reads (idle -> no alarm)', async () => {
    const h = harness(); await h.ready()
    await h.call('/metrics'); await h.call('/status'); await h.call('/online-users')
    vi.setSystemTime(Date.now() + 60_000)
    await h.call('/metrics')
    expect(h.alarm()).toBeNull()
  })

  it('keeps its reference sample across a DO restart', async () => {
    const h = harness(); await h.ready()
    await h.call('/metrics')
    vi.setSystemTime(Date.now() + 300_000)
    const revived = new MessageBroadcaster(h.state as never, h.env as never)
    const response = await revived.fetch(new Request('http://b/metrics'))
    const m = await response.json() as Record<string, unknown>
    expect(m.windowSeconds).toBe(300)
    expect(m.eventsInPerSecond).toBe(0)
  })
})
