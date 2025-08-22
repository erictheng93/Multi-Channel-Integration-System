// tests/unit/handlers/conversation.test.ts
// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/unit/handlers/conversation.test.ts
// Created by: Test Developer

import { describe, it, expect, vi } from 'vitest'
import { conversationHandler } from '@backend/handlers/conversation'
import {
  createMockContext,
  createMockJWTPayload,
  createMockAdminJWTPayload,
  createMockConversation,
  extractResponseData
} from '../../helpers/testUtils'

describe('conversationHandler', () => {
  describe('list', () => {
    it('should return conversations list with default pagination', async () => {
      const mockJWTPayload = createMockJWTPayload()
      const mockConversation = createMockConversation()
      const mockContext = createMockContext()

      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)
      mockContext.req.query = vi.fn().mockReturnValue({})

      // Mock database responses
      const mockDB = mockContext.env.DB as any

      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT DISTINCT c.*')) {
          statement.all.mockResolvedValue({ results: [mockConversation] })
        } else if (query.includes('SELECT COUNT(DISTINCT c.id)')) {
          statement.first.mockResolvedValue({ total: 1 })
        } else if (query.includes('SELECT conversation_id, COUNT(*)')) {
          statement.all.mockResolvedValue({ results: [{ conversation_id: 1, unread_count: 2 }] })
        }

        return statement
      })

      const result = await conversationHandler.list(mockContext)
      const responseData = extractResponseData(result)

      expect(responseData.success).toBe(true)
      expect(responseData.data.items).toHaveLength(1)
      expect(responseData.data.items[0]).toMatchObject({
        id: '1',
        userId: '1',
        status: 'open',
        unreadCount: 2
      })
      expect(responseData.data.total).toBe(1)
      expect(responseData.data.page).toBe(1)
      expect(responseData.data.pageSize).toBe(20)
    })

    it('should handle custom pagination parameters', async () => {
      const mockJWTPayload = createMockJWTPayload()
      const mockContext = createMockContext()

      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)
      mockContext.req.query = vi.fn().mockReturnValue({
        page: '2',
        pageSize: '10'
      })

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation((query: string) => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT DISTINCT c.*')) {
          statement.all.mockResolvedValue({ results: [] })
        } else if (query.includes('SELECT COUNT(DISTINCT c.id)')) {
          statement.first.mockResolvedValue({ total: 25 })
        }

        return statement
      })

      const result = await conversationHandler.list(mockContext)
      const responseData = extractResponseData(result)

      expect(responseData.success).toBe(true)
      expect(responseData.data.page).toBe(2)
      expect(responseData.data.pageSize).toBe(10)
      expect(responseData.data.total).toBe(25)
    })

    it('should filter by status when provided', async () => {
      const mockJWTPayload = createMockJWTPayload()
      const mockContext = createMockContext()

      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)
      mockContext.req.query = vi.fn().mockReturnValue({
        status: 'closed'
      })

      const mockDB = mockContext.env.DB as any
      let capturedQuery = ''

      mockDB.prepare.mockImplementation((query: string) => {
        capturedQuery = query
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT DISTINCT c.*')) {
          statement.all.mockResolvedValue({ results: [] })
        } else if (query.includes('SELECT COUNT(DISTINCT c.id)')) {
          statement.first.mockResolvedValue({ total: 0 })
        }

        return statement
      })

      await conversationHandler.list(mockContext)

      expect(capturedQuery).toContain('c.status = ?')
    })

    it('should allow admin to see all conversations', async () => {
      const mockAdminJWTPayload = createMockAdminJWTPayload()
      const mockContext = createMockContext()

      mockContext.get = vi.fn().mockReturnValue(mockAdminJWTPayload)
      mockContext.req.query = vi.fn().mockReturnValue({})

      const mockDB = mockContext.env.DB as any
      let capturedQuery = ''

      mockDB.prepare.mockImplementation((query: string) => {
        capturedQuery = query
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn()
        }

        if (query.includes('SELECT DISTINCT c.*')) {
          statement.all.mockResolvedValue({ results: [] })
        } else if (query.includes('SELECT COUNT(DISTINCT c.id)')) {
          statement.first.mockResolvedValue({ total: 0 })
        }

        return statement
      })

      await conversationHandler.list(mockContext)

      // Admin should not have permission restrictions
      expect(capturedQuery).not.toContain('assigned_user_id = ?')
    })

    it('should handle database errors gracefully', async () => {
      const mockJWTPayload = createMockJWTPayload()
      const mockContext = createMockContext()

      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)
      mockContext.req.query = vi.fn().mockReturnValue({})

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const result = await conversationHandler.list(mockContext)
      const responseData = extractResponseData(result)

      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Failed to get conversations')
      expect(result.status).toBe(500)
    })
  })

  describe('get', () => {
    it('should return a single conversation', async () => {
      const mockConversation = createMockConversation()
      const mockContext = createMockContext()

      mockContext.req.param = vi.fn().mockReturnValue('1')

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
        } else if (query.includes('SELECT COUNT(DISTINCT c.id)')) {
          statement.first.mockResolvedValue({ unread_count: 3 })
        }

        return statement
      })

      const result = await conversationHandler.get(mockContext)
      const responseData = extractResponseData(result)

      expect(responseData.success).toBe(true)
      expect(responseData.data).toMatchObject({
        id: '1',
        userId: '1',
        status: 'open',
        unreadCount: 3
      })
      expect(responseData.data.user).toMatchObject({
        id: '1',
        name: 'Test User',
        platform: 'line',
        platformUserId: 'U123456789'
      })
      expect(responseData.data.assignedAgent).toMatchObject({
        id: '2',
        name: 'Agent Smith',
        email: 'agent@example.com'
      })
    })

    it('should return 404 when conversation not found', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('999')

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation(() => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn()
        }
        return statement
      })

      const result = await conversationHandler.get(mockContext)
      const responseData = extractResponseData(result)

      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Conversation not found')
      expect(result.status).toBe(404)
    })

    it('should handle database errors gracefully', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation(() => {
        throw new Error('Database error')
      })

      const result = await conversationHandler.get(mockContext)
      const responseData = extractResponseData(result)

      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Failed to get conversation')
      expect(result.status).toBe(500)
    })
  })

  describe('assign', () => {
    it('should assign conversation to specified agent', async () => {
      const mockJWTPayload = createMockJWTPayload()
      const mockContext = createMockContext()

      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({ agentId: '3' })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation(() => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }
        return statement
      })

      const result = await conversationHandler.assign(mockContext)
      const responseData = extractResponseData(result)

      expect(responseData.success).toBe(true)
      expect(responseData.message).toBe('Conversation assigned successfully')
    })

    it('should assign conversation to current user when no agentId provided', async () => {
      const mockJWTPayload = createMockJWTPayload()
      const mockContext = createMockContext()

      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({})
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

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
          run: vi.fn().mockResolvedValue({ success: true })
        }
        return statement
      })

      const result = await conversationHandler.assign(mockContext)
      const responseData = extractResponseData(result)

      expect(responseData.success).toBe(true)
      expect(capturedParams[0]).toBe(mockJWTPayload.userId) // Should use current user's ID
    })

    it('should return 400 when no agent ID available', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({})
      mockContext.get = vi.fn().mockReturnValue(null) // No JWT payload

      const result = await conversationHandler.assign(mockContext)
      const responseData = extractResponseData(result)

      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Agent ID is required')
      expect(result.status).toBe(400)
    })

    it('should handle database errors gracefully', async () => {
      const mockJWTPayload = createMockJWTPayload()
      const mockContext = createMockContext()

      mockContext.req.param = vi.fn().mockReturnValue('1')
      mockContext.req.json = vi.fn().mockResolvedValue({ agentId: '3' })
      mockContext.get = vi.fn().mockReturnValue(mockJWTPayload)

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation(() => {
        throw new Error('Database error')
      })

      const result = await conversationHandler.assign(mockContext)
      const responseData = extractResponseData(result)

      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Failed to assign conversation')
      expect(result.status).toBe(500)
    })
  })

  describe('close', () => {
    it('should close conversation successfully', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation(() => {
        const statement = {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }
        return statement
      })

      const result = await conversationHandler.close(mockContext)
      const responseData = extractResponseData(result)

      expect(responseData.success).toBe(true)
      expect(responseData.message).toBe('Conversation closed successfully')
    })

    it('should handle database errors gracefully', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')

      const mockDB = mockContext.env.DB as any
      mockDB.prepare.mockImplementation(() => {
        throw new Error('Database error')
      })

      const result = await conversationHandler.close(mockContext)
      const responseData = extractResponseData(result)

      expect(responseData.success).toBe(false)
      expect(responseData.error).toBe('Failed to close conversation')
      expect(result.status).toBe(500)
    })

    it('should update conversation status to closed', async () => {
      const mockContext = createMockContext()
      mockContext.req.param = vi.fn().mockReturnValue('1')

      const mockDB = mockContext.env.DB as any
      let capturedQuery = ''
      let capturedParams: any[] = []

      mockDB.prepare.mockImplementation((query: string) => {
        capturedQuery = query
        const statement = {
          bind: vi.fn((...params) => {
            capturedParams = params
            return statement
          }),
          all: vi.fn(),
          first: vi.fn(),
          run: vi.fn().mockResolvedValue({ success: true })
        }
        return statement
      })

      await conversationHandler.close(mockContext)

      expect(capturedQuery).toContain("SET status = 'closed'")
      expect(capturedParams[0]).toBe('1') // conversation ID
    })
  })
})
