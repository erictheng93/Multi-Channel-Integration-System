import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('@modules/activities', () => ({
  ActivityService: class { async logActivity() { return undefined } },
  ACTIVITY_ACTIONS: { SETTINGS_UPDATE: 'SETTINGS_UPDATE' },
  RESOURCE_TYPES: { SYSTEM: 'system' },
}))

import {
  storeCredential,
  getCredential,
  getAllCredentials,
  maskCredential,
} from '../../../../src/modules/auth/handlers/credentials'

const SECRETS = {
  channelSecret: 'fake-line-secret-aaaa1234',
  accessToken: 'fake-line-token-bbbb9876',
  pageToken: 'fake-fb-page-token-cccc5555',
  appSecret: 'short',
}

function makeApp() {
  const store = new Map<string, string>()
  const env = {
    JWT_SECRET: 'test-secret-test-secret-test-secret',
    DB: {},
    CACHE: {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string) => { store.set(k, v) },
      delete: async (k: string) => { store.delete(k) },
    },
  } as never
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('user' as never, { id: 'u1', role: 'admin' } as never)
    c.set('jwtPayload' as never, { userId: 1, role: 'admin', username: 'a' } as never)
    await next()
  })
  app.post('/', storeCredential)
  app.get('/', getAllCredentials)
  app.get('/:platform/:type', getCredential)
  const put = (platform: string, type: string, value: string) =>
    app.request('/', { method: 'POST', body: JSON.stringify({ platform, type, value }) }, env)
  return { app, env, put, store }
}

describe('credentials never expose secrets', () => {
  it('maskCredential reports configured and withholds last4 for short values', () => {
    expect(maskCredential(null)).toEqual({ configured: false, last4: null })
    expect(maskCredential('')).toEqual({ configured: false, last4: null })
    expect(maskCredential('short')).toEqual({ configured: true, last4: null })
    expect(maskCredential('abcdefgh1234')).toEqual({ configured: true, last4: '1234' })
  })

  it('GET / returns only configured/last4 and no secret substring', async () => {
    const { app, env, put } = makeApp()
    await put('line', 'channelSecret', SECRETS.channelSecret)
    await put('line', 'accessToken', SECRETS.accessToken)
    await put('facebook', 'pageToken', SECRETS.pageToken)
    await put('facebook', 'appSecret', SECRETS.appSecret)

    const res = await app.request('/', {}, env)
    const text = await res.text()
    for (const secret of Object.values(SECRETS)) expect(text).not.toContain(secret)

    const body = JSON.parse(text)
    expect(body.data.line.channelSecret).toEqual({ configured: true, last4: '1234' })
    expect(body.data.line.accessToken).toEqual({ configured: true, last4: '9876' })
    expect(body.data.facebook.pageToken).toEqual({ configured: true, last4: '5555' })
    expect(body.data.facebook.appSecret).toEqual({ configured: true, last4: null })
    expect(body.data.line.channelId).toEqual({ configured: false, last4: null })
    // every leaf has exactly the masked shape
    for (const platform of ['line', 'facebook']) {
      for (const field of Object.values(body.data[platform]) as Array<Record<string, unknown>>) {
        expect(Object.keys(field).sort()).toEqual(['configured', 'last4'])
      }
    }
  })

  it('GET /:platform/:type returns the masked shape, not the value', async () => {
    const { app, env, put } = makeApp()
    await put('line', 'channelSecret', SECRETS.channelSecret)
    const res = await app.request('/line/channelSecret', {}, env)
    const text = await res.text()
    expect(text).not.toContain(SECRETS.channelSecret)
    expect(JSON.parse(text).data).toEqual({ configured: true, last4: '1234' })
    const missing = await app.request('/line/channelId', {}, env)
    expect((await missing.json() as { data: unknown }).data).toEqual({ configured: false, last4: null })
  })

  it('an empty value deletes the credential', async () => {
    const { app, env, put } = makeApp()
    await put('line', 'accessToken', SECRETS.accessToken)
    await put('line', 'accessToken', '')
    const body = await (await app.request('/', {}, env)).json() as { data: { line: { accessToken: unknown } } }
    expect(body.data.line.accessToken).toEqual({ configured: false, last4: null })
  })
})
