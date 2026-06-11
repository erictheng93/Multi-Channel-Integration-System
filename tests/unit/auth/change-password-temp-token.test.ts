import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings, DbUser } from '@/types'

const mocks = vi.hoisted(() => ({
  verifyJWT: vi.fn(),
  getUserById: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  logActivity: vi.fn(),
  updateSet: vi.fn(),
  selectLimit: vi.fn(),
  cacheGet: vi.fn(),
  cachePut: vi.fn()
}))

vi.mock('@/utils/auth', () => ({
  verifyJWT: mocks.verifyJWT,
  getUserById: mocks.getUserById
}))

vi.mock('@/modules/auth/services/auth', () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword
}))

vi.mock('@modules/activities', () => ({
  ActivityService: vi.fn(function () {
    return { logActivity: mocks.logActivity }
  }),
  ACTIVITY_ACTIONS: {
    USER_UPDATE: 'user_update'
  },
  RESOURCE_TYPES: {
    USER: 'user'
  }
}))

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mocks.selectLimit
        }))
      }))
    })),
    update: vi.fn(() => ({
      set: mocks.updateSet
    }))
  }))
}))

vi.mock('drizzle-orm', async importOriginal => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  eq: vi.fn(() => ({ kind: 'eq' }))
}))

import passwordHandler from '@/modules/teams/handlers/password'

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
    SESSIONS: {} as KVNamespace,
    CACHE: {
      get: mocks.cacheGet,
      put: mocks.cachePut
    } as unknown as KVNamespace
  } as Bindings
}

function createApp() {
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', async (c, next) => {
    c.env = createEnv()
    await next()
  })
  app.route('/api/auth', passwordHandler)
  return app
}

describe('change-password temp token auth', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset())
    mocks.verifyJWT.mockResolvedValue({
      userId: 'agent-1',
      email: 'agent@example.com',
      displayName: 'Agent One',
      role: 'agent',
      type: 'temp_password_change',
      jti: 'temp-jti-1',
      exp: Math.floor(Date.now() / 1000) + 1800
    })
    mocks.cacheGet.mockResolvedValue(null)
    mocks.getUserById.mockResolvedValue(activeUser)
    mocks.hashPassword.mockResolvedValue('hashed-new-password')
    mocks.selectLimit.mockResolvedValue([{
      id: 'agent-1',
      email: 'agent@example.com',
      displayName: 'Agent One',
      role: 'agent',
      passwordHash: 'old-hash'
    }])
    mocks.updateSet.mockReturnValue({
      where: vi.fn(async () => undefined)
    })
  })

  it('accepts a temp password-change Bearer token without requiring currentPassword', async () => {
    const response = await createApp().request('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer temp-token'
      },
      body: JSON.stringify({ newPassword: 'new-password' })
    })

    expect(response.status).toBe(200)
    expect(mocks.verifyJWT).toHaveBeenCalledWith('temp-token', 'test-secret')
    expect(mocks.verifyPassword).not.toHaveBeenCalled()
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      passwordHash: 'hashed-new-password',
      passwordPolicy: 'changeable'
    }))
    expect(mocks.cachePut).toHaveBeenCalledWith(
      'revoked:temp-jti-1',
      '1',
      expect.objectContaining({ expirationTtl: expect.any(Number) })
    )
  })

  it('rejects a revoked temp password-change token', async () => {
    mocks.cacheGet.mockResolvedValue('1')

    const response = await createApp().request('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer temp-token'
      },
      body: JSON.stringify({ newPassword: 'new-password' })
    })

    expect(response.status).toBe(401)
    expect(mocks.updateSet).not.toHaveBeenCalled()
  })

  it('rejects temp password-change tokens without jti', async () => {
    mocks.verifyJWT.mockResolvedValue({
      userId: 'agent-1',
      email: 'agent@example.com',
      displayName: 'Agent One',
      role: 'agent',
      type: 'temp_password_change',
      exp: Math.floor(Date.now() / 1000) + 1800
    })

    const response = await createApp().request('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer temp-token'
      },
      body: JSON.stringify({ newPassword: 'new-password' })
    })

    expect(response.status).toBe(401)
    expect(mocks.updateSet).not.toHaveBeenCalled()
  })
})
