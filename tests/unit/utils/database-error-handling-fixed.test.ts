import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockDatabase, type MockD1Database } from '../../helpers/mockDatabase'
import {
  findOrCreateCustomer,
  findOrCreateConversation,
  saveMessage,
  getConversationMessages,
  getMessageStats,
  updateCustomer
} from '@backend/utils/database'

describe('Database Utils - Error Handling & Recovery (Fixed)', () => {
  let mockDb: MockD1Database

  beforeEach(() => {
    mockDb = createMockDatabase()
    vi.clearAllMocks()
  })

  describe('Database Connection Errors', () => {
    it('should handle connection timeout during customer lookup', async () => {
      // Setup mock to simulate connection timeout
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockRejectedValue(new Error('Connection timeout'))
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      await expect(
        findOrCreateCustomer(mockDb as any, 'line', 'U123')
      ).rejects.toThrow('Connection timeout')
    })

    it('should handle connection lost during insert operation', async () => {
      // Setup mock to simulate connection lost during insert
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null) // Customer not found
          }
        } else if (query.includes('INSERT INTO customers')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockRejectedValue(new Error('Connection lost'))
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      await expect(
        findOrCreateCustomer(mockDb as any, 'line', 'U123')
      ).rejects.toThrow('Connection lost')
    })

    it('should handle database unavailable error', async () => {
      // Setup mock to simulate database unavailable
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM conversations WHERE customer_id = ? AND status = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockRejectedValue(new Error('Database unavailable'))
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      await expect(
        findOrCreateConversation(mockDb as any, 1)
      ).rejects.toThrow('Database unavailable')
    })
  })

  describe('SQL Constraint Violations', () => {
    it('should handle unique constraint violation on customer creation', async () => {
      // Setup mock to simulate unique constraint violation
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null) // Customer not found initially
          }
        } else if (query.includes('INSERT INTO customers')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed: customers.platform_user_id'))
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      await expect(
        findOrCreateCustomer(mockDb as any, 'line', 'U123')
      ).rejects.toThrow('UNIQUE constraint failed')
    })

    it('should handle foreign key constraint violation on message save', async () => {
      // Setup mock to simulate foreign key constraint violation
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('INSERT INTO messages')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockRejectedValue(new Error('FOREIGN KEY constraint failed'))
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      const messageData = {
        id: 'msg_123',
        conversationId: 999, // Non-existent conversation
        senderType: 'customer' as const,
        content: 'Test message',
        messageType: 'text' as const,
        direction: 'inbound' as const
      }

      await expect(
        saveMessage(mockDb as any, messageData)
      ).rejects.toThrow('FOREIGN KEY constraint failed')
    })

    it('should handle NOT NULL constraint violation', async () => {
      // Setup mock to simulate NOT NULL constraint violation
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('INSERT INTO messages')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockRejectedValue(new Error('NOT NULL constraint failed: messages.content'))
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      const messageData = {
        id: 'msg_123',
        conversationId: 1,
        senderType: 'customer' as const,
        content: null as any, // Invalid null content
        messageType: 'text' as const,
        direction: 'inbound' as const
      }

      await expect(
        saveMessage(mockDb as any, messageData)
      ).rejects.toThrow('NOT NULL constraint failed')
    })

    it('should handle CHECK constraint violation', async () => {
      // Setup mock to simulate CHECK constraint violation
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('INSERT INTO messages')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockRejectedValue(new Error('CHECK constraint failed: messages.sender_type'))
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      const messageData = {
        id: 'msg_123',
        conversationId: 1,
        senderType: 'invalid_sender' as any, // Invalid sender type
        content: 'Test message',
        messageType: 'text' as const,
        direction: 'inbound' as const
      }

      await expect(
        saveMessage(mockDb as any, messageData)
      ).rejects.toThrow('CHECK constraint failed')
    })
  })

  describe('Data Integrity Issues', () => {
    it('should handle corrupted data during message retrieval', async () => {
      // Setup mock to simulate corrupted data
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM messages')) {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockRejectedValue(new Error('Data corruption detected'))
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      await expect(
        getConversationMessages(mockDb as any, 1)
      ).rejects.toThrow('Data corruption detected')
    })

    it('should handle malformed JSON in metadata fields', async () => {
      // Setup mock to return malformed JSON
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM messages')) {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({
              results: [{
                id: 'msg_1',
                conversation_id: 1,
                sender_type: 'customer',
                content: 'Hello',
                message_type: 'text',
                metadata: 'invalid json{', // Malformed JSON
                created_at: '2024-01-01T00:00:00Z'
              }]
            })
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      // This should not throw, but handle gracefully
      const result = await getConversationMessages(mockDb as any, 1)
      expect(result).toHaveLength(1)
      expect(result[0].metadata).toBe('invalid json{') // Raw value preserved
    })

    it('should handle missing required fields in database response', async () => {
      // Setup mock to return incomplete data
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({
              id: 1,
              platform: 'line',
              // Missing platform_user_id and other required fields
            })
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      const result = await findOrCreateCustomer(mockDb as any, 'line', 'U123')
      expect(result.id).toBe(1)
      expect(result.platform).toBe('line')
      // Should handle missing fields gracefully
    })
  })

  describe('Transaction Rollback Scenarios', () => {
    it('should handle transaction rollback during customer update', async () => {
      // Setup mock to simulate transaction rollback
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('UPDATE customers SET')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockRejectedValue(new Error('Transaction rolled back'))
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      await expect(
        updateCustomer(mockDb as any, 1, { displayName: 'New Name' })
      ).rejects.toThrow('Transaction rolled back')
    })

    it('should handle deadlock during concurrent operations', async () => {
      // Setup mock to simulate deadlock
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('INSERT INTO messages')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockRejectedValue(new Error('Database deadlock detected'))
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      const messageData = {
        id: 'msg_123',
        conversationId: 1,
        senderType: 'customer' as const,
        content: 'Test message',
        messageType: 'text' as const,
        direction: 'inbound' as const
      }

      await expect(
        saveMessage(mockDb as any, messageData)
      ).rejects.toThrow('Database deadlock detected')
    })
  })

  describe('Resource Exhaustion', () => {
    it('should handle memory exhaustion during large query', async () => {
      // Setup mock to simulate memory exhaustion
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM messages')) {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockRejectedValue(new Error('Out of memory'))
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      await expect(
        getConversationMessages(mockDb as any, 1, 10000) // Large limit
      ).rejects.toThrow('Out of memory')
    })

    it('should handle disk space exhaustion during insert', async () => {
      // Setup mock to simulate disk space exhaustion
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('INSERT INTO customers')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockRejectedValue(new Error('Disk full'))
          }
        } else if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null) // Customer not found
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      await expect(
        findOrCreateCustomer(mockDb as any, 'line', 'U123')
      ).rejects.toThrow('Disk full')
    })
  })

  describe('Network and Timeout Issues', () => {
    it('should handle query timeout', async () => {
      // Setup mock to simulate query timeout
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM messages')) {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockRejectedValue(new Error('Query timeout'))
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      await expect(
        getConversationMessages(mockDb as any, 1)
      ).rejects.toThrow('Query timeout')
    })

    it('should handle network partition during operation', async () => {
      // Setup mock to simulate network partition
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('UPDATE customers SET')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockRejectedValue(new Error('Network unreachable'))
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      await expect(
        updateCustomer(mockDb as any, 1, { displayName: 'New Name' })
      ).rejects.toThrow('Network unreachable')
    })
  })
})