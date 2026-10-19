import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

// Every DB terminal (get/all/await) pops the next queued result.
const queue: unknown[] = []
const next = () => (queue.length ? queue.shift() : undefined)
const chain: any = new Proxy(function () {}, {
  get: (_t, prop) => {
    if (prop === 'get' || prop === 'all') return () => Promise.resolve(next())
    if (prop === 'then') return (res: (v: unknown) => void) => res(next())
    return () => chain
  },
  apply: () => chain
})
vi.mock('@/db/drizzle-factory', () => ({ createDbClient: () => chain }))

const mockAccess = vi.fn()
vi.mock('@/services/conversation-access', () => ({
  canConversationBeAccessedBy: (...a: unknown[]) => mockAccess(...a)
}))

let currentUser: any
vi.mock('@/middleware/auth', () => ({
  jwtAuth: async (c: any, n: any) => {
    c.set('user', currentUser)
    c.set('jwtPayload', { userId: currentUser.id, role: 'agent', allowedTeamIds: [1, 2] }) // stale JWT claims
    await n()
  }
}))
vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))
vi.mock('@modules/activities', () => ({
  ActivityService: class { logActivity = () => Promise.resolve() },
  ACTIVITY_ACTIONS: {}, RESOURCE_TYPES: {}
}))
vi.mock('@/utils/file-url', () => ({
  getSignedFileUrl: async () => 'u', PERSISTENT_ATTACHMENT_URL_TTL_SECONDS: 1
}))
vi.mock('@/services/websocket-broadcast-service', () => ({ WebSocketBroadcastService: class {} }))

import conversationRoutes from '@/modules/messaging/handlers/messaging/routes/conversation'
import attachmentRoutes from '@/modules/messaging/handlers/messaging/routes/attachments'
import forwardingRoutes from '@/modules/messaging/handlers/messaging/routes/forwarding'
import bulkRoutes from '@/modules/messaging/handlers/messaging/routes/bulk'
import conversationTagsHandler from '@/modules/conversations/handlers/conversation-tags'
import delayedHandler from '@/modules/delayed-message/handlers/delayed-message-buffer'

const doFetch = vi.fn()
const env = {
  DELAYED_MESSAGE_SCHEDULER: { idFromName: () => 'id', get: () => ({ fetch: doFetch }) }
}
const app = new Hono()
app.route('/m', conversationRoutes).route('/m', attachmentRoutes).route('/m', forwardingRoutes)
  .route('/m', bulkRoutes).route('/c', conversationTagsHandler).route('/d', delayedHandler)
const call = (path: string, init?: RequestInit) => app.request(path, init, env as any)
const json = (method: string, body: unknown) => ({
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
})
const denied = { allowed: false, conversation: { id: 'x' } }
const allowed = { allowed: true, conversation: { id: 'x' } }

beforeEach(() => {
  queue.length = 0
  mockAccess.mockReset()
  doFetch.mockReset()
  currentUser = { id: 'a1', role: 'agent', allowedTeamIds: [1] }
})

describe('F04 messaging routes apply conversation visibility', () => {
  it('GET /conversation/:id denies a foreign conversation, passes the D1-reloaded user', async () => {
    mockAccess.mockResolvedValue(denied)
    expect((await call('/m/conversation/conv_b')).status).toBe(403)
    expect(mockAccess.mock.calls[0][1]).toEqual({ userId: 'a1', role: 'agent', allowedTeamIds: [1] })
  })

  it('GET /:id/attachments hides a foreign message', async () => {
    queue.push({ id: 'msg', conversationId: 'conv_b' })
    mockAccess.mockResolvedValue(denied)
    expect((await call('/m/msg/attachments')).status).toBe(404)
  })

  it('GET /:id/attachments allows a visible message', async () => {
    queue.push({ id: 'msg', conversationId: 'conv_a' }, [])
    mockAccess.mockResolvedValue(allowed)
    expect((await call('/m/msg/attachments')).status).toBe(200)
  })

  it('POST /:id/attachments denies a customer message in a foreign conversation', async () => {
    queue.push({ id: 'msg', conversationId: 'conv_b', senderType: 'customer', agentSenderId: null })
    mockAccess.mockResolvedValue(denied)
    const fd = new FormData()
    fd.append('file', new File(['x'], 'a.png', { type: 'image/png' }))
    expect((await call('/m/msg/attachments', { method: 'POST', body: fd })).status).toBe(404)
  })

  it('POST /:id/forward denies a foreign source message', async () => {
    queue.push({ id: 'msg', conversationId: 'conv_b', content: 'secret' })
    mockAccess.mockResolvedValue(denied)
    expect((await call('/m/msg/forward', json('POST', { targetConversationIds: ['conv_a'] }))).status).toBe(404)
  })

  it('POST /:id/forward skips a foreign target conversation', async () => {
    queue.push({ id: 'msg', conversationId: 'conv_a', content: 'hi' }, [{ id: 'conv_b' }])
    mockAccess.mockResolvedValueOnce(allowed).mockResolvedValueOnce(denied)
    const res = await call('/m/msg/forward', json('POST', { targetConversationIds: ['conv_b'] }))
    const body = (await res.json()) as any
    expect(body.data.successCount).toBe(0)
    expect(body.data.errors).toHaveLength(1)
  })

  it('POST /bulk-create rejects an inaccessible conversation', async () => {
    queue.push([{ id: 'conv_b' }])
    mockAccess.mockResolvedValue(denied)
    const res = await call('/m/bulk-create', json('POST', { messages: [{ conversationId: 'conv_b', content: 'x' }] }))
    const body = (await res.json()) as any
    expect(body.data.results).toHaveLength(0)
    expect(body.data.errors[0].error).toBe('Conversation not found')
  })

  it('POST /bulk-delete does not recall a foreign or customer message', async () => {
    queue.push([
      { id: 'm1', conversationId: 'conv_b', senderType: 'customer', agentSenderId: null },
      { id: 'm2', conversationId: 'conv_a', senderType: 'customer', agentSenderId: null }
    ])
    mockAccess.mockImplementation(async (_e: unknown, _p: unknown, id: string) => (id === 'conv_a' ? allowed : denied))
    const res = await call('/m/bulk-delete', json('POST', { messageIds: ['m1', 'm2'] }))
    const body = (await res.json()) as any
    expect(body.data.results).toHaveLength(0)
    expect(body.data.errors.map((e: any) => e.error)).toEqual(['Message not found', 'Permission denied'])
  })

  it('conversation tags GET/POST/DELETE return 403 for a foreign conversation', async () => {
    mockAccess.mockResolvedValue(denied)
    expect((await call('/c/conv_b/tags')).status).toBe(403)
    expect((await call('/c/conv_b/tags', json('POST', { tagIds: [1] }))).status).toBe(403)
    expect((await call('/c/conv_b/tags', json('DELETE', { tagIds: [1] }))).status).toBe(403)
  })
})

