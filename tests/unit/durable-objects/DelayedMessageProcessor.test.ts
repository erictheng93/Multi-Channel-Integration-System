// DelayedMessageProcessor Durable Object Unit Tests
// Tests scheduled message processing, countdown timers, and recall functionality

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DelayedMessageProcessor } from '../../../src/durable-objects/DelayedMessageProcessor';
import {
  DurableObjectsTestEnvironment,
  MockDurableObjectState,
  TestPerformanceMonitor
} from '../../helpers/websocket/durable-objects-test-env';
import {
  TestDataFactory,
  TestAssertions
} from '../../helpers/websocket/websocket-test-utils';
import type {
  DurableObjectEvent,
  DelayedMessage,
  DelayedMessageStatus
} from '../../../src/types/websocket-types';

describe('DelayedMessageProcessor Durable Object', () => {
  let testEnv: DurableObjectsTestEnvironment;
  let delayedMessageProcessor: DelayedMessageProcessor;
  let mockState: MockDurableObjectState;
  let mockEnv: any;
  let performanceMonitor: TestPerformanceMonitor;

  beforeEach(() => {
    testEnv = new DurableObjectsTestEnvironment();
    testEnv.registerDurableObject('DELAYED_MESSAGE_PROCESSOR', DelayedMessageProcessor);

    mockEnv = {
      MESSAGE_BROADCASTER: {
        idFromName: vi.fn((name: string) => ({ toString: () => name })),
        get: vi.fn(() => ({
          fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
        }))
      },
      REALTIME_QUEUE: {
        send: vi.fn().mockResolvedValue(undefined)
      },
      SESSIONS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      }
    };

    const namespace = testEnv.getNamespace('DELAYED_MESSAGE_PROCESSOR');
    const id = namespace.idFromName('global');
    mockState = new MockDurableObjectState(id);
    delayedMessageProcessor = new DelayedMessageProcessor(mockState, mockEnv);
    performanceMonitor = new TestPerformanceMonitor();
  });

  afterEach(() => {
    testEnv.reset();
    vi.clearAllMocks();
    performanceMonitor.clearMetrics();
  });

  describe('Delayed Message Scheduling', () => {
    it('should schedule delayed messages successfully', async () => {
      const delayedMessage: DelayedMessage = {
        id: 'delayed_msg_123',
        conversationId: 'conv_123',
        agentId: 'agent_456',
        content: 'This is a delayed message',
        messageType: 'text',
        delaySeconds: 30,
        scheduledAt: Date.now(),
        executeAt: Date.now() + (30 * 1000),
        status: 'scheduled',
        metadata: {
          priority: 'normal',
          source: 'agent_interface'
        }
      };

      const request = new Request('https://delayed-processor/schedule', {
        method: 'POST',
        body: JSON.stringify(delayedMessage),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await delayedMessageProcessor.fetch(request);

      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(delayedMessage.id);
      expect(result.executeAt).toBe(delayedMessage.executeAt);

      // Verify message was stored
      expect(mockState.storage.put).toHaveBeenCalledWith(
        `delayed:${delayedMessage.id}`,
        expect.objectContaining({
          id: delayedMessage.id,
          status: 'scheduled'
        })
      );
    });

    it('should validate delayed message parameters', async () => {
      const invalidMessage = {
        id: 'invalid_msg',
        conversationId: 'conv_123',
        // Missing required fields
        delaySeconds: -5 // Invalid delay
      };

      const request = new Request('https://delayed-processor/schedule', {
        method: 'POST',
        body: JSON.stringify(invalidMessage),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await delayedMessageProcessor.fetch(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toContain('Invalid delayed message');
    });

    it('should enforce delay limits', async () => {
      const messageTooLong: DelayedMessage = {
        id: 'too_long_msg',
        conversationId: 'conv_123',
        agentId: 'agent_456',
        content: 'Message with excessive delay',
        messageType: 'text',
        delaySeconds: 3600, // 1 hour - exceeds typical 120 second limit
        scheduledAt: Date.now(),
        executeAt: Date.now() + (3600 * 1000),
        status: 'scheduled'
      };

      const request = new Request('https://delayed-processor/schedule', {
        method: 'POST',
        body: JSON.stringify(messageTooLong),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await delayedMessageProcessor.fetch(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toContain('Delay exceeds maximum allowed');
    });

    it('should handle duplicate message IDs', async () => {
      const delayedMessage: DelayedMessage = {
        id: 'duplicate_msg',
        conversationId: 'conv_123',
        agentId: 'agent_456',
        content: 'First message',
        messageType: 'text',
        delaySeconds: 30,
        scheduledAt: Date.now(),
        executeAt: Date.now() + (30 * 1000),
        status: 'scheduled'
      };

      // Mock existing message in storage
      vi.spyOn(mockState.storage, 'get')
        .mockResolvedValue(delayedMessage);

      const request = new Request('https://delayed-processor/schedule', {
        method: 'POST',
        body: JSON.stringify(delayedMessage),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await delayedMessageProcessor.fetch(request);

      expect(response.status).toBe(409);
      expect(await response.text()).toContain('Message already exists');
    });
  });

  describe('Message Recall Functionality', () => {
    it('should recall scheduled messages successfully', async () => {
      const messageId = 'recall_test_msg';
      const agentId = 'agent_456';

      // Mock scheduled message in storage
      const scheduledMessage: DelayedMessage = {
        id: messageId,
        conversationId: 'conv_123',
        agentId,
        content: 'Message to be recalled',
        messageType: 'text',
        delaySeconds: 60,
        scheduledAt: Date.now(),
        executeAt: Date.now() + (60 * 1000),
        status: 'scheduled'
      };

      vi.spyOn(mockState.storage, 'get')
        .mockResolvedValue(scheduledMessage);

      const request = new Request('https://delayed-processor/recall', {
        method: 'POST',
        body: JSON.stringify({
          messageId,
          agentId,
          reason: 'User requested recall'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await delayedMessageProcessor.fetch(request);

      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(messageId);
      expect(result.status).toBe('recalled');

      // Verify message status was updated
      expect(mockState.storage.put).toHaveBeenCalledWith(
        `delayed:${messageId}`,
        expect.objectContaining({
          status: 'recalled',
          recalledAt: expect.any(Number),
          recallReason: 'User requested recall'
        })
      );

      // Verify recall event was broadcasted
      expect(mockEnv.MESSAGE_BROADCASTER.get).toHaveBeenCalled();
    });

    it('should prevent recall of already sent messages', async () => {
      const messageId = 'sent_msg';
      const agentId = 'agent_456';

      // Mock sent message in storage
      const sentMessage: DelayedMessage = {
        id: messageId,
        conversationId: 'conv_123',
        agentId,
        content: 'Already sent message',
        messageType: 'text',
        delaySeconds: 30,
        scheduledAt: Date.now() - 60000,
        executeAt: Date.now() - 30000,
        status: 'sent',
        sentAt: Date.now() - 30000
      };

      vi.spyOn(mockState.storage, 'get')
        .mockResolvedValue(sentMessage);

      const request = new Request('https://delayed-processor/recall', {
        method: 'POST',
        body: JSON.stringify({
          messageId,
          agentId
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await delayedMessageProcessor.fetch(request);

      expect(response.status).toBe(409);
      expect(await response.text()).toContain('Message cannot be recalled');
    });

    it('should validate recall permissions', async () => {
      const messageId = 'permission_test_msg';
      const scheduledMessage: DelayedMessage = {
        id: messageId,
        conversationId: 'conv_123',
        agentId: 'original_agent',
        content: 'Message by original agent',
        messageType: 'text',
        delaySeconds: 60,
        scheduledAt: Date.now(),
        executeAt: Date.now() + (60 * 1000),
        status: 'scheduled'
      };

      vi.spyOn(mockState.storage, 'get')
        .mockResolvedValue(scheduledMessage);

      const request = new Request('https://delayed-processor/recall', {
        method: 'POST',
        body: JSON.stringify({
          messageId,
          agentId: 'different_agent' // Different agent trying to recall
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await delayedMessageProcessor.fetch(request);

      expect(response.status).toBe(403);
      expect(await response.text()).toContain('Permission denied');
    });

    it('should handle recall of non-existent messages', async () => {
      const messageId = 'non_existent_msg';

      vi.spyOn(mockState.storage, 'get')
        .mockResolvedValue(null);

      const request = new Request('https://delayed-processor/recall', {
        method: 'POST',
        body: JSON.stringify({
          messageId,
          agentId: 'agent_456'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await delayedMessageProcessor.fetch(request);

      expect(response.status).toBe(404);
      expect(await response.text()).toContain('Message not found');
    });
  });

  describe('Countdown Timer Broadcasting', () => {
    it('should broadcast countdown events', async () => {
      const delayedMessage: DelayedMessage = {
        id: 'countdown_msg',
        conversationId: 'conv_123',
        agentId: 'agent_456',
        content: 'Countdown test message',
        messageType: 'text',
        delaySeconds: 10,
        scheduledAt: Date.now(),
        executeAt: Date.now() + (10 * 1000),
        status: 'scheduled'
      };

      // Add message to processor
      (delayedMessageProcessor as any).scheduledMessages.set(delayedMessage.id, delayedMessage);

      // Mock broadcastCountdown method
      const broadcastSpy = vi.spyOn(delayedMessageProcessor as any, 'broadcastCountdown')
        .mockResolvedValue(undefined);

      // Trigger countdown processing
      await (delayedMessageProcessor as any).processCountdowns();

      expect(broadcastSpy).toHaveBeenCalledWith(
        delayedMessage,
        expect.any(Number) // remaining seconds
      );
    });

    it('should stop countdown on message recall', async () => {
      const messageId = 'recall_countdown_msg';
      const delayedMessage: DelayedMessage = {
        id: messageId,
        conversationId: 'conv_123',
        agentId: 'agent_456',
        content: 'Message with countdown to be recalled',
        messageType: 'text',
        delaySeconds: 30,
        scheduledAt: Date.now(),
        executeAt: Date.now() + (30 * 1000),
        status: 'scheduled'
      };

      // Add message to processor
      (delayedMessageProcessor as any).scheduledMessages.set(messageId, delayedMessage);

      // Mock storage
      vi.spyOn(mockState.storage, 'get')
        .mockResolvedValue(delayedMessage);

      // Recall the message
      const recallRequest = new Request('https://delayed-processor/recall', {
        method: 'POST',
        body: JSON.stringify({
          messageId,
          agentId: delayedMessage.agentId
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      await delayedMessageProcessor.fetch(recallRequest);

      // Verify countdown stopped
      const messages = (delayedMessageProcessor as any).scheduledMessages;
      const updatedMessage = messages.get(messageId);
      expect(updatedMessage?.status).toBe('recalled');
    });

    it('should handle countdown broadcast failures gracefully', async () => {
      const delayedMessage: DelayedMessage = {
        id: 'failing_countdown_msg',
        conversationId: 'conv_123',
        agentId: 'agent_456',
        content: 'Message with failing countdown',
        messageType: 'text',
        delaySeconds: 10,
        scheduledAt: Date.now(),
        executeAt: Date.now() + (10 * 1000),
        status: 'scheduled'
      };

      // Mock broadcast failure
      mockEnv.MESSAGE_BROADCASTER.get.mockReturnValue({
        fetch: vi.fn().mockRejectedValue(new Error('Broadcast failed'))
      });

      // Add message to processor
      (delayedMessageProcessor as any).scheduledMessages.set(delayedMessage.id, delayedMessage);

      // Should not throw on broadcast failure
      await expect((delayedMessageProcessor as any).processCountdowns())
        .resolves.not.toThrow();
    });
  });

  describe('Message Execution', () => {
    it('should execute scheduled messages at correct time', async () => {
      const delayedMessage: DelayedMessage = {
        id: 'execute_msg',
        conversationId: 'conv_123',
        agentId: 'agent_456',
        content: 'Message to be executed',
        messageType: 'text',
        delaySeconds: 1, // Very short delay for testing
        scheduledAt: Date.now(),
        executeAt: Date.now() + 1000,
        status: 'scheduled'
      };

      // Add message to processor
      (delayedMessageProcessor as any).scheduledMessages.set(delayedMessage.id, delayedMessage);

      // Mock message execution
      const executeSpy = vi.spyOn(delayedMessageProcessor as any, 'executeMessage')
        .mockResolvedValue(true);

      // Wait for execution time
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Process pending messages
      await (delayedMessageProcessor as any).processPendingMessages();

      expect(executeSpy).toHaveBeenCalledWith(delayedMessage);
    });

    it('should send messages to queue for delivery', async () => {
      const delayedMessage: DelayedMessage = {
        id: 'queue_msg',
        conversationId: 'conv_123',
        agentId: 'agent_456',
        content: 'Message for queue delivery',
        messageType: 'text',
        delaySeconds: 30,
        scheduledAt: Date.now(),
        executeAt: Date.now() + (30 * 1000),
        status: 'scheduled'
      };

      await (delayedMessageProcessor as any).executeMessage(delayedMessage);

      // Verify message was sent to queue
      expect(mockEnv.REALTIME_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'delayed_message_execute',
          messageId: delayedMessage.id,
          conversationId: delayedMessage.conversationId,
          agentId: delayedMessage.agentId
        })
      );

      // Verify message status was updated
      expect(mockState.storage.put).toHaveBeenCalledWith(
        `delayed:${delayedMessage.id}`,
        expect.objectContaining({
          status: 'sent',
          sentAt: expect.any(Number)
        })
      );
    });

    it('should handle execution failures', async () => {
      const delayedMessage: DelayedMessage = {
        id: 'failing_msg',
        conversationId: 'conv_123',
        agentId: 'agent_456',
        content: 'Message that will fail',
        messageType: 'text',
        delaySeconds: 30,
        scheduledAt: Date.now(),
        executeAt: Date.now() + (30 * 1000),
        status: 'scheduled'
      };

      // Mock queue send failure
      mockEnv.REALTIME_QUEUE.send.mockRejectedValue(new Error('Queue unavailable'));

      await (delayedMessageProcessor as any).executeMessage(delayedMessage);

      // Verify message status was updated to failed
      expect(mockState.storage.put).toHaveBeenCalledWith(
        `delayed:${delayedMessage.id}`,
        expect.objectContaining({
          status: 'failed',
          failedAt: expect.any(Number),
          error: 'Queue unavailable'
        })
      );
    });

    it('should retry failed executions', async () => {
      const delayedMessage: DelayedMessage = {
        id: 'retry_msg',
        conversationId: 'conv_123',
        agentId: 'agent_456',
        content: 'Message to retry',
        messageType: 'text',
        delaySeconds: 30,
        scheduledAt: Date.now(),
        executeAt: Date.now() + (30 * 1000),
        status: 'scheduled',
        retryCount: 0
      };

      // Mock queue send failure first, then success
      mockEnv.REALTIME_QUEUE.send
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(undefined);

      // First execution attempt (should fail)
      await (delayedMessageProcessor as any).executeMessage(delayedMessage);

      // Second execution attempt (should succeed)
      const updatedMessage = { ...delayedMessage, status: 'failed' as DelayedMessageStatus, retryCount: 1 };
      await (delayedMessageProcessor as any).executeMessage(updatedMessage);

      // Verify retry was attempted
      expect(mockEnv.REALTIME_QUEUE.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of scheduled messages', async () => {
      const messageCount = 1000;
      const messages: DelayedMessage[] = [];

      performanceMonitor.startTimer('bulk_scheduling');

      // Schedule many messages
      for (let i = 0; i < messageCount; i++) {
        const message: DelayedMessage = {
          id: `bulk_msg_${i}`,
          conversationId: `conv_${i % 10}`,
          agentId: `agent_${i % 5}`,
          content: `Bulk message ${i}`,
          messageType: 'text',
          delaySeconds: 30 + (i % 60), // 30-90 seconds
          scheduledAt: Date.now(),
          executeAt: Date.now() + ((30 + (i % 60)) * 1000),
          status: 'scheduled'
        };

        messages.push(message);

        const request = new Request('https://delayed-processor/schedule', {
          method: 'POST',
          body: JSON.stringify(message),
          headers: { 'Content-Type': 'application/json' }
        });

        await delayedMessageProcessor.fetch(request);
      }

      const duration = performanceMonitor.endTimer('bulk_scheduling');

      // Performance assertions
      const throughput = messageCount / (duration / 1000);
      expect(throughput).toBeGreaterThan(50); // At least 50 messages per second

      // Verify all messages were scheduled
      const scheduledMessages = (delayedMessageProcessor as any).scheduledMessages;
      expect(scheduledMessages.size).toBe(messageCount);
    });

    it('should efficiently process countdown updates', async () => {
      const messageCount = 100;

      // Add multiple messages with different countdown timers
      for (let i = 0; i < messageCount; i++) {
        const message: DelayedMessage = {
          id: `countdown_msg_${i}`,
          conversationId: `conv_${i % 5}`,
          agentId: `agent_${i % 3}`,
          content: `Countdown message ${i}`,
          messageType: 'text',
          delaySeconds: 10 + (i % 20), // 10-30 seconds
          scheduledAt: Date.now(),
          executeAt: Date.now() + ((10 + (i % 20)) * 1000),
          status: 'scheduled'
        };

        (delayedMessageProcessor as any).scheduledMessages.set(message.id, message);
      }

      performanceMonitor.startTimer('countdown_processing');

      // Process all countdowns
      await (delayedMessageProcessor as any).processCountdowns();

      const duration = performanceMonitor.endTimer('countdown_processing');

      // Should process all countdowns efficiently
      expect(duration).toBeLessThan(5000); // Less than 5 seconds

      const metrics = performanceMonitor.getMetrics('countdown_processing');
      expect(metrics.average).toBeLessThan(100); // Less than 100ms average
    });

    it('should handle concurrent recall requests', async () => {
      const messageCount = 50;
      const messages: DelayedMessage[] = [];

      // Create scheduled messages
      for (let i = 0; i < messageCount; i++) {
        const message: DelayedMessage = {
          id: `concurrent_msg_${i}`,
          conversationId: `conv_${i % 10}`,
          agentId: `agent_${i % 5}`,
          content: `Concurrent message ${i}`,
          messageType: 'text',
          delaySeconds: 60,
          scheduledAt: Date.now(),
          executeAt: Date.now() + (60 * 1000),
          status: 'scheduled'
        };

        messages.push(message);
        (delayedMessageProcessor as any).scheduledMessages.set(message.id, message);

        // Mock storage
        vi.spyOn(mockState.storage, 'get')
          .mockImplementation(async (key: string) => {
            const messageId = key.replace('delayed:', '');
            return messages.find(m => m.id === messageId) || null;
          });
      }

      // Attempt to recall all messages concurrently
      const recallPromises = messages.map(message => {
        const request = new Request('https://delayed-processor/recall', {
          method: 'POST',
          body: JSON.stringify({
            messageId: message.id,
            agentId: message.agentId
          }),
          headers: { 'Content-Type': 'application/json' }
        });

        return delayedMessageProcessor.fetch(request);
      });

      const responses = await Promise.all(recallPromises);

      // All recalls should succeed
      expect(responses.every(r => r.ok)).toBe(true);
    });
  });

  describe('Monitoring and Metrics', () => {
    it('should provide processing metrics', async () => {
      const request = new Request('https://delayed-processor/metrics');
      const response = await delayedMessageProcessor.fetch(request);

      expect(response.ok).toBe(true);

      const metrics = await response.json();
      expect(metrics).toHaveProperty('scheduledCount');
      expect(metrics).toHaveProperty('sentCount');
      expect(metrics).toHaveProperty('recalledCount');
      expect(metrics).toHaveProperty('failedCount');
      expect(metrics).toHaveProperty('averageDelay');
      expect(metrics).toHaveProperty('processingLatency');
      expect(metrics).toHaveProperty('uptime');
    });

    it('should track recall success rates', async () => {
      const messageCount = 20;
      const messages: DelayedMessage[] = [];

      // Create and schedule messages
      for (let i = 0; i < messageCount; i++) {
        const message: DelayedMessage = {
          id: `recall_metric_msg_${i}`,
          conversationId: 'conv_123',
          agentId: 'agent_456',
          content: `Recall metrics message ${i}`,
          messageType: 'text',
          delaySeconds: 60,
          scheduledAt: Date.now(),
          executeAt: Date.now() + (60 * 1000),
          status: 'scheduled'
        };

        messages.push(message);
        (delayedMessageProcessor as any).scheduledMessages.set(message.id, message);
      }

      // Mock storage
      vi.spyOn(mockState.storage, 'get')
        .mockImplementation(async (key: string) => {
          const messageId = key.replace('delayed:', '');
          return messages.find(m => m.id === messageId) || null;
        });

      // Recall half the messages
      const recallCount = messageCount / 2;
      for (let i = 0; i < recallCount; i++) {
        const message = messages[i];
        const request = new Request('https://delayed-processor/recall', {
          method: 'POST',
          body: JSON.stringify({
            messageId: message.id,
            agentId: message.agentId
          }),
          headers: { 'Content-Type': 'application/json' }
        });

        await delayedMessageProcessor.fetch(request);
      }

      // Check metrics
      const metricsRequest = new Request('https://delayed-processor/metrics');
      const metricsResponse = await delayedMessageProcessor.fetch(metricsRequest);
      const metrics = await metricsResponse.json();

      expect(metrics.recalledCount).toBe(recallCount);
      expect(metrics.recallSuccessRate).toBeCloseTo(100); // All recalls should succeed
    });

    it('should monitor processing performance', async () => {
      // Add messages to monitor processing time
      const delayedMessage: DelayedMessage = {
        id: 'performance_msg',
        conversationId: 'conv_123',
        agentId: 'agent_456',
        content: 'Performance monitoring message',
        messageType: 'text',
        delaySeconds: 1,
        scheduledAt: Date.now(),
        executeAt: Date.now() + 1000,
        status: 'scheduled'
      };

      const startTime = Date.now();

      const request = new Request('https://delayed-processor/schedule', {
        method: 'POST',
        body: JSON.stringify(delayedMessage),
        headers: { 'Content-Type': 'application/json' }
      });

      await delayedMessageProcessor.fetch(request);

      const schedulingTime = Date.now() - startTime;

      // Should schedule quickly
      expect(schedulingTime).toBeLessThan(100); // Less than 100ms

      // Check processing metrics
      const metricsRequest = new Request('https://delayed-processor/metrics');
      const metricsResponse = await delayedMessageProcessor.fetch(metricsRequest);
      const metrics = await metricsResponse.json();

      expect(metrics.averageSchedulingTime).toBeDefined();
      expect(metrics.averageSchedulingTime).toBeLessThan(100);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle storage failures gracefully', async () => {
      const delayedMessage: DelayedMessage = {
        id: 'storage_fail_msg',
        conversationId: 'conv_123',
        agentId: 'agent_456',
        content: 'Message with storage failure',
        messageType: 'text',
        delaySeconds: 30,
        scheduledAt: Date.now(),
        executeAt: Date.now() + (30 * 1000),
        status: 'scheduled'
      };

      // Mock storage failure
      vi.spyOn(mockState.storage, 'put')
        .mockRejectedValue(new Error('Storage unavailable'));

      const request = new Request('https://delayed-processor/schedule', {
        method: 'POST',
        body: JSON.stringify(delayedMessage),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await delayedMessageProcessor.fetch(request);

      expect(response.status).toBe(500);
      expect(await response.text()).toContain('Failed to schedule message');
    });

    it('should recover from broadcast failures', async () => {
      const delayedMessage: DelayedMessage = {
        id: 'broadcast_fail_msg',
        conversationId: 'conv_123',
        agentId: 'agent_456',
        content: 'Message with broadcast failure',
        messageType: 'text',
        delaySeconds: 10,
        scheduledAt: Date.now(),
        executeAt: Date.now() + (10 * 1000),
        status: 'scheduled'
      };

      // Mock broadcast failure
      mockEnv.MESSAGE_BROADCASTER.get.mockReturnValue({
        fetch: vi.fn().mockRejectedValue(new Error('Broadcast service unavailable'))
      });

      // Add message to processor
      (delayedMessageProcessor as any).scheduledMessages.set(delayedMessage.id, delayedMessage);

      // Should continue processing despite broadcast failures
      await expect((delayedMessageProcessor as any).processCountdowns())
        .resolves.not.toThrow();

      // Message should still be scheduled
      const messages = (delayedMessageProcessor as any).scheduledMessages;
      expect(messages.has(delayedMessage.id)).toBe(true);
    });

    it('should handle malformed requests', async () => {
      const request = new Request('https://delayed-processor/schedule', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await delayedMessageProcessor.fetch(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toContain('Invalid request');
    });
  });
});