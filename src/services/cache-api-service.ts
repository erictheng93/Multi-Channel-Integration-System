import { nowMs } from '@/utils/timestamp'
/**
 * Cache API Service
 *
 * Replaces KV-based caching with Cloudflare Cache API for:
 * - Analytics data (cache:analytics:*)
 * - Report data (cache:report:*)
 * - Dashboard data (cache:dashboard:*)
 * - Health check results (cache:health)
 * - HTTP response caching (cache:http:*)
 *
 * Benefits:
 * - Completely FREE (no KV quota usage)
 * - Automatic CDN-level caching
 * - Built-in cache invalidation via Cache-Control headers
 * - Better performance for geographically distributed reads
 *
 * Note: Cache API uses Request/Response objects, so we wrap keys as internal URLs
 *
 * @module services/cache-api-service
 */

// =================== Types ===================

export interface CacheOptions {
  /** TTL in seconds */
  ttl?: number;
  /** Cache tags for grouped invalidation */
  tags?: string[];
  /** Whether to skip cache and always fetch fresh */
  skipCache?: boolean;
  /** Custom cache namespace (default: 'default') */
  namespace?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  writes: number;
  deletes: number;
  lastReset: number;
}

// =================== Constants ===================

const CACHE_BASE_URL = 'https://cache.internal';

// Default TTLs (in seconds) - mirrors KV_TTL from kv-config.ts
export const CACHE_TTL = {
  ANALYTICS: 3600, // 1 hour
  REPORT: 3600, // 1 hour
  DASHBOARD: 3600, // 1 hour
  HEALTH: 60, // 1 minute
  HTTP: 300, // 5 minutes
  QUERY: 300, // 5 minutes
  PAGINATED: 60, // 1 minute
  QR_CODE: 86400, // 24 hours
  AGENT_STATUS: 300, // 5 minutes
  AGENT_SKILLS: 3600, // 1 hour
} as const;

// Cache key prefixes that should use Cache API instead of KV
export const CACHE_API_PREFIXES = [
  'cache:analytics:',
  'cache:report:',
  'cache:dashboard:',
  'cache:health',
  'cache:http:',
  'cache:query:',
  'cache:paginated:',
] as const;

// =================== In-Memory Stats ===================

const stats: CacheStats = {
  hits: 0,
  misses: 0,
  writes: 0,
  deletes: 0,
  lastReset: nowMs()
};

// =================== Helper Functions ===================

/**
 * Convert a cache key to a Request object for Cache API
 */
function keyToRequest(key: string, namespace: string = 'default'): Request {
  const url = `${CACHE_BASE_URL}/${namespace}/${encodeURIComponent(key)}`;
  return new Request(url);
}

/**
 * Create a Response object with appropriate cache headers
 */
function createCacheResponse(
  data: unknown,
  ttl: number,
  tags?: string[]
): Response {
  const body = JSON.stringify(data);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Cache-Control': `public, max-age=${ttl}`,
    'X-Cache-Created': Date.now().toString(),
  };

  if (tags && tags.length > 0) {
    headers['X-Cache-Tags'] = tags.join(',');
  }

  return new Response(body, { headers });
}

/**
 * Determine TTL based on key prefix
 */
function getTTLForKey(key: string): number {
  if (key.startsWith('cache:analytics:')) return CACHE_TTL.ANALYTICS;
  if (key.startsWith('cache:report:')) return CACHE_TTL.REPORT;
  if (key.startsWith('cache:dashboard:')) return CACHE_TTL.DASHBOARD;
  if (key.startsWith('cache:health')) return CACHE_TTL.HEALTH;
  if (key.startsWith('cache:http:')) return CACHE_TTL.HTTP;
  if (key.startsWith('cache:query:')) return CACHE_TTL.QUERY;
  if (key.startsWith('cache:paginated:')) return CACHE_TTL.PAGINATED;
  if (key.startsWith('cache:qr:')) return CACHE_TTL.QR_CODE;
  if (key.startsWith('cache:agent:status:')) return CACHE_TTL.AGENT_STATUS;
  if (key.startsWith('cache:agent:skills:')) return CACHE_TTL.AGENT_SKILLS;
  return CACHE_TTL.HTTP; // Default
}

/**
 * Check if a key should use Cache API (vs KV)
 */
export function shouldUseCacheAPI(key: string): boolean {
  return CACHE_API_PREFIXES.some(prefix => key.startsWith(prefix));
}

// =================== Main Cache API Service ===================

/**
 * CacheAPIService - Wrapper around Cloudflare Cache API
 *
 * @example
 * const cacheService = new CacheAPIService();
 *
 * // Store data
 * await cacheService.set('cache:analytics:daily', analyticsData, { ttl: 3600 });
 *
 * // Retrieve data
 * const data = await cacheService.get<AnalyticsData>('cache:analytics:daily');
 *
 * // Delete data
 * await cacheService.delete('cache:analytics:daily');
 *
 * // Delete by pattern (using tags)
 * await cacheService.deleteByTag('analytics');
 */
export class CacheAPIService {
  private cache: Cache | null = null;
  private namespace: string;

  constructor(namespace: string = 'default') {
    this.namespace = namespace;
  }