describe('F14 delayed-messages-v2 cancel/pending/status', () => {
  it('cancel is denied for a foreign conversation and never reaches the DO', async () => {
    mockAccess.mockResolvedValue(denied)
    const res = await call('/d/cancel/m1', json('DELETE', { conversationId: 'conv_b' }))
    expect(res.status).toBe(404)
    expect(doFetch).not.toHaveBeenCalled()
  })

  it('cancel is denied for a non-sender agent on a visible conversation', async () => {
    mockAccess.mockResolvedValue(allowed)
    queue.push({ senderType: 'agent', agentSenderId: 'someone-else' })
    const res = await call('/d/cancel/m1', json('DELETE', { conversationId: 'conv_a' }))
    expect(res.status).toBe(403)
    expect(doFetch).not.toHaveBeenCalled()
  })

  it('cancel works for the sender', async () => {
    mockAccess.mockResolvedValue(allowed)
    queue.push({ senderType: 'agent', agentSenderId: 'a1' })
    doFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })))
    const res = await call('/d/cancel/m1', json('DELETE', { conversationId: 'conv_a' }))
    expect(res.status).toBe(200)
  })

  it('cancel works for an admin with no D1 row', async () => {
    currentUser = { id: 'adm', role: 'admin', allowedTeamIds: [] }
    mockAccess.mockResolvedValue(allowed)
    queue.push(undefined)
    doFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })))
    expect((await call('/d/cancel/m1', json('DELETE', { conversationId: 'conv_a' }))).status).toBe(200)
  })

  it('pending and status are denied for a foreign conversation', async () => {
    mockAccess.mockResolvedValue(denied)
    expect((await call('/d/pending?conversationId=conv_b')).status).toBe(404)
    expect((await call('/d/status/m1?conversationId=conv_b')).status).toBe(404)
    expect(doFetch).not.toHaveBeenCalled()
  })
})

describe('F18 message-service attachment linking', () => {
  async function run(eligibleRows: Array<{ id: string }>) {
    const { MessageService } = await import('@modules/conversations/services/message-service')
    const inserted: any[] = []
    const updates: any[] = []
    const selects: unknown[][] = [
      [{ conversation: { id: 'conv_a' }, customer: { platform: 'facebook', platformUserId: 'u' } }],
      eligibleRows
    ]
    const sel = (): any => {
      const rows = selects.shift() ?? []
      const c: any = { from: () => c, leftJoin: () => c, where: () => c, limit: () => c, orderBy: () => c,
        then: (r: any, j?: any) => Promise.resolve(rows).then(r, j), get: async () => rows[0] }
      return c
    }
    const db: any = {
      select: sel,
      insert: () => ({ values: async (v: unknown) => { inserted.push(v) } }),
      update: () => ({ set: (v: unknown) => ({ where: async () => { updates.push(v) } }) })
    }
    const svc = new MessageService({ DB: {}, KV_CACHE: undefined } as any)
    ;(svc as any).db = db
    await svc.createPendingMessage({ conversationId: 'conv_a', content: 'x', senderId: 'a1', attachmentIds: ['foreign'] } as any).catch(() => {})
    return { inserted, updates: updates.filter(u => 'messageId' in u) }
  }

  it('does not link attachments the sender does not own for this conversation', async () => {
    const { inserted, updates } = await run([])
    expect(updates).toHaveLength(0)
    expect(JSON.parse(inserted[0].metadata).attachmentIds).toBeUndefined()
  })

  it('links the sender own upload from the same conversation', async () => {
    const { updates } = await run([{ id: 'foreign' }])
    expect(updates[0]).toMatchObject({ conversationId: 'conv_a' })
  })
})
