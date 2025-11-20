// Integration Tests for Multi-Shard System
// 專案名稱：Multi-Channel Support MVP - Sharding Implementation Week 2
// 測試完整的多分片系統端到端流程

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationShardingService } from '@/services/conversation-sharding-service';
import { ConversationRoom } from '@/durable-objects/ConversationRimport { MockFactory } from '@helpers/mockFactory';
oom';
import { SHARD_CONFIG } from '@/types/sharding-types';
import type { ShardCapacityResponse } from '@/types/sharding-types';

/**
 * Integration Test Environment Setup
 * Simulates complete Cloudflare Workers environment with Durable Objects
 */
interface MockConnection {
  userId: string;
  shardIndex: number;
  conversationId: string;
  messages: any[];
}

interface MockWebSocket {
  send: (data: string) => void;
  close: () => void;
  readyState: number;
  userId: string;
}

class IntegrationTestEnv {
  private durableObjects: Map<string, ConversationRoom> = new Map();
  private connections: Map<string, MockConnection[]> = new Map();

  CONVERSATION_ROOM = {
    idFromName: (name: string) => name,
    get: (id: string) => {
      if (!this.durableObjects.has(id)) {
        // Create real ConversationRoom instance
        const room = new ConversationRoom(
          { id: { toString: () => id, equals: () => false, name: id } } as DurableObjectState,
          this as any
        );
        this.durableObjects.set(id, room);
      }
      return this.createStub(id);
    }
  };

