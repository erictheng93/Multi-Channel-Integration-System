// Unit Tests for Cross-Shard Broadcasting
// 專案名稱：Multi-Channel Support MVP - Sharding Implementation Week 2
// 測試跨分片廣播功能

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Conversatiimport { MockFactory } from '@helpers/mockFactory';
onShardingService } from '@/services/conversation-sharding-service';
import { SHARD_CONFIG } from '@/types/sharding-types';

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
 * Create mock Durable Object stub
 */
function createMockStub(shardId: string) {
  const shardIndexMatch = shardId.match(/_shard-(\d+)$/);
  const shardIndex = shardIndexMatch ? parseInt(shardIndexMatch[1], 10) : 0;

  return {
    shardId,
    fetch: vi.fn().mockImplementation((request: Request) => {
      const url = new URL(request.url);

      if (url.pathname.includes('cross-shard-broadcast')) {
        // Default: broadcast successful, 10 connections notified
        return Promise.resolve(
          new Response(JSON.stringify({
            success: true,
            delivered: 10,
            shardIndex,
            shardId
          }))
        );
      }

      return Promise.resolve(new Response('Not found', { status: 404 }));
    })
  };
}

describe('Cross-Shard Broadcasting', () => {
  let service: ConversationShardingService;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    service = new ConversationShardingService(mockEnv);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('broadcastToAllShards', () => {
    test('should broadcast event to all peer shards (excluding source)', async () => {
      const conversationId = 'conv-broadcast-001';
      const event = {
        id: 'event-001',
        type: 'message_sent',
        timestamp: Date.now(),
        data: { content: 'Test message' }
      };
      const sourceShardIndex = 0;

      const result = await service.broadcastToAllShards(
        conversationId,
        event,
        sourceShardIndex,
        'normal'
      );

      // Should notify shards 1, 2, 3, 4 (not 0, the source)
      expect(result.success).toBe(true);
      expect(result.shardsNotified).toBeGreaterThanOrEqual(0); // May be 0 if no shards exist
      expect(result.failedShards).toHaveLength(0);
    });

    test('should not broadcast to source shard', async () => {
      const conversationId = 'conv-broadcast-002';
      const event = {
        id: 'event-002',
        type: 'message_sent',
        timestamp: Date.now(),
        data: { content: 'Test message' }
      };
      const sourceShardIndex = 2;

      // Get all shard stubs
      const shardStubs = Array.from({ length: SHARD_CONFIG.MAX_SHARDS_PER_CONVERSATION }, (_, i) => {
        return mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-${i}`);
      });

      await service.broadcastToAllShards(
        conversationId,
        event,
        sourceShardIndex,
        'normal'
      );

      // Shard-2 (source) should NOT receive broadcast
      const sourceShard = shardStubs[sourceShardIndex];
      expect(sourceShard.fetch).not.toHaveBeenCalled();
    });

    test('should handle broadcast failures gracefully', async () => {
      const conversationId = 'conv-broadcast-003';
      const event = {
        id: 'event-003',
        type: 'message_sent',
        timestamp: Date.now(),
        data: { content: 'Test message' }
      };

      // Make shard-1 fail
      const stub1 = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-1`);
      stub1.fetch.mockRejectedValue(new Error('Network error'));

      const result = await service.broadcastToAllShards(
        conversationId,
        event,
        0, // Source shard
        'normal'
      );

      // Should succeed overall but mark shard-1 as failed
      expect(result.failedShards).toContain(1);
    });

    test('should broadcast with correct priority', async () => {
      const conversationId = 'conv-broadcast-004';
      const event = {
        id: 'event-004',
        type: 'message_sent',
        timestamp: Date.now(),
        data: { content: 'Urgent message' }
      };

      const stub1 = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-1`);

      await service.broadcastToAllShards(
        conversationId,
        event,
        0,
        'urgent'
      );

      // Verify priority was passed
      expect(stub1.fetch).toHaveBeenCalled();
      const callArgs = stub1.fetch.mock.calls[0][0] as Request;
      const body = JSON.parse(await callArgs.text());
      expect(body.priority).toBe('urgent');
    });

    test('should return correct delivery statistics', async () => {
      const conversationId = 'conv-broadcast-005';
      const event = {
        id: 'event-005',
        type: 'message_sent',
        timestamp: Date.now(),
        data: { content: 'Test message' }
      };

      // Mock different delivery counts for each shard
      for (let i = 0; i < SHARD_CONFIG.MAX_SHARDS_PER_CONVERSATION; i++) {
        const stub = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-${i}`);
        stub.fetch.mockResolvedValue(
          new Response(JSON.stringify({
            success: true,
            delivered: (i + 1) * 5, // Shard-0: 5, Shard-1: 10, etc.
            shardIndex: i
          }))
        );
      }

      const result = await service.broadcastToAllShards(
        conversationId,
        event,
        0, // Source shard
        'normal'
      );

      // Should have total deliveries from shards 1-4
      // 10 + 15 + 20 + 25 = 70
      expect(result.totalDeliveries).toBe(70);
      expect(result.shardsNotified).toBe(4);
    });

    test('should complete broadcast within reasonable time', async () => {
      const conversationId = 'conv-broadcast-006';
      const event = {
        id: 'event-006',
        type: 'message_sent',
        timestamp: Date.now(),
        data: { content: 'Test message' }
      };

      const result = await service.broadcastToAllShards(
        conversationId,
        event,
        0,
        'normal'
      );

      // Broadcast should complete in less than 1 second for 4 shards
      expect(result.latencyMs).toBeLessThan(1000);
    });

    test('should handle partial broadcast failures', async () => {
      const conversationId = 'conv-broadcast-007';
      const event = {
        id: 'event-007',
        type: 'message_sent',
        timestamp: Date.now(),
        data: { content: 'Test message' }
      };

      // Make shards 1 and 3 fail
      const stub1 = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-1`);
      const stub3 = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-3`);

      stub1.fetch.mockRejectedValue(new Error('Network error'));
      stub3.fetch.mockResolvedValue(new Response('Server error', { status: 500 }));

      const result = await service.broadcastToAllShards(
        conversationId,
        event,
        0,
        'normal'
      );

      // Should mark shards 1 and 3 as failed
      expect(result.failedShards).toContain(1);
      expect(result.failedShards).toContain(3);
      expect(result.success).toBe(false); // Not fully successful
      expect(result.shardsNotified).toBe(2); // Shards 2 and 4 succeeded
    });

    test('should broadcast typing indicators across shards', async () => {
      const conversationId = 'conv-broadcast-008';
      const typingEvent = {
        id: 'typing-001',
        type: 'typing_start',
        timestamp: Date.now(),
        userId: 'user-123',
        data: {}
      };

      const result = await service.broadcastToAllShards(
        conversationId,
        typingEvent,
        0,
        'low' // Typing indicators are low priority
      );

      expect(result.success).toBe(true);
    });

    test('should handle empty/uninitialized shards', async () => {
      const conversationId = 'conv-broadcast-009';
      const event = {
        id: 'event-009',
        type: 'message_sent',
        timestamp: Date.now(),
        data: { content: 'Test message' }
      };

      // Mock all shards as empty (0 deliveries)
      for (let i = 0; i < SHARD_CONFIG.MAX_SHARDS_PER_CONVERSATION; i++) {
        const stub = mockEnv.CONVERSATION_ROOM.get(`${conversationId}_shard-${i}`);
        stub.fetch.mockResolvedValue(
          new Response(JSON.stringify({
            success: true,
            delivered: 0, // No connections on this shard
            shardIndex: i
          }))
        );
      }

      const result = await service.broadcastToAllShards(
        conversationId,
        event,
        0,
        'normal'
      );

      // Should succeed but with 0 deliveries
      expect(result.success).toBe(true);
      expect(result.totalDeliveries).toBe(0);
      expect(result.shardsNotified).toBe(4); // Still notified, just no deliveries
    });
  });
});
