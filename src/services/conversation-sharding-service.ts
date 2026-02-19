// Conversation Sharding Service
// 專案名稱：Multi-Channel Support MVP - Sharding Implementation
// 管理 ConversationRoom 分片選擇和路由

import type {
  ShardMetadata,
  CachedShardInfo,
  ShardCapacityResponse,
  ShardInitializationPayload,
  ShardInitializationResponse,
  ShardSelectionResult,
  ShardError,
  SHARD_CONFIG as ShardConfigType
} from '../types/sharding-types';
import { SHARD_CONFIG } from '../types/sharding-types';
import type { DurableObjectStub, DurableObjectNamespace } from '@cloudflare/workers-types';
import { testSafeLog, testSafeError, getEmojiPrefix } from '../utils/test-logger';
import { nowMs } from '@/utils/timestamp'

/**
 * Environment bindings required by ConversationShardingService
 */
export interface ShardingEnvironment {
  CONVERSATION_ROOM: DurableObjectNamespace;
}

/**
 * ConversationShardingService
 *
 * Manages shard selection and routing for ConversationRoom Durable Objects.
 * Implements automatic horizontal scaling by distributing connections across
 * multiple shard instances when capacity limits are reached.
 *
 * Key Features:
 * - Automatic shard discovery and selection
 * - Capacity-based routing with caching
 * - Failover and retry mechanisms
 * - RPC-based capacity checking
 * - Cache management for performance optimization
 *
 * Architecture:
 * 1. Check cache for existing shard metadata
 * 2. Iterate through shards 0 to MAX_SHARDS-1
 * 3. For each shard, call canSupportConnection() RPC
 * 4. Return first available shard OR create new shard
 * 5. Update cache with shard metadata
 */
export class ConversationShardingService {
  private env: ShardingEnvironment;
  private shardCache: Map<string, CachedShardInfo> = new Map();

  constructor(env: ShardingEnvironment) {
    this.env = env;
  }

