import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./modern-client', () => ({
  modernApiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn()
  }
}))

import delayedMessagesApi from './delayedMessages'
import { modernApiClient } from './modern-client'

describe('delayedMessagesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends delayed messages and unwraps response data', async () => {
    vi.mocked(modernApiClient.post).mockResolvedValueOnce({
      success: true,
      data: {
        id: 'message-1',
        conversationId: 'conversation-1',
        content: 'hello',
        platform: 'line',
        scheduledAt: 1,
        canCancelUntil: 2,
        delaySeconds: 5
      }
    })

    const result = await delayedMessagesApi.send({
      conversationId: 'conversation-1',
      content: 'hello',
      platform: 'line',
      recipientPlatformId: 'customer-1'
    })

    expect(modernApiClient.post).toHaveBeenCalledWith('/api/delayed-messages-v2/send', {
      conversationId: 'conversation-1',
      content: 'hello',
      platform: 'line',
      recipientPlatformId: 'customer-1'
    })
    expect(result.id).toBe('message-1')
  })

  it('cancels delayed messages', async () => {
    vi.mocked(modernApiClient.delete).mockResolvedValueOnce({ success: true })

    await delayedMessagesApi.cancel({
      messageId: 'message-1',
      conversationId: 'conversation-1',
      reason: 'mistake'
    })

    expect(modernApiClient.delete).toHaveBeenCalledWith('/api/delayed-messages-v2/cancel/message-1', {
      conversationId: 'conversation-1',
      reason: 'mistake'
    })
  })

  it('lists pending messages', async () => {
    vi.mocked(modernApiClient.get).mockResolvedValueOnce({
      success: true,
      data: {
        count: 1,
        messages: [{ id: 'message-1', content: 'hello', scheduledAt: 1, timeRemaining: 5 }]
      }
    })

    const result = await delayedMessagesApi.listPending('conversation-1')

    expect(modernApiClient.get).toHaveBeenCalledWith(
      '/api/delayed-messages-v2/pending?conversationId=conversation-1'
    )
    expect(result).toHaveLength(1)
  })
})
