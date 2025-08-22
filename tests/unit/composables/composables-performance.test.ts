import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useConversationsStore } from '@/stores/conversations'
import { useError } from '@/composables/useError'

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

vi.mock('../../../frontend/src/utils/mockData', () => ({
  generateMockConversations: vi.fn(() => []),
  generateMockMessages: vi.fn(() => [])
}))

describe('Composables Performance Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    })
  })

  describe('useError Performance', () => {
    it('should handle rapid error updates efficiently', async () => {
      const errorComposable = useError()
      const startTime = performance.now()

      // Simulate rapid error updates
      for (let i = 0; i < 1000; i++) {
        errorComposable.setError(`Error ${i}`)
        errorComposable.clearError()
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete within reasonable time (< 100ms for 1000 operations)
      expect(duration).toBeLessThan(100)
      expect(errorComposable.error.value).toBeNull()
    })

    it('should handle large error objects without memory leaks', () => {
      const errorComposable = useError()
      const largeError = {
        message: 'Large error',
        stack: 'x'.repeat(10000), // 10KB string
        details: Array(1000).fill(0).map((_, i) => ({ id: i, data: 'test data' }))
      }

      const startMemory = (performance as any).memory?.usedJSHeapSize || 0

      // Set and clear large error multiple times
      for (let i = 0; i < 100; i++) {
        errorComposable.handleError(largeError)
        errorComposable.clearError()
      }

      const endMemory = (performance as any).memory?.usedJSHeapSize || 0
      const memoryIncrease = endMemory - startMemory

      // Memory increase should be reasonable (< 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
    })
  })

  describe('Auth Store Performance', () => {
    it('should handle concurrent login attempts efficiently', async () => {
      const { authApi } = await import('../../../frontend/src/api/auth')
      const authStore = useAuthStore()

      // Mock successful login
      vi.mocked(authApi.login).mockResolvedValue({
        token: 'test-token',
        user: {
          id: 1,
          username: 'testuser',
          role: 'agent',
          name: 'Test User',
          email: 'test@example.com',
          team_id: 1,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      })

      const startTime = performance.now()

      // Simulate concurrent login attempts
      const promises = Array(50).fill(0).map(() =>
        authStore.login('testuser', 'password')
      )

      await Promise.all(promises)

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should handle concurrent operations efficiently (< 2000ms)
      expect(duration).toBeLessThan(2000)
      expect(authStore.isAuthenticated).toBe(true)
    })

    it('should efficiently manage token refresh cycles', async () => {
      const { authApi } = await import('../../../frontend/src/api/auth')
      const authStore = useAuthStore()

      // Mock token refresh
      vi.mocked(authApi.me).mockResolvedValue({
        id: 1,
        username: 'testuser',
        role: 'agent',
        name: 'Test User',
        email: 'test@example.com',
        team_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      })

      // Set initial token
      authStore.token = 'test-token'

      const startTime = performance.now()

      // Simulate multiple token refresh cycles
      for (let i = 0; i < 100; i++) {
        await authStore.fetchUser()
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete efficiently (< 1000ms for 100 operations)
      expect(duration).toBeLessThan(1000)
      expect(vi.mocked(authApi.me)).toHaveBeenCalledTimes(100)
    })
  })

  describe('Conversations Store Performance', () => {
    it('should handle large conversation datasets efficiently', async () => {
      const { conversationApi } = await import('../../../frontend/src/api/conversations')
      const conversationsStore = useConversationsStore()

      // Generate large dataset
      const largeDataset = Array(10000).fill(0).map((_, i) => ({
        id: `conv-${i}`,
        customer_id: `customer-${i}`,
        customer_name: `Customer ${i}`,
        platform: i % 2 === 0 ? 'line' : 'facebook',
        status: ['pending', 'in_progress', 'closed'][i % 3],
        assigned_agent_id: i % 3 === 0 ? null : i % 10,
        created_at: new Date(Date.now() - i * 1000).toISOString(),
        updated_at: new Date(Date.now() - i * 500).toISOString(),
        last_message_at: new Date(Date.now() - i * 100).toISOString()
      }))

      vi.mocked(conversationApi.getConversations).mockResolvedValue(largeDataset)

      const startTime = performance.now()

      await conversationsStore.fetchConversations()

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should handle large datasets efficiently (< 500ms)
      expect(duration).toBeLessThan(500)
      expect(conversationsStore.conversations).toHaveLength(10000)
    })

    it('should efficiently filter large conversation lists', () => {
      const conversationsStore = useConversationsStore()

      // Set up large dataset
      const largeDataset = Array(10000).fill(0).map((_, i) => ({
        id: `conv-${i}`,
        customer_id: `customer-${i}`,
        customer_name: `Customer ${i}`,
        platform: i % 2 === 0 ? 'line' : 'facebook',
        status: ['pending', 'in_progress', 'closed'][i % 3],
        assigned_agent_id: i % 3 === 0 ? null : i % 10,
        created_at: new Date(Date.now() - i * 1000).toISOString(),
        updated_at: new Date(Date.now() - i * 500).toISOString(),
        last_message_at: new Date(Date.now() - i * 100).toISOString()
      }))

      conversationsStore.conversations = largeDataset

      const startTime = performance.now()

      // Test various filter combinations
      conversationsStore.setStatusFilter('pending')
      const pendingCount = conversationsStore.filteredConversations.length

      conversationsStore.setPlatformFilter('line')
      const lineCount = conversationsStore.filteredConversations.length

      conversationsStore.setStatusFilter('all')
      conversationsStore.setPlatformFilter('all')
      const allCount = conversationsStore.filteredConversations.length

      const endTime = performance.now()
      const duration = endTime - startTime

      // Filtering should be fast (< 50ms)
      expect(duration).toBeLessThan(50)
      expect(pendingCount).toBeGreaterThan(0)
      expect(lineCount).toBeGreaterThan(0)
      expect(allCount).toBe(10000)
    })

    it('should handle rapid message updates without performance degradation', async () => {
      const { conversationApi } = await import('../../../frontend/src/api/conversations')
      const conversationsStore = useConversationsStore()

      // Mock message sending
      vi.mocked(conversationApi.sendMessage).mockResolvedValue({
        id: 'msg-1',
        conversation_id: 'conv-1',
        sender_type: 'agent',
        sender_id: '1',
        content: 'Test message',
        message_type: 'text',
        created_at: new Date().toISOString()
      })

      const startTime = performance.now()

      // Simulate rapid message sending
      const promises = Array(100).fill(0).map((_, i) =>
        conversationsStore.sendMessage('conv-1', `Message ${i}`)
      )

      await Promise.all(promises)

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should handle rapid updates efficiently (< 2000ms for 100 messages)
      expect(duration).toBeLessThan(2000)
      expect(vi.mocked(conversationApi.sendMessage)).toHaveBeenCalledTimes(100)
    })
  })

  describe('Memory Management', () => {
    it('should not create memory leaks with repeated store operations', async () => {
      const authStore = useAuthStore()
      const conversationsStore = useConversationsStore()
      const errorComposable = useError()

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        // Auth operations
        authStore.token = `token-${i}`
        authStore.user = {
          id: i,
          username: `user-${i}`,
          role: 'agent',
          name: `User ${i}`,
          email: `user${i}@example.com`,
          team_id: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        // Conversation operations
        conversationsStore.conversations = [{
          id: `conv-${i}`,
          customer_id: `customer-${i}`,
          customer_name: `Customer ${i}`,
          platform: 'line',
          status: 'pending',
          assigned_agent_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString()
        }]

        // Error operations
        errorComposable.setError(`Error ${i}`)
        errorComposable.clearError()

        // Clear data periodically
        if (i % 100 === 0) {
          authStore.$reset()
          conversationsStore.$reset()
        }
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory

      // Memory increase should be reasonable (< 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent store operations safely', async () => {
      const { authApi } = await import('../../../frontend/src/api/auth')
      const { conversationApi } = await import('../../../frontend/src/api/conversations')

      const authStore = useAuthStore()
      const conversationsStore = useConversationsStore()

      // Mock API responses
      vi.mocked(authApi.login).mockResolvedValue({
        token: 'test-token',
        user: {
          id: 1,
          username: 'testuser',
          role: 'agent',
          name: 'Test User',
          email: 'test@example.com',
          team_id: 1,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      })

      vi.mocked(conversationApi.getConversations).mockResolvedValue([])

      const startTime = performance.now()

      // Run concurrent operations
      const promises = [
        ...Array(20).fill(0).map(() => authStore.login('user', 'pass')),
        ...Array(20).fill(0).map(() => conversationsStore.fetchConversations()),
        ...Array(20).fill(0).map(() => authStore.fetchUser()),
        ...Array(20).fill(0).map(() => conversationsStore.setStatusFilter('pending'))
      ]

      await Promise.all(promises)

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should handle concurrent operations efficiently (< 3000ms)
      expect(duration).toBeLessThan(3000)
      expect(authStore.isAuthenticated).toBe(true)
    })
  })
})