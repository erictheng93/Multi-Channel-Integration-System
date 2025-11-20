// 撤回功能整合測試 - REFACTORED with DatabaseTestEnvironment
// Tests message recall functionality with real database operations

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseTestEnvironment } from '../helpers/DatabaseTestEnvironment';
import { MessageRecallService } from '@/services/message-recall-service';
import type { Bindings } from '@/types';
import { webcrypto } from 'node:crypto';

import { MockFactory } from '@helpers/mockFactory';
// Module-level variable for test environment
let currentTestEnv: DatabaseTestEnvironment | null = null

// Mock drizzle-orm/d1 to use our test database
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => {
    if (!currentTestEnv) {
      throw new Error('DatabaseTestEnvironment not initialized')
    }
    return currentTestEnv.getDrizzleInstance()
  })
}))

// 設置全局 crypto
if (!global.crypto) {
  global.crypto = {
    ...webcrypto,
    randomUUID: () => `test-uuid-${Date.now()}`
  } as any;
}

/**
 * REFACTORED VERSION - Benefits:
 *
 * ✅ Real database operations with SQLite in-memory
 * ✅ Actual foreign key constraint validation
 * ✅ Real SQL transaction behavior
 * ✅ No complex Drizzle mock setup
 * ✅ Catches schema and data integrity issues
 * ✅ Simplified test setup with real data
 *
 * BEFORE: 564 lines with complex mock Drizzle
 * AFTER: Simplified with real database + minimal mocks for external services
 */

