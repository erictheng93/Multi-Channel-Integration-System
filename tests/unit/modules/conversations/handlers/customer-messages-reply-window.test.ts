import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '@/types'

const NOW = vi.hoisted(() => 1777267800000)

const mocks = vi.hoisted(() => ({
  verifyConversationAccess: vi.fn(),
  row: undefined as { token: string | null; receivedAt: number | null } | undefined,
  recallSeconds: 0
}))

vi.mock('@/modules/customer-conversations/utils/conversation-auth', () => ({
  verifyConversationAccess: mocks.verifyConversationAccess
}))

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      get: vi.fn(async () => mocks.row)
    }
    return { select: vi.fn(() => chain) }
  })
}))

vi.mock('@/services/recall-window-config', () => ({
  getRecallWindowSeconds: vi.fn(async () => mocks.recallSeconds)
}))

vi.mock('@/utils/timestamp', () => ({
  nowMs: vi.fn(() => NOW)
}))

import customerMessagesHandler from '@/modules/customer-conversations/handlers/customer-messages'

function createApp() {
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', async (c, next) => {
    c.env = { DB: {} } as unknown as Bindings
    await next()
  })
  app.route('/customer-conversations', customerMessagesHandler)
  return app
}

const headers = { 'X-Session-Id': 'valid-token' }

describe('GET /customer-conversations/:id/reply-window', () => {
  beforeEach(() => {
    mocks.verifyConversationAccess.mockReset()
    mocks.verifyConversationAccess.mockResolvedValue({ payload: { userId: 'agent-1' }, conversation: { id: 'conv-1' } })
    mocks.row = undefined
    mocks.recallSeconds = 0
  })

  it('returns 403 for a conversation the agent cannot access', async () => {
    mocks.verifyConversationAccess.mockRejectedValue(Object.assign(new Error('Access denied to this conversation'), { status: 403 }))

    const response = await createApp().request('/customer-conversations/conv-2/reply-window', { headers })

    expect(response.status).toBe(403)
  })

  it('returns 401 without a session', async () => {
    const response = await createApp().request('/customer-conversations/conv-1/reply-window')

    expect(response.status).toBe(401)
  })

  it('is unavailable when no token is stored', async () => {
    mocks.row = { token: null, receivedAt: null }

    const response = await createApp().request('/customer-conversations/conv-1/reply-window', { headers })

    expect(await response.json()).toEqual({ success: true, data: { available: false, expiresAt: null } })
  })

  it('is available until received_at + 50s and never exposes the token', async () => {
    mocks.row = { token: 'secret-token', receivedAt: NOW - 10000 }

    const response = await createApp().request('/customer-conversations/conv-1/reply-window', { headers })
    const text = await response.text()

    expect(JSON.parse(text)).toEqual({ success: true, data: { available: true, expiresAt: NOW + 40000 } })
    expect(text).not.toContain('secret-token')
  })

  it('subtracts the recall window and reports unavailable when it exceeds the remaining time', async () => {
    mocks.row = { token: 'secret-token', receivedAt: NOW - 10000 }
    mocks.recallSeconds = 60

    const response = await createApp().request('/customer-conversations/conv-1/reply-window', { headers })

    expect(await response.json()).toEqual({ success: true, data: { available: false, expiresAt: NOW - 20000 } })
  })
})
