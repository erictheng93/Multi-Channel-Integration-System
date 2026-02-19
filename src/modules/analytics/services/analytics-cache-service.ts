// Analytics Cache Service - KV 快取層實作
// 提供統一的快取介面，支援多層次快取策略和自動過期管理
//
// NOTE: This service now supports Cache API routing for analytics data
// Keys starting with 'cache:analytics:' will automatically use FREE Cache API
// instead of paid KV operations.

import type { KVNamespace } from '@cloudflare/workers-types';
import type { AnalyticsResult } from '@modules/analytics/types/analytics-types';
import { HybridCacheService, shouldUseCacheAPI } from '@/services/cache-api-service';
import { nowISO } from '@/utils/timestamp'

/**
 * 快取鍵策略配置
 */
export interface CacheKeyStrategy {
  prefix: string;
  version: string;
  includeUserId?: boolean;
  includeTeamId?: boolean;
}

/**
 * 快取配置
 */
export interface CacheConfig {
  defaultTTL: number; // 默認快取時間（秒）
  shortTTL: number;   // 短期快取（秒）
  longTTL: number;    // 長期快取（秒）
  enabled: boolean;   // 是否啟用快取
  compression?: boolean; // 是否壓縮數據
}

/**
 * 快取統計數據
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  totalRequests: number;
}

/**
 * Analytics Cache Service
 * 提供快取管理，支援：
 * - 統一的快取鍵生成策略
 * - 自動過期機制
 * - 快取命中率追蹤
 * - 批量快取操作
 * - **Cache API 路由** (cache:analytics:* keys use FREE Cache API)
 *
 * Migration Note:
 * - Old prefix: analytics:cache:* (uses KV)
 * - New prefix: cache:analytics:* (uses FREE Cache API)
 * - Set useCacheAPI=true in config to enable automatic routing
 */
export class AnalyticsCacheService {
  private kv: KVNamespace;
  private hybridCache: HybridCacheService | null = null;
  private config: CacheConfig & { useCacheAPI?: boolean };
  private stats: CacheStats;

  // 快取鍵前綴常量 - Updated to use Cache API-compatible prefix
  private static readonly CACHE_PREFIX = 'cache:analytics';  // Changed from 'analytics:cache'
  private static readonly STATS_PREFIX = 'analytics:stats';
  private static readonly VERSION = 'v1';

  constructor(kv: KVNamespace, config?: Partial<CacheConfig & { useCacheAPI?: boolean }>) {
    this.kv = kv;
    this.config = {
      defaultTTL: 300,      // 5 minutes
      shortTTL: 60,         // 1 minute
      longTTL: 1800,        // 30 minutes
      enabled: true,
      compression: false,
      useCacheAPI: true,    // Enable Cache API by default
      ...config
    };
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      totalRequests: 0
    };

