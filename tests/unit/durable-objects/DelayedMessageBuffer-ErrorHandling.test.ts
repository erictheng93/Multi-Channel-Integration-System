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
import { DurableObjectState } from '@cloudflare/workers-types';

// Mock Bindings
const mockBindings = {
  DB: {} as any,
  LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
  FB_PAGE_ACCESS_TOKEN: 'test-fb-token'
};

// Mock Durable Object State
class MockDurableObjectState implements Partial<DurableObjectState> {
  private storage = new Map<string, any>();
  private alarmTime: number | null = null;

  id = {
    toString: () => 'test-do-id',
    equals: () => false,
    name: 'test-conversation'
  } as any;

  async blockConcurrencyWhile(callback: () => Promise<void>): Promise<void> {
    await callback();
  }

  storage = {
    get: async (key: string) => this.storage.get(key),
    put: async (key: string, value: any) => {
      this.storage.set(key, value);
    },
    delete: async (key: string) => {
      this.storage.delete(key);
    },
    list: async (options?: { prefix?: string }) => {
      const entries = new Map();
      for (const [key, value] of this.storage.entries()) {
        if (!options?.prefix || key.startsWith(options.prefix)) {
          entries.set(key, value);
        }
      }
      return entries;
    },
    deleteAll: async () => {
      this.storage.clear();
    },
    setAlarm: async (time: number) => {
      this.alarmTime = time;
    },
    getAlarm: async () => this.alarmTime,
    deleteAlarm: async () => {
      this.alarmTime = null;
    }
  } as any;
}

describe('DelayedMessageBuffer - Error Handling (Phase 1)', () => {
  let mockState: MockDurableObjectState;
  let DelayedMessageBuffer: any;

  beforeEach(async () => {
    mockState = new MockDurableObjectState();
    vi.clearAllMocks();

    // Mock fetch API
    global.fetch = vi.fn();

    // Mock drizzle imports
    vi.mock('drizzle-orm/d1', () => ({
      drizzle: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        batch: vi.fn().mockResolvedValue([])
      }))
    }));

    // Dynamically import DelayedMessageBuffer
    const module = await import('../../../src/durable-objects/DelayedMessageBuffer');
    DelayedMessageBuffer = module.DelayedMessageBuffer;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('🔧 Retry Mechanism', () => {
    it('should retry failed messages with exponential backoff', async () => {
      const buffer = new DelayedMessageBuffer(mockState as any, mockBindings);

      // Mock LINE API to fail first 2 times, succeed on 3rd
      let attemptCount = 0;
      (global.fetch as any).mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.resolve(new Response(null, { status: 503 }));
        }
        return Promise.resolve(new Response(null, { status: 200 }));
      });

      const scheduleResponse = await buffer.fetch(new Request('https://do/schedule', {
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
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Trigger alarm manually
      await buffer.alarm();

      // Should have attempted 3 times
      expect(attemptCount).toBe(3);
    });

    it('should add message to DLQ after max retries', async () => {
      const buffer = new DelayedMessageBuffer(mockState as any, mockBindings);

      // Mock LINE API to always fail
      (global.fetch as any).mockResolvedValue(new Response(null, { status: 503 }));

      await buffer.fetch(new Request('https://do/schedule', {
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

      // Wait and trigger alarm
      await new Promise(resolve => setTimeout(resolve, 1100));
      await buffer.alarm();

      // Query DLQ
      const dlqResponse = await buffer.fetch(new Request('https://do/dlq'));
      const dlqResult = await dlqResponse.json();

      expect(dlqResult.success).toBe(true);
      expect(dlqResult.count).toBeGreaterThan(0);
      expect(dlqResult.messages[0].id).toBe('msg-dlq-test');
      expect(dlqResult.messages[0].failureReason).toBeDefined();
    });
  });

  describe('🔧 Idempotency Check', () => {
    it('should not send duplicate messages', async () => {
      const buffer = new DelayedMessageBuffer(mockState as any, mockBindings);

      // Mock database to return existing message
      vi.mock('drizzle-orm/d1', () => ({
        drizzle: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([{ id: 'msg-dup-test' }]) // Message already exists
        }))
      }));

      (global.fetch as any).mockResolvedValue(new Response(null, { status: 200 }));

      await buffer.fetch(new Request('https://do/schedule', {
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

      await new Promise(resolve => setTimeout(resolve, 1100));
      await buffer.alarm();

      // fetch should not be called for sending (only for idempotency check)
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('api.line.me'),
        expect.any(Object)
      );
    });
  });

  describe('🔧 Batch Failure Handling', () => {
    it('should track success and failure counts in batch sends', async () => {
      const buffer = new DelayedMessageBuffer(mockState as any, mockBindings);
      const consoleSpy = vi.spyOn(console, 'log');

      // Schedule 3 messages
      for (let i = 1; i <= 3; i++) {
        await buffer.fetch(new Request('https://do/schedule', {
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
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('msg-batch-2')) {
          return Promise.resolve(new Response(null, { status: 503 }));
        }
        return Promise.resolve(new Response(null, { status: 200 }));
      });

      await new Promise(resolve => setTimeout(resolve, 1100));
      await buffer.alarm();

      // Check console logs for batch statistics
      const batchLog = consoleSpy.mock.calls.find(call =>
        call[0]?.includes('Batch send complete')
      );

      expect(batchLog).toBeDefined();
      expect(batchLog[0]).toContain('2 success'); // msg-1 and msg-3
      expect(batchLog[0]).toContain('1 failed');  // msg-2
    });
  });

  describe('🔧 Transaction Handling', () => {
    it('should use db.batch for atomic operations', async () => {
      const buffer = new DelayedMessageBuffer(mockState as any, mockBindings);
      const batchSpy = vi.fn().mockResolvedValue([]);

      vi.mock('drizzle-orm/d1', () => ({
        drizzle: vi.fn(() => ({
          batch: batchSpy,
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis()
        }))
      }));

      (global.fetch as any).mockResolvedValue(new Response(null, { status: 200 }));

      await buffer.fetch(new Request('https://do/schedule', {
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

      await new Promise(resolve => setTimeout(resolve, 1100));
      await buffer.alarm();

      // Verify batch was called (transaction)
      expect(batchSpy).toHaveBeenCalled();
    });
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

      const response = await buffer.fetch(new Request('https://do/dlq'));
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

      const response = await buffer.fetch(new Request('https://do/dlq'));
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
        scheduledAt: Date.now() - 1000,
        status: 'pending',
        retryCount: 2, // Already retried twice
        lastRetryAt: Date.now() - 5000
      });

      const buffer = new DelayedMessageBuffer(mockState as any, mockBindings);

      // Should restore state from storage
      const listResponse = await buffer.fetch(new Request('https://do/list'));
      const listResult = await listResponse.json();

      // Message should be restored
      expect(listResult.count).toBeGreaterThan(0);
    });
  });
});
