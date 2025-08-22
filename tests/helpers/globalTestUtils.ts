// 專案名稱：Multi-Channel Support MVP
// 檔案路径：/tests/helpers/globalTestUtils.ts
// Created by: Test Infrastructure Developer

import { vi } from 'vitest'

/**
 * Gets the globally mocked API objects that were set up in vitest.setup.ts
 * Use this instead of creating new mocks in individual tests
 * 
 * NOTE: With the new early Pinia setup, stores can now be imported safely at any time!
 */
export async function getGlobalMocks() {
  // Import the mocked APIs that were set up globally
  const { authApi } = await import('../../frontend/src/api/auth')
  const { conversationApi } = await import('../../frontend/src/api/conversations')
  const { messageApi } = await import('../../frontend/src/api/message')
  const { useRouter } = await import('vue-router')

  return {
    authApi,
    conversationApi,
    messageApi,
    useRouter
  }
}

/**
 * Gets the real store instances - now safe to import thanks to early Pinia setup
 * This is the preferred approach for testing stores
 */
export async function getGlobalStores() {
  // These imports are now safe because Pinia is set up at module level
  const { useAuthStore } = await import('../../frontend/src/stores/auth')
  const { useConversationsStore } = await import('../../frontend/src/stores/conversations')

  return {
    useAuthStore,
    useConversationsStore
  }
}

/**
 * Sets up common mock responses for API calls
 * Use this to quickly configure expected API responses in tests
 */
export async function setupMockResponses() {
  const mocks = await getGlobalMocks()

  // Setup default successful responses
  vi.mocked(mocks.authApi.login).mockResolvedValue({
    success: true,
    data: {
      token: 'test-token-123',
      agent: {
        id: 'test-agent-1',
        name: 'Test Agent',
        email: 'test@example.com',
        role: 'agent' as const
      }
    }
  })

  vi.mocked(mocks.authApi.me).mockResolvedValue({
    success: true,
    data: {
      id: 'test-agent-1',
      name: 'Test Agent',
      email: 'test@example.com',
      role: 'agent' as const
    }
  })

  vi.mocked(mocks.conversationApi.list).mockResolvedValue({
    success: true,
    data: {
      items: [],
      total: 0
    }
  })

  vi.mocked(mocks.conversationApi.getConversations).mockResolvedValue({
    success: true,
    data: []
  })

  vi.mocked(mocks.conversationApi.getMessages).mockResolvedValue({
    success: true,
    data: []
  })

  vi.mocked(mocks.messageApi.list).mockResolvedValue({
    success: true,
    data: []
  })

  return mocks
}

/**
 * Creates test data objects commonly used in tests
 */
export function createTestData() {
  return {
    testAgent: {
      id: 'test-agent-1',
      name: 'Test Agent',
      email: 'test@example.com',
      role: 'agent' as const
    },
    testConversation: {
      id: 'conv-1',
      customerId: 'cust-1',
      platform: 'line' as const,
      status: 'open' as const,
      assignedTo: 'test-agent-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    testMessage: {
      id: 'msg-1',
      conversationId: 'conv-1',
      content: 'Test message',
      isFromCustomer: true,
      createdAt: new Date().toISOString()
    }
  }
}

/**
 * Simple test setup for most common cases
 * Just call this in beforeEach and it handles everything
 */
export async function setupBasicTest() {
  // The global setup already handles Pinia and localStorage
  // This just sets up common mock responses
  const mocks = await setupMockResponses()
  const testData = createTestData()

  return {
    mocks,
    testData
  }
}

/**
 * Advanced test setup for performance and stress tests
 * Provides additional utilities for complex scenarios
 */
export async function setupAdvancedTest() {
  const basic = await setupBasicTest()
  
  return {
    ...basic,
    
    // Performance measurement utilities
    measurePerformance: async (fn: () => Promise<void>) => {
      const start = performance.now()
      await fn()
      return performance.now() - start
    },

    // Batch operation utilities
    createBatchData: (count: number) => {
      const conversations = []
      const messages = []
      
      for (let i = 0; i < count; i++) {
        conversations.push({
          id: `conv-${i}`,
          customerId: `cust-${i}`,
          platform: 'line' as const,
          status: 'open' as const,
          assignedTo: 'test-agent-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        
        messages.push({
          id: `msg-${i}`,
          conversationId: `conv-${i}`,
          content: `Test message ${i}`,
          isFromCustomer: true,
          createdAt: new Date().toISOString()
        })
      }
      
      return { conversations, messages }
    }
  }
}

/**
 * Error testing utilities
 * Helps test error scenarios consistently
 */
export async function setupErrorTestScenarios() {
  const mocks = await getGlobalMocks()

  return {
    // Network errors
    networkError: () => {
      vi.mocked(mocks.authApi.login).mockRejectedValue(new Error('Network Error'))
      vi.mocked(mocks.conversationApi.list).mockRejectedValue(new Error('Network Error'))
    },

    // Authentication errors
    authError: () => {
      vi.mocked(mocks.authApi.login).mockResolvedValue({
        success: false,
        error: 'Invalid credentials'
      })
      vi.mocked(mocks.authApi.me).mockResolvedValue({
        success: false,
        error: 'Unauthorized'
      })
    },

    // API errors
    apiError: () => {
      vi.mocked(mocks.conversationApi.list).mockResolvedValue({
        success: false,
        error: 'Internal Server Error'
      })
    }
  }
}