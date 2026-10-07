import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const deliver = vi.fn()
vi.mock('../../../src/modules/conversations/services/message-delivery-service', () => ({
  MessageDeliveryService: class { deliver = deliver },
}))

import { DelayedMessageScheduler } from '../../../src/durable-objects/DelayedMessageScheduler'

function harness(extra: Array<[string, unknown]> = []) {
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
      async get(key: string) { return values.get(key) },
      async put(key: string, value: unknown) { values.set(key, value) },
      async delete(key: string | string[]) { for (const k of [key].flat()) values.delete(k) },
      async list({ prefix }: { prefix: string }) {
        return new Map([...values].filter(([k]) => k.startsWith(prefix)))
      },
      async getAlarm() { return alarm },
      async setAlarm(value: number) { alarm = value },
      async deleteAlarm() { alarm = null },
    },
  }
  const scheduler = new DelayedMessageScheduler(state as any, {} as any)
  return {
    ready: () => ready, alarm: () => alarm, values,
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
})
