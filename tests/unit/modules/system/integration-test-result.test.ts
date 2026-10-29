import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { testIntegration, readLastIntegrationTest } from '../../../../src/modules/system/handlers/system-integrations'

function makeEnv() {
  const store = new Map<string, string>()
  return {
    store,
    env: {
      JWT_SECRET: 'x'.repeat(32),
      CACHE: {
        get: async (k: string) => store.get(k) ?? null,
        put: async (k: string, v: string) => { store.set(k, v) },
      },
    } as never,
  }
}

const app = new Hono()
app.post('/:platform', testIntegration)
const lineBody = JSON.stringify({ channelId: '1', channelSecret: 's', accessToken: 't' })
const post = (platform: string, env: never, body = lineBody) =>
  app.request(`/${platform}`, { method: 'POST', body }, env)

afterEach(() => vi.unstubAllGlobals())

describe('testIntegration reports failure as failure', () => {
  it('invalid token: HTTP 422, success=false, latencyMs and testedAt present, last result persisted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })))
    const { env, store } = makeEnv()
    const res = await post('line', env)
    expect(res.status).toBe(422)
    const body = await res.json() as { success: boolean; error: string; data: Record<string, unknown> }
    expect(body.success).toBe(false)
    expect(body.error).toContain('LINE')
    expect(body.data.status).toBe('error')
    expect(typeof body.data.latencyMs).toBe('number')
    expect(typeof body.data.testedAt).toBe('string')

    const last = await readLastIntegrationTest(env, 'line')
    expect(last).toMatchObject({ status: 'error' })
    expect(JSON.parse(store.get('integration-test:last:line') as string)).not.toHaveProperty('details')
  })

  it('success: HTTP 200 with latency, testedAt, persisted', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ userId: 'U1', displayName: 'Bot' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ active: true }))))
    const { env } = makeEnv()
    const res = await post('line', env)
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: { status: string; latencyMs: number; testedAt: string } }
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('success')
    expect(body.data.latencyMs).toBeGreaterThanOrEqual(0)
    expect((await readLastIntegrationTest(env, 'line'))?.status).toBe('success')
  })

  it('incomplete config is a failure, not a success', async () => {
    const { env } = makeEnv()
    const res = await post('line', env, '{}')
    expect(res.status).toBe(422)
  })

  it('unsupported platform is a failure and is not persisted', async () => {
    const { env, store } = makeEnv()
    const res = await post('telegram', env, '{}')
    expect(res.status).toBe(422)
    expect(store.size).toBe(0)
  })

  it('a KV write failure does not break the response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 401 })))
    const env = { JWT_SECRET: 'x'.repeat(32), CACHE: { get: async () => null, put: async () => { throw new Error('kv down') } } } as never
    const res = await post('line', env)
    expect(res.status).toBe(422)
  })
})
