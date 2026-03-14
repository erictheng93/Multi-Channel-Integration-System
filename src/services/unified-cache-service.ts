/**
 * Unified Cache Service
 *
 * Provides a single entry point for all caching operations with:
 * - Automatic routing to Cache API (free) or KV based on key patterns
 * - Consistent key naming conventions
 * - Built-in statistics and monitoring
 * - Easy migration path from direct KV usage
 *
 * Usage:
 * const cache = createUnifiedCache(env);
 * await cache.analytics.set('daily:2024-01-15', data);
 * const result = await cache.analytics.get('daily:2024-01-15');
 *
 * @module services/unified-cache-service
 */

import { HybridCacheService, CacheAPIService, getCacheAPIService, CACHE_TTL } from './cache-api-service';
import type { Bindings } from '../types/bindings';

// =================== Types ===================

export interface UnifiedCacheStats {
  analytics: CacheNamespaceStats;
  reports: CacheNamespaceStats;
  dashboard: CacheNamespaceStats;
  total: {
    hits: number;
    misses: number;
    writes: number;
    deletes: number;
    hitRate: string;
    kvOperations: number;
    cacheAPIOperations: number;
  };
}

export interface CacheNamespaceStats {
  hits: number;
  misses: number;
  writes: number;
  deletes: number;
  hitRate: string;
}

// =================== Analytics Cache ===================

/**
 * Analytics-specific cache operations
 * Uses Cache API (FREE) for all analytics data
 */
export class AnalyticsCacheNamespace {
  private hybrid: HybridCacheService;
  private stats = { hits: 0, misses: 0, writes: 0, deletes: 0 };

  constructor(kv: KVNamespace) {
    this.hybrid = new HybridCacheService(kv);
  }

  /**
   * Build cache key with proper prefix
   */
  private buildKey(identifier: string): string {
    // Ensure key starts with cache:analytics: for Cache API routing
    if (identifier.startsWith('cache:analytics:')) {
      return identifier;
    }
    return `cache:analytics:${identifier}`;
  }

  /**
   * Get analytics data
   */
  async get<T>(identifier: string): Promise<T | null> {
    const key = this.buildKey(identifier);
    const result = await this.hybrid.get<T>(key);
    if (result !== null) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    return result;
  }

  /**
   * Set analytics data
   */
  async set<T>(identifier: string, value: T, ttl?: number): Promise<boolean> {
    const key = this.buildKey(identifier);
    const result = await this.hybrid.set(key, value, {
      ttl: ttl || CACHE_TTL.ANALYTICS,
      tags: ['analytics'],
    });
    if (result) {
      this.stats.writes++;
    }
    return result;
  }

  /**
   * Get or set pattern
   */
  async getOrSet<T>(
    identifier: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(identifier);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(identifier, value, ttl);
    return value;
  }

  /**
   * Delete analytics data
   */
  async delete(identifier: string): Promise<boolean> {
    const key = this.buildKey(identifier);
    const result = await this.hybrid.delete(key);
    if (result) {
      this.stats.deletes++;
    }
    return result;
  }

  /**
   * Get stats for this namespace
   */
  getStats(): CacheNamespaceStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + '%' : '0%';
    return { ...this.stats, hitRate };
  }

  /**
   * Reset stats
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, writes: 0, deletes: 0 };
  }
}

// =================== Reports Cache ===================

/**
 * Reports-specific cache operations
 * Uses Cache API (FREE) for all report data
 */
export class ReportsCacheNamespace {
  private hybrid: HybridCacheService;
  private stats = { hits: 0, misses: 0, writes: 0, deletes: 0 };

  constructor(kv: KVNamespace) {
    this.hybrid = new HybridCacheService(kv);
  }

  /**
   * Build cache key with proper prefix
   */
  private buildKey(identifier: string): string {
    if (identifier.startsWith('cache:report:')) {
      return identifier;
    }
    return `cache:report:${identifier}`;
  }

