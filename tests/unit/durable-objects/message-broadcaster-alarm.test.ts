import { describe, expect, it } from 'vitest'
import { MessageBroadcaster } from '../../../src/durable-objects/MessageBroadcaster'

function harness(roomOk: () => boolean) {
  let alarm: number | null = null
  let ready = Promise.resolve()
  const values = new Map<string, unknown>()
  let roomCalls = 0
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
  const env = {
    CONVERSATION_ROOM: {
      idFromName: (name: string) => name,
      get: () => ({ fetch: async () => {
        roomCalls++
        if (!roomOk()) throw new Error('room down')
        return Response.json({ deliveredCount: 1 })
      } }),
    },
  }
  const broadcaster = new MessageBroadcaster(state as any, env as any)
  return {
    broadcaster, ready: () => ready, alarm: () => alarm, roomCalls: () => roomCalls,
    // Cloudflare clears the alarm before invoking alarm().
    async fire() { alarm = null; await broadcaster.alarm() },
  }
}

const event = { id: 'e1', type: 'new_message', data: {}, timestamp: Date.now(), priority: 'high' }
const broadcast = (b: MessageBroadcaster) => b.fetch(new Request('http://b/broadcast', {
  method: 'POST',
  body: JSON.stringify({ event, targets: [{ type: 'conversation', targets: ['c1'] }] }),
}))

describe('MessageBroadcaster alarm chain', () => {
  it('stays idle without events and stops once the queue drains', async () => {
    const h = harness(() => true)
    await h.ready()
    expect(h.alarm()).toBeNull()
    expect((await broadcast(h.broadcaster)).status).toBe(200)
    expect(h.alarm()).not.toBeNull()
    await h.fire()
    expect(h.roomCalls()).toBe(1)
    expect(h.alarm()).toBeNull()
  })

  it('gives up after bounded retries when delivery keeps failing', async () => {
    const h = harness(() => false)
    await h.ready()
    await broadcast(h.broadcaster)
    let runs = 0
    while (h.alarm() !== null && runs < 20) { await h.fire(); runs++ }
    expect(h.alarm()).toBeNull()
    expect(runs).toBeLessThanOrEqual(4)
  })
})
