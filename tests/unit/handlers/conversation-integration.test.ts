// tests/unit/handlers/conversation-integration.test.ts
// Project name: Multi-Channel Support MVP
// File path: tests/unit/handlers/conversation-integration.test.ts
// Created by: Test Developer

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { extractResponseData } from '../../helpers/testUtils'
import { Context } from 'hono'
import { conversationHandler } from '@backend/handlers/conversation'
import { createMockDatabase } from '../../helpers/mockDatabase'
import type { Bindings, JWTPayload } from '@backend/types'

// Mock Hono Context
const createMockContext = (overrides: Partial<Context> = {}) => {
  const mockContext = {
    req: {
      query: vi.fn(() => ({})),
      param: vi.fn(),
      json: vi.fn()
    },
    env: {
      DB: createMockDatabase()
    },
    get: vi.fn(),
    json: vi.fn((data, status) => ({ data, status })),
    ...overrides
  } as unknown as Context<{ Bindings: Bindings }>

  return mockContext
}

// Realistic test data
const mockCustomers = [
  {
    id: 1,
    platform: 'line',
    platform_user_id: 'U1234567890abcdef',
    display_name: 'John Doe',
    avatar_url: 'https://profile.line-scdn.net/avatar.jpg',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    platform: 'facebook',
    platform_user_id: 'fb_user_123456',
    display_name: 'Jane Smith',
    avatar_url: 'https://graph.facebook.com/avatar.jpg',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z'
  }
]

const mockAgents = [
  {
    id: 1,
    displayName: 'Admin User',
    email: 'admin@company.com',
    role: 'admin'
  },
  {
    id: 2,
    displayName: 'Support Agent 1',
    email: 'agent1@company.com',
    role: 'agent'
  },
  {
    id: 3,
    displayName: 'Support Agent 2',
    email: 'agent2@company.com',
    role: 'agent'
  }
]

const mockConversations = [
  {
    id: 1,
    customer_id: 1,
    assigned_user_id: 2,
    status: 'active',
    last_message_at: '2024-01-15T14:30:00Z',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T14:30:00Z',
    user_name: 'John Doe',
    platform: 'line',
    platform_user_id: 'U1234567890abcdef',
    avatar_url: 'https://profile.line-scdn.net/avatar.jpg',
    agent_name: 'Support Agent 1',
    agent_email: 'agent1@company.com'
  },
  {
    id: 2,
    customer_id: 2,
    assigned_user_id: null,
    status: 'pending',
    last_message_at: '2024-01-15T15:45:00Z',
    created_at: '2024-01-15T15:45:00Z',
    updated_at: '2024-01-15T15:45:00Z',
    user_name: 'Jane Smith',
    platform: 'facebook',
    platform_user_id: 'fb_user_123456',
    avatar_url: 'https://graph.facebook.com/avatar.jpg',
    agent_name: null,
    agent_email: null
  },
  {
    id: 3,
    customer_id: 1,
    assigned_user_id: 3,
    status: 'closed',
    last_message_at: '2024-01-14T16:20:00Z',
    created_at: '2024-01-14T09:00:00Z',
    updated_at: '2024-01-14T16:30:00Z',
    user_name: 'John Doe',
    platform: 'line',
    platform_user_id: 'U1234567890abcdef',
    avatar_url: 'https://profile.line-scdn.net/avatar.jpg',
    agent_name: 'Support Agent 2',
    agent_email: 'agent2@company.com'
  }
]

const mockJWTPayloads = {
  admin: {
    userId: 1,
    username: 'admin',
    role: 'admin',
    teamId: 1,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  } as JWTPayload,
  agent1: {
    userId: 2,
    username: 'agent1',
    role: 'agent',
    teamId: 2,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  } as JWTPayload,
  agent2: {
    userId: 3,
    username: 'agent2',
    role: 'agent',
    teamId: 2,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  } as JWTPayload
}

