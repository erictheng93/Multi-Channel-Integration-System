import { describe, expect, it, vi } from 'vitest'
import { ConversationEventBroadcaster } from '@/modules/websocket/services/conversation-events'
import type { DurableObjectClient } from '@/modules/websocket/services/durable-object-client'
import type { BatchQueueManager } from '@/modules/websocket/services/batch-queue-manager'
import type { Bindings } from '@/types'

function setup() {
  const broadcast = vi.fn().mockResolvedValue(true)
  const doClient = { broadcast } as unknown as DurableObjectClient
  const broadcaster = new ConversationEventBroadcaster({} as Bindings, doClient, {} as BatchQueueManager, 'test')
  const targetTypes = () => (broadcast.mock.calls[0][0].deliveryOptions.targets as Array<{ type: string }>).map(t => t.type)
  return { broadcaster, targetTypes }
}

describe('ConversationEventBroadcaster status change delivery', () => {
  it('delivers a close/reopen (status present) to the conversation room and the global list channel', async () => {
    const { broadcaster, targetTypes } = setup()
    await broadcaster.broadcastConversationEvent({
      type: 'conversation_status_changed',
      conversationId: 'c1',
      data: { status: 'closed' }
    })
    expect(targetTypes()).toEqual(['conversation', 'global'])
  })

  it('keeps a status_changed without a status (tag change) in the conversation room only', async () => {
    const { broadcaster, targetTypes } = setup()
    await broadcaster.broadcastConversationEvent({
      type: 'conversation_status_changed',
      conversationId: 'c1',
      data: { tags: [1] }
    })
    expect(targetTypes()).toEqual(['conversation'])
  })
})
