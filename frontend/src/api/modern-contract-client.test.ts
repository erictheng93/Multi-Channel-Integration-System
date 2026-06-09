import { describe, expect, it, vi } from 'vitest'
import { callModernApiContract } from './modern-contract-client'
import { modernApiClient } from './modern-client'
import { delayedMessagesV2Contracts } from '@shared/api-contracts'

vi.mock('./modern-client', () => ({
  modernApiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

describe('callModernApiContract', () => {
  it('uses modern client GET transport', async () => {
    vi.mocked(modernApiClient.get).mockResolvedValueOnce({
      success: true,
      data: { exists: true, status: 'pending' }
    })

    await callModernApiContract(delayedMessagesV2Contracts.status, {
      messageId: 'message-1',
      conversationId: 'conversation-1'
    })

    expect(modernApiClient.get).toHaveBeenCalledWith(
      '/api/delayed-messages-v2/status/message-1?conversationId=conversation-1'
    )
  })

  it('uses modern client DELETE transport with body', async () => {
    vi.mocked(modernApiClient.delete).mockResolvedValueOnce({ success: true })

    await callModernApiContract(
      delayedMessagesV2Contracts.cancel,
      { messageId: 'message-1' },
      { conversationId: 'conversation-1', reason: 'mistake' }
    )

    expect(modernApiClient.delete).toHaveBeenCalledWith(
      '/api/delayed-messages-v2/cancel/message-1',
      { conversationId: 'conversation-1', reason: 'mistake' }
    )
  })
})
