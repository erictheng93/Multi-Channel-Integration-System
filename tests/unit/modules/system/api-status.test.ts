import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../../../../src/middleware/auth', async (orig) => {
  const real = await orig<typeof import('../../../../src/middleware/auth')>()
  return {
    ...real,
    jwtAuth: async (c: any, next: any) => {
      c.set('user', { id: 'u1', role: c.req.header('X-U') })
      c.set('jwtPayload', { userId: 1, role: 'admin', username: 'x' })
      await next()
    },
  }
})

import settingsRouter from '../../../../src/handlers/system-settings-router'

function makeEnv() {
  const store = new Map<string, string>()
  return {
    LINE_CHANNEL_ACCESS_TOKEN: 'line-token',
    FB_PAGE_ACCESS_TOKEN: 'fb-token',
    JWT_SECRET: 'x'.repeat(32),
    DB: { prepare: () => ({ first: async () => ({}) }) },
    R2_BUCKET: { head: async () => null },
    CACHE: {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string) => { store.set(k, v) },
    },
  } as never
}

const app = new Hono()
app.route('/api/system', settingsRouter)

afterEach(() => vi.unstubAllGlobals())

describe('GET /api/system/api-status', () => {
  it('rejects agents with 403 and never calls LINE/FB', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    const res = await app.request('/api/system/api-status', { headers: { 'X-U': 'agent' } }, makeEnv())
    expect(res.status).toBe(403)
    expect(f).not.toHaveBeenCalled()
  })

  it('caches the outbound LINE/FB checks for repeated admin polls', async () => {
    const f = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ displayName: 'Bot', id: '1', name: 'Page' })))
    vi.stubGlobal('fetch', f)
    const env = makeEnv()

    const first = await app.request('/api/system/api-status', { headers: { 'X-U': 'admin' } }, env)
    expect(first.status).toBe(200)
    const callsAfterFirst = f.mock.calls.length
    expect(callsAfterFirst).toBeGreaterThan(0)

    const second = await app.request('/api/system/api-status', { headers: { 'X-U': 'admin' } }, env)
    expect(second.status).toBe(200)
    expect(f.mock.calls.length).toBe(callsAfterFirst)

    const body = await second.json() as { data: { channels: Array<{ id: string; lastCheck: string }> } }
    expect(body.data.channels.map(c => c.id)).toEqual(expect.arrayContaining(['line', 'facebook']))
  })
})
