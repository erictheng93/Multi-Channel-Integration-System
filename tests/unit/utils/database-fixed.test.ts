import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockDatabase, type MockD1Database } from '../../helpers/mockDatabase'
import {
  findOrCreateCustomer,
  findOrCreateConversation,
  saveMessage,
  getSystemSetting,
  getConversationMessages,
  getCustomerConversations,
  getMessageStats,
  getMessageReplies,
  getMessageThread,
  getConversationMessageTree,
  getAllCustomers,
  getCustomerById,
  getCustomerByPlatformId,
  updateCustomer
} from '@backend/utils/database'
import type { Customer, DbConversation, DbMessage } from '@backend/types'

describe('Database Utils - Core Business Logic (Fixed)', () => {
  let mockDb: MockD1Database

  beforeEach(() => {
    mockDb = createMockDatabase()
    vi.clearAllMocks()
  })

  describe('findOrCreateCustomer', () => {
    const mockCustomer: Customer = {
      id: 1,
      platform: 'line',
      platform_user_id: 'U123456789',
      display_name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
      phone: undefined,
      email: undefined,
      source_team_id: undefined,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    it('should return existing customer when found', async () => {
      // Setup comprehensive mock for existing customer
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(mockCustomer)
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      const result = await findOrCreateCustomer(mockDb as any, 'line', 'U123456789')

      expect(result).toEqual(mockCustomer)
      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')
    })

    it('should create new customer when not found', async () => {
      // Setup comprehensive mock for customer creation
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
                return Promise.resolve(mockCustomer) // Second call: return created customer
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

      const result = await findOrCreateCustomer(mockDb as any, 'line', 'U123456789', {
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg'
      })

      expect(result).toEqual(mockCustomer)
    })

    it('should update existing customer with new information', async () => {
      const existingCustomer = { ...mockCustomer, display_name: 'Old Name' }
      const updatedCustomer = { ...mockCustomer, display_name: 'New Name' }

      // Setup mock for update scenario
      let selectCallCount = 0
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
          selectCallCount++
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(existingCustomer)
          }
        } else if (query.includes('UPDATE customers SET')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true })
          }
        } else if (query.includes('SELECT * FROM customers WHERE id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(updatedCustomer)
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      const result = await findOrCreateCustomer(mockDb as any, 'line', 'U123456789', {
        displayName: 'New Name'
      })

      expect(result).toEqual(updatedCustomer)
    })

    it('should throw error when customer creation fails', async () => {
      // Setup mock for failed creation
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM customers WHERE platform = ? AND platform_user_id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null) // Customer not found
          }
        } else if (query.includes('INSERT INTO customers')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: false }) // Insert fails
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
        findOrCreateCustomer(mockDb as any, 'line', 'U123456789')
      ).rejects.toThrow('Failed to create customer')
    })
  })

  describe('findOrCreateConversation', () => {
    const mockConversation: DbConversation = {
      id: 1,
      customer_id: 1,
      assigned_team_id: undefined,
      assigned_user_id: undefined,
      status: 'active',
      last_message_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    it('should return existing active conversation', async () => {
      // Setup mock for existing conversation
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM conversations WHERE customer_id = ? AND status = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(mockConversation)
          }
        } else if (query.includes('UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?')) {
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

      const result = await findOrCreateConversation(mockDb as any, 1)

      expect(result).toEqual(mockConversation)
    })

    it('should create new conversation when no active conversation exists', async () => {
      // Setup mock for conversation creation
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
            first: vi.fn().mockResolvedValue(mockConversation)
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      const result = await findOrCreateConversation(mockDb as any, 1)

      expect(result).toEqual(mockConversation)
    })
  })

  describe('saveMessage', () => {
    const mockMessage: DbMessage = {
      id: 'msg_123',
      conversation_id: 1,
      sender_type: 'customer',
      sender_id: undefined,
      content: 'Hello world',
      message_type: 'text',
      platform_message_id: 'line_msg_123',
      is_recalled: false,
      recall_deadline: undefined,
      recalled_at: undefined,
      is_sent: false,
      sent_at: undefined,
      delivery_status: 'pending',
      reply_to_message_id: undefined,
      thread_id: undefined,
      session_id: undefined,
      session_sequence: 1,
      metadata: undefined,
      created_at: '2024-01-01T00:00:00Z'
    }

    it('should save inbound message correctly', async () => {
      // Setup mock for message save
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('INSERT INTO messages')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true })
          }
        } else if (query.includes('SELECT * FROM messages WHERE id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(mockMessage)
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
        content: 'Hello world',
        messageType: 'text' as const,
        platformMessageId: 'line_msg_123',
        direction: 'inbound' as const
      }

      const result = await saveMessage(mockDb as any, messageData)

      expect(result).toEqual(mockMessage)
    })

    it('should save outbound message correctly', async () => {
      const outboundMessage = { ...mockMessage, is_sent: true, delivery_status: 'sent', sent_at: '2024-01-01T00:00:00Z' }
      
      // Setup mock for outbound message save
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('INSERT INTO messages')) {
          return {
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true })
          }
        } else if (query.includes('SELECT * FROM messages WHERE id = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(outboundMessage)
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
        senderType: 'agent' as const,
        senderId: 1,
        content: 'Hello world',
        messageType: 'text' as const,
        direction: 'outbound' as const
      }

      const result = await saveMessage(mockDb as any, messageData)

      expect(result).toEqual(outboundMessage)
    })
  })

  describe('getSystemSetting', () => {
    it('should return setting value when found', async () => {
      // Setup mock for system setting query
      const mockBind = vi.fn().mockReturnThis()
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT value FROM system_settings WHERE key = ?')) {
          return {
            bind: mockBind,
            first: vi.fn().mockResolvedValue({ value: 'test_value' })
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      const result = await getSystemSetting(mockDb as any, 'test_key')

      expect(result).toBe('test_value')
      expect(mockBind).toHaveBeenCalledWith('test_key')
    })

    it('should return null when setting not found', async () => {
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT value FROM system_settings WHERE key = ?')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null)
          }
        }
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }
      })

      const result = await getSystemSetting(mockDb as any, 'nonexistent_key')

      expect(result).toBe(null)
    })
  })

  describe('getConversationMessages', () => {
    const mockMessages: DbMessage[] = [
      {
        id: 'msg_1',
        conversation_id: 1,
        sender_type: 'customer',
        sender_id: undefined,
        content: 'Hello',
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
        session_sequence: 1,
        metadata: undefined,
        created_at: '2024-01-01T00:00:00Z'
      }
    ]

    it('should return messages for conversation', async () => {
      // Setup mock for message query
      const mockBind = vi.fn().mockReturnThis()
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM messages')) {
          return {
            bind: mockBind,
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

      const result = await getConversationMessages(mockDb as any, 1)

      expect(result).toEqual(mockMessages)
      expect(mockBind).toHaveBeenCalledWith(1, 50) // default limit
    })
  })

  describe('getAllCustomers', () => {
    const mockCustomers: Customer[] = [
      {
        id: 1,
        platform: 'line',
        platform_user_id: 'U123',
        display_name: 'Customer 1',
        avatar_url: undefined,
        phone: undefined,
        email: undefined,
        source_team_id: undefined,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ]

    it('should return all customers with default limit', async () => {
      const mockBind = vi.fn().mockReturnThis()
      mockDb.prepare = vi.fn().mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM customers')) {
          return {
            bind: mockBind,
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

      const result = await getAllCustomers(mockDb as any)

      expect(result).toEqual(mockCustomers)
      expect(mockBind).toHaveBeenCalledWith(100) // default limit
    })
  })
})