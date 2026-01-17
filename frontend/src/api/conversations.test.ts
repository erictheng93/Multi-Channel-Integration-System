import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to ensure mocks are available
const { mockGet, mockPost, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn()
}))

// Mock base API client
vi.mock('./base', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    put: mockPut
  }
}))

// Import after mocking
import { conversationApi } from './conversations'

describe('Conversations API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('List Operations', () => {
    it('should get conversations without filters', async () => {
      const mockResponse = { success: true, data: [] }
      mockGet.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.getConversations()
      
      expect(mockGet).toHaveBeenCalledWith('/conversations')
      expect(result).toEqual(mockResponse)
    })

    it('should get conversations with filters', async () => {
      const filters = { status: 'open' as const, platform: 'line' as const }
      const mockResponse = { success: true, data: [] }
      mockGet.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.getConversations(filters)
      
      expect(mockGet).toHaveBeenCalledWith('/conversations?status=open&platform=line')
      expect(result).toEqual(mockResponse)
    })

    it('should list conversations with pagination params', async () => {
      const params = { page: 1, pageSize: 20, status: 'assigned' as const }
      const mockResponse = { 
        success: true, 
        data: { 
          items: [], 
          total: 0, 
          page: 1, 
          pageSize: 20 
        } 
      }
      mockGet.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.list(params)
      
      expect(mockGet).toHaveBeenCalledWith('/conversations?page=1&pageSize=20&status=assigned')
      expect(result).toEqual(mockResponse)
    })

    it('should get conversation stats', async () => {
      const mockStats = {
        total: 100,
        open: 30,
        assigned: 50,
        closed: 20,
        unreadCount: 15
      }
      const mockResponse = { success: true, data: mockStats }
      mockGet.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.getStats()
      
      expect(mockGet).toHaveBeenCalledWith('/conversations/stats')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('Individual Conversation Operations', () => {
    it('should get single conversation', async () => {
      const conversationId = 'conv-123'
      const mockConversation = {
        id: conversationId,
        customerId: 1,
        assignedTeamId: null,
        assignedUserId: null,
        status: 'active' as const,
        lastMessageAt: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        customerName: 'Test Customer',
        platform: 'line' as const,
        platformUserId: 'user123',
        lastMessageContent: 'Hello',
        unreadCount: 0
      }
      const mockResponse = { success: true, data: mockConversation }
      mockGet.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.getConversation(conversationId)
      
      expect(mockGet).toHaveBeenCalledWith(`/conversations/${conversationId}`)
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      if (result.success && result.data) {
        expect(result.data.id).toBe(conversationId)
        expect(result.data.status).toBe('active') // Status is passed through as-is
      }
    })

    it('should reject empty conversation ID', async () => {
      const result = await conversationApi.getConversation('')
      
      expect(result).toEqual({ success: false, error: '對話 ID 不能為空' })
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('should reject whitespace-only conversation ID', async () => {
      const result = await conversationApi.getConversation('   ')
      
      expect(result).toEqual({ success: false, error: '對話 ID 不能為空' })
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('should use alias method get', async () => {
      const conversationId = 'conv-123'
      const mockConversation = {
        id: conversationId,
        customerId: 1,
        assignedTeamId: null,
        assignedUserId: null,
        status: 'active' as const,
        lastMessageAt: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        customerName: 'Test Customer',
        platform: 'line' as const,
        platformUserId: 'user123',
        lastMessageContent: 'Hello',
        unreadCount: 0
      }
      const mockResponse = { success: true, data: mockConversation }
      mockGet.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.get(conversationId)
      
      expect(mockGet).toHaveBeenCalledWith(`/conversations/${conversationId}`)
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      if (result.success && result.data) {
        expect(result.data.id).toBe(conversationId)
      }
    })
  })

  describe('Message Operations', () => {
    it('should get messages without params', async () => {
      const conversationId = 'conv-123'
      const mockResponse = { success: true, data: [] }
      mockGet.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.getMessages(conversationId)
      
      expect(mockGet).toHaveBeenCalledWith(`/conversations/${conversationId}/messages`)
      expect(result).toEqual(mockResponse)
    })

    it('should get messages with pagination params', async () => {
      const conversationId = 'conv-123'
      const params = { page: 1, pageSize: 50, since: '2024-01-01' }
      const mockResponse = { success: true, data: [] }
      mockGet.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.getMessages(conversationId, params)
      
      expect(mockGet).toHaveBeenCalledWith(
        `/conversations/${conversationId}/messages?page=1&pageSize=50&since=2024-01-01`
      )
      expect(result).toEqual(mockResponse)
    })

    it('should reject empty conversation ID for messages', async () => {
      const result = await conversationApi.getMessages('')
      
      expect(result).toEqual({ success: false, error: '對話 ID 不能為空' })
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('should send message successfully', async () => {
      const conversationId = 'conv-123'
      const request = { content: 'Hello world', messageType: 'text' as const }
      const mockMessage = { id: 'msg-123', content: 'Hello world' }
      const mockResponse = { success: true, data: mockMessage }
      mockPost.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.sendMessage(conversationId, request)
      
      expect(mockPost).toHaveBeenCalledWith(
        `/conversations/${conversationId}/messages`,
        { content: 'Hello world', messageType: 'text', platform: undefined }
      )
      expect(result).toEqual(mockResponse)
    })

    it('should trim whitespace from message content', async () => {
      const conversationId = 'conv-123'
      const request = { content: '  Hello world  ' }
      const mockResponse = { success: true, data: {} }
      mockPost.mockResolvedValue(mockResponse)
      
      await conversationApi.sendMessage(conversationId, request)
      
      expect(mockPost).toHaveBeenCalledWith(
        `/conversations/${conversationId}/messages`,
        { content: 'Hello world', messageType: 'text', platform: undefined }
      )
    })

    it('should reject empty message content', async () => {
      const conversationId = 'conv-123'
      const request = { content: '' }
      
      const result = await conversationApi.sendMessage(conversationId, request)
      
      expect(result).toEqual({ success: false, error: '訊息內容不能為空' })
      expect(mockPost).not.toHaveBeenCalled()
    })

    it('should reject whitespace-only message content', async () => {
      const conversationId = 'conv-123'
      const request = { content: '   ' }
      
      const result = await conversationApi.sendMessage(conversationId, request)
      
      expect(result).toEqual({ success: false, error: '訊息內容不能為空' })
      expect(mockPost).not.toHaveBeenCalled()
    })
  })

  describe('Conversation Management', () => {
    it('should assign conversation successfully', async () => {
      const conversationId = 'conv-123'
      const agentId = 'agent-456'
      const mockConversationData = {
        id: conversationId,
        customerId: 'customer-123',
        customerName: 'Test Customer',
        platform: 'line' as const,
        status: 'open' as const,
        assignedUserId: agentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      const mockResponse = { success: true, data: mockConversationData }
      mockPost.mockResolvedValue(mockResponse)

      const result = await conversationApi.assignConversation(conversationId, agentId)

      expect(mockPost).toHaveBeenCalledWith(
        `/conversations/${conversationId}/assign`,
        { userId: agentId }
      )
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('should reject empty IDs for assignment', async () => {
      const result1 = await conversationApi.assignConversation('', 'agent-123')
      const result2 = await conversationApi.assignConversation('conv-123', '')

      expect(result1).toEqual({ success: false, error: '對話 ID 不能為空' })
      expect(result2).toEqual({ success: false, error: '請指定團隊或客服人員' })
      expect(mockPost).not.toHaveBeenCalled()
    })

    it('should use alias assign method', async () => {
      const conversationId = 'conv-123'
      const agentId = 'agent-456'
      const mockConversationData = {
        id: conversationId,
        customerId: 'customer-123',
        customerName: 'Test Customer',
        platform: 'line' as const,
        status: 'open' as const,
        assignedUserId: agentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      const mockResponse = { success: true, data: mockConversationData }
      mockPost.mockResolvedValue(mockResponse)

      const result = await conversationApi.assign(conversationId, agentId)

      expect(mockPost).toHaveBeenCalledWith(
        `/conversations/${conversationId}/assign`,
        { userId: agentId }
      )
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('should close conversation with reason', async () => {
      const conversationId = 'conv-123'
      const reason = 'Issue resolved'
      const mockResponse = { success: true }
      mockPut.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.closeConversation(conversationId, reason)
      
      expect(mockPut).toHaveBeenCalledWith(
        `/conversations/${conversationId}/close`,
        { reason }
      )
      expect(result).toEqual(mockResponse)
    })

    it('should close conversation without reason', async () => {
      const conversationId = 'conv-123'
      const mockResponse = { success: true }
      mockPut.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.closeConversation(conversationId)
      
      expect(mockPut).toHaveBeenCalledWith(
        `/conversations/${conversationId}/close`,
        undefined
      )
      expect(result).toEqual(mockResponse)
    })

    it('should use alias close method', async () => {
      const conversationId = 'conv-123'
      const mockResponse = { success: true }
      mockPut.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.close(conversationId)
      
      expect(mockPut).toHaveBeenCalledWith(
        `/conversations/${conversationId}/close`,
        undefined
      )
      expect(result).toEqual(mockResponse)
    })

    it('should reopen conversation', async () => {
      const conversationId = 'conv-123'
      const mockResponse = { success: true }
      mockPut.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.reopenConversation(conversationId)
      
      expect(mockPut).toHaveBeenCalledWith(`/conversations/${conversationId}/reopen`)
      expect(result).toEqual(mockResponse)
    })

    it('should mark conversation as read', async () => {
      const conversationId = 'conv-123'
      const mockResponse = { success: true }
      mockPut.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.markAsRead(conversationId)
      
      expect(mockPut).toHaveBeenCalledWith(`/conversations/${conversationId}/read`)
      expect(result).toEqual(mockResponse)
    })

    it('should set conversation tags', async () => {
      const conversationId = 'conv-123'
      const tags = ['urgent', 'vip']
      const mockResponse = { success: true }
      mockPut.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.setTags(conversationId, tags)
      
      expect(mockPut).toHaveBeenCalledWith(
        `/conversations/${conversationId}/tags`,
        { tags }
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('Search Operations', () => {
    it('should search conversations', async () => {
      const query = 'test search'
      const mockConversation = {
        id: 'conv-123',
        customerId: 1,
        assignedTeamId: null,
        assignedUserId: null,
        status: 'active' as const,
        lastMessageAt: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        customerName: 'Test Customer',
        platform: 'line' as const,
        platformUserId: 'user123',
        lastMessageContent: 'Hello',
        unreadCount: 0
      }
      const mockResponse = { 
        success: true, 
        data: { 
          items: [mockConversation],
          total: 1 
        } 
      }
      mockGet.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.search(query)
      
      expect(mockGet).toHaveBeenCalledWith('/conversations?search=test+search')
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      if (result.success && result.data && Array.isArray(result.data)) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0]?.id).toBe('conv-123')
        expect(result.data[0]?.status).toBe('active') // Status is passed through as-is
      }
    })

    it('should search with filters', async () => {
      const query = 'urgent'
      const filters = { status: 'open' as const, platform: 'line' as const }
      const mockResponse = { 
        success: true, 
        data: { 
          items: [],
          total: 0 
        } 
      }
      mockGet.mockResolvedValue(mockResponse)
      
      await conversationApi.search(query, filters)
      
      expect(mockGet).toHaveBeenCalledWith(
        '/conversations?status=open&platform=line&search=urgent'
      )
    })

    it('should reject empty search query', async () => {
      const result = await conversationApi.search('')
      
      expect(result).toEqual({ success: false, error: '搜索關鍵字不能為空' })
      expect(mockGet).not.toHaveBeenCalled()
    })

    it('should trim search query', async () => {
      const query = '  test  '
      const mockResponse = { success: true, data: { items: [], total: 0 } }
      mockGet.mockResolvedValue(mockResponse)
      
      await conversationApi.search(query)
      
      expect(mockGet).toHaveBeenCalledWith('/conversations?search=test')
    })

    it('should handle search API error', async () => {
      const query = 'test'
      const mockResponse = { success: false, error: 'Search failed' }
      mockGet.mockResolvedValue(mockResponse)
      
      const result = await conversationApi.search(query)
      
      expect(result).toEqual({ success: false, error: 'Search failed' })
    })
  })
})