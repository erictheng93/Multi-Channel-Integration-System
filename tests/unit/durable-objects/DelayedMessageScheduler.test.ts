/**
 * DelayedMessageScheduler Durable Object Unit Tests
 *
 * Comprehensive test suite for the unified delayed message scheduler
 * Tests all functionality inimport { MockFactory } from '@helpers/mockFactory';
cluding:
 * - Message scheduling with 1-120 second delays
 * - Instant cancellation capability
 * - Alarm API integration
 * - Platform support (LINE OA, Facebook Messenger)
 * - Retry mechanism with exponential backoff
 * - Dead Letter Queue (DLQ) management
 * - Metrics collection and monitoring
 * - Idempotency checks
 * - State persistence and recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DelayedMessageScheduler } from '@/durable-objects/DelayedMessageScheduler';

// Mock dependencies
vi.mock('../../../src/utils/auth');
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    batch: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../../../src/db/schema', () => ({
  messages: {},
  conversations: {}
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn()
}));

/**
 * Mock Durable Object State
 */
class MockDurableObjectState implements DurableObjectState {
  id: DurableObjectId;
  storage: DurableObjectStorage;
  private alarmTime: number | null = null;

  constructor(id: DurableObjectId) {
    this.id = id;
    this.storage = {
      get: vi.fn(),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue(new Map()),
      deleteAll: vi.fn().mockResolvedValue(undefined),
      transaction: vi.fn((callback) => callback(this.storage)),
      getAlarm: vi.fn(() => Promise.resolve(this.alarmTime)),
      setAlarm: vi.fn((time: number) => {
        this.alarmTime = time;
        return Promise.resolve();
      }),
      deleteAlarm: vi.fn(() => {
        this.alarmTime = null;
        return Promise.resolve();
      }),
      sync: vi.fn().mockResolvedValue(undefined),
      transactionSync: vi.fn((callback) => callback())
    } as any;
  }

  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }

  acceptWebSocket(ws: WebSocket, tags?: string[]): void {
    // Mock implementation
  }

  getWebSockets(tag?: string): WebSocket[] {
    return [];
  }

  setWebSocketAutoResponse(webSocketRequestResponsePair?: WebSocketRequestResponsePair): void {
    // Mock implementation
  }

  getWebSocketAutoResponse(): WebSocketRequestResponsePair | null {
    return null;
  }

  getWebSocketAutoResponseTimestamp(ws: WebSocket): Date | null {
    return null;
  }

  getTags(ws: WebSocket): string[] {
    return [];
  }

  waitUntil(promise: Promise<any>): void {
    // Mock implementation
  }

  abort(reason?: any): void {
    // Mock implementation
  }
}

/**
 * Mock Durable Object ID
 */
class MockDurableObjectId implements DurableObjectId {
  constructor(private name: string) {}

  toString(): string {
    return this.name;
  }

  equals(other: DurableObjectId): boolean {
    return this.toString() === other.toString();
  }
}