  /**
   * Get report data
   */
  async get<T>(identifier: string): Promise<T | null> {
    const key = this.buildKey(identifier);
    const result = await this.hybrid.get<T>(key);
    if (result !== null) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    return result;
  }

  /**
   * Set report data
   */
  async set<T>(identifier: string, value: T, ttl?: number): Promise<boolean> {
    const key = this.buildKey(identifier);
    const result = await this.hybrid.set(key, value, {
      ttl: ttl || CACHE_TTL.REPORT,
      tags: ['report'],
    });
    if (result) {
      this.stats.writes++;
    }
    return result;
  }

  /**
   * Get or set pattern
   */
  async getOrSet<T>(
    identifier: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(identifier);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(identifier, value, ttl);
    return value;
  }

  /**
   * Delete report data
   */
  async delete(identifier: string): Promise<boolean> {
    const key = this.buildKey(identifier);
    const result = await this.hybrid.delete(key);
    if (result) {
      this.stats.deletes++;
    }
    return result;
  }

  /**
   * Get stats for this namespace
   */
  getStats(): CacheNamespaceStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + '%' : '0%';
    return { ...this.stats, hitRate };
  }

  /**
   * Reset stats
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, writes: 0, deletes: 0 };
  }
}

// =================== Dashboard Cache ===================

/**
 * Dashboard-specific cache operations
 * Uses Cache API (FREE) for all dashboard data
 */
export class DashboardCacheNamespace {
  private hybrid: HybridCacheService;
  private stats = { hits: 0, misses: 0, writes: 0, deletes: 0 };

  constructor(kv: KVNamespace) {
    this.hybrid = new HybridCacheService(kv);
  }

  /**
   * Build cache key with proper prefix
   */
  private buildKey(identifier: string): string {
    if (identifier.startsWith('cache:dashboard:')) {
      return identifier;
    }
    return `cache:dashboard:${identifier}`;
  }

  /**
   * Get dashboard data
   */
  async get<T>(identifier: string): Promise<T | null> {
    const key = this.buildKey(identifier);
    const result = await this.hybrid.get<T>(key);
    if (result !== null) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    return result;
  }

  /**
   * Set dashboard data
   */
  async set<T>(identifier: string, value: T, ttl?: number): Promise<boolean> {
    const key = this.buildKey(identifier);
    const result = await this.hybrid.set(key, value, {
      ttl: ttl || CACHE_TTL.DASHBOARD,
      tags: ['dashboard'],
    });
    if (result) {
      this.stats.writes++;
    }
    return result;
  }

  /**
   * Get or set pattern
   */
  async getOrSet<T>(
    identifier: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(identifier);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(identifier, value, ttl);
    return value;
  }

  /**
   * Delete dashboard data
   */
  async delete(identifier: string): Promise<boolean> {
    const key = this.buildKey(identifier);
    const result = await this.hybrid.delete(key);
    if (result) {
      this.stats.deletes++;
    }
    return result;
  }

  /**
   * Get stats for this namespace
   */
  getStats(): CacheNamespaceStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + '%' : '0%';
    return { ...this.stats, hitRate };
  }

  /**
   * Reset stats
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, writes: 0, deletes: 0 };
  }
}

// =================== Query Cache ===================

/**
 * Query result cache operations
 * Uses Cache API (FREE) for query results
 */
export class QueryCacheNamespace {
  private hybrid: HybridCacheService;
  private stats = { hits: 0, misses: 0, writes: 0, deletes: 0 };

  constructor(kv: KVNamespace) {
    this.hybrid = new HybridCacheService(kv);
  }

  /**
   * Build cache key with proper prefix
   */
  private buildKey(identifier: string): string {
    if (identifier.startsWith('cache:query:')) {
      return identifier;
    }
    return `cache:query:${identifier}`;
  }

