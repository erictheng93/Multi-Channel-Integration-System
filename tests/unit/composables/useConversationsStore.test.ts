import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Mock all dependencies at the top level
vi.mock('../../../frontend/src/api/conversations', () => ({
  conversationApi: {
    getConversations: vi.fn(),
    getConversation: vi.fn(),
    assignConversation: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn()
  }
}))

vi.mock('../../../frontend/src/utils/mockData', () => ({
  generateMockConversations: vi.fn(() => [
    { id: '1', customer_name: 'Customer 1', status: 'pending', platform: 'line' },
    { id: '2', customer_name: 'Customer 2', status: 'in_progress', platform: 'facebook' }
  ]),
  generateMockMessages: vi.fn(() => [
    { id: '1', content: 'Hello', sender: 'customer', timestamp: '2024-01-01T00:00:00Z' },
    { id: '2', content: 'Hi there', sender: 'agent', timestamp: '2024-01-01T00:01:00Z' }
  ])
}))

describe('FINAL Working Conversations Store Tests', () => {
  let pinia: any
  let mockConversationApi: any

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks()
    
    // Create and set Pinia instance
    pinia = createPinia()
    setActivePinia(pinia)

    // Get mocked APIs
    const { conversationApi } = await import('../../../frontend/src/api/conversations')
    
    mockConversationApi = conversationApi
  })

  describe('initial state', () => {
    test('should initialize with empty conversations array', async () => {
      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      expect(store.conversations).toEqual([])
    })

    test('should initialize with null currentConversation', async () => {
      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      expect(store.currentConversation).toBeNull()
    })

    test('should initialize with empty messages array', async () => {
      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      expect(store.messages).toEqual([])
    })

    test('should initialize with loading false', async () => {
      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      expect(store.loading).toBe(false)
    })
  })

  describe('fetchConversations', () => {
    test('should fetch conversations successfully', async () => {
      const mockConversations = [
        { id: '1', customer_name: 'Customer 1', status: 'pending', platform: 'line' },
        { id: '2', customer_name: 'Customer 2', status: 'in_progress', platform: 'facebook' }
      ]

      vi.mocked(mockConversationApi.getConversations).mockResolvedValue({
        success: true,
        data: mockConversations
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      
      await store.fetchConversations()

      expect(store.conversations).toEqual(mockConversations)
      expect(store.loading).toBe(false)
      expect(mockConversationApi.getConversations).toHaveBeenCalled()
    })

    test('should fetch conversations with filters', async () => {
      const mockConversations = [
        { id: '1', customer_name: 'Customer 1', status: 'pending', platform: 'line' }
      ]

      vi.mocked(mockConversationApi.getConversations).mockResolvedValue({
        success: true,
        data: mockConversations
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      
      await store.fetchConversations({ status: 'pending', platform: 'line' })

      expect(store.conversations).toEqual(mockConversations)
      expect(mockConversationApi.getConversations).toHaveBeenCalledWith({ status: 'pending', platform: 'line' })
    })

    test('should use mock data in development when API fails', async () => {
      vi.mocked(mockConversationApi.getConversations).mockResolvedValue({
        success: false,
        error: 'API Error'
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      
      await store.fetchConversations()

      // Should have some mock data
      expect(store.conversations.length).toBeGreaterThan(0)
      expect(store.loading).toBe(false)
    })

    test('should handle API error and use mock data in development', async () => {
      vi.mocked(mockConversationApi.getConversations).mockRejectedValue(new Error('Network error'))

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      
      await store.fetchConversations()

      // Should fallback to mock data
      expect(store.conversations.length).toBeGreaterThan(0)
      expect(store.loading).toBe(false)
    })
  })

  describe('fetchConversation', () => {
    test('should fetch single conversation successfully', async () => {
      const mockConversation = {
        id: '1',
        customer_name: 'Customer 1',
        status: 'pending',
        platform: 'line'
      }

      vi.mocked(mockConversationApi.getConversation).mockResolvedValue({
        success: true,
        data: mockConversation
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      
      await store.fetchConversation('1')

      expect(store.currentConversation).toEqual(mockConversation)
      expect(mockConversationApi.getConversation).toHaveBeenCalledWith('1')
    })

    test('should handle fetch conversation failure', async () => {
      vi.mocked(mockConversationApi.getConversation).mockResolvedValue({
        success: false,
        error: 'Conversation not found'
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      
      await store.fetchConversation('999')

      expect(store.currentConversation).toBeNull()
    })
  })

  describe('fetchMessages', () => {
    test('should fetch messages successfully', async () => {
      const mockMessages = [
        { id: '1', content: 'Hello', sender: 'customer', timestamp: '2024-01-01T00:00:00Z' },
        { id: '2', content: 'Hi there', sender: 'agent', timestamp: '2024-01-01T00:01:00Z' }
      ]

      vi.mocked(mockConversationApi.getMessages).mockResolvedValue({
        success: true,
        data: mockMessages
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      
      await store.fetchMessages('1')

      expect(store.messages).toEqual(mockMessages)
      expect(mockConversationApi.getMessages).toHaveBeenCalledWith('1')
    })

    test('should use mock data in development when API fails', async () => {
      vi.mocked(mockConversationApi.getMessages).mockResolvedValue({
        success: false,
        error: 'API Error'
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      
      await store.fetchMessages('1')

      // Should have some mock data
      expect(store.messages.length).toBeGreaterThan(0)
    })
  })

  describe('sendMessage', () => {
    test('should send message successfully', async () => {
      const newMessage = {
        id: '3',
        content: 'New message',
        sender: 'agent',
        timestamp: '2024-01-01T00:02:00Z'
      }

      vi.mocked(mockConversationApi.sendMessage).mockResolvedValue({
        success: true,
        data: newMessage
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      
      const result = await store.sendMessage('1', 'New message')

      expect(result).toBe(true)
      expect(store.messages).toHaveLength(1)
      expect(store.messages[0]).toEqual(newMessage)
      expect(mockConversationApi.sendMessage).toHaveBeenCalledWith('1', 'New message')
    })

    test('should handle send message failure', async () => {
      vi.mocked(mockConversationApi.sendMessage).mockResolvedValue({
        success: false,
        error: 'Failed to send message'
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      
      const result = await store.sendMessage('1', 'New message')

      expect(result).toBe(false)
    })

    test('should handle empty message content', async () => {
      vi.mocked(mockConversationApi.sendMessage).mockResolvedValue({
        success: false,
        error: 'Empty message'
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      
      const result = await store.sendMessage('1', '')

      expect(result).toBe(false)
      expect(mockConversationApi.sendMessage).toHaveBeenCalledWith('1', '')
    })
  })

  describe('assignConversation', () => {
    test('should assign conversation successfully', async () => {
      vi.mocked(mockConversationApi.assignConversation).mockResolvedValue({
        success: true,
        data: { message: 'Conversation assigned successfully' }
      })

      vi.mocked(mockConversationApi.getConversations).mockResolvedValue({
        success: true,
        data: [{ id: '1', customer_name: 'Customer 1', status: 'in_progress', platform: 'line', assigned_agent: 'agent123' }]
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      
      const result = await store.assignConversation('1', 'agent123')

      expect(result).toBe(true)
      expect(mockConversationApi.assignConversation).toHaveBeenCalledWith('1', 'agent123')
      expect(mockConversationApi.getConversations).toHaveBeenCalled()
    })

    test('should handle assign conversation failure', async () => {
      vi.mocked(mockConversationApi.assignConversation).mockResolvedValue({
        success: false,
        error: 'Failed to assign conversation'
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore(pinia)
      
      const result = await store.assignConversation('1', 'agent123')

      expect(result).toBe(false)
    })
  })
})