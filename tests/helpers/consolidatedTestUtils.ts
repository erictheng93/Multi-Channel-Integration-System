// Consolidated Test Utilities
// Single source of truth for all test infrastructure
// Replaces directStoreCreation.ts, testUtils.ts, piniaTestUtils.ts, and piniaTestSetup.ts

import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { vi } from 'vitest'
import { Context } from 'hono'
import type { Bindings } from '@/types'
import { createMockDatabase } from './mockDatabase'

// =================== Core Test Environment ===================

/**
 * Unified test environment setup
 * Handles Pinia, mocks, and context creation in one place
 */
export function createTestEnvironment() {
  // Clear everything first
  vi.clearAllMocks()
  vi.resetModules()

  // Create Pinia
  const pinia = createPinia()
  setActivePinia(pinia)

  // Setup global mocks
  const mockLocalStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  }

  const mockRouter = {
    push: vi.fn().mockResolvedValue(undefined),
    replace: vi.fn().mockResolvedValue(undefined),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn()
  }

  // Setup globals
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

  return {
    pinia,
    mocks: {
      localStorage: mockLocalStorage,
      router: mockRouter
    }
  }
}

// =================== Mock Factories ===================

/**
 * Unified data factory for all test data creation
 */
export const TestDataFactory = {
  // JWT Payloads
  createJWTPayload: (overrides: any = {}) => ({
    userId: 2,
    username: 'agent',
    role: 'agent',
    teamId: 1,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides
  }),

  createAdminJWTPayload: (overrides: any = {}) => ({
    userId: 1,
    username: 'admin',
    role: 'admin',
    teamId: 1,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides
  }),

  // Entities
  createCustomer: (overrides: any = {}) => ({
    id: 1,
    platform: 'line',
    platform_user_id: 'U123456789',
    display_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides
  }),

  createAgent: (overrides: any = {}) => ({
    id: 2,
    displayName: 'Agent Smith',
    email: 'agent@example.com',
    role: 'agent',
    ...overrides
  }),

  createConversation: (overrides: any = {}) => ({
    id: 1,
    customer_id: 1,
    assigned_user_id: 2,
    status: 'active',
    last_message_at: '2024-01-01T12:00:00Z',
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T12:00:00Z',
    user_name: 'Test User',
    platform: 'line',
    platform_user_id: 'U123456789',
    avatar_url: 'https://example.com/avatar.jpg',
    agent_name: 'Agent Smith',
    agent_email: 'agent@example.com',
    ...overrides
  }),

  createMessage: (overrides: any = {}) => ({
    id: 1,
    conversation_id: 1,
    sender_type: 'customer',
    sender_id: 'U123456789',
    content: 'Hello, I need help',
    message_type: 'text',
    platform_message_id: 'msg123',
    created_at: '2024-01-01T12:00:00Z',
    updated_at: '2024-01-01T12:00:00Z',
    ...overrides
  })
}

// =================== API Mocks ===================

/**
 * Unified API mock factory
 */
export function createAPIMocks() {
  return {
    authApi: {
      setAuthHeader: vi.fn(),
      removeAuthHeader: vi.fn(),
      login: vi.fn(),
      me: vi.fn()
    },
    conversationApi: {
      list: vi.fn(),
      get: vi.fn(),
      assign: vi.fn(),
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

// =================== Hono Context Mock ===================

/**
 * Simplified Hono context creation
 */
export function createMockContext(overrides: Partial<Context> = {}) {
  const mockContext = {
    req: {
      query: vi.fn((key?: string) => {
        const defaults: Record<string, string> = { page: '1', pageSize: '50' }
        return key ? defaults[key] : {}
      }),
      param: vi.fn(),
      json: vi.fn(),
      header: vi.fn()
    },
    env: {
      DB: createMockDatabase(),
      LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
      LINE_CHANNEL_SECRET: 'test-secret',
      JWT_SECRET: 'test-jwt-secret'
    },
    get: vi.fn(),
    json: vi.fn((data, status) => ({ data, status: status || 200 })),
    text: vi.fn((text, status) => ({ text, status: status || 200 })),
    ...overrides
  } as unknown as Context<{ Bindings: Bindings }>

  return mockContext
}

// =================== Store Testing ===================

/**
 * Simple store test helper - no complex patterns needed
 */
export async function setupStoreTest<T>(
  storeImportPath: string,
  storeExportName: string
): Promise<{ store: T; testEnv: any }> {
  const testEnv = createTestEnvironment()

  // Dynamic import after setup
  const storeModule = await import(storeImportPath)
  const storeFactory = storeModule[storeExportName]
  const store = storeFactory()

  return { store, testEnv }
}

// =================== Response Utilities ===================

/**
 * Simple response data extraction
 */
export function extractResponseData(result: any) {
  if (result?.data !== undefined) return result.data
  if (result?.success !== undefined) return result
  return result
}

// =================== Global Setup ===================

/**
 * One-time global test setup
 * Use this in vitest.setup.ts
 */
export function setupGlobalTestEnvironment() {
  // Mock modules
  vi.mock('vue-router', () => ({
    useRouter: vi.fn(() => ({
      push: vi.fn().mockResolvedValue(undefined),
      replace: vi.fn().mockResolvedValue(undefined),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn()
    }))
  }))

  // Setup API mocks
  const apiMocks = createAPIMocks()

  vi.mock('../../frontend/src/api/auth', () => ({ authApi: apiMocks.authApi }))
  vi.mock('../../frontend/src/api/conversations', () => ({ conversationApi: apiMocks.conversationApi }))
  vi.mock('../../frontend/src/api/messages', () => ({ messageApi: apiMocks.messageApi }))

  return apiMocks
}

// =================== Simple Test Setup ===================

/**
 * Use this instead of complex setup functions
 */
export function simpleTestSetup() {
  vi.clearAllMocks()
  const testEnv = createTestEnvironment()
  const apiMocks = createAPIMocks()
  const mockContext = createMockContext()

  return {
    pinia: testEnv.pinia,
    mocks: testEnv.mocks,
    apiMocks,
    mockContext,
    reset: () => vi.clearAllMocks()
  }
}