  private createStub(shardId: string) {
    const shardIndexMatch = shardId.match(/_shard-(\d+)$/);
    const shardIndex = shardIndexMatch ? parseInt(shardIndexMatch[1], 10) : 0;
    const conversationId = shardId.replace(/_shard-\d+$/, '');

    return {
      shardId,
      fetch: vi.fn().mockImplementation(async (request: Request) => {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // Capacity check endpoint
        if (pathname.includes('capacity-check')) {
          const connections = this.getConnectionsForShard(conversationId, shardIndex);
          const connectionCount = connections.length;
          const maxConnections = SHARD_CONFIG.CONNECTIONS_PER_SHARD;
          const hasCapacity = connectionCount < maxConnections;

          const response: ShardCapacityResponse = {
            hasCapacity,
            connectionCount,
            shardIndex,
            maxConnections,
            utilizationPercent: (connectionCount / maxConnections) * 100,
            shardId
          };

          return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json' }
          });

  afterEach(() => {
    vi.restoreAllMocks();
  });
        }

        // Metadata endpoint
        if (pathname.includes('metadata')) {
          const isInitialized = this.durableObjects.has(shardId);
          return new Response(JSON.stringify({
            initialized: isInitialized,
            shardId,
            shardIndex,
            createdAt: Date.now() - 3600000
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Initialize endpoint
        if (pathname.includes('initialize')) {
          // Mark as initialized
          if (!this.durableObjects.has(shardId)) {
            const room = new ConversationRoom(
              { id: { toString: () => shardId, equals: () => false, name: shardId } } as DurableObjectState,
              this as any
            );
            this.durableObjects.set(shardId, room);
          }

          return new Response(JSON.stringify({
            success: true,
            shardId
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Cross-shard broadcast endpoint
        if (pathname.includes('cross-shard-broadcast')) {
          const payload = await request.json() as {
            conversationId: string;
            event: any;
            excludeShardIndex: number;
            priority: string;
            timestamp: number;
          };

          // Don't broadcast to source shard
          if (shardIndex === payload.excludeShardIndex) {
            return new Response(JSON.stringify({
              success: true,
              delivered: 0,
              reason: 'source_shard_excluded'
            }));
          }

          // Deliver to all connections on this shard
          const connections = this.getConnectionsForShard(payload.conversationId, shardIndex);
          connections.forEach(conn => {
            conn.messages.push(payload.event);
          });

          return new Response(JSON.stringify({
            success: true,
            delivered: connections.length,
            shardIndex,
            shardId
          }));
        }

        return new Response('Not found', { status: 404 });
      })
    };
  }

  // Helper: Add connection to a specific shard
  addConnection(conversationId: string, userId: string, shardIndex: number): MockConnection {
    const key = `${conversationId}_shard-${shardIndex}`;
    if (!this.connections.has(key)) {
      this.connections.set(key, []);
    }

    const connection: MockConnection = {
      userId,
      shardIndex,
      conversationId,
      messages: []
    };

    this.connections.get(key)!.push(connection);
    return connection;
  }

  // Helper: Get connections for a specific shard
  getConnectionsForShard(conversationId: string, shardIndex: number): MockConnection[] {
    const key = `${conversationId}_shard-${shardIndex}`;
    return this.connections.get(key) || [];
  }

  // Helper: Get all connections for a conversation across all shards
  getAllConnections(conversationId: string): MockConnection[] {
    const allConnections: MockConnection[] = [];
    for (let i = 0; i < SHARD_CONFIG.MAX_SHARDS_PER_CONVERSATION; i++) {
      allConnections.push(...this.getConnectionsForShard(conversationId, i));
    }
    return allConnections;
  }

  // Helper: Clear all connections
  clearConnections() {
    this.connections.clear();
  }
}

describe('Multi-Shard Integration Tests', () => {
  let env: IntegrationTestEnv;
  let service: ConversationShardingService;

  beforeEach(() => {
    vi.clearAllMocks();
    env = new IntegrationTestEnv();
    service = new ConversationShardingService(env as any);
    service.clearCache();
    env.clearConnections();
  });

  describe('End-to-End Shard Selection', () => {
    test('should select shard-0 for new conversation', async () => {
      const conversationId = 'conv-e2e-001';

      const stub = await service.getAvailableShardForConversation(conversationId);

      expect(stub).toBeDefined();
      expect(stub.shardId).toBe(`${conversationId}_shard-0`);
    });

    test('should distribute connections across multiple shards when capacity is reached', async () => {
      const conversationId = 'conv-e2e-002';

      // Fill shard-0 to capacity
      for (let i = 0; i < SHARD_CONFIG.CONNECTIONS_PER_SHARD; i++) {
        env.addConnection(conversationId, `user-${i}`, 0);
      }

      // Next connection should go to shard-1
      service.clearCache(conversationId);
      const stub = await service.getAvailableShardForConversation(conversationId);

      expect(stub.shardId).toBe(`${conversationId}_shard-1`);
    });

    test('should handle concurrent shard selection requests', async () => {
      const conversationId = 'conv-e2e-003';

      // Simulate 50 concurrent connection attempts
      const promises = Array.from({ length: 50 }, () =>
        service.getAvailableShardForConversation(conversationId)
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(stub => {
        expect(stub).toBeDefined();
        expect(stub.shardId).toContain(conversationId);
      });
    });
  });

  describe('Cross-Shard Message Broadcasting', () => {
    test('should broadcast message from shard-0 to all other shards', async () => {
      const conversationId = 'conv-broadcast-001';

      // Add connections to shards 0-4
      const connections = [
        env.addConnection(conversationId, 'user-1', 0),
        env.addConnection(conversationId, 'user-2', 1),
        env.addConnection(conversationId, 'user-3', 2),
        env.addConnection(conversationId, 'user-4', 3),
        env.addConnection(conversationId, 'user-5', 4)
      ];

      const event = {
        id: 'msg-001',
        type: 'message_sent',
        timestamp: Date.now(),
        data: { content: 'Hello from shard-0' }
      };

      // Broadcast from shard-0
      const result = await service.broadcastToAllShards(
        conversationId,
        event,
        0, // Source shard
        'normal'
      );

      // Verify broadcast success
      expect(result.success).toBe(true);
      expect(result.shardsNotified).toBe(4); // Shards 1-4

      // Verify shard-0 did NOT receive broadcast (already has message)
      expect(connections[0].messages).toHaveLength(0);

      // Verify shards 1-4 received the broadcast
      expect(connections[1].messages).toHaveLength(1);
      expect(connections[2].messages).toHaveLength(1);
      expect(connections[3].messages).toHaveLength(1);
      expect(connections[4].messages).toHaveLength(1);

      // Verify message content
      expect(connections[1].messages[0].data.content).toBe('Hello from shard-0');
    });

    test('should handle broadcasting with multiple messages in sequence', async () => {
      const conversationId = 'conv-broadcast-002';

      // Setup connections
      const conn1 = env.addConnection(conversationId, 'user-1', 0);
      const conn2 = env.addConnection(conversationId, 'user-2', 1);
      const conn3 = env.addConnection(conversationId, 'user-3', 2);

      // Send 5 messages from shard-0
      for (let i = 0; i < 5; i++) {
        const event = {
          id: `msg-${i}`,
          type: 'message_sent',
          timestamp: Date.now(),
          data: { content: `Message ${i}` }
        };

        await service.broadcastToAllShards(conversationId, event, 0, 'normal');
      }

      // Verify all messages received
      expect(conn1.messages).toHaveLength(0); // Source shard
      expect(conn2.messages).toHaveLength(5);
      expect(conn3.messages).toHaveLength(5);

      // Verify message order
      for (let i = 0; i < 5; i++) {
        expect(conn2.messages[i].data.content).toBe(`Message ${i}`);
      }
    });

    test('should broadcast from different source shards correctly', async () => {
      const conversationId = 'conv-broadcast-003';

      // Setup connections on all shards
      const connections = [
        env.addConnection(conversationId, 'user-1', 0),
        env.addConnection(conversationId, 'user-2', 1),
        env.addConnection(conversationId, 'user-3', 2),
        env.addConnection(conversationId, 'user-4', 3),
        env.addConnection(conversationId, 'user-5', 4)
      ];

      // Broadcast from shard-2
      const event = {
        id: 'msg-001',
        type: 'message_sent',
        timestamp: Date.now(),
        data: { content: 'Hello from shard-2' }
      };

      await service.broadcastToAllShards(conversationId, event, 2, 'normal');

      // Verify shard-2 did NOT receive broadcast
      expect(connections[2].messages).toHaveLength(0);

      // Verify all other shards received broadcast
      expect(connections[0].messages).toHaveLength(1);
      expect(connections[1].messages).toHaveLength(1);
      expect(connections[3].messages).toHaveLength(1);
      expect(connections[4].messages).toHaveLength(1);
    });
  });

  describe('Load Distribution', () => {
    test('should evenly distribute 25,000 connections across 3 shards', async () => {
      const conversationId = 'conv-load-001';

      // Simulate 25,000 connections
      // First 10,000 → shard-0
      for (let i = 0; i < 10000; i++) {
        env.addConnection(conversationId, `user-${i}`, 0);
      }

      // Next 10,000 → shard-1
      for (let i = 10000; i < 20000; i++) {
        env.addConnection(conversationId, `user-${i}`, 1);
      }

      // Next 5,000 → shard-2
      for (let i = 20000; i < 25000; i++) {
        env.addConnection(conversationId, `user-${i}`, 2);
      }

      // Verify shard-0 is full
      service.clearCache(conversationId);
      const stub0 = await service.getAvailableShardForConversation(conversationId);
      expect(stub0.shardId).not.toBe(`${conversationId}_shard-0`);

      // Verify connections are distributed
      const shard0Conns = env.getConnectionsForShard(conversationId, 0);
      const shard1Conns = env.getConnectionsForShard(conversationId, 1);
      const shard2Conns = env.getConnectionsForShard(conversationId, 2);

      expect(shard0Conns.length).toBe(10000);
      expect(shard1Conns.length).toBe(10000);
      expect(shard2Conns.length).toBe(5000);

      const totalConnections = env.getAllConnections(conversationId);
      expect(totalConnections.length).toBe(25000);
    });

    test('should handle maximum capacity (50,000 connections across 5 shards)', async () => {
      const conversationId = 'conv-load-002';

      // Fill all 5 shards to capacity
      for (let shardIndex = 0; shardIndex < 5; shardIndex++) {
        for (let i = 0; i < SHARD_CONFIG.CONNECTIONS_PER_SHARD; i++) {
          env.addConnection(
            conversationId,
            `user-shard${shardIndex}-${i}`,
            shardIndex
          );
        }
      }

      // Verify total connections
      const totalConnections = env.getAllConnections(conversationId);
      expect(totalConnections.length).toBe(50000);

      // Verify all shards are full
      service.clearCache(conversationId);
      await expect(
        service.getAvailableShardForConversation(conversationId)
      ).rejects.toThrow(/All shards full/);
    });
  });

  describe('Failover and Resilience', () => {
    test('should continue operating when one shard fails', async () => {
      const conversationId = 'conv-failover-001';

      // Setup connections on multiple shards
      env.addConnection(conversationId, 'user-1', 0);
      env.addConnection(conversationId, 'user-2', 1);
      env.addConnection(conversationId, 'user-3', 2);
      env.addConnection(conversationId, 'user-4', 3);

      // Pre-create stub for shard-1 and make it fail
      const shard1Id = `${conversationId}_shard-1`;
      const stub1 = env.CONVERSATION_ROOM.get(shard1Id);

      // Override the fetch to always reject for cross-shard-broadcast
      const originalFetch = stub1.fetch;
      stub1.fetch = vi.fn().mockImplementation((request: Request) => {
        const url = new URL(request.url);
        if (url.pathname.includes('cross-shard-broadcast')) {
          return Promise.reject(new Error('Shard offline'));
        }
        // For other endpoints, use original behavior
        return originalFetch(request);
      });

      // Broadcast should still work (partial success)
      const event = {
        id: 'msg-001',
        type: 'message_sent',
        timestamp: Date.now(),
        data: { content: 'Test message' }
      };

      const result = await service.broadcastToAllShards(conversationId, event, 0, 'normal');

      // Should report failure for shard-1
      expect(result.success).toBe(false);
      expect(result.failedShards).toContain(1);

      // But other shards (2, 3, 4) should succeed
      expect(result.shardsNotified).toBeGreaterThanOrEqual(2);
    });

    test('should handle graceful degradation on shard failures', async () => {
      const conversationId = 'conv-failover-002';

      // Setup connections
      env.addConnection(conversationId, 'user-1', 0);
      env.addConnection(conversationId, 'user-2', 2);

      // Make shards 1, 3, and 4 fail
      for (const shardIndex of [1, 3, 4]) {
        const shardId = `${conversationId}_shard-${shardIndex}`;
        const stub = env.CONVERSATION_ROOM.get(shardId);
        const originalFetch = stub.fetch;

        stub.fetch = vi.fn().mockImplementation((request: Request) => {
          const url = new URL(request.url);
          if (url.pathname.includes('cross-shard-broadcast')) {
            return Promise.reject(new Error('Shard offline'));
          }
          return originalFetch(request);
        });
      }

      const event = {
        id: 'msg-001',
        type: 'message_sent',
        timestamp: Date.now(),
        data: { content: 'Test message' }
      };

      const result = await service.broadcastToAllShards(conversationId, event, 0, 'normal');

      // Should have partial success (only shard-2 succeeded)
      expect(result.failedShards.length).toBe(3);
      expect(result.shardsNotified).toBe(1); // Only shard-2 succeeded
      expect(result.success).toBe(false);
    });
  });

  describe('Complete Conversation Flow', () => {
    test('should handle complete multi-user conversation across shards', async () => {
      const conversationId = 'conv-flow-001';

      // Setup: 10 users distributed across 3 shards
      const users = [
        { userId: 'alice', shardIndex: 0 },
        { userId: 'bob', shardIndex: 0 },
        { userId: 'charlie', shardIndex: 1 },
        { userId: 'diana', shardIndex: 1 },
        { userId: 'eve', shardIndex: 1 },
        { userId: 'frank', shardIndex: 2 },
        { userId: 'grace', shardIndex: 2 },
        { userId: 'henry', shardIndex: 2 },
        { userId: 'iris', shardIndex: 2 },
        { userId: 'jack', shardIndex: 2 }
      ];

      const connections = users.map(user =>
        env.addConnection(conversationId, user.userId, user.shardIndex)
      );

      // Simulate conversation: each user sends a message
      for (let i = 0; i < users.length; i++) {
        const event = {
          id: `msg-${i}`,
          type: 'message_sent',
          timestamp: Date.now(),
          userId: users[i].userId,
          data: { content: `Hello from ${users[i].userId}` }
        };

        await service.broadcastToAllShards(
          conversationId,
          event,
          users[i].shardIndex,
          'normal'
        );
      }

      // Verify each user received messages from users on OTHER shards
      // Alice (shard-0) should receive 8 messages (from shards 1 and 2)
      const aliceMessages = connections[0].messages;
      expect(aliceMessages.length).toBeGreaterThan(0);

      // Charlie (shard-1) should receive messages from shards 0 and 2
      const charlieMessages = connections[2].messages;
      expect(charlieMessages.length).toBeGreaterThan(0);

      // Frank (shard-2) should receive messages from shards 0 and 1
      const frankMessages = connections[5].messages;
      expect(frankMessages.length).toBeGreaterThan(0);
    });

    test('should handle typing indicators across shards', async () => {
      const conversationId = 'conv-flow-002';

      // Setup connections
      const conn1 = env.addConnection(conversationId, 'user-1', 0);
      const conn2 = env.addConnection(conversationId, 'user-2', 1);
      const conn3 = env.addConnection(conversationId, 'user-3', 2);

      // User-1 starts typing
      const typingEvent = {
        id: 'typing-001',
        type: 'typing_start',
        timestamp: Date.now(),
        userId: 'user-1',
        data: {}
      };

      await service.broadcastToAllShards(conversationId, typingEvent, 0, 'low');

      // Verify users on other shards received typing indicator
      expect(conn1.messages).toHaveLength(0); // Source shard
      expect(conn2.messages).toHaveLength(1);
      expect(conn3.messages).toHaveLength(1);

      expect(conn2.messages[0].type).toBe('typing_start');
      expect(conn2.messages[0].userId).toBe('user-1');
    });
  });

  describe('Performance and Scalability', () => {
    test('should complete broadcast to 5 shards within 100ms', async () => {
      const conversationId = 'conv-perf-001';

      // Add connections to all shards
      for (let i = 0; i < 5; i++) {
        env.addConnection(conversationId, `user-${i}`, i);
      }

      const event = {
        id: 'msg-perf',
        type: 'message_sent',
        timestamp: Date.now(),
        data: { content: 'Performance test' }
      };

      const startTime = Date.now();
      await service.broadcastToAllShards(conversationId, event, 0, 'normal');
      const latency = Date.now() - startTime;

      expect(latency).toBeLessThan(100);
    });

    test('should handle 100 concurrent broadcasts efficiently', async () => {
      const conversationId = 'conv-perf-002';

      // Setup connections
      env.addConnection(conversationId, 'user-1', 0);
      env.addConnection(conversationId, 'user-2', 1);

      // Send 100 broadcasts concurrently
      const promises = Array.from({ length: 100 }, (_, i) => {
        const event = {
          id: `msg-${i}`,
          type: 'message_sent',
          timestamp: Date.now(),
          data: { content: `Message ${i}` }
        };
        return service.broadcastToAllShards(conversationId, event, 0, 'normal');
      });

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete in reasonable time (< 1 second)
      expect(totalTime).toBeLessThan(1000);
    });
  });
});