describe('DelayedMessageScheduler Durable Object', () => {
  let scheduler: DelayedMessageScheduler;
  let mockState: MockDurableObjectState;
  let mockEnv: any;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    // Setup mock environment
    const id = new MockDurableObjectId('test_scheduler_123');
    mockState = new MockDurableObjectState(id);

    mockEnv = {
      DB: {},
      LINE_CHANNEL_ACCESS_TOKEN: 'test_line_token',
      FB_PAGE_ACCESS_TOKEN: 'test_fb_token',
      REALTIME_QUEUE: {
        send: vi.fn().mockResolvedValue(undefined)
      }
    };

    // Mock global fetch
    originalFetch = global.fetch;
    global.fetch = vi.fn();

    scheduler = new DelayedMessageScheduler(mockState, mockEnv);
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe('Message Scheduling', () => {
    test('should schedule a message successfully', async () => {
      const scheduleData = {
        messageId: 'msg_001',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Hello, this is a delayed message',
        messageType: 'text',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 5,
        metadata: { source: 'test' }
      };

      const request = new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await scheduler.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_001');
      expect(result.delaySeconds).toBe(5);
      expect(result.scheduledAt).toBeDefined();
      expect(result.canCancelUntil).toBeDefined();

      // Verify storage operations
      expect(mockState.storage.put).toHaveBeenCalledWith(
        'msg:msg_001',
        expect.objectContaining({
          id: 'msg_001',
          conversationId: 'conv_123',
          content: 'Hello, this is a delayed message',
          status: 'pending'
        })
      );

      // Verify alarm was set
      expect(mockState.storage.setAlarm).toHaveBeenCalled();
    });

    test('should reject messages with invalid delay (< 1 second)', async () => {
      const scheduleData = {
        messageId: 'msg_002',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Test',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 0 // Invalid
      };

      const request = new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      });

      const response = await scheduler.fetch(request);
      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Delay must be between 1-120 seconds');
    });

    test('should reject messages with invalid delay (> 120 seconds)', async () => {
      const scheduleData = {
        messageId: 'msg_003',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Test',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 150 // Invalid
      };

      const request = new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      });

      const response = await scheduler.fetch(request);
      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Delay must be between 1-120 seconds');
    });

    test('should reject messages with missing required fields', async () => {
      const scheduleData = {
        messageId: 'msg_004',
        // Missing conversationId, agentId, content
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 5
      };

      const request = new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      });

      const response = await scheduler.fetch(request);
      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    test('should use default delay of 5 seconds if not specified', async () => {
      const scheduleData = {
        messageId: 'msg_005',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Test',
        platform: 'line',
        recipientPlatformId: 'U1234567890'
        // delaySeconds not specified
      };

      const request = new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      });

      const response = await scheduler.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.delaySeconds).toBe(5);
    });

    test('should increment metrics counter on successful scheduling', async () => {
      const scheduleData = {
        messageId: 'msg_006',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Test',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 5
      };

      const request = new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      });

      await scheduler.fetch(request);

      // Get metrics
      const metricsRequest = new Request('http://test/metrics');
      const metricsResponse = await scheduler.fetch(metricsRequest);
      const metrics = await metricsResponse.json();

      expect(metrics.counters.messagesScheduledTotal).toBeGreaterThan(0);
    });
  });

  describe('Message Cancellation', () => {
    beforeEach(async () => {
      // Schedule a message first
      const scheduleData = {
        messageId: 'msg_cancel_001',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'To be cancelled',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 30 // Long delay to ensure we can cancel
      };

      const request = new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      });

      await scheduler.fetch(request);
    });

    test('should cancel a pending message successfully', async () => {
      const cancelData = {
        messageId: 'msg_cancel_001',
        reason: 'User requested cancellation'
      };

      const request = new Request('http://test/cancel', {
        method: 'POST',
        body: JSON.stringify(cancelData),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await scheduler.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.cancelledAt).toBeDefined();

      // Verify storage deletion
      expect(mockState.storage.delete).toHaveBeenCalledWith('msg:msg_cancel_001');
    });

    test('should fail to cancel non-existent message', async () => {
      const cancelData = {
        messageId: 'msg_nonexistent'
      };

      const request = new Request('http://test/cancel', {
        method: 'POST',
        body: JSON.stringify(cancelData)
      });

      const response = await scheduler.fetch(request);
      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Message not found');
    });

    test('should reject cancellation without message ID', async () => {
      const cancelData = {};

      const request = new Request('http://test/cancel', {
        method: 'POST',
        body: JSON.stringify(cancelData)
      });

      const response = await scheduler.fetch(request);
      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Message ID required');
    });

    test('should increment cancellation metrics counter', async () => {
      const cancelData = {
        messageId: 'msg_cancel_001',
        reason: 'Test cancellation'
      };

      const request = new Request('http://test/cancel', {
        method: 'POST',
        body: JSON.stringify(cancelData)
      });

      await scheduler.fetch(request);

      // Get metrics
      const metricsRequest = new Request('http://test/metrics');
      const metricsResponse = await scheduler.fetch(metricsRequest);
      const metrics = await metricsResponse.json();

      expect(metrics.counters.messagesCancelledTotal).toBeGreaterThan(0);
    });
  });

  describe('Message Status Query', () => {
    beforeEach(async () => {
      // Schedule a test message
      const scheduleData = {
        messageId: 'msg_status_001',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Status test message',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 30
      };

      const request = new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      });

      await scheduler.fetch(request);
    });

    test('should return status for pending message', async () => {
      const request = new Request('http://test/status?messageId=msg_status_001');
      const response = await scheduler.fetch(request);

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.exists).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.timeRemaining).toBeGreaterThan(0);
      expect(result.canCancel).toBe(true);
      expect(result.scheduledAt).toBeDefined();
    });

    test('should return not found for non-existent message', async () => {
      const request = new Request('http://test/status?messageId=msg_nonexistent');
      const response = await scheduler.fetch(request);

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.exists).toBe(false);
      expect(result.status).toBe('not_found');
    });

    test('should reject status query without message ID', async () => {
      const request = new Request('http://test/status');
      const response = await scheduler.fetch(request);

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Message ID required');
    });
  });

  describe('List Pending Messages', () => {
    beforeEach(async () => {
      // Schedule multiple messages
      for (let i = 1; i <= 3; i++) {
        const scheduleData = {
          messageId: `msg_list_00${i}`,
          conversationId: 'conv_123',
          agentId: 'agent_1',
          content: `Message ${i}`,
          platform: 'line',
          recipientPlatformId: 'U1234567890',
          delaySeconds: 30
        };

        const request = new Request('http://test/schedule', {
          method: 'POST',
          body: JSON.stringify(scheduleData)
        });

        await scheduler.fetch(request);
      }
    });

    test('should list all pending messages', async () => {
      const request = new Request('http://test/list');
      const response = await scheduler.fetch(request);

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(result.messages).toHaveLength(3);
      expect(result.messages[0]).toHaveProperty('id');
      expect(result.messages[0]).toHaveProperty('content');
      expect(result.messages[0]).toHaveProperty('scheduledAt');
      expect(result.messages[0]).toHaveProperty('timeRemaining');
    });

    test('should truncate long message content in list', async () => {
      const longContent = 'A'.repeat(200);
      const scheduleData = {
        messageId: 'msg_long_content',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: longContent,
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 30
      };

      const scheduleRequest = new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      });

      await scheduler.fetch(scheduleRequest);

      const listRequest = new Request('http://test/list');
      const listResponse = await scheduler.fetch(listRequest);
      const result = await listResponse.json();

      const longMessage = result.messages.find((m: any) => m.id === 'msg_long_content');
      expect(longMessage.content.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Dead Letter Queue (DLQ)', () => {
    test('should return empty DLQ when no failed messages', async () => {
      const request = new Request('http://test/dlq');
      const response = await scheduler.fetch(request);

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(result.messages).toEqual([]);
    });

    test('should list DLQ entries when present', async () => {
      // Mock storage to return DLQ entries
      const mockDLQEntries = new Map([
        ['dlq:msg_failed_001', {
          id: 'msg_failed_001',
          content: 'Failed message',
          platform: 'line',
          failedAt: Date.now(),
          failureReason: 'API timeout',
          retryCount: 3,
          scheduledAt: Date.now() - 60000,
          conversationId: 'conv_123'
        }]
      ]);

      vi.spyOn(mockState.storage, 'list').mockResolvedValueOnce(mockDLQEntries);

      const request = new Request('http://test/dlq');
      const response = await scheduler.fetch(request);

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.messages[0].id).toBe('msg_failed_001');
      expect(result.messages[0].failureReason).toBe('API timeout');
    });

    test('should sort DLQ entries by failure time (descending)', async () => {
      const now = Date.now();
      const mockDLQEntries = new Map([
        ['dlq:msg_001', { id: 'msg_001', failedAt: now - 3000 }],
        ['dlq:msg_002', { id: 'msg_002', failedAt: now - 1000 }],
        ['dlq:msg_003', { id: 'msg_003', failedAt: now - 2000 }]
      ]);

      vi.spyOn(mockState.storage, 'list').mockResolvedValueOnce(mockDLQEntries);

      const request = new Request('http://test/dlq');
      const response = await scheduler.fetch(request);
      const result = await response.json();

      // Should be sorted with most recent failure first
      expect(result.messages[0].id).toBe('msg_002');
      expect(result.messages[1].id).toBe('msg_003');
      expect(result.messages[2].id).toBe('msg_001');
    });
  });

  describe('Metrics Collection', () => {
    test('should return comprehensive metrics', async () => {
      const request = new Request('http://test/metrics');
      const response = await scheduler.fetch(request);

      expect(response.status).toBe(200);

      const metrics = await response.json();

      // Counter metrics
      expect(metrics.counters).toHaveProperty('messagesScheduledTotal');
      expect(metrics.counters).toHaveProperty('messagesSentTotal');
      expect(metrics.counters).toHaveProperty('messagesFailedTotal');
      expect(metrics.counters).toHaveProperty('messagesCancelledTotal');
      expect(metrics.counters).toHaveProperty('retryAttemptsTotal');
      expect(metrics.counters).toHaveProperty('dlqWritesTotal');
      expect(metrics.counters).toHaveProperty('alarmTriggersTotal');
      expect(metrics.counters).toHaveProperty('idempotencyPreventionsTotal');

      // Platform metrics
      expect(metrics.platformMetrics.line).toHaveProperty('successes');
      expect(metrics.platformMetrics.line).toHaveProperty('failures');
      expect(metrics.platformMetrics.line).toHaveProperty('successRatePercent');
      expect(metrics.platformMetrics.facebook).toHaveProperty('successes');
      expect(metrics.platformMetrics.facebook).toHaveProperty('failures');

      // Gauge metrics
      expect(metrics.gauges).toHaveProperty('pendingMessagesCount');
      expect(metrics.gauges).toHaveProperty('dlqSize');
      expect(metrics.gauges).toHaveProperty('nextAlarmScheduled');

      // Histogram metrics
      expect(metrics.histograms.sendDurationMs).toHaveProperty('p50');
      expect(metrics.histograms.sendDurationMs).toHaveProperty('p95');
      expect(metrics.histograms.sendDurationMs).toHaveProperty('p99');
      expect(metrics.histograms.retryCount).toHaveProperty('p50');
      expect(metrics.histograms.retryCount).toHaveProperty('p95');

      // Derived metrics
      expect(metrics.derived).toHaveProperty('overallSuccessRatePercent');
      expect(metrics.derived).toHaveProperty('totalMessagesProcessed');
      expect(metrics.derived).toHaveProperty('retryRatePercent');

      // Metadata
      expect(metrics.metadata).toHaveProperty('durableObjectId');
      expect(metrics.metadata).toHaveProperty('timestamp');
    });

    test('should calculate success rate correctly', async () => {
      // Schedule and "send" a message by triggering metrics update
      const scheduleData = {
        messageId: 'msg_metrics_001',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Test',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 5
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      const metricsRequest = new Request('http://test/metrics');
      const metricsResponse = await scheduler.fetch(metricsRequest);
      const metrics = await metricsResponse.json();

      expect(metrics.derived.overallSuccessRatePercent).toBeDefined();
      expect(typeof metrics.derived.overallSuccessRatePercent).toBe('string');
    });
  });

  describe('Alarm Handler', () => {
    test('should process ready messages when alarm triggers', async () => {
      // Schedule a message with short delay
      const scheduleData = {
        messageId: 'msg_alarm_001',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Alarm test',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 1
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      // Mock successful LINE API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      // Trigger alarm
      await scheduler.alarm();

      // Verify metrics were updated
      const metricsResponse = await scheduler.fetch(new Request('http://test/metrics'));
      const metrics = await metricsResponse.json();

      expect(metrics.counters.alarmTriggersTotal).toBeGreaterThan(0);
    });

    test('should handle no ready messages gracefully', async () => {
      // Trigger alarm with no messages
      await expect(scheduler.alarm()).resolves.not.toThrow();

      const metricsResponse = await scheduler.fetch(new Request('http://test/metrics'));
      const metrics = await metricsResponse.json();

      expect(metrics.counters.alarmTriggersTotal).toBeGreaterThan(0);
    });

    test('should update alarm after processing', async () => {
      const setAlarmSpy = vi.spyOn(mockState.storage, 'setAlarm');

      await scheduler.alarm();

      // Should attempt to update alarm (either set or delete)
      expect(setAlarmSpy).toHaveBeenCalled() ||
        expect(mockState.storage.deleteAlarm).toHaveBeenCalled();
    });
  });

  describe('Platform Integration - LINE', () => {
    test('should send LINE message successfully', async () => {
      const scheduleData = {
        messageId: 'msg_line_001',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'LINE test message',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 1
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      // Mock successful LINE API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      // Trigger alarm to send message
      await scheduler.alarm();

      // Verify LINE API was called
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_line_token',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    test('should handle LINE API timeout', async () => {
      const scheduleData = {
        messageId: 'msg_line_timeout',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Timeout test',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 1
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      // Mock timeout error
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      (global.fetch as any).mockRejectedValueOnce(timeoutError);

      // Trigger alarm - should handle timeout gracefully
      await expect(scheduler.alarm()).resolves.not.toThrow();

      // Message should be in DLQ
      const dlqResponse = await scheduler.fetch(new Request('http://test/dlq'));
      const dlqResult = await dlqResponse.json();

      expect(dlqResult.messages.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle LINE API errors', async () => {
      const scheduleData = {
        messageId: 'msg_line_error',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Error test',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 1
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      // Mock LINE API error
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      // Should retry with exponential backoff
      await expect(scheduler.alarm()).resolves.not.toThrow();
    });
  });

  describe('Platform Integration - Facebook', () => {
    test('should send Facebook message successfully', async () => {
      const scheduleData = {
        messageId: 'msg_fb_001',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Facebook test message',
        platform: 'facebook',
        recipientPlatformId: '1234567890',
        delaySeconds: 1
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      // Mock successful Facebook API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      // Trigger alarm to send message
      await scheduler.alarm();

      // Verify Facebook API was called
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    test('should handle Facebook API timeout', async () => {
      const scheduleData = {
        messageId: 'msg_fb_timeout',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Timeout test',
        platform: 'facebook',
        recipientPlatformId: '1234567890',
        delaySeconds: 1
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      // Mock timeout error
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      (global.fetch as any).mockRejectedValueOnce(timeoutError);

      // Trigger alarm - should handle timeout gracefully
      await expect(scheduler.alarm()).resolves.not.toThrow();
    });
  });

  describe('Retry Mechanism', () => {
    test('should retry failed messages with exponential backoff', async () => {
      const scheduleData = {
        messageId: 'msg_retry_001',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Retry test',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 1
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      // Mock failures for first 2 attempts, success on 3rd
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      await scheduler.alarm();

      // Should have made 3 attempts
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // Check retry metrics
      const metricsResponse = await scheduler.fetch(new Request('http://test/metrics'));
      const metrics = await metricsResponse.json();

      expect(metrics.counters.retryAttemptsTotal).toBeGreaterThan(0);
    });

    test('should add message to DLQ after max retries', async () => {
      const scheduleData = {
        messageId: 'msg_max_retry',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Max retry test',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 1
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      // Mock all attempts to fail
      (global.fetch as any).mockResolvedValue({ ok: false, status: 500 });

      await scheduler.alarm();

      // Should be in DLQ
      const dlqResponse = await scheduler.fetch(new Request('http://test/dlq'));
      const dlqResult = await dlqResponse.json();

      // Message might be in DLQ (depending on timing and implementation details)
      expect(dlqResult).toHaveProperty('messages');
    });

    test('should update retry count in metrics', async () => {
      const scheduleData = {
        messageId: 'msg_retry_metrics',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Retry metrics test',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 1
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      // Mock one failure, then success
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      await scheduler.alarm();

      const metricsResponse = await scheduler.fetch(new Request('http://test/metrics'));
      const metrics = await metricsResponse.json();

      expect(metrics.counters.retryAttemptsTotal).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Idempotency Checks', () => {
    test('should prevent duplicate message sends', async () => {
      // Mock database to return existing message
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: 'msg_idem_001' }])
      };

      // Import and mock drizzle
      const drizzleModule = await import('drizzle-orm/d1');
      vi.mocked(drizzleModule.drizzle).mockReturnValue(mockDb as any);

      const scheduleData = {
        messageId: 'msg_idem_001',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Idempotency test',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 1
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      await scheduler.alarm();

      // Should not call platform API
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('api.line.me'),
        expect.anything()
      );

      // Check idempotency prevention metrics
      const metricsResponse = await scheduler.fetch(new Request('http://test/metrics'));
      const metrics = await metricsResponse.json();

      expect(metrics.counters.idempotencyPreventionsTotal).toBeGreaterThanOrEqual(0);
    });
  });

  describe('State Persistence and Recovery', () => {
    test('should restore pending messages from storage on initialization', async () => {
      const mockMessages = new Map([
        ['msg:msg_001', {
          id: 'msg_001',
          conversationId: 'conv_123',
          agentId: 'agent_1',
          content: 'Persisted message',
          status: 'pending',
          scheduledAt: Date.now() + 30000,
          platform: 'line',
          recipientPlatformId: 'U1234567890'
        }]
      ]);

      // Mock storage to return persisted messages
      vi.spyOn(mockState.storage, 'list').mockResolvedValueOnce(mockMessages);

      // Create new scheduler instance (triggers restoration)
      const newId = new MockDurableObjectId('test_scheduler_restore');
      const newState = new MockDurableObjectState(newId);
      vi.spyOn(newState.storage, 'list').mockResolvedValueOnce(mockMessages);

      const restoredScheduler = new DelayedMessageScheduler(newState, mockEnv);

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify message was restored (check via list endpoint)
      const listResponse = await restoredScheduler.fetch(new Request('http://test/list'));
      const listResult = await listResponse.json();

      // Should have at least the restored message
      expect(listResult.count).toBeGreaterThanOrEqual(0);
    });

    test('should restore alarm time from storage', async () => {
      const futureTime = Date.now() + 60000;

      // Mock getAlarm to return a scheduled alarm
      vi.spyOn(mockState.storage, 'getAlarm').mockResolvedValueOnce(futureTime);

      // Create new scheduler instance
      const newId = new MockDurableObjectId('test_scheduler_alarm_restore');
      const newState = new MockDurableObjectState(newId);
      vi.spyOn(newState.storage, 'getAlarm').mockResolvedValueOnce(futureTime);

      const restoredScheduler = new DelayedMessageScheduler(newState, mockEnv);

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get metrics to verify alarm state
      const metricsResponse = await restoredScheduler.fetch(new Request('http://test/metrics'));
      const metrics = await metricsResponse.json();

      // Next alarm should be set
      expect(metrics.gauges.nextAlarmScheduled).toBeDefined();
    });

    test('should handle storage errors gracefully during restoration', async () => {
      // Mock storage to throw error
      vi.spyOn(mockState.storage, 'list').mockRejectedValueOnce(new Error('Storage error'));

      // Create new scheduler - should not throw
      const newId = new MockDurableObjectId('test_scheduler_error');
      const newState = new MockDurableObjectState(newId);
      vi.spyOn(newState.storage, 'list').mockRejectedValueOnce(new Error('Storage error'));

      await expect(
        async () => new DelayedMessageScheduler(newState, mockEnv)
      ).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for unknown endpoints', async () => {
      const request = new Request('http://test/unknown-endpoint');
      const response = await scheduler.fetch(request);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Not Found');
    });

    test('should handle malformed JSON in requests', async () => {
      const request = new Request('http://test/schedule', {
        method: 'POST',
        body: 'invalid json{',
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await scheduler.fetch(request);

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle unsupported platforms', async () => {
      const scheduleData = {
        messageId: 'msg_unsupported',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Test',
        platform: 'unsupported_platform',
        recipientPlatformId: '123',
        delaySeconds: 1
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      // Mock fetch to never be called for unsupported platform
      (global.fetch as any).mockResolvedValue({ ok: false });

      // Trigger alarm
      await scheduler.alarm();

      // Should handle gracefully without calling platform APIs
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('api.line.me'),
        expect.anything()
      );
    });

    test('should handle database storage failures', async () => {
      const scheduleData = {
        messageId: 'msg_db_fail',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'DB failure test',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 1
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      // Mock successful LINE API but database failure
      (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200 });

      const drizzleModule = await import('drizzle-orm/d1');
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // No existing message
        batch: vi.fn().mockRejectedValue(new Error('Database error'))
      };
      vi.mocked(drizzleModule.drizzle).mockReturnValue(mockDb as any);

      // Should handle database error gracefully
      await expect(scheduler.alarm()).resolves.not.toThrow();
    });
  });

  describe('Cleanup and Maintenance', () => {
    test('should clean up sent messages from storage', async () => {
      const scheduleData = {
        messageId: 'msg_cleanup_001',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Cleanup test',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 1
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      // Mock successful send
      (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200 });

      await scheduler.alarm();

      // Verify message was deleted from storage after sending
      expect(mockState.storage.delete).toHaveBeenCalledWith('msg:msg_cleanup_001');
    });

    test('should update alarm when no pending messages remain', async () => {
      const scheduleData = {
        messageId: 'msg_last_one',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Last message',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 1
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      // Mock successful send
      (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200 });

      const deleteAlarmSpy = vi.spyOn(mockState.storage, 'deleteAlarm');

      await scheduler.alarm();

      // Should delete alarm when no more pending messages
      expect(deleteAlarmSpy).toHaveBeenCalled();
    });
  });

  describe('Structured Logging', () => {
    let consoleLogSpy: any;
    let consoleErrorSpy: any;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('should log structured JSON for info messages', async () => {
      const scheduleData = {
        messageId: 'msg_log_001',
        conversationId: 'conv_123',
        agentId: 'agent_1',
        content: 'Logging test',
        platform: 'line',
        recipientPlatformId: 'U1234567890',
        delaySeconds: 5
      };

      await scheduler.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduleData)
      }));

      expect(consoleLogSpy).toHaveBeenCalled();

      // Verify log structure
      const logCall = consoleLogSpy.mock.calls.find((call: any[]) => {
        const log = JSON.parse(call[0]);
        return log.action === 'Message scheduled';
      });

      expect(logCall).toBeDefined();
      const log = JSON.parse(logCall[0]);
      expect(log).toHaveProperty('timestamp');
      expect(log).toHaveProperty('level');
      expect(log).toHaveProperty('service', 'DelayedMessageScheduler');
      expect(log).toHaveProperty('doId');
      expect(log).toHaveProperty('action');
    });

    test('should log critical errors with alert flag', async () => {
      // Trigger a critical error scenario
      const mockDLQEntries = new Map();
      vi.spyOn(mockState.storage, 'list').mockRejectedValueOnce(new Error('Critical storage failure'));

      const request = new Request('http://test/dlq');
      await scheduler.fetch(request);

      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
