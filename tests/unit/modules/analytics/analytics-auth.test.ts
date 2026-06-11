import { Hono } from 'hono'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { analyticsAuth } from '@/modules/analytics/middleware/analytics-auth'
import { signJWT } from '@/utils/auth'
import type { Bindings } from '@/types'

const { mockCheckPermission } = vi.hoisted(() => ({
  mockCheckPermission: vi.fn()
}))

vi.mock('@/services/permission-service', () => ({
  PermissionService: {
    checkPermission: mockCheckPermission
  }
}))

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
      DB: {}
    } as Bindings
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
    const token = await signJWT(
      {
        userId: 'agent-1',
        role: 'agent',
        email: 'agent@example.com',
        displayName: 'Agent',
        primaryTeamId: 1
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
