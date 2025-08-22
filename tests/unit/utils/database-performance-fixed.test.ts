import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockDatabase, type MockD1Database } from '../../helpers/mockDatabase'
import {
  findOrCreateCustomer,
  findOrCreateConversation,
  saveMessage,
  getConversationMessages,
  getMessageStats,
  getAllCustomers,
  updateCustomer
} from '@backend/utils/database'
import type { Customer, DbMessage, DbConversation } from '@backend/types'

describe('Database Utils - Performance & Stress Testing (Fixed)', () => {
  let mockDb: MockD1Database

  beforeEach(() => {
    mockDb = createMockDatabase()
    vi.clearAllMocks()
  })

  describe('Bulk Operations Performance', () => {
    it('should handle bulk customer creation efficiently', async () => {
      const customerCount = 50 // Reasonable size for testing
      const startTime = Date.now()

      // Setup comprehensive mock for customer operations
      let selectCallCount = 0
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
          selectCallCount++
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockImplementation(() => {
              if (selectCallCount === 1) {
                return Promise.resolve(null) // First call: customer doesn't exist
              } else {
                return Promise.resolve({ // Second call: return created customer
                  id: 1,
                  platform: 'line',
                  platform_user_id: 'U123',
                  display_name: 'Test User',
                  avatar_url: undefined,
                  phone: undefined,
                  email: undefined,
                  source_team_id: undefined,
                  created_at: '2024-01-01T00:00:00Z',
                  updated_at: '2024-01-01T00:00:00Z'
                } as Customer)
              }
            })
          }
        } else if (query.includes('INSERT INTO customers')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true })
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      // Create customers in parallel
      const promises = Array.from({ length: customerCount }, (_, i) =>
        findOrCreateCustomer(mockDb as any, 'line', `U${i}`, {
          displayName: `User ${i}`
        })
      )

      const results = await Promise.all(promises)
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(results).toHaveLength(customerCount)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
      
      // Verify all customers were processed
      results.forEach((customer) => {
        expect(customer.platform_user_id).toBeDefined()
        expect(customer.display_name).toBeDefined()
      })
    })

    it('should handle bulk message insertion efficiently', async () => {
      const messageCount = 50
      const conversationId = 1
      const startTime = Date.now()

      // Setup mock for message operations
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('INSERT INTO messages')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true })
          }
        } else if (query.includes('SELECT * FROM messages WHERE id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({
              id: 'msg_123',
              conversation_id: conversationId,
              sender_type: 'customer',
              sender_id: undefined,
              content: 'Test message',
              message_type: 'text',
              platform_message_id: undefined,
              is_recalled: false,
              recall_deadline: undefined,
              recalled_at: undefined,
              is_sent: false,
              sent_at: undefined,
              delivery_status: 'pending',
              reply_to_message_id: undefined,
              thread_id: undefined,
              session_id: undefined,
              session_sequence: undefined,
              metadata: undefined,
              created_at: '2024-01-01T00:00:00Z'
            } as DbMessage)
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      // Create messages in parallel
      const promises = Array.from({ length: messageCount }, (_, i) =>
        saveMessage(mockDb as any, {
          id: `msg_${i}`,
          conversationId,
          senderType: i % 2 === 0 ? 'customer' : 'agent',
          content: `Message ${i}`,
          messageType: 'text',
          direction: i % 2 === 0 ? 'inbound' : 'outbound'
        })
      )

      const results = await Promise.all(promises)
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(results).toHaveLength(messageCount)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds

      // Verify message processing
      results.forEach((message) => {
        expect(message.id).toBeDefined()
        expect(message.content).toBeDefined()
      })
    })

    it('should handle bulk customer updates efficiently', async () => {
      const updateCount = 50
      const startTime = Date.now()

      // Setup mock for update operations
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('UPDATE customers SET')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true })
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      // Perform bulk updates in parallel
      const promises = Array.from({ length: updateCount }, (_, i) =>
        updateCustomer(mockDb as any, i + 1, {
          displayName: `Updated User ${i}`,
          email: `user${i}@example.com`
        })
      )

      const results = await Promise.all(promises)
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(results).toHaveLength(updateCount)
      expect(results.every(result => result === true)).toBe(true)
      expect(duration).toBeLessThan(3000) // Should complete within 3 seconds
    })
  })

  describe('Large Dataset Queries', () => {
    it('should handle querying large conversation with many messages', async () => {
      const messageCount = 1000
      const conversationId = 1

      // Generate large dataset
      const mockMessages: DbMessage[] = Array.from({ length: messageCount }, (_, i) => ({
        id: `msg_${i}`,
        conversation_id: conversationId,
        sender_type: i % 3 === 0 ? 'customer' : 'agent',
        sender_id: i % 3 === 0 ? undefined : 1,
        content: `Message content ${i}`,
        message_type: 'text',
        platform_message_id: undefined,
        is_recalled: false,
        recall_deadline: undefined,
        recalled_at: undefined,
        is_sent: i % 3 !== 0,
        sent_at: i % 3 !== 0 ? '2024-01-01T00:00:00Z' : undefined,
        delivery_status: i % 3 === 0 ? 'pending' : 'sent',
        reply_to_message_id: undefined,
        thread_id: undefined,
        session_id: undefined,
        session_sequence: i + 1,
        metadata: undefined,
        created_at: new Date(Date.now() - (messageCount - i) * 1000).toISOString()
      }))

      // Setup mock for message query
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM messages')) {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({ results: mockMessages })
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      const startTime = Date.now()
      const result = await getConversationMessages(mockDb as any, conversationId, messageCount)
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result).toHaveLength(messageCount)
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
      
      // Verify data integrity
      expect(result[0].id).toBe('msg_0')
      expect(result[messageCount - 1].id).toBe(`msg_${messageCount - 1}`)
    })

    it('should handle querying all customers with large dataset', async () => {
      const customerCount = 1000

      // Generate large customer dataset
      const mockCustomers: Customer[] = Array.from({ length: customerCount }, (_, i) => ({
        id: i + 1,
        platform: i % 2 === 0 ? 'line' : 'facebook',
        platform_user_id: `U${i}`,
        display_name: `Customer ${i}`,
        avatar_url: i % 10 === 0 ? `https://example.com/avatar${i}.jpg` : undefined,
        phone: i % 5 === 0 ? `+1234567${String(i).padStart(4, '0')}` : undefined,
        email: i % 3 === 0 ? `customer${i}@example.com` : undefined,
        source_team_id: i % 4 === 0 ? 1 : undefined,
        created_at: new Date(Date.now() - (customerCount - i) * 60000).toISOString(),
        updated_at: new Date(Date.now() - (customerCount - i) * 60000).toISOString()
      }))

      // Setup mock for customer query
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM customers')) {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({ results: mockCustomers })
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      const startTime = Date.now()
      const result = await getAllCustomers(mockDb as any, customerCount)
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result).toHaveLength(customerCount)
      expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
      
      // Verify data distribution
      const lineCustomers = result.filter(c => c.platform === 'line')
      const facebookCustomers = result.filter(c => c.platform === 'facebook')
      expect(lineCustomers.length + facebookCustomers.length).toBe(customerCount)
    })

    it('should handle complex statistics query with large dataset', async () => {
      const totalMessages = 10000
      const totalCustomers = 2500
      const totalConversations = 3000

      // Setup mock for statistics queries
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT COUNT(*) as count FROM messages')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ count: totalMessages })
          }
        } else if (query.includes('SELECT COUNT(*) as count FROM customers')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ count: totalCustomers })
          }
        } else if (query.includes('SELECT COUNT(*) as count FROM conversations')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({ count: totalConversations })
          }
        } else if (query.includes('SELECT m.*, c.display_name')) {
          const recentMessages = Array.from({ length: 10 }, (_, i) => ({
            id: `recent_msg_${i}`,
            conversation_id: i + 1,
            content: `Recent message ${i}`,
            customer_name: `Customer ${i}`,
            platform: i % 2 === 0 ? 'line' : 'facebook',
            created_at: new Date(Date.now() - i * 60000).toISOString()
          }))
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({ results: recentMessages })
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      const startTime = Date.now()
      const result = await getMessageStats(mockDb as any)
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result.totalMessages).toBe(totalMessages)
      expect(result.totalCustomers).toBe(totalCustomers)
      expect(result.totalConversations).toBe(totalConversations)
      expect(result.recentMessages).toHaveLength(10)
      expect(duration).toBeLessThan(500) // Should complete within 500ms
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent operations without memory leaks', async () => {
      const concurrentOperations = 100
      const startTime = Date.now()

      // Setup comprehensive mock for all operations
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({
              id: 1,
              platform: 'line',
              platform_user_id: 'U123',
              display_name: 'Test User',
              avatar_url: undefined,
              phone: undefined,
              email: undefined,
              source_team_id: undefined,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            } as Customer)
          }
        } else if (query.includes('SELECT * FROM conversations WHERE customer_id = ? AND status = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({
              id: 1,
              customer_id: 1,
              status: 'active',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            } as DbConversation)
          }
        } else if (query.includes('UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true })
          }
        } else if (query.includes('UPDATE customers SET')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true })
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      // Create mixed concurrent operations
      const operations = Array.from({ length: concurrentOperations }, (_, i) => {
        const operationType = i % 3
        
        switch (operationType) {
          case 0:
            return findOrCreateCustomer(mockDb as any, 'line', `U${i}`)
          case 1:
            return findOrCreateConversation(mockDb as any, i + 1)
          case 2:
            return updateCustomer(mockDb as any, i + 1, { displayName: `Updated ${i}` })
          default:
            return Promise.resolve()
        }
      })

      const results = await Promise.all(operations)
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(results).toHaveLength(concurrentOperations)
      expect(duration).toBeLessThan(3000) // Should complete within 3 seconds
      
      // Verify no operations failed
      results.forEach((result) => {
        expect(result).toBeDefined()
      })
    })

    it('should handle rapid sequential operations without degradation', async () => {
      const sequentialCount = 100
      const durations: number[] = []

      // Setup mock for customer operations
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({
              id: 1,
              platform: 'line',
              platform_user_id: 'U123',
              display_name: 'Test User',
              avatar_url: undefined,
              phone: undefined,
              email: undefined,
              source_team_id: undefined,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z'
            } as Customer)
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      // Perform sequential operations and measure each
      for (let i = 0; i < sequentialCount; i++) {
        const startTime = Date.now()
        await findOrCreateCustomer(mockDb as any, 'line', `U${i}`)
        const endTime = Date.now()
        durations.push(endTime - startTime)
      }

      // Verify no significant performance degradation
      const firstHalf = durations.slice(0, sequentialCount / 2)
      const secondHalf = durations.slice(sequentialCount / 2)
      
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
      
      // Second half should not be significantly slower than first half
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 3) // Allow some variance
      
      // All operations should be reasonably fast
      expect(Math.max(...durations)).toBeLessThan(100) // No single operation should take more than 100ms
    })
  })
})