  /**
   * Generate cache key from query parameters
   */
  generateKey(queryType: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${JSON.stringify(params[key])}`)
      .join('|');

    // Simple hash for the key
    let hash = 0;
    for (let i = 0; i < sortedParams.length; i++) {
      hash = ((hash << 5) - hash) + sortedParams.charCodeAt(i);
      hash = hash & hash;
    }
    const hashStr = Math.abs(hash).toString(36).substring(0, 10);

    return `${queryType}:${hashStr}`;
  }

  /**
   * Get query result
   */
  async get<T>(identifier: string): Promise<T | null> {
    const key = this.buildKey(identifier);
    const result = await this.hybrid.get<T>(key);
    if (result !== null) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    return result;
  }

  /**
   * Set query result
   */
  async set<T>(identifier: string, value: T, ttl?: number): Promise<boolean> {
    const key = this.buildKey(identifier);
    const result = await this.hybrid.set(key, value, {
      ttl: ttl || CACHE_TTL.QUERY,
      tags: ['query'],
    });
    if (result) {
      this.stats.writes++;
    }
    return result;
  }

  /**
   * Get or set pattern
   */
  async getOrSet<T>(
    identifier: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(identifier);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(identifier, value, ttl);
    return value;
  }

  /**
   * Delete query result
   */
  async delete(identifier: string): Promise<boolean> {
    const key = this.buildKey(identifier);
    const result = await this.hybrid.delete(key);
    if (result) {
      this.stats.deletes++;
    }
    return result;
  }

  /**
   * Get stats for this namespace
   */
  getStats(): CacheNamespaceStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + '%' : '0%';
    return { ...this.stats, hitRate };
  }

  /**
   * Reset stats
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, writes: 0, deletes: 0 };
  }
}

// =================== KV-Only Cache (for non-Cache API data) ===================

/**
 * KV-only cache namespace for data that must use KV
 * (credentials, permanent config, etc.)
 */
export class KVOnlyCacheNamespace {
  private kv: KVNamespace;
  private stats = { hits: 0, misses: 0, writes: 0, deletes: 0 };

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Get data from KV only
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await this.kv.get(key, 'json');
      if (result !== null) {
        this.stats.hits++;
      } else {
        this.stats.misses++;
      }
      return result as T | null;
    } catch {
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set data to KV only
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      await this.kv.put(key, JSON.stringify(value), {
        ...(ttl && { expirationTtl: ttl }),
      });
      this.stats.writes++;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete data from KV
   */
  async delete(key: string): Promise<boolean> {
    try {
      await this.kv.delete(key);
      this.stats.deletes++;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get stats for this namespace
   */
  getStats(): CacheNamespaceStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + '%' : '0%';
    return { ...this.stats, hitRate };
  }

  /**
   * Reset stats
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, writes: 0, deletes: 0 };
  }
}

// =================== Unified Cache Service ===================

/**
 * Unified Cache Service
 *
 * Provides type-safe access to different cache namespaces with
 * automatic routing to Cache API or KV based on key patterns.
 */
export class UnifiedCacheService {
  public readonly analytics: AnalyticsCacheNamespace;
  public readonly reports: ReportsCacheNamespace;
  public readonly dashboard: DashboardCacheNamespace;
  public readonly query: QueryCacheNamespace;
  public readonly kv: KVOnlyCacheNamespace;

  private cacheAPIService: CacheAPIService;

  constructor(kvNamespace: KVNamespace) {
    this.analytics = new AnalyticsCacheNamespace(kvNamespace);
    this.reports = new ReportsCacheNamespace(kvNamespace);
    this.dashboard = new DashboardCacheNamespace(kvNamespace);
    this.query = new QueryCacheNamespace(kvNamespace);
    this.kv = new KVOnlyCacheNamespace(kvNamespace);
    this.cacheAPIService = getCacheAPIService();
  }

  /**
   * Get combined statistics from all namespaces
   */
  getStats(): UnifiedCacheStats {
    const analyticsStats = this.analytics.getStats();
    const reportsStats = this.reports.getStats();
    const dashboardStats = this.dashboard.getStats();
    const queryStats = this.query.getStats();
    const cacheAPIStats = this.cacheAPIService.getStats();

    const totalHits = analyticsStats.hits + reportsStats.hits + dashboardStats.hits + queryStats.hits;
    const totalMisses = analyticsStats.misses + reportsStats.misses + dashboardStats.misses + queryStats.misses;
    const totalWrites = analyticsStats.writes + reportsStats.writes + dashboardStats.writes + queryStats.writes;
    const totalDeletes = analyticsStats.deletes + reportsStats.deletes + dashboardStats.deletes + queryStats.deletes;
    const total = totalHits + totalMisses;
    const hitRate = total > 0 ? ((totalHits / total) * 100).toFixed(2) + '%' : '0%';

    return {
      analytics: analyticsStats,
      reports: reportsStats,
      dashboard: dashboardStats,
      total: {
        hits: totalHits,
        misses: totalMisses,
        writes: totalWrites,
        deletes: totalDeletes,
        hitRate,
        kvOperations: this.kv.getStats().writes + this.kv.getStats().hits,
        cacheAPIOperations: cacheAPIStats.hits + cacheAPIStats.writes,
      },
    };
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.analytics.resetStats();
    this.reports.resetStats();
    this.dashboard.resetStats();
    this.query.resetStats();
    this.kv.resetStats();
    this.cacheAPIService.resetStats();
  }

  /**
   * Get Cache API service for direct access if needed
   */
  getCacheAPIService(): CacheAPIService {
    return this.cacheAPIService;
  }
}

// =================== Factory Function ===================

let cachedInstance: UnifiedCacheService | null = null;

/**
 * Create or get a UnifiedCacheService instance
 *
 * @example
 * const cache = createUnifiedCache(env);
 *
 * // Analytics data (uses Cache API - FREE)
 * await cache.analytics.set('daily:2024-01-15', analyticsData);
 *
 * // Report data (uses Cache API - FREE)
 * await cache.reports.set('monthly:2024-01', reportData);
 *
 * // Dashboard data (uses Cache API - FREE)
 * await cache.dashboard.set('user:123:default', dashboardConfig);
 *
 * // Query results (uses Cache API - FREE)
 * const result = await cache.query.getOrSet(
 * cache.query.generateKey('conversation', { teamId: 1, period: '7d' }),
 * () => fetchFromDatabase(),
 * 300
 * );
 *
 * // Credentials (uses KV - required for persistent data)
 * await cache.kv.set('credentials:line:token', encryptedToken, 0);
 */
export function createUnifiedCache(env: Bindings): UnifiedCacheService {
  // For now, create a new instance each time
  // In production, you might want to cache this per request context
  return new UnifiedCacheService(env.CACHE);
}

/**
 * Get singleton instance (for use within same request context)
 */
export function getUnifiedCache(env: Bindings): UnifiedCacheService {
  if (!cachedInstance) {
    cachedInstance = createUnifiedCache(env);
  }
  return cachedInstance;
}

// =================== Migration Helpers ===================

/**
 * Helper to migrate existing cache keys to new format
 */
export async function migrateAnalyticsCacheKey(
  kv: KVNamespace,
  oldKey: string,
  deleteOld: boolean = false
): Promise<boolean> {
  try {
    // Get value from old key
    const value = await kv.get(oldKey, 'json');
    if (!value) return false;

    // Build new key with proper prefix
    let newKey = oldKey;
    if (oldKey.startsWith('analytics:cache:')) {
      newKey = oldKey.replace('analytics:cache:', 'cache:analytics:');
    } else if (!oldKey.startsWith('cache:analytics:')) {
      newKey = `cache:analytics:${oldKey}`;
    }

    // Write to Cache API via HybridCacheService
    const hybrid = new HybridCacheService(kv);
    await hybrid.set(newKey, value, { ttl: CACHE_TTL.ANALYTICS });

    // Delete old key if requested
    if (deleteOld && newKey !== oldKey) {
      await kv.delete(oldKey);
    }

    return true;
  } catch (error) {
    console.error('[MigrateCache] Error migrating key:', oldKey, error);
    return false;
  }
}

// =================== Export ===================

export default UnifiedCacheService;
