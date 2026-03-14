/**
 * Unit Tests for P1 Optimization: Batch Broadcasting
 *
 * Tests the batch queueing mechanism that reduces DO calls by 60%
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import type { Bindings } from '@/types';
import type { DurableObjectEvent } from '@/types/websocket-types';

describe('WebSocket Broadcast Service - P1 Batch Optimization', () => {
  let service: WebSocketBroadcastService;
  let mockEnv: Partial<Bindings>;

  beforeEach(() => {
    // Mock environment bindings
    mockEnv = {
      CONVERSATION_ROOM: {
        idFromName: vi.fn().mockReturnValue('mock-room-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue({ ok: true })
        })
      } as any,
      USER_CONNECTION: {
        idFromName: vi.fn().mockReturnValue('mock-user-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue({ ok: true })
        })
      } as any,
      MESSAGE_BROADCASTER: {
        idFromName: vi.fn().mockReturnValue('mock-broadcaster-id'),
        get: vi.fn().mockReturnValue({
          fetch: vi.fn().mockResolvedValue({ ok: true })
        })
      } as any,
      SESSIONS: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined)
      } as any
    };

    // Create service instance with batching enabled
    service = new WebSocketBroadcastService(mockEnv as Bindings, {
      enabled: true,
      maxBatchSize: 5,
      batchWindowMs: 100,  // Short window for testing
      urgentBypass: true
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  describe('Batch Queue Mechanism', () => {
    it('should enqueue normal priority events', async () => {
      const event = {
        type: 'message_sent' as const,
        conversationId: 'conv-001',
        messageId: 'msg-001',
        agentId: 'agent-001',
        data: { content: 'Test message' },
        priority: 'normal' as const
      };

      const result = await service.broadcastMessageEvent(event);
      expect(result).toBe(true);

      const status = service.getBatchQueueStatus();
      expect(status.queueSize).toBe(1);
      expect(status.timerActive).toBe(true);
    });

    it('should bypass batching for urgent events', async () => {
      const urgentEvent = {
        type: 'message_sent' as const,
        conversationId: 'conv-001',
        messageId: 'msg-urgent',
        agentId: 'agent-001',
        data: { content: 'Urgent!' },
        priority: 'urgent' as const
      };

      const result = await service.broadcastMessageEvent(urgentEvent);
      expect(result).toBe(true);

      const status = service.getBatchQueueStatus();
      expect(status.queueSize).toBe(0); // Should not be queued
      expect(status.metrics.immediateEvents).toBe(1);
    });

    it('should flush batch when max size reached', async () => {
      // Send 5 events (maxBatchSize = 5)
      for (let i = 0; i < 5; i++) {
        await service.broadcastMessageEvent({
          type: 'message_sent',
          conversationId: 'conv-001',
          messageId: `msg-${i}`,
          agentId: 'agent-001',
          data: { content: `Message ${i}` },
          priority: 'normal'
        });
      }

      // Queue should be flushed when 5th event is added
      const status = service.getBatchQueueStatus();
      expect(status.queueSize).toBe(0);
      expect(status.metrics.batchesSent).toBeGreaterThan(0);
    });

    it('should flush batch after timeout', async () => {
      vi.useFakeTimers();

      try {
        await service.broadcastMessageEvent({
          type: 'message_sent',
          conversationId: 'conv-001',
          messageId: 'msg-001',
          agentId: 'agent-001',
          data: { content: 'Test' },
          priority: 'normal'
        });

        let status = service.getBatchQueueStatus();
        expect(status.queueSize).toBe(1);

        // Fast-forward time
        await vi.advanceTimersByTimeAsync(100);

        status = service.getBatchQueueStatus();
        expect(status.queueSize).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should handle multiple batches correctly', async () => {
      // Send 12 events (will create 3 batches: 5 + 5 + 2)
      for (let i = 0; i < 12; i++) {
        await service.broadcastMessageEvent({
          type: 'message_sent',
          conversationId: 'conv-001',
          messageId: `msg-${i}`,
          agentId: 'agent-001',
          data: { content: `Message ${i}` },
          priority: 'normal'
        });
      }

      const status = service.getBatchQueueStatus();
      expect(status.metrics.totalEvents).toBe(12);
      expect(status.metrics.batchesSent).toBeGreaterThan(0);
    });
  });

  describe('Configuration Management', () => {
    it('should allow runtime config updates', () => {
      service.updateBatchConfig({
        maxBatchSize: 10,
        batchWindowMs: 200
      });

      const status = service.getBatchQueueStatus();
      expect(status.config.maxBatchSize).toBe(10);
      expect(status.config.batchWindowMs).toBe(200);
    });

    it('should flush queue when batching disabled', async () => {
      // Add event to queue
      await service.broadcastMessageEvent({
        type: 'message_sent',
        conversationId: 'conv-001',
        messageId: 'msg-001',
        agentId: 'agent-001',
        data: { content: 'Test' },
        priority: 'normal'
      });

      let status = service.getBatchQueueStatus();
      expect(status.queueSize).toBe(1);

      // Disable batching
      service.updateBatchConfig({ enabled: false });

      status = service.getBatchQueueStatus();
      expect(status.queueSize).toBe(0);
    });
  });

  describe('Manual Flush', () => {
    it('should allow manual queue flush', async () => {
      // Add events to queue
      await service.broadcastMessageEvent({
        type: 'message_sent',
        conversationId: 'conv-001',
        messageId: 'msg-001',
        agentId: 'agent-001',
        data: { content: 'Test 1' },
        priority: 'normal'
      });

      await service.broadcastMessageEvent({
        type: 'message_sent',
        conversationId: 'conv-001',
        messageId: 'msg-002',
        agentId: 'agent-001',
        data: { content: 'Test 2' },
        priority: 'normal'
      });

      let status = service.getBatchQueueStatus();
      expect(status.queueSize).toBe(2);

      // Manual flush
      await service.manualFlush();

      status = service.getBatchQueueStatus();
      expect(status.queueSize).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should track batch statistics correctly', async () => {
      // Send mix of urgent and normal events
      for (let i = 0; i < 3; i++) {
        await service.broadcastMessageEvent({
          type: 'message_sent',
          conversationId: 'conv-001',
          messageId: `msg-normal-${i}`,
          agentId: 'agent-001',
          data: { content: `Normal ${i}` },
          priority: 'normal'
        });
      }

      for (let i = 0; i < 2; i++) {
        await service.broadcastMessageEvent({
          type: 'message_sent',
          conversationId: 'conv-001',
          messageId: `msg-urgent-${i}`,
          agentId: 'agent-001',
          data: { content: `Urgent ${i}` },
          priority: 'urgent'
        });
      }

      const status = service.getBatchQueueStatus();
      expect(status.metrics.totalEvents).toBe(5);
      expect(status.metrics.immediateEvents).toBe(2);  // Urgent events
      expect(status.metrics.batchedEvents).toBe(3); // Normal events
    });

    it('should calculate average batch size', async () => {
      vi.useFakeTimers();

      try {
        // First batch: 3 events
        for (let i = 0; i < 3; i++) {
          await service.broadcastMessageEvent({
            type: 'message_sent',
            conversationId: 'conv-001',
            messageId: `msg-batch1-${i}`,
            agentId: 'agent-001',
            data: { content: `Batch1 ${i}` },
            priority: 'normal'
          });
        }

        await vi.advanceTimersByTimeAsync(100);

        // Second batch: 2 events
        for (let i = 0; i < 2; i++) {
          await service.broadcastMessageEvent({
            type: 'message_sent',
            conversationId: 'conv-001',
            messageId: `msg-batch2-${i}`,
            agentId: 'agent-001',
            data: { content: `Batch2 ${i}` },
            priority: 'normal'
          });
        }

        await vi.advanceTimersByTimeAsync(100);

        const status = service.getBatchQueueStatus();
        expect(status.metrics.batchesSent).toBeGreaterThan(0);
        // Average of 3 and 2 should be ~2.5, rounded to 2 or 3
        expect(status.metrics.avgBatchSize).toBeGreaterThan(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queue flush gracefully', async () => {
      await service.manualFlush();
      const status = service.getBatchQueueStatus();
      expect(status.queueSize).toBe(0);
    });

    it('should handle rapid event bursts', async () => {
      // Simulate 20 events sent rapidly
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          service.broadcastMessageEvent({
            type: 'message_sent',
            conversationId: 'conv-001',
            messageId: `msg-${i}`,
            agentId: 'agent-001',
            data: { content: `Rapid ${i}` },
            priority: 'normal'
          })
        );
      }

      await Promise.all(promises);

      const status = service.getBatchQueueStatus();
      expect(status.metrics.totalEvents).toBe(20);
      expect(status.metrics.batchesSent).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with batching disabled', async () => {
      const serviceNoBatch = new WebSocketBroadcastService(mockEnv as Bindings, {
        enabled: false
      });

      const result = await serviceNoBatch.broadcastMessageEvent({
        type: 'message_sent',
        conversationId: 'conv-001',
        messageId: 'msg-001',
        agentId: 'agent-001',
        data: { content: 'Test' },
        priority: 'normal'
      });

      expect(result).toBe(true);

      const status = serviceNoBatch.getBatchQueueStatus();
      expect(status.queueSize).toBe(0);
      expect(status.metrics.immediateEvents).toBe(1);
    });
  });
});
