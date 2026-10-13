import { expect, it } from 'vitest'
import { LatestMessageCache } from '../../../src/services/latest-message-cache'
import { LatestMessageCacheCoordinator } from '../../../src/durable-objects/LatestMessageCacheCoordinator'

function storageState(initial: Record<string, unknown> = {}) {
  const values = new Map(Object.entries(initial))
  let ready = Promise.resolve()
  let writes = 0
  let alarm: number | null = null
  const state = {
    blockConcurrencyWhile(fn: () => Promise<void>) { ready = fn() },
    storage: {
      async get(key: string) { return values.get(key) },
      async put(key: string, value: unknown) { writes++; values.set(key, value) },
      async delete(key: string | string[]) { for (const k of [key].flat()) values.delete(k) },
      async list({ prefix }: { prefix: string }) {
        return new Map([...values].filter(([k]) => k.startsWith(prefix)))
      },
      async getAlarm() { return alarm },
      async setAlarm(value: number) { alarm = value },
      async deleteAlarm() { alarm = null },
      async deleteAll() { values.clear(); alarm = null },
    },
  }
  return { state: state as any, ready: () => ready, writes: () => writes, values,
    alarm: () => alarm, consumeAlarm() { alarm = null } }
}

it('coordinator alarm populates KV and the next latest-message read avoids D1 and rescheduling', async () => {
  const state = storageState()
  const kv = new Map<string, string>()
  let queries = 0
  let schedules = 0
  const row = { conversationId: 'conversation-a', messageId: 'message-a', content: 'latest',
    createdAt: '2026-01-01T00:00:00Z', senderType: 'customer', messageType: 'text' }
  let coordinator: LatestMessageCacheCoordinator
  const env = {
    CACHE: {
      async get(key: string) { const value = kv.get(key); return value ? JSON.parse(value) : null },
      async put(key: string, value: string) { kv.set(key, value) },
      async delete(key: string) { kv.delete(key) },
    },
    DB: { prepare: () => {
      const statement = {
        bind: () => statement,
        async all() { queries++; return { results: [row], success: true, meta: {} } },
      }
      return statement
    } },
    LATEST_MESSAGE_COORDINATOR: {
      idFromName: () => 'global',
      get: () => ({ fetch: async (url: string, init: RequestInit) => {
        schedules++
        return coordinator.fetch(new Request(url, init))
      } }),
    },
  }
  coordinator = new LatestMessageCacheCoordinator(state.state, env as any)
  await state.ready()
  await coordinator.fetch(new Request('http://coordinator/schedule', {
    method: 'POST', body: JSON.stringify({ conversationId: 'conversation-a' }),
  }))
  await coordinator.alarm()
  expect(JSON.parse(kv.get('latest_msg:conversation-a') ?? 'null')?.messageId).toBe('message-a')
  const latest = await new LatestMessageCache(env as any).getLatestMessage('conversation-a')
  expect(latest?.content).toBe('latest')
  expect(queries).toBe(1)
  expect(schedules).toBe(0)
  const status = await (await coordinator.fetch(new Request('http://coordinator/status'))).json() as any
  expect(status.queueSize).toBe(0)
})
