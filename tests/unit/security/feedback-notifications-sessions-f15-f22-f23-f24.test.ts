import Database from 'better-sqlite3'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fake auth: caller injected via x-test-user (D1-reloaded user shape).
const fakeAuth = async (c: any, next: any) => {
  const user = JSON.parse(c.req.header('x-test-user') ?? 'null')
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  c.set('user', user)
  c.set('jwtPayload', { userId: user.id, role: user.role, allowedTeamIds: user.allowedTeamIds })
  return next()
}
vi.mock('@/middleware/auth', () => ({ jwtAuth: (c: any, n: any) => fakeAuth(c, n) }))

const notifySvc = vi.hoisted(() => ({ notifyNewMessage: vi.fn(async () => 'n1'), notifyConversationAssigned: vi.fn(async () => 'n2') }))
vi.mock('@modules/notifications/services/notification-service', () => ({
  NotificationService: class { notifyNewMessage = notifySvc.notifyNewMessage; notifyConversationAssigned = notifySvc.notifyConversationAssigned }
}))

vi.mock('@/modules/session/middleware/session-auth', () => {
  const pass = async (_c: any, n: any) => n()
  return {
    checkSessionAccess: (c: any, n: any) => fakeAuth(c, n),
    checkSessionViewPermission: pass, checkSessionCreatePermission: pass, checkSessionUpdatePermission: pass,
    checkSessionDeletePermission: pass, checkSessionStatsPermission: pass, checkSessionBatchPermission: pass,
    logSessionOperation: pass
  }
})
vi.mock('@/modules/session/middleware/session-validation', async (orig) => {
  const actual = await orig<any>()
  const pass = async (_c: any, n: any) => n()
  return {
    ...actual, validateRequestSize: pass, validateRateLimit: pass,
    validateCreateSessionData: async (c: any, n: any) => { c.set('createSessionData', await c.req.json()); return n() }
  }
})

import { feedbackHandler } from '@/modules/system/handlers/feedback-main'
import notificationRouter from '@/modules/notifications/handlers/notification-router'
import sessionHandler from '@/modules/session/handlers/session-main'

let sqlite: Database.Database
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
const hdr = (u: object) => ({ 'x-test-user': JSON.stringify(u), 'content-type': 'application/json' })

function app() {
  const a = new Hono<any>()
  a.route('/api/feedback', feedbackHandler)
  a.route('/api/notifications', notificationRouter)
  a.route('/api/sessions', sessionHandler)
  return a
}
const env = () => ({ DB: d1(), CACHE: { get: async () => null, put: async () => undefined } })
const call = (path: string, user: object, init: RequestInit = {}) =>
  app().request(path, { ...init, headers: { ...hdr(user), ...(init.headers ?? {}) } }, env())
const post = (path: string, user: object, body: object) => call(path, user, { method: 'POST', body: JSON.stringify(body) })

