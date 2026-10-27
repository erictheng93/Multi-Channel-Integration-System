import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '@/types'

// Audit run-2 finding #9: logout and password change must close the user's open WebSockets.

const mocks = vi.hoisted(() => ({
  revoke: vi.fn(),
  getUserById: vi.fn(),
  verifyJWT: vi.fn(),
  cachePut: vi.fn(),
  bump: vi.fn(),
  access: vi.fn()
}))

vi.mock('cloudflare:workers', () => ({
  DurableObject: class { constructor(protected ctx: unknown, protected env: unknown) {} }
}))

vi.mock('@/services/websocket-auth-service', () => ({
  WebSocketAuthService: class { hasLiveConversationAccess = mocks.access }
}))

vi.mock('@/utils/auth', () => ({
  signJWT: vi.fn(),
  authenticateUser: vi.fn(),
  createSession: vi.fn(),
  verifyJWT: mocks.verifyJWT,
  getUserById: mocks.getUserById,
  UserNotFoundError: class UserNotFoundError extends Error {}
}))

vi.mock('@/utils/auth-jwt', async importOriginal => ({
  ...(await importOriginal<typeof import('@/utils/auth-jwt')>()),
  bumpTokensValidAfter: mocks.bump
}))

vi.mock('@modules/activities', () => ({
  ActivityCapture: vi.fn(),
  ActivityService: vi.fn(function () { return { logActivity: vi.fn() } }),
  ACTIVITY_ACTIONS: { USER_LOGOUT: 'user_logout', USER_UPDATE: 'user_update', USER_LOGIN: 'user_login' },
  RESOURCE_TYPES: { USER: 'user' }
}))

vi.mock('@/modules/auth/services/auth', () => ({
  hashPassword: vi.fn(async () => 'hash'),
  verifyPassword: vi.fn(async () => true)
}))

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    update: () => ({ set: () => ({ where: () => Object.assign(Promise.resolve(undefined), { returning: async () => [{ id: 'm-2' }] }) }) }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 'agent-1', displayName: 'A', passwordHash: 'h' }] }) }) })
  }))
}))

vi.mock('@/middleware/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('@/middleware/auth')>()
  const pass = async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('user', { id: 'agent-1', email: 'a@x.com', displayName: 'A', role: 'admin', isActive: true })
    c.set('jwtPayload', { type: 'access' })
    await next()
  }
  return {
    ...actual,
    jwtAuth: vi.fn(pass),
    sessionAuth: vi.fn(pass),
    requireManagerOrAdmin: () => vi.fn(async (_c: unknown, next: () => Promise<void>) => { await next() })
  }
})

vi.mock('@/services/websocket-access-revocation', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/websocket-access-revocation')>()),
  revokeUserWebSocketSessions: mocks.revoke
}))

import authHandler from '@/modules/auth/handlers/auth-main'
import passwordHandler from '@/modules/teams/handlers/password'
import { UserConnection } from '@/durable-objects/UserConnection'
import { RoomConnectionManager } from '@/durable-objects/services/room-connection-manager'

const env = {
  JWT_SECRET: 's',
  DB: {} as D1Database,
  SESSIONS: { delete: async () => undefined } as unknown as KVNamespace,
  CACHE: { get: async () => null, put: mocks.cachePut, delete: async () => undefined } as unknown as KVNamespace
} as unknown as Bindings

function app() {
  const a = new Hono<{ Bindings: Bindings }>()
  a.use('*', async (c, next) => { c.env = env; await next() })
  a.route('/api/auth', authHandler)
  a.route('/api/auth', passwordHandler)
  a.route('/api/members', passwordHandler)
  return a
}

const realRevocation = () =>
  vi.importActual<typeof import('@/services/websocket-access-revocation')>('@/services/websocket-access-revocation')

describe('logout and password change evict realtime sockets', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(m => m.mockReset())
    mocks.revoke.mockResolvedValue(undefined)
    mocks.verifyJWT.mockResolvedValue({ userId: 'agent-1', jti: 'j', exp: Math.floor(Date.now() / 1000) + 600 })
  })

  const logout = () => app().request('/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: 'mcis_access=a; mcis_refresh=r; mcis_csrf=c', 'X-CSRF-Token': 'c' }
  })

  it('logout revokes the user sockets', async () => {
    expect((await logout()).status).toBe(200)
    expect(mocks.revoke).toHaveBeenCalledTimes(1)
    expect(mocks.revoke.mock.calls[0][1]).toBe('agent-1')
  })

  it('logout still succeeds when the eviction request itself fails', async () => {
    const real = await realRevocation()
    mocks.revoke.mockImplementation((_e: Bindings, id: string) => real.revokeUserWebSocketSessions({
      USER_CONNECTION: { idFromName: () => 'x', get: () => ({ fetch: async () => { throw new Error('DO down') } }) }
    } as unknown as Bindings, id))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await logout()).status).toBe(200)
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('self-service change-password revokes the sockets after bumping the epoch', async () => {
    const res = await app().request('/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'old', newPassword: 'NewPassw0rd!x' })
    })
    expect(res.status).toBe(200)
    expect(mocks.bump).toHaveBeenCalledWith(expect.anything(), 'agent-1')
    expect(mocks.revoke).toHaveBeenCalledTimes(1)
    expect(mocks.revoke.mock.calls[0][1]).toBe('agent-1')
  })

  it('admin reset of another member revokes that member sockets', async () => {
    const res = await app().request('/api/members/m-2/reset', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: 'NewPassw0rd!x' })
    })
    expect(res.status).toBe(200)
    expect(mocks.revoke).toHaveBeenCalledTimes(1)
    expect(mocks.revoke.mock.calls[0][1]).toBe('m-2')
  })
})

