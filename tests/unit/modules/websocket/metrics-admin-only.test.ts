import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { Bindings } from '@/types'

const holder: { role: string | null } = { role: null }
vi.mock('@/middleware/auth', () => ({
  jwtAuth: async (c: { set: (k: string, v: unknown) => void; json: (b: unknown, s: number) => Response }, next: () => Promise<void>) => {
    if (!holder.role) return c.json({ error: 'unauthenticated' }, 401)
    c.set('user', { id: 'u1', role: holder.role })
    await next()
  },
  requireAdmin: () => async (c: { get: (k: string) => { role: string }; json: (b: unknown, s: number) => Response }, next: () => Promise<void>) => {
    if (c.get('user').role !== 'admin') return c.json({ error: 'forbidden' }, 403)
    await next()
  }
}))

import { registerPreRegistryRoutes } from '@/routes/pre-registry-routes'

function makeApp() {
  const app = new Hono<{ Bindings: Bindings }>()
  registerPreRegistryRoutes(app)
  return app
}

describe('realtime metrics routes are admin-only', () => {
  for (const path of ['/api/websocket/metrics', '/api/websocket/metrics/history?range=1h']) {
    it(`${path}: anonymous -> 401, agent -> 403`, async () => {
      const app = makeApp()
      holder.role = null
      expect((await app.request(path, {}, {} as Bindings)).status).toBe(401)
      holder.role = 'agent'
      expect((await app.request(path, {}, {} as Bindings)).status).toBe(403)
    })
  }

  it('the history endpoint rejects an unknown range for admins', async () => {
    holder.role = 'admin'
    const response = await makeApp().request('/api/websocket/metrics/history?range=3d', {}, { DB: {} } as unknown as Bindings)
    expect(response.status).toBe(400)
  })
})
