import { describe, expect, it } from 'vitest'
import { RateLimiterDO } from '../../../src/durable-objects/RateLimiterDO'

describe('RateLimiterDO alarm chain', () => {
  it('arms one cleanup alarm after activity and never re-arms while idle', async () => {
    let alarm: number | null = null
    let ready = Promise.resolve()
    const values = new Map<string, unknown>()
    const state = {
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
    const limiter = new RateLimiterDO(state as any, {})
    await ready
    expect(alarm).toBeNull()

    const check = () => limiter.fetch(new Request('http://rl/', { method: 'POST',
      body: JSON.stringify({ action: 'check', clientId: 'ip', config: { maxRequests: 5, windowMs: 60_000 } }) }))
    expect((await check()).status).toBe(200)
    await check()
    expect(alarm).not.toBeNull()
    // The counter is durable before the response, not after the alarm.
    expect(values.has('rl:ip')).toBe(true)

    alarm = null
    await limiter.alarm()
    expect(values.has('stats')).toBe(true)
    expect(alarm).toBeNull()
  })
})
