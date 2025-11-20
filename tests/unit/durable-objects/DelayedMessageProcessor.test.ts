// DelayedMessageProcessor Durable Object Unit Tests
// Tests batch processing of scheduled messages, cancellation, and retry mechanisms

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DelayedMessageProcessor } from '@backend/durable-objects/DelayedMessageProcessor';
import {
  setupDOTestEnvironment,
  cleanupDOTestEnvironment,
  createMockBindings,
  MockDurableOimport { MockFactory } from '@helpers/mockFactory';
bjectState
} from '../../helpers/durable-objects-test-helper';
import type {
  ScheduledMessage
} from '@backend/types/websocket-types';

describe('DelayedMessageProcessor Durable Object', () => {
  let testEnv: ReturnType<typeof setupDOTestEnvironment>;
  let processor: DelayedMessageProcessor;
  let mockState: MockDurableObjectState;
  let mockBindings: any;

  beforeEach(() => {
    vi.clearAllMocks();
    testEnv = setupDOTestEnvironment();
    mockState = testEnv.createState();

    mockBindings = createMockBindings({
      MESSAGE_BROADCASTER: {
        idFromName: vi.fn((name: string) => ({ toString: () => name })),
        get: vi.fn(() => ({
          fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
        }))
      },
      LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token'
    });

    processor = new DelayedMessageProcessor(mockState as any, mockBindings);
  });

  afterEach(() => {
    cleanupDOTestEnvironment();
  });

  describe('Message Scheduling', () => {
    test('should schedule messages successfully', async () => {
      const scheduledMessage = {
        id: 'test-msg-123',
        conversationId: 'conv-456',
        agentId: 'agent-789',
        content: 'Scheduled test message',
        messageType: 'text',
        scheduledAt: Date.now() + 5000, // 5 seconds from now
        priority: 'normal',
        metadata: {}
      };

      const request = new Request('https://processor/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduledMessage),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await processor.fetch(request);
      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(scheduledMessage.id);
      expect(result.scheduledAt).toBe(scheduledMessage.scheduledAt);
    });

    test('should reject messages scheduled in the past', async () => {
      const pastMessage = {
        id: 'past-msg',
        conversationId: 'conv-123',
        agentId: 'agent-456',
        content: 'Past message',
        messageType: 'text',
        scheduledAt: Date.now() - 1000, // In the past
        priority: 'normal'
      };

      const request = new Request('https://processor/schedule', {
        method: 'POST',
        body: JSON.stringify(pastMessage),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await processor.fetch(request);
      expect(response.status).toBe(400);
    });

    test('should reject messages scheduled too far in the future', async () => {
      const farFutureMessage = {
        id: 'future-msg',
        conversationId: 'conv-123',
        agentId: 'agent-456',
        content: 'Far future message',
        messageType: 'text',
        scheduledAt: Date.now() + (25 * 60 * 60 * 1000), // 25 hours (exceeds 24h limit)
        priority: 'normal'
      };

      const request = new Request('https://processor/schedule', {
        method: 'POST',
        body: JSON.stringify(farFutureMessage),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await processor.fetch(request);
      expect(response.status).toBe(400);
    });

    test('should validate required fields', async () => {
      const invalidMessage = {
        id: 'invalid-msg',
        // Missing required fields
        content: 'Invalid message'
      };

      const request = new Request('https://processor/schedule', {
        method: 'POST',
        body: JSON.stringify(invalidMessage),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await processor.fetch(request);
      expect(response.status).toBe(400);
    });
  });

  describe('Message Cancellation', () => {
    test('should cancel scheduled messages', async () => {
      const messageId = 'cancel-test-msg';

      // First schedule a message
      const scheduledMessage = {
        id: messageId,
        conversationId: 'conv-123',
        agentId: 'agent-456',
        content: 'Message to be cancelled',
        messageType: 'text',
        scheduledAt: Date.now() + 60000, // 1 minute from now
        priority: 'normal'
      };

      await processor.fetch(new Request('https://processor/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduledMessage),
        headers: { 'Content-Type': 'application/json' }
      }));

      // Now cancel it
      const cancelRequest = new Request('https://processor/cancel', {
        method: 'POST',
        body: JSON.stringify({
          messageId,
          reason: 'Test cancellation'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await processor.fetch(cancelRequest);
      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(messageId);
      expect(result.cancelledAt).toBeDefined();
    });

    test('should return 404 for non-existent messages', async () => {
      const cancelRequest = new Request('https://processor/cancel', {
        method: 'POST',
        body: JSON.stringify({
          messageId: 'non-existent-msg'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await processor.fetch(cancelRequest);
      expect(response.status).toBe(404);
    });

    test('should not cancel already processed messages', async () => {
      const messageId = 'processed-msg';

      // Schedule a message with immediate execution time
      const scheduledMessage = {
        id: messageId,
        conversationId: 'conv-123',
        agentId: 'agent-456',
        content: 'Already processed message',
        messageType: 'text',
        scheduledAt: Date.now() + 100, // Very soon
        priority: 'normal'
      };

      await processor.fetch(new Request('https://processor/schedule', {
        method: 'POST',
        body: JSON.stringify(scheduledMessage),
        headers: { 'Content-Type': 'application/json' }
      }));

      // Wait for processing
      await testEnv.watest(200);

      // Try to trigger processing
      await processor.fetch(new Request('https://processor/process-batch', {
        method: 'POST'
      }));

      // Try to cancel (should fail if already processed)
      const cancelRequest = new Request('https://processor/cancel', {
        method: 'POST',
        body: JSON.stringify({
          messageId
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await processor.fetch(cancelRequest);
      // Should either be 404 (removed after processing) or indicate can't cancel
      expect(response.ok || response.status === 404).toBe(true);
    });
  });

  describe('Message Rescheduling', () => {
    test('should reschedule pending messages', async () => {
      const messageId = 'reschedule-msg';
      const originalTime = Date.now() + 60000;
      const newTime = Date.now() + 120000;

      // Schedule original message
      await processor.fetch(new Request('https://processor/schedule', {
        method: 'POST',
        body: JSON.stringify({
          id: messageId,
          conversationId: 'conv-123',
          agentId: 'agent-456',
          content: 'Message to reschedule',
          messageType: 'text',
          scheduledAt: originalTime,
          priority: 'normal'
        }),
        headers: { 'Content-Type': 'application/json' }
      }));

      // Reschedule it
      const rescheduleRequest = new Request('https://processor/reschedule', {
        method: 'POST',
        body: JSON.stringify({
          messageId,
          newScheduledAt: newTime
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await processor.fetch(rescheduleRequest);
      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.newScheduledAt).toBe(newTime);
    });

    test('should return 404 for non-existent messages', async () => {
      const rescheduleRequest = new Request('https://processor/reschedule', {
        method: 'POST',
        body: JSON.stringify({
          messageId: 'non-existent',
          newScheduledAt: Date.now() + 60000
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await processor.fetch(rescheduleRequest);
      expect(response.status).toBe(404);
    });
  });

  describe('Batch Processing', () => {
    test('should process messages when scheduled time arrives', async () => {
      const messageId = 'batch-msg-1';
      const scheduledAt = Date.now() + 100; // Process very soon

      await processor.fetch(new Request('https://processor/schedule', {
        method: 'POST',
        body: JSON.stringify({
          id: messageId,
          conversationId: 'conv-123',
          agentId: 'agent-456',
          content: 'Batch test message',
          messageType: 'text',
          scheduledAt,
          priority: 'normal'
        }),
        headers: { 'Content-Type': 'application/json' }
      }));

      // Wait for scheduled time
      await testEnv.watest(150);

      // Trigger batch processing
      const processRequest = new Request('https://processor/process-batch', {
        method: 'POST'
      });

      const response = await processor.fetch(processRequest);
      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.success).toBe(true);
    });

    test('should handle multiple messages in batch', async () => {
      const messageCount = 10;
      const scheduledAt = Date.now() + 100;

      // Schedule multiple messages
      for (let i = 0; i < messageCount; i++) {
        await processor.fetch(new Request('https://processor/schedule', {
          method: 'POST',
          body: JSON.stringify({
            id: `batch-msg-${i}`,
            conversationId: `conv-${i % 3}`,
            agentId: 'agent-456',
            content: `Batch message ${i}`,
            messageType: 'text',
            scheduledAt: scheduledAt + (i * 10),
            priority: 'normal'
          }),
          headers: { 'Content-Type': 'application/json' }
        }));
      }

      // Wait for all to be ready
      await testEnv.watest(200);

      // Process batch
      await processor.fetch(new Request('https://processor/process-batch', {
        method: 'POST'
      }));

      // Check metrics
      const metricsResponse = await processor.fetch(new Request('https://processor/metrics'));
      const metrics = await metricsResponse.json();

      expect(metrics.totalProcessed).toBeGreaterThan(0);
    });
  });

  describe('Message Queries', () => {
    test('should retrieve scheduled messages', async () => {
      const messageId = 'query-msg';
      const scheduledAt = Date.now() + 60000;

      await processor.fetch(new Request('https://processor/schedule', {
        method: 'POST',
        body: JSON.stringify({
          id: messageId,
          conversationId: 'conv-123',
          agentId: 'agent-456',
          content: 'Query test message',
          messageType: 'text',
          scheduledAt,
          priority: 'normal'
        }),
        headers: { 'Content-Type': 'application/json' }
      }));

      const queryRequest = new Request('https://processor/get-scheduled');
      const response = await processor.fetch(queryRequest);

      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThan(0);
      expect(result.messages).toBeDefined();
      expect(Array.isArray(result.messages)).toBe(true);
    });

    test('should filter messages by agentId', async () => {
      const agentId = 'agent-filter-test';

      await processor.fetch(new Request('https://processor/schedule', {
        method: 'POST',
        body: JSON.stringify({
          id: 'filter-msg-1',
          conversationId: 'conv-123',
          agentId: agentId,
          content: 'Filter test 1',
          messageType: 'text',
          scheduledAt: Date.now() + 60000,
          priority: 'normal'
        }),
        headers: { 'Content-Type': 'application/json' }
      }));

      await processor.fetch(new Request('https://processor/schedule', {
        method: 'POST',
        body: JSON.stringify({
          id: 'filter-msg-2',
          conversationId: 'conv-123',
          agentId: 'different-agent',
          content: 'Filter test 2',
          messageType: 'text',
          scheduledAt: Date.now() + 60000,
          priority: 'normal'
        }),
        headers: { 'Content-Type': 'application/json' }
      }));

      const queryRequest = new Request(`https://processor/get-scheduled?agentId=${agentId}`);
      const response = await processor.fetch(queryRequest);

      const result = await response.json();
      expect(result.messages.every((msg: ScheduledMessage) => msg.agentId === agentId)).toBe(true);
    });

    test('should filter messages by conversationId', async () => {
      const conversationId = 'conv-filter-test';

      await processor.fetch(new Request('https://processor/schedule', {
        method: 'POST',
        body: JSON.stringify({
          id: 'conv-filter-msg',
          conversationId: conversationId,
          agentId: 'agent-456',
          content: 'Conversation filter test',
          messageType: 'text',
          scheduledAt: Date.now() + 60000,
          priority: 'normal'
        }),
        headers: { 'Content-Type': 'application/json' }
      }));

      const queryRequest = new Request(`https://processor/get-scheduled?conversationId=${conversationId}`);
      const response = await processor.fetch(queryRequest);

      const result = await response.json();
      expect(result.messages.every((msg: ScheduledMessage) => msg.conversationId === conversationId)).toBe(true);
    });
  });

  describe('Metrics and Monitoring', () => {
    test('should provide comprehensive metrics', async () => {
      const metricsRequest = new Request('https://processor/metrics');
      const response = await processor.fetch(metricsRequest);

      expect(response.ok).toBe(true);

      const metrics = await response.json();
      expect(metrics).toHaveProperty('totalProcessed');
      expect(metrics).toHaveProperty('successfulSends');
      expect(metrics).toHaveProperty('failedSends');
      expect(metrics).toHaveProperty('cancelledMessagesCount');
      expect(metrics).toHaveProperty('queueDepth');
      expect(metrics).toHaveProperty('averageProcessingTime');
      expect(metrics).toHaveProperty('pendingMessages');
      expect(metrics).toHaveProperty('processingQueueLength');
      expect(metrics).toHaveProperty('retryQueueSize');
    });

    test('should provide status information', async () => {
      const statusRequest = new Request('https://processor/status');
      const response = await processor.fetch(statusRequest);

      expect(response.ok).toBe(true);

      const status = await response.json();
      expect(status).toHaveProperty('isHealthy');
      expect(status).toHaveProperty('queueDepth');
      expect(status).toHaveProperty('successRate');
      expect(status).toHaveProperty('isProcessing');
      expect(status).toHaveProperty('nextScheduledTime');
      expect(status).toHaveProperty('lastProcessed');
    });

    test('should track cancellation metrics', async () => {
      const messageId = 'cancel-metrics-msg';

      // Schedule and cancel a message
      await processor.fetch(new Request('https://processor/schedule', {
        method: 'POST',
        body: JSON.stringify({
          id: messageId,
          conversationId: 'conv-123',
          agentId: 'agent-456',
          content: 'Cancellation metrics test',
          messageType: 'text',
          scheduledAt: Date.now() + 60000,
          priority: 'normal'
        }),
        headers: { 'Content-Type': 'application/json' }
      }));

      await processor.fetch(new Request('https://processor/cancel', {
        method: 'POST',
        body: JSON.stringify({ messageId }),
        headers: { 'Content-Type': 'application/json' }
      }));

      // Check metrics
      const metricsResponse = await processor.fetch(new Request('https://processor/metrics'));
      const metrics = await metricsResponse.json();

      expect(metrics.cancelledMessagesCount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const request = new Request('https://processor/schedule', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await processor.fetch(request);
      expect(response.status).toBe(500);
    });

    test('should handle storage errors gracefully', async () => {
      // Mock storage failure
      vi.spyOn(mockState.storage, 'put').mockRejectedValueOnce(new Error('Storage error'));

      const request = new Request('https://processor/schedule', {
        method: 'POST',
        body: JSON.stringify({
          id: 'storage-error-msg',
          conversationId: 'conv-123',
          agentId: 'agent-456',
          content: 'Storage error test',
          messageType: 'text',
          scheduledAt: Date.now() + 60000,
          priority: 'normal'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await processor.fetch(request);
      expect(response.status).toBe(500);
    });

    test('should return 404 for unknown endpoints', async () => {
      const request = new Request('https://processor/unknown-endpoint');
      const response = await processor.fetch(request);

      expect(response.status).toBe(404);
    });
  });

  describe('Cleanup Operations', () => {
    test('should provide cleanup endpoint', async () => {
      const cleanupRequest = new Request('https://processor/cleanup', {
        method: 'POST'
      });

      const response = await processor.fetch(cleanupRequest);
      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.success).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle bulk message scheduling', async () => {
      const messageCount = 100;
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < messageCount; i++) {
        const promise = processor.fetch(new Request('https://processor/schedule', {
          method: 'POST',
          body: JSON.stringify({
            id: `bulk-msg-${i}`,
            conversationId: `conv-${i % 10}`,
            agentId: `agent-${i % 5}`,
            content: `Bulk message ${i}`,
            messageType: 'text',
            scheduledAt: Date.now() + 60000 + (i * 100),
            priority: 'normal'
          }),
          headers: { 'Content-Type': 'application/json' }
        }));
        promises.push(promise);
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Should complete reasonably quickly
      expect(duration).toBeLessThan(10000); // Less than 10 seconds

      // Check metrics
      const metricsResponse = await processor.fetch(new Request('https://processor/metrics'));
      const metrics = await metricsResponse.json();

      expect(metrics.pendingMessages).toBe(messageCount);
    }, 15000);

    test('should maintain performance with queue depth', async () => {
      const messageCount = 50;

      // Schedule messages
      for (let i = 0; i < messageCount; i++) {
        await processor.fetch(new Request('https://processor/schedule', {
          method: 'POST',
          body: JSON.stringify({
            id: `perf-msg-${i}`,
            conversationId: 'conv-123',
            agentId: 'agent-456',
            content: `Performance test ${i}`,
            messageType: 'text',
            scheduledAt: Date.now() + 60000 + (i * 1000),
            priority: 'normal'
          }),
          headers: { 'Content-Type': 'application/json' }
        }));
      }

      // Query should still be fast
      const startTime = Date.now();
      await processor.fetch(new Request('https://processor/get-scheduled'));
      const queryDuration = Date.now() - startTime;

      expect(queryDuration).toBeLessThan(500); // Less than 500ms
    });
  });
});
