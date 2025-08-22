// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/helpers/piniaTestUtils.ts
// Created by: Test Utilities Developer

import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { vi } from 'vitest'

/**
 * Creates and sets up a fresh Pinia instance for testing
 * This should be called in beforeEach hooks
 */
export function setupPiniaForTest(): Pinia {
  // Clear module cache first
  vi.resetModules()
  
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}

/**
 * Creates mock objects commonly used in Pinia store tests
 */
export function createTestMocks() {
  const mockLocalStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }

  const mockRouter = {
    push: vi.fn().mockResolvedValue(undefined),
    replace: vi.fn().mockResolvedValue(undefined),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }

  const mockLocation = {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
    reload: vi.fn(),
  }

  // Setup global mocks
  Object.defineProperty(global, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true
  })

  Object.defineProperty(global, 'window', {
    value: {
      localStorage: mockLocalStorage,
      location: mockLocation
    },
    writable: true,
    configurable: true
  })

  return {
    mockLocalStorage,
    mockRouter,
    mockLocation
  }
}

/**
 * Creates mock API objects for testing
 */
export function createApiMocks() {
  return {
    authApi: {
      setAuthHeader: vi.fn(),
      removeAuthHeader: vi.fn(),
      login: vi.fn(),
      me: vi.fn()
    },
    conversationApi: {
      getConversations: vi.fn(),
      list: vi.fn(),
      getConversation: vi.fn(),
      get: vi.fn(),
      assignConversation: vi.fn(),
      assign: vi.fn(),
      closeConversation: vi.fn(),
      close: vi.fn(),
      getMessages: vi.fn(),
      sendMessage: vi.fn(),
      markAsRead: vi.fn()
    },
    messageApi: {
      list: vi.fn(),
      send: vi.fn(),
      markAsRead: vi.fn()
    }
  }
}

/**
 * Comprehensive test setup for Pinia stores
 * Use this in beforeEach for consistent test environment
 */
export function setupStoreTest() {
  // Clear all mocks but DON'T reset modules (preserves global Pinia setup)
  vi.clearAllMocks()
  
  // DON'T create new Pinia - use the global one
  // The global setup already handles Pinia creation
  
  // Setup test mocks
  const mocks = createTestMocks()
  const apiMocks = createApiMocks()
  
  return {
    ...mocks,
    ...apiMocks
  }
}