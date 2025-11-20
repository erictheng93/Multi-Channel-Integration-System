// Unit Tests for ConversationShardingService
// 專案名稱：Multi-Channel Support MVP - Sharding Implementation
// 測試分片服務的核心功能

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationShardingService } from '@/services/conversation-sharding-service';
imimport { MockFactory } from '@helpers/mockFactory';
port { SHARD_CONFIG } from '@/types/sharding-types';
import type { ShardCapacityResponse } from '@/types/sharding-types';

/**
 * Mock environment with Durable Object bindings
 */
function createMockEnv() {
  const mockStubs = new Map<string, any>();

  return {
    CONVERSATION_ROOM: {
      idFromName: (name: string) => name,
      get: (id: string) => {
        if (!mockStubs.has(id)) {
          const stub = createMockStub(id);
          mockStubs.set(id, stub);
        }
        return mockStubs.get(id);
      }
    }
  };
}

/**
 * Create mock Durable Object stub with default "shard full" behavior
 * Individual tests can override with mockImplementation()
 */
function createMockStub(shardId: string) {
  // Extract shard index from shardId pattern: {conversationId}_shard-{index}
  const shardIndexMatch = shardId.match(/_shard-(\d+)$/);
  const shardIndex = shardIndexMatch ? parseInt(shardIndexMatch[1], 10) : 0;

  return {
    shardId,
    // Default behavior: return "shard full" response
    // Tests can override this with stub.fetch.mockImplementation()
    fetch: vi.fn().mockImplementation((request: Request) => {
      const url = new URL(request.url);

      // Default: shard is full (10,000 connections)
      if (url.pathname.includes('capacity-check')) {
        return Promise.resolve(
          new Response(JSON.stringify(createMockCapacityResponse(false, 10000, shardIndex)))
        );
      }

      // Default metadata response (shard is initialized)
      if (url.pathname.includes('metadata')) {
        return Promise.resolve(
          new Response(JSON.stringify({
            initialized: true,
            shardId,
            createdAt: Date.now() - 3600000 // 1 hour ago
          }))
        );
      }

      // Default initialize response (success)
      if (url.pathname.includes('initialize')) {
        return Promise.resolve(
          new Response(JSON.stringify({ success: true, shardId }))
        );
      }

      // Fallback for unknown endpoints
      return Promise.resolve(new Response('Not found', { status: 404 }));
    }),
    _mockResponses: [] as any[] // Store mock responses
  };
}

/**
 * Create mock capacity response
 */
function createMockCapacityResponse(
  hasCapacity: boolean,
  connectionCount: number,
  shardIndex: number
): ShardCapacityResponse {
  const maxConnections = SHARD_CONFIG.CONNECTIONS_PER_SHARD;
  return {
    hasCapacity,
    connectionCount,
    shardIndex,
    maxConnections,
    utilizationPercent: (connectionCount / maxConnections) * 100,
    shardId: `test-conv_shard-${shardIndex}`
  };
}

/**
 * Helper to create a mock stub with custom capacity and initialization state
 */
