// MessageBroadcaster Durable Object Unit Tests
// Tests efficient event distribution, batch processing, and performance monitoring

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageBroadcaster } from '@backend/durable-objects/MessageBroadcaster';
import {
  DurableObjectsTestEnvironment,
  MockDurableObjectState,
  TestPerformanceMonitor
} from '../../helpers/websocket/durable-objects-test-env';
import {
  TestDataFactory,
  TestAssertions,
  LoadTestHelper
} from '../../helpers/websocket/websocket-test-utils';
import type {
  DurableObjectEvent,
  BroadcastTarget,
  WebSocketMessage
} from '@backend/types/websocket-types';

describe('MessageBroadcaster Durable Object', () => {
  let testEnv: DurableObjectsTestEnvironment;
  let messageBroadcaster: MessageBroadcaster;
  let mockState: MockDurableObjectState;
  let mockEnv: any;
  let performanceMonitor: TestPerformanceMonitor;

  beforeEach(() => {
    testEnv = new DurableObjectsTestEnvironment();
    testEnv.registerDurableObject('MESSAGE_BROADCASTER', MessageBroadcaster);

    mockEnv = {
      CONVERSATION_ROOM: {
        idFromName: vi.fn((name: string) => ({ toString: () => name })),
        get: vi.fn(() => ({
          fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
        }))
      },
      USER_CONNECTION: {
        idFromName: vi.fn((name: string) => ({ toString: () => name })),
        get: vi.fn(() => ({
          fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
        }))
      },
      DB: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([])
            })
          })
        })
      },
      SESSIONS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      }
    };

    const namespace = testEnv.getNamespace('MESSAGE_BROADCASTER');
    const id = namespace.idFromName('global');
    mockState = new MockDurableObjectState(id);
    messageBroadcaster = new MessageBroadcaster(mockState, mockEnv);
    performanceMonitor = new TestPerformanceMonitor();
  });

  afterEach(() => {
    testEnv.reset();
    vi.clearAllMocks();
    performanceMonitor.clearMetrics();
  });

  describe('Event Distribution', () => {
    it('should distribute events to conversation rooms', async () => {
      const event = TestDataFactory.createEvent({
        type: 'message_sent',
        conversationId: 'conv_123',
        data: { content: 'Test message' }
      });

      const target: BroadcastTarget = {
        type: 'conversation',
        targets: ['conv_123', 'conv_456'],
        priority: 'normal'
      };

      const request = new Request('https://message-broadcaster/broadcast-to-conversations', {
        method: 'POST',
        body: JSON.stringify({ event, targets: target.targets }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await messageBroadcaster.fetch(request);

      expect(response.ok).toBe(true);

      // Verify calls to conversation rooms
      expect(mockEnv.CONVERSATION_ROOM.idFromName).toHaveBeenCalledWith('conv_123');
      expect(mockEnv.CONVERSATION_ROOM.idFromName).toHaveBeenCalledWith('conv_456');
    });

    it('should distribute events to user connections', async () => {
      const event = TestDataFactory.createEvent({
        type: 'user_notification',
        userId: 'user_123',
        data: { message: 'You have a new message' }
      });

      const request = new Request('https://message-broadcaster/broadcast-to-users', {
        method: 'POST',
        body: JSON.stringify({
          event,
          userIds: ['user_123', 'user_456']
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await messageBroadcaster.fetch(request);

      expect(response.ok).toBe(true);

      // Verify calls to user connections
      expect(mockEnv.USER_CONNECTION.idFromName).toHaveBeenCalledWith('user_123');
      expect(mockEnv.USER_CONNECTION.idFromName).toHaveBeenCalledWith('user_456');
    });

    it('should distribute events to team members', async () => {
      const event = TestDataFactory.createEvent({
        type: 'team_notification',
        data: { message: 'New team assignment' }
      });

      // Mock database query for team members
      mockEnv.DB.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([
              { id: 'user_1', name: 'User 1' },
              { id: 'user_2', name: 'User 2' }
            ])
          })
        })
      });

      const request = new Request('https://message-broadcaster/broadcast-to-teams', {
        method: 'POST',
        body: JSON.stringify({
          event,
          teamIds: [1, 2]
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await messageBroadcaster.fetch(request);

      expect(response.ok).toBe(true);

      // Verify database query for team members
      expect(mockEnv.DB.select).toHaveBeenCalled();
    });

    it('should handle global broadcasts', async () => {
      const event = TestDataFactory.createEvent({
        type: 'system_announcement',
        data: { message: 'System maintenance scheduled' }
      });

      const target: BroadcastTarget = {
        type: 'global',
        targets: ['admin'],
        filters: {
          roles: ['admin']
        }
      };

      // Mock database query for admins
      mockEnv.DB.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([
              { id: 'admin_1', role: 'admin' },
              { id: 'admin_2', role: 'admin' }
            ])
          })
        })
      });

      const request = new Request('https://message-broadcaster/broadcast-global', {
        method: 'POST',
        body: JSON.stringify({ event, target }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await messageBroadcaster.fetch(request);

      expect(response.ok).toBe(true);
    });

    it('should track distribution metrics', async () => {
      const event = TestDataFactory.createEvent({
        type: 'performance_test',
        data: { test: true }
      });

      performanceMonitor.startTimer('broadcast_distribution');

      const request = new Request('https://message-broadcaster/broadcast-to-conversations', {
        method: 'POST',
        body: JSON.stringify({
          event,
          targets: ['conv_1', 'conv_2', 'conv_3']
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      await messageBroadcaster.fetch(request);

      const duration = performanceMonitor.endTimer('broadcast_distribution');

      expect(duration).toBeDefined();
      expect(duration).toBeGreaterThan(0);

      const metrics = performanceMonitor.getMetrics('broadcast_distribution');
      expect(metrics.count).toBe(1);
      expect(metrics.average).toBe(duration);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple events in batch', async () => {
      const events = [
        TestDataFactory.createEvent({ type: 'message_sent', conversationId: 'conv_1' }),
        TestDataFactory.createEvent({ type: 'message_sent', conversationId: 'conv_1' }),
        TestDataFactory.createEvent({ type: 'message_sent', conversationId: 'conv_2' })
      ];

      const request = new Request('https://message-broadcaster/batch-broadcast', {
        method: 'POST',
        body: JSON.stringify({
          events,
          targets: [
            { type: 'conversation', targets: ['conv_1'] },
            { type: 'conversation', targets: ['conv_2'] }
          ]
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await messageBroadcaster.fetch(request);

      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('failed');
    });

    it('should optimize batch processing for same targets', async () => {
      const events = Array.from({ length: 10 }, (_, i) =>
        TestDataFactory.createEvent({
          type: 'message_sent',
          conversationId: 'conv_same',
          data: { messageIndex: i }
        })
      );

      performanceMonitor.startTimer('batch_optimization');

      const request = new Request('https://message-broadcaster/batch-broadcast', {
        method: 'POST',
        body: JSON.stringify({
          events,
          targets: [{ type: 'conversation', targets: ['conv_same'] }]
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      await messageBroadcaster.fetch(request);

      const duration = performanceMonitor.endTimer('batch_optimization');

      // Should be efficient - single target, multiple events
      expect(duration).toBeLessThan(1000); // Less than 1 second for 10 events

      // Should only call conversation room once for batch
      expect(mockEnv.CONVERSATION_ROOM.idFromName).toHaveBeenCalledTimes(1);
    });

    it('should handle batch processing errors gracefully', async () => {
      // Mock one successful and one failing target
      mockEnv.CONVERSATION_ROOM.get
        .mockReturnValueOnce({
          fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
        })
        .mockReturnValueOnce({
          fetch: vi.fn().mockRejectedValue(new Error('Connection failed'))
        });

      const events = [
        TestDataFactory.createEvent({ conversationId: 'conv_good' }),
        TestDataFactory.createEvent({ conversationId: 'conv_bad' })
      ];

      const request = new Request('https://message-broadcaster/batch-broadcast', {
        method: 'POST',
        body: JSON.stringify({
          events,
          targets: [
            { type: 'conversation', targets: ['conv_good'] },
            { type: 'conversation', targets: ['conv_bad'] }
          ]
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await messageBroadcaster.fetch(request);

      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.successful).toBeGreaterThan(0);
      expect(result.failed).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics', async () => {
      const request = new Request('https://message-broadcaster/metrics');
      const response = await messageBroadcaster.fetch(request);

      expect(response.ok).toBe(true);

      const metrics = await response.json();
      expect(metrics).toHaveProperty('totalEvents');
      expect(metrics).toHaveProperty('successfulBroadcasts');
      expect(metrics).toHaveProperty('failedBroadcasts');
      expect(metrics).toHaveProperty('averageLatency');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('memoryUsage');
    });

    it('should monitor latency distribution', async () => {
      // Send multiple events to collect latency data
      const eventCount = 20;
      const promises: Promise<Response>[] = [];

      for (let i = 0; i < eventCount; i++) {
        const event = TestDataFactory.createEvent({
          type: 'latency_test',
          data: { index: i }
        });

        const request = new Request('https://message-broadcaster/broadcast-to-conversations', {
          method: 'POST',
          body: JSON.stringify({
            event,
            targets: [`conv_${i}`]
          }),
          headers: { 'Content-Type': 'application/json' }
        });

        promises.push(messageBroadcaster.fetch(request));
      }

      await Promise.all(promises);

      // Get metrics after processing events
      const metricsRequest = new Request('https://message-broadcaster/metrics');
      const metricsResponse = await messageBroadcaster.fetch(metricsRequest);
      const metrics = await metricsResponse.json();

      expect(metrics.totalEvents).toBeGreaterThanOrEqual(eventCount);
      expect(metrics.averageLatency).toBeGreaterThan(0);
    });

    it('should track throughput metrics', async () => {
      const startTime = Date.now();
      const eventCount = 50;

      // Send events rapidly
      const promises = Array.from({ length: eventCount }, (_, i) => {
        const event = TestDataFactory.createEvent({
          type: 'throughput_test',
          data: { index: i }
        });

        const request = new Request('https://message-broadcaster/broadcast-to-conversations', {
          method: 'POST',
          body: JSON.stringify({
            event,
            targets: [`conv_${i % 5}`] // Distribute across 5 conversations
          }),
          headers: { 'Content-Type': 'application/json' }
        });

        return messageBroadcaster.fetch(request);
      });

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      const throughput = eventCount / (duration / 1000); // events per second

      expect(throughput).toBeGreaterThan(10); // At least 10 events per second
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle Durable Object unavailability', async () => {
      // Mock all conversation room stubs to return null
      mockEnv.CONVERSATION_ROOM.get.mockReturnValue(null);

      const event = TestDataFactory.createEvent({
        type: 'error_test',
        conversationId: 'conv_123'
      });

      const request = new Request('https://message-broadcaster/broadcast-to-conversations', {
        method: 'POST',
        body: JSON.stringify({
          event,
          targets: ['conv_123']
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await messageBroadcaster.fetch(request);

      // Should handle gracefully and return partial success
      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('failed');
    });

    it('should handle network timeouts', async () => {
      // Mock slow-responding conversation room
      mockEnv.CONVERSATION_ROOM.get.mockReturnValue({
        fetch: vi.fn().mockImplementation(() =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 1000)
          )
        )
      });

      const event = TestDataFactory.createEvent({
        type: 'timeout_test',
        conversationId: 'conv_slow'
      });

      const request = new Request('https://message-broadcaster/broadcast-to-conversations', {
        method: 'POST',
        body: JSON.stringify({
          event,
          targets: ['conv_slow']
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      // Should complete within reasonable time despite timeout
      const startTime = Date.now();
      const response = await messageBroadcaster.fetch(request);
      const duration = Date.now() - startTime;

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(5000); // Should not take more than 5 seconds
    });

    it('should handle malformed requests', async () => {
      const request = new Request('https://message-broadcaster/broadcast-to-conversations', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await messageBroadcaster.fetch(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toContain('Invalid request');
    });

    it('should recover from partial failures', async () => {
      // Mock mixed success/failure responses
      let callCount = 0;
      mockEnv.CONVERSATION_ROOM.get.mockImplementation(() => ({
        fetch: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount % 2 === 0) {
            return Promise.reject(new Error('Simulated failure'));
          }
          return Promise.resolve(new Response(JSON.stringify({ success: true })));
        })
      }));

      const events = Array.from({ length: 10 }, (_, i) =>
        TestDataFactory.createEvent({
          type: 'recovery_test',
          conversationId: `conv_${i}`
        })
      );

      const request = new Request('https://message-broadcaster/batch-broadcast', {
        method: 'POST',
        body: JSON.stringify({
          events,
          targets: events.map(e => ({ type: 'conversation', targets: [e.conversationId!] }))
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await messageBroadcaster.fetch(request);

      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.successful).toBeGreaterThan(0);
      expect(result.failed).toBeGreaterThan(0);
      expect(result.successful + result.failed).toBe(10);
    });
  });

  describe('Load Testing and Scalability', () => {
    it('should handle high-volume broadcasting', async () => {
      const eventCount = 1000;
      const conversationCount = 100;

      const events = Array.from({ length: eventCount }, (_, i) =>
        TestDataFactory.createEvent({
          type: 'load_test',
          conversationId: `conv_${i % conversationCount}`,
          data: { index: i }
        })
      );

      performanceMonitor.startTimer('high_volume_broadcast');

      const request = new Request('https://message-broadcaster/batch-broadcast', {
        method: 'POST',
        body: JSON.stringify({
          events,
          targets: Array.from({ length: conversationCount }, (_, i) => ({
            type: 'conversation',
            targets: [`conv_${i}`]
          }))
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await messageBroadcaster.fetch(request);

      const duration = performanceMonitor.endTimer('high_volume_broadcast');

      expect(response.ok).toBe(true);

      const result = await response.json();
      expect(result.processed).toBe(eventCount);

      // Performance assertions
      const throughput = eventCount / (duration / 1000);
      expect(throughput).toBeGreaterThan(100); // At least 100 events per second

      const metrics = performanceMonitor.getMetrics('high_volume_broadcast');
      expect(metrics.average).toBeLessThan(30000); // Less than 30 seconds
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentRequests = 20;
      const eventsPerRequest = 50;

      const promises = Array.from({ length: concurrentRequests }, (_, requestIndex) => {
        const events = Array.from({ length: eventsPerRequest }, (_, eventIndex) =>
          TestDataFactory.createEvent({
            type: 'concurrent_test',
            conversationId: `conv_${requestIndex}_${eventIndex}`,
            data: { requestIndex, eventIndex }
          })
        );

        const request = new Request('https://message-broadcaster/batch-broadcast', {
          method: 'POST',
          body: JSON.stringify({
            events,
            targets: events.map(e => ({
              type: 'conversation',
              targets: [e.conversationId!]
            }))
          }),
          headers: { 'Content-Type': 'application/json' }
        });

        return messageBroadcaster.fetch(request);
      });

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All requests should succeed
      expect(responses.every(r => r.ok)).toBe(true);

      // Should complete all requests within reasonable time
      const totalEvents = concurrentRequests * eventsPerRequest;
      const throughput = totalEvents / (duration / 1000);

      expect(throughput).toBeGreaterThan(50); // At least 50 events per second
      expect(duration).toBeLessThan(60000); // Less than 1 minute total
    });

    it('should efficiently deduplicate broadcast targets', async () => {
      // Create events that target the same conversations
      const duplicateEvents = Array.from({ length: 100 }, (_, i) =>
        TestDataFactory.createEvent({
          type: 'dedup_test',
          conversationId: `conv_${i % 5}`, // Only 5 unique conversations
          data: { index: i }
        })
      );

      const request = new Request('https://message-broadcaster/batch-broadcast', {
        method: 'POST',
        body: JSON.stringify({
          events: duplicateEvents,
          targets: duplicateEvents.map(e => ({
            type: 'conversation',
            targets: [e.conversationId!]
          }))
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await messageBroadcaster.fetch(request);

      expect(response.ok).toBe(true);

      // Should only call each unique conversation room once despite multiple events
      expect(mockEnv.CONVERSATION_ROOM.idFromName).toHaveBeenCalledTimes(5);
    });
  });

  describe('Health Monitoring', () => {
    it('should provide health status', async () => {
      const request = new Request('https://message-broadcaster/health');
      const response = await messageBroadcaster.fetch(request);

      expect(response.ok).toBe(true);

      const health = await response.json();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('eventProcessingRate');
      expect(health).toHaveProperty('errorRate');
      expect(health).toHaveProperty('memoryUsage');
      expect(health).toHaveProperty('timestamp');
    });

    it('should detect performance degradation', async () => {
      // Simulate slow processing
      mockEnv.CONVERSATION_ROOM.get.mockReturnValue({
        fetch: vi.fn().mockImplementation(() =>
          new Promise(resolve =>
            setTimeout(() => resolve(new Response(JSON.stringify({ success: true }))), 500)
          )
        )
      });

      // Send several slow requests
      const promises = Array.from({ length: 10 }, () => {
        const event = TestDataFactory.createEvent({
          type: 'slow_test',
          conversationId: 'conv_slow'
        });

        const request = new Request('https://message-broadcaster/broadcast-to-conversations', {
          method: 'POST',
          body: JSON.stringify({
            event,
            targets: ['conv_slow']
          }),
          headers: { 'Content-Type': 'application/json' }
        });

        return messageBroadcaster.fetch(request);
      });

      await Promise.all(promises);

      // Check health status
      const healthRequest = new Request('https://message-broadcaster/health');
      const healthResponse = await messageBroadcaster.fetch(healthRequest);
      const health = await healthResponse.json();

      // Should detect elevated latency
      expect(health.averageLatency).toBeGreaterThan(100);
    });
  });
});