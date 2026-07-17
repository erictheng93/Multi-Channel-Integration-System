import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '@/types'
import { websocketAuth } from '@/middleware/websocket-auth'
import websocketHandler from '@/modules/websocket/handlers/websocket-main'

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
  getUserById: vi.fn()
}))

vi.mock('@/utils/auth', () => ({
  verifyJWT: mocks.verifyJWT,
  getUserById: mocks.getUserById
}))

vi.mock('@/services/websocket-auth-service', () => ({
  WebSocketAuthService: vi.fn()
}))

function createEnv(): Bindings {
  return {
    JWT_SECRET: 'test-secret',
    DB: {} as D1Database,
    CACHE: {
      get: vi.fn(async (key: string) => key === 'agent-teams:agent-1'
        ? JSON.stringify({
            allowedTeamIds: [1],
            teamRoles: { 1: 'member' },
            primaryTeamId: 1
          })
        : null),
      put: vi.fn().mockResolvedValue(undefined)
    } as unknown as KVNamespace,
    SESSIONS: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined)
    } as unknown as KVNamespace,
    FRONTEND_URL: 'https://app.example.com',
  } as Bindings
}

function createApp() {
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', async (c, next) => {
    c.env = createEnv()
    await next()
  })
  app.get('/connect', websocketAuth, c => c.json({
    success: true,
    websocketToken: c.get('websocketToken')
  }))
  return app
}

describe('websocket cookie auth', () => {
  beforeEach(() => {
    mocks.verifyJWT.mockReset()
    mocks.verifyJWT.mockResolvedValue({
      userId: 'agent-1',
      email: 'agent@example.com',
      displayName: 'Agent One',
      role: 'agent',
      // validateAccessTokenPayload allowlists type === 'access' and requires
      // a jti for the revocation list — mock the payload /login mints.
      type: 'access',
      jti: 'test-jti-ws-1',
      exp: Math.floor(Date.now() / 1000) + 3600
    })
    mocks.getUserById.mockReset()
    mocks.getUserById.mockResolvedValue({
      id: 'agent-1',
      email: 'agent@example.com',
      displayName: 'Agent One',
      role: 'agent',
      primaryTeamId: 1,
      teamName: 'Support',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      allowedTeamIds: [1],
      teamRoles: { 1: 'member' }
    })
  })

  it('rejects legacy query token auth', async () => {
    const response = await createApp().request('/connect?token=query.token.value')

    expect(response.status).toBe(401)
    expect(mocks.verifyJWT).not.toHaveBeenCalled()
  })

  it('accepts the HttpOnly access cookie', async () => {
    const response = await createApp().request('/connect', {
      headers: {
        Cookie: 'mcis_access=cookie.access.token',
        Origin: 'https://app.example.com'
      }
    })

    expect(response.status).toBe(200)
    expect(mocks.verifyJWT).toHaveBeenCalledWith('cookie.access.token', 'test-secret')
    await expect(response.json()).resolves.toMatchObject({
      websocketToken: 'cookie.access.token'
    })
  })

  it('rejects browser WebSocket requests from disallowed origins', async () => {
    const response = await createApp().request('/connect', {
      headers: {
        Cookie: 'mcis_access=cookie.access.token',
        Origin: 'https://evil.example.net'
      }
    })

    expect(response.status).toBe(403)
    expect(mocks.verifyJWT).not.toHaveBeenCalled()
  })

  it('forwards the verified cookie token to the UserConnection durable object', async () => {
    let forwardedUrl = ''
    const userConnectionStub = {
      fetch: vi.fn(async (request: Request) => {
        if (request.url === 'https://user-connection/status') {
          return Response.json({ connectionCount: 0 })
        }

        forwardedUrl = request.url
        return new Response('forwarded')
      })
    }
    const env = {
      ...createEnv(),
      USER_CONNECTION: {
        idFromName: vi.fn(() => 'user-connection-id'),
        get: vi.fn(() => userConnectionStub)
      }
    } as unknown as Bindings
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/api/websocket', websocketHandler)

    const response = await app.request('/api/websocket/connect?deviceId=web-global-store', {
      headers: {
        Cookie: 'mcis_access=cookie.access.token',
        Origin: 'https://app.example.com',
        Upgrade: 'websocket'
      }
    }, env)

    expect(response.status).toBe(200)
    expect(new URL(forwardedUrl).searchParams.get('token')).toBe('cookie.access.token')
  })
})
