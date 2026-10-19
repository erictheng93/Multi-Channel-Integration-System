import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

let currentUser: Record<string, unknown> = {}

vi.mock('@/middleware/auth', async () => {
  const actual = await vi.importActual<typeof import('@/middleware/auth')>('@/middleware/auth')
  return {
    ...actual,
    jwtAuth: vi.fn(async (c: any, next: any) => {
      c.set('user', currentUser)
      c.set('jwtPayload', { userId: currentUser.id, type: 'access' })
      await next()
    })
  }
})

// Any DB access means the guard let the request through.
const dbTouched = vi.fn()
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => {
    dbTouched()
    return {}
  })
}))

import rules from '@/modules/auto-reply/handlers/auto-reply-rules'
import schedules from '@/modules/auto-reply/handlers/auto-reply-schedules'
import logs from '@/modules/auto-reply/handlers/auto-reply-logs'

const app = new Hono()
app.route('/rules', rules)
app.route('/schedules', schedules)
app.route('/logs', logs)
const env = { DB: {} }
const call = (method: string, path: string) =>
  app.request(path, { method, body: method === 'GET' ? undefined : '{}' }, env)

describe('auto-reply authorization (F02/F11/F12)', () => {
  it('non-admin agent cannot write rules or schedules', async () => {
    currentUser = { id: 'a', role: 'agent', allowedTeamIds: [1] }
    for (const [m, p] of [
      ['POST', '/rules?scope=global'], ['POST', '/rules?teamId=2'],
      ['PUT', '/rules/70'], ['DELETE', '/rules/70'], ['POST', '/schedules?teamId=2']
    ]) {
      expect((await call(m, p)).status).toBe(403)
    }
    expect(dbTouched).not.toHaveBeenCalled()
  })

  it('admin passes the write guard', async () => {
    currentUser = { id: 'adm', role: 'admin', allowedTeamIds: [] }
    expect((await call('DELETE', '/rules/70')).status).not.toBe(403)
    expect(dbTouched).toHaveBeenCalled()
  })

  it('agent cannot read other team logs/rules/schedules via ?teamId=', async () => {
    dbTouched.mockClear()
    currentUser = { id: 'a', role: 'agent', allowedTeamIds: [1] }
    // handlers open the db client before the check; the 403 (not the 500 from the mock) proves the guard ran
    expect((await call('GET', '/logs?teamId=2')).status).toBe(403)
    expect((await call('GET', '/rules?teamId=2')).status).toBe(403)
    expect((await call('GET', '/schedules?teamId=2')).status).toBe(403)
  })

  it('member passes the teamId check for own team', async () => {
    currentUser = { id: 'a', role: 'agent', allowedTeamIds: [1] }
    await call('GET', '/logs?teamId=1')
    expect(dbTouched).toHaveBeenCalled()
  })
})
