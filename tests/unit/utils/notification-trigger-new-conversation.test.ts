import { describe, it, expect, vi } from 'vitest'

const createBulk = vi.fn().mockResolvedValue({ successful: ['n1'], failed: [] })
vi.mock('@modules/notifications', () => ({
  NotificationService: class { createBulk = createBulk },
  NotificationChannelService: class {}
}))
vi.mock('../../../src/db/drizzle-factory', () => ({
  createDbClient: () => ({
    select: () => ({ from: () => ({ where: () => ({ all: async () => [{ id: 'admin-1' }] }) }) })
  })
}))
vi.mock('@/services/websocket-broadcast-service', () => ({ WebSocketBroadcastService: vi.fn() }))

import { triggerNewConversationNotification } from '@/utils/notification-trigger'

describe('triggerNewConversationNotification', () => {
  it('keeps the conversation UUID in the notification data', async () => {
    const uuid = '3f2b8c1e-9a4d-4e57-8b6a-1c2d3e4f5a6b'
    const env = { DB: {} } as never
    await triggerNewConversationNotification(env, { conversationId: uuid, customerName: 'A', platform: 'FACEBOOK' })
    const req = createBulk.mock.calls[0]?.[0]?.notifications?.[0]
    expect(req?.data.conversationId).toBe(uuid)
  })
})