beforeEach(() => {
  notifySvc.notifyNewMessage.mockClear(); notifySvc.notifyConversationAssigned.mockClear()
  sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE customers (id INTEGER PRIMARY KEY, platform TEXT, platform_user_id TEXT, display_name TEXT, custom_name TEXT, deleted_at TEXT);
    CREATE TABLE agents (id TEXT PRIMARY KEY, display_name TEXT);
    CREATE TABLE conversations (id TEXT PRIMARY KEY, customer_id INTEGER, status TEXT, assigned_team_id INTEGER, deleted_at TEXT);
    CREATE TABLE customer_feedback (id TEXT PRIMARY KEY, conversation_id TEXT, customer_id INTEGER, agent_id TEXT, rating INTEGER,
      comment TEXT, feedback_type TEXT, metadata TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE conversation_sessions (id TEXT PRIMARY KEY, conversation_id TEXT, session_type TEXT DEFAULT 'continuous', topic TEXT,
      start_time TEXT NOT NULL, end_time TEXT, last_activity TEXT NOT NULL, message_count INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT);
    INSERT INTO customers (id, display_name) VALUES (1,'Mine'),(2,'Foreign'),(3,'Pool');
    INSERT INTO agents (id, display_name) VALUES ('a1','A1'),('a2','A2');
    INSERT INTO conversations (id, customer_id, assigned_team_id) VALUES ('c1',1,1),('c2',2,2),('c3',3,NULL);
    INSERT INTO customer_feedback VALUES ('f1','c1',1,'a1',5,'mine','satisfaction',NULL,'2026-01-01','2026-01-01'),
      ('f2','c2',2,'a2',1,'SECRET','satisfaction',NULL,'2026-01-02','2026-01-02');
    INSERT INTO conversation_sessions (id, conversation_id, topic, start_time, last_activity) VALUES
      ('11111111-1111-4111-8111-111111111111','c1','OWN','2026-01-01','2026-01-01'),('22222222-2222-4222-8222-222222222222','c2','OTHER','2026-01-01','2026-01-01'),('33333333-3333-4333-8333-333333333333','c3','POOL','2026-01-01','2026-01-01');
  `)
})

describe('F15 feedback', () => {
  it('list and stats only include visible conversations', async () => {
    const list = await (await call('/api/feedback', agent1)).json() as any
    expect(list.data.feedback.map((f: any) => f.id)).toEqual(['f1'])
    expect(list.data.pagination.total).toBe(1)
    const stats = await (await call('/api/feedback/stats?timeRange=all', agent1)).json() as any
    expect(stats.data.totalFeedback).toBe(1)
    const all = await (await call('/api/feedback', admin)).json() as any
    expect(all.data.feedback).toHaveLength(2)
  })
  it('per-conversation read: foreign 403, own and admin ok', async () => {
    expect((await call('/api/feedback/conversation/c2', agent1)).status).toBe(403)
    expect((await call('/api/feedback/conversation/c1', agent1)).status).toBe(200)
    expect((await call('/api/feedback/conversation/c2', admin)).status).toBe(200)
  })
  it('submit: foreign 403; own attributes to caller and real customer', async () => {
    const body = { conversationId: 'c2', customerId: 2, agentId: 'a2', rating: 1 }
    expect((await post('/api/feedback', agent1, body)).status).toBe(403)
    expect(sqlite.prepare('SELECT COUNT(*) n FROM customer_feedback').get()).toEqual({ n: 2 })
    const ok = await post('/api/feedback', agent1, { conversationId: 'c1', customerId: 999, agentId: 'a2', rating: 4 })
    expect(ok.status).toBe(200)
    expect(sqlite.prepare("SELECT customer_id c, agent_id a FROM customer_feedback WHERE rating=4").get()).toEqual({ c: 1, a: 'a1' })
  })
})

describe('F22 notifications', () => {
  const nm = { userId: 'a2', conversationId: 'c1', senderName: 'x', content: 'y' }
  const ca = { userId: 'a2', conversationId: 'c1', customerName: 'x', assignedBy: 'Admin' }
  it('agent cannot notify another user', async () => {
    expect((await post('/api/notifications/new-message', agent1, nm)).status).toBe(403)
    expect((await post('/api/notifications/conversation-assigned', agent1, ca)).status).toBe(403)
    expect(notifySvc.notifyNewMessage).not.toHaveBeenCalled()
    expect(notifySvc.notifyConversationAssigned).not.toHaveBeenCalled()
  })
  it('self and admin are allowed', async () => {
    expect((await post('/api/notifications/new-message', agent1, { ...nm, userId: 'a1' })).status).toBe(200)
    expect((await post('/api/notifications/conversation-assigned', admin, ca)).status).toBe(200)
  })
})

describe('F23 session reads', () => {
  it('list, search and topic stats exclude foreign-team sessions', async () => {
    const list = await (await call('/api/sessions', agent1)).json() as any
    expect(list.data.sessions.map((s: any) => s.id).sort()).toEqual(['11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333'])
    const search = await (await call('/api/sessions/search?query=OTHER', agent1)).json() as any
    expect(search.data.map((s: any) => s.id)).not.toContain('22222222-2222-4222-8222-222222222222')
    const topics = await (await call('/api/sessions/topics/stats', agent1)).json() as any
    expect(topics.data.topicsBySession.map((s: any) => s.sessionId)).not.toContain('22222222-2222-4222-8222-222222222222')
    const adminList = await (await call('/api/sessions', admin)).json() as any
    expect(adminList.data.sessions).toHaveLength(3)
  })
  it('foreign session messages/health are denied', async () => {
    expect((await call('/api/sessions/22222222-2222-4222-8222-222222222222/messages', agent1)).status).toBe(403)
    expect((await call('/api/sessions/22222222-2222-4222-8222-222222222222/health', agent1)).status).toBe(403)
  })
})

describe('F24 session writes', () => {
  it('create and get-or-create on a foreign conversation are denied and write nothing', async () => {
    expect((await post('/api/sessions', agent1, { conversationId: 'c2', senderType: 'agent', topic: 'x' })).status).toBe(403)
    expect((await post('/api/sessions/get-or-create', agent1, { conversation_id: 'c2', messageContent: 'btw', senderType: 'customer' })).status).toBe(403)
    expect(sqlite.prepare('SELECT COUNT(*) n FROM conversation_sessions').get()).toEqual({ n: 3 })
    expect(sqlite.prepare("SELECT is_active a FROM conversation_sessions WHERE id='22222222-2222-4222-8222-222222222222'").get()).toEqual({ a: 1 })
  })
  it('own conversation is allowed', async () => {
    const res = await post('/api/sessions/get-or-create', agent1, { conversation_id: 'c1', messageContent: 'hello', senderType: 'agent' })
    expect(res.status).toBe(200)
  })
  it('close of foreign session is denied', async () => {
    expect((await post('/api/sessions/22222222-2222-4222-8222-222222222222/close', agent1, {})).status).toBe(403)
  })
})
