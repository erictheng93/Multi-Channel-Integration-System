// tests/unit/handlers/message-edge-cases.test.ts
// 撠??迂嚗ulti-Channel Support MVP
// 瑼?頝臬?嚗?tests/unit/handlers/message-edge-cases.test.ts
// Created by: Test Developer

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { extractResponseData } from '../../helpers/testUtils'
import { Context } from 'hono'
import { messageHandler } from '@backend/handlers/message'
import { createMockDatabase } from '../../helpers/mockDatabase'
import type { Bindings, JWTPayload } from '@backend/types'

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: vi.fn(() => 'edge-case-uuid-12345')
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

describe('messageHandler - Edge Cases', () => {
  describe('list - Edge Cases', () => {
    test('should handle invalid conversation ID parameter', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('invalid-id')

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation(() => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue({ total: 0 }),
          run: vi.fn()
        }
        return statement
      })

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(0)
    })

    test('should handle invalid page numbers gracefully', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockImplementation((key?: string) => {
        if (key === undefined) {
          return { page: 'invalid', pageSize: 'also-invalid' }
        }
        if (key === 'page') return 'invalid'
        if (key === 'pageSize') return 'also-invalid'
        return undefined
      })

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation(() => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue({ total: 0 }),
          run: vi.fn()
        }
        return statement
      })

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      // parseInt('invalid') returns NaN, which is what the handler actually does
      expect(isNaN(extractResponseData(result).data.page)).toBe(true)
      expect(isNaN(extractResponseData(result).data.pageSize)).toBe(true)
    })

    test('should handle negative page numbers', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockImplementation((key?: string) => {
        if (key === undefined) {
          return { page: '-1', pageSize: '0' }
        }
        if (key === 'page') return '-1'
        if (key === 'pageSize') return '0'
        return undefined
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
          first: vi.fn().mockResolvedValue({ total: 0 }),
          run: vi.fn()
        }
        return statement
      })

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.page).toBe(-1) // parseInt preserves negative
      expect(extractResponseData(result).data.pageSize).toBe(0)
      // Offset calculation: (-1 - 1) * 0 = -0 = 0
      expect(capturedParams[2]).toBe(-0)
    })

    test('should handle very large page sizes', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockImplementation((key?: string) => {
        if (key === undefined) {
          return { page: '1', pageSize: '999999' }
        }
        if (key === 'page') return '1'
        if (key === 'pageSize') return '999999'
        return undefined
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
          first: vi.fn().mockResolvedValue({ total: 0 }),
          run: vi.fn()
        }
        return statement
      })

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.pageSize).toBe(999999)
      expect(capturedParams[1]).toBe(999999) // pageSize parameter
    })

    test('should handle messages with null sender information', async () => {
      const messagesWithNullSender = [
        {
          id: 'msg-1',
          conversation_id: 1,
          sender_type: 'customer',
          sender_id: null, // null sender_id
          content: 'Message with null sender',
          message_type: 'text',
          platform_message_id: null,
          is_sent: true,
          delivery_status: 'delivered',
          created_at: '2024-01-15T10:00:00Z',
          sender_name: null // null sender_name
        }
      ]

      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockImplementation((key?: string) => {
        if (key === undefined) return {}
        return undefined
      })

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: messagesWithNullSender })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 1 })
        }

        return statement
      })

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(1)
      expect(extractResponseData(result).data.items[0].senderId).toBe('') // null -> empty string
    })

    test('should handle messages with invalid timestamps', async () => {
      const messagesWithInvalidTimestamp = [
        {
          id: 'msg-1',
          conversation_id: 1,
          sender_type: 'customer',
          sender_id: 1,
          content: 'Message with invalid timestamp',
          message_type: 'text',
          platform_message_id: null,
          is_sent: true,
          delivery_status: 'delivered',
          created_at: 'invalid-date', // invalid timestamp
          sender_name: 'John Doe'
        }
      ]

      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockImplementation((key?: string) => {
        if (key === undefined) return {}
        return undefined
      })

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: messagesWithInvalidTimestamp })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 1 })
        }

        return statement
      })

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(1)
      // Invalid date should result in NaN timestamp
      expect(isNaN(extractResponseData(result).data.items[0].createdAt)).toBe(true)
    })

    test('should handle null total count result', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockImplementation((key?: string) => {
        if (key === undefined) return {}
        return undefined
      })

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: [] })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue(null) // null result
        }

        return statement
      })

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.total).toBe(0) // Should default to 0
    })

    test('should handle messages with unknown message types', async () => {
      const messagesWithUnknownType = [
        {
          id: 'msg-1',
          conversation_id: 1,
          sender_type: 'customer',
          sender_id: 1,
          content: 'Unknown type message',
          message_type: 'unknown_type', // unknown message type
          platform_message_id: null,
          is_sent: true,
          delivery_status: 'delivered',
          created_at: '2024-01-15T10:00:00Z',
          sender_name: 'John Doe'
        }
      ]

      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.query = vi.fn().mockImplementation((key?: string) => {
        if (key === undefined) return {}
        return undefined
      })

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT m.*')) {
          statement.all.mockResolvedValue({ results: messagesWithUnknownType })
        } else if (query.includes('SELECT COUNT(*)')) {
          statement.first.mockResolvedValue({ total: 1 })
        }

        return statement
      })

      const result = await messageHandler.list(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.items).toHaveLength(1)
      expect(extractResponseData(result).data.items[0].mediaType).toBe('unknown_type')
    })
  })

  describe('send - Edge Cases', () => {
    test('should handle empty string content with media', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: '', // empty string but has media
        mediaUrl: 'https://example.com/image.jpg',
        mediaType: 'image'
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

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.content).toBe('')
      expect(extractResponseData(result).data.mediaUrl).toBe('https://example.com/image.jpg')
    })

    test('should handle whitespace-only content', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: '   \n\t   ', // whitespace only
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

      const result = await messageHandler.send(mockContext)

      // The handler doesn't trim whitespace, so whitespace-only content is considered valid
      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.content).toBe('   \n\t   ')
    })

    test('should handle null JWT payload', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Test message',
        mediaUrl: undefined,
        mediaType: undefined
      })
      mockContext.get = vi.fn().mockReturnValue(null) // null JWT payload

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

      const result = await messageHandler.send(mockContext)

      // The handler will fail when trying to access payload.userId
      expect(extractResponseData(result).success).toBe(false)
      expect(extractResponseData(result).error).toBe('Failed to send message')
      expect(result.status).toBe(500)
    })

    test('should handle conversation with null platform', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Test message',
        mediaUrl: undefined,
        mediaType: undefined
      })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const conversationWithNullPlatform = {
        ...mockConversation,
        platform: null // null platform
      }

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(conversationWithNullPlatform)
        }

        return statement
      })

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.platform).toBeNull()
    })

    test('should handle very long message content', async () => {
      const longContent = 'a'.repeat(10000) // 10k characters

      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: longContent,
        mediaUrl: undefined,
        mediaType: undefined
      })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const mockDB = mockContext.env.DB as any
      let capturedContent = ''

      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn((...params) => {
            if (query.includes('INSERT INTO messages')) {
              capturedContent = params[3] // content parameter (0: messageId, 1: conversationId, 2: userId, 3: content)
            }
            return statement
          }),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(mockConversation)
        }

        return statement
      })

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(capturedContent).toBe(longContent)
      expect(extractResponseData(result).data.content).toBe(longContent)
    })

    test('should handle special characters in content', async () => {
      const specialContent = '?? Hello! @#$%^&*()_+ 銝剜? 塈?媢堭堥?堜 ??'

      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: specialContent,
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

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.content).toBe(specialContent)
    })

    test('should handle invalid media URLs', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: '',
        mediaUrl: 'not-a-valid-url',
        mediaType: 'image'
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

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(true)
      expect(extractResponseData(result).data.mediaUrl).toBe('not-a-valid-url')
    })

    test('should handle database insert failure', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Test message',
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
          run: vi.fn()
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(mockConversation)
        } else if (query.includes('INSERT INTO messages')) {
          statement.run.mockRejectedValue(new Error('Insert failed'))
        } else {
          statement.run.mockResolvedValue({ success: true })
        }

        return statement
      })

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(false)
      expect(extractResponseData(result).error).toBe('Failed to send message')
      expect(result.status).toBe(500)
    })

    test('should handle conversation update failure', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Test message',
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
          run: vi.fn()
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(mockConversation)
        } else if (query.includes('UPDATE conversations')) {
          statement.run.mockRejectedValue(new Error('Update failed'))
        } else {
          statement.run.mockResolvedValue({ success: true })
        }

        return statement
      })

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(false)
      expect(extractResponseData(result).error).toBe('Failed to send message')
      expect(result.status).toBe(500)
    })

    test('should handle missing conversation ID parameter', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue(undefined)
      mockContext.req.json = vi.fn().mockResolvedValue({
        content: 'Test message',
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
          run: vi.fn()
        }

        if (query.includes('SELECT c.*')) {
          statement.first.mockResolvedValue(null) // No conversation found
        }

        return statement
      })

      const result = await messageHandler.send(mockContext)

      expect(extractResponseData(result).success).toBe(false)
      expect(extractResponseData(result).error).toBe('Conversation not found')
      expect(result.status).toBe(404)
    })
  })
})

