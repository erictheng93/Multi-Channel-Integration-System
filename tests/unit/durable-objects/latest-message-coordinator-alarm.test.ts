import { describe, expect, it } from 'vitest'
import { LatestMessageCacheCoordinator } from '../../../src/durable-objects/LatestMessageCacheCoordinator'

async function setup(processUpdate?: () => Promise<void>) {
  let alarm: number | null = null
  let setAlarmCalls = 0
  let ready = Promise.resolve()
  const values = new Map<string, unknown>()
  const state = {
    blockConcurrencyWhile(fn: () => Promise<void>) { ready = fn() },
    storage: {
      async get(key: string) { return values.get(key) },
      async put(key: string, value: unknown) { values.set(key, value) },
      async getAlarm() { return alarm },
      async setAlarm(value: number) { setAlarmCalls++; alarm = value },
    },
  }
  const coordinator = new LatestMessageCacheCoordinator(state as any, {} as any)
  if (processUpdate) (coordinator as any).processUpdate = processUpdate
  await ready
  const schedule = (conversationId: string) => coordinator.fetch(new Request('http://c/schedule', {
    method: 'POST', body: JSON.stringify({ conversationId }),
  }))
  // The platform consumes the alarm that fired before calling alarm().
  const fire = async () => { alarm = null; await coordinator.alarm() }
  return { coordinator, schedule, fire, alarm: () => alarm, setAlarmCalls: () => setAlarmCalls }
}

describe('LatestMessageCacheCoordinator alarm', () => {
  it('idle: construction and an empty alarm arm nothing', async () => {
    const t = await setup()
    expect(t.alarm()).toBeNull()
    await t.fire()
    expect(t.alarm()).toBeNull()
    expect(t.setAlarmCalls()).toBe(0)
  })

  it('drained: a successful batch does not re-arm', async () => {
    const t = await setup(async () => {})
    await t.schedule('a')
    await t.fire()
    expect(t.alarm()).toBeNull()
    expect(t.setAlarmCalls()).toBe(1)
  })

  it('persistent failure: the entry is dropped and the chain stops after 3 attempts', async () => {
    let attempts = 0
    const t = await setup(async () => { attempts++; throw new Error('update failed') })
    await t.schedule('a')
    for (let i = 0; i < 5 && t.alarm() !== null; i++) await t.fire()
    expect(attempts).toBe(3)
    expect(t.alarm()).toBeNull()
  })

  it('pulls a pending 60s retry alarm forward when a fresh update arrives', async () => {
    const t = await setup(async () => { throw new Error('update failed') })
    await t.schedule('a')
    await t.fire()
    expect(t.alarm()).toBeGreaterThan(Date.now() + 30_000) // retry backoff

    await t.schedule('b')
    expect(t.alarm()).toBeLessThanOrEqual(Date.now() + 5_000)
  })
})
