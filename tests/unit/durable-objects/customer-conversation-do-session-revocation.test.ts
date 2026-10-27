import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Bindings } from '@/types'

vi.mock('cloudflare:workers', () => ({
  DurableObject: class DurableObject<Env = unknown> {
    protected ctx: DurableObjectState
    protected env: Env
    constructor(ctx: DurableObjectState, env: Env) { this.ctx = ctx; this.env = env }
  }
}))

// The live D1 access check is not under test here: every agent still has access.
vi.mock('@/services/websocket-auth-service', () => ({
  WebSocketAuthService: vi.fn(function () {
    return { hasLiveConversationAccess: vi.fn(async () => true) }
  })
}))

import { CustomerConversationDO } from '@/durable-objects/CustomerConversationDO'

function socket(userId: string, token?: { jti: string; iat?: number; iatMs?: number }) {
  const attachment = {
    connectionId: `connection-${userId}`, userId, displayName: userId, role: 'agent',
    conversationId: 'conv', connectedAt: 1000, tokenExp: 2000000000, token
  }
  return {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
    deserializeAttachment: () => attachment,
    serializeAttachment: vi.fn()
  }
}

function state(sockets: ReturnType<typeof socket>[]) {
  return {
    getWebSockets: vi.fn(() => sockets),
    acceptWebSocket: vi.fn(), setWebSocketAutoResponse: vi.fn(),
    storage: {
      get: vi.fn(async () => undefined), put: vi.fn(), delete: vi.fn(),
      getAlarm: vi.fn(async () => null), setAlarm: vi.fn(), deleteAlarm: vi.fn()
    }
  } as unknown as DurableObjectState
}

function evict(stub: CustomerConversationDO) {
  return stub.fetch(new Request('https://internal/evict', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
  }))
}

describe('CustomerConversationDO session revocation (audit run-2 #9)', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocketRequestResponsePair', class {})
    vi.stubGlobal('WebSocket', { OPEN: 1 })
  })
  afterEach(() => vi.unstubAllGlobals())

  function make(sockets: ReturnType<typeof socket>[], kv: Record<string, string>) {
    const CACHE = { get: vi.fn(async (key: string) => kv[key] ?? null) }
    return new CustomerConversationDO(state(sockets), { CACHE } as unknown as Bindings)
  }

  it('closes a socket whose token was revoked by logout, keeps the others', async () => {
    const loggedOut = socket('u1', { jti: 'jti-out', iat: 100 })
    const active = socket('u2', { jti: 'jti-ok', iat: 100 })
    const res = await evict(make([loggedOut, active], { 'revoked:jti-out': '1' }))
    expect(res.status).toBe(200)
    expect(loggedOut.close).toHaveBeenCalledWith(4403, 'Access revoked')
    expect(active.close).not.toHaveBeenCalled()
  })

  it('closes a socket whose token predates a password change', async () => {
    const old = socket('u1', { jti: 'jti-a', iat: 100, iatMs: 100_000 })
    await evict(make([old], { 'tokens-valid-after:u1': String(200_000) }))
    expect(old.close).toHaveBeenCalledWith(4403, 'Access revoked')
  })

  it('keeps the socket and defers when the revocation store is unreadable', async () => {
    const s = socket('u1', { jti: 'jti-a', iat: 100 })
    const CACHE = { get: vi.fn(async () => { throw new Error('KV down') }) }
    const stub = new CustomerConversationDO(state([s]), { CACHE } as unknown as Bindings)
    expect((await evict(stub)).status).toBe(503)
    expect(s.close).not.toHaveBeenCalled()
  })

  it('leaves legacy sockets without token identity to token expiry', async () => {
    const legacy = socket('u1')
    expect((await evict(make([legacy], {}))).status).toBe(200)
    expect(legacy.close).not.toHaveBeenCalled()
  })
})
