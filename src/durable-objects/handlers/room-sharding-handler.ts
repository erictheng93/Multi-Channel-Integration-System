// Room Sharding Handler
// All sharding RPC: initialize, migrate, status, cross-shard broadcast

import type {
  DurableObjectEvent
} from '../../types/websocket-types';
import type { RealtimeEvent } from '../../types';
import type { RoomContext, RoomHelpers } from '../services/room-helpers';
import type { RoomMessageService } from '../services/room-message-service';
import { testSafeLog, testSafeError, getEmojiPrefix } from '../../utils/test-logger';

/**
 * Handles all sharding RPC endpoints for ConversationRoom:
 * - Capacity check
 * - Shard metadata query
 * - Shard initialization
 * - Cross-shard broadcast reception
 */
export class RoomShardingHandler {
  constructor(
    private ctx: RoomContext,
    _helpers: RoomHelpers,
    private messageService: RoomMessageService
  ) {}

  /**
   * RPC Endpoint: Check if shard can accept new connections
   * Used by ConversationShardingService to find available shards
   */
  async handleCapacityCheck(_request: Request): Promise<Response> {
    const connectionCount = this.ctx.connections.size;
    const maxConnections = this.ctx.shardMetadata.maxConnections;
    const hasCapacity = connectionCount < maxConnections;
    const utilizationPercent = (connectionCount / maxConnections) * 100;

    const response = {
      hasCapacity,
      connectionCount,
      shardIndex: this.ctx.shardMetadata.shardIndex ?? 0,
      maxConnections,
      utilizationPercent,
      shardId: this.ctx.shardMetadata.shardId || 'uninitialized'
    };

    testSafeLog(`[ConversationRoom] Capacity check: ${connectionCount}/${maxConnections} (${utilizationPercent.toFixed(1)}%)`);

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * RPC Endpoint: Get shard initialization metadata
   * Used by ConversationShardingService to check if shard needs initialization
   */
  async handleGetShardMetadata(_request: Request): Promise<Response> {
    const metadata = {
      initialized: this.ctx.shardMetadata.initialized,
      shardId: this.ctx.shardMetadata.shardId,
      shardIndex: this.ctx.shardMetadata.shardIndex,
      createdAt: this.ctx.shardMetadata.createdAt,
      maxConnections: this.ctx.shardMetadata.maxConnections,
      currentConnections: this.ctx.connections.size,
      conversationId: this.ctx.conversationId
    };

    testSafeLog(`[ConversationRoom] Metadata query: ${this.ctx.shardMetadata.initialized ? 'initialized' : 'uninitialized'}`);

    return new Response(JSON.stringify(metadata), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * RPC Endpoint: Initialize shard with metadata
   * Called by ConversationShardingService when allocating a new shard
   */
  async handleInitializeShard(request: Request): Promise<Response> {
    try {
      const payload = await request.json() as {
        conversationId: string;
        shardIndex: number;
        createdAt: number;
        maxConnections: number;
      };

      // Validate payload
      if (!payload.conversationId || payload.shardIndex === undefined) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Missing required fields: conversationId, shardIndex'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if already initialized
      if (this.ctx.shardMetadata.initialized) {
        testSafeLog(`[ConversationRoom] Shard already initialized: ${this.ctx.shardMetadata.shardId}`);
        return new Response(JSON.stringify({
          success: true,
          shardId: this.ctx.shardMetadata.shardId,
          message: 'Shard already initialized'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Initialize shard metadata
      const shardId = `${payload.conversationId}_shard-${payload.shardIndex}`;
      this.ctx.shardMetadata = {
        initialized: true,
        shardId,
        shardIndex: payload.shardIndex,
        createdAt: payload.createdAt,
        maxConnections: payload.maxConnections || this.ctx.MAX_CONNECTIONS
      };

      // Set conversationId
      this.ctx.conversationId = payload.conversationId;

      // Persist to storage
      await this.ctx.state.storage.put('shardMetadata', this.ctx.shardMetadata);
      await this.ctx.state.storage.put('conversationId', this.ctx.conversationId);

      testSafeLog(`${getEmojiPrefix('SUCCESS')}[ConversationRoom] Shard initialized: ${shardId} (max: ${this.ctx.shardMetadata.maxConnections})`);

      return new Response(JSON.stringify({
        success: true,
        shardId,
        shardIndex: payload.shardIndex,
        maxConnections: this.ctx.shardMetadata.maxConnections
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] Shard initialization error:`, error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to initialize shard'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * RPC Endpoint: Receive cross-shard broadcast
   * Called by peer shards to broadcast events to this shard's connections
   */
  async handleCrossShardBroadcast(request: Request): Promise<Response> {
    try {
      const payload = await request.json() as {
        conversationId: string;
        event: DurableObjectEvent | RealtimeEvent;
        excludeShardIndex: number;
        priority: 'low' | 'normal' | 'high' | 'urgent';
        timestamp: number;
      };

      // Validate payload
      if (!payload.conversationId || !payload.event || payload.excludeShardIndex === undefined) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Missing required fields: conversationId, event, excludeShardIndex'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify this is the correct conversation
      if (this.ctx.conversationId !== 'unknown' && this.ctx.conversationId !== payload.conversationId) {
        testSafeLog(`${getEmojiPrefix('WARNING')}[ConversationRoom] Cross-shard broadcast for wrong conversation: expected ${this.ctx.conversationId}, got ${payload.conversationId}`);
        return new Response(JSON.stringify({
          success: false,
          error: 'Conversation ID mismatch'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Prevent broadcast back to source shard
      if (this.ctx.shardMetadata.shardIndex === payload.excludeShardIndex) {
        testSafeLog(`[ConversationRoom] Skipping self-broadcast (shard-${payload.excludeShardIndex})`);
        return new Response(JSON.stringify({
          success: true,
          delivered: 0,
          reason: 'source_shard_excluded'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Broadcast event to all connections on this shard
      const connectionsCount = this.ctx.connections.size;
      if (connectionsCount > 0) {
        await this.messageService.broadcastEvent(payload.event);
        testSafeLog(`[ConversationRoom] Cross-shard broadcast delivered to ${connectionsCount} connections (from shard-${payload.excludeShardIndex})`);
      }

      return new Response(JSON.stringify({
        success: true,
        delivered: connectionsCount,
        shardIndex: this.ctx.shardMetadata.shardIndex,
        shardId: this.ctx.shardMetadata.shardId
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      testSafeError(`${getEmojiPrefix('ERROR')}[ConversationRoom] Cross-shard broadcast error:`, error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to process cross-shard broadcast'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
