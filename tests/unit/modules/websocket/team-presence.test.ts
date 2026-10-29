import Sqlite from 'better-sqlite3'
import { drizzle, type RemoteCallback } from 'drizzle-orm/sqlite-proxy'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { Bindings } from '@/types'
import type { Database } from '@/db/drizzle-factory'

const holder: { db: Database | null; user: Record<string, unknown> } = { db: null, user: {} }
vi.mock('@/db/drizzle-factory', () => ({ createDbClient: () => holder.db }))
vi.mock('@/middleware/auth', () => ({
  jwtAuth: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('user', holder.user)
    await next()
  }
}))

import teamPresenceApp from '@modules/websocket/handlers/team-presence'

function makeDb() {
  const sqlite = new Sqlite(':memory:')
  sqlite.exec('CREATE TABLE agent_teams (id INTEGER PRIMARY KEY, agent_id TEXT NOT NULL, team_id INTEGER NOT NULL, role_in_team TEXT, is_primary INTEGER, joined_at TEXT, created_at TEXT)')
  const insert = sqlite.prepare('INSERT INTO agent_teams (agent_id, team_id) VALUES (?, ?)')
  // team 1: a1 a2 a3, team 2: a4 a5, a2 also in team 2
  for (const [agent, team] of [['a1', 1], ['a2', 1], ['a3', 1], ['a4', 2], ['a5', 2], ['a2', 2]] as const) insert.run(agent, team)
  const execute: RemoteCallback = async (sql, params, method) => {
    const statement = sqlite.prepare(sql)
    if (method === 'run') { statement.run(...params); return { rows: [] } }
    const rows = statement.raw().all(...params)
    return { rows: method === 'get' ? rows[0] as unknown[] : rows }
  }
  return drizzle(execute, undefined, { schema }) as unknown as Database
}

function makeKv() {
  const store = new Map<string, string>()
  return {
    store,
    get: vi.fn(async (key: string) => (store.has(key) ? JSON.parse(store.get(key) as string) : null)),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value) })
  }
}

function makeEnv(online: string[] | 'down', kv = makeKv()) {
  const fetch = vi.fn(async () => {
    if (online === 'down') return new Response('x', { status: 500 })
    return Response.json({ userIds: online, count: online.length })
  })
  const env = {
    CACHE: kv,
    DB: {},
    MESSAGE_BROADCASTER: { idFromName: (n: string) => n, get: () => ({ fetch }) }
  } as unknown as Bindings
  return { env, fetch, kv }
}

async function getPresence(env: Bindings) {
  const app = new Hono<{ Bindings: Bindings }>()
  app.route('/api/team', teamPresenceApp)
  const response = await app.request('/api/team/presence', {}, env)
  return { status: response.status, body: await response.json() as { data: Record<string, unknown> } }
}

describe('GET /api/team/presence', () => {
  beforeEach(() => { holder.db = makeDb() })

  it('admin sees every online agent', async () => {
    holder.user = { id: 'admin1', role: 'admin' }
    const { env } = makeEnv(['a1', 'a4', 'admin1'])
    const { body } = await getPresence(env)
    expect(body.data.onlineAgentIds).toEqual(['a1', 'a4', 'admin1'])
    expect(body.data.self).toEqual({ id: 'admin1', registered: true })
    expect(body.data.available).toBe(true)
  })

  it('agent sees online members of their own teams only', async () => {
    holder.user = { id: 'a1', role: 'agent', allowedTeamIds: [1] }
    const { env } = makeEnv(['a1', 'a2', 'a4', 'a5', 'stranger'])
    const { body } = await getPresence(env)
    expect(body.data.onlineAgentIds).toEqual(['a1', 'a2'])
    expect(body.data.self).toEqual({ id: 'a1', registered: true })
  })

  it('multi-team agent sees the union of their teams', async () => {
    holder.user = { id: 'a2', role: 'agent', allowedTeamIds: [1, 2] }
    const { env } = makeEnv(['a1', 'a4', 'stranger'])
    const { body } = await getPresence(env)
    expect(body.data.onlineAgentIds).toEqual(['a1', 'a4'])
    expect(body.data.self).toEqual({ id: 'a2', registered: false })
  })

  it('agent with no teams sees nobody (and the DB is not queried)', async () => {
    holder.user = { id: 'loner', role: 'agent', allowedTeamIds: [] }
    const { env } = makeEnv(['a1'])
    expect((await getPresence(env)).body.data.onlineAgentIds).toEqual([])
  })

  it('empty state: nobody online', async () => {
    holder.user = { id: 'a1', role: 'agent', allowedTeamIds: [1] }
    const { env } = makeEnv([])
    const { body } = await getPresence(env)
    expect(body.data.onlineAgentIds).toEqual([])
    expect(body.data.available).toBe(true)
  })

  it('serves a second request inside 15 s from KV without asking the broadcaster again', async () => {
    holder.user = { id: 'admin1', role: 'admin' }
    const { env, fetch } = makeEnv(['a1'])
    await getPresence(env)
    await getPresence(env)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('refreshes once the cached list is older than 15 s', async () => {
    holder.user = { id: 'admin1', role: 'admin' }
    const { env, fetch, kv } = makeEnv(['a1'])
    await getPresence(env)
    const key = [...kv.store.keys()][0]
    const stale = JSON.parse(kv.store.get(key) as string)
    stale.generatedAt -= 16_000
    kv.store.set(key, JSON.stringify(stale))
    await getPresence(env)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('agents and admins never share a cache entry', async () => {
    const kv = makeKv()
    holder.user = { id: 'admin1', role: 'admin' }
    await getPresence(makeEnv(['a1', 'a4'], kv).env)
    holder.user = { id: 'a1', role: 'agent', allowedTeamIds: [1] }
    const { body } = await getPresence(makeEnv(['a1', 'a4'], kv).env)
    expect(body.data.onlineAgentIds).toEqual(['a1'])
  })

  it('reports available=false and does not cache when the broadcaster is down', async () => {
    holder.user = { id: 'admin1', role: 'admin' }
    const { env, kv } = makeEnv('down')
    const { body } = await getPresence(env)
    expect(body.data).toMatchObject({ onlineAgentIds: [], available: false })
    expect(kv.put).not.toHaveBeenCalled()
  })
})
