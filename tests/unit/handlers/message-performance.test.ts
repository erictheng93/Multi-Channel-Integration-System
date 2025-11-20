// tests/unit/handlers/message-performance.test.ts
// 撠??迂嚗ulti-Channel Support MVP
// 瑼?頝臬?嚗?tests/unit/handlers/message-performance.test.ts
// Created by: Test Developer

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { extractResponseData } from '../../helpers/testUtils'
import { Context } from 'hono'
import { messageHandler } from '@backend/handlers/message'
import { createMockDatabase } from '../../helpers/mockDatabase'
import type { Bindings, JWTPayload } from '@backend/types'

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: vi.fn(() => 'perf-test-uuid-12345')
} as any

// Mock Hono Context
const createMockContext = (overrides: Partial<Context> = {}) => {
  const mockContext = {
    req: {
      query: vi.fn().mockImplementation((key?: string) => {
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
      json: vi.fn()
    },
    env: {
      DB: createMockDatabase(),
      LINE_CHANNEL_ACCESS_TOKEN: 'mock-line-token',
      FB_PAGE_ACCESS_TOKEN: 'mock-fb-token'
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

const mockConversation = {
  id: 1,
  customer_id: 1,
  assigned_user_id: 2,
  status: 'active',
  platform: 'line',
  platform_user_id: 'U1234567890abcdef',
  created_at: '2024-01-15T09:00:00Z',
  updated_at: '2024-01-15T10:10:00Z'
}

// Generate large dataset for performance testing
const generateMockMessages = (count: number, conversationId: number = 1) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i + 1}`,
    conversation_id: conversationId,
    sender_type: i % 2 === 0 ? 'customer' : 'agent',
    sender_id: i % 2 === 0 ? 1 : 2,
    content: `Message content ${i + 1}`,
    message_type: ['text', 'image', 'video', 'file'][i % 4],
    platform_message_id: i % 2 === 0 ? `platform-msg-${i + 1}` : null,
    is_sent: true,
    delivery_status: 'delivered',
    created_at: new Date(Date.now() - (count - i) * 60000).toISOString(),
    sender_name: i % 2 === 0 ? `Customer ${Math.floor(i / 2) + 1}` : `Agent ${Math.floor(i / 2) + 1}`
  }))
}

describe('messageHandler - Performance Tests', () => {
  describe('list - Performance', () => {
    test('should handle large message lists efficiently', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockImplementation((key?: string) => {
        if (key) {
          const params: Record<string, string> = {
            page: '1',
            pageSize: '100'
          }
          return params[key]
        }
        return { page: '1', pageSize: '100' }
      })

      const largeMessageSet = generateMockMessages(100)

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: largeMessageSet })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 1000 })
        }

        return statement
      })

      const startTime = performance.now()
      const result = await messageHandler.list(mockContext)
      const endTime = performance.now()

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(100)
      expect(endTime - startTime).toBeLessThan(100) // Should complete within 100ms
    })

    test('should handle pagination with large offsets efficiently', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockImplementation((key?: string) => {
        if (key === 'page') return '500'
        if (key === 'pageSize') return '50'
        if (key) return undefined
        return { page: '500', pageSize: '50' }
      })

      const mockDB = mockContext.env.DB as any
      let capturedParams: any[] = []

      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn((...params) => {
            if (query.includes('SELECT m.*')) {
              capturedParams = params
            }
            return statement
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue({ total: 25000 }),
          run: vi.fn()
        }
        return statement
      })

      const startTime = performance.now()
      const result = await messageHandler.list(mockContext)
      const endTime = performance.now()

      expect(extractResponseData(result).success).toBe(true)
      // Should calculate correct offset: (500 - 1) * 50 = 24950
      expect(capturedParams[2]).toBe(24950)
      expect(endTime - startTime).toBeLessThan(50) // Should be fast even with large offset
    })

    test('should optimize database queries for message retrieval', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockImplementation((key?: string) => {
        if (key) return undefined
        return {}
      })

      const messages = generateMockMessages(50)

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

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: messages })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 50 })
        }

        return statement
      })

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(queryCount).toBe(2) // Should make exactly 2 queries: messages and count
    })

    test('should handle message transformation efficiently', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockImplementation((key?: string) => {
        if (key === 'pageSize') return '1000'
        if (key) return undefined
        return { pageSize: '1000' }
      })

      const largeMessageSet = generateMockMessages(1000)

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: largeMessageSet })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 1000 })
        }

        return statement
      })

      const startTime = performance.now()
      const result = await messageHandler.list(mockContext)
      const endTime = performance.now()

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(1000)

      // Verify all messages were transformed correctly
      extractResponseData(result).data.items.forEach((message: any, index: number) => {
        expect(message.id).toBe(`msg-${index + 1}`)
        expect(message.conversationId).toBe('1')
        expect(['user', 'agent']).toContain(message.senderType)
      })

      expect(endTime - startTime).toBeLessThan(200) // Should handle 1000 transformations within 200ms
    })

    test('should handle concurrent message list requests efficiently', async () => {
      const createRequest = (conversationId: string) => {
        const mockContext = createMockContext()
        mockContext.req.param = vi.fn().mockReturnValue(conversationId)
        mockContext.req.query = vi.fn().mockImplementation((key?: string) => {
          if (key) return undefined
          return {}
        })

        const mockDB = mockContext.env.DB as any
        mockDB.prepare.mockImplementation(() => {
          const statement = {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({ results: generateMockMessages(20, parseInt(conversationId)) }),
            first: vi.fn().mockResolvedValue({ total: 20 }),
            run: vi.fn()
          }
          return statement
        })

        return messageHandler.list(mockContext)
      }

      const startTime = performance.now()
      const promises = Array.from({ length: 10 }, (_, i) => createRequest((i + 1).toString()))
      const results = await Promise.all(promises)
      const endTime = performance.now()

      expect(results).toHaveLength(10)
      results.forEach((result, index) => {
        expect(extractResponseData(result).success).toBe(true)
        expect(extractResponseData(result).data.items).toHaveLength(20)
      })

      // All 10 concurrent requests should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(300) // Less than 300ms for 10 concurrent requests
    })
  })

  describe('send - Performance', () => {
    test('should handle message sending efficiently', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Performance test message',
        mediaUrl: undefined,
        mediaType: undefined
      })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const mockDB = mockContext.env.DB as any
      let queryCount = 0

      mockDB.prepare.mockImplementation((query: string) => {
        queryCount++
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(mockConversation)
        }

        return statement
      })

      const startTime = performance.now()
      const result = await messageHandler.send(mockContext)
      const endTime = performance.now()

      expect(extractResponseData(result).success).toBe(true)
      expect(queryCount).toBe(4) // conversation lookup, insert message, update status, update conversation
      expect(endTime - startTime).toBeLessThan(50) // Should complete within 50ms
    })

    test('should handle batch message sending efficiently', async () => {
      const sendMessage = async (content: string) => {
        const mockContext = createMockContext()
        mockContext.req.param = vi.fn().mockReturnValue('1')
        mockContext.req.json = vi.fn().mockResolvedValue({
          content,
          mediaUrl: undefined,
          mediaType: undefined
        })
        mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

        const mockDB = mockContext.env.DB as any
        mockDB.prepare.mockImplementation((query: string) => {
          const statement = {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn(),
            first: vi.fn(),
            run: vi.fn().mockResolvedValue({ success: true })
          }

          if (query.includes('SELECT c.*')) {
            statement.first.mockResolvedValue(mockConversation)
          }

          return statement
        })

        return messageHandler.send(mockContext)
      }

      const startTime = performance.now()
      const promises = Array.from({ length: 5 }, (_, i) => sendMessage(`Batch message ${i + 1}`))
      const results = await Promise.all(promises)
      const endTime = performance.now()

      expect(results).toHaveLength(5)
      results.forEach((result, index) => {
        expect(extractResponseData(result).success).toBe(true)
        expect(extractResponseData(result).data.content).toBe(`Batch message ${index + 1}`)
      })

      expect(endTime - startTime).toBeLessThan(250) // 5 messages within 250ms
    })

    test('should handle large message content efficiently', async () => {
      const largeContent = 'A'.repeat(5000) // 5KB message

      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: largeContent,
        mediaUrl: undefined,
        mediaType: undefined
      })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(mockConversation)
        }

        return statement
      })

      const startTime = performance.now()
      const result = await messageHandler.send(mockContext)
      const endTime = performance.now()

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.content).toBe(largeContent)
      expect(endTime - startTime).toBeLessThan(100) // Should handle large content within 100ms
    })

    test('should optimize database operations for message sending', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Optimization test message',
        mediaUrl: undefined,
        mediaType: undefined
      })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const mockDB = mockContext.env.DB as any
      const queryTimes: number[] = []

      mockDB.prepare.mockImplementation((query: string) => {
        const queryStart = performance.now()
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockImplementation(async () => {
            const queryEnd = performance.now()
            queryTimes.push(queryEnd - queryStart)
            return { success: true }
          })
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockImplementation(async () => {
            const queryEnd = performance.now()
            queryTimes.push(queryEnd - queryStart)
            return mockConversation
          })
        }

        return statement
      })

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(queryTimes).toHaveLength(4) // 4 database operations

      // Each individual query should be fast
      queryTimes.forEach(time => {
        expect(time).toBeLessThan(10) // Each query within 10ms
      })
    })

    test('should handle UUID generation efficiently', async () => {
      const uuidGenerationTimes: number[] = []

      // Mock UUID generation with timing
      global.crypto.randomUUID = vi.fn().mockImplementation(() => {
        const start = performance.now()
        const uuid = `uuid-${Date.now()}-${Math.random()}`
        const end = performance.now()
        uuidGenerationTimes.push(end - start)
        return uuid
      })

      const sendMultipleMessages = async (count: number) => {
        const promises = Array.from({ length: count }, async (_, i) => {
          const mockContext = createMockContext()
          mockContext.req.param = vi.fn().mockReturnValue('1')
          mockContext.req.json = vi.fn().mockResolvedValue({
            content: `Message ${i + 1}`,
            mediaUrl: undefined,
            mediaType: undefined
          })
          mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

          const mockDB = mockContext.env.DB as any
          mockDB.prepare.mockImplementation((query: string) => {
            const statement = {
              bind: vi.fn().mockReturnThis(),
              all: vi.fn(),
              first: vi.fn(),
              run: vi.fn().mockResolvedValue({ success: true })
            }

            if (query.includes('SELECT c.*')) {
              statement.first.mockResolvedValue(mockConversation)
            }

            return statement
          })

          return messageHandler.send(mockContext)
        })

        return Promise.all(promises)
      }

      const results = await sendMultipleMessages(10)

      expect(results).toHaveLength(10)
      expect(uuidGenerationTimes).toHaveLength(10)

      // UUID generation should be very fast
      uuidGenerationTimes.forEach(time => {
        expect(time).toBeLessThan(1) // Each UUID generation within 1ms
      })
    })
  })

  describe('Memory and Resource Usage', () => {
    test('should not leak memory with large message datasets', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockReturnValue({
        pageSize: '2000'
      })

      const largeDataset = generateMockMessages(2000)

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: largeDataset })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 2000 })
        }

        return statement
      })

      const initialMemory = process.memoryUsage().heapUsed
      const result = await messageHandler.list(mockContext)
      const finalMemory = process.memoryUsage().heapUsed

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(2000)

      // Memory usage should not increase dramatically
      const memoryIncrease = finalMemory - initialMemory
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Less than 100MB increase
    })

    test('should handle rapid successive requests efficiently', async () => {
      const createRapidRequest = (index: number) => {
        const mockContext = createMockContext()
        mockContext.req.param = vi.fn().mockReturnValue('1')
        mockContext.req.query = vi.fn().mockImplementation((key?: string) => {
          if (key === 'page') return index.toString()
          if (key === 'pageSize') return '10'
          if (key) return undefined
          return { page: index.toString(), pageSize: '10' }
        })

        const mockDB = mockContext.env.DB as any
        mockDB.prepare.mockImplementation(() => {
          const statement = {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({ results: generateMockMessages(10) }),
            first: vi.fn().mockResolvedValue({ total: 100 }),
            run: vi.fn()
          }
          return statement
        })

        return messageHandler.list(mockContext)
      }

      const startTime = performance.now()

      // Create 20 rapid successive requests
      const results: any[] = []
      for (let i = 1; i <= 20; i++) {
        results.push(await createRapidRequest(i))
      }

      const endTime = performance.now()

      expect(results).toHaveLength(20)
      results.forEach(result => {
        expect(extractResponseData(result).success).toBe(true)
      })

      // 20 successive requests should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000) // Less than 1 second
    })

    test('should efficiently handle mixed read/write operations', async () => {
      const operations: any[] = []

      // Mix of list and send operations
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          // List operation
          const listContext = createMockContext()
          listContext.req.param = vi.fn().mockReturnValue('1')
          listContext.req.query = vi.fn().mockImplementation((key?: string) => {
            if (key) return undefined
            return {}
          })

          const listDB = listContext.env.DB as any
          listDB.prepare.mockImplementation(() => {
            const statement = {
              bind: vi.fn().mockReturnThis(),
              all: vi.fn().mockResolvedValue({ results: generateMockMessages(10) }),
              first: vi.fn().mockResolvedValue({ total: 10 }),
              run: vi.fn()
            }
            return statement
          })

          operations.push(messageHandler.list(listContext))
        } else {
          // Send operation
          const sendContext = createMockContext()
          sendContext.req.param = vi.fn().mockReturnValue('1')
          sendContext.req.json = vi.fn().mockResolvedValue({
            content: `Mixed operation message ${i}`,
            mediaUrl: undefined,
            mediaType: undefined
          })
          sendContext.get = vi.fn().mockReturnValue(mockJWTPayload)

          const sendDB = sendContext.env.DB as any
          sendDB.prepare.mockImplementation((query: string) => {
            const statement = {
              bind: vi.fn().mockReturnThis(),
              all: vi.fn(),
              first: vi.fn(),
              run: vi.fn().mockResolvedValue({ success: true })
            }

            if (query.includes('SELECT c.*')) {
              statement.first.mockResolvedValue(mockConversation)
            }

            return statement
          })

          operations.push(messageHandler.send(sendContext))
        }
      }

      const startTime = performance.now()
      const results = await Promise.all(operations)
      const endTime = performance.now()

      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(extractResponseData(result).success).toBe(true)
      })

      expect(endTime - startTime).toBeLessThan(500) // Mixed operations within 500ms
    })
  })
})

