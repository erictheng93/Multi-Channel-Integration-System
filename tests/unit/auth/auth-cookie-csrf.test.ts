import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { jwtAuth } from '@/middleware/auth'
import type { Bindings, DbUser, JWTPayload } from '@/types'

function createEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    JWT_SECRET: 'test-secret',
    DB: {} as D1Database,
    SESSIONS: {} as KVNamespace,
    CACHE: {
      get: async () => null,
      put: async () => undefined,
      delete: async () => undefined,
      list: async () => ({ keys: [], list_complete: true, cursor: undefined }),
      getWithMetadata: async () => ({ value: null, metadata: null })
    } as unknown as KVNamespace,
    ...overrides
  } as Bindings
}

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

const accessPayload: JWTPayload = {
  userId: 'agent-1',
  displayName: 'Agent One',
  email: 'agent@example.com',
  role: 'agent',
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600
}

vi.mock('@/utils/auth', () => ({
  verifyJWT: vi.fn(async () => accessPayload),
  getUserById: vi.fn(async () => activeUser),
  getSession: vi.fn(),
  updateUserActivityDebounced: vi.fn(async () => false),
  canAccessTeam: vi.fn(async () => true),
  hasTeamRole: vi.fn(() => true),
  TEAM_PERMISSIONS: {}
}))

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [])
      }))
    }))
  }))
}))

vi.mock('@modules/system/handlers/kv-optimization-monitoring', () => ({
  incrementRequestCounter: vi.fn(),
  trackTheoreticalKVSavings: vi.fn()
}))

function createApp(method: 'GET' | 'POST' = 'POST') {
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', async (c, next) => {
    c.env = createEnv()
    await next()
  })
  app.on(method, '/protected', jwtAuth, c => c.json({ success: true }))
  return app
}

describe('cookie auth CSRF protection', () => {
  it('accepts bearer-authenticated unsafe requests without CSRF during migration', async () => {
    const response = await createApp().request('/protected', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer access-token'
      }
    })

    expect(response.status).toBe(200)
  })

  it('rejects cookie-authenticated unsafe requests without matching CSRF header', async () => {
    const response = await createApp().request('/protected', {
      method: 'POST',
      headers: {
        Cookie: 'mcis_access=access-token; mcis_csrf=csrf-token'
      }
    })

    expect(response.status).toBe(403)
  })

  it('accepts cookie-authenticated unsafe requests with matching CSRF header', async () => {
    const response = await createApp().request('/protected', {
      method: 'POST',
      headers: {
        Cookie: 'mcis_access=access-token; mcis_csrf=csrf-token',
        'X-CSRF-Token': 'csrf-token'
      }
    })

    expect(response.status).toBe(200)
  })

  it('allows cookie-authenticated safe requests without CSRF header', async () => {
    const response = await createApp('GET').request('/protected', {
      method: 'GET',
      headers: {
        Cookie: 'mcis_access=access-token; mcis_csrf=csrf-token'
      }
    })

    expect(response.status).toBe(200)
  })
})
