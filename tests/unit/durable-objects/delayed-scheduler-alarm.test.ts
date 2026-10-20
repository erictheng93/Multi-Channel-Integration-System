import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const deliver = vi.fn()
vi.mock('../../../src/modules/conversations/services/message-delivery-service', () => ({
  MessageDeliveryService: class { deliver = deliver },
}))

import { DelayedMessageScheduler } from '../../../src/durable-objects/DelayedMessageScheduler'

function harness(extra: Array<[string, unknown]> = [], failDlq = false) {
  let alarm: number | null = null
  let ready = Promise.resolve()
  const values = new Map<string, unknown>([['msg:m1', {
    id: 'm1', conversationId: 'c1', mode: 'deliver-by-ref', status: 'pending',
    scheduledAt: Date.now() - 1, createdAt: Date.now(),
  }], ...extra])
  const state = {
    id: { toString: () => 'do-1' },
    blockConcurrencyWhile(fn: () => Promise<void>) { ready = fn() },
    storage: {
      async get(key: string) { return structuredClone(values.get(key)) },
      async put(key: string, value: unknown) {
        if (failDlq && key.startsWith('dlq:')) throw new Error('DLQ storage unavailable')
        values.set(key, structuredClone(value))
      },
      async delete(key: string | string[]) { for (const k of [key].flat()) values.delete(k) },
      async list({ prefix }: { prefix: string }) {
        return structuredClone(new Map([...values].filter(([k]) => k.startsWith(prefix))))
      },
      async getAlarm() { return alarm },
      async setAlarm(value: number) { alarm = value },
      async deleteAlarm() { alarm = null },
    },
  }
  const scheduler = new DelayedMessageScheduler(state as any, {} as any)
  return {
    ready: () => ready, alarm: () => alarm, values, scheduler,
    async restart() {
      new DelayedMessageScheduler(state as any, {} as any)
      await ready
    },
    async fire() {
      if (alarm !== null) vi.setSystemTime(Math.max(Date.now(), alarm))
      alarm = null
      await scheduler.alarm()
    },
  }
}

describe('DelayedMessageScheduler alarm chain', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })

  it('re-arms a failed deliver-by-ref with backoff and stops after bounded retries', async () => {
    deliver.mockRejectedValue(new Error('infra down'))
    const h = harness()
    await h.ready()
    await h.fire()
    // Not stalled (alarm re-armed) and not hot-looping (alarm is in the future).
    expect(h.alarm()).toBeGreaterThan(Date.now() + 1000)
    let runs = 1
    while (h.alarm() !== null && runs < 10) { await h.fire(); runs++ }
    expect(h.alarm()).toBeNull()
    expect(runs).toBe(4)
    expect(h.values.has('msg:m1')).toBe(false)
    expect(h.values.has('dlq:m1')).toBe(true)
  })

  it('stops once the message is delivered', async () => {
    deliver.mockResolvedValue(undefined)
    const h = harness()
    await h.ready()
    await h.fire()
    expect(h.alarm()).toBeNull()
    expect(h.values.has('msg:m1')).toBe(false)
  })

  it('retains the failed message when every DLQ write fails and stops retrying', async () => {
    vi.useFakeTimers()
    deliver.mockRejectedValue(new Error('infra down'))
    const h = harness([], true)
    await h.ready()
    let runs = 0
    do {
      const firing = h.fire()
      await vi.runAllTimersAsync()
      await firing
      runs++
    } while (h.alarm() !== null && runs < 10)
    expect(runs).toBe(4)
    expect(h.alarm()).toBeNull()
    expect(h.values.has('dlq:m1')).toBe(false)
    expect(h.values.get('msg:m1')).toMatchObject({ status: 'failed', retryCount: 4 })
    await h.restart()
    expect(h.values.get('msg:m1')).toMatchObject({ status: 'failed' })
    expect(h.alarm()).toBeNull()
    // The fallback record stays discoverable: operators see it through /dlq.
    const listed = await (await h.scheduler.fetch(new Request('https://do/dlq'))).json() as { count: number; messages: Array<{ id: string }> }
    expect(listed.messages.map((m) => m.id)).toEqual(['m1'])
    vi.restoreAllMocks()
  })

  it('drops failed copies already in the DLQ and expired DLQ entries on cold start', async () => {
    const day = 86_400_000
    const h = harness([
      ['msg:f1', { id: 'f1', status: 'failed' }],
      ['dlq:f1', { id: 'f1', failedAt: Date.now() }],
      ['msg:f2', { id: 'f2', status: 'failed' }], // DLQ write failed: keep as the only record
      ['dlq:old', { id: 'old', failedAt: Date.now() - 31 * day }],
    ])
    await h.ready()
    expect(h.values.has('msg:f1')).toBe(false)
    expect(h.values.has('dlq:f1')).toBe(true)
    expect(h.values.has('msg:f2')).toBe(true)
    expect(h.values.has('dlq:old')).toBe(false)
    expect(h.values.has('msg:m1')).toBe(true)
  })

  describe('cancel ownership (requireAgentId)', () => {
    const post = (path: string, body: unknown) =>
      new Request(`https://do${path}`, { method: 'POST', body: JSON.stringify(body) })
    const pendingFor = (agentId: string) => ['msg:own', {
      id: 'own', conversationId: 'c1', agentId, content: 'hi', messageType: 'text', platform: 'line',
      recipientPlatformId: 'U1', status: 'pending', scheduledAt: Date.now() + 60_000, createdAt: Date.now(),
    }] as [string, unknown]

    async function cancel(h: ReturnType<typeof harness>, requireAgentId: string, messageId = 'own') {
      const doo = (h as any).scheduler
      return doo.fetch(post('/cancel', { messageId, requireAgentId }))
    }

    it('lets the scheduling agent cancel, rejects another agent, and rejects an unknown id', async () => {
      const h = harness([pendingFor('7')])
      await h.ready()
      expect((await cancel(h, '8')).status).toBe(403)
      expect((await cancel(h, '7', 'missing')).status).toBe(403)
      expect((await cancel(h, '7')).status).toBe(200)
    })
  })
})
