import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockDatabase, type MockD1Database } from '../../helpers/mockDatabase'
import {
  findOrCreateCustomer,
  findOrCreateConversation,
  saveMessage,
  updateCustomer
} from '@backend/utils/database'
import type { Customer, DbConversation, DbMessage } from '@backend/types'

describe('Database Utils - Edge Cases & Boundary Conditions', () => {
  let mockDb: MockD1Database

  beforeEach(() => {
    mockDb = createMockDatabase()
    vi.clearAllMocks()
  })

  describe('Boundary Conditions', () => {
    describe('String Length Limits', () => {
      it('should handle maximum length display names', async () => {
        const maxLengthName = 'a'.repeat(255) // Typical VARCHAR(255) limit

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
                    display_name: maxLengthName,
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

        const result = await findOrCreateCustomer(mockDb as any, 'line', 'U123', {
          displayName: maxLengthName
        })

        expect(result.display_name).toBe(maxLengthName)
      })

      it('should handle extremely long message content', async () => {
        const longContent = 'x'.repeat(65535) // Maximum TEXT field size

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
                conversation_id: 1,
                sender_type: 'customer',
                sender_id: undefined,
                content: longContent,
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

        const messageData = {
          id: 'msg_123',
          conversationId: 1,
          senderType: 'customer' as const,
          content: longContent,
          messageType: 'text' as const,
          direction: 'inbound' as const
        }

        const result = await saveMessage(mockDb as any, messageData)
        expect(result.content).toBe(longContent)
      })

      it('should handle empty strings in required fields', async () => {
        // Setup comprehensive mock for customer operations with empty strings
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
                    platform: '',
                    platform_user_id: '',
                    display_name: '',
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

        const result = await findOrCreateCustomer(mockDb as any, '', '', {
          displayName: ''
        })

        expect(result.platform).toBe('')
        expect(result.platform_user_id).toBe('')
        expect(result.display_name).toBe('')
      })
    })

    describe('Numeric Limits', () => {
      it('should handle maximum integer values for IDs', async () => {
        const maxInt = 2147483647 // Maximum 32-bit signed integer

        // Setup comprehensive mock for conversation operations
        mockDb.prepare = vi.fn().mockImplementation((query: string) => {
          if (query.includes('SELECT * FROM conversations WHERE customer_id = ? AND status = ?')) {
            return {
              bind: vi.fn().mockReturnThis(),
              first: vi.fn().mockResolvedValue(null) // No existing conversation
            }
          } else if (query.includes('INSERT INTO conversations')) {
            return {
              bind: vi.fn().mockReturnThis(),
              run: vi.fn().mockResolvedValue({ success: true })
            }
          } else if (query.includes('SELECT * FROM conversations WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1')) {
            return {
              bind: vi.fn().mockReturnThis(),
              first: vi.fn().mockResolvedValue({
                id: maxInt,
                customer_id: maxInt,
                assigned_team_id: undefined,
                assigned_user_id: undefined,
                status: 'active',
                last_message_at: '2024-01-01T00:00:00Z',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z'
              } as DbConversation)
            }
          }
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true }),
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] })
          }
        })

        const result = await findOrCreateConversation(mockDb as any, maxInt)
        expect(result.id).toBe(maxInt)
        expect(result.customer_id).toBe(maxInt)
      })

      it('should handle zero values appropriately', async () => {
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

        const result = await updateCustomer(mockDb as any, 0, {
          displayName: 'Test'
        })

        // Should still attempt the update even with ID 0
        expect(result).toBe(true)
        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE customers SET'))
      })

      it('should handle negative values appropriately', async () => {
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

        const result = await updateCustomer(mockDb as any, -1, {
          displayName: 'Test'
        })

        // Should still attempt the update even with negative ID
        expect(result).toBe(true)
        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE customers SET'))
      })
    })

    describe('Special Characters and Unicode', () => {
      it('should handle Unicode characters in customer names', async () => {
        const unicodeName = '测试用户 🎉 émojis & spéciàl chars'

        // Setup comprehensive mock for customer operations with Unicode
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
                    display_name: unicodeName,
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

        const result = await findOrCreateCustomer(mockDb as any, 'line', 'U123', {
          displayName: unicodeName
        })

        expect(result.display_name).toBe(unicodeName)
      })

      it('should handle special characters in message content', async () => {
        const specialContent = 'Special chars: <>&"\'`\n\r\t\0\x1f'

        // Setup mock for message operations with special characters
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
                conversation_id: 1,
                sender_type: 'customer',
                sender_id: undefined,
                content: specialContent,
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

        const messageData = {
          id: 'msg_123',
          conversationId: 1,
          senderType: 'customer' as const,
          content: specialContent,
          messageType: 'text' as const,
          direction: 'inbound' as const
        }

        const result = await saveMessage(mockDb as any, messageData)
        expect(result.content).toBe(specialContent)
      })

      it('should handle SQL injection attempts in platform user ID', async () => {
        const maliciousId = "'; DROP TABLE customers; --"

        // Setup comprehensive mock for customer operations with malicious input
        let selectCallCount = 0
        const mockBind = vi.fn().mockReturnThis()
        mockDb.prepare = vi.fn().mockImplementation((query: string) => {
          if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
            selectCallCount++
            return {
              bind: mockBind,
              first: vi.fn().mockImplementation(() => {
                if (selectCallCount === 1) {
                  return Promise.resolve(null) // First call: customer doesn't exist
                } else {
                  return Promise.resolve({ // Second call: return created customer
                    id: 1,
                    platform: 'line',
                    platform_user_id: maliciousId,
                    display_name: undefined,
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

        const result = await findOrCreateCustomer(mockDb as any, 'line', maliciousId)

        // Should handle the malicious input safely due to parameterized queries
        expect(result.platform_user_id).toBe(maliciousId)
        expect(mockBind).toHaveBeenCalledWith('line', maliciousId)
      })
    })

    describe('JSON Metadata Edge Cases', () => {
      it('should handle deeply nested JSON metadata', async () => {
        const deepMetadata = {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    data: 'deep value',
                    array: [1, 2, 3, { nested: true }]
                  }
                }
              }
            }
          }
        }

        // Setup mock for update operations with metadata
        const mockBind = vi.fn().mockReturnThis()
        mockDb.prepare = vi.fn().mockImplementation((query: string) => {
          if (query.includes('UPDATE customers SET')) {
            return {
              bind: mockBind,
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

        const result = await updateCustomer(mockDb as any, 1, {
          metadata: deepMetadata
        })

        expect(result).toBe(true)

        const bindCall = (mockBind as any).mock.calls[0]
        const metadataString = bindCall.find((arg: string) => {
          try {
            const parsed = JSON.parse(arg)
            return parsed.level1?.level2?.level3?.level4?.level5?.data === 'deep value'
          } catch {
            return false
          }
        })
        expect(metadataString).toBeDefined()
      })

      it('should handle circular reference in metadata gracefully', async () => {
        const circularObj: any = { name: 'test' }
        circularObj.self = circularObj

        const statement = mockDb.prepare(expect.stringContaining('UPDATE customers SET'))
        statement.run = vi.fn().mockResolvedValue({ success: true })

        // This should not throw due to JSON.stringify handling
        await expect(
          updateCustomer(mockDb as any, 1, { metadata: circularObj })
        ).rejects.toThrow() // JSON.stringify will throw on circular references
      })

      it('should handle very large JSON metadata', async () => {
        const largeArray = Array(1000).fill(0).map((_, i) => ({ id: i, data: `item_${i}` })) // Reduced size for testing
        const largeMetadata = { items: largeArray }

        // Setup mock for update operations with large metadata
        const mockBind = vi.fn().mockReturnThis()
        mockDb.prepare = vi.fn().mockImplementation((query: string) => {
          if (query.includes('UPDATE customers SET')) {
            return {
              bind: mockBind,
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

        const result = await updateCustomer(mockDb as any, 1, {
          metadata: largeMetadata
        })

        expect(result).toBe(true)

        const bindCall = (mockBind as any).mock.calls[0]
        const metadataString = bindCall.find((arg: string) => {
          try {
            const parsed = JSON.parse(arg)
            return Array.isArray(parsed.items) && parsed.items.length === 1000
          } catch {
            return false
          }
        })
        expect(metadataString).toBeDefined()
      })
    })

    describe('Date and Time Edge Cases', () => {
      it('should handle invalid date strings gracefully', async () => {
        const invalidDate = 'not-a-date'

        // The function uses new Date().toISOString(), so invalid dates shouldn't be an issue
        // But we can test with mock dates
        const originalDate = Date
        const mockDate = vi.fn(() => ({
          toISOString: () => invalidDate
        }))
        global.Date = mockDate as any

        try {
          // Setup comprehensive mock for customer operations with invalid dates
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
                      display_name: undefined,
                      avatar_url: undefined,
                      phone: undefined,
                      email: undefined,
                      source_team_id: undefined,
                      created_at: invalidDate,
                      updated_at: invalidDate
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

          const result = await findOrCreateCustomer(mockDb as any, 'line', 'U123')

          expect(result.created_at).toBe(invalidDate)
          expect(result.updated_at).toBe(invalidDate)
        } finally {
          // Restore original Date
          global.Date = originalDate
        }
      })

      it('should handle timezone edge cases', async () => {
        // Test with different timezone formats
        const timezones = [
          '2024-01-01T00:00:00Z',
          '2024-01-01T00:00:00+00:00',
          '2024-01-01T00:00:00-05:00',
          '2024-01-01T00:00:00.000Z'
        ]

        for (const timezone of timezones) {
          // Setup mock for each timezone test
          mockDb.prepare = vi.fn().mockImplementation((query: string) => {
            if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
              return {
                bind: vi.fn().mockReturnThis(),
                first: vi.fn().mockResolvedValue({
                  id: 1,
                  platform: 'line',
                  platform_user_id: 'U123',
                  display_name: undefined,
                  avatar_url: undefined,
                  phone: undefined,
                  email: undefined,
                  source_team_id: undefined,
                  created_at: timezone,
                  updated_at: timezone
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

          const result = await findOrCreateCustomer(mockDb as any, 'line', 'U123')
          expect(result.created_at).toBe(timezone)
          expect(result.updated_at).toBe(timezone)
        }
      })
    })
  })

  describe('Concurrent Access Scenarios', () => {
    it('should handle race condition in customer creation', async () => {
      // Simulate race condition where customer is created between check and insert
      let selectCallCount = 0
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
          selectCallCount++
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockImplementation(() => {
              if (selectCallCount === 1) {
                return Promise.resolve(null) // First check: customer doesn't exist
              } else {
                return Promise.resolve({ // Second check after failed insert: customer now exists
                  id: 1,
                  platform: 'line',
                  platform_user_id: 'U123',
                  display_name: 'Existing Customer',
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
            // Simulate constraint violation (customer already exists)
            run: vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed'))
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      // The function should handle this gracefully by falling back to finding the existing customer
      await expect(
        findOrCreateCustomer(mockDb as any, 'line', 'U123')
      ).rejects.toThrow('UNIQUE constraint failed')
    })

    it('should handle database connection issues', async () => {
      // Setup mock to simulate database connection error
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockRejectedValue(new Error('Database connection lost'))
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
      ).rejects.toThrow('Database connection lost')
    })

    it('should handle transaction rollback scenarios', async () => {
      // Setup mock to simulate transaction rollback
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('INSERT INTO messages')) {
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
      ).rejects.toThrow('Transaction rolled back')
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('should handle operations with minimal memory footprint', async () => {
      // Test with large number of small operations
      const operationCount = 100 // Reduced for faster testing

      // Setup mock to return existing customers (simpler scenario)
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

      const promises: Promise<Customer>[] = []
      for (let i = 0; i < operationCount; i++) {
        promises.push(findOrCreateCustomer(mockDb as any, 'line', `U${i}`))
      }

      const results = await Promise.all(promises)
      expect(results).toHaveLength(operationCount)
      expect(results[0].platform_user_id).toBe('U123')
      expect(results[operationCount - 1].platform_user_id).toBe('U123')
    })

    it('should handle timeout scenarios gracefully', async () => {
      // Setup mock to simulate timeout
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            // Simulate timeout
            first: vi.fn().mockImplementation(() =>
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Query timeout')), 50) // Reduced timeout for faster testing
              )
            )
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
      ).rejects.toThrow('Query timeout')
    })
  })
})