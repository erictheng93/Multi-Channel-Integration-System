// 專案名稱：Multi-Channel Support MVP
// 檔案路径：/tests/helpers/directStoreCreation.ts
// Created by: Test Infrastructure Developer

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { vi } from 'vitest'

/**
 * Direct store creation approach that bypasses module import timing issues
 * These store implementations are created directly in tests without importing the problematic modules
 */

/**
 * Create a test auth store directly without importing the module
 * This avoids the "getActivePinia() was called but there was no active Pinia" error
 */
export function createTestAuthStore() {
  return defineStore('auth', () => {
    // State
    const token = ref<string | null>(null)
    const currentAgent = ref<any | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    // Computed
    const isAuthenticated = computed(() => !!token.value)
    const isAdmin = computed(() => currentAgent.value?.role === 'admin')

    // Methods  
    async function login(credentials: { email: string; password: string }) {
      loading.value = true
      error.value = null
      
      try {
        // Mock API call - this will be mocked in tests
        const { authApi } = await import('../../frontend/src/api/auth')
        const response = await authApi.login(credentials)
        
        if (response.success && response.data) {
          token.value = response.data.token
          currentAgent.value = response.data.agent
          
          // Store token in localStorage
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('token', response.data.token)
          }
          
          return response
        } else {
          error.value = response.error || '登入失敗'
          return response
        }
      } catch (err: any) {
        error.value = err.message || 'Network error'
        throw err
      } finally {
        loading.value = false
      }
    }

    function logout() {
      token.value = null
      currentAgent.value = null
      error.value = null
      
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('token')
      }
    }

    function $reset() {
      token.value = null
      currentAgent.value = null
      loading.value = false  
      error.value = null
    }

    return {
      // State
      token,
      currentAgent,
      loading,
      error,
      
      // Computed
      isAuthenticated,
      isAdmin,
      
      // Actions
      login,
      logout,
      $reset
    }
  })
}

/**
 * Create a test conversations store directly without importing the module
 */
export function createTestConversationsStore() {
  return defineStore('conversations', () => {
    // State
    const conversations = ref<any[]>([])
    const currentConversation = ref<any | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)
    const total = ref(0)

    // Methods
    async function loadConversations(params?: any) {
      loading.value = true
      error.value = null
      
      try {
        const { conversationApi } = await import('../../frontend/src/api/conversations')
        const response = await conversationApi.list(params || {})
        
        if (response.success && response.data) {
          conversations.value = response.data.items || response.data
          total.value = response.data.total || response.data.length
        } else {
          error.value = response.error || 'Failed to load conversations'
        }
      } catch (err: any) {
        error.value = err.message || 'Network error'
        throw err
      } finally {
        loading.value = false
      }
    }

    function updateConversationStatus(id: string, status: string) {
      const conversation = conversations.value.find(c => c.id === id)
      if (conversation) {
        conversation.status = status
      }
    }

    function $reset() {
      conversations.value = []
      currentConversation.value = null
      loading.value = false
      error.value = null
      total.value = 0
    }

    return {
      // State
      conversations,
      currentConversation,
      loading,
      error,
      total,
      
      // Actions
      loadConversations,
      updateConversationStatus,
      $reset
    }
  })
}

/**
 * Factory function to create all test stores
 * Use this in tests to get working store instances without import timing issues
 */
export function createTestStores() {
  return {
    useAuthStore: createTestAuthStore(),
    useConversationsStore: createTestConversationsStore()
  }
}

/**
 * Advanced test setup that uses direct store creation
 * This completely bypasses the module import timing issues
 */
export async function setupDirectStoreTest() {
  const { setupBasicTest } = await import('./globalTestUtils')
  const basicSetup = await setupBasicTest()
  
  // Create stores directly
  const stores = createTestStores()
  
  return {
    ...basicSetup,
    stores: {
      authStore: stores.useAuthStore(),
      conversationsStore: stores.useConversationsStore()
    },
    
    // Utility methods for store testing
    resetAllStores: () => {
      stores.useAuthStore().$reset()
      stores.useConversationsStore().$reset()
    },
    
    // Performance testing utilities
    measureStorePerformance: async (storeOperation: () => Promise<void>) => {
      const start = performance.now()
      await storeOperation()
      return performance.now() - start
    }
  }
}