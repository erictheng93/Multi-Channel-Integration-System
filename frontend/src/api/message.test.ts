import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the base module
vi.mock('./base', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    request: vi.fn(),
    delete: vi.fn()
  }
}))

// Import after mocking
import { messageApi } from './message'
import { apiClient } from './base'

// Get mock functions
const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockPut = vi.mocked(apiClient.put)
const mockRequest = vi.mocked(apiClient.request)

describe('Message API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockReset()
    mockPost.mockReset()
    mockPut.mockReset()
    mockRequest.mockReset()
  })

  describe('list', () => {
    it('should handle empty conversation ID validation', async () => {
      const result = await messageApi.list('')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('對話 ID 不能為空')
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('should fetch messages for a conversation', async () => {
      const mockMessages = [
        { id: '1', content: 'Hello', senderId: 'user1', timestamp: '2024-01-01T00:00:00Z' }
      ]
      
      mockGet.mockResolvedValue({
        success: true,
        data: mockMessages
      })

      const result = await messageApi.list('conv-123')
      
      expect(mockGet).toHaveBeenCalledWith('/conversations/conv-123/messages')
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockMessages)
    })

    it('should include query parameters', async () => {
      mockGet.mockResolvedValue({ success: true, data: [] })

      await messageApi.list('conv-123', {
        page: 1,
        pageSize: 20,
        since: '2024-01-01',
        messageType: 'text'
      })
      
      expect(mockGet).toHaveBeenCalledWith(
        '/conversations/conv-123/messages?page=1&pageSize=20&since=2024-01-01&messageType=text'
      )
    })
  })

  describe('send', () => {
    it('should handle empty conversation ID validation', async () => {
      const result = await messageApi.send('', { content: 'Hello' })
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('對話 ID 不能為空')
      expect(mockPost).not.toHaveBeenCalled()
    })

    it('should handle empty content validation', async () => {
      const result = await messageApi.send('conv-123', { content: '' })

      expect(result.success).toBe(false)
      // Updated: error message now includes attachments since messages can have attachments without text
      expect(result.error).toBe('訊息內容或附件不能為空')
      expect(mockPost).not.toHaveBeenCalled()
    })

    it('should send a message', async () => {
      const mockMessage = { id: '1', content: 'Hello', senderId: 'agent1' }
      
      mockPost.mockResolvedValue({
        success: true,
        data: mockMessage
      })

      const result = await messageApi.send('conv-123', {
        content: 'Hello'
      })
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockMessage)
      expect(mockPost).toHaveBeenCalledWith(
        '/conversations/conv-123/messages',
        {
          content: 'Hello',
          messageType: 'text',
          platform: undefined,
          replyToId: undefined,
          metadata: undefined
        }
      )
    })

    it('should trim content', async () => {
      mockPost.mockResolvedValue({ success: true, data: {} })

      await messageApi.send('conv-123', { content: '  Hello  ' })
      
      expect(mockPost).toHaveBeenCalledWith(
        '/conversations/conv-123/messages',
        expect.objectContaining({ content: 'Hello' })
      )
    })
  })

  describe('markAsRead', () => {
    it('should handle empty conversation ID validation', async () => {
      const result = await messageApi.markAsRead('')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('對話 ID 不能為空')
      expect(mockPut).not.toHaveBeenCalled()
    })

    it('should mark all messages as read', async () => {
      mockPut.mockResolvedValue({ success: true })

      const result = await messageApi.markAsRead('conv-123')
      
      expect(result.success).toBe(true)
      expect(mockPut).toHaveBeenCalledWith('/conversations/conv-123/messages/read')
    })

    it('should mark specific message as read', async () => {
      mockPut.mockResolvedValue({ success: true })

      const result = await messageApi.markAsRead('conv-123', 'msg-456')
      
      expect(result.success).toBe(true)
      expect(mockPut).toHaveBeenCalledWith('/conversations/conv-123/messages/msg-456/read')
    })
  })

  describe('get', () => {
    it('should handle missing IDs validation', async () => {
      const result = await messageApi.get('', '')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('對話 ID 和訊息 ID 不能為空')
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('should fetch a single message', async () => {
      const mockMessage = { id: '1', content: 'Hello' }
      mockGet.mockResolvedValue({ success: true, data: mockMessage })

      const result = await messageApi.get('conv-123', 'msg-456')
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockMessage)
      expect(mockGet).toHaveBeenCalledWith('/conversations/conv-123/messages/msg-456')
    })
  })

  describe('search', () => {
    it('should handle missing query validation', async () => {
      const result = await messageApi.search('conv-123', '')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('搜索關鍵字不能為空')
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('should search messages', async () => {
      const mockResults = [{ id: '1', content: 'Hello world' }]
      mockGet.mockResolvedValue({ success: true, data: mockResults })

      const result = await messageApi.search('conv-123', 'hello')
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockResults)
      expect(mockGet).toHaveBeenCalledWith(
        '/conversations/conv-123/messages/search?q=hello'
      )
    })

    it('should include message type filter', async () => {
      mockGet.mockResolvedValue({ success: true, data: [] })

      await messageApi.search('conv-123', 'hello', 'text')
      
      expect(mockGet).toHaveBeenCalledWith(
        '/conversations/conv-123/messages/search?q=hello&messageType=text'
      )
    })

    it('should include sender type and from filters', async () => {
      mockGet.mockResolvedValue({ success: true, data: [] })

      await messageApi.search('conv-123', 'hello', 'text', {
        senderType: 'customer',
        from: '2026-07-01T00:00:00.000Z'
      })

      expect(mockGet).toHaveBeenCalledWith(
        '/conversations/conv-123/messages/search?q=hello&messageType=text&senderType=customer&from=2026-07-01T00%3A00%3A00.000Z'
      )
    })
  })
})
