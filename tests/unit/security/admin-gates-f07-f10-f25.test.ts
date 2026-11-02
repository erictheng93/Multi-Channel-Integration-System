import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

// jwtAuth stand-in: user (D1-reloaded) comes from X-U, jwtPayload carries a stale admin claim.
vi.mock('../../../src/middleware/auth', async (orig) => {
  const real = await orig<typeof import('../../../src/middleware/auth')>()
  return {
    ...real,
    jwtAuth: async (c: any, next: any) => {
      c.set('user', { id: 'u1', role: c.req.header('X-U') })
      c.set('jwtPayload', { userId: 1, role: 'admin', username: 'x' })
      await next()
    },
  }
})

import credentialsRouter from '../../../src/handlers/credentials-router'
import settingsRouter from '../../../src/handlers/system-settings-router'
import { testIntegration } from '../../../src/modules/system/handlers/system-integrations'
import { getCredential } from '../../../src/modules/auth/handlers/credentials'

const env = { DB: {}, CACHE: { get: async () => null } } as never

describe('F10/F25: admin gates use the D1 role, not the JWT claim', () => {
  const app = new Hono()
  app.route('/api/credentials', credentialsRouter)
  app.route('/api/system', settingsRouter)

  it.each([
    ['GET', '/api/credentials'],
    ['GET', '/api/credentials/line/channelSecret'],
    ['GET', '/api/credentials/backup'],
    ['PUT', '/api/system/settings'],
    ['POST', '/api/system/integrations/facebook/test'],
  ])('demoted agent with admin claim gets 403 on %s %s', async (method, path) => {
    const res = await app.request(path, { method, headers: { 'X-U': 'agent' }, body: method === 'GET' ? undefined : '{}' }, env)
    expect(res.status).toBe(403)
  })

  it('handler itself also rejects (defence in depth)', async () => {
    const h = new Hono()
    h.use('*', async (c, next) => { c.set('user' as never, { role: 'agent' } as never); c.set('jwtPayload' as never, { role: 'admin' } as never); await next() })
    h.get('/:platform/:type', getCredential)
    expect((await h.request('/line/x', {}, env)).status).toBe(403)
  })

  it('admin passes the gate (reaches handler)', async () => {
    const res = await app.request('/api/credentials', { headers: { 'X-U': 'admin' } }, env)
    expect(res.status).not.toBe(403)
  })

  it('F25: non-numeric Facebook pageId is rejected before any fetch', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    const h = new Hono()
    h.post('/:platform', testIntegration)
    const res = await h.request('/facebook', {
      method: 'POST',
      body: JSON.stringify({ appId: '1', appSecret: 's', pageToken: 't', pageId: 'me/feed?method=post' }),
    }, env)
    expect(res.status).toBe(422)
    expect((await res.json() as any).data.status).toBe('error')
    expect(f).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
