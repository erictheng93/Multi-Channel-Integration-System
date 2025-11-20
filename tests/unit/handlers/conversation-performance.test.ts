// tests/unit/handlers/conversation-performance.test.ts
// 撠??迂嚗ulti-Channel Support MVP
// 瑼?頝臬?嚗?tests/unit/handlers/conversation-performance.test.ts
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

const mockJWTPayload: JWTPayload = {
  userId: 2,
  username: 'agent',
  role: 'agent',
  teamId: 1,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600
}

// Generate large dataset for performance testing
const generateMockConversations = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    customer_id: i + 1,
    assigned_user_id: (i % 3) + 1,
    status: ['active', 'pending', 'closed'][i % 3],
    last_message_at: new Date(Date.now() - i * 60000).toISOString(),
    created_at: new Date(Date.now() - i * 3600000).toISOString(),
    updated_at: new Date(Date.now() - i * 60000).toISOString(),
    user_name: `User ${i + 1}`,
    platform: ['line', 'facebook'][i % 2],
    platform_user_id: `U${String(i + 1).padStart(9, '0')}`,
    avatar_url: `https://example.com/avatar${i + 1}.jpg`,
    agent_name: `Agent ${(i % 3) + 1}`,
    agent_email: `agent${(i % 3) + 1}@example.com`
  }))
}

const generateUnreadCounts = (conversationIds: number[]) => {
  return conversationIds.map(id => ({
    conversation_id: id,
    unread_count: Math.floor(Math.random() * 10)
  }))
}

