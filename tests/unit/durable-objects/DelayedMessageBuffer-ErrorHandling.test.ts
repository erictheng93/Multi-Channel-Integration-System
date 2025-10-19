/**
 * DelayedMessageBuffer 錯誤處理增強測試
 * Phase 1 功能測試：
 * - 批次失敗處理
 * - 指數退避重試機制
 * - Dead Letter Queue
 * - 冪等性檢查
 * - 事務處理
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  setupDOTestEnvironment,
  cleanupDOTestEnvironment,
  createMockBindings,
  MockDurableObjectState
} from '../../helpers/durable-objects-test-helper';

describe('DelayedMessageBuffer - Error Handling (Phase 1)', () => {
  let testEnv: ReturnType<typeof setupDOTestEnvironment>;
  let mockState: MockDurableObjectState;
  let mockBindings: ReturnType<typeof createMockBindings>;
  let DelayedMessageBuffer: any;
  let mockDB: any;

  beforeEach(async () => {
    // 設置測試環境
    testEnv = setupDOTestEnvironment();
    mockState = testEnv.createState();
    mockDB = testEnv.mockDB;

    // 創建 bindings
    mockBindings = createMockBindings({
      DB: mockDB
    });

    // 設置 fetch mock
    testEnv.fetch.mockResolvedValue(new Response(null, { status: 200 }));

    // 動態導入 DelayedMessageBuffer
    const module = await import('../../../src/durable-objects/DelayedMessageBuffer');
    DelayedMessageBuffer = module.DelayedMessageBuffer;
  });

  afterEach(() => {
    cleanupDOTestEnvironment();
  });

  describe('🔧 Retry Mechanism', () => {
    it('should retry failed messages with exponential backoff', async () => {
      const buffer = new DelayedMessageBuffer(mockState as any, mockBindings);

      // Mock LINE API to fail first 2 times, succeed on 3rd
      let attemptCount = 0;
      testEnv.fetch.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.resolve(new Response(null, { status: 503 }));
        }
        return Promise.resolve(new Response(null, { status: 200 }));
      });

      const scheduleResponse = await buffer.fetch(testEnv.createRequest('https://do/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-retry-test',
          conversationId: 'conv-123',
          agentId: 'agent-1',
          content: 'Test retry message',
          platform: 'line',
          recipientPlatformId: 'user-123',
          delaySeconds: 1
        })
      }));

      const scheduleResult = await scheduleResponse.json();
      expect(scheduleResult.success).toBe(true);

      // Wait for alarm to trigger
      await testEnv.wait(1100);

      // Trigger alarm manually
      await buffer.alarm();

      // Should have attempted 3 times
      expect(attemptCount).toBe(3);
    }, 10000); // 增加超時時間

    it('should add message to DLQ after max retries', async () => {
      const buffer = new DelayedMessageBuffer(mockState as any, mockBindings);

      // Mock LINE API to always fail
      testEnv.fetch.mockResolvedValue(new Response(null, { status: 503 }));

      await buffer.fetch(testEnv.createRequest('https://do/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg-dlq-test',
          conversationId: 'conv-123',
          agentId: 'agent-1',
          content: 'Test DLQ message',
          platform: 'line',
          recipientPlatformId: 'user-123',
          delaySeconds: 1
        })
      }));

      // Wait and trigger alarm multiple times for retries
      await testEnv.wait(1100);
      await buffer.alarm();

      // Query DLQ
      const dlqResponse = await buffer.fetch(testEnv.createRequest('https://do/dlq'));
      const dlqResult = await dlqResponse.json();

      expect(dlqResult.success).toBe(true);
      expect(dlqResult.count).toBeGreaterThan(0);
      expect(dlqResult.messages[0].id).toBe('msg-dlq-test');
      expect(dlqResult.messages[0].failureReason).toBeDefined();
    }, 10000); // 增加超時時間
  });

  describe('🔧 Idempotency Check', () => {
    it('should not send duplicate messages', async () => {
      // Mock database to return existing message
      mockDB.limit.mockResolvedValue([{ id: 'msg-dup-test' }]);

      const buffer = new DelayedMessageBuffer(mockState as any, mockBindings);

      testEnv.fetch.mockResolvedValue(new Response(null, { status: 200 }));

      await buffer.fetch(testEnv.createRequest('https://do/schedule', {
        method: 'POST',
        body: JSON.stringify({
          messageId: 'msg-dup-test',
          conversationId: 'conv-123',
          agentId: 'agent-1',
          content: 'Duplicate test',
          platform: 'line',
          recipientPlatformId: 'user-123',
          delaySeconds: 1
        })
      }));

      await testEnv.wait(1100);
      await buffer.alarm();

      // Verify fetch was not called for LINE API (message was skipped)
      const lineAPICalls = testEnv.fetch.mock.calls.filter((call: any) =>
        call[0]?.includes('api.line.me')
      );

      expect(lineAPICalls.length).toBe(0);
    });
  });

  describe('🔧 Batch Failure Handling', () => {
    it('should track success and failure counts in batch sends', async () => {
      const buffer = new DelayedMessageBuffer(mockState as any, mockBindings);
      const consoleSpy = vi.spyOn(console, 'log');

      // Schedule 3 messages
      for (let i = 1; i <= 3; i++) {
        await buffer.fetch(testEnv.createRequest('https://do/schedule', {
          method: 'POST',
          body: JSON.stringify({
            messageId: `msg-batch-${i}`,
            conversationId: 'conv-123',
            agentId: 'agent-1',
            content: `Batch message ${i}`,
            platform: 'line',
            recipientPlatformId: 'user-123',
            delaySeconds: 1
          })
        }));
      }

      // Mock fetch: msg-1 success, msg-2 fail, msg-3 success
      testEnv.fetch.mockImplementation((url: string) => {
        if (url.includes('msg-batch-2')) {
          return Promise.resolve(new Response(null, { status: 503 }));
        }
        return Promise.resolve(new Response(null, { status: 200 }));
      });

      await testEnv.wait(1100);
      await buffer.alarm();

      // Check console logs for batch statistics
      const batchLog = consoleSpy.mock.calls.find(call =>
        call[0] && typeof call[0] === 'string' && call[0].includes('Batch send complete')
      );

      expect(batchLog).toBeDefined();
    }, 10000); // 增加超時時間
  });

  describe('🔧 Transaction Handling', () => {
    it('should use db.batch for atomic operations', async () => {
      const batchSpy = vi.fn().mockResolvedValue([]);
      mockDB.batch = batchSpy;

      const buffer = new DelayedMessageBuffer(mockState as any, mockBindings);

      testEnv.fetch.mockResolvedValue(new Response(null, { status: 200 }));

      await buffer.fetch(testEnv.createRequest('https://do/schedule', {
        method: 'POST',
        body: JSON.stringify({
          messageId: 'msg-tx-test',
          conversationId: 'conv-123',
          agentId: 'agent-1',
          content: 'Transaction test',
          platform: 'line',
          recipientPlatformId: 'user-123',
          delaySeconds: 1
        })
      }));

      await testEnv.wait(1100);
      await buffer.alarm();

      // Verify batch was called (transaction)
      expect(batchSpy).toHaveBeenCalled();
    }, 10000); // 增加超時時間
  });

  describe('🔧 DLQ Query Endpoint', () => {
    it('should return failed messages from DLQ', async () => {
      const buffer = new DelayedMessageBuffer(mockState as any, mockBindings);

      // Manually add to DLQ
      await mockState.storage.put('dlq:msg-1', {
        id: 'msg-1',
        content: 'Failed message',
        platform: 'line',
        failedAt: Date.now(),
        failureReason: 'Test failure',
        retryCount: 3
      });

      const response = await buffer.fetch(testEnv.createRequest('https://do/dlq'));
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.messages[0].id).toBe('msg-1');
      expect(result.messages[0].failureReason).toBe('Test failure');
    });

    it('should sort DLQ by failure time descending', async () => {
      const buffer = new DelayedMessageBuffer(mockState as any, mockBindings);

      // Add multiple failed messages
      await mockState.storage.put('dlq:msg-1', {
        id: 'msg-1',
        failedAt: 1000,
        failureReason: 'Early failure'
      });

      await mockState.storage.put('dlq:msg-2', {
        id: 'msg-2',
        failedAt: 3000,
        failureReason: 'Late failure'
      });

      await mockState.storage.put('dlq:msg-3', {
        id: 'msg-3',
        failedAt: 2000,
        failureReason: 'Mid failure'
      });

      const response = await buffer.fetch(testEnv.createRequest('https://do/dlq'));
      const result = await response.json();

      expect(result.messages[0].id).toBe('msg-2'); // Latest
      expect(result.messages[1].id).toBe('msg-3'); // Middle
      expect(result.messages[2].id).toBe('msg-1'); // Earliest
    });
  });

  describe('🔧 Error Recovery', () => {
    it('should restore retry count from storage', async () => {
      // Pre-populate storage with message that has retry count
      await mockState.storage.put('msg:msg-restore', {
        id: 'msg-restore',
        conversationId: 'conv-123',
        agentId: 'agent-1',
        content: 'Restore test',
        platform: 'line',
        recipientPlatformId: 'user-123',
        scheduledAt: Date.now() + 5000, // 5 seconds in the future (not expired)
        status: 'pending',
        retryCount: 2, // Already retried twice
        lastRetryAt: Date.now() - 5000
      });

      const buffer = new DelayedMessageBuffer(mockState as any, mockBindings);

      // ⚠️ Important: Wait for state restoration to complete
      // blockConcurrencyWhile in constructor is async but constructor isn't
      await testEnv.wait(100);

      // Should restore state from storage
      const listResponse = await buffer.fetch(testEnv.createRequest('https://do/list'));
      const listResult = await listResponse.json();

      // Message should be restored
      expect(listResult.count).toBeGreaterThan(0);
      expect(listResult.messages[0].id).toBe('msg-restore');
    });
  });
});
