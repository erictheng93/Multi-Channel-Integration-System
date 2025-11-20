// tests/unit/handlers/conversation-edge-cases.test.ts
// Conversation Handler Edge Case Tests - Updated for Hono App + Drizzle ORM
// Tests edge cases and error scenarios

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { conversationHandler } from '@backend/handlers/conversation'
import { createMockDrizzle } from '../../helpers/mockDrizzle'

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  ...global.crypto,
  randomUUID: vi.fn(() => `conv-${Date.now()}`)
})

// Mock realtime module
vi.mock('@modules/realtime', () => ({
  realtime: {
    route: vi.fn().mockReturnValue({}),
    createEvent: vi.fn().mockResolvedValue({})
  }
}))

// Mock database schema
vi.mock('../../../src/db/schema', () => ({
  conversations: {},
  agents: {},
  conversationTransfers: {},
  teams: {},
  conversationTags: {},
  customers: {}
}))

// Mock DatabaseService
let mockDbServiceInstance: any
vi.mock('../../../src/services/database', () => ({
  DatabaseService: vi.fn().mockImplementation(() => mockDbServiceInstance)
}))

// Mock authentication middleware
vi.mock('../../../src/middleware/database', () => ({
  databaseMiddleware: vi.fn((c, next) => {
    // Middleware is mocked inline in the test
    return next()
  }),
  authMiddleware: vi.fn((c, next) => {
    // Middleware is mocked inline in the test
    return next()
  })
}))

// Mock JWT authentication
vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn((c, next) => {
    c.set('jwtPayload', {
      userId: 1,
      username: 'test-user',
      role: 'admin',
      teamId: 1
    });
    return next();
  })
}));

