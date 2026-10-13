import SQLite from 'better-sqlite3'
import { getTableColumns, getTableName } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDbClient } from '@/db/drizzle-factory'
import { messages, fileAttachments, conversations, customers, teams, conversationReadStates, agents, agentTeams } from '@/db/schema'
import type { Bindings } from '@/types'
import type { ConversationSession } from '@/modules/session/types/session-types'

// Keep the existing Node test setup; queries run against real SQLite through
// Drizzle's D1 adapter rather than mocked query results.
vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(protected ctx: DurableObjectState, protected env: Bindings) {}
  }
}))
vi.mock('@/middleware/auth', () => ({
  jwtAuth: async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
    c.set('jwtPayload', { userId: 'agent-1', role: 'admin' })
    c.set('user', { id: 'agent-1', role: 'admin' })
    await next()
  }
}))
vi.mock('@/utils/file-url', () => ({
  getSignedDownloadUrl: vi.fn(async () => 'https://files.test/download'),
  getPublicFileUrl: vi.fn(),
  getSignedFileUrl: vi.fn(),
  PERSISTENT_ATTACHMENT_URL_TTL_SECONDS: 3600
}))

import { CustomerMessageDO } from '@/durable-objects/CustomerMessageDO'
import attachmentRoutes from '@/modules/messaging/handlers/messaging/routes/attachments'
import { SessionMessageService } from '@/modules/session/services/session-message-service'
import { LatestMessageCache } from '@/services/latest-message-cache'
import conversationQueriesHandler from '@/modules/conversations/handlers/conversation-queries'

let sqlite: SQLite.Database
let env: Bindings
let object: CustomerMessageDO
const cachePut = vi.fn()

beforeEach(() => {
  sqlite = new SQLite(':memory:')
  for (const table of [messages, fileAttachments, conversations, customers, teams, conversationReadStates, agents, agentTeams]) {
    const columns = Object.values(getTableColumns(table))
      .map(column => `"${column.name}" ${column.getSQLType()}`)
    sqlite.exec(`CREATE TABLE "${getTableName(table)}" (${columns.join(', ')})`)
  }
  const insert = sqlite.prepare(`INSERT INTO messages
    (id, conversation_id, sender_type, customer_sender_id, content, message_type,
     created_at, deleted_at, session_id, session_sequence)
    VALUES (?, 'conv-1', 'customer', 1, ?, 'text', ?, ?, 'session-1', ?)`)
  for (let i = 1; i <= 5; i++) {
    insert.run(`m${i}`, `message ${i}`, `2026-10-13T00:00:0${i}Z`, i === 3 ? 'deleted' : null, i)
  }
  sqlite.exec(`INSERT INTO messages (id, conversation_id, created_at, content)
    VALUES ('foreign', 'conv-2', '2026-10-13T00:00:02Z', 'other conversation');
    INSERT INTO file_attachments (id, message_id, filename, r2_key)
    VALUES ('a3', 'm3', 'deleted.txt', 'deleted'), ('a5', 'm5', 'visible.txt', 'visible')`)
  sqlite.exec(`INSERT INTO customers (id, platform, platform_user_id, display_name, created_at)
    VALUES (1, 'line', 'line-1', 'Customer', '2026-10-13T00:00:00Z');
    INSERT INTO conversations (id, customer_id, status, priority, created_at, updated_at)
    VALUES ('conv-1', 1, 'active', 'medium', '2026-10-13T00:00:00Z', '2026-10-13T00:00:05Z')`)
  sqlite.exec("INSERT INTO agents (id, role, is_active) VALUES ('agent-1', 'admin', 1)")
  const d1 = {
    prepare(query: string) {
      const statement = {
        params: [] as unknown[],
        bind(...params: unknown[]) { this.params = params; return this },
        async raw() { return sqlite.prepare(query).raw().all(...this.params) },
        async all() { return { results: sqlite.prepare(query).all(...this.params) } },
        async first() { return sqlite.prepare(query).get(...this.params) ?? null },
        async run() { return { meta: { changes: sqlite.prepare(query).run(...this.params).changes } } }
      }
      return statement
    }
  } as unknown as D1Database
  env = { DB: d1, CACHE: { get: vi.fn(async () => null), put: cachePut } } as unknown as Bindings
  object = new CustomerMessageDO({} as DurableObjectState, env)
})
afterEach(() => sqlite.close())

