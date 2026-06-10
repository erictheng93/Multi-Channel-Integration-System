import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings, DbUser } from '@/types'

const mocks = vi.hoisted(() => ({
  signJWT: vi.fn(),
  authenticateUser: vi.fn(),
  createSession: vi.fn(),
  verifyJWT: vi.fn(),
  jwtVerify: vi.fn(),
  activityLog: vi.fn(),
  cachePut: vi.fn(),
  cacheGet: vi.fn(),
  cacheDelete: vi.fn()
}))

vi.mock('@/utils/auth', () => ({
  signJWT: mocks.signJWT,
  authenticateUser: mocks.authenticateUser,
  createSession: mocks.createSession,
  verifyJWT: mocks.verifyJWT,
  getUserById: vi.fn()
}))

vi.mock('jsonwebtoken', () => ({
  verify: mocks.jwtVerify,
  default: {
    verify: mocks.jwtVerify
  }
}))

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined)
      }))
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(async () => ({
            id: 'agent-1',
            email: 'agent@example.com',
            displayName: 'Agent One',
            role: 'agent',
            isActive: true
          }))
        }))
      }))
    }))
  }))
}))

vi.mock('@modules/activities', () => ({
  ActivityCapture: vi.fn(),
  ActivityService: vi.fn(function () {
    return { logActivity: mocks.activityLog }
  }),
  ACTIVITY_ACTIONS: {
    USER_LOGIN: 'user_login',
    USER_LOGOUT: 'user_logout',
    USER_UPDATE: 'user_update'
  },
  RESOURCE_TYPES: {
    USER: 'user'
  }
}))

vi.mock('@/middleware/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('@/middleware/auth')>()
  const setAuthenticatedUser = (c: { set: (key: string, value: unknown) => void }) => {
    c.set('user', {
      id: 'agent-1',
      email: 'agent@example.com',
      displayName: 'Agent One',
      role: 'agent',
      isActive: true
    })
  }

  return {
    ...actual,
    jwtAuth: vi.fn(async (c, next) => {
      setAuthenticatedUser(c)
      await next()
    }),
    sessionAuth: vi.fn(async (c, next) => {
      setAuthenticatedUser(c)
      await next()
    })
  }
})

import authHandler from '@/modules/auth/handlers/auth-main'

const activeUser: DbUser = {
  id: 'agent-1',
  email: 'agent@example.com',
  displayName: 'Agent One',
  name: 'Agent One',
  role: 'agent',
  isActive: true,
  allowedTeamIds: [],
  teamRoles: {},
  primaryTeamId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
} as unknown as DbUser

function createEnv(): Bindings {
  return {
    JWT_SECRET: 'test-secret',
    DB: {} as D1Database,
    SESSIONS: {
      get: async () => null,
      put: async () => undefined,
      delete: async () => undefined,
      list: async () => ({ keys: [], list_complete: true, cursor: undefined }),
      getWithMetadata: async () => ({ value: null, metadata: null })
    } as unknown as KVNamespace,
    CACHE: {
      get: mocks.cacheGet,
      put: mocks.cachePut,
      delete: mocks.cacheDelete,
      list: async () => ({ keys: [], list_complete: true, cursor: undefined }),
      getWithMetadata: async () => ({ value: null, metadata: null })
    } as unknown as KVNamespace
  } as Bindings
}

function createApp() {
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', async (c, next) => {
    c.env = createEnv()
    await next()
  })
  app.route('/api/auth', authHandler)
  return app
}

describe('auth cookie route contract', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset())
    mocks.signJWT
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token')
      .mockResolvedValueOnce('rotated-access-token')
      .mockResolvedValueOnce('rotated-refresh-token')
    mocks.authenticateUser.mockResolvedValue({
      user: activeUser,
      passwordPolicy: 'changeable',
      accountStatus: 'success'
    })
    mocks.createSession.mockResolvedValue('session-1')
    mocks.verifyJWT.mockResolvedValue({
      userId: 'agent-1',
      displayName: 'Agent One',
      email: 'agent@example.com',
      role: 'agent',
      type: 'refresh',
      jti: 'refresh-jti',
      exp: Math.floor(Date.now() / 1000) + 3600
    })
    mocks.jwtVerify.mockReturnValue({
      userId: 'agent-1',
      displayName: 'Agent One',
      email: 'agent@example.com',
      role: 'agent',
      type: 'refresh',
      jti: 'refresh-jti',
      exp: Math.floor(Date.now() / 1000) + 3600
    })
    mocks.cacheGet.mockResolvedValue('agent-1')
  })

  it('sets HttpOnly refresh/access cookies and readable CSRF cookie on login', async () => {
    const response = await createApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'agent@example.com', password: 'password' })
    })

    expect(response.status).toBe(200)
    const setCookie = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? '']
    const cookieHeader = setCookie.join('; ')

    expect(cookieHeader).toContain('mcis_access=access-token')
    expect(cookieHeader).toContain('mcis_refresh=refresh-token')
    expect(cookieHeader).toContain('mcis_csrf=')
    expect(cookieHeader).toContain('HttpOnly')
    expect(cookieHeader).toContain('Secure')
    expect(cookieHeader).toContain('SameSite=Strict')
  })

  it('refreshes tokens from the HttpOnly refresh cookie when body is empty', async () => {
    const response = await createApp().request('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'mcis_refresh=refresh-token; mcis_csrf=csrf-token',
        'X-CSRF-Token': 'csrf-token'
      },
      body: JSON.stringify({})
    })

    expect(response.status).toBe(200)
    expect(mocks.jwtVerify).toHaveBeenCalledWith(
      'refresh-token',
      'test-secret',
      { algorithms: ['HS256'] }
    )
    const setCookie = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? '']
    const cookieHeader = setCookie.join('; ')
    expect(cookieHeader).toContain('mcis_access=access-token')
    expect(cookieHeader).toContain('mcis_refresh=refresh-token')
  })

  it('clears auth cookies on logout', async () => {
    const response = await createApp().request('/api/auth/logout', {
      method: 'POST',
      headers: {
        Cookie: 'mcis_access=access-token; mcis_refresh=refresh-token; mcis_csrf=csrf-token',
        'X-CSRF-Token': 'csrf-token'
      }
    })

    expect(response.status).toBe(200)
    const setCookie = response.headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? '']
    const cookieHeader = setCookie.join('; ')

    expect(cookieHeader).toContain('mcis_access=')
    expect(cookieHeader).toContain('mcis_refresh=')
    expect(cookieHeader).toContain('mcis_csrf=')
    expect(cookieHeader).toContain('Max-Age=0')
  })
})