describe('conversationHandler - Integration Tests', () => {
  describe('Real-world Scenarios', () => {
    test('should handle a complete conversation workflow', async () => {
      // Scenario: New conversation comes in, gets assigned, and then closed

      // Step 1: List conversations (should show pending conversation)
      const listContext = createMockContext()
      listContext.get = vi.fn().mockReturnValue(mockJWTPayloads.admin)
      listContext.req.query = vi.fn().mockReturnValue({ status: 'pending' })

      const mockDB = listContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT c.*')) {
          const pendingConversation = mockConversations.find(c => c.status === 'pending')
          if (pendingConversation) {
            statement.all.mockResolvedValue({ results: [pendingConversation] })
          } else {
            statement.all.mockResolvedValue({ results: [] })
          }
        } else if (query.includes('SELECT COUNT(*)') && query.includes('conversations')) {
          statement.first.mockResolvedValue({ total: 1 })
        } else if (query.includes('SELECT conversation_id, COUNT(*)')) {
          statement.all.mockResolvedValue({ results: [{ conversation_id: 2, unread_count: 3 }] })
        }

        return statement
      })

      const listResult = await conversationHandler.list(listContext)
      expect(extractResponseData(listResult).success).toBe(true)
      expect(extractResponseData(listResult).data.items).toHaveLength(1)
      expect(extractResponseData(listResult).data.items[0].status).toBe('assigned') // pending -> assigned mapping
      expect(extractResponseData(listResult).data.items[0].unreadCount).toBe(3)

      // Step 2: Assign the conversation to agent1
      const assignContext = createMockContext()
      assignContext.req.param = vi.fn().mockReturnValue('2')
      assignContext.req.json = vi.fn().mockResolvedValue({ agentId: '2' })
      assignContext.get = vi.fn().mockReturnValue(mockJWTPayloads.admin)

      const assignDB = assignContext.env.DB as any
      assignDB.prepare.mockImplementation(() => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } })
        }
        return statement
      })

      const assignResult = await conversationHandler.assign(assignContext)
      expect(extractResponseData(assignResult).success).toBe(true)
      expect(extractResponseData(assignResult).message).toBe('Conversation assigned successfully')

      // Step 3: Get the assigned conversation details
      const getContext = createMockContext()
      getContext.req.param = vi.fn().mockReturnValue('2')

      const getDB = getContext.env.DB as any
      const assignedConversation = {
        ...mockConversations[1],
        assigned_user_id: 2,
        status: 'active',
        agent_name: 'Support Agent 1',
        agent_email: 'agent1@company.com'
      }

      getDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(assignedConversation)
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ unread_count: 2 })
        }

        return statement
      })

      const getResult = await conversationHandler.get(getContext)
      expect(extractResponseData(getResult).success).toBe(true)
      expect(extractResponseData(getResult).data.assignedAgent).toMatchObject({
        id: '2',
        name: 'Support Agent 1',
        email: 'agent1@company.com'
      })
      expect(extractResponseData(getResult).data.unreadCount).toBe(2)

      // Step 4: Close the conversation
      const closeContext = createMockContext()
      closeContext.req.param = vi.fn().mockReturnValue('2')

      const closeDB = closeContext.env.DB as any
      closeDB.prepare.mockImplementation(() => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } })
        }
        return statement
      })

      const closeResult = await conversationHandler.close(closeContext)
      expect(extractResponseData(closeResult).success).toBe(true)
      expect(extractResponseData(closeResult).message).toBe('Conversation closed successfully')
    })

    test('should handle multi-platform conversation management', async () => {
      // Scenario: Admin views conversations from both LINE and Facebook
      const mockContext = createMockContext()
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayloads.admin)
      mockContext.req.query = vi.fn().mockReturnValue({})

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT c.*')) {
          statement.all.mockResolvedValue({ results: mockConversations })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 3 })
        } else if (query.includes('SELECT conversation_id, COUNT(*)')) {
          statement.all.mockResolvedValue({
            results: [
              { conversation_id: 1, unread_count: 1 },
              { conversation_id: 2, unread_count: 5 },
              { conversation_id: 3, unread_count: 0 }
            ]
          })
        }

        return statement
      })

      const result = await conversationHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(3)

      // Verify LINE conversation
      const lineConversation = extractResponseData(result).data.items.find((c: any) => c.user?.platform === 'line')
      expect(lineConversation).toBeDefined()
      expect(lineConversation.user.platformUserId).toBe('U1234567890abcdef')

      // Verify Facebook conversation
      const facebookConversation = extractResponseData(result).data.items.find((c: any) => c.user?.platform === 'facebook')
      expect(facebookConversation).toBeDefined()
      expect(facebookConversation.user.platformUserId).toBe('fb_user_123456')
    })

    test('should handle agent permission restrictions correctly', async () => {
      // Scenario: Agent can only see their assigned conversations
      const mockContext = createMockContext()
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayloads.agent1) // Agent 1 (ID: 2)
      mockContext.req.query = vi.fn().mockReturnValue({})

      const mockDB = mockContext.env.DB as any
      let capturedQuery = ''
      let capturedParams: any[] = []

      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn((...params) => {
            if (query.includes('SELECT c.*')) {
              capturedQuery = query
              capturedParams = params
            }
            return statement
          }),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT c.*')) {
          // Return only conversations assigned to agent 1
          const agentConversations = mockConversations.filter(c => c.assigned_user_id === 2)
          statement.all.mockResolvedValue({ results: agentConversations })
        } else if (query.includes('SELECT COUNT(*)') && query.includes('conversations')) {
          statement.first.mockResolvedValue({ total: 1 })
        } else if (query.includes('SELECT conversation_id, COUNT(*)')) {
          statement.all.mockResolvedValue({ results: [{ conversation_id: 1, unread_count: 2 }] })
        }

        return statement
      })

      const result = await conversationHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(1)
      expect(extractResponseData(result).data.items[0].assignedAgent?.id).toBe('2')

      // Verify permission query was applied
      expect(capturedQuery).toContain('assigned_user_id = ?')
      expect(capturedParams).toContain(2) // Agent 1's ID
      expect(capturedParams).toContain(2) // Team ID
    })

    test('should handle conversation reassignment between agents', async () => {
      // Scenario: Conversation is reassigned from agent1 to agent2
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({ agentId: '3' }) // Reassign to agent2
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayloads.admin)

      const mockDB = mockContext.env.DB as any
      let capturedParams: any[] = []

      mockDB.prepare.mockImplementation(() => {
        const statement = {
          bind: vi.fn((...params) => {
            capturedParams = params
            return statement
          }),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } })
        }
        return statement
      })

      const result = await conversationHandler.assign(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(capturedParams[0]).toBe('3') // New agent ID
      expect(capturedParams[1]).toBe('1') // Conversation ID
    })

    test('should handle bulk operations efficiently', async () => {
      // Scenario: Admin views large number of conversations with pagination
      const mockContext = createMockContext()
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayloads.admin)
      mockContext.req.query = vi.fn().mockReturnValue({
        page: '2',
        pageSize: '50'
      })

      // Generate large dataset
      const largeConversationSet = Array.from({ length: 50 }, (_, i) => ({
        ...mockConversations[0],
        id: i + 51, // Second page (51-100)
        customer_id: i + 51,
        user_name: `User ${i + 51}`,
        platform_user_id: `U${String(i + 51).padStart(9, '0')}`
      }))

      const mockDB = mockContext.env.DB as any
      let queryCount = 0

      mockDB.prepare.mockImplementation((query: string) => {
        queryCount++
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT c.*')) {
          statement.all.mockResolvedValue({ results: largeConversationSet })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 1000 })
        } else if (query.includes('SELECT conversation_id, COUNT(*)')) {
          const unreadCounts = largeConversationSet.map(c => ({
            conversation_id: c.id,
            unread_count: Math.floor(Math.random() * 5)
          }))
          statement.all.mockResolvedValue({ results: unreadCounts })
        }

        return statement
      })

      const startTime = performance.now()
      const result = await conversationHandler.list(mockContext)
      const endTime = performance.now()

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(50)
      expect(extractResponseData(result).data.page).toBe(2)
      expect(extractResponseData(result).data.total).toBe(1000)
      expect(queryCount).toBe(3) // Should make exactly 3 queries
      expect(endTime - startTime).toBeLessThan(100) // Should be fast
    })

    test('should maintain data consistency across operations', async () => {
      // Scenario: Verify conversation data remains consistent through multiple operations
      const conversationId = '1'

      // Step 1: Get initial conversation state
      const getContext1 = createMockContext()
      getContext1.req.param = vi.fn().mockReturnValue(conversationId)

      const initialConversation = mockConversations[0]
      const getDB1 = getContext1.env.DB as any
      getDB1.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(initialConversation)
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ unread_count: 3 })
        }

        return statement
      })

      const initialResult = await conversationHandler.get(getContext1)
      expect(extractResponseData(initialResult).success).toBe(true)
      expect(extractResponseData(initialResult).data.status).toBe('open') // active -> open mapping
      expect(extractResponseData(initialResult).data.assignedAgent?.id).toBe('2')

      // Step 2: Assign to different agent
      const assignContext = createMockContext()
      assignContext.req.param = vi.fn().mockReturnValue(conversationId)
      assignContext.req.json = vi.fn().mockResolvedValue({ agentId: '3' })
      assignContext.get = vi.fn().mockReturnValue(mockJWTPayloads.admin)

      const assignDB = assignContext.env.DB as any
      assignDB.prepare.mockImplementation(() => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }
        return statement
      })

      const assignResult = await conversationHandler.assign(assignContext)
      expect(extractResponseData(assignResult).success).toBe(true)

      // Step 3: Verify conversation state after assignment
      const getContext2 = createMockContext()
      getContext2.req.param = vi.fn().mockReturnValue(conversationId)

      const updatedConversation = {
        ...initialConversation,
        assigned_user_id: 3,
        status: 'pending',
        agent_name: 'Support Agent 2',
        agent_email: 'agent2@company.com'
      }

      const getDB2 = getContext2.env.DB as any
      getDB2.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(updatedConversation)
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ unread_count: 3 })
        }

        return statement
      })

      const updatedResult = await conversationHandler.get(getContext2)
      expect(extractResponseData(updatedResult).success).toBe(true)
      expect(extractResponseData(updatedResult).data.assignedAgent?.id).toBe('3')
      expect(extractResponseData(updatedResult).data.assignedAgent?.name).toBe('Support Agent 2')
    })
  })
})

