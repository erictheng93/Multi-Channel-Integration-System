import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDelayedMessage } from './useDelayedMessage'

// Mock the API client
vi.mock('@/api/base', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn()
  }
}))

import { apiClient } from '@/api/base'
const mockPost = vi.mocked(apiClient.post)
const mockGet = vi.mocked(apiClient.get)

describe('useDelayedMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendDelayedMessage', () => {
    it('should send delayed message successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          messageId: 'msg-123',
          canRecall: true,
          recallDeadline: '2024-01-01T12:00:00Z',
          delaySeconds: 30,
          scheduledSendTime: '2024-01-01T11:59:30Z'
        }
      }
      mockPost.mockResolvedValue(mockResponse)

      const { sendDelayedMessage } = useDelayedMessage()

      const request = {
        conversationId: 1,
        content: 'Test delayed message',
        delaySeconds: 30
      }

      const result = await sendDelayedMessage(request)

      expect(mockPost).toHaveBeenCalledWith('/api/messages/delayed/send', request)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResponse.data)
    })

    it('should handle send delayed message failure', async () => {
      const mockResponse = {
        success: false,
        error: 'Validation failed'
      }
      mockPost.mockResolvedValue(mockResponse)

      const { sendDelayedMessage, error } = useDelayedMessage()

      const request = {
        conversationId: 1,
        content: 'Test message',
        delaySeconds: 30
      }

      const result = await sendDelayedMessage(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Validation failed')
      expect(error.value).toBe('Validation failed')
    })

    it('should handle network errors', async () => {
      mockPost.mockRejectedValue(new Error('Network error'))

      const { sendDelayedMessage, error } = useDelayedMessage()

      const request = {
        conversationId: 1,
        content: 'Test message',
        delaySeconds: 30
      }

      const result = await sendDelayedMessage(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
      expect(error.value).toBe('Network error')
    })

    it('should set loading state during request', async () => {
      let resolvePromise!: (_value: { success: boolean; data?: unknown }) => void
      const promise = new Promise<{ success: boolean; data?: unknown }>(resolve => {
        resolvePromise = resolve
      })
      mockPost.mockReturnValue(promise)

      const { sendDelayedMessage, isLoading } = useDelayedMessage()

      const request = {
        conversationId: 1,
        content: 'Test message',
        delaySeconds: 30
      }

      const resultPromise = sendDelayedMessage(request)

      expect(isLoading.value).toBe(true)

      resolvePromise({ success: true, data: {} })
      await resultPromise

      expect(isLoading.value).toBe(false)
    })
  })

  describe('recallMessage', () => {
    it('should recall message successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          messageId: 'msg-123',
          recalled: true,
          recalledAt: '2024-01-01T12:00:00Z'
        }
      }
      mockPost.mockResolvedValue(mockResponse)

      const { recallMessage, pendingMessages } = useDelayedMessage()

      // Set up initial pending messages
      pendingMessages.value = [
        { 
          id: 'msg-123', 
          content: 'Test', 
          conversationId: 1,
          customerName: 'Test Customer',
          messageType: 'text',
          platform: 'line',
          delaySeconds: 30,
          scheduledSendTime: new Date().toISOString(),
          recallDeadline: new Date().toISOString(),
          status: 'pending' as const,
          createdAt: new Date().toISOString(),
          canRecall: true
        },
        { 
          id: 'msg-456', 
          content: 'Test 2', 
          conversationId: 1,
          customerName: 'Test Customer 2',
          messageType: 'text',
          platform: 'line',
          delaySeconds: 30,
          scheduledSendTime: new Date().toISOString(),
          recallDeadline: new Date().toISOString(),
          status: 'pending' as const,
          createdAt: new Date().toISOString(),
          canRecall: true
        }
      ]

      const result = await recallMessage('msg-123')

      expect(mockPost).toHaveBeenCalledWith('/api/messages/delayed/recall', { messageId: 'msg-123' })
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResponse.data)
      expect(pendingMessages.value).toHaveLength(1)
      expect(pendingMessages.value[0]?.id).toBe('msg-456')
    })

    it('should handle recall failure', async () => {
      const mockResponse = {
        success: false,
        error: 'Recall deadline has passed'
      }
      mockPost.mockResolvedValue(mockResponse)

      const { recallMessage, error } = useDelayedMessage()

      const result = await recallMessage('msg-123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Recall deadline has passed')
      expect(error.value).toBe('Recall deadline has passed')
    })

    it('should handle network errors during recall', async () => {
      mockPost.mockRejectedValue(new Error('Network timeout'))

      const { recallMessage, error } = useDelayedMessage()

      const result = await recallMessage('msg-123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network timeout')
      expect(error.value).toBe('Network timeout')
    })
  })

  describe('getPendingMessages', () => {
    it('should get pending messages successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [
            {
              id: 'msg-1',
              conversationId: 1,
              content: 'Test message 1',
              delaySeconds: 30,
              status: 'pending',
              canRecall: true
            },
            {
              id: 'msg-2',
              conversationId: 1,
              content: 'Test message 2',
              delaySeconds: 60,
              status: 'pending',
              canRecall: true
            }
          ],
          pagination: {
            page: 1,
            pageSize: 20,
            total: 2,
            totalPages: 1
          }
        }
      }
      mockGet.mockResolvedValue(mockResponse)

      const { getPendingMessages, pendingMessages } = useDelayedMessage()

      const result = await getPendingMessages(1, 1, 20, 'pending')

      expect(mockGet).toHaveBeenCalledWith('/api/messages/delayed/list?page=1&pageSize=20&status=pending&conversationId=1')
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResponse.data)
      expect(pendingMessages.value).toEqual(mockResponse.data.items)
    })

    it('should get pending messages without conversation filter', async () => {
      const mockResponse = {
        success: true,
        data: {
          items: [],
          pagination: {
            page: 1,
            pageSize: 20,
            total: 0,
            totalPages: 0
          }
        }
      }
      mockGet.mockResolvedValue(mockResponse)

      const { getPendingMessages } = useDelayedMessage()

      await getPendingMessages()

      expect(mockGet).toHaveBeenCalledWith('/api/messages/delayed/list?page=1&pageSize=20&status=pending')
    })

    it('should handle get pending messages failure', async () => {
      const mockResponse = {
        success: false,
        error: 'Unauthorized'
      }
      mockGet.mockResolvedValue(mockResponse)

      const { getPendingMessages, error } = useDelayedMessage()

      const result = await getPendingMessages(1)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unauthorized')
      expect(error.value).toBe('Unauthorized')
    })

    it('should handle network errors during get', async () => {
      mockGet.mockRejectedValue(new Error('Connection failed'))

      const { getPendingMessages, error } = useDelayedMessage()

      const result = await getPendingMessages(1)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Connection failed')
      expect(error.value).toBe('Connection failed')
    })
  })

  describe('utility methods', () => {
    it('should clear error', () => {
      const { error, clearError } = useDelayedMessage()

      error.value = 'Some error'
      expect(error.value).toBe('Some error')

      clearError()
      expect(error.value).toBeNull()
    })

    it('should reset all state', () => {
      const { isLoading, pendingMessages, error, reset } = useDelayedMessage()

      // Set some state
      isLoading.value = true
      pendingMessages.value = [{ 
        id: 'test',
        conversationId: 1,
        customerName: 'Test Customer',
        content: 'Test message',
        messageType: 'text',
        platform: 'line',
        delaySeconds: 30,
        scheduledSendTime: new Date().toISOString(),
        recallDeadline: new Date().toISOString(),
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        canRecall: true
      }]
      error.value = 'Some error'

      reset()

      expect(isLoading.value).toBe(false)
      expect(pendingMessages.value).toEqual([])
      expect(error.value).toBeNull()
    })
  })

  describe('state management', () => {
    it('should initialize with correct default values', () => {
      const { isLoading, pendingMessages, error } = useDelayedMessage()

      expect(isLoading.value).toBe(false)
      expect(pendingMessages.value).toEqual([])
      expect(error.value).toBeNull()
    })

    it('should maintain separate state for multiple instances', () => {
      const instance1 = useDelayedMessage()
      const instance2 = useDelayedMessage()

      instance1.error.value = 'Error 1'
      instance2.error.value = 'Error 2'

      expect(instance1.error.value).toBe('Error 1')
      expect(instance2.error.value).toBe('Error 2')
    })
  })
})