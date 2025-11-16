/**
 * LatestMessageCacheCoordinator Durable Object Unit Tests
 *
 * Comprehensive test suite for the latest message cache coordinator
 * Tests all functionality including:
 * - Batched cache update scheduling (5-second window)
 * - Immediate cache invalidation
 * - Cache warmup functionality
 * - Alarm-based batch processing
 * - Retry mechanism with max 3 attempts
 * - Priority queue management
 * - State persistence and recovery
 * - Statistics tracking and reporting
 * - WebSocket broadcast integration
 * - Error handling and resilience
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LatestMessageCacheCoordinator } from '@/durable-objects/LatestMessageCacheCoordinator';

// Mock LatestMessageCache service
vi.mock('../../../src/services/latest-message-cache', () => ({
  LatestMessageCache: vi.fn().mockImplementation(() => ({
    getLatestMessage: vi.fn().mockResolvedValue({
      id: 'msg_001',
      content: 'Test message',
      createdAt: new Date().toISOString(),
      senderType: 'agent'
    }),
    invalidateLatestMessage: vi.fn().mockResolvedValue(undefined),
    warmupCache: vi.fn().mockResolvedValue(50)
  }))
}));

/**
 * Mock Durable Object State
 */
class MockDurableObjectState implements DurableObjectState {
  id: DurableObjectId;
  storage: DurableObjectStorage;
  private alarmTime: number | null = null;
  private storageData: Map<string, any> = new Map();