    // Initialize HybridCacheService for Cache API routing
    if (this.config.useCacheAPI) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.hybridCache = new HybridCacheService(kv as any);
    }
  }

  /**
   * Check if key should use Cache API
   */
  private shouldUseCacheAPI(key: string): boolean {
    return this.config.useCacheAPI === true && shouldUseCacheAPI(key);
  }

  /**
   * 生成快取鍵
   * 使用查詢參數和用戶上下文生成唯一的快取鍵
   */
  generateCacheKey(
    queryType: string,
    params: Record<string, any>,
    strategy?: Partial<CacheKeyStrategy>
  ): string {
    const keyStrategy: CacheKeyStrategy = {
      prefix: AnalyticsCacheService.CACHE_PREFIX,
      version: AnalyticsCacheService.VERSION,
      includeUserId: false,
      includeTeamId: false,
      ...strategy
    };

    // 構建鍵的組成部分
    const parts: string[] = [
      keyStrategy.prefix,
      keyStrategy.version,
      queryType
    ];

    // 添加用戶和團隊 ID（如果需要）
    if (keyStrategy.includeUserId && params.userId) {
      parts.push(`user:${params.userId}`);
    }
    if (keyStrategy.includeTeamId && params.teamId) {
      parts.push(`team:${params.teamId}`);
    }

    // 對查詢參數進行排序和序列化
    const sortedParams = this.sortAndSerializeParams(params);

    // 使用 MD5 hash 壓縮參數（簡化實作，實際可用 crypto API）
    const paramHash = this.simpleHash(sortedParams);
    parts.push(paramHash);

    return parts.join(':');
  }

  /**
   * 獲取快取數據
   * Automatically routes to Cache API for cache:analytics:* keys (FREE)
   */
  async get<T = any>(
    cacheKey: string
  ): Promise<AnalyticsResult<T> | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      let cachedData: AnalyticsResult<T> | null = null;

      // Use Cache API for compatible keys
      if (this.shouldUseCacheAPI(cacheKey) && this.hybridCache) {
        cachedData = await this.hybridCache.get<AnalyticsResult<T>>(cacheKey);
      } else {
        // Fallback to direct KV
        cachedData = await this.kv.get(cacheKey, 'json') as AnalyticsResult<T> | null;
      }

      this.stats.totalRequests++;

      if (cachedData) {
        this.stats.hits++;
        this.updateHitRate();

        // 更新元數據中的 cacheHit 標記
        if (cachedData && typeof cachedData === 'object' && 'metadata' in cachedData) {
          (cachedData as any).metadata.cacheHit = true;
          (cachedData as any).metadata.cacheSource = this.shouldUseCacheAPI(cacheKey) ? 'cache-api' : 'kv';
        }

        return cachedData as AnalyticsResult<T>;
      }

      this.stats.misses++;
      this.updateHitRate();
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * 設置快取數據
   * Automatically routes to Cache API for cache:analytics:* keys (FREE)
   */
  async set<T = any>(
    cacheKey: string,
    data: AnalyticsResult<T>,
    ttl?: number
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const expirationTtl = ttl || this.config.defaultTTL;

      // 確保元數據中有 cacheHit 標記
      const dataToCache = {
        ...data,
        metadata: {
          ...data.metadata,
          cacheHit: false,
          cachedAt: nowISO(),
          cacheExpiry: new Date(Date.now() + expirationTtl * 1000).toISOString(),
          cacheSource: this.shouldUseCacheAPI(cacheKey) ? 'cache-api' : 'kv'
        }
      };

      // Use Cache API for compatible keys (FREE)
      if (this.shouldUseCacheAPI(cacheKey) && this.hybridCache) {
        const result = await this.hybridCache.set(cacheKey, dataToCache, {
          ttl: expirationTtl,
          tags: ['analytics']
        });
        if (result) {
          this.stats.sets++;
        }
        return result;
      }

      // Fallback to direct KV
      await this.kv.put(
        cacheKey,
        JSON.stringify(dataToCache),
        {
          expirationTtl
        }
      );

      this.stats.sets++;
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * 刪除快取數據
   * Automatically routes to Cache API for cache:analytics:* keys (FREE)
   */
  async delete(cacheKey: string): Promise<boolean> {
    try {
      // Use Cache API for compatible keys
      if (this.shouldUseCacheAPI(cacheKey) && this.hybridCache) {
        const result = await this.hybridCache.delete(cacheKey);
        if (result) {
          this.stats.deletes++;
        }
        return result;
      }

      // Fallback to direct KV
      await this.kv.delete(cacheKey);
      this.stats.deletes++;
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * 批量刪除快取（按前綴）
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    try {
      let deletedCount = 0;
      const listOptions: KVNamespaceListOptions = { prefix };
      let cursor: string | undefined;

      do {
        const list = await this.kv.list({ ...listOptions, cursor });

        for (const key of list.keys) {
          await this.kv.delete(key.name);
          deletedCount++;
        }

        // Check if there's a cursor for the next iteration
        cursor = !list.list_complete && 'cursor' in list ? (list as any).cursor : undefined;
      } while (cursor);

      this.stats.deletes += deletedCount;
      return deletedCount;
    } catch (error) {
      console.error('Cache deleteByPrefix error:', error);
      return 0;
    }
  }

  /**
   * 清除特定類型的快取
   */
  async invalidateQueryType(queryType: string): Promise<number> {
    const prefix = `${AnalyticsCacheService.CACHE_PREFIX}:${AnalyticsCacheService.VERSION}:${queryType}`;
    return await this.deleteByPrefix(prefix);
  }

  /**
   * 清除用戶相關的快取
   */
  async invalidateUser(userId: number): Promise<number> {
    const prefix = `${AnalyticsCacheService.CACHE_PREFIX}:${AnalyticsCacheService.VERSION}:*:user:${userId}`;
    return await this.deleteByPrefix(prefix);
  }

  /**
   * 清除團隊相關的快取
   */
  async invalidateTeam(teamId: number): Promise<number> {
    const prefix = `${AnalyticsCacheService.CACHE_PREFIX}:${AnalyticsCacheService.VERSION}:*:team:${teamId}`;
    return await this.deleteByPrefix(prefix);
  }

  /**
   * 清除所有分析快取
   */
  async clearAll(): Promise<number> {
    return await this.deleteByPrefix(AnalyticsCacheService.CACHE_PREFIX);
  }

  /**
   * 獲取快取統計數據
   */
  async getStats(): Promise<CacheStats> {
    return { ...this.stats };
  }

  /**
   * 重置統計數據
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      totalRequests: 0
    };
  }

  /**
   * 保存統計數據到 KV（用於跨請求持久化）
   */
  async persistStats(): Promise<void> {
    try {
      const statsKey = `${AnalyticsCacheService.STATS_PREFIX}:metrics`;
      await this.kv.put(statsKey, JSON.stringify(this.stats), {
        expirationTtl: 86400 // 24小時
      });
    } catch (error) {
      console.error('Error persisting cache stats:', error);
    }
  }

  /**
   * 從 KV 加載統計數據
   */
  async loadStats(): Promise<void> {
    try {
      const statsKey = `${AnalyticsCacheService.STATS_PREFIX}:metrics`;
      const savedStats = await this.kv.get(statsKey, 'json');

      if (savedStats) {
        this.stats = savedStats as CacheStats;
      }
    } catch (error) {
      console.error('Error loading cache stats:', error);
    }
  }

  /**
   * 檢查快取是否存在
   */
  async exists(cacheKey: string): Promise<boolean> {
    try {
      const value = await this.kv.get(cacheKey);
      return value !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * 獲取快取過期時間
   */
  async getExpiration(cacheKey: string): Promise<number | null> {
    try {
      await this.kv.getWithMetadata(cacheKey);
      // KV metadata doesn't typically include expiration, return null
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 根據查詢類型決定 TTL
   */
  getTTLForQueryType(queryType: string, timeRange?: string): number {
    // 實時查詢使用短期快取
    if (queryType.includes('realtime') || timeRange === '1h') {
      return this.config.shortTTL;
    }

    // 歷史查詢使用長期快取
    if (timeRange === '90d' || timeRange === '1y') {
      return this.config.longTTL;
    }

    // 默認使用標準快取
    return this.config.defaultTTL;
  }

  // ============ 私有輔助方法 ============

  /**
   * 對查詢參數進行排序和序列化
   */
  private sortAndSerializeParams(params: Record<string, any>): string {
    const sortedKeys = Object.keys(params).sort();
    const sortedParams = sortedKeys.map(key => {
      const value = params[key];
      // 處理對象和數組
      if (typeof value === 'object' && value !== null) {
        return `${key}:${JSON.stringify(value)}`;
      }
      return `${key}:${value}`;
    });
    return sortedParams.join('|');
  }

  /**
   * 簡單的字符串 hash 函數（用於生成快取鍵）
   * 在生產環境中可以使用 crypto.subtle.digest 實現 MD5/SHA-256
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 10);
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    if (this.stats.totalRequests > 0) {
      this.stats.hitRate = Math.round((this.stats.hits / this.stats.totalRequests) * 10000) / 100;
    }
  }
}

/**
 * 快取裝飾器工廠函數
 * 用於自動為方法添加快取功能
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  cacheService: AnalyticsCacheService,
  cacheKeyGenerator: (args: Parameters<T>) => string,
  ttl?: number
) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: Parameters<T>) {
      const cacheKey = cacheKeyGenerator(args);

      // 嘗試從快取獲取
      const cachedResult = await cacheService.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // 執行原始方法
      const result = await originalMethod.apply(this, args);

      // 儲存到快取
      await cacheService.set(cacheKey, result, ttl);

      return result;
    };

    return descriptor;
  };
}

/**
 * 快取預熱工具
 * 用於在系統啟動或低流量時段預先載入常用查詢
 */
export class CacheWarmer {
  constructor(
    _cacheService: AnalyticsCacheService,
    private analyticsService: any // AnalyticsService 實例
  ) {}

  /**
   * 預熱常用查詢
   */
  async warmupCommonQueries(): Promise<void> {
    const commonQueries = [
      { type: 'conversation', timeRange: '24h' },
      { type: 'conversation', timeRange: '7d' },
      { type: 'message', timeRange: '24h' },
      { type: 'user', timeRange: '7d' }
    ];

    for (const query of commonQueries) {
      try {
        // 根據查詢類型調用對應方法
        switch (query.type) {
          case 'conversation':
            await this.analyticsService.getConversationAnalytics(query);
            break;
          case 'message':
            await this.analyticsService.getMessageAnalytics(query);
            break;
          case 'user':
            await this.analyticsService.getUserAnalytics(query);
            break;
        }
      } catch (error) {
        console.error(`Cache warmup failed for query ${JSON.stringify(query)}:`, error);
      }
    }
  }

  /**
   * 定期刷新快取
   */
  async scheduleRefresh(intervalMs: number = 300000): Promise<void> {
    // 每 5 分鐘刷新一次常用查詢
    setInterval(() => {
      this.warmupCommonQueries().catch(error => {
        console.error('Scheduled cache refresh failed:', error);
      });
    }, intervalMs);
  }
}