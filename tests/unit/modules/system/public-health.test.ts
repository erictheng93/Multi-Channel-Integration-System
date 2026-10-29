import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import settingsRouter from '../../../../src/handlers/system-settings-router'

const put = vi.fn()
const env = {
  LINE_CHANNEL_ACCESS_TOKEN: 'line-token',
  FB_PAGE_ACCESS_TOKEN: 'fb-token',
  JWT_SECRET: 'x'.repeat(32),
  DB: { prepare: () => ({ first: async () => ({ test: 1 }), all: async () => ({ results: [{ test: 1 }] }), raw: async () => [[1]], bind() { return this } }) },
  CACHE: { get: async () => null, put, delete: vi.fn() },
} as never

const app = new Hono()
app.route('/api/system', settingsRouter)

afterEach(() => vi.unstubAllGlobals())

describe('GET /api/system/health (public)', () => {
  it('makes no outbound fetch, no KV write, and exposes no channel detail or secrets', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    const res = await app.request('/api/system/health', {}, env)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(f).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
    expect(text).not.toContain('line-token')
    expect(text).not.toContain('fb-token')
    const body = JSON.parse(text) as { data: any }
    expect(body.data).not.toHaveProperty('checks.integrations')
    expect(body.data.checks.cache.status).toBe(true)
    expect(['healthy', 'unhealthy']).toContain(body.data.status)
  })
})
