import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('cloudflare:workers', () => ({
  DurableObject: class { constructor(protected ctx: unknown, protected env: unknown) {} }
}))
const hasAccess = vi.fn()
vi.mock('@/services/websocket-auth-service', () => ({
  WebSocketAuthService: class { hasLiveConversationAccess = hasAccess }
}))

import { CustomerConversationDO } from '@/durable-objects/CustomerConversationDO'
import { RoomStorageService } from '@/durable-objects/services/room-storage-service'
import { revalidateWebSocketAccess } from '@/services/websocket-access-revocation'
import websocketHandler from '@/modules/websocket/handlers/websocket-main'
import type { Bindings } from '@/types'

function sock(userId: string, tokenExp?: number, role = 'agent') {
  const att = { connectionId: `c-${userId}`, userId, displayName: userId, role, conversationId: 'conv', connectedAt: 1, tokenExp }
  return { readyState: 1, send: vi.fn(), close: vi.fn(), serializeAttachment: vi.fn(), deserializeAttachment: () => att }
}
function ctx(sockets: ReturnType<typeof sock>[], stored = new Map<string, unknown>()) {
  return {
    getWebSockets: () => sockets, acceptWebSocket: vi.fn(), setWebSocketAutoResponse: vi.fn(),
    storage: {
      get: vi.fn(async (k: string) => stored.get(k)),
      put: vi.fn(async (k: string, v: unknown) => { stored.set(k, v) }),
      delete: vi.fn(async (k: string) => stored.delete(k)),
      setAlarm: vi.fn(), deleteAlarm: vi.fn()
    }
  } as unknown as DurableObjectState
}
const post = (body: unknown) => new Request('https://x/evict', { method: 'POST', body: JSON.stringify(body) })

describe('F13 CustomerConversationDO access lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-19T00:00:00Z'))
    vi.stubGlobal('WebSocketRequestResponsePair', class {}); vi.stubGlobal('WebSocket', { OPEN: 1 })
    hasAccess.mockReset()
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('/evict closes a revoked agent and keeps an authorized one', async () => {
    const gone = sock('gone'), kept = sock('kept')
    hasAccess.mockImplementation(async (u: string) => u === 'kept')
    const doo = new CustomerConversationDO(ctx([gone, kept]), {} as Bindings)
    expect((await doo.fetch(post({ userId: 'gone' }))).status).toBe(200)
    expect(gone.close).toHaveBeenCalledWith(4403, 'Access revoked')
    expect(kept.close).not.toHaveBeenCalled()
  })

  it('fails safe: D1 outage keeps the socket and retries in 30s', async () => {
    const ws = sock('a'); hasAccess.mockRejectedValue(new Error('d1'))
    const c = ctx([ws]); const doo = new CustomerConversationDO(c, {} as Bindings)
    expect((await doo.fetch(post({}))).status).toBe(503)
    expect(ws.close).not.toHaveBeenCalled()
    expect(c.storage.put).toHaveBeenCalledWith('accessCheckDeadline', Date.now() + 30000)
  })

  it('alarm closes expired tokens and re-checks access after 5 minutes', async () => {
    const expired = sock('e', Math.floor(Date.now() / 1000) - 1), demoted = sock('d')
    hasAccess.mockResolvedValue(false)
    const stored = new Map<string, unknown>([['accessCheckDeadline', Date.now() - 1]])
    const doo = new CustomerConversationDO(ctx([expired, demoted], stored), {} as Bindings)
    await doo.alarm()
    expect(expired.close).toHaveBeenCalledWith(4401, 'Token expired')
    expect(demoted.close).toHaveBeenCalledWith(4403, 'Access revoked')
  })

  it('idle DO arms no alarm; drained DO deletes it', async () => {
    const c = ctx([]); const doo = new CustomerConversationDO(c, {} as Bindings)
    await doo.alarm()
    expect(c.storage.setAlarm).not.toHaveBeenCalled()
    expect(c.storage.deleteAlarm).toHaveBeenCalled()
  })

  it('an open socket arms the 5-minute re-check', async () => {
    const c = ctx([sock('a')]); const doo = new CustomerConversationDO(c, {} as Bindings)
    await doo.alarm()
    expect(c.storage.setAlarm).toHaveBeenLastCalledWith(Date.now() + 300000)
  })

  it('conversation revalidation reaches the customer-conversation DO', async () => {
    const fetch = vi.fn(async () => new Response('{}'))
    const ns = { idFromName: (i: string) => i, get: () => ({ fetch }) } as unknown as DurableObjectNamespace
    await revalidateWebSocketAccess({ CONVERSATION_ROOM: ns, CUSTOMER_CONVERSATION_DO: ns } as unknown as Bindings, 'conversation', 'conv')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('F29 test-connection is not exposed', () => {
  it('route no longer exists', async () => {
    const res = await websocketHandler.request('/test-connection?userId=u', {}, {} as Bindings)
    expect(res.status).toBe(404)
  })
})

describe('NV3 messageHistory write retry is bounded', () => {
  function room(putFails: boolean) {
    const setAlarm = vi.fn(), deleteAlarm = vi.fn()
    const c = {
      messageDirty: true, storageFlushDeadline: null as number | null, connections: new Map(), alarmAt: null as number | null | undefined,
      messageHistory: [], accessCheckDeadline: null,
      state: { storage: { put: vi.fn(async () => { if (putFails) throw new Error('too big') }), setAlarm, deleteAlarm, delete: vi.fn() } }
    }
    return { c, svc: new RoomStorageService(c as never, {} as never), setAlarm }
  }
  it('stops after N failures and leaves no flush deadline', async () => {
    vi.useFakeTimers()
    const { c, svc } = room(true)
    let writes = 0
    for (let i = 0; i < 20 && c.messageDirty; i++) { await svc.forceStorageWrite(); writes++; vi.advanceTimersByTime(60000) }
    expect(writes).toBe(5)
    expect(c.messageDirty).toBe(false)
    expect(c.storageFlushDeadline).toBeNull()
    await svc.scheduleNextAlarm()
    expect(c.alarmAt).toBeNull() // idle, no connections: no alarm
    vi.useRealTimers()
  })
  it('backs off instead of re-arming at 1s', async () => {
    const { c, svc } = room(true)
    await svc.forceStorageWrite(); const first = c.storageFlushDeadline! - Date.now()
    await svc.forceStorageWrite(); const second = c.storageFlushDeadline! - Date.now()
    expect(second).toBeGreaterThan(first)
  })
  it('drained write clears the deadline', async () => {
    const { c, svc } = room(false)
    await svc.forceStorageWrite()
    expect(c.messageDirty).toBe(false); expect(c.storageFlushDeadline).toBeNull()
  })
})
