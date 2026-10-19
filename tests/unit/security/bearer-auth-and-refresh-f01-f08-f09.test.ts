import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { signJWT, bumpTokensValidAfter } from '@/utils/auth-jwt'

const SECRET = 'test-secret-0000000000000000000000000'
const mockGetUserById = vi.fn()

vi.mock('@/utils/auth', async (orig) => ({
  ...(await orig<typeof import('@/utils/auth')>()),
  getUserById: (...a: unknown[]) => mockGetUserById(...a)
}))

import { agentAuthMiddleware } from '@modules/agents/middleware/agent-auth'
import { checkSessionAccess } from '@modules/session/middleware/session-auth'
import { validateAccessToken } from '@/middleware/auth'

function kv(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial))
  return {
    get: vi.fn(async (k: string) => m.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => void m.set(k, v)),
    delete: vi.fn(async (k: string) => void m.delete(k))
  }
}

const mint = (extra: Record<string, unknown>) =>
  signJWT({ userId: 'a1', displayName: 'A', role: 'admin', ...extra } as never, SECRET, 600)

function apps(cache: ReturnType<typeof kv>) {
  const env = { JWT_SECRET: SECRET, CACHE: cache, DB: {} }
  const agents = new Hono().use('*', agentAuthMiddleware()).get('/x', (c) => c.json({ role: c.get('user').role }))
  const sessions = new Hono().use('*', checkSessionAccess).get('/x', (c) => c.json({ role: c.get('jwtPayload').role }))
  const call = (app: Hono, token: string) =>
    app.request('/x', { headers: { Authorization: `Bearer ${token}` } }, env)
  return { agents, sessions, call, env }
}

describe('F01 bearer middlewares use shared access-token validation', () => {
  beforeEach(() => {
    mockGetUserById.mockReset()
    mockGetUserById.mockResolvedValue({ id: 'a1', role: 'agent', isActive: true, allowedTeamIds: [], teamRoles: {} })
  })

  it.each(['refresh', 'temp_password_change'])('rejects %s tokens', async (type) => {
    const { agents, sessions, call } = apps(kv())
    const t = await mint({ type, jti: 'j1' })
    expect((await call(agents, t)).status).toBe(401)
    expect((await call(sessions, t)).status).toBe(401)
  })

  it('rejects revoked access token and inactive/deleted users', async () => {
    const { agents, sessions, call } = apps(kv({ 'revoked:j2': '1' }))
    const t = await mint({ type: 'access', jti: 'j2' })
    expect((await call(agents, t)).status).toBe(401)
    expect((await call(sessions, t)).status).toBe(401)

    const ok = apps(kv())
    mockGetUserById.mockRejectedValue(new Error('User not found'))
    const t2 = await mint({ type: 'access', jti: 'j3' })
    expect((await call(ok.agents, t2)).status).toBe(401)
  })

  it('uses the DB role, not the claimed role', async () => {
    const { agents, sessions, call } = apps(kv())
    const t = await mint({ type: 'access', jti: 'j4', role: 'admin' })
    expect(await (await call(agents, t)).json()).toEqual({ role: 'agent' })
    expect(await (await call(sessions, t)).json()).toEqual({ role: 'agent' })
  })
})

describe('F09 token epoch', () => {
  it('rejects access tokens issued before a credential change', async () => {
    const cache = kv()
    mockGetUserById.mockResolvedValue({ id: 'a1', role: 'agent', isActive: true })
    const old = await mint({ type: 'access', jti: 'j5' })
    await expect(validateAccessToken({ JWT_SECRET: SECRET, CACHE: cache } as never, old)).resolves.toBeTruthy()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 5000)
    await bumpTokensValidAfter(cache as never, 'a1')
    vi.useRealTimers()
    await expect(validateAccessToken({ JWT_SECRET: SECRET, CACHE: cache } as never, old)).rejects.toMatchObject({ status: 401 })
  })
})
