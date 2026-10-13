import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const access = vi.hoisted(() => ({ check: async (_u: string, _c: string): Promise<boolean> => true }))

vi.mock('@/services/websocket-auth-service', () => ({
  WebSocketAuthService: class {
    hasLiveConversationAccess(userId: string, conversationId: string) {
      return access.check(userId, conversationId)
    }
  }
}))

import { ConversationRoom } from '@/durable-objects/ConversationRoom'
import { RoomStorageService } from '@/durable-objects/services/room-storage-service'
import { RoomConnectionManager } from '@/durable-objects/services/room-connection-manager'

interface Harness {
  state: DurableObjectState
  alarm: () => number | null
  setAlarm: ReturnType<typeof vi.fn>
  deleteAlarm: ReturnType<typeof vi.fn>
  getAlarm: ReturnType<typeof vi.fn>
  failPuts: { value: boolean }
  consume: () => void
}

function harness(initialAlarm: number | null = null): Harness {
  let alarm = initialAlarm
  const values = new Map<string, unknown>()
  const failPuts = { value: false }
  const setAlarm = vi.fn(async (v: number) => { alarm = v })
  const deleteAlarm = vi.fn(async () => { alarm = null })
  const getAlarm = vi.fn(async () => alarm)
  const state = {
    acceptWebSocket: vi.fn(),
    getWebSockets: vi.fn(() => []),
    setWebSocketAutoResponse: vi.fn(),
    storage: {
      get: vi.fn(async (k: string) => values.get(k)),
      put: vi.fn(async (k: string, v: unknown) => {
        if (failPuts.value && k === 'messageHistory') throw new Error('storage unavailable')
        values.set(k, v)
      }),
      delete: vi.fn(async (k: string) => { values.delete(k) }),
      getAlarm, setAlarm, deleteAlarm
    }
  } as unknown as DurableObjectState
  return { state, alarm: () => alarm, consume: () => { alarm = null }, setAlarm, deleteAlarm, getAlarm, failPuts }
}