  /**
   * Get the cache instance (lazy initialization)
   */
  private async getCache(): Promise<Cache> {
    if (!this.cache) {
      this.cache = await caches.open(this.namespace);
    }
    return this.cache;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    if (options?.skipCache) {
      stats.misses++;
      return null;
    }

    try {
      const cache = await this.getCache();
      const request = keyToRequest(key, options?.namespace || this.namespace);
      const response = await cache.match(request);

      if (!response) {
        stats.misses++;
        return null;
      }

      // Check if expired via custom header
      const createdAt = response.headers.get('X-Cache-Created');
      const cacheControl = response.headers.get('Cache-Control');

      if (createdAt && cacheControl) {
        const maxAge = parseInt(cacheControl.match(/max-age=(\d+)/)?.[1] || '0');
        const age = (Date.now() - parseInt(createdAt)) / 1000;

        if (age > maxAge) {
          // Cache entry has expired
          stats.misses++;
          await this.delete(key);
          return null;
        }
      }

      stats.hits++;
      const data = await response.json() as T;
      return data;
    } catch (error) {
      console.error('[CacheAPIService] Error getting cache:', error);
      stats.misses++;
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<boolean> {
    try {
      const cache = await this.getCache();
      const ttl = options?.ttl ?? getTTLForKey(key);
      const request = keyToRequest(key, options?.namespace || this.namespace);
      const response = createCacheResponse(value, ttl, options?.tags);

      await cache.put(request, response);
      stats.writes++;
      return true;
    } catch (error) {
      console.error('[CacheAPIService] Error setting cache:', error);
      return false;
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const cache = await this.getCache();
      const request = keyToRequest(key, options?.namespace || this.namespace);
      const deleted = await cache.delete(request);
      if (deleted) {
        stats.deletes++;
      }
      return deleted;
    } catch (error) {
      console.error('[CacheAPIService] Error deleting cache:', error);
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Compute the value
    const value = await factory();

    // Store in cache (fire and forget)
    this.set(key, value, options).catch(err => {
      console.error('[CacheAPIService] Background cache set failed:', err);
    });

    return value;
  }

  /**
   * Check if a key exists in cache
   */
  async has(key: string, options?: CacheOptions): Promise<boolean> {
    const value = await this.get(key, options);
    return value !== null;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: string } {
    const total = stats.hits + stats.misses;
    const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(2) + '%' : '0%';
    return { ...stats, hitRate };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    stats.hits = 0;
    stats.misses = 0;
    stats.writes = 0;
    stats.deletes = 0;
    stats.lastReset = nowMs();
  }
}

// =================== Singleton Instance ===================

let defaultInstance: CacheAPIService | null = null;

/**
 * Get the default Cache API service instance
 */
export function getCacheAPIService(): CacheAPIService {
  if (!defaultInstance) {
    defaultInstance = new CacheAPIService();
  }
  return defaultInstance;
}

// =================== Hybrid Cache Service ===================

/**
 * HybridCacheService - Automatically routes to Cache API or KV based on key
 *
 * This service provides a transparent migration path:
 * - Keys matching CACHE_API_PREFIXES → Cache API (free)
 * - Other keys → KV (original behavior)
 *
 * @example
 * const cache = new HybridCacheService(env.CACHE);
 *
 * // Automatically uses Cache API
 * await cache.set('cache:analytics:daily', data);
 *
 * // Automatically uses KV
 * await cache.set('credentials:line', encryptedData);
 */
export class HybridCacheService {
  private cacheAPI: CacheAPIService;
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.cacheAPI = getCacheAPIService();
    this.kv = kv;
  }

  /**
   * Get a value - routes to Cache API or KV based on key
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    if (shouldUseCacheAPI(key)) {
      return this.cacheAPI.get<T>(key, options);
    }

    // Use KV
    try {
      const value = await this.kv.get(key, 'json');
      return value as T | null;
    } catch (error) {
      console.error('[HybridCacheService] KV get error:', error);
      return null;
    }
  }

  /**
   * Set a value - routes to Cache API or KV based on key
   */
  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions & { expirationTtl?: number }
  ): Promise<boolean> {
    if (shouldUseCacheAPI(key)) {
      return this.cacheAPI.set(key, value, options);
    }

    // Use KV
    try {
      const ttl = options?.expirationTtl || options?.ttl;
      await this.kv.put(key, JSON.stringify(value), {
        ...(ttl && { expirationTtl: ttl })
      });
      return true;
    } catch (error) {
      console.error('[HybridCacheService] KV set error:', error);
      return false;
    }
  }

  /**
   * Delete a value - routes to Cache API or KV based on key
   */
  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    if (shouldUseCacheAPI(key)) {
      return this.cacheAPI.delete(key, options);
    }

    // Use KV
    try {
      await this.kv.delete(key);
      return true;
    } catch (error) {
      console.error('[HybridCacheService] KV delete error:', error);
      return false;
    }
  }

  /**
   * Get or set pattern
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions & { expirationTtl?: number }
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Get statistics for Cache API portion
   */
  getCacheAPIStats(): CacheStats & { hitRate: string } {
    return this.cacheAPI.getStats();
  }
}

// =================== Export Default ===================

export default CacheAPIService;
