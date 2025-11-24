/**
 * Latest Message Cache Service
 * Enterprise-grade caching for conversation latest messages
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { createDbClient } from '../db/drizzle-factory';
import type { Bindings } from '../types';
import * as schema from '../db/schema';

export interface CachedLatestMessage {
  conversationId: string;
  content: string;
  createdAt: string;
  messageId: string;
  senderType: string;
  agentSenderId?: string;
  customerSenderId?: number;
  messageType: string;
  cachedAt: string;
}

export class LatestMessageCache {
  private readonly kv: KVNamespace;
  private readonly db: ReturnType<typeof drizzle>;
  private readonly TTL = 86400; // 24 hours

  constructor(env: Bindings) {
    this.kv = env.CACHE!;
    this.db = drizzle(env.DB, { schema });
  }

  /**
   * Get latest message for a conversation (cache-first with DB fallback)
   */
  async getLatestMessage(conversationId: string): Promise<CachedLatestMessage | null> {
    const cacheKey = `latest_msg:${conversationId}`;

    try {
      // Try cache first
      const cached = await this.kv.get(cacheKey, 'json');
      if (cached) {
        console.log(`✅ [LatestMessageCache] Cache hit for conversation ${conversationId}`);
        return cached as CachedLatestMessage;
      }

      // Cache miss - query database and populate cache
      console.log(`⚠️ [LatestMessageCache] Cache miss for conversation ${conversationId}, querying DB`);
      const latest = await this.queryLatestMessageFromDB(conversationId);

      if (latest) {
        await this.setLatestMessage(conversationId, latest);
        return latest;
      }

      return null;
    } catch (error) {
      console.error(`❌ [LatestMessageCache] Error getting latest message for ${conversationId}:`, error);
      // Fallback to DB query
      return await this.queryLatestMessageFromDB(conversationId);
    }
  }

  /**
   * Get latest messages for multiple conversations (batch operation)
   */
  async getLatestMessages(conversationIds: string[]): Promise<Map<string, CachedLatestMessage>> {
    const results = new Map<string, CachedLatestMessage>();
    const cacheMisses: string[] = [];

    // Batch read from cache
    const cachePromises = conversationIds.map(async (convId) => {
      const cacheKey = `latest_msg:${convId}`;
      try {
        const cached = await this.kv.get(cacheKey, 'json');
        if (cached) {
          results.set(convId, cached as CachedLatestMessage);
        } else {
          cacheMisses.push(convId);
        }
      } catch (error) {
        console.warn(`⚠️ [LatestMessageCache] Cache read error for ${convId}:`, error);
        cacheMisses.push(convId);
      }
    });

    await Promise.all(cachePromises);

    console.log(`📊 [LatestMessageCache] Batch query - Cache hits: ${results.size}, Misses: ${cacheMisses.length}`);

    // Handle cache misses with DB queries
    if (cacheMisses.length > 0) {
      const dbResults = await this.queryLatestMessagesFromDB(cacheMisses);

      // Populate cache and results
      const cachePopulatePromises = dbResults.map(async (msg) => {
        results.set(msg.conversationId, msg);
        await this.setLatestMessage(msg.conversationId, msg);
      });

      await Promise.all(cachePopulatePromises);
    }

    return results;
  }

  /**
   * Set latest message in cache
   */
  async setLatestMessage(conversationId: string, message: Omit<CachedLatestMessage, 'cachedAt'>): Promise<void> {
    const cacheKey = `latest_msg:${conversationId}`;
    const cached: CachedLatestMessage = {
      ...message,
      cachedAt: new Date().toISOString()
    };

    try {
      await this.kv.put(cacheKey, JSON.stringify(cached), { expirationTtl: this.TTL });
      console.log(`✅ [LatestMessageCache] Cached latest message for conversation ${conversationId}`);
    } catch (error) {
      console.error(`❌ [LatestMessageCache] Failed to cache message for ${conversationId}:`, error);
    }
  }

  /**
   * Invalidate cache for a conversation
   */
  async invalidateLatestMessage(conversationId: string): Promise<void> {
    const cacheKey = `latest_msg:${conversationId}`;
    try {
      await this.kv.delete(cacheKey);
      console.log(`🗑️ [LatestMessageCache] Invalidated cache for conversation ${conversationId}`);
    } catch (error) {
      console.error(`❌ [LatestMessageCache] Failed to invalidate cache for ${conversationId}:`, error);
    }
  }

  /**
   * Query latest message from database (single conversation)
   */
  private async queryLatestMessageFromDB(conversationId: string): Promise<CachedLatestMessage | null> {
    try {
      const result = await this.db.all(sql`
        SELECT
          conversation_id as conversationId,
          id as messageId,
          content,
          created_at as createdAt,
          sender_type as senderType,
          agent_sender_id as agentSenderId,
          customer_sender_id as customerSenderId,
          message_type as messageType
        FROM messages
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at DESC
        LIMIT 1
      `);

      if (result && result.length > 0) {
        const row = result[0] as any;
        return {
          conversationId: row.conversationId,
          content: row.content,
          createdAt: row.createdAt,
          messageId: row.messageId,
          senderType: row.senderType,
          agentSenderId: row.agentSenderId,
          customerSenderId: row.customerSenderId,
          messageType: row.messageType,
          cachedAt: new Date().toISOString()
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ [LatestMessageCache] DB query error for ${conversationId}:`, error);
      return null;
    }
  }

  /**
   * Query latest messages from database (multiple conversations)
   */
  private async queryLatestMessagesFromDB(conversationIds: string[]): Promise<CachedLatestMessage[]> {
    if (conversationIds.length === 0) return [];

    try {
      const results: CachedLatestMessage[] = [];

      // Use individual queries for D1 compatibility
      for (const convId of conversationIds) {
        const latest = await this.queryLatestMessageFromDB(convId);
        if (latest) {
          results.push(latest);
        }
      }

      console.log(`📊 [LatestMessageCache] DB batch query returned ${results.length} messages`);
      return results;
    } catch (error) {
      console.error('❌ [LatestMessageCache] DB batch query error:', error);
      return [];
    }
  }

  /**
   * Warm up cache for popular conversations
   */
  async warmupCache(limit: number = 50): Promise<number> {
    try {
      // Get most recently active conversations
      const recentConversations = await this.db.all(sql`
        SELECT DISTINCT conversation_id
        FROM messages
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);

      let warmedUp = 0;
      for (const row of recentConversations) {
        const convId = (row as any).conversation_id;
        const latest = await this.queryLatestMessageFromDB(convId);
        if (latest) {
          await this.setLatestMessage(convId, latest);
          warmedUp++;
        }
      }

      console.log(`🔥 [LatestMessageCache] Warmed up cache for ${warmedUp} conversations`);
      return warmedUp;
    } catch (error) {
      console.error('❌ [LatestMessageCache] Cache warmup error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ totalCached: number; hitRate: number }> {
    // This is a simplified version - in production you'd track hits/misses
    return {
      totalCached: 0, // Would need to track this separately
      hitRate: 0.85  // Placeholder - would calculate from metrics
    };
  }
}