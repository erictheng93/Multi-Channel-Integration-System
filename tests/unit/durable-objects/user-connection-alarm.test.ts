import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  getUserById: async (_db: unknown, _id: string): Promise<{ role: string }> => ({ role: 'agent' }),
  hasAccess: async (_conversationId: string): Promise<boolean> => true
}))

vi.mock('@/utils/auth', () => ({
  verifyJWT: vi.fn(),
  UserNotFoundError: class UserNotFoundError extends Error {},
  getUserById: (db: unknown, id: string) => authMock.getUserById(db, id)
}))

vi.mock('@/services/websocket-auth-service', () => ({
  WebSocketAuthService: class {
    async hasLiveConversationAccess(_u: string, conversationId: string): Promise<boolean> { return authMock.hasAccess(conversationId) }
  }
}))

import { UserConnection } from '@/durable-objects/UserConnection'

const T0 = 1_800_000_000_000

function socket(id: string, tokenExp?: number) {
  const attachment = {
    connectionId: id, userId: 'user-1', role: 'agent', deviceId: `d-${id}`,
    connectedAt: T0, lastActivity: T0, tokenExp
  }
  return {
    send: vi.fn(), close: vi.fn(), accept: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    serializeAttachment: vi.fn(),
    deserializeAttachment: vi.fn(() => attachment),
    readyState: 1
  }
}

function harness(sockets: ReturnType<typeof socket>[], initialAlarm: number | null = null, seed: Record<string, unknown> = {}) {
  let alarm = initialAlarm
  const values = new Map<string, unknown>(Object.entries(seed))
  const setAlarm = vi.fn(async (v: number) => { alarm = v })
  const deleteAlarm = vi.fn(async () => { alarm = null })
  const getAlarm = vi.fn(async () => alarm)
  const state = {
    acceptWebSocket: vi.fn(),
    getWebSockets: vi.fn(() => sockets),
    setWebSocketAutoResponse: vi.fn(),
    storage: {
      get: vi.fn(async (k: string) => values.get(k)),
      put: vi.fn(async (k: string, v: unknown) => { values.set(k, v) }),
      delete: vi.fn(async (k: string | string[]) => { for (const x of [k].flat()) values.delete(x) }),
      list: vi.fn(async () => new Map()),
      getAlarm, setAlarm, deleteAlarm
    }
  } as unknown as DurableObjectState
  const instance = new UserConnection(state, { userId: 'user-1', DB: {} } as never)
  return {
    instance, setAlarm, deleteAlarm, getAlarm, values,
    alarm: () => alarm,
    /** The platform clears the alarm when it fires. */
    async fire() {
      const at = alarm as number
      alarm = null
      vi.setSystemTime(Math.max(Date.now(), at))
      await instance.alarm()
    },
    schedule: () => (instance as unknown as { scheduleNextTokenExpiryAlarm(): Promise<void> })
      .scheduleNextTokenExpiryAlarm()
  }
}

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

