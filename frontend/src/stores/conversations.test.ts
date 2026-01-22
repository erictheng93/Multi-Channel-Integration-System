import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock the APIs first
const mockConversationApi = {
  list: vi.fn(),
  getConversation: vi.fn(),
  getMessages: vi.fn(),
  assignConversation: vi.fn(),
  closeConversation: vi.fn(),
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
        assignedTo: undefined
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
        open: 0,
        assigned: 0,
        closed: 0,
        unreadCount: 0
      })
    })
  })

  describe('Load Conversations', () => {
    it('should load conversations successfully', async () => {
      const mockConversations = [
        { id: 'conv-1', status: 'open', platform: 'line', lastMessage: { content: 'Hello' } },
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

    it('should close conversation successfully', async () => {
      const mockResponse = { success: true }
      mockConversationApi.closeConversation.mockResolvedValue(mockResponse)
      
      const { useConversationsStore } = await import('./conversations')
      const store = useConversationsStore()
      
      const result = await store.closeConversation('conv-1', 'Issue resolved')
      
      expect(result).toBe(true)
      expect(mockConversationApi.closeConversation).toHaveBeenCalledWith('conv-1', 'Issue resolved')
    })
  })

  describe('Statistics', () => {
    it('should load stats successfully', async () => {
      const mockStats = {
        total: 100,
        open: 30,
        assigned: 50,
        closed: 20,
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