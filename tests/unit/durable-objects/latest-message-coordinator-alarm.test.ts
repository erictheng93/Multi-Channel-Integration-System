import { describe, expect, it } from 'vitest'
import { LatestMessageCacheCoordinator } from '../../../src/durable-objects/LatestMessageCacheCoordinator'

describe('LatestMessageCacheCoordinator alarm', () => {
  it('pulls a pending 60s retry alarm forward when a fresh update arrives', async () => {
    let alarm: number | null = null
    let ready = Promise.resolve()
    const values = new Map<string, unknown>()
    const state = {
      blockConcurrencyWhile(fn: () => Promise<void>) { ready = fn() },
      storage: {
        async get(key: string) { return values.get(key) },
        async put(key: string, value: unknown) { values.set(key, value) },
        async getAlarm() { return alarm },
        async setAlarm(value: number) { alarm = value },
      },
    }
    const coordinator = new LatestMessageCacheCoordinator(state as any, {} as any)
    ;(coordinator as any).processUpdate = async () => { throw new Error('update failed') }
    await ready
    const schedule = (conversationId: string) => coordinator.fetch(new Request('http://c/schedule', {
      method: 'POST', body: JSON.stringify({ conversationId }),
    }))

    await schedule('a')
    alarm = null
    await coordinator.alarm()
    expect(alarm).toBeGreaterThan(Date.now() + 30_000) // retry backoff

    await schedule('b')
    expect(alarm).toBeLessThanOrEqual(Date.now() + 5_000)
  })
})