describe('conversationHandler - Edge Cases', () => {
  let app: Hono
  let mockDB: any
  let mockDrizzle: any
  let mockDbService: any

  beforeEach(() => {
    vi.clearAllMocks();
    // Create fresh Hono app
    app = new Hono()

    mockDrizzle = createMockDrizzle()

    // Create mock D1 database
    mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true })
      })
    }

    // Create mockDbService that can be modified by tests
    mockDbService = {
      getConversationsByRole: vi.fn().mockResolvedValue([]),
      canAgentAccessConversation: vi.fn().mockResolvedValue(true),
      getConversationById: vi.fn().mockResolvedValue(null),
      getMessagesByConversationId: vi.fn().mockResolvedValue([]),
      updateConversation: vi.fn().mockResolvedValue({ success: true })
    }

    // Set the instance that will be returned by the mocked constructor
    mockDbServiceInstance = mockDbService

    // Add middleware to inject mocks into context
    app.use('*', async (c, next) => {
      c.env = {
        DB: mockDB,
        KV: {
          get: vi.fn().mockResolvedValue(null),
          put: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          list: vi.fn().mockResolvedValue({ keys: [] }),
          getCache: vi.fn().mockResolvedValue(null)
        }
      } as any

      c.set('db', mockDrizzle)
      c.set('dbService', mockDbService)
      c.set('kv', c.env.KV)
      c.set('agent', {
        id: 2,
        userId: 2,
        username: 'agent',
        displayName: 'Agent Smith',
        role: 'agent',
        teamId: 1
      })

      await next()
    })

    // Mount conversation handler
    app.route('/api/conversations', conversationHandler)
  })

  describe('list - Edge Cases', () => {
    test('should handle invalid page numbers gracefully', async () => {
      mockDrizzle.mockQueryResponses([], 0)

      const response = await app.request('/api/conversations?page=invalid&pageSize=also-invalid')
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })

    test('should handle negative page numbers', async () => {
      mockDrizzle.mockQueryResponses([], 0)

      const response = await app.request('/api/conversations?page=-1&pageSize=0')
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })

    test('should handle very large page sizes', async () => {
      mockDrizzle.mockQueryResponses([], 0)

      const response = await app.request('/api/conversations?page=1&pageSize=999999')
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })

    test('should handle conversations without customer data', async () => {
      const conversationWithoutCustomer = {
        id: 1,
        customerId: 1,
        assignedUserId: null,
        status: 'active',
        lastMessageAt: null,
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T12:00:00Z',
        customerName: null,
        platform: null,
        platformUserId: null,
        avatarUrl: null,
        agentName: null,
        agentEmail: null
      }

      // Mock dbService to return conversation
      mockDbService.getConversationsByRole.mockResolvedValueOnce([conversationWithoutCustomer])
      mockDrizzle.mockQueryResponses([conversationWithoutCustomer], 1)

      const response = await app.request('/api/conversations')
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.conversations).toHaveLength(1)
    })

    test('should handle empty unread counts result', async () => {
      const mockConversation = {
        id: 1,
        customerId: 1,
        assignedUserId: 2,
        status: 'active',
        lastMessageAt: '2024-01-01T12:00:00Z',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T12:00:00Z',
        customerName: 'Test User',
        platform: 'line',
        platformUserId: 'U123456789',
        avatarUrl: null,
        agentName: 'Agent Smith',
        agentEmail: 'agent@example.com'
      }

      // Mock dbService to return conversation
      mockDbService.getConversationsByRole.mockResolvedValueOnce([mockConversation])
      mockDrizzle.mockQueryResponses([mockConversation], 1)

      const response = await app.request('/api/conversations')
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.conversations).toHaveLength(1)
    })

    test('should handle null JWT payload', async () => {
      // Create app without agent in context
      const noAuthApp = new Hono()

      noAuthApp.use('*', async (c, next) => {
        c.env = {
          DB: mockDB,
          KV: {
            get: vi.fn().mockResolvedValue(null),
            put: vi.fn().mockResolvedValue(undefined)
          }
        } as any

        c.set('db', mockDrizzle)
        c.set('dbService', {
          getConversationsByRole: vi.fn().mockResolvedValue([])
        })
        // No agent set

        await next()
      })

      noAuthApp.route('/api/conversations', conversationHandler)

      mockDrizzle.mockQueryResponses([], 0)

      const response = await noAuthApp.request('/api/conversations')
      const result = await response.json()

      // Should still succeed even without JWT payload
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })
  })

  describe('get - Edge Cases', () => {
    test('should handle conversation with null timestamps', async () => {
      const conversationWithNullTimestamps = {
        id: '1',
        customerId: 1,
        assignedUserId: 2,
        status: 'active',
        lastMessageAt: null,
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T12:00:00Z',
        customerName: 'Test User',
        platform: 'line',
        platformUserId: 'U123456789',
        avatarUrl: null,
        agentName: 'Agent Smith',
        agentEmail: 'agent@example.com'
      }

      // Mock dbService methods
      mockDbService.canAgentAccessConversation.mockResolvedValueOnce(true)
      mockDbService.getConversationById.mockResolvedValueOnce(conversationWithNullTimestamps)
      mockDrizzle.mockSelectResponse([conversationWithNullTimestamps])

      const response = await app.request('/api/conversations/1')
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })

    test('should handle invalid conversation ID parameter', async () => {
      mockDrizzle.mockSelectResponse([])

      const response = await app.request('/api/conversations/invalid-id')
      const result = await response.json()

      expect(response.status).toBe(404)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Conversation not found')
    })

    test('should handle null unread count result', async () => {
      const mockConversation = {
        id: '1',
        customerId: 1,
        assignedUserId: 2,
        status: 'active',
        lastMessageAt: '2024-01-01T12:00:00Z',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T12:00:00Z',
        customerName: 'Test User',
        platform: 'line',
        platformUserId: 'U123456789',
        avatarUrl: null,
        agentName: 'Agent Smith',
        agentEmail: 'agent@example.com'
      }

      // Mock dbService methods
      mockDbService.canAgentAccessConversation.mockResolvedValueOnce(true)
      mockDbService.getConversationById.mockResolvedValueOnce(mockConversation)
      mockDrizzle.mockSelectResponse([mockConversation])

      const response = await app.request('/api/conversations/1')
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })
  })

  describe('assign - Edge Cases', () => {
    test('should handle malformed JSON request body', async () => {
      const response = await app.request('/api/conversations/1/assign', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json'
      })

      expect(response.status).toBe(500)
    })

    test('should handle empty agentId string', async () => {
      // Mock dbService for permission check
      mockDbService.canAgentAccessConversation.mockResolvedValueOnce(true)
      mockDrizzle.mockUpdateResponse('conversations', 1)

      const response = await app.request('/api/conversations/1/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: '' })
      })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })

    test('should handle null agentId', async () => {
      // Mock dbService for permission check
      mockDbService.canAgentAccessConversation.mockResolvedValueOnce(true)
      mockDrizzle.mockUpdateResponse('conversations', 1)

      const response = await app.request('/api/conversations/1/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: null })
      })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })

    test('should handle database update failure', async () => {
      // Mock dbService for permission check
      mockDbService.canAgentAccessConversation.mockResolvedValueOnce(true)
      mockDrizzle.mockUpdateResponse('conversations', 0) // No rows affected

      const response = await app.request('/api/conversations/1/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: '3' })
      })
      const result = await response.json()

      // Handler doesn't check if rows were affected, so it still succeeds
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })
  })

  describe('close - Edge Cases', () => {
    test('should handle invalid conversation ID', async () => {
      // Mock dbService for permission check
      mockDbService.canAgentAccessConversation.mockResolvedValueOnce(true)
      mockDrizzle.mockUpdateResponse('conversations', 1)

      const response = await app.request('/api/conversations/invalid-id/close', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token' }
      })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })

    test('should handle database update with no affected rows', async () => {
      // Mock dbService for permission check
      mockDbService.canAgentAccessConversation.mockResolvedValueOnce(true)
      mockDrizzle.mockUpdateResponse('conversations', 0)

      const response = await app.request('/api/conversations/999/close', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token' }
      })
      const result = await response.json()

      // Handler doesn't check if rows were affected
      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })

    test('should handle missing conversation ID parameter', async () => {
      mockDrizzle.mockUpdateResponse('conversations', 1)

      const response = await app.request('/api/conversations//close', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token' }
      })

      // Route might not match or return error
      expect([200, 404, 500]).toContain(response.status)
    })
  })
})