function storageCtx(h: Harness) {
  return {
    state: h.state,
    connections: new Map<string, unknown>(),
    participants: new Set<string>(),
    messageHistory: [] as unknown[],
    messageDirty: false,
    storageFlushDeadline: null as number | null,
    accessCheckDeadline: null as number | null,
    alarmAt: undefined as number | null | undefined,
    STORAGE_WRITE_DEBOUNCE_MS: 5000,
    conversationId: 'c1',
    env: {},
    config: { mode: 'full' }
  }
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

function makeStorage(h: Harness) {
  const ctx = storageCtx(h)
  const svc = new RoomStorageService(ctx as never, { isFullMode: () => true } as never)
  return { ctx, svc }
}

describe('ConversationRoom alarm chain', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_800_000_000_000)
    Object.defineProperty(globalThis, 'WebSocket', { value: { OPEN: 1 }, configurable: true })
    Object.defineProperty(globalThis, 'WebSocketRequestResponsePair', {
      value: class { constructor(public a: string, public b: string) {} },
      configurable: true
    })
    access.check = async () => true
  })
  afterEach(() => { vi.useRealTimers() })

  it('cold start of an idle room performs no alarm write', async () => {
    const h = harness()
    new ConversationRoom(h.state, {}, { mode: 'full' })
    await vi.waitFor(() => expect(h.getAlarm).toHaveBeenCalled())
    await Promise.resolve()
    expect(h.deleteAlarm).not.toHaveBeenCalled()
    expect(h.setAlarm).not.toHaveBeenCalled()
  })

  it('cold start clears a stale alarm exactly once when no work is pending', async () => {
    const h = harness(Date.now() + 60_000)
    new ConversationRoom(h.state, {}, { mode: 'full' })
    await vi.waitFor(() => expect(h.deleteAlarm).toHaveBeenCalledTimes(1))
    expect(h.alarm()).toBeNull()
  })

  it('alarm() on an idle room does not re-arm or write', async () => {
    const h = harness()
    const room = new ConversationRoom(h.state, {}, { mode: 'full' })
    await room.alarm()
    expect(h.setAlarm).not.toHaveBeenCalled()
    expect(h.deleteAlarm).not.toHaveBeenCalled()
    expect(h.alarm()).toBeNull()
  })

  it('a drained flush leaves no alarm', async () => {
    const h = harness()
    const { ctx, svc } = makeStorage(h)
    ctx.messageDirty = true
    svc.scheduleStorageWrite()
    await settle()
    expect(h.alarm()).toBe(Date.now() + 5000)
    vi.setSystemTime(Date.now() + 5000)
    ctx.alarmAt = null
    h.consume()
    await svc.flushDueMessageHistory()
    await svc.scheduleNextAlarm()
    expect(ctx.messageDirty).toBe(false)
    expect(h.alarm()).toBeNull()
  })

  it('persistent flush failure stops re-arming after the attempt cap and keeps the data dirty', async () => {
    const h = harness()
    h.failPuts.value = true
    const { ctx, svc } = makeStorage(h)
    ctx.messageDirty = true
    svc.scheduleStorageWrite()
    await settle()
    expect(h.alarm()).not.toBeNull()

    let wakes = 0
    const gaps: number[] = []
    while (h.alarm() !== null && wakes < 50) {
      const at = h.alarm() as number
      gaps.push(at - Date.now())
      vi.setSystemTime(at)
      ctx.alarmAt = null // the alarm that fired is consumed
      h.consume()
      await svc.flushDueMessageHistory(Date.now())
      await svc.scheduleNextAlarm()
      wakes++
    }
    // 5s debounce window, then backoff 1s, 2s, 4s, 8s; the 5th failure stops the chain.
    expect(gaps).toEqual([5000, 1000, 2000, 4000, 8000])
    expect(wakes).toBe(5)
    expect(h.alarm()).toBeNull()
    expect(ctx.messageDirty).toBe(true)

    // The next message re-arms with a fresh budget, and success drains it.
    svc.scheduleStorageWrite()
    await settle()
    expect(h.alarm()).not.toBeNull()
    h.failPuts.value = false
    vi.setSystemTime(h.alarm() as number)
    ctx.alarmAt = null
    h.consume()
    await svc.flushDueMessageHistory(Date.now())
    await svc.scheduleNextAlarm()
    expect(ctx.messageDirty).toBe(false)
    expect(h.alarm()).toBeNull()
  })

  it('does not rewrite an unchanged alarm deadline', async () => {
    const h = harness()
    const { ctx, svc } = makeStorage(h)
    ctx.messageDirty = true
    svc.scheduleStorageWrite()
    await settle()
    expect(h.setAlarm).toHaveBeenCalledTimes(1)
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(Date.now() + 100)
      svc.scheduleStorageWrite()
      await svc.scheduleNextAlarm()
    }
    expect(h.setAlarm).toHaveBeenCalledTimes(1)
  })

  it('access-check deferral backs off, is bounded at the normal cadence, and resets on success', async () => {
    const h = harness()
    const ctx = storageCtx(h)
    ctx.connections.set('k1', {
      userId: 'u1',
      connectionId: 'k1',
      websocket: { close: vi.fn(), serializeAttachment: vi.fn(), readyState: 1 },
      metadata: {}
    })
    const mgr = new RoomConnectionManager(
      ctx as never, { isFullMode: () => false } as never, {} as never, {} as never
    )
    ;(mgr as unknown as { restoreHibernatedConnections: () => void }).restoreHibernatedConnections = () => {}

    access.check = async () => { throw new Error('D1 down') }
    const delays: number[] = []
    for (let i = 0; i < 8; i++) {
      const before = Date.now()
      const r = await mgr.evictUnauthorizedConnections()
      expect(r.deferred).toBe(true)
      delays.push((ctx.accessCheckDeadline as number) - before)
    }
    expect(delays).toEqual([30000, 60000, 120000, 240000, 300000, 300000, 300000, 300000])

    access.check = async () => true
    expect((await mgr.evictUnauthorizedConnections()).deferred).toBe(false)
    access.check = async () => { throw new Error('D1 down') }
    const before = Date.now()
    await mgr.evictUnauthorizedConnections()
    expect((ctx.accessCheckDeadline as number) - before).toBe(30000)
  })
})