describe('Message Recall Integration Tests - Refactored', () => {
  let env: DatabaseTestEnvironment
  let recallService: MessageRecallService
  let mockBindings: Bindings
  let testTeam: any
  let testAgent: any
  let testCustomer: any
  let testConversation: any

  beforeEach(async () => {
    // Initialize test database
    env = new DatabaseTestEnvironment()
    currentTestEnv = env

    // Setup mock KV storage
    const kvStorage = new Map<string, { value: string; options?: any; timestamp: number }>()

    const mockKV = {
      put: vi.fn().mockImplementation(async (key: string, value: string, options?: any) => {
        kvStorage.set(key, { value, options, timestamp: Date.now() })
      }),
      get: vi.fn().mockImplementation(async (key: string) => {
        const item = kvStorage.get(key)
        if (!item) return null

        // Check TTL
        if (item.options?.expirationTtl) {
          const expireTime = item.timestamp + (item.options.expirationTtl * 1000)
          if (Date.now() > expireTime) {
            kvStorage.delete(key)
            return null
          }
        }

        return item.value
      }),
      delete: vi.fn().mockImplementation(async (key: string) => {
        kvStorage.delete(key)
      })
    }

    // Setup bindings
    mockBindings = {
      DB: env.getMockD1Database() as any,
      SESSIONS: mockKV as any,
      LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
      FB_PAGE_ACCESS_TOKEN: 'test-fb-token'
    } as any

    recallService = new MessageRecallService(mockBindings)

    // Create test data
    testTeam = await env.createTestTeam({ name: 'Test Team' })
    testAgent = await env.createTestAgent({
      id: 'agent-recall-123',
      email: 'recall-agent@test.com',
      displayName: 'Recall Agent',
      role: 'agent',
      teamId: testTeam.id
    })
    testCustomer = await env.createTestCustomer({
      platform: 'line',
      platformUserId: 'line_user_recall_123',
      displayName: 'Test Recall Customer'
    })
    testConversation = await env.createTestConversation(testCustomer.id, {
      assignedUserId: testAgent.id,
      assignedTeamId: testTeam.id
    })

    vi.clearAllMocks()
  })

  afterEach(() => {
    env.close()
    currentTestEnv = null
  })

  describe('End-to-End Recall Flow', () => {
    test('should complete full recall workflow', async () => {
      const request = {
        conversationId: testConversation.id, // String UUID
        content: 'Integration test message',
        delaySeconds: 60,
        senderId: testAgent.id, // String agent ID
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      }

      // 1. 發送延遲訊息
      const sendResult = await recallService.sendDelayedMessage(request)
      expect(sendResult.success).toBe(true)
      expect(sendResult.messageId).toBeDefined()

      const messageId = sendResult.messageId!

      // 2. 驗證 KV 中存在撤回標記
      const recallableKey = `recallable:${messageId}`
      const kvData = await mockBindings.SESSIONS.get(recallableKey)
      expect(kvData).toBeTruthy()

      const recallInfo = JSON.parse(kvData)
      expect(recallInfo.recallable).toBe(true)
      expect(recallInfo.senderId).toBe(testAgent.id)

      // 3. 驗證可以撤回
      const canRecall = await recallService.canRecallMessage(messageId, testAgent.id)
      expect(canRecall).toBe(true)

      // 4. 執行撤回
      const recallResult = await recallService.recallMessage(messageId, testAgent.id)
      expect(recallResult.success).toBe(true)

      // 5. 驗證撤回後狀態
      const cancelledKey = `cancelled:${messageId}`
      const cancelledData = await mockBindings.SESSIONS.get(cancelledKey)
      expect(cancelledData).toBeTruthy()

      const cancelInfo = JSON.parse(cancelledData)
      expect(cancelInfo.cancelled).toBe(true)
      expect(cancelInfo.cancelledBy).toBe(testAgent.id)

      // 6. Verify message exists in delayedMessages table
      const delayedMsgs = await env.db.query.delayedMessages.findMany({
        where: (delayedMessages, { eq }) => eq(delayedMessages.id, messageId)
      })
      expect(delayedMsgs.length).toBeGreaterThan(0)
    })

    test('should handle queue processing after recall', async () => {
      const request = {
        conversationId: testConversation.id, // String UUID
        content: 'Queue test message',
        delaySeconds: 30,
        senderId: testAgent.id, // String agent ID
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      }

      // 1. 發送延遲訊息
      const sendResult = await recallService.sendDelayedMessage(request)
      const messageId = sendResult.messageId!

      // 2. 撤回訊息
      await recallService.recallMessage(messageId, testAgent.id)

      // 3. 模擬佇列處理
      const processResult = await recallService.processQueueMessage(messageId)

      // 4. 驗證被跳過
      expect(processResult.success).toBe(true)
      expect(processResult.skipped).toBe(true)
    })

    test('should handle concurrent recall attempts', async () => {
      const request = {
        conversationId: testConversation.id, // String UUID
        content: 'Concurrent test message',
        delaySeconds: 60,
        senderId: testAgent.id, // String agent ID
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      }

      // 1. 發送延遲訊息
      const sendResult = await recallService.sendDelayedMessage(request)
      const messageId = sendResult.messageId!

      // 2. 同時發起多個撤回請求
      const recallPromises = Array(5).fill(null).map(() =>
        recallService.recallMessage(messageId, testAgent.id)
      )

      const results = await Promise.all(recallPromises)

      // 3. All requests should succeed (fast KV marking)
      results.forEach(result => {
        expect(result.success).toBe(true)
      })

      // 4. 驗證只有一個取消標記
      const cancelledKey = `cancelled:${messageId}`
      const cancelledData = await mockBindings.SESSIONS.get(cancelledKey)
      expect(cancelledData).toBeTruthy()
    })
  })

  describe('Database Integration', () => {
    test('should handle database foreign key constraints', async () => {
      // Try to create message with invalid conversation ID
      const invalidRequest = {
        conversationId: 'nonexistent-conversation-uuid', // Non-existent UUID
        content: 'Invalid conversation test',
        delaySeconds: 30,
        senderId: testAgent.id, // Valid agent ID
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      }

      const result = await recallService.sendDelayedMessage(invalidRequest)
      // Service returns {success: false} instead of throwing
      expect(result.success).toBe(false)
    })
  })

  describe('KV Storage Integration', () => {
    test('should handle KV TTL expiration correctly', async () => {
      const messageId = 'ttl-test-message'
      const userId = testAgent.id // String agent ID

      // 1. 手動設置一個即將過期的 KV 項目
      const shortTtl = 1 // 1 second
      await mockBindings.SESSIONS.put(
        `recallable:${messageId}`,
        JSON.stringify({
          recallable: true,
          expiresAt: new Date(Date.now() + 500).toISOString(),
          senderId: userId
        }),
        { expirationTtl: shortTtl }
      )

      // 2. 立即檢查應該存在
      let canRecall = await recallService.canRecallMessage(messageId, userId)
      expect(canRecall).toBe(true)

      // 3. 等待過期
      await new Promise(resolve => setTimeout(resolve, 1100))

      // 4. 檢查應該已過期
      canRecall = await recallService.canRecallMessage(messageId, userId)
      expect(canRecall).toBe(false)
    })

    test('should cleanup KV markers after processing', async () => {
      const request = {
        conversationId: testConversation.id, // String UUID
        content: 'Cleanup test message',
        delaySeconds: 30,
        senderId: testAgent.id, // String agent ID
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      }

      // Mock successful platform send
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true })
      })

      // 1. 發送延遲訊息
      const sendResult = await recallService.sendDelayedMessage(request)
      const messageId = sendResult.messageId!

      // 2. 驗證 KV 標記存在
      const recallableKey = `recallable:${messageId}`
      let kvData = await mockBindings.SESSIONS.get(recallableKey)
      expect(kvData).toBeTruthy()

      // 3. 處理佇列訊息（模擬發送成功）
      await recallService.processQueueMessage(messageId)

      // 4. 驗證 KV 標記被清理
      kvData = await mockBindings.SESSIONS.get(recallableKey)
      expect(kvData).toBeNull()

      // 5. 驗證取消標記也被清理
      const cancelledKey = `cancelled:${messageId}`
      const cancelledData = await mockBindings.SESSIONS.get(cancelledKey)
      expect(cancelledData).toBeNull()
    })
  })

  describe('Platform Integration', () => {
    test('should handle platform API rate limiting', async () => {
      // Mock 429 Too Many Requests
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      })

      const request = {
        conversationId: testConversation.id, // String UUID
        content: 'Rate limit test',
        delaySeconds: 30,
        senderId: testAgent.id, // String agent ID
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      }

      const sendResult = await recallService.sendDelayedMessage(request)
      const messageId = sendResult.messageId!

      const result = await recallService.processQueueMessage(messageId)

      expect(result.success).toBe(false)

      // Verify message status was updated in delayedMessages table
      const delayedMsgs = await env.db.query.delayedMessages.findMany({
        where: (delayedMessages, { eq }) => eq(delayedMessages.id, messageId)
      })
      expect(delayedMsgs[0].status).toBe('failed')
    })
  })

  describe('Error Recovery and Resilience', () => {
    test('should recover from partial failures', async () => {
      const request = {
        conversationId: testConversation.id, // String UUID
        content: 'Recovery test message',
        delaySeconds: 30,
        senderId: testAgent.id, // String agent ID
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      }

      // Mock D1 success but KV failure
      let kvCallCount = 0
      mockBindings.SESSIONS.put = vi.fn().mockImplementation(async () => {
        kvCallCount++
        if (kvCallCount === 1) {
          throw new Error('KV service temporarily unavailable')
        }
        return Promise.resolve()
      })

      // First call should fail
      const firstResult = await recallService.sendDelayedMessage(request)
      expect(firstResult.success).toBe(false)

      // Second call should succeed
      const secondResult = await recallService.sendDelayedMessage(request)
      expect(secondResult.success).toBe(true)
    })

    test('should handle network interruptions gracefully', async () => {
      // Mock network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const request = {
        conversationId: testConversation.id, // String UUID
        content: 'Network test',
        delaySeconds: 30,
        senderId: testAgent.id, // String agent ID
        recipientPlatformId: 'line_user_123',
        platform: 'line' as const
      }

      const sendResult = await recallService.sendDelayedMessage(request)
      const messageId = sendResult.messageId!

      const result = await recallService.processQueueMessage(messageId)

      expect(result.success).toBe(false)

      // Verify error is recorded in delayedMessages table
      const delayedMsgs = await env.db.query.delayedMessages.findMany({
        where: (delayedMessages, { eq }) => eq(delayedMessages.id, messageId)
      })
      expect(delayedMsgs[0].status).toBe('failed')
    })
  })
})