describe('conversationHandler - Performance Tests', () => {
  describe('list - Performance', () => {
    test('should handle large conversation lists efficiently', async () => {
      const mockContext = createMockContext()
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)
      mockContext.req.query = vi.fn().mockReturnValue({
        page: '1',
        pageSize: '100'
      })

      const largeConversationSet = generateMockConversations(100)
      const unreadCounts = generateUnreadCounts(largeConversationSet.map(c => c.id))

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
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
          statement.all.mockResolvedValue({ results: unreadCounts })
        }

        return statement
      })

      const startTime = performance.now()
      const result = await conversationHandler.list(mockContext)
      const endTime = performance.now()

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(100)
      expect(endTime - startTime).toBeLessThan(100) // Should complete within 100ms
    })

    test('should handle pagination with large offsets', async () => {
      const mockContext = createMockContext()
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)
      mockContext.req.query = vi.fn().mockReturnValue({
        page: '1000', // Very high page number
        pageSize: '50'
      })

      const mockDB = mockContext.env.DB as any
      let capturedParams: any[] = []
      
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn((...params) => {
            if (query.includes('LIMIT ? OFFSET ?')) {
              capturedParams = params
            }
            return statement
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue({ total: 50000 }),
          run: vi.fn()
        }
        return statement
      })

      const result = await conversationHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      // Should calculate correct offset: (1000 - 1) * 50 = 49950
      // Last parameter should be the offset
      expect(capturedParams[capturedParams.length - 1]).toBe(49950)
    })

    test('should optimize unread count queries for conversations without messages', async () => {
      const mockContext = createMockContext()
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)
      mockContext.req.query = vi.fn().mockReturnValue({})

      const conversationsWithoutMessages = generateMockConversations(10)

      const mockDB = mockContext.env.DB as any
      let unreadQueryCalled = false
      
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT c.*')) {
          statement.all.mockResolvedValue({ results: conversationsWithoutMessages })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 10 })
        } else if (query.includes('SELECT conversation_id, COUNT(*)')) {
          unreadQueryCalled = true
          statement.all.mockResolvedValue({ results: [] }) // No unread messages
        }

        return statement
      })

      const result = await conversationHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(unreadQueryCalled).toBe(true)
      // All conversations should have 0 unread count
      extractResponseData(result).data.items.forEach((item: any) => {
        expect(item.unreadCount).toBe(0)
      })
    })

    test('should handle concurrent database queries efficiently', async () => {
      const mockContext = createMockContext()
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)
      mockContext.req.query = vi.fn().mockReturnValue({})

      const conversations = generateMockConversations(5)
      const unreadCounts = generateUnreadCounts([1, 2, 3, 4, 5])

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
          statement.all.mockResolvedValue({ results: conversations })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 5 })
        } else if (query.includes('SELECT conversation_id, COUNT(*)')) {
          statement.all.mockResolvedValue({ results: unreadCounts })
        }

        return statement
      })

      const result = await conversationHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(queryCount).toBe(3) // Should make exactly 3 queries: conversations, count, unread
    })
  })

  describe('get - Performance', () => {
    test('should retrieve single conversation efficiently', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')

      const mockConversation = generateMockConversations(1)[0]

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(mockConversation)
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ unread_count: 5 })
        }

        return statement
      })

      const startTime = performance.now()
      const result = await conversationHandler.get(mockContext)
      const endTime = performance.now()

      expect(extractResponseData(result).success).toBe(true)
      expect(endTime - startTime).toBeLessThan(50) // Should complete within 50ms
    })

    test('should handle complex unread count calculation efficiently', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')

      const mockConversation = generateMockConversations(1)[0]

      const mockDB = mockContext.env.DB as any
      let unreadQueryComplexity = 0
      
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(mockConversation)
        } else if (query.includes('SELECT COUNT(*)')) {
          // Simulate complex unread count query
          unreadQueryComplexity = query.length // Measure query complexity
          statement.first.mockResolvedValue({ unread_count: 10 })
        }

        return statement
      })

      const result = await conversationHandler.get(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(unreadQueryComplexity).toBeGreaterThan(0)
      expect(extractResponseData(result).data.unreadCount).toBe(10)
    })
  })

  describe('assign - Performance', () => {
    test('should handle batch assignment operations efficiently', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({ agentId: '3' })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const mockDB = mockContext.env.DB as any
      let updateQueryCount = 0
      
      mockDB.prepare.mockImplementation(() => {
        updateQueryCount++
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }
        return statement
      })

      const startTime = performance.now()
      const result = await conversationHandler.assign(mockContext)
      const endTime = performance.now()

      expect(extractResponseData(result).success).toBe(true)
      expect(updateQueryCount).toBe(1) // Should make only one update query
      expect(endTime - startTime).toBeLessThan(50) // Should complete within 50ms
    })

    test('should handle assignment with timestamp updates efficiently', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({ agentId: '3' })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const mockDB = mockContext.env.DB as any
      let capturedQuery = ''
      
      mockDB.prepare.mockImplementation((query: string) => {
        capturedQuery = query
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }
        return statement
      })

      const result = await conversationHandler.assign(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      // Should update timestamp efficiently using CURRENT_TIMESTAMP
      expect(capturedQuery).toContain('CURRENT_TIMESTAMP')
    })
  })

  describe('close - Performance', () => {
    test('should handle conversation closure efficiently', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')

      const mockDB = mockContext.env.DB as any
      let updateQueryCount = 0
      
      mockDB.prepare.mockImplementation(() => {
        updateQueryCount++
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }
        return statement
      })

      const startTime = performance.now()
      const result = await conversationHandler.close(mockContext)
      const endTime = performance.now()

      expect(extractResponseData(result).success).toBe(true)
      expect(updateQueryCount).toBe(1) // Should make only one update query
      expect(endTime - startTime).toBeLessThan(50) // Should complete within 50ms
    })

    test('should handle bulk closure operations efficiently', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')

      const mockDB = mockContext.env.DB as any
      let capturedQuery = ''
      
      mockDB.prepare.mockImplementation((query: string) => {
        capturedQuery = query
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ 
            success: true,
            meta: { changes: 1 }
          })
        }
        return statement
      })

      const result = await conversationHandler.close(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      // Should use efficient single UPDATE query
      expect(capturedQuery).toContain('UPDATE conversations')
      expect(capturedQuery).toContain('CURRENT_TIMESTAMP')
    })
  })

  describe('Memory and Resource Usage', () => {
    test('should not leak memory with large datasets', async () => {
      const mockContext = createMockContext()
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)
      mockContext.req.query = vi.fn().mockReturnValue({
        pageSize: '1000'
      })

      const largeDataset = generateMockConversations(1000)
      const largeUnreadCounts = generateUnreadCounts(largeDataset.map(c => c.id))

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT c.*')) {
          statement.all.mockResolvedValue({ results: largeDataset })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 1000 })
        } else if (query.includes('SELECT conversation_id, COUNT(*)')) {
          statement.all.mockResolvedValue({ results: largeUnreadCounts })
        }

        return statement
      })

      const initialMemory = process.memoryUsage().heapUsed
      const result = await conversationHandler.list(mockContext)
      const finalMemory = process.memoryUsage().heapUsed

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(1000)
      
      // Memory usage should not increase dramatically
      const memoryIncrease = finalMemory - initialMemory
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Less than 50MB increase
    })

    test('should handle concurrent requests efficiently', async () => {
      const createRequest = () => {
        const mockContext = createMockContext()
        mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)
        mockContext.req.query = vi.fn().mockReturnValue({})

        const mockDB = mockContext.env.DB as any
        mockDB.prepare.mockImplementation(() => {
          const statement = {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({ results: generateMockConversations(10) }),
            first: vi.fn().mockResolvedValue({ total: 10 }),
            run: vi.fn()
          }
          return statement
        })

        return conversationHandler.list(mockContext)
      }

      const startTime = performance.now()
      const promises = Array.from({ length: 10 }, () => createRequest())
      const results = await Promise.all(promises)
      const endTime = performance.now()

      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(extractResponseData(result).success).toBe(true)
      })
      
      // All 10 concurrent requests should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(500) // Less than 500ms for 10 concurrent requests
    })
  })
})

