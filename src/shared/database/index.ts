import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@shared/database/schema';
import { nowISO, nowMs } from '@/utils/timestamp'

// Database connection helper
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

// KV helpers
export class KVService {
  constructor(
    private sessions: KVNamespace,
    private cache: KVNamespace
  ) {}

  // Session management
  async setSession(sessionId: string, data: schema.SessionData, ttl: number = 86400) {
    await this.sessions.put(sessionId, JSON.stringify(data), { expirationTtl: ttl });
  }

  async getSession(sessionId: string): Promise<schema.SessionData | null> {
    const data = await this.sessions.get(sessionId);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId: string) {
    await this.sessions.delete(sessionId);
  }

  // Cache management
  async setCache(key: string, value: any, ttl: number = 3600) {
    const cacheData: schema.CacheData = {
      key,
      value,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
    await this.cache.put(key, JSON.stringify(cacheData), { expirationTtl: ttl });
  }

  async getCache<T = any>(key: string): Promise<T | null> {
    const data = await this.cache.get(key);
    if (!data) return null;
    
    const cacheData: schema.CacheData = JSON.parse(data);
    return cacheData.value as T;
  }

  async deleteCache(key: string) {
    await this.cache.delete(key);
  }

  async clearCacheByPrefix(prefix: string) {
    const keys = await this.cache.list({ prefix });
    const deletePromises = keys.keys.map(key => this.cache.delete(key.name));
    await Promise.all(deletePromises);
  }

  // Conversation cache helpers
  async cacheConversation(conversationId: string, conversation: any, ttl: number = 1800) {
    await this.setCache(`conversation:${conversationId}`, conversation, ttl);
  }

  async getCachedConversation(conversationId: string) {
    return this.getCache(`conversation:${conversationId}`);
  }

  async invalidateConversationCache(conversationId: string) {
    await this.deleteCache(`conversation:${conversationId}`);
  }

  // User cache helpers
  async cacheUser(userId: string, user: any, ttl: number = 3600) {
    await this.setCache(`user:${userId}`, user, ttl);
  }

  async getCachedUser(userId: string) {
    return this.getCache(`user:${userId}`);
  }

  async invalidateUserCache(userId: string) {
    await this.deleteCache(`user:${userId}`);
  }

  // Advanced KV operations
  async setWithTags(key: string, value: any, ttl: number, tags: string[] = []) {
    const metadata = { tags, createdAt: nowISO() };
    await this.cache.put(key, JSON.stringify({ value, metadata }), { 
      expirationTtl: ttl,
      metadata: JSON.stringify(metadata)
    });
  }

  async invalidateByTag(tag: string) {
    const keys = await this.cache.list();
    const keysToDelete = keys.keys.filter(key => {
      const metadata = key.metadata ? JSON.parse(key.metadata as string) : null;
      return metadata?.tags?.includes(tag);
    });

    const deletePromises = keysToDelete.map(key => this.cache.delete(key.name));
    await Promise.all(deletePromises);
    
    return keysToDelete.length;
  }

  // Rate limiting
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = nowMs();
    const windowStart = now - (windowSeconds * 1000);
    const rateLimitKey = `rate_limit:${key}`;
    
    const current = await this.getCache(rateLimitKey) || { count: 0, windowStart: now };
    
    // Reset if window expired
    if (current.windowStart < windowStart) {
      current.count = 0;
      current.windowStart = now;
    }
    
    const allowed = current.count < limit;
    if (allowed) {
      current.count++;
      await this.setCache(rateLimitKey, current, windowSeconds);
    }
    
    return {
      allowed,
      remaining: Math.max(0, limit - current.count),
      resetTime: current.windowStart + (windowSeconds * 1000)
    };
  }

  // Distributed locks
  async acquireLock(lockKey: string, ttl: number = 30): Promise<string | null> {
    const lockId = `${nowMs()}-${Math.random()}`;
    const lockData = { lockId, acquiredAt: nowISO() };
    
    // Try to acquire lock
    const existing = await this.getCache(`lock:${lockKey}`);
    if (existing) return null;
    
    await this.setCache(`lock:${lockKey}`, lockData, ttl);
    
    // Verify we got the lock (race condition check)
    const verification = await this.getCache(`lock:${lockKey}`);
    if (verification?.lockId === lockId) {
      return lockId;
    }
    
    return null;
  }

  async releaseLock(lockKey: string, lockId: string): Promise<boolean> {
    const existing = await this.getCache(`lock:${lockKey}`);
    if (existing?.lockId === lockId) {
      await this.deleteCache(`lock:${lockKey}`);
      return true;
    }
    return false;
  }

  // Pub/Sub simulation using KV
  async publishEvent(channel: string, event: any) {
    const eventKey = `event:${channel}:${nowMs()}`;
    await this.setCache(eventKey, event, 300); // 5 minutes TTL
    
    // Update channel index
    const indexKey = `channel:${channel}:index`;
    const currentIndex = await this.getCache(indexKey) || [];
    currentIndex.push(eventKey);
    
    // Keep only last 100 events
    if (currentIndex.length > 100) {
      const oldKey = currentIndex.shift();
      await this.deleteCache(oldKey);
    }
    
    await this.setCache(indexKey, currentIndex, 3600);
  }

  async getChannelEvents(channel: string, since?: number): Promise<any[]> {
    const indexKey = `channel:${channel}:index`;
    const eventKeys = await this.getCache(indexKey) || [];
    
    const events = [];
    for (const eventKey of eventKeys) {
      if (since && parseInt(eventKey.split(':')[2]) <= since) continue;
      
      const event = await this.getCache(eventKey);
      if (event) events.push(event);
    }
    
    return events;
  }
}

// Export types and schema
export * from './schema';
export type Database = ReturnType<typeof createDb>;