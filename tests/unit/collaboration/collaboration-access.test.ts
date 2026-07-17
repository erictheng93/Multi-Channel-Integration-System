import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { Bindings } from '@/types'

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  where: vi.fn(),
}))

vi.mock('@/middleware/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('@/middleware/auth')>()
  return {
    ...actual,
    jwtAuth: vi.fn(async (c, next) => {
      c.set('user', {
        id: 'agent-1',
        email: 'agent@example.com',
        displayName: 'Agent One',
        role: 'agent',
        isActive: true,
        allowedTeamIds: [7],
        teamRoles: { 7: 'member' },
        primaryTeamId: 7,
      })
      c.set('jwtPayload', {
        userId: 'agent-1',
        displayName: 'Agent One',
        role: 'agent',
        type: 'access',
        jti: 'access-jti',
      })
      await next()
    }),
    requireAdmin: vi.fn(() => async (_c, next) => next()),
  }
})

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mocks.where,
      })),
    })),
  })),
}))

vi.mock('@modules/collaboration/services/collaboration-manager', () => ({
  collaboration: {
    getConversationState: mocks.getState,
    getConversationViewers: vi.fn(),
    joinConversation: vi.fn(),
    leaveConversation: vi.fn(),
    sendTyping: vi.fn(),
    updatePresence: vi.fn(),
    getStats: vi.fn(),
    cleanup: vi.fn(),
    isInitialized: vi.fn(() => true),
    getConfig: vi.fn(() => ({ defaultProtocol: 'websocket', enableWebSocket: true })),
    getAvailableProtocols: vi.fn(() => ['websocket']),
  },
}))

import collaborationMainHandler from '@/modules/collaboration/handlers/collaboration-main'

function createApp() {
  const app = new Hono<{ Bindings: Bindings }>()
  app.use('*', async (c, next) => {
    c.env = { DB: {} as D1Database } as Bindings
    await next()
  })
  app.route('/', collaborationMainHandler)
  return app
}

describe('collaboration conversation access', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset())
    mocks.where.mockReturnValue({
      get: vi.fn(async () => ({
        id: 'conv-uuid-1',
        customerId: 42,
        assignedTeamId: 7,
      })),
    })
    mocks.getState.mockResolvedValue({
      conversationId: 'conv-uuid-1',
      viewers: [],
      typing: [],
      totalConnections: 0,
      protocol: 'websocket',
      lastActivity: '2026-01-01T00:00:00.000Z',
    })
  })

  it('accepts string conversation ids and uses a point lookup for access', async () => {
    const response = await createApp().request('/conversations/conv-uuid-1/state')

    expect(response.status).toBe(200)
    expect(mocks.where).toHaveBeenCalledTimes(1)
    expect(mocks.getState).toHaveBeenCalledWith('conv-uuid-1', undefined)
  })
})
