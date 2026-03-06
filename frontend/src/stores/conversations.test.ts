import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock the APIs first
const mockConversationApi = {
  list: vi.fn(),
  getConversation: vi.fn(),
  getMessages: vi.fn(),
  assignConversation: vi.fn(),
  markAsRead: vi.fn(),
  getStats: vi.fn()
}

const mockMessageApi = {
  list: vi.fn(),
  send: vi.fn(),
  sendMessage: vi.fn(),
  retryMessage: vi.fn(),
  recallMessage: vi.fn()
}

const mockAuthStore = {
  currentAgent: { id: 'agent-1', name: 'Test Agent', role: 'agent' }
}

vi.mock('@/api/conversations', () => ({
  conversationApi: mockConversationApi
}))

vi.mock('@/api/message', () => ({
  messageApi: mockMessageApi
}))

vi.mock('./auth', () => ({
  useAuthStore: () => mockAuthStore
}))

describe('Conversations Store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('State Management', () => {
    it('should initialize with empty state', async () => {
      const { useConversationsStore } = await import('./conversations')
      const store = useConversationsStore()
      
      expect(store.conversations).toEqual([])
      expect(store.currentConversation).toBe(null)
      expect(store.messages).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBe(null)
    })

    it('should initialize with default filters and pagination', async () => {
      const { useConversationsStore } = await import('./conversations')
      const store = useConversationsStore()

      expect(store.filters).toEqual({
        status: undefined,
        platform: undefined,
        teamId: undefined
      })
      expect(store.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0
      })
    })

    it('should initialize with zero stats', async () => {
      const { useConversationsStore } = await import('./conversations')
      const store = useConversationsStore()
      
      expect(store.stats).toEqual({
        total: 0,
        active: 0,
        assigned: 0,
        pending: 0,
        unreadCount: 0
      })
    })
  })

  describe('Load Conversations', () => {
    it('should load conversations successfully', async () => {
      const mockConversations = [
        { id: 'conv-1', status: 'active', platform: 'line', lastMessage: { content: 'Hello' } },
        { id: 'conv-2', status: 'assigned', platform: 'line', lastMessage: { content: 'Hi' } }
      ]
      const mockResponse = {
        success: true,
        data: {
          items: mockConversations,
          total: 2,
          page: 1,
          pageSize: 20
        }
      }
      
      mockConversationApi.list.mockResolvedValue(mockResponse)
      
      const { useConversationsStore } = await import('./conversations')
      const store = useConversationsStore()
      
      await store.loadConversations()
      
      expect(store.conversations).toEqual(mockConversations)
      expect(store.pagination.total).toBe(2)
      expect(store.loading).toBe(false)
      expect(store.error).toBe(null)
    })

    it('should pass search parameter to API when set', async () => {
      const mockResponse = {
        success: true,
        data: []
      }
      mockConversationApi.list.mockResolvedValue(mockResponse)

      const { useConversationsStore } = await import('./conversations')
      const store = useConversationsStore()

      // Set search filter
      store.filters.search = 'test customer'
      await store.loadConversations()

      // Verify API was called with search param
      const callArgs = mockConversationApi.list.mock.calls[0]?.[0] || {}
      expect(callArgs.search).toBe('test customer')
    })

    it('should pass tagIds parameter to API when set', async () => {
      const mockResponse = {
        success: true,
        data: []
      }
      mockConversationApi.list.mockResolvedValue(mockResponse)

      const { useConversationsStore } = await import('./conversations')
      const store = useConversationsStore()

      // Set tagIds filter
      store.filters.tagIds = [1, 2, 3]
      await store.loadConversations()

      // Verify API was called with tagIds param
      const callArgs = mockConversationApi.list.mock.calls[0]?.[0] || {}
      expect(callArgs.tagIds).toEqual([1, 2, 3])
    })

    it('should not pass empty tagIds to API', async () => {
      const mockResponse = {
        success: true,
        data: []
      }
      mockConversationApi.list.mockResolvedValue(mockResponse)

      const { useConversationsStore } = await import('./conversations')
      const store = useConversationsStore()

      // Set empty tagIds
      store.filters.tagIds = []
      await store.loadConversations()

      const callArgs = mockConversationApi.list.mock.calls[0]?.[0] || {}
      expect(callArgs.tagIds).toBeUndefined()
    })

    it('should not pass empty search to API', async () => {
      const mockResponse = {
        success: true,
        data: []
      }
      mockConversationApi.list.mockResolvedValue(mockResponse)

      const { useConversationsStore } = await import('./conversations')
      const store = useConversationsStore()

      // search is not set (undefined)
      await store.loadConversations()

      const callArgs = mockConversationApi.list.mock.calls[0]?.[0] || {}
      expect(callArgs.search).toBeUndefined()
    })

    it('should handle load conversations failure', async () => {
      const mockResponse = {
        success: false,
        error: 'Failed to load conversations'
      }
      
      mockConversationApi.list.mockResolvedValue(mockResponse)
      
      const { useConversationsStore } = await import('./conversations')
      const store = useConversationsStore()
      
      await store.loadConversations()
      
      expect(store.conversations).toEqual([])
      expect(store.error).toBe('Failed to load conversations')
      expect(store.loading).toBe(false)
    })
  })

  describe('Messages Management', () => {
    it('should load messages successfully', async () => {
      const mockMessages = [
        { id: 'msg-1', content: 'Hello', createdAt: '2024-01-01T10:00:00Z' },
        { id: 'msg-2', content: 'Hi there', createdAt: '2024-01-01T10:01:00Z' }
      ]
      const mockResponse = { success: true, data: mockMessages }
      
      mockMessageApi.list.mockResolvedValue(mockResponse)
      
      const { useConversationsStore } = await import('./conversations')
      const store = useConversationsStore()
      
      await store.loadMessages('conv-1')
      
      expect(store.messages).toEqual(mockMessages)
      expect(store.messagesLoading).toBe(false)
      expect(mockMessageApi.list).toHaveBeenCalledWith('conv-1')
    })

    it('should not send message without current conversation', async () => {
      const { useConversationsStore } = await import('./conversations')
      const store = useConversationsStore()
      
      await store.sendMessage('', 'Test message')
      
      expect(mockMessageApi.send).not.toHaveBeenCalled()
      expect(store.error).toBe('沒有選擇對話')
    })
  })

  describe('Conversation Actions', () => {
    // Note: Individual assignment (assignConversation) is deprecated
    // Testing team-based assignment instead
    it('should assign conversation to team successfully', async () => {
      const teamId = 1
      const mockConversationData = {
        success: true,
        data: {
          id: 'conv-1',
          userId: '1',
          status: 'assigned' as const,
          assignedTeamId: teamId,
          platform: 'line' as const,
          createdAt: Date.now(),
          lastMessageAt: Date.now()
        }
      }
      mockConversationApi.assignConversation.mockResolvedValue(mockConversationData)

      const { useConversationsStore } = await import('./conversations')
      const store = useConversationsStore()

      const result = await store.assignConversationToTeam('conv-1', teamId, 'Test Team')

      expect(result).toBe(true)
      expect(mockConversationApi.assignConversation).toHaveBeenCalledWith('conv-1', { teamId })
    })

    it('should return false for deprecated individual assignment', async () => {
      const { useConversationsStore } = await import('./conversations')
      const store = useConversationsStore()

      const result = await store.assignConversation('conv-1', 'agent-2')

      expect(result).toBe(false)
    })

    // Note: closeConversation test removed - status cleanup
  })

  describe('Statistics', () => {
    it('should load stats successfully', async () => {
      const mockStats = {
        total: 100,
        active: 30,
        assigned: 50,
        pending: 20,
        unreadCount: 15
      }
      const mockResponse = { success: true, data: mockStats }
      
      mockConversationApi.getStats.mockResolvedValue(mockResponse)
      
      const { useConversationsStore } = await import('./conversations')
      const store = useConversationsStore()
      
      await store.loadStats()
      
      expect(store.stats).toEqual(mockStats)
    })
  })
})