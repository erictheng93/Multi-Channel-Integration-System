import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Mock dependencies
vi.mock('../../../frontend/src/api/auth', () => ({
  authApi: {
    setAuthHeader: vi.fn(),
    removeAuthHeader: vi.fn(),
    login: vi.fn(),
    me: vi.fn()
  }
}))

vi.mock('../../../frontend/src/api/conversations', () => ({
  conversationApi: {
    getConversations: vi.fn(),
    getConversation: vi.fn(),
    assignConversation: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn()
  }
}))

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn().mockResolvedValue(undefined)
  }))
}))

describe('Composables Edge Cases', () => {
  let mockAuthApi: any
  let mockConversationApi: any
  let mockLocalStorage: any

  beforeEach(async () => {
    // Create fresh Pinia instance
    const pinia = createPinia()
    setActivePinia(pinia)
    
    // Clear all mocks
    vi.clearAllMocks()
    
    // Setup localStorage mock
    mockLocalStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }

    // Setup global objects
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true
    })

    Object.defineProperty(global, 'window', {
      value: { localStorage: mockLocalStorage },
      writable: true,
      configurable: true
    })

    // Get mocked APIs
    const { authApi } = await import('../../../frontend/src/api/auth')
    const { conversationApi } = await import('../../../frontend/src/api/conversations')
    
    mockAuthApi = authApi
    mockConversationApi = conversationApi
  })

  describe('useAuthStore edge cases', () => {
    it('should handle localStorage being unavailable', async () => {
      // Simulate localStorage being unavailable
      Object.defineProperty(global, 'localStorage', {
        value: undefined,
        writable: true,
        configurable: true
      })

      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      
      // Should not throw when localStorage is unavailable
      expect(() => useAuthStore()).not.toThrow()
    })

    it('should handle malformed JSON in localStorage', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json-{')
      
      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const store = useAuthStore()
      
      // Should handle malformed JSON gracefully
      expect(store.token).toBe('invalid-json-{')
    })

    it('should handle extremely long tokens', async () => {
      const longToken = 'a'.repeat(10000)
      mockLocalStorage.getItem.mockReturnValue(longToken)
      
      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const store = useAuthStore()
      
      expect(store.token).toBe(longToken)
      expect(store.isAuthenticated).toBe(true)
    })

    it('should handle concurrent login attempts', async () => {
      vi.mocked(mockAuthApi.login)
        .mockResolvedValueOnce({
          success: true,
          data: { token: 'token1', agent: { id: '1', name: 'User 1', email: 'user1@example.com', role: 'agent' } }
        })
        .mockResolvedValueOnce({
          success: true,
          data: { token: 'token2', agent: { id: '2', name: 'User 2', email: 'user2@example.com', role: 'agent' } }
        })

      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const store = useAuthStore()

      const [result1, result2] = await Promise.all([
        store.login({ email: 'user1@example.com', password: 'pass1' }),
        store.login({ email: 'user2@example.com', password: 'pass2' })
      ])

      expect(result1).toBe(true)
      expect(result2).toBe(true)
      // The last successful login should win
      expect(store.token).toBe('token2')
    })

    it('should handle API timeout scenarios', async () => {
      vi.mocked(mockAuthApi.login).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      )

      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const store = useAuthStore()
      
      const result = await store.login({ email: 'test@example.com', password: 'password' })

      expect(result).toBe(false)
      expect(store.error).toBe('網路錯誤，請稍後再試')
    })
  })

  describe('useConversationsStore edge cases', () => {
    it('should handle extremely large conversation lists', async () => {
      const largeConversationList = Array.from({ length: 10000 }, (_, i) => ({
        id: `conv-${i}`,
        customer_name: `Customer ${i}`,
        status: i % 3 === 0 ? 'pending' : i % 3 === 1 ? 'in_progress' : 'closed',
        platform: i % 2 === 0 ? 'line' : 'facebook'
      }))

      vi.mocked(mockConversationApi.getConversations).mockResolvedValue({
        success: true,
        data: largeConversationList
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore()
      
      await store.fetchConversations()

      expect(store.conversations).toHaveLength(10000)
      expect(store.loading).toBe(false)
    })

    it('should handle network interruption during message sending', async () => {
      vi.mocked(mockConversationApi.sendMessage).mockImplementation(() =>
        Promise.reject(new Error('Network connection lost'))
      )

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore()
      
      const result = await store.sendMessage('1', 'Test message')

      expect(result).toBe(false)
    })

    it('should handle concurrent message operations on same conversation', async () => {
      vi.mocked(mockConversationApi.sendMessage)
        .mockResolvedValueOnce({
          success: true,
          data: { id: '1', content: 'Message 1', sender: 'agent', timestamp: '2024-01-01T00:00:00Z' }
        })
        .mockResolvedValueOnce({
          success: true,
          data: { id: '2', content: 'Message 2', sender: 'agent', timestamp: '2024-01-01T00:01:00Z' }
        })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore()
      
      const [result1, result2] = await Promise.all([
        store.sendMessage('1', 'Message 1'),
        store.sendMessage('1', 'Message 2')
      ])

      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(store.messages).toHaveLength(2)
    })

    it('should handle mock data generation failure', async () => {
      // Simulate API failure and mock data generation failure
      vi.mocked(mockConversationApi.getConversations).mockRejectedValue(new Error('API Error'))
      
      // Mock the mock data generation to also fail
      const originalConsoleError = console.error
      console.error = vi.fn()

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore()
      
      await store.fetchConversations()

      // Should handle gracefully even if mock data fails
      expect(store.conversations).toEqual([])
      
      console.error = originalConsoleError
    })

    it('should handle assignment of non-existent conversation', async () => {
      vi.mocked(mockConversationApi.assignConversation).mockResolvedValue({
        success: false,
        error: 'Conversation not found'
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore()
      
      const result = await store.assignConversation('non-existent-id', 'agent123')

      expect(result).toBe(false)
    })
  })

  describe('Cross-composable interactions', () => {
    it('should handle auth store logout affecting conversations store', async () => {
      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      
      const authStore = useAuthStore()
      const conversationsStore = useConversationsStore()
      
      // Set up some state
      authStore.token = 'test-token'
      conversationsStore.conversations = [
        { id: '1', customer_name: 'Customer 1', status: 'pending', platform: 'line' }
      ]
      
      await authStore.logout()
      
      expect(authStore.token).toBeNull()
      // Conversations should remain (they might be cleared by app logic, but store itself doesn't clear)
      expect(conversationsStore.conversations).toHaveLength(1)
    })

    it('should handle error composable with store operations', async () => {
      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const { useError } = await import('../../../frontend/src/composables/useError')
      
      const authStore = useAuthStore()
      const errorComposable = useError()
      
      vi.mocked(mockAuthApi.login).mockRejectedValue(new Error('Network error'))
      
      const result = await authStore.login({ email: 'test@example.com', password: 'password' })
      
      expect(result).toBe(false)
      expect(authStore.error).toBe('網路錯誤，請稍後再試')
      
      // Error composable should be able to handle the error
      errorComposable.handleError(authStore.error)
      expect(errorComposable.error.value).toBe('網路錯誤，請稍後再試')
    })

    it('should handle multiple stores with shared loading states', async () => {
      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      
      const authStore = useAuthStore()
      const conversationsStore = useConversationsStore()
      
      // Both stores should manage their own loading states independently
      expect(authStore.loading).toBe(false)
      expect(conversationsStore.loading).toBe(false)
      
      // Simulate loading in auth store
      authStore.loading = true
      expect(authStore.loading).toBe(true)
      expect(conversationsStore.loading).toBe(false) // Should remain independent
    })
  })

  describe('Memory and performance edge cases', () => {
    it('should handle memory pressure scenarios', async () => {
      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore()
      
      // Simulate memory pressure by creating large objects
      const largeMessages = Array.from({ length: 50000 }, (_, i) => ({
        id: `msg-${i}`,
        content: 'x'.repeat(1000), // 1KB per message
        sender: 'customer',
        timestamp: new Date().toISOString()
      }))

      vi.mocked(mockConversationApi.getMessages).mockResolvedValue({
        success: true,
        data: largeMessages
      })
      
      await store.fetchMessages('1')
      
      expect(store.messages).toHaveLength(50000)
      
      // Clear messages to free memory
      store.messages = []
      expect(store.messages).toHaveLength(0)
    })

    it('should handle rapid successive API calls', async () => {
      vi.mocked(mockConversationApi.getConversations).mockResolvedValue({
        success: true,
        data: [{ id: '1', customer_name: 'Customer 1', status: 'pending', platform: 'line' }]
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore()
      
      // Make 100 rapid successive calls
      const promises = Array.from({ length: 100 }, () => store.fetchConversations())
      
      await Promise.all(promises)
      
      expect(store.conversations).toHaveLength(1)
      expect(mockConversationApi.getConversations).toHaveBeenCalledTimes(100)
    })

    it('should handle store cleanup and recreation', async () => {
      let { useAuthStore } = await import('../../../frontend/src/stores/auth')
      let store = useAuthStore()
      
      store.token = 'test-token'
      expect(store.token).toBe('test-token')
      
      // Simulate store recreation (like in hot reload)
      const newPinia = createPinia()
      setActivePinia(newPinia)
      
      // Re-import to get fresh store
      const freshImport = await import('../../../frontend/src/stores/auth')
      const newStore = freshImport.useAuthStore()
      
      // New store should be clean
      expect(newStore.token).toBeNull()
    })
  })

  describe('Error boundary scenarios', () => {
    it('should handle corrupted store state', async () => {
      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const store = useAuthStore()
      
      // Simulate corrupted state
      ;(store as any).currentAgent = 'invalid-object-type'
      
      // Should handle gracefully
      expect(store.isAdmin).toBe(false)
    })

    it('should handle API returning unexpected data types', async () => {
      vi.mocked(mockAuthApi.login).mockResolvedValue('invalid-response-type' as any)

      const { useAuthStore } = await import('../../../frontend/src/stores/auth')
      const store = useAuthStore()
      
      const result = await store.login({ email: 'test@example.com', password: 'password' })
      
      expect(result).toBe(false)
      expect(store.error).toBe('登入失敗')
    })

    it('should handle circular reference in API responses', async () => {
      const circularObject: any = { id: '1', name: 'Test' }
      circularObject.self = circularObject

      vi.mocked(mockConversationApi.getConversations).mockResolvedValue({
        success: true,
        data: [circularObject]
      })

      const { useConversationsStore } = await import('../../../frontend/src/stores/conversations')
      const store = useConversationsStore()
      
      await store.fetchConversations()
      
      // Should handle circular references gracefully
      expect(store.conversations).toHaveLength(1)
      expect(store.conversations[0].id).toBe('1')
    })
  })
})