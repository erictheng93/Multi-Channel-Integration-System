// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/helpers/composableTestSetup.ts
// Created by: Test Setup Developer

import { vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

/**
 * Standard setup for composable tests that use Pinia stores
 * Call this in your test file's beforeEach hook
 */
export function setupComposableTest() {
  // Create fresh Pinia instance
  const pinia = createPinia()
  setActivePinia(pinia)

  // Setup localStorage mock
  const mockLocalStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }

  // Setup router mock
  const mockRouter = {
    push: vi.fn().mockResolvedValue(undefined),
    replace: vi.fn().mockResolvedValue(undefined),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }

  // Setup API mocks
  const mockAuthApi = {
    setAuthHeader: vi.fn(),
    removeAuthHeader: vi.fn(),
    login: vi.fn().mockResolvedValue({ success: false, error: 'Mock not configured' }),
    me: vi.fn().mockResolvedValue({ success: false, error: 'Mock not configured' })
  }

  const mockConversationsApi = {
    getConversations: vi.fn().mockResolvedValue({ success: false, error: 'Mock not configured' }),
    getConversation: vi.fn().mockResolvedValue({ success: false, error: 'Mock not configured' }),
    assignConversation: vi.fn().mockResolvedValue({ success: false, error: 'Mock not configured' })
  }

  const mockMessagesApi = {
    getMessages: vi.fn().mockResolvedValue({ success: false, error: 'Mock not configured' }),
    sendMessage: vi.fn().mockResolvedValue({ success: false, error: 'Mock not configured' })
  }

  // Setup global objects
  Object.defineProperty(global, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true
  })

  Object.defineProperty(global, 'window', {
    value: {
      localStorage: mockLocalStorage,
      location: {
        href: 'http://localhost:3000',
        origin: 'http://localhost:3000',
        pathname: '/',
        search: '',
        hash: '',
        reload: vi.fn(),
      }
    },
    writable: true,
    configurable: true
  })

  return {
    pinia,
    mockLocalStorage,
    mockRouter,
    mockAuthApi,
    mockConversationsApi,
    mockMessagesApi
  }
}

/**
 * Global beforeEach setup for composable tests
 * Import this in test files that need Pinia setup
 */
export function setupGlobalComposableTest() {
  beforeEach(() => {
    return setupComposableTest()
  })
}