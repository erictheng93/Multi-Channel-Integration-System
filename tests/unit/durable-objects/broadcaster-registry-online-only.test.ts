import { describe, expect, it, vi } from 'vitest'
import { BroadcasterDeliveryService } from '@/durable-objects/services/broadcaster-delivery-service'
import { BroadcasterHelpers, type BroadcasterContext } from '@/durable-objects/services/broadcaster-helpers'

type FakeStub = { fetch: ReturnType<typeof vi.fn> }

function stubReporting(body: Record<string, unknown>): FakeStub {
  return { fetch: vi.fn().mockImplementation(async () => Response.json({ success: true, ...body })) }
}

function setup(registered: Record<string, FakeStub>, local: Record<string, FakeStub> = {}) {
  const userConnections = new Map(Object.entries(registered))
  const put = vi.fn().mockResolvedValue(undefined)
  const ctx = {
    env: {
      USER_CONNECTION: {
        idFromName: (name: string) => name,
        get: (name: string) => local[name]
      }
    },
    state: { storage: { put } },
    userConnections,
    conversationRooms: new Map()
  } as unknown as BroadcasterContext
  const helpers = new BroadcasterHelpers(ctx)
  vi.spyOn(helpers, 'getConversationRecipients').mockResolvedValue(new Set(['online', 'offline', 'legacy']))
  const delivery = new BroadcasterDeliveryService(ctx, helpers, {} as never)
  const event = {
    id: 'e', type: 'new_message' as const, source: 'api' as const, timestamp: Date.now(),
    priority: 'normal' as const, data: { conversationId: 'c1' }, targets: [], options: {},
    queuedAt: 0, retryCount: 0
  }
  return { userConnections, put, delivery, event }
}

describe('MessageBroadcaster registry holds online users only', () => {
  it('deliverToUser does not add an unregistered user to the registry', async () => {
    const stranger = stubReporting({ deliveredCount: 1, connections: 0 })
    const { userConnections, delivery, event } = setup({}, { stranger })
    await delivery.deliverToUser('stranger', [event])
    expect(stranger.fetch).toHaveBeenCalledOnce()
    expect(userConnections.has('stranger')).toBe(false)
  })

  it('global broadcast prunes registered users with zero sockets and persists once', async () => {
    const online = stubReporting({ deliveredCount: 1, connections: 2 })
    const offline = stubReporting({ deliveredCount: 1, connections: 0 })
    const legacy = stubReporting({ deliveredCount: 1, connections: 0 })
    const { userConnections, put, delivery, event } = setup({ online, offline, legacy })
    await delivery.deliverGlobalBroadcast([event])
    expect([...userConnections.keys()]).toEqual(['online'])
    expect(online.fetch).toHaveBeenCalledOnce()
    const writes = put.mock.calls.filter(c => c[0] === 'userConnectionIds')
    expect(writes).toHaveLength(1)
    expect(writes[0][1]).toEqual(['online'])
  })

  it('keeps a user whose response lacks connections (rolling deploy) and does not persist', async () => {
    const legacy = stubReporting({ deliveredCount: 1 })
    const { userConnections, put, delivery, event } = setup({ legacy })
    await delivery.deliverGlobalBroadcast([event])
    expect(userConnections.has('legacy')).toBe(true)
    expect(put).not.toHaveBeenCalled()
  })
})
