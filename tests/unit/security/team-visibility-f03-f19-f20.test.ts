import Database from 'better-sqlite3'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fake auth: caller is injected through the x-test-user header (D1-reloaded user shape).
vi.mock('@/middleware/auth', () => ({
  jwtAuth: async (c: any, next: any) => {
    const user = JSON.parse(c.req.header('x-test-user') ?? 'null')
    if (!user) return c.json({ error: 'unauthorized' }, 401)
    c.set('user', user)
    c.set('jwtPayload', { userId: user.id, role: user.role, allowedTeamIds: user.allowedTeamIds })
    return next()
  }
}))

vi.mock('@/utils/database', () => ({
  getCustomerById: async (_db: unknown, id: number) => ({ id, sourceTeamId: id === 2 ? 2 : 1 })
}))

import exportRoutes from '@/modules/messaging/handlers/messaging/routes/export'
import tagMainHandler from '@/modules/tags/handlers/tag-main'
import customerHandler from '@/modules/customer/handlers/customer-main'

let sqlite: Database.Database

// Minimal D1 shim over better-sqlite3 (enough for drizzle-orm/d1).
function d1(): D1Database {
  const prepare = (query: string) => {
    let params: unknown[] = []
    const stmt = {
      bind: (...p: unknown[]) => { params = p; return stmt },
      all: async () => ({ results: sqlite.prepare(query).all(...params), success: true, meta: {} }),
      first: async () => sqlite.prepare(query).get(...params) ?? null,
      run: async () => { sqlite.prepare(query).run(...params); return { success: true, meta: {} } },
      raw: async () => sqlite.prepare(query).raw().all(...params)
    }
    return stmt
  }
  return { prepare, batch: async (s: any[]) => Promise.all(s.map((x) => x.all())) } as unknown as D1Database
}

const agent1 = { id: 'a1', role: 'agent', allowedTeamIds: [1] }
const admin = { id: 'ad', role: 'admin', allowedTeamIds: [] }
const hdr = (u: object) => ({ 'x-test-user': JSON.stringify(u) })

function app() {
  const a = new Hono<any>()
  a.route('/api/messages', exportRoutes)
  a.route('/api/tags', tagMainHandler)
  a.route('/api/customers', customerHandler)
  return a
}

beforeEach(() => {
  sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE customers (id INTEGER PRIMARY KEY, platform TEXT, platform_user_id TEXT, display_name TEXT, custom_name TEXT,
      avatar_url TEXT, email TEXT, phone TEXT, created_at TEXT, source_team_id INTEGER, deleted_at TEXT);
    CREATE TABLE conversations (id TEXT PRIMARY KEY, customer_id INTEGER, status TEXT, assigned_team_id INTEGER,
      created_at TEXT, updated_at TEXT, deleted_at TEXT);
    CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT, is_recalled INTEGER DEFAULT 0, content TEXT,
      created_at TEXT, agent_sender_id TEXT, customer_sender_id INTEGER, sender_type TEXT, sender_name TEXT,
      message_type TEXT, sent_at TEXT, delivery_status TEXT, metadata TEXT);
    CREATE TABLE agents (id TEXT PRIMARY KEY, display_name TEXT, role TEXT, is_active INTEGER);
    CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT, deleted_at TEXT);
    CREATE TABLE customer_tags (customer_id INTEGER, tag_id INTEGER, assigned_at TEXT, assigned_by TEXT);
    INSERT INTO customers (id, platform, platform_user_id, display_name, source_team_id) VALUES (1,'line','U1','Mine',1),(2,'line','U2','Foreign',2);
    INSERT INTO conversations (id, customer_id, status, assigned_team_id) VALUES ('c1',1,'active',1),('c2',2,'active',2);
    INSERT INTO messages (id, conversation_id, content, sender_type, message_type) VALUES ('m1','c1','mine','customer','text'),('m2','c2','secret','customer','text');
    INSERT INTO tags (id, name) VALUES (5,'vip');
    INSERT INTO customer_tags VALUES (1,5,'2026-01-01',NULL),(2,5,'2026-01-01',NULL);
  `)
})

const env = () => ({ DB: d1() })
const get = (path: string, user: object) => app().request(path, { headers: hdr(user) }, env())

describe('F03 export visibility', () => {
  it('agent export excludes foreign-team messages, admin sees all', async () => {
    const agentRes = await (await get('/api/messages/export', agent1)).json() as any
    expect(agentRes.data.messages.map((m: any) => m.id)).toEqual(['m1'])
    const adminRes = await (await get('/api/messages/export', admin)).json() as any
    expect(adminRes.data.messages).toHaveLength(2)
  })
  it('agent cannot target a foreign conversation', async () => {
    const res = await (await get('/api/messages/export?conversationId=c2', agent1)).json() as any
    expect(res.data.messages).toHaveLength(0)
  })
  it('export customers lists only customers with a visible conversation', async () => {
    const res = await (await get('/api/messages/export/customers', agent1)).json() as any
    expect(res.data.map((x: any) => x.id)).toEqual([1])
    expect(((await (await get('/api/messages/export/customers', admin)).json()) as any).data).toHaveLength(2)
  })
})

describe('F19 tag listings', () => {
  it('agent sees only own-team customers/conversations through a tag', async () => {
    const cust = await (await get('/api/tags/5/customers', agent1)).json() as any
    expect(cust.data.customers.map((x: any) => x.id)).toEqual([1])
    expect(cust.data.pagination.total).toBe(1)
    const conv = await (await get('/api/tags/5/conversations', agent1)).json() as any
    expect(conv.data.conversations.map((x: any) => x.id)).toEqual(['c1'])
    expect(conv.data.pagination.total).toBe(1)
  })
  it('admin sees all', async () => {
    const cust = await (await get('/api/tags/5/customers', admin)).json() as any
    expect(cust.data.pagination.total).toBe(2)
  })
})

describe('F20 customer tag routes', () => {
  it('foreign customer tags are 404 for read and write; own customer is allowed', async () => {
    expect((await get('/api/customers/2/tags', agent1)).status).toBe(404)
    const post = await app().request('/api/customers/2/tags', {
      method: 'POST', headers: { ...hdr(agent1), 'content-type': 'application/json' }, body: JSON.stringify({ tagIds: [5] })
    }, env())
    expect(post.status).toBe(404)
    const del = await app().request('/api/customers/2/tags', {
      method: 'DELETE', headers: { ...hdr(agent1), 'content-type': 'application/json' }, body: JSON.stringify({ tagIds: [5] })
    }, env())
    expect(del.status).toBe(404)
    expect((await get('/api/customers/2/tags', admin)).status).not.toBe(404)
  })
})
