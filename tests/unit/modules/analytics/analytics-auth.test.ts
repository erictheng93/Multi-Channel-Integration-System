import { Hono } from 'hono'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { analyticsAuth } from '@/modules/analytics/middleware/analytics-auth'
import { signJWT } from '@/utils/auth'
import type { Bindings } from '@/types'

const { mockCheckPermission, mockGetUserById } = vi.hoisted(() => ({
  mockCheckPermission: vi.fn(),
  mockGetUserById: vi.fn()
}))

vi.mock('@/services/permission-service', () => ({
  PermissionService: {
    checkPermission: mockCheckPermission
  }
}))

// validateAccessToken loads the agent row to enforce isActive; stub the DB
// lookup so the positive-path test doesn't need a real D1 instance.
vi.mock('@/utils/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/auth')>()
  return {
    ...actual,
    getUserById: mockGetUserById
  }
})

function base64UrlEncode(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function forgeUnsignedAdminToken(): string {
  return [
    base64UrlEncode({ alg: 'HS256', typ: 'JWT' }),
    base64UrlEncode({
      userId: 'attacker',
      role: 'admin',
      email: 'attacker@example.com',
      displayName: 'Attacker',
      exp: Math.floor(Date.now() / 1000) + 3600
    }),
    'invalid-signature'
  ].join('.')
}

function createTestApp() {
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', async (c, next) => {
    c.env = {
      JWT_SECRET: 'test-secret',
      DB: {},
      // Revocation-list read; null = token not revoked
      CACHE: { get: async () => null }
    } as unknown as Bindings
    await next()
  })
  app.use('/api/analytics/*', analyticsAuth)
  app.get('/api/analytics/metrics', c => c.json({ user: c.get('user') }))
  return app
}

describe('analyticsAuth JWT verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckPermission.mockResolvedValue(true)
    mockGetUserById.mockResolvedValue({
      id: 'agent-1',
      role: 'agent',
      isActive: true,
      primaryTeamId: 1,
      allowedTeamIds: [1],
      teamRoles: { 1: 'member' }
    })
  })

  test('rejects a forged Bearer token with an unsigned admin payload', async () => {
    const response = await createTestApp().request('/api/analytics/metrics', {
      headers: {
        Authorization: `Bearer ${forgeUnsignedAdminToken()}`
      }
    })

    expect(response.status).toBe(401)
    expect(mockCheckPermission).not.toHaveBeenCalled()
  })

  test('accepts a Bearer token signed with JWT_SECRET', async () => {
    // validateAccessTokenPayload allowlists type === 'access' and requires a
    // jti for the revocation list — mint the token the way /login does.
    const token = await signJWT(
      {
        userId: 'agent-1',
        role: 'agent',
        email: 'agent@example.com',
        displayName: 'Agent',
        primaryTeamId: 1,
        type: 'access',
        jti: 'test-jti-1'
      },
      'test-secret'
    )

    const response = await createTestApp().request('/api/analytics/metrics', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    const body = await response.json() as { user: { id: string; role: string; primaryTeamId: number } }

    expect(response.status).toBe(200)
    expect(body.user).toMatchObject({
      id: 'agent-1',
      role: 'agent',
      primaryTeamId: 1
    })
    expect(mockCheckPermission).toHaveBeenCalledWith(
      'agent-1',
      'analytics',
      'view',
      expect.objectContaining({ userId: 'agent-1', role: 'agent', teamId: 1 }),
      expect.anything()
    )
  })
})