function mockStubWithCapacity(
  stub: any,
  conversationId: string,
  shardIndex: number,
  hasCapacity: boolean,
  connectionCount: number,
  isInitialized: boolean = true
) {
  stub.fetch.mockImplementation((request: Request) => {
    const url = new URL(request.url);
    const shardId = `${conversationId}_shard-${shardIndex}`;

    if (url.pathname.includes('capacity-check')) {
      return Promise.resolve(
        new Response(JSON.stringify(createMockCapacityResponse(hasCapacity, connectionCount, shardIndex)))
      );
    } else if (url.pathname.includes('metadata')) {
      return Promise.resolve(
        new Response(JSON.stringify({
          initialized: isInitialized,
          shardId,
          createdAt: Date.now() - 3600000
        }))
      );
    } else if (url.pathname.includes('initialize')) {
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, shardId }))
      );
    }
    return Promise.resolve(new Response('Not found', { status: 404 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
}

describe('ConversationShardingService', () => {
  let service: ConversationShardingService;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    service = new ConversationShardingService(mockEnv);
    // Clear cache before each test
    service.clearCache();
  });

  describe('getAvailableShardForConversation', () => {
    test('should select first available shard when under capacity', async () => {
      const conversationId = 'conv-test-001';
      const stub = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-0`);

      // Mock shard with available capacity and already initialized
      stub.fetch.mockImplementation((request: Request) => {
        const url = new URL(request.url);
        if (url.pathname.includes('capacity-check')) {
          return Promise.resolve(new Response(JSON.stringify(createMockCapacityResponse(true, 5000, 0))));
        } else if (url.pathname.includes('metadata')) {
          // Shard is already initialized (has 5000 connections)
          return Promise.resolve(new Response(JSON.stringify({ initialized: true, shardId: `${conversationId}_shard-0` })));
        }
        return Promise.resolve(new Response('Not found', { status: 404 }));
      });

      const result = await service.getAvailableShardForConversation(conversationId);

      expect(result).toBeDefined();
      expect(result).toBe(stub);
      expect(stub.fetch).toHaveBeenCalled();
    });

    test('should create new shard when shard-0 is full', async () => {
      const conversationId = 'conv-test-002';
      const stub0 = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-0`);
      const stub1 = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-1`);

      // Shard-0 is full and initialized
      mockStubWithCapacity(stub0, conversationId, 0, false, 10000, true);

      // Shard-1 is available and uninitialized (new shard)
      mockStubWithCapacity(stub1, conversationId, 1, true, 0, false);

      const result = await service.getAvailableShardForConversation(conversationId);

      expect(result).toBe(stub1);
      expect(stub0.fetch).toHaveBeenCalled();
      expect(stub1.fetch).toHaveBeenCalled();
    });

    test('should throw error when all 5 shards are full', async () => {
      const conversationId = 'conv-test-003';

      // Mock all 5 shards as full
      for (let i = 0; i < SHARD_CONFIG.MAX_SHARDS_PER_CONVERSATION; i++) {
        const stub = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-${i}`);
        mockStubWithCapacity(stub, conversationId, i, false, 10000, true);
      }

      await expect(
        service.getAvailableShardForConversation(conversationId)
      ).rejects.toThrow(/All shards full/);
    });

    test('should retry on transient failures', async () => {
      const conversationId = 'conv-test-004';
      const stub = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-0`);

      let attemptCount = 0;
      // First few calls fail, then succeed
      stub.fetch.mockImplementation((request: Request) => {
        const url = new URL(request.url);
        attemptCount++;

        // Fail the first 2 attempts (covers both metadata and capacity checks)
        if (attemptCount <= 2) {
          return Promise.reject(new Error('Network error'));
        }

        // Succeed on subsequent attempts
        if (url.pathname.includes('capacity-check')) {
          return Promise.resolve(new Response(JSON.stringify(createMockCapacityResponse(true, 100, 0))));
        } else if (url.pathname.includes('metadata')) {
          return Promise.resolve(new Response(JSON.stringify({ initialized: true })));
        }
        return Promise.resolve(new Response('Not found', { status: 404 }));
      });

      const result = await service.getAvailableShardForConversation(conversationId);

      expect(result).toBeDefined();
      expect(stub.fetch.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    test('should use cached shard information for subsequent requests', async () => {
      const conversationId = 'conv-test-005';
      const stub = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-0`);

      // Mock shard with available capacity and already initialized
      mockStubWithCapacity(stub, conversationId, 0, true, 1000, true);

      // First request
      const result1 = await service.getAvailableShardForConversation(conversationId);
      expect(result1).toBeDefined();

      // Second request should use cache
      const result2 = await service.getAvailableShardForConversation(conversationId);
      expect(result2).toBeDefined();

      // Should call fetch at least twice (cached shard still needs capacity check)
      expect(stub.fetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    test('should handle capacity check timeout gracefully', async () => {
      const conversationId = 'conv-test-006';
      const stub = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-0`);

      // Mock timeout
      stub.fetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 100);
        });
      });

      await expect(
        service.getAvailableShardForConversation(conversationId)
      ).rejects.toThrow();
    });

    test('should distribute connections across multiple shards', async () => {
      const conversationId = 'conv-test-007';

      const stub0 = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-0`);
      const stub1 = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-1`);

      // Shard-0: 80% full and initialized
      mockStubWithCapacity(stub0, conversationId, 0, true, 8000, true);

      // Shard-1: 50% full and initialized
      mockStubWithCapacity(stub1, conversationId, 1, true, 5000, true);

      // First request should use shard-0 (first available)
      const result1 = await service.getAvailableShardForConversation(conversationId);
      expect(result1).toBe(stub0);

      // Clear cache to force re-evaluation
      service.clearCache(conversationId);

      // After shard-0 becomes full, should use shard-1
      mockStubWithCapacity(stub0, conversationId, 0, false, 10000, true);

      const result2 = await service.getAvailableShardForConversation(conversationId);
      expect(result2).toBe(stub1);
    });
  });

  describe('Cache Management', () => {
    test('should cache shard metadata correctly', async () => {
      const conversationId = 'conv-cache-001';
      const stub = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-0`);

      mockStubWithCapacity(stub, conversationId, 0, true, 2000, true);

      await service.getAvailableShardForConversation(conversationId);

      const stats = service.getCacheStats();
      expect(stats.totalConversations).toBe(1);
      expect(stats.totalShards).toBe(1);
    });

    test('should clear cache for specific conversation', async () => {
      const conv1 = 'conv-cache-002';
      const conv2 = 'conv-cache-003';

      const stub1 = mockEnv.CONVERSATION_ROOM.get(`${conv1}_shard-0`);
      const stub2 = mockEnv.CONVERSATION_ROOM.get(`${conv2}_shard-0`);

      mockStubWithCapacity(stub1, conv1, 0, true, 100, true);
      mockStubWithCapacity(stub2, conv2, 0, true, 200, true);

      await service.getAvailableShardForConversation(conv1);
      await service.getAvailableShardForConversation(conv2);

      expect(service.getCacheStats().totalConversations).toBe(2);

      service.clearCache(conv1);
      expect(service.getCacheStats().totalConversations).toBe(1);
    });

    test('should expire cache after TTL', async () => {
      const conversationId = 'conv-cache-004';
      const stub = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-0`);

      mockStubWithCapacity(stub, conversationId, 0, true, 500, true);

      // First request
      await service.getAvailableShardForConversation(conversationId);

      // Mock time passing beyond TTL
      vi.useFakeTimers();
      vi.advanceTimersByTime(SHARD_CONFIG.CACHE_TTL + 1000);

      // Second request should bypass cache
      await service.getAvailableShardForConversation(conversationId);

      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    test('should handle shard initialization failure', async () => {
      const conversationId = 'conv-error-001';
      const stub = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-0`);

      // Capacity check succeeds, but initialization fails
      stub.fetch.mockImplementation((request: Request) => {
        const url = new URL(request.url);
        if (url.pathname.includes('capacity-check')) {
          return Promise.resolve(
            new Response(JSON.stringify(createMockCapacityResponse(true, 0, 0)))
          );
        } else if (url.pathname.includes('initialize')) {
          return Promise.resolve(
            new Response(JSON.stringify({ success: false, error: 'Init failed' }), { status: 500 })
          );
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await expect(
        service.getAvailableShardForConversation(conversationId)
      ).rejects.toThrow();
    });

    test('should handle network errors gracefully', async () => {
      const conversationId = 'conv-error-002';

      // All shards throw network errors
      for (let i = 0; i < SHARD_CONFIG.MAX_SHARDS_PER_CONVERSATION; i++) {
        const stub = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-${i}`);
        stub.fetch.mockRejectedValue(new Error('Network error'));
      }

      await expect(
        service.getAvailableShardForConversation(conversationId)
      ).rejects.toThrow();
    });

    test('should handle malformed capacity response', async () => {
      const conversationId = 'conv-error-003';
      const stub = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-0`);

      stub.fetch.mockResolvedValue(
        new Response('invalid json', { status: 200 })
      );

      await expect(
        service.getAvailableShardForConversation(conversationId)
      ).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    test('should select shard within acceptable latency', async () => {
      const conversationId = 'conv-perf-001';
      const stub = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-0`);

      mockStubWithCapacity(stub, conversationId, 0, true, 1000, true);

      const startTime = Date.now();
      await service.getAvailableShardForConversation(conversationId);
      const latency = Date.now() - startTime;

      // Should complete within 100ms
      expect(latency).toBeLessThan(100);
    });

    test('should handle concurrent shard selections', async () => {
      const conversationIds = Array.from({ length: 10 }, (_, i) => `conv-concurrent-${i}`);

      const promises = conversationIds.map(async (convId) => {
        const stub = mockEnv.CONVERSATION_ROOM.get(`${convId}_shard-0`);
        mockStubWithCapacity(stub, convId, 0, true, 100, true);
        return service.getAvailableShardForConversation(convId);
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });

  describe('Shard Naming', () => {
    test('should follow naming pattern: {conversationId}_shard-{index}', async () => {
      const conversationId = 'conv-naming-001';
      const stub = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-0`);

      mockStubWithCapacity(stub, conversationId, 0, true, 100, true);

      await service.getAvailableShardForConversation(conversationId);

      expect(stub.shardId).toBe(`${conversationId}_shard-0`);
    });

    test('should create correct shard IDs for all indices', () => {
      const conversationId = 'conv-naming-002';

      for (let i = 0; i < SHARD_CONFIG.MAX_SHARDS_PER_CONVERSATION; i++) {
        const stub = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-${i}`);
        expect(stub.shardId).toBe(`${conversationId}_shard-${i}`);
      }
    });
  });
});
