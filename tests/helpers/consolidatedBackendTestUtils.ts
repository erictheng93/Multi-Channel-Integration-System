// Consolidated Backend Test Utilities
// Backend-specific test infrastructure WITHOUT frontend dependencies (pinia, vue-router, etc.)
// For frontend tests, use consolidatedTestUtils.ts

import { vi } from 'vitest'
import { Context } from 'hono'
import type { Bindings } from '@/types'
import { createMockDatabase } from './mockDatabase'
import { createMockDrizzle, createMockDatabaseService } from './mockDrizzle'

// =================== Core Test Environment ===================

/**
 * Backend test environment setup
 * No Pinia, no frontend dependencies
 */
export function createTestEnvironment() {
  // Clear everything first
  vi.clearAllMocks()
  vi.resetModules()

  return {
    mocks: {
      // Add backend-specific mocks here if needed
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

// =================== Hono Context Mock ===================

/**
 * Backend-specific Hono context creation
 */
export function createMockContext(overrides: Partial<Context> = {}) {
  // Create mock database instances
  const mockDrizzleDB = createMockDrizzle()
  const mockDBService = createMockDatabaseService()

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
    get: vi.fn((key: string) => {
      // Provide dbService and db instances that handlers expect
      if (key === 'dbService') return mockDBService
      if (key === 'db') return mockDrizzleDB
      return undefined
    }),
    set: vi.fn(),
    json: vi.fn((data, status) => ({ data, status: status || 200 })),
    text: vi.fn((text, status) => ({ text, status: status || 200 })),
    ...overrides,
    // Expose the mocks for test setup
    _mockDB: mockDrizzleDB,
    _mockDBService: mockDBService
  } as unknown as Context<{ Bindings: Bindings }> & {
    _mockDB: any;
    _mockDBService: any
  }

  return mockContext
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

// =================== Simple Test Setup ===================

/**
 * Backend-specific test setup
 */
export function simpleTestSetup() {
  vi.clearAllMocks()
  const testEnv = createTestEnvironment()
  const mockContext = createMockContext()

  return {
    mocks: testEnv.mocks,
    mockContext,
    mockDB: mockContext._mockDB,
    mockDBService: mockContext._mockDBService,
    reset: () => vi.clearAllMocks()
  }
}

// =================== Exports for Advanced Usage ===================

// Export the mock creators for direct use in tests
export { createMockDrizzle, createMockDatabaseService } from './mockDrizzle'