describe('revokeUserWebSocketSessions', () => {
  it('posts revokeSessions to the user DO and tolerates failure or a missing binding', async () => {
    const real = await realRevocation()
    const fetch = vi.fn(async (_r: Request) => new Response('ok'))
    const ns = { idFromName: vi.fn((n: string) => n), get: vi.fn(() => ({ fetch })) }
    await real.revokeUserWebSocketSessions({ USER_CONNECTION: ns } as unknown as Bindings, 42)
    expect(ns.idFromName).toHaveBeenCalledWith('42')
    const req = fetch.mock.calls[0][0]
    expect(new URL(req.url).pathname).toBe('/evict')
    expect(await req.json()).toEqual({ userId: '42', revokeSessions: true })

    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetch.mockResolvedValueOnce(new Response('x', { status: 503 }))
    await expect(real.revokeUserWebSocketSessions({ USER_CONNECTION: ns } as unknown as Bindings, 'u')).resolves.toBeUndefined()
    await expect(real.revokeUserWebSocketSessions(undefined, 'u')).resolves.toBeUndefined()
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })
})

describe('UserConnection /evict revokeSessions', () => {
  function adminSocket() {
    const att = { connectionId: 'c1', userId: 'u1', role: 'admin', connectedAt: 1, lastActivity: 1 }
    return { readyState: 1, send: vi.fn(), close: vi.fn(), serializeAttachment: vi.fn(), deserializeAttachment: () => att }
  }
  function build(sock: ReturnType<typeof adminSocket>, roomFetch: ReturnType<typeof vi.fn>) {
    vi.stubGlobal('WebSocketRequestResponsePair', class {})
    vi.stubGlobal('WebSocket', { OPEN: 1 })
    const stored = new Map<string, unknown>([['room:c1', 'conv-1']])
    const state = {
      getWebSockets: () => [sock], setWebSocketAutoResponse: vi.fn(), acceptWebSocket: vi.fn(),
      storage: {
        get: vi.fn(async (k: string) => stored.get(k)), put: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined), setAlarm: vi.fn(), deleteAlarm: vi.fn(), getAlarm: vi.fn(async () => null),
        list: vi.fn(async () => new Map(stored))
      }
    } as unknown as DurableObjectState
    return new UserConnection(state, {
      DB: {},
      CONVERSATION_ROOM: { idFromName: (n: string) => n, get: () => ({ fetch: roomFetch }) }
    })
  }
  const post = (body: unknown) => new Request('https://x/evict', { method: 'POST', body: JSON.stringify(body) })

  beforeEach(() => {
    mocks.getUserById.mockResolvedValue({ id: 'u1', role: 'admin', isActive: true })
    mocks.access.mockResolvedValue(true)
  })

  it('a plain evict keeps a still-authorised admin socket', async () => {
    const sock = adminSocket()
    const room = vi.fn(async () => Response.json({ connectionIds: ['c1'] }))
    const res = await build(sock, room).fetch(post({ userId: 'u1' }))
    expect(res.status).toBe(200)
    expect(sock.close).not.toHaveBeenCalled()
  })

  it('revokeSessions closes the admin socket and forces the room to close it too', async () => {
    const sock = adminSocket()
    const room = vi.fn(async (_r: Request) => Response.json({ connectionIds: [] }))
    const res = await build(sock, room).fetch(post({ userId: 'u1', revokeSessions: true }))
    expect(res.status).toBe(200)
    expect(sock.close).toHaveBeenCalledWith(4403, 'Access revoked')
    expect(await room.mock.calls[0][0].json()).toEqual({ userIds: ['u1'], force: true })
  })
})

describe('RoomConnectionManager force eviction', () => {
  function mgr() {
    const ws1 = { close: vi.fn(), serializeAttachment: vi.fn(), readyState: 1 }
    const ws2 = { close: vi.fn(), serializeAttachment: vi.fn(), readyState: 1 }
    const ctx = {
      conversationId: 'conv', env: {},
      state: { getWebSockets: () => [], storage: { get: async () => 0, put: async () => undefined, delete: async () => undefined } },
      connections: new Map([
        ['k1', { userId: 'u1', connectionId: 'k1', websocket: ws1, metadata: {} }],
        ['k2', { userId: 'u2', connectionId: 'k2', websocket: ws2, metadata: {} }]
      ])
    }
    const m = new RoomConnectionManager(ctx as never, {} as never, {} as never, {} as never)
    ;(m as unknown as { removeConnection: () => Promise<void> }).removeConnection = async () => undefined
    return { m, ws1, ws2 }
  }

  it('force closes the listed user although access is still granted, and spares others', async () => {
    mocks.access.mockResolvedValue(true)
    const { m, ws1, ws2 } = mgr()
    const res = await m.handleEvict(new Request('https://x/evict', { method: 'POST', body: JSON.stringify({ userIds: ['u1'], force: true }) }))
    expect(res.status).toBe(200)
    expect(ws1.close).toHaveBeenCalledWith(4403, 'Access revoked')
    expect(ws2.close).not.toHaveBeenCalled()
  })

  it('rejects force without a user list', async () => {
    const { m } = mgr()
    const res = await m.handleEvict(new Request('https://x/evict', { method: 'POST', body: JSON.stringify({ force: true }) }))
    expect(res.status).toBe(400)
  })
})