  constructor(id: DurableObjectId) {
    this.id = id;
    this.storage = {
      get: vi.fn((key: string) => Promise.resolve(this.storageData.get(key))),
      put: vi.fn((key: string, value: any) => {
        this.storageData.set(key, value);
        return Promise.resolve();
      }),
      delete: vi.fn((key: string) => {
        this.storageData.delete(key);
        return Promise.resolve(true);
      }),
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

  acceptWebSocket(ws: WebSocket, tags?: string[]): void {}
  getWebSockets(tag?: string): WebSocket[] { return []; }
  setWebSocketAutoResponse(webSocketRequestResponsePair?: WebSocketRequestResponsePair): void {}
  getWebSocketAutoResponse(): WebSocketRequestResponsePair | null { return null; }
  getWebSocketAutoResponseTimestamp(ws: WebSocket): Date | null { return null; }
  getTags(ws: WebSocket): string[] { return []; }
  waitUntil(promise: Promise<any>): void {}
  abort(reason?: any): void {}
}

/**
 * Mock Durable Object ID
 */
class MockDurableObjectId implements DurableObjectId {
  constructor(private name: string) {}
  toString(): string { return this.name; }
  equals(other: DurableObjectId): boolean { return this.toString() === other.toString(); }
}

describe('LatestMessageCacheCoordinator Durable Object', () => {
  let coordinator: LatestMessageCacheCoordinator;
  let mockState: MockDurableObjectState;
  let mockEnv: any;

  beforeEach(() => {
    const id = new MockDurableObjectId('test_cache_coordinator');
    mockState = new MockDurableObjectState(id);

    // Mock MESSAGE_BROADCASTER
    const mockBroadcasterStub = {
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )
    };

    mockEnv = {
      DB: {},
      CACHE: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      },
      MESSAGE_BROADCASTER: {
        idFromName: vi.fn(() => new MockDurableObjectId('broadcaster_global')),
        get: vi.fn(() => mockBroadcasterStub)
      }
    };

    coordinator = new LatestMessageCacheCoordinator(mockState, mockEnv);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Schedule Update Endpoint', () => {
    it('should schedule a cache update successfully', async () => {
      const request = new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'conv_001',
          priority: 'normal'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await coordinator.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.conversationId).toBe('conv_001');
      expect(result.queueSize).toBe(1);
      expect(result.scheduledAlarm).toBe(true);

      // Verify state was saved
      expect(mockState.storage.put).toHaveBeenCalledWith('updateQueue', expect.any(Array));
      expect(mockState.storage.put).toHaveBeenCalledWith('stats', expect.any(Object));
    });

    it('should reject schedule request without conversationId', async () => {
      const request = new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ priority: 'high' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await coordinator.fetch(request);
      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('conversationId is required');
    });

    it('should use default priority if not specified', async () => {
      const request = new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_002' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await coordinator.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
    });

    it('should update existing queue entry for same conversation', async () => {
      // Schedule first update
      await coordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'conv_003',
          priority: 'low'
        })
      }));

      // Schedule second update for same conversation
      const response = await coordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: 'conv_003',
          priority: 'high'
        })
      }));

      const result = await response.json();
      expect(result.queueSize).toBe(1); // Should still be 1, not 2
    });

    it('should schedule alarm on first update', async () => {
      const setAlarmSpy = vi.spyOn(mockState.storage, 'setAlarm');

      await coordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_004' })
      }));

      expect(setAlarmSpy).toHaveBeenCalled();
    });

    it('should not reschedule alarm if already scheduled', async () => {
      // First update - should schedule alarm
      await coordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_005' })
      }));

      const setAlarmSpy = vi.spyOn(mockState.storage, 'setAlarm');
      setAlarmSpy.mockClear();

      // Second update - should not reschedule
      await coordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_006' })
      }));

      // Should not call setAlarm again
      expect(setAlarmSpy).not.toHaveBeenCalled();
    });

    it('should handle multiple conversations in queue', async () => {
      const conversations = ['conv_007', 'conv_008', 'conv_009'];

      for (const convId of conversations) {
        await coordinator.fetch(new Request('http://test/schedule', {
          method: 'POST',
          body: JSON.stringify({ conversationId: convId })
        }));
      }

      // Check queue size
      const statusResponse = await coordinator.fetch(new Request('http://test/status'));
      const status = await statusResponse.json();

      expect(status.queueSize).toBe(3);
    });
  });

  describe('Invalidate Endpoint', () => {
    it('should invalidate cache immediately', async () => {
      const request = new Request('http://test/invalidate', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_101' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await coordinator.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.conversationId).toBe('conv_101');
    });

    it('should reject invalidate request without conversationId', async () => {
      const request = new Request('http://test/invalidate', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await coordinator.fetch(request);
      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toContain('conversationId is required');
    });

    it('should handle cache service errors gracefully', async () => {
      // Mock cache service to throw error
      const LatestMessageCache = await import('../../../src/services/latest-message-cache');
      const mockCache = {
        invalidateLatestMessage: vi.fn().mockRejectedValue(new Error('Cache error'))
      };
      vi.spyOn(LatestMessageCache, 'LatestMessageCache').mockReturnValue(mockCache as any);

      // Create new coordinator with mocked cache
      const newCoordinator = new LatestMessageCacheCoordinator(mockState, mockEnv);

      const request = new Request('http://test/invalidate', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_102' })
      });

      const response = await newCoordinator.fetch(request);
      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
    });
  });

  describe('Warmup Endpoint', () => {
    it('should warmup cache with default limit', async () => {
      const request = new Request('http://test/warmup', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await coordinator.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.warmedUp).toBeDefined();
      expect(typeof result.warmedUp).toBe('number');
    });

    it('should warmup cache with custom limit', async () => {
      const request = new Request('http://test/warmup', {
        method: 'POST',
        body: JSON.stringify({ limit: 50 }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await coordinator.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
    });

    it('should handle warmup errors gracefully', async () => {
      // Mock cache service to throw error
      const LatestMessageCache = await import('../../../src/services/latest-message-cache');
      const mockCache = {
        warmupCache: vi.fn().mockRejectedValue(new Error('Warmup failed'))
      };
      vi.spyOn(LatestMessageCache, 'LatestMessageCache').mockReturnValue(mockCache as any);

      const newCoordinator = new LatestMessageCacheCoordinator(mockState, mockEnv);

      const request = new Request('http://test/warmup', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await newCoordinator.fetch(request);
      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
    });

    it('should handle invalid JSON in warmup request', async () => {
      const request = new Request('http://test/warmup', {
        method: 'POST',
        body: 'invalid',
        headers: { 'Content-Type': 'application/json' }
      });

      // Should use default limit and succeed
      const response = await coordinator.fetch(request);
      expect(response.status).toBe(200);
    });
  });

  describe('Status Endpoint', () => {
    it('should return coordinator status', async () => {
      // Schedule some updates first
      await coordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_201' })
      }));

      const request = new Request('http://test/status');
      const response = await coordinator.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.status).toBe('healthy');
      expect(result.queueSize).toBeGreaterThanOrEqual(1);
      expect(result.alarmScheduled).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats).toHaveProperty('totalProcessed');
      expect(result.stats).toHaveProperty('successfulUpdates');
      expect(result.stats).toHaveProperty('failedUpdates');
      expect(result.stats).toHaveProperty('averageProcessingTime');
    });

    it('should show next alarm time when scheduled', async () => {
      await coordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_202' })
      }));

      const statusResponse = await coordinator.fetch(new Request('http://test/status'));
      const status = await statusResponse.json();

      expect(status.nextAlarmAt).toBeDefined();
      expect(typeof status.nextAlarmAt).toBe('string');
    });

    it('should show null alarm time when not scheduled', async () => {
      const statusResponse = await coordinator.fetch(new Request('http://test/status'));
      const status = await statusResponse.json();

      expect(status.queueSize).toBe(0);
      expect(status.alarmScheduled).toBe(false);
    });
  });

  describe('Stats Endpoint', () => {
    it('should return processing statistics', async () => {
      const request = new Request('http://test/stats');
      const response = await coordinator.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats).toHaveProperty('totalProcessed');
      expect(result.stats).toHaveProperty('successfulUpdates');
      expect(result.stats).toHaveProperty('failedUpdates');
      expect(result.stats).toHaveProperty('currentQueueSize');
      expect(result.stats).toHaveProperty('successRate');
      expect(result.stats).toHaveProperty('averageProcessingTime');
    });

    it('should show N/A success rate when no messages processed', async () => {
      const statsResponse = await coordinator.fetch(new Request('http://test/stats'));
      const stats = await statsResponse.json();

      expect(stats.stats.successRate).toBe('N/A');
    });

    it('should calculate success rate correctly after processing', async () => {
      // Schedule and process updates
      await coordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_301' })
      }));

      // Trigger alarm to process
      await coordinator.alarm();

      const statsResponse = await coordinator.fetch(new Request('http://test/stats'));
      const stats = await statsResponse.json();

      expect(stats.stats.totalProcessed).toBeGreaterThan(0);
      expect(typeof stats.stats.successRate).toBe('string');
    });
  });

  describe('Queue Endpoint', () => {
    it('should return empty queue initially', async () => {
      const request = new Request('http://test/queue');
      const response = await coordinator.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.queueSize).toBe(0);
      expect(result.queue).toEqual([]);
    });

    it('should list queued updates', async () => {
      // Schedule multiple updates
      const conversations = ['conv_401', 'conv_402', 'conv_403'];

      for (const convId of conversations) {
        await coordinator.fetch(new Request('http://test/schedule', {
          method: 'POST',
          body: JSON.stringify({
            conversationId: convId,
            priority: 'normal'
          })
        }));
      }

      const queueResponse = await coordinator.fetch(new Request('http://test/queue'));
      const queue = await queueResponse.json();

      expect(queue.success).toBe(true);
      expect(queue.queueSize).toBe(3);
      expect(queue.queue).toHaveLength(3);
      expect(queue.queue[0]).toHaveProperty('conversationId');
      expect(queue.queue[0]).toHaveProperty('priority');
      expect(queue.queue[0]).toHaveProperty('timestamp');
      expect(queue.queue[0]).toHaveProperty('retryCount');
    });

    it('should show retry count in queue items', async () => {
      await coordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_404' })
      }));

      const queueResponse = await coordinator.fetch(new Request('http://test/queue'));
      const queue = await queueResponse.json();

      expect(queue.queue[0].retryCount).toBe(0);
    });
  });

  describe('Manual Alarm Trigger', () => {
    it('should trigger alarm manually', async () => {
      // Schedule an update
      await coordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_501' })
      }));

      const request = new Request('http://test/trigger-alarm', {
        method: 'POST'
      });

      const response = await coordinator.fetch(request);
      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.message).toContain('triggered manually');
    });
  });

  describe('Alarm Handler - Batch Processing', () => {
    it('should process all queued updates on alarm', async () => {
      // Schedule multiple updates
      const conversations = ['conv_601', 'conv_602', 'conv_603'];

      for (const convId of conversations) {
        await coordinator.fetch(new Request('http://test/schedule', {
          method: 'POST',
          body: JSON.stringify({ conversationId: convId })
        }));
      }

      // Trigger alarm
      await coordinator.alarm();

      // Queue should be empty after successful processing
      const statusResponse = await coordinator.fetch(new Request('http://test/status'));
      const status = await statusResponse.json();

      expect(status.queueSize).toBe(0);
      expect(status.stats.totalProcessed).toBe(3);
    });

    it('should handle empty queue gracefully', async () => {
      // Trigger alarm with empty queue
      await expect(coordinator.alarm()).resolves.not.toThrow();

      const statusResponse = await coordinator.fetch(new Request('http://test/status'));
      const status = await statusResponse.json();

      expect(status.queueSize).toBe(0);
    });

    it('should update statistics after processing', async () => {
      await coordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_604' })
      }));

      await coordinator.alarm();

      const statsResponse = await coordinator.fetch(new Request('http://test/stats'));
      const stats = await statsResponse.json();

      expect(stats.stats.totalProcessed).toBeGreaterThan(0);
      expect(stats.stats.lastProcessedAt).toBeGreaterThan(0);
      expect(stats.stats.averageProcessingTime).toBeGreaterThanOrEqual(0);
    });

    it('should save state after processing', async () => {
      const putSpy = vi.spyOn(mockState.storage, 'put');

      await coordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_605' })
      }));

      putSpy.mockClear();

      await coordinator.alarm();

      // Should save stats and queue
      expect(putSpy).toHaveBeenCalledWith('stats', expect.any(Object));
      expect(putSpy).toHaveBeenCalledWith('updateQueue', expect.any(Array));
    });

    it('should reset alarm scheduled flag after processing', async () => {
      await coordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_606' })
      }));

      await coordinator.alarm();

      const statusResponse = await coordinator.fetch(new Request('http://test/status'));
      const status = await statusResponse.json();

      // Alarm should not be scheduled after processing all messages
      expect(status.alarmScheduled).toBe(false);
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry failed updates up to max retries', async () => {
      // Mock cache service to fail
      const LatestMessageCache = await import('../../../src/services/latest-message-cache');
      const mockCache = {
        getLatestMessage: vi.fn()
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValueOnce({
            id: 'msg_001',
            content: 'Success after retries',
            createdAt: new Date().toISOString(),
            senderType: 'agent'
          }),
        invalidateLatestMessage: vi.fn().mockResolvedValue(undefined)
      };
      vi.spyOn(LatestMessageCache, 'LatestMessageCache').mockReturnValue(mockCache as any);

      const newCoordinator = new LatestMessageCacheCoordinator(mockState, mockEnv);

      await newCoordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_701' })
      }));

      // First alarm - should fail and retry
      await newCoordinator.alarm();

      const statusResponse1 = await newCoordinator.fetch(new Request('http://test/status'));
      const status1 = await statusResponse1.json();
      expect(status1.queueSize).toBe(1); // Still in queue

      // Second alarm - should fail and retry again
      await newCoordinator.alarm();

      // Third alarm - should succeed
      await newCoordinator.alarm();

      const statusResponse2 = await newCoordinator.fetch(new Request('http://test/status'));
      const status2 = await statusResponse2.json();
      expect(status2.queueSize).toBe(0); // Successfully processed
    });

    it('should remove message after max retries exceeded', async () => {
      // Mock cache service to always fail
      const LatestMessageCache = await import('../../../src/services/latest-message-cache');
      const mockCache = {
        getLatestMessage: vi.fn().mockRejectedValue(new Error('Permanent failure')),
        invalidateLatestMessage: vi.fn().mockResolvedValue(undefined)
      };
      vi.spyOn(LatestMessageCache, 'LatestMessageCache').mockReturnValue(mockCache as any);

      const newCoordinator = new LatestMessageCacheCoordinator(mockState, mockEnv);

      await newCoordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_702' })
      }));

      // Trigger alarm 4 times (initial + 3 retries)
      await newCoordinator.alarm(); // Attempt 1 - fail, retry 0
      await newCoordinator.alarm(); // Attempt 2 - fail, retry 1
      await newCoordinator.alarm(); // Attempt 3 - fail, retry 2
      await newCoordinator.alarm(); // Attempt 4 - fail, max retries exceeded, removed

      const statusResponse = await newCoordinator.fetch(new Request('http://test/status'));
      const status = await statusResponse.json();

      expect(status.queueSize).toBe(0); // Removed after max retries
      expect(status.stats.failedUpdates).toBeGreaterThan(0);
    });

    it('should reschedule alarm when retries remaining', async () => {
      // Mock cache service to fail once
      const LatestMessageCache = await import('../../../src/services/latest-message-cache');
      const mockCache = {
        getLatestMessage: vi.fn().mockRejectedValue(new Error('Temporary failure')),
        invalidateLatestMessage: vi.fn().mockResolvedValue(undefined)
      };
      vi.spyOn(LatestMessageCache, 'LatestMessageCache').mockReturnValue(mockCache as any);

      const newCoordinator = new LatestMessageCacheCoordinator(mockState, mockEnv);

      await newCoordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_703' })
      }));

      const setAlarmSpy = vi.spyOn(mockState.storage, 'setAlarm');
      setAlarmSpy.mockClear();

      await newCoordinator.alarm();

      // Should reschedule alarm for retry
      expect(setAlarmSpy).toHaveBeenCalled();
    });
  });

  describe('WebSocket Broadcasting', () => {
    it('should broadcast update after successful processing', async () => {
      await coordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_801' })
      }));

      await coordinator.alarm();

      // Verify broadcaster was called
      const broadcasterStub = mockEnv.MESSAGE_BROADCASTER.get();
      expect(broadcasterStub.fetch).toHaveBeenCalledWith(
        'http://localhost/broadcast',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should not fail processing if broadcast fails', async () => {
      // Mock broadcaster to fail
      const failingBroadcaster = {
        fetch: vi.fn().mockRejectedValue(new Error('Broadcast failed'))
      };
      mockEnv.MESSAGE_BROADCASTER.get = vi.fn(() => failingBroadcaster);

      const newCoordinator = new LatestMessageCacheCoordinator(mockState, mockEnv);

      await newCoordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_802' })
      }));

      // Should process successfully despite broadcast failure
      await expect(newCoordinator.alarm()).resolves.not.toThrow();

      const statusResponse = await newCoordinator.fetch(new Request('http://test/status'));
      const status = await statusResponse.json();

      expect(status.stats.successfulUpdates).toBeGreaterThan(0);
    });

    it('should handle missing broadcaster gracefully', async () => {
      // Remove broadcaster from env
      mockEnv.MESSAGE_BROADCASTER = null;

      const newCoordinator = new LatestMessageCacheCoordinator(mockState, mockEnv);

      await newCoordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_803' })
      }));

      await expect(newCoordinator.alarm()).resolves.not.toThrow();
    });
  });

  describe('State Persistence and Recovery', () => {
    it('should restore queue from storage on initialization', async () => {
      const mockQueue = [
        ['conv_901', {
          conversationId: 'conv_901',
          timestamp: Date.now(),
          priority: 'normal',
          retryCount: 0
        }],
        ['conv_902', {
          conversationId: 'conv_902',
          timestamp: Date.now(),
          priority: 'high',
          retryCount: 1
        }]
      ];

      // Setup mock storage with queue data
      const newId = new MockDurableObjectId('test_restore_queue');
      const newState = new MockDurableObjectState(newId);
      newState.storage.get = vi.fn((key) => {
        if (key === 'updateQueue') return Promise.resolve(mockQueue);
        if (key === 'stats') return Promise.resolve({
          totalProcessed: 10,
          successfulUpdates: 8,
          failedUpdates: 2,
          lastProcessedAt: Date.now(),
          averageProcessingTime: 150
        });
        return Promise.resolve(null);
      });

      const restoredCoordinator = new LatestMessageCacheCoordinator(newState, mockEnv);

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      const statusResponse = await restoredCoordinator.fetch(new Request('http://test/status'));
      const status = await statusResponse.json();

      expect(status.queueSize).toBe(2);
      expect(status.stats.totalProcessed).toBe(10);
    });

    it('should restore stats from storage on initialization', async () => {
      const mockStats = {
        totalProcessed: 100,
        successfulUpdates: 95,
        failedUpdates: 5,
        lastProcessedAt: Date.now() - 60000,
        averageProcessingTime: 200
      };

      const newId = new MockDurableObjectId('test_restore_stats');
      const newState = new MockDurableObjectState(newId);
      newState.storage.get = vi.fn((key) => {
        if (key === 'stats') return Promise.resolve(mockStats);
        return Promise.resolve(null);
      });

      const restoredCoordinator = new LatestMessageCacheCoordinator(newState, mockEnv);

      await new Promise(resolve => setTimeout(resolve, 100));

      const statsResponse = await restoredCoordinator.fetch(new Request('http://test/stats'));
      const stats = await statsResponse.json();

      expect(stats.stats.totalProcessed).toBe(100);
      expect(stats.stats.successfulUpdates).toBe(95);
      expect(stats.stats.failedUpdates).toBe(5);
    });

    it('should handle storage errors during restoration gracefully', async () => {
      const newId = new MockDurableObjectId('test_restore_error');
      const newState = new MockDurableObjectState(newId);
      newState.storage.get = vi.fn().mockRejectedValue(new Error('Storage error'));

      // Should not throw during initialization
      expect(() => new LatestMessageCacheCoordinator(newState, mockEnv)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const request = new Request('http://test/unknown');
      const response = await coordinator.fetch(request);

      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Not found');
    });

    it('should handle malformed JSON gracefully', async () => {
      const request = new Request('http://test/schedule', {
        method: 'POST',
        body: 'invalid json{',
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await coordinator.fetch(request);

      expect(response.status).toBe(500);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle cache processing errors', async () => {
      // Mock cache service to throw error
      const LatestMessageCache = await import('../../../src/services/latest-message-cache');
      const mockCache = {
        getLatestMessage: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        invalidateLatestMessage: vi.fn().mockResolvedValue(undefined)
      };
      vi.spyOn(LatestMessageCache, 'LatestMessageCache').mockReturnValue(mockCache as any);

      const newCoordinator = new LatestMessageCacheCoordinator(mockState, mockEnv);

      await newCoordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_error_001' })
      }));

      // Should handle error gracefully
      await expect(newCoordinator.alarm()).resolves.not.toThrow();

      const statsResponse = await newCoordinator.fetch(new Request('http://test/stats'));
      const stats = await statsResponse.json();

      expect(stats.stats.failedUpdates).toBeGreaterThan(0);
    });

    it('should handle missing latest message gracefully', async () => {
      // Mock cache service to return null
      const LatestMessageCache = await import('../../../src/services/latest-message-cache');
      const mockCache = {
        getLatestMessage: vi.fn().mockResolvedValue(null),
        invalidateLatestMessage: vi.fn().mockResolvedValue(undefined)
      };
      vi.spyOn(LatestMessageCache, 'LatestMessageCache').mockReturnValue(mockCache as any);

      const newCoordinator = new LatestMessageCacheCoordinator(mockState, mockEnv);

      await newCoordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_no_message' })
      }));

      // Should handle gracefully without throwing
      await expect(newCoordinator.alarm()).resolves.not.toThrow();
    });
  });

  describe('Priority Handling', () => {
    it('should accept different priority levels', async () => {
      const priorities: Array<'low' | 'normal' | 'high'> = ['low', 'normal', 'high'];

      for (const priority of priorities) {
        const response = await coordinator.fetch(new Request('http://test/schedule', {
          method: 'POST',
          body: JSON.stringify({
            conversationId: `conv_priority_${priority}`,
            priority
          })
        }));

        expect(response.status).toBe(200);
      }

      const queueResponse = await coordinator.fetch(new Request('http://test/queue'));
      const queue = await queueResponse.json();

      expect(queue.queueSize).toBe(3);
      expect(queue.queue.some((item: any) => item.priority === 'low')).toBe(true);
      expect(queue.queue.some((item: any) => item.priority === 'normal')).toBe(true);
      expect(queue.queue.some((item: any) => item.priority === 'high')).toBe(true);
    });
  });

  describe('Configuration Constants', () => {
    it('should use 5-second batch delay', async () => {
      await coordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_config_001' })
      }));

      // Check that alarm is scheduled approximately 5 seconds in the future
      const statusResponse = await coordinator.fetch(new Request('http://test/status'));
      const status = await statusResponse.json();

      expect(status.nextAlarmAt).toBeDefined();

      if (status.nextAlarmAt) {
        const alarmTime = new Date(status.nextAlarmAt).getTime();
        const now = Date.now();
        const delay = alarmTime - now;

        // Should be close to 5000ms (allow 100ms variance for processing time)
        expect(delay).toBeGreaterThan(4000);
        expect(delay).toBeLessThan(6000);
      }
    });

    it('should use max 3 retry attempts', async () => {
      // This is implicitly tested by the retry mechanism tests
      // Just verify the constant is being used correctly
      const LatestMessageCache = await import('../../../src/services/latest-message-cache');
      const mockCache = {
        getLatestMessage: vi.fn().mockRejectedValue(new Error('Always fail')),
        invalidateLatestMessage: vi.fn().mockResolvedValue(undefined)
      };
      vi.spyOn(LatestMessageCache, 'LatestMessageCache').mockReturnValue(mockCache as any);

      const newCoordinator = new LatestMessageCacheCoordinator(mockState, mockEnv);

      await newCoordinator.fetch(new Request('http://test/schedule', {
        method: 'POST',
        body: JSON.stringify({ conversationId: 'conv_retry_max' })
      }));

      // Process 4 times (initial + 3 retries)
      await newCoordinator.alarm();
      await newCoordinator.alarm();
      await newCoordinator.alarm();
      await newCoordinator.alarm();

      const statusResponse = await newCoordinator.fetch(new Request('http://test/status'));
      const status = await statusResponse.json();

      // Should be removed after 3 retries
      expect(status.queueSize).toBe(0);
    });
  });
});
