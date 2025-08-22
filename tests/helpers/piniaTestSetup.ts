// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/helpers/piniaTestSetup.ts
// Created by: Test Utilities Developer

import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { vi } from 'vitest'

/**
 * ULTIMATE PINIA TEST SETUP SOLUTION
 * 
 * This solves the core timing issues:
 * 1. Module-level store imports happen before Pinia setup
 * 2. Global setup reliability for complex scenarios
 * 3. Performance test failures due to Pinia timing
 */

export interface TestSetupResult {
  pinia: Pinia
  mockLocalStorage: any
  mockRouter: any
  mockLocation: any
  authApi: any
  conversationApi: any
  messageApi: any
}

/**
 * Creates a complete test environment with proper Pinia setup
 * This MUST be called before any store imports
 */
export function createTestEnvironment(): TestSetupResult {
  // 1. Clear everything first
  vi.clearAllMocks()
  vi.resetModules()
  
  // 2. Create and activate Pinia FIRST
  const pinia = createPinia()
  setActivePinia(pinia)
  
  // 3. Setup localStorage mock
  const mockLocalStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }
  
  // 4. Setup router mock
  const mockRouter = {
    push: vi.fn().mockResolvedValue(undefined),
    replace: vi.fn().mockResolvedValue(undefined),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }
  
  // 5. Setup location mock
  const mockLocation = {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
    reload: vi.fn(),
  }
  
  // 6. Setup global objects
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
  
  // 7. Create API mocks
  const authApi = {
    setAuthHeader: vi.fn(),
    removeAuthHeader: vi.fn(),
    login: vi.fn(),
    me: vi.fn()
  }
  
  const conversationApi = {
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
  }
  
  const messageApi = {
    list: vi.fn(),
    send: vi.fn(),
    markAsRead: vi.fn()
  }
  
  return {
    pinia,
    mockLocalStorage,
    mockRouter,
    mockLocation,
    authApi,
    conversationApi,
    messageApi
  }
}

/**
 * Setup mocks for all dependencies
 * Call this BEFORE importing any stores
 */
export function setupMocks() {
  // Mock auth API
  vi.mock('../../../frontend/src/api/auth', () => ({
    authApi: {
      setAuthHeader: vi.fn(),
      removeAuthHeader: vi.fn(),
      login: vi.fn(),
      me: vi.fn()
    }
  }))

  // Mock vue-router
  vi.mock('vue-router', () => ({
    useRouter: vi.fn(() => ({
      push: vi.fn().mockResolvedValue(undefined),
      replace: vi.fn().mockResolvedValue(undefined),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn()
    }))
  }))

  // Mock conversations API
  vi.mock('../../../frontend/src/api/conversations', () => ({
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
    }
  }))

  // Mock messages API
  vi.mock('../../../frontend/src/api/messages', () => ({
    messageApi: {
      list: vi.fn(),
      send: vi.fn(),
      markAsRead: vi.fn()
    }
  }))

  // Mock utils
  vi.mock('../../../frontend/src/utils/mockData', () => ({
    generateMockConversations: vi.fn(() => []),
    generateMockMessages: vi.fn(() => [])
  }))
}

/**
 * SOLUTION 1: Dynamic Import Pattern
 * Use this for tests that need to import stores
 */
export async function createStoreTest<T>(
  storeImportPath: string,
  storeExportName: string
): Promise<{ store: T; testEnv: TestSetupResult }> {
  const testEnv = createTestEnvironment()
  
  // Dynamic import AFTER Pinia setup
  const storeModule = await import(storeImportPath)
  const storeFactory = storeModule[storeExportName]
  const store = storeFactory(testEnv.pinia) // Pass Pinia instance explicitly
  
  return { store, testEnv }
}

/**
 * SOLUTION 2: Direct Store Creation Pattern
 * Use this for performance tests and complex scenarios
 */
export function createDirectStore() {
  const testEnv = createTestEnvironment()
  
  // Return factory function for creating stores directly
  return {
    testEnv,
    createStore: (storeDefinition: any) => {
      return storeDefinition(testEnv.pinia)
    }
  }
}

/**
 * SOLUTION 3: Hybrid Pattern
 * Combines both approaches for maximum flexibility
 */
export class PiniaTestManager {
  private testEnv: TestSetupResult
  
  constructor() {
    this.testEnv = createTestEnvironment()
  }
  
  async importStore<T>(storeImportPath: string, storeExportName: string): Promise<T> {
    const storeModule = await import(storeImportPath)
    const storeFactory = storeModule[storeExportName]
    return storeFactory(this.testEnv.pinia) // Pass Pinia instance explicitly
  }
  
  createDirectStore(storeDefinition: any) {
    return storeDefinition(this.testEnv.pinia)
  }
  
  get env() {
    return this.testEnv
  }
  
  reset() {
    vi.clearAllMocks()
    // Don't reset modules here - that would break active stores
  }
}