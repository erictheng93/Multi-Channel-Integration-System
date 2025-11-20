// tests/unit/handlers/conversation.test.ts
// Conversation Handler Tests - Updated for Hono App + Drizzle ORM
// Tests conversation routes through HTTP requests using app.request()

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

describe('conversationHandler - Hono App Routes', () => {
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

  describe('GET / - List conversations', () => {
    test('should return conversations list with default pagination', async () => {
      const mockConversations = [
        {
          id: '1',
          customerId: 1,
          assignedUserId: 2,
          status: 'active',
          lastMessageAt: '2024-01-15T10:00:00Z',
          createdAt: '2024-01-15T09:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
          customerName: 'Test User',
          platform: 'line',
          platformUserId: 'U123456789',
          agentName: 'Agent Smith',
          agentEmail: 'agent@example.com'
        }
      ]

      mockDrizzle.mockQueryResponses(mockConversations, 1)

      const response = await app.request('/api/conversations')
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.conversations).toHaveLength(1)
    })

    test('should handle custom pagination parameters', async () => {
      mockDrizzle.mockQueryResponses([], 25)

      const response = await app.request('/api/conversations?page=2&pageSize=10')
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })

    test('should filter by status when provided', async () => {
      const closedConversations = [
        {
          id: '1',
          customerId: 1,
          assignedUserId: 2,
          status: 'closed',
          lastMessageAt: '2024-01-15T10:00:00Z',
          createdAt: '2024-01-15T09:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
          customerName: 'Test User',
          platform: 'line',
          platformUserId: 'U123456789'
        }
      ]

      mockDrizzle.mockQueryResponses(closedConversations, 1)

      const response = await app.request('/api/conversations?status=closed')
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })

    test('should handle database errors gracefully', async () => {
      mockDrizzle.mockError(new Error('Database connection failed'))

      const response = await app.request('/api/conversations')
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.success).toBe(false)
    })
  })

  describe('GET /:id - Get single conversation', () => {
    test('should return a single conversation', async () => {
      const mockConversation = {
        id: '1',
        customerId: 1,
        assignedUserId: 2,
        status: 'active',
        lastMessageAt: '2024-01-15T10:00:00Z',
        createdAt: '2024-01-15T09:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        customerName: 'Test User',
        platform: 'line',
        platformUserId: 'U123456789',
        agentName: 'Agent Smith',
        agentEmail: 'agent@example.com'
      }

      mockDrizzle.mockSelectResponse([mockConversation])

      const response = await app.request('/api/conversations/1')
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data.conversation.id).toBe('1')
    })

    test('should return 404 when conversation not found', async () => {
      // Set up mocks for non-existent conversation
      mockDbService.canAgentAccessConversation.mockResolvedValueOnce(true)
      mockDbService.getConversationById.mockResolvedValueOnce(null)

      const response = await app.request('/api/conversations/999')
      const result = await response.json()

      expect(response.status).toBe(404)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Conversation not found')
    })

    test('should handle database errors gracefully', async () => {
      mockDrizzle.mockError(new Error('Database error'))

      const response = await app.request('/api/conversations/1')
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.success).toBe(false)
    })
  })

  describe('POST /:id/assign - Assign conversation', () => {
    test('should assign conversation to specified agent', async () => {
      mockDrizzle.mockUpdateResponse('conversations', 1)

      const response = await app.request('/api/conversations/1/assign', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: '3' })
      })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })

    test('should assign conversation to current user when no agentId provided', async () => {
      mockDrizzle.mockUpdateResponse('conversations', 1)

      const response = await app.request('/api/conversations/1/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })

    test('should handle database errors gracefully', async () => {
      mockDrizzle.mockError(new Error('Database error'))

      const response = await app.request('/api/conversations/1/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: '3' })
      })
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.success).toBe(false)
    })
  })

  describe('POST /:id/close - Close conversation', () => {
    test('should close conversation successfully', async () => {
      mockDrizzle.mockUpdateResponse('conversations', 1)

      const response = await app.request('/api/conversations/1/close', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' }
      })
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
    })

    test('should handle database errors gracefully', async () => {
      mockDrizzle.mockError(new Error('Database error'))

      const response = await app.request('/api/conversations/1/close', {
        method: 'POST'
      })
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.success).toBe(false)
    })

    test('should update conversation status to closed', async () => {
      let capturedUpdateData: any = null

      mockDrizzle.update = vi.fn(() => {
        const builder = mockDrizzle.createQueryBuilder('update', {})
        builder.set = vi.fn((data: any) => {
          capturedUpdateData = data
          return builder
        })
        builder.execute = vi.fn().mockResolvedValue({ changes: 1 })
        builder.then = vi.fn(async (resolve: any) => resolve({ changes: 1 }))
        return builder
      })

      const response = await app.request('/api/conversations/1/close', {
        method: 'POST'
      })

      expect(response.status).toBe(200)
      // Verify status was set to closed
      expect(capturedUpdateData?.status).toBe('closed')
    })
  })
})