describe('UserConnection alarm chain', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(T0)
    Object.defineProperty(globalThis, 'WebSocket', { value: { OPEN: 1 }, configurable: true })
    Object.defineProperty(globalThis, 'WebSocketRequestResponsePair', {
      value: class { constructor(public a: string, public b: string) {} },
      configurable: true
    })
    authMock.getUserById = async () => ({ role: 'agent' })
    authMock.hasAccess = async () => true
  })
  afterEach(() => { vi.useRealTimers() })

  it('idle cold start performs no alarm write', async () => {
    const h = harness([])
    await settle()
    expect(h.getAlarm).toHaveBeenCalled()
    expect(h.setAlarm).not.toHaveBeenCalled()
    expect(h.deleteAlarm).not.toHaveBeenCalled()
  })

  it('an unchanged deadline performs no setAlarm', async () => {
    const h = harness([socket('c1', T0 / 1000 + 3600)])
    await settle()
    expect(h.setAlarm).toHaveBeenCalledTimes(1)
    for (let i = 0; i < 4; i++) await h.schedule()
    expect(h.setAlarm).toHaveBeenCalledTimes(1)
    // Earliest deadline is the 5 min access revalidation, not the 1h token expiry.
    expect(h.alarm()).toBe(T0 + 300000)
  })

  it('cold start that finds the same alarm already armed does not rewrite it', async () => {
    const h = harness([socket('c1', T0 / 1000 + 3600)], T0 + 300000)
    await settle()
    // accessCheckDeadline is derived fresh (now + 5 min) and equals the stored alarm here.
    expect(h.setAlarm).not.toHaveBeenCalled()
  })

  it('drained: the last connection leaving deletes the alarm once, then no writes', async () => {
    const sockets = [socket('c1', T0 / 1000 + 3600)]
    const h = harness(sockets)
    await settle()
    expect(h.alarm()).not.toBeNull()
    sockets.length = 0
    ;(h.instance as unknown as { restoreConnectionsFromHibernation(): void }).restoreConnectionsFromHibernation()
    const state = (h.instance as unknown as { stateManager: { getAllConnections(): { connectionId: string }[] } }).stateManager
    for (const c of state.getAllConnections()) {
      await (h.instance as unknown as { removeConnection(id: string): Promise<void> }).removeConnection(c.connectionId)
    }
    await h.schedule()
    expect(h.alarm()).toBeNull()
    expect(h.deleteAlarm).toHaveBeenCalledTimes(1)
    await h.schedule()
    await h.schedule()
    expect(h.deleteAlarm).toHaveBeenCalledTimes(1)
  })

  it('an expired token does not hot-loop: it is armed once, then alarm() closes it and the chain stops', async () => {
    const expired = socket('c1', T0 / 1000 - 10)
    const h = harness([expired])
    await settle()
    expect(h.setAlarm).toHaveBeenCalledTimes(1)
    expect(h.alarm()).toBe(T0)
    // Calls while the expired deadline is pending must not rewrite it.
    vi.setSystemTime(T0 + 50)
    await h.schedule()
    await h.schedule()
    expect(h.setAlarm).toHaveBeenCalledTimes(1)

    await h.fire()
    expect(expired.close).toHaveBeenCalledWith(4401, 'Token expired')
    expect(h.alarm()).toBeNull()
    expect(h.setAlarm).toHaveBeenCalledTimes(1)
  })

  it('persistent D1 outage backs off to the 5 min cadence and never re-arms short; success resets', async () => {
    authMock.getUserById = async () => { throw new Error('D1 down') }
    const h = harness([socket('c1', T0 / 1000 + 86400)])
    await settle()
    expect(h.alarm()).toBe(T0 + 300000)

    const gaps: number[] = []
    for (let i = 0; i < 8; i++) {
      await h.fire() // revalidation fires at the access deadline and defers
      gaps.push((h.alarm() as number) - Date.now())
    }
    expect(gaps).toEqual([30000, 60000, 120000, 240000, 300000, 300000, 300000, 300000])

    authMock.getUserById = async () => ({ role: 'agent' })
    await h.fire()
    expect((h.alarm() as number) - Date.now()).toBe(300000)

    authMock.getUserById = async () => { throw new Error('D1 down') }
    await h.fire()
    expect((h.alarm() as number) - Date.now()).toBe(30000)
  })

  it('the outage backoff survives reconstruction of the object between wakes', async () => {
    authMock.getUserById = async () => { throw new Error('D1 down') }
    let h = harness([socket('c1', T0 / 1000 + 86400)])
    await settle()

    const gaps: number[] = []
    for (let i = 0; i < 7; i++) {
      await h.fire()
      gaps.push((h.alarm() as number) - Date.now())
      // Evicted: a new instance is built from storage only, as on a real alarm wake.
      h = harness([socket('c1', T0 / 1000 + 86400)], h.alarm(), Object.fromEntries(h.values))
      await settle()
    }
    expect(gaps).toEqual([30000, 60000, 120000, 240000, 300000, 300000, 300000])

    // Success clears the persisted counter; the next outage starts from 30s again.
    authMock.getUserById = async () => ({ role: 'agent' })
    await h.fire()
    expect(h.values.has('accessCheckFailures')).toBe(false)
    authMock.getUserById = async () => { throw new Error('D1 down') }
    await h.fire()
    expect((h.alarm() as number) - Date.now()).toBe(30000)
  })

  describe('access revalidation writes', () => {
    const subscriptionPuts = (h: ReturnType<typeof harness>) =>
      (h.instance as unknown as { state: { storage: { put: ReturnType<typeof vi.fn> } } }).state.storage.put.mock.calls
        .filter(([key]) => key === 'subscriptions')

    it('unchanged subscriptions are not written back', async () => {
      const h = harness([socket('c1', T0 / 1000 + 86400)], null, { subscriptions: ['a', 'b'] })
      await settle()
      await h.fire()
      expect(subscriptionPuts(h)).toHaveLength(0)
      // The chain still continues: the next revalidation is armed 5 min out.
      expect((h.alarm() as number) - Date.now()).toBe(300000)
    })

    it('a revoked conversation writes the reduced set once', async () => {
      authMock.hasAccess = async (id) => id !== 'b'
      const h = harness([socket('c1', T0 / 1000 + 86400)], null, { subscriptions: ['a', 'b'] })
      await settle()
      await h.fire()
      expect(subscriptionPuts(h)).toEqual([['subscriptions', ['a']]])
      await h.fire()
      expect(subscriptionPuts(h)).toHaveLength(1)
    })
  })
})
