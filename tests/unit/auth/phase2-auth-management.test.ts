import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '@/types'

const mocks = vi.hoisted(() => ({
  validateAccessTokenPayload: vi.fn(),
}))

vi.mock('@/middleware/auth', () => ({
  jwtAuth: async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
    c.set('user', { id: 'admin-1', role: 'admin', isActive: true })
    await next()
  },
  requireAdmin: () => async (_c: unknown, next: () => Promise<void>) => {
    await next()
  },
  validateAccessTokenPayload: mocks.validateAccessTokenPayload,
}))

vi.mock('@/utils/auth', () => ({
  generateSystemToken: vi.fn(),
  generateMonitoringToken: vi.fn(),
  generateTokenBatch: vi.fn(),
  getUserById: vi.fn(),
}))

describe('phase2 auth management', () => {
  it('preserves revocation KV outages during token refresh validation', async () => {
    mocks.validateAccessTokenPayload.mockRejectedValueOnce(
      Object.assign(new Error('Service temporarily unavailable'), {
        status: 503,
        code: 'REVOCATION_CHECK_FAILED',
      })
    )
    const { default: phase2AuthHandler } = await import(
      '@/modules/auth/handlers/phase2-auth-management'
    )
    const app = new Hono<{ Bindings: Bindings }>()
    app.route('/', phase2AuthHandler)

    const response = await app.request('/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ token: 'access.token' }),
      headers: { 'Content-Type': 'application/json' },
    }, { JWT_SECRET: 'test-secret' } as Bindings)

    expect(response.status).toBe(503)
  })
})