  /**
   * Core Algorithm: Find first available shard for conversation
   *
   * Flow:
   * 1. Check cache for existing shards
   * 2. Loop through shards 0 to MAX_SHARDS-1
   * 3. For each shard, call canSupportConnection() RPC
   * 4. Return first available shard OR create new shard
   * 5. Update cache with shard metadata
   *
   * @param conversationId - Unique conversation identifier
   * @param retryAttempt - Current retry attempt (for exponential backoff)
   * @returns DurableObject stub for selected shard, or null if all full
   */
  async getAvailableShardForConversation(
    conversationId: string,
    retryAttempt: number = 0
  ): Promise<DurableObjectStub | null> {
    testSafeLog(`${getEmojiPrefix('SEARCH')}[ShardingService] Finding shard for conversation: ${conversationId} (attempt ${retryAttempt + 1})`);

    try {
      // 1️⃣ Try existing shards first (from cache)
      const cachedShards = this.getCachedShards(conversationId);

      if (cachedShards.length > 0) {
        testSafeLog(`${getEmojiPrefix('PACKAGE')}[ShardingService] Found ${cachedShards.length} cached shards for ${conversationId}`);

        for (const shardMeta of cachedShards) {
          // Skip shards marked as full or failed
          if (shardMeta.status === 'full' || shardMeta.status === 'failed') {
            continue;
          }

          const stub = this.getShardStub(conversationId, shardMeta.index);

          try {
            const capacity = await this.checkShardCapacity(stub);

            if (capacity.hasCapacity) {
              testSafeLog(`${getEmojiPrefix('CHECK')}[ShardingService] Using existing shard-${shardMeta.index} for ${conversationId}`);
              this.updateShardCache(conversationId, shardMeta.index, capacity);
              return stub;
            } else {
              testSafeLog(`${getEmojiPrefix('WARNING')}[ShardingService] Shard-${shardMeta.index} at capacity (${capacity.connectionCount}/${capacity.maxConnections})`);
              // Update cache to mark as full
              shardMeta.status = 'full';
              this.updateShardCache(conversationId, shardMeta.index, capacity);
            }
          } catch (error) {
            testSafeLog(`${getEmojiPrefix('WARNING')}[ShardingService] Shard-${shardMeta.index} check failed:`, error);
            // Mark as failed but continue to next shard
            shardMeta.status = 'failed';
          }
        }
      }

      // 2️⃣ Create or find next available shard
      testSafeLog(`${getEmojiPrefix('NEW')}[ShardingService] Searching for new shard (0-${SHARD_CONFIG.MAX_SHARDS_PER_CONVERSATION - 1})`);

      for (let shardIndex = 0; shardIndex < SHARD_CONFIG.MAX_SHARDS_PER_CONVERSATION; shardIndex++) {
        const stub = this.getShardStub(conversationId, shardIndex);

        try {
          const capacity = await this.checkShardCapacity(stub);

          if (capacity.hasCapacity) {
            testSafeLog(`${getEmojiPrefix('SUCCESS')}[ShardingService] Allocating shard-${shardIndex} for ${conversationId}`);

            // Initialize shard if it's truly new (first time allocated)
            // Note: 0 connections could mean dormant shard, not necessarily uninitialized
            // The DO should track initialization state internally via metadata endpoint
            const needsInitialization = await this.checkShardNeedsInitialization(stub, shardIndex);
            if (needsInitialization) {
              await this.initializeShard(stub, conversationId, shardIndex);
            }

            this.updateShardCache(conversationId, shardIndex, capacity);
            return stub;
          } else {
            testSafeLog(`${getEmojiPrefix('ERROR')}[ShardingService] Shard-${shardIndex} full (${capacity.connectionCount}/${capacity.maxConnections})`);
          }
        } catch (error) {
          testSafeError(`${getEmojiPrefix('ERROR')}[ShardingService] Failed to check shard-${shardIndex}:`, error);
          // Continue to next shard instead of failing immediately
        }
      }

      // 3️⃣ All shards full or unreachable - retry with exponential backoff
      if (retryAttempt < SHARD_CONFIG.FAILOVER_RETRY_COUNT) {
        const delay = 500 * (retryAttempt + 1); // Exponential backoff
        testSafeLog(`${getEmojiPrefix('ROCKET')}[ShardingService] Retrying shard allocation in ${delay}ms (attempt ${retryAttempt + 1}/${SHARD_CONFIG.FAILOVER_RETRY_COUNT})...`);
        await this.sleep(delay);
        return this.getAvailableShardForConversation(conversationId, retryAttempt + 1);
      }

      // 4️⃣ All retries exhausted
      const error: ShardError = {
        type: 'all_shards_full',
        conversationId,
        message: `All shards full for conversation ${conversationId} (${SHARD_CONFIG.MAX_SHARDS_PER_CONVERSATION * SHARD_CONFIG.CONNECTIONS_PER_SHARD} connections limit reached)`,
        timestamp: nowMs(),
        retryable: false
      };

      throw error;

    } catch (error) {
      testSafeError(`${getEmojiPrefix('ERROR')}[ShardingService] Critical error in shard selection for ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Check if shard can accept new connections (RPC call)
   *
   * @param stub - Durable Object stub for the shard
   * @returns Capacity information including availability and utilization
   */
  private async checkShardCapacity(
    stub: DurableObjectStub
  ): Promise<ShardCapacityResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SHARD_CONFIG.CAPACITY_CHECK_TIMEOUT);

      const response = await stub.fetch('https://shard/capacity-check', {
        method: 'GET',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AbortSignal type mismatch between DOM and Cloudflare Workers environments
        signal: controller.signal as any
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Capacity check failed: HTTP ${response.status}`);
      }

      return await response.json() as ShardCapacityResponse;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Capacity check timeout after ${SHARD_CONFIG.CAPACITY_CHECK_TIMEOUT}ms`);
      }
      throw error;
    }
  }

  /**
   * Check if shard needs initialization
   *
   * Queries the DO's metadata endpoint to determine if the shard has been initialized.
   * This prevents re-initialization of dormant shards (0 connections but already set up).
   *
   * @param stub - Durable Object stub for the shard
   * @param shardIndex - Shard index for logging
   * @returns true if shard needs initialization, false if already initialized
   */
  private async checkShardNeedsInitialization(
    stub: DurableObjectStub,
    shardIndex: number
  ): Promise<boolean> {
    try {
      // Query DO metadata endpoint to check initialization state
      // The DO should implement GET /metadata endpoint that returns:
      // { initialized: boolean, shardId?: string, createdAt?: number }
      const response = await stub.fetch('https://shard/metadata', {
        method: 'GET'
      });

      if (response.ok) {
        const metadata = await response.json() as { initialized?: boolean };
        const isInitialized = metadata.initialized === true;

        if (isInitialized) {
          testSafeLog(`${getEmojiPrefix('INFO')}[ShardingService] Shard-${shardIndex} already initialized, skipping init`);
        }

        return !isInitialized;
      }

      // If metadata endpoint doesn't exist or returns error, assume needs initialization
      testSafeLog(`${getEmojiPrefix('WARNING')}[ShardingService] Shard-${shardIndex} metadata check failed (HTTP ${response.status}), assuming needs init`);
      return true;

    } catch (error) {
      // If RPC fails, assume shard needs initialization (conservative approach)
      testSafeLog(`${getEmojiPrefix('WARNING')}[ShardingService] Failed to check shard-${shardIndex} initialization state:`, error);
      return true;
    }
  }

  /**
   * Initialize new shard with metadata
   *
   * @param stub - Durable Object stub for the shard
   * @param conversationId - Conversation identifier
   * @param shardIndex - Shard index (0-4)
   */
  private async initializeShard(
    stub: DurableObjectStub,
    conversationId: string,
    shardIndex: number
  ): Promise<void> {
    try {
      const payload: ShardInitializationPayload = {
        conversationId,
        shardIndex,
        createdAt: nowMs(),
        maxConnections: SHARD_CONFIG.CONNECTIONS_PER_SHARD
      };

      const response = await stub.fetch('https://shard/initialize', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Shard initialization failed: HTTP ${response.status}`);
      }

      const result = await response.json() as ShardInitializationResponse;

      if (!result.success) {
        throw new Error(`Shard initialization failed: ${result.error || 'Unknown error'}`);
      }

      testSafeLog(`${getEmojiPrefix('SUCCESS')}[ShardingService] Shard initialized successfully: ${result.shardId}`);
    } catch (error) {
      testSafeError(`${getEmojiPrefix('ERROR')}[ShardingService] Shard initialization error:`, error);
      throw error;
    }
  }

  /**
   * Get Durable Object stub for specific shard
   *
   * @param conversationId - Conversation identifier
   * @param shardIndex - Shard index (0-4)
   * @returns DurableObject stub
   */
  private getShardStub(conversationId: string, shardIndex: number): DurableObjectStub {
    const shardId = `${conversationId}_shard-${shardIndex}`;
    const id = this.env.CONVERSATION_ROOM.idFromName(shardId);
    return this.env.CONVERSATION_ROOM.get(id);
  }

  /**
   * Get cached shards for conversation
   *
   * @param conversationId - Conversation identifier
   * @returns Array of shard metadata
   */
  private getCachedShards(conversationId: string): ShardMetadata[] {
    const cached = this.shardCache.get(conversationId);

    if (!cached) {
      return [];
    }

    // Check if cache is expired
    if (Date.now() - cached.timestamp > SHARD_CONFIG.CACHE_TTL) {
      testSafeLog(`${getEmojiPrefix('CLEAR')}[ShardingService] Cache expired for ${conversationId}, clearing`);
      this.shardCache.delete(conversationId);
      return [];
    }

    return cached.shards;
  }

  /**
   * Update local cache with shard metadata
   *
   * @param conversationId - Conversation identifier
   * @param shardIndex - Shard index
   * @param capacity - Current capacity information
   */
  private updateShardCache(
    conversationId: string,
    shardIndex: number,
    capacity: ShardCapacityResponse
  ): void {
    const cached = this.shardCache.get(conversationId);
    const shards = cached?.shards || [];

    const existingShard = shards.find(s => s.index === shardIndex);

    if (existingShard) {
      // Update existing shard metadata
      existingShard.connectionCount = capacity.connectionCount;
      existingShard.lastChecked = nowMs();
      existingShard.utilizationPercent = capacity.utilizationPercent;
      existingShard.status = capacity.hasCapacity ? 'active' : 'full';
    } else {
      // Add new shard to cache
      shards.push({
        index: shardIndex,
        shardId: capacity.shardId,
        conversationId,
        connectionCount: capacity.connectionCount,
        maxConnections: capacity.maxConnections,
        lastChecked: nowMs(),
        utilizationPercent: capacity.utilizationPercent,
        status: capacity.hasCapacity ? 'active' : 'full'
      });
    }

    // Update cache with new timestamp
    this.shardCache.set(conversationId, {
      shards,
      timestamp: nowMs()
    });

    testSafeLog(`${getEmojiPrefix('PACKAGE')}[ShardingService] Cache updated for ${conversationId}: ${shards.length} shards`);
  }

  /**
   * Clear cache for specific conversation (useful for testing/debugging)
   *
   * @param conversationId - Conversation identifier
   */
  public clearCache(conversationId?: string): void {
    if (conversationId) {
      this.shardCache.delete(conversationId);
      testSafeLog(`${getEmojiPrefix('CLEAR')}[ShardingService] Cache cleared for ${conversationId}`);
    } else {
      this.shardCache.clear();
      testSafeLog(`${getEmojiPrefix('CLEAR')}[ShardingService] All cache cleared`);
    }
  }

  /**
   * Get current cache statistics (for monitoring)
   */
  public getCacheStats(): {
    totalConversations: number;
    totalShards: number;
    averageShardsPerConversation: number;
  } {
    const totalConversations = this.shardCache.size;
    let totalShards = 0;

    for (const cached of this.shardCache.values()) {
      totalShards += cached.shards.length;
    }

    return {
      totalConversations,
      totalShards,
      averageShardsPerConversation: totalConversations > 0 ? totalShards / totalConversations : 0
    };
  }

  /**
   * Utility: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Week 2: Cross-Shard Broadcasting
   *
   * Broadcast an event to all shards of a conversation (excluding the source shard)
   * This enables messages sent to one shard to be delivered to connections on all other shards
   *
   * @param conversationId - Conversation identifier
   * @param event - Event to broadcast (message, typing indicator, etc.)
   * @param sourceShardIndex - Index of the shard that originated the event (will be excluded)
   * @param priority - Event priority level
   * @returns Broadcast result with delivery statistics
   */
  async broadcastToAllShards(
    conversationId: string,
    event: any,
    sourceShardIndex: number,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
  ): Promise<{
    success: boolean;
    shardsNotified: number;
    failedShards: number[];
    totalDeliveries: number;
    latencyMs: number;
  }> {
    const startTime = nowMs();
    const failedShards: number[] = [];
    let shardsNotified = 0;
    let totalDeliveries = 0;

    testSafeLog(`[ShardingService] Broadcasting to all shards for ${conversationId} (excluding shard-${sourceShardIndex})`);

    try {
      // Get cached shards or discover active shards
      const shards = this.getCachedShards(conversationId);
      const activeShardIndices = shards.length > 0
        ? shards.map(s => s.index)
        : Array.from({ length: SHARD_CONFIG.MAX_SHARDS_PER_CONVERSATION }, (_, i) => i);

      // Create broadcast payload
      const payload = {
        conversationId,
        event,
        excludeShardIndex: sourceShardIndex,
        priority,
        timestamp: nowMs()
      };

      // Broadcast to all shards in parallel (excluding source)
      const broadcastPromises = activeShardIndices
        .filter(index => index !== sourceShardIndex)
        .map(async (shardIndex) => {
          try {
            const stub = this.getShardStub(conversationId, shardIndex);

            const response = await stub.fetch('https://shard/cross-shard-broadcast', {
              method: 'POST',
              body: JSON.stringify(payload),
              headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
              const result = await response.json() as { success: boolean; delivered: number };
              if (result.success) {
                shardsNotified++;
                totalDeliveries += result.delivered || 0;
                testSafeLog(`${getEmojiPrefix('CHECK')}[ShardingService] Shard-${shardIndex} broadcast successful (${result.delivered} connections)`);
              }
            } else {
              failedShards.push(shardIndex);
              testSafeLog(`${getEmojiPrefix('WARNING')}[ShardingService] Shard-${shardIndex} broadcast failed: HTTP ${response.status}`);
            }
          } catch (error) {
            failedShards.push(shardIndex);
            testSafeError(`${getEmojiPrefix('ERROR')}[ShardingService] Shard-${shardIndex} broadcast error:`, error);
          }
        });

      await Promise.allSettled(broadcastPromises);

      const latencyMs = Date.now() - startTime;
      const success = failedShards.length === 0;

      testSafeLog(`[ShardingService] Cross-shard broadcast complete: ${shardsNotified} shards notified, ${totalDeliveries} total deliveries, ${latencyMs}ms`);

      return {
        success,
        shardsNotified,
        failedShards,
        totalDeliveries,
        latencyMs
      };

    } catch (error) {
      testSafeError(`${getEmojiPrefix('ERROR')}[ShardingService] Cross-shard broadcast critical error:`, error);
      return {
        success: false,
        shardsNotified,
        failedShards,
        totalDeliveries,
        latencyMs: Date.now() - startTime
      };
    }
  }
}
