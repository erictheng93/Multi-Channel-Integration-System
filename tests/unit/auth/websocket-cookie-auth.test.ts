import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '@/types'
import { websocketAuth } from '@/middleware/websocket-auth'

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn()
}))

vi.mock('@/utils/auth', () => ({
  verifyJWT: mocks.verifyJWT
}))

vi.mock('@/services/websocket-auth-service', () => ({
  WebSocketAuthService: vi.fn()
}))

function createEnv(): Bindings {
  return {
    JWT_SECRET: 'test-secret',
    DB: {} as D1Database,
    CACHE: {} as KVNamespace,
    SESSIONS: {} as KVNamespace,
    FRONTEND_URL: 'https://app.example.com'
  } as Bindings
}

function createApp() {
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', async (c, next) => {
    c.env = createEnv()
    await next()
  })
  app.get('/connect', websocketAuth, c => c.json({ success: true }))
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
      type: 'access',
      exp: Math.floor(Date.now() / 1000) + 3600
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
})