async function load(query = '') {
  const response = await object.fetch(new Request(`https://do.test/messages${query}`, {
    headers: { 'X-Conversation-Id': 'conv-1' }
  }))
  expect(response.status).toBe(200)
  return await response.json() as {
    messages: Array<{ id: string; file_attachments: Array<{ id: string }> }>
    hasMore: boolean
  }
}

describe('soft-deleted message read visibility', () => {
  it('filters before limiting and excludes deleted attachments', async () => {
    const result = await load('?limit=3')
    expect(result.messages.map(message => message.id)).toEqual(['m5', 'm4', 'm2'])
    expect(result.hasMore).toBe(true)
    expect(result.messages.flatMap(message => message.file_attachments.map(file => file.id)))
      .toEqual(['a5'])
    const next = await load('?limit=3&before=m2')
    expect(next.messages.map(message => message.id)).toEqual(['m1'])
    expect(next.hasMore).toBe(false)
  })

  it('uses a deleted message as a cursor anchor without returning it', async () => {
    expect((await load('?before=m3')).messages.map(message => message.id)).toEqual(['m2', 'm1'])
  })

  it.each(['missing', 'foreign', 'null-time'])('filters the fallback for cursor %s', async before => {
    if (before === 'null-time') {
      sqlite.exec(`INSERT INTO messages (id, conversation_id, deleted_at)
        VALUES ('null-time', 'conv-1', 'deleted')`)
    }
    expect((await load(`?before=${before}`)).messages.map(message => message.id))
      .toEqual(['m5', 'm4', 'm2', 'm1'])
  })

  it('returns no messages or attachments when the conversation is fully deleted', async () => {
    sqlite.exec("UPDATE messages SET deleted_at = 'deleted' WHERE conversation_id = 'conv-1'")
    expect(await load()).toEqual({ success: true, messages: [], hasMore: false })
    expect(await load('?before=m3')).toEqual({ success: true, messages: [], hasMore: false })
  })

  it.each(['GET', 'POST'])('rejects %s attachments for a deleted message', async method => {
    const response = await attachmentRoutes.request('/m3/attachments', { method }, env)
    expect(response.status).toBe(404)
  })

  it('still returns attachments for a visible message', async () => {
    const response = await attachmentRoutes.request('/m5/attachments', {}, env)
    expect(response.status).toBe(200)
    expect(JSON.stringify(await response.json())).toContain('visible.txt')
  })

  it('keeps session totals and pages consistent with the visible messages', async () => {
    const service = new SessionMessageService(createDbClient(env.DB))
    const getSession = async () => ({ id: 'session-1' }) as ConversationSession
    const page = await service.getMessages('session-1', 2, 2, getSession)
    expect(page.messages.map(message => message.id)).toEqual(['m4', 'm5'])
    expect(page.messageCount).toBe(4)
    expect(page.pagination).toMatchObject({ total: 4, totalPages: 2, hasNext: false })
  })

  it('does not reuse the sequence of a deleted last message', async () => {
    sqlite.exec("UPDATE messages SET deleted_at = 'deleted' WHERE id = 'm5'")
    const service = new SessionMessageService(createDbClient(env.DB))
    const added = await service.addMessage('session-1', {
      conversationId: 'conv-1', senderType: 'customer', senderId: '1',
      content: 'new', messageType: 'text'
    }, async () => ({ id: 'session-1' }) as ConversationSession, vi.fn())
    expect(added.sessionSequence).toBe(6)
  })

  it('refills the latest-message cache with the same visible message as the window', async () => {
    sqlite.exec("UPDATE messages SET deleted_at = 'deleted' WHERE id = 'm5'")
    const latest = await new LatestMessageCache(env).getLatestMessage('conv-1')
    expect(latest?.messageId).toBe('m4')
    expect(latest?.messageId).toBe((await load()).messages[0].id)
    expect(cachePut).toHaveBeenCalledWith('latest_msg:conv-1', expect.any(String), expect.anything())
  })

  it('does not repopulate the cache when all messages are deleted', async () => {
    sqlite.exec("UPDATE messages SET deleted_at = 'deleted' WHERE conversation_id = 'conv-1'")
    expect(await new LatestMessageCache(env).getLatestMessage('conv-1')).toBeNull()
    expect(cachePut).not.toHaveBeenCalled()
  })

  it('keeps list and detail previews consistent with the conversation window', async () => {
    sqlite.exec("UPDATE messages SET deleted_at = 'deleted' WHERE id = 'm5'")
    const listResponse = await conversationQueriesHandler.request('/', {}, env)
    expect(listResponse.status).toBe(200)
    const list = await listResponse.json() as { data: Array<{ lastMessage: { id: string } }> }
    const detailResponse = await conversationQueriesHandler.request('/conv-1', {}, env)
    expect(detailResponse.status).toBe(200)
    const detail = await detailResponse.json() as { data: { lastMessage: { id: string } } }
    const window = await load()
    expect(list.data[0].lastMessage.id).toBe('m4')
    expect(detail.data.lastMessage.id).toBe(window.messages[0].id)
    expect(list.data[0].lastMessage.id).toBe(window.messages[0].id)
  })

  it('excludes deleted rows sharing the latest visible timestamp from list previews', async () => {
    sqlite.exec("UPDATE messages SET deleted_at = 'deleted', created_at = '2026-10-13T00:00:05Z', content = 'hidden' WHERE id = 'm3'")
    const response = await conversationQueriesHandler.request('/', {}, env)
    expect(response.status).toBe(200)
    const list = await response.json() as { data: Array<{ lastMessage: { id: string } }> }
    expect(list.data[0].lastMessage.id).toBe('m5')
  })

  it('returns empty previews and session pages when every message is deleted', async () => {
    sqlite.exec("UPDATE messages SET deleted_at = 'deleted'")
    const listResponse = await conversationQueriesHandler.request('/', {}, env)
    const list = await listResponse.json() as { data: Array<{ lastMessage: unknown }> }
    expect(listResponse.status).toBe(200)
    expect(list.data[0].lastMessage).toBeNull()
    const detailResponse = await conversationQueriesHandler.request('/conv-1', {}, env)
    const detail = await detailResponse.json() as { data: { lastMessage: unknown } }
    expect(detailResponse.status).toBe(200)
    expect(detail.data.lastMessage).toBeNull()
    const service = new SessionMessageService(createDbClient(env.DB))
    const page = await service.getMessages('session-1', 1, 2,
      async () => ({ id: 'session-1' }) as ConversationSession)
    expect(page.messages).toEqual([])
    expect(page.messageCount).toBe(0)
    expect(await new LatestMessageCache(env).warmupCache()).toBe(0)
    expect(cachePut).not.toHaveBeenCalled()
  })

  it('does not warm up a deleted-only conversation ahead of visible conversations', async () => {
    sqlite.exec("UPDATE messages SET deleted_at = 'deleted' WHERE conversation_id = 'conv-2'")
    sqlite.exec("UPDATE messages SET created_at = '2026-10-14T00:00:00Z' WHERE id = 'foreign'")
    expect(await new LatestMessageCache(env).warmupCache(1)).toBe(1)
    expect(cachePut).toHaveBeenCalledWith('latest_msg:conv-1', expect.any(String), expect.anything())
  })
})
