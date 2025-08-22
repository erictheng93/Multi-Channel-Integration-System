// tests/helpers/testUtils.ts
// Test utilities for handling Hono responses and common test patterns

import { vi } from 'vitest'
import { Context } from 'hono'
import type { Bindings } from '../../src/types'
import { createMockDatabase } from './mockDatabase'

// Mock Hono Context factory
export const createMockContext = (overrides: Partial<Context> = {}) => {
  const mockContext = {
    req: {
      query: vi.fn((key?: string) => {
        if (key) {
          // Default query parameters
          const defaults: Record<string, string> = {
            page: '1',
            pageSize: '50'
          }
          return defaults[key]
        }
        return {}
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
    json: vi.fn((data, status) => {
      // Return the data directly for testing purposes
      return {
        data,
        status: status || 200,
        // Mock response methods if needed
        json: () => Promise.resolve(data)
      }
    }),
    text: vi.fn((text, status) => ({
      text,
      status: status || 200
    })),
    ...overrides
  } as unknown as Context<{ Bindings: Bindings }>

  return mockContext
}

// Helper to extract response data from handler results
export const extractResponseData = (result: any) => {
  if (result && typeof result === 'object') {
    // If it's a mock response from our createMockContext json function
    if (result.data !== undefined) {
      return result.data
    }
    // If it's already the response structure we expect
    if (result.success !== undefined) {
      return result
    }
  }
  return result
}

// Common test data factories
export const createMockJWTPayload = (overrides: any = {}) => ({
  userId: 2,
  username: 'agent',
  role: 'agent',
  teamId: 1,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  ...overrides
})

export const createMockAdminJWTPayload = (overrides: any = {}) => ({
  userId: 1,
  username: 'admin',
  role: 'admin',
  teamId: 1,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  ...overrides
})

export const createMockCustomer = (overrides: any = {}) => ({
  id: 1,
  platform: 'line',
  platform_user_id: 'U123456789',
  display_name: 'Test User',
  avatar_url: 'https://example.com/avatar.jpg',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides
})

export const createMockAgent = (overrides: any = {}) => ({
  id: 2,
  displayName: 'Agent Smith',
  email: 'agent@example.com',
  role: 'agent',
  ...overrides
})

export const createMockConversation = (overrides: any = {}) => ({
  id: 1,
  customer_id: 1,
  assigned_user_id: 2,
  status: 'active',
  last_message_at: '2024-01-01T12:00:00Z',
  created_at: '2024-01-01T10:00:00Z',
  updated_at: '2024-01-01T12:00:00Z',
  // Joined fields
  user_name: 'Test User',
  platform: 'line',
  platform_user_id: 'U123456789',
  avatar_url: 'https://example.com/avatar.jpg',
  agent_name: 'Agent Smith',
  agent_email: 'agent@example.com',
  ...overrides
})

export const createMockMessage = (overrides: any = {}) => ({
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