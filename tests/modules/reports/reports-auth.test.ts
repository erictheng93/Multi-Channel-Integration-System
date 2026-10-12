// Regression for #68: the frontend authenticates with the httpOnly access cookie and never
// sends an Authorization header. checkReportsAccess used to accept only `Bearer`, so every
// reports request was 401 and the frontend logged the user out on opening the reports pages.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

const jwtAuth = vi.fn()
vi.mock('@/middleware/auth', () => ({
  jwtAuth: (c: unknown, next: unknown) => jwtAuth(c, next),
  validateAccessToken: vi.fn()
}))

import { checkReportsAccess } from '@/modules/reports/middleware/reports-auth'

function app() {
  const a = new Hono()
  a.use('*', checkReportsAccess as never)
  a.get('/reports', (c) => c.json({ ok: true, payload: c.get('jwtPayload' as never) }))
  return a
}

describe('checkReportsAccess', () => {
  beforeEach(() => {
    jwtAuth.mockReset()
  })

  it('accepts cookie-only requests (no Authorization header) by delegating to jwtAuth', async () => {
    jwtAuth.mockImplementation(async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
      c.set('jwtPayload', { userId: 'u1', role: 'admin' })
      await next()
    })

    const res = await app().request('/reports', { headers: { Cookie: 'access_token=abc' } })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, payload: { userId: 'u1', role: 'admin' } })
    expect(jwtAuth).toHaveBeenCalledTimes(1)
  })

  it('returns what jwtAuth returns when the cookie is missing or invalid', async () => {
    jwtAuth.mockImplementation(async (c: { json: (b: unknown, s: number) => Response }) =>
      c.json({ error: 'Missing or invalid auth cookie' }, 401)
    )

    const res = await app().request('/reports')

    expect(res.status).toBe(401)
  })
})
