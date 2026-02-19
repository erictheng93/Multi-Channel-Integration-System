// src/utils/performance.ts
// 性能優化工具

import type { Context } from 'hono';
import type { Bindings, QueryParams, DatabaseRow } from '../types';
import { createDbClient } from '../db/drizzle-factory';
import { sql } from 'drizzle-orm';
import { KV_TTL } from '../config/kv-config';
import { KVKeyBuilder } from '../services/kv-management-service';
import { nowMs } from '@/utils/timestamp'

// 快取管理器
export class CacheManager {
  private env: Bindings;
  private defaultTTL: number = KV_TTL.CACHE_QUERY; // 使用集中配置的 TTL

  constructor(env: Bindings) {
    this.env = env;
  }

  // 生成快取鍵
  private generateKey(prefix: string, identifier: string | number, params?: Record<string, unknown>): string {
    const paramString = params ? `:${JSON.stringify(params)}` : '';
    return `cache:${prefix}:${identifier}${paramString}`;
  }

  // 獲取快取
  // 注意：KV 自動處理 TTL 過期，不需要手動檢查
  async get<T>(prefix: string, identifier: string | number, params?: Record<string, unknown>): Promise<T | null> {
    try {
      const key = this.generateKey(prefix, identifier, params);
      const cached = await this.env.SESSIONS.get(key);

      if (cached) {
        const data = JSON.parse(cached);
        // KV expirationTtl 已自動處理過期，直接返回值
        return data.value as T;
      }

      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // 設置快取
  // 使用 KV 原生 expirationTtl，不再存儲冗餘的 expiresAt
  async set<T>(
    prefix: string,
    identifier: string | number,
    value: T,
    ttl: number = this.defaultTTL,
    params?: Record<string, unknown>
  ): Promise<void> {
    try {
      const key = this.generateKey(prefix, identifier, params);
      const data = {
        value,
        createdAt: nowMs(),
      };

      await this.env.SESSIONS.put(key, JSON.stringify(data), { expirationTtl: ttl });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  // 刪除快取
  async delete(prefix: string, identifier: string | number, params?: Record<string, unknown>): Promise<void> {
    try {
      const key = this.generateKey(prefix, identifier, params);
      await this.env.SESSIONS.delete(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  // 批量刪除快取
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.env.SESSIONS.list({ prefix: pattern });
      const deletePromises = keys.keys.map(key => this.env.SESSIONS.delete(key.name));
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }
}

// 資料庫查詢優化器
export class QueryOptimizer {
  private db: D1Database;
  private cache: CacheManager;

  constructor(db: D1Database, cache: CacheManager) {
    this.db = db;
    this.cache = cache;
  }

  // 快取查詢結果
  async cachedQuery<T>(
    cacheKey: string,
    query: string,
    _params: QueryParams = [],
    ttl: number = 300
  ): Promise<T | null> {
    // 先檢查快取
    const cached = await this.cache.get<T>('query', cacheKey);
    if (cached) {
      return cached;
    }

    // 執行查詢
    try {
      const drizzleDb = createDbClient(this.db);
      const result = await drizzleDb.get(sql.raw(query));
      
      if (result) {
        // 存入快取
        await this.cache.set('query', cacheKey, result as T, ttl);
      }
      
      return result as T;
    } catch (error) {
      console.error('Query error:', error);
      return null;
    }
  }

  // 批量查詢優化
  async batchQuery<T>(queries: Array<{ query: string; params: QueryParams }>): Promise<T[]> {
    try {
      const drizzleDb = createDbClient(this.db);
      const promises = queries.map(({ query }) => 
        drizzleDb.get(sql.raw(query))
      );
      
      const results = await Promise.all(promises);
      return results as T[];
    } catch (error) {
      console.error('Batch query error:', error);
      return [];
    }
  }

  // 分頁查詢優化
  async paginatedQuery<T>(
    baseQuery: string,
    countQuery: string,
    params: QueryParams,
    page: number = 1,
    pageSize: number = 20,
    cachePrefix?: string
  ): Promise<{ items: T[]; total: number; page: number; pageSize: number }> {
    const offset = (page - 1) * pageSize;
    
    try {
      // 如果有快取前綴，嘗試從快取獲取
      if (cachePrefix) {
        const cacheKey = `${cachePrefix}:${page}:${pageSize}:${JSON.stringify(params)}`;
        const cached = await this.cache.get<{ items: T[]; total: number }>('paginated', cacheKey);
        if (cached) {
          return { ...cached, page, pageSize };
        }
      }

      // 並行執行資料查詢和計數查詢
      const drizzleDb = createDbClient(this.db);
      const [itemsResult, countResult] = await Promise.all([
        drizzleDb.run(sql.raw(`${baseQuery} LIMIT ${pageSize} OFFSET ${offset}`)),
        drizzleDb.get(sql.raw(countQuery))
      ]);

      const items = (itemsResult.results || []) as T[];
      const total = (countResult as DatabaseRow)?.total as number || 0;

      // 如果有快取前綴，存入快取
      if (cachePrefix) {
        const cacheKey = `${cachePrefix}:${page}:${pageSize}:${JSON.stringify(params)}`;
        await this.cache.set('paginated', cacheKey, { items, total }, 60); // 1 分鐘快取
      }

      return { items, total, page, pageSize };
    } catch (error) {
      console.error('Paginated query error:', error);
      return { items: [], total: 0, page, pageSize };
    }
  }
}

// HTTP 回應優化
export class ResponseOptimizer {
  // 設置快取標頭
  static setCacheHeaders(c: Context, maxAge: number = 300, etag?: string): void {
    c.header('Cache-Control', `public, max-age=${maxAge}`);
    if (etag) {
      c.header('ETag', `"${etag}"`);
    }
    c.header('Vary', 'Accept-Encoding, Authorization');
  }

  // 檢查條件請求
  static checkConditionalRequest(c: Context, etag: string): boolean {
    const ifNoneMatch = c.req.header('If-None-Match');
    return ifNoneMatch === `"${etag}"`;
  }

  // 壓縮回應
  static setCompressionHeaders(c: Context): void {
    const acceptEncoding = c.req.header('Accept-Encoding') || '';
    
    if (acceptEncoding.includes('gzip')) {
      c.header('Content-Encoding', 'gzip');
    } else if (acceptEncoding.includes('deflate')) {
      c.header('Content-Encoding', 'deflate');
    }
  }

  // 設置 CORS 優化標頭（統一配置版本）
  static setCORSHeaders(c: Context): void {
    // ✅ 使用統一的 CORS 配置，從環境變量動態讀取
    const origin = c.req.header('Origin');

    // 使用集中式 CORS 配置
    const { isOriginAllowed } = require('../config/cors');
    const isAllowed = origin && isOriginAllowed(origin, c.env);

    if (isAllowed) {
      c.header('Access-Control-Allow-Origin', origin!);
      c.header('Access-Control-Allow-Credentials', 'true');
      console.log(`✅ [Performance CORS] Allowed origin: ${origin}`);
    } else if (origin) {
      console.warn(`⚠️ [Performance CORS] Rejected origin: ${origin}`);
      // 不設置 CORS 標頭，讓瀏覽器阻止請求
    }

    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    c.header('Access-Control-Max-Age', '86400'); // 24 小時
  }
}

// 連接池管理 (模擬)
export class ConnectionManager {
  private activeConnections: Map<string, number> = new Map();

  // 檢查連接限制
  checkConnectionLimit(userId: string): boolean {
    const current = this.activeConnections.get(userId) || 0;
    return current < 5; // 每個用戶最多 5 個連接
  }

  // 添加連接
  addConnection(userId: string): void {
    const current = this.activeConnections.get(userId) || 0;
    this.activeConnections.set(userId, current + 1);
  }

  // 移除連接
  removeConnection(userId: string): void {
    const current = this.activeConnections.get(userId) || 0;
    if (current > 1) {
      this.activeConnections.set(userId, current - 1);
    } else {
      this.activeConnections.delete(userId);
    }
  }

  // 獲取總連接數
  getTotalConnections(): number {
    return Array.from(this.activeConnections.values()).reduce((sum, count) => sum + count, 0);
  }

  // 清理閒置連接
  cleanupIdleConnections(): void {
    // 實際實作中可以根據時間戳清理
    console.log(`Total active connections: ${this.getTotalConnections()}`);
  }
}

// 性能監控
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  // 記錄執行時間
  recordExecutionTime(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const times = this.metrics.get(operation)!;
    times.push(duration);
    
    // 只保留最近 100 次記錄
    if (times.length > 100) {
      times.shift();
    }
  }

  // 獲取平均執行時間
  getAverageExecutionTime(operation: string): number {
    const times = this.metrics.get(operation);
    if (!times || times.length === 0) return 0;
    
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  // 獲取所有指標
  getAllMetrics(): Record<string, { average: number; count: number; latest: number }> {
    const result: Record<string, { average: number; count: number; latest: number }> = {};
    
    for (const [operation, times] of this.metrics) {
      result[operation] = {
        average: this.getAverageExecutionTime(operation),
        count: times.length,
        latest: times[times.length - 1] || 0
      };
    }
    
    return result;
  }
}

// 中間件：性能監控
export function performanceMiddleware() {
  const monitor = new PerformanceMonitor();
  
  return async (c: Context, next: () => Promise<void>) => {
    const start = nowMs();
    const path = c.req.path;
    
    await next();
    
    const duration = Date.now() - start;
    monitor.recordExecutionTime(path, duration);
    
    // 添加性能標頭
    c.header('X-Response-Time', `${duration}ms`);
    
    // 如果響應時間過長，記錄警告
    if (duration > 1000) {
      console.warn(`Slow response: ${path} took ${duration}ms`);
    }
  };
}

// 中間件：快取
// 使用集中配置的 TTL
export function cacheMiddleware(ttl: number = KV_TTL.CACHE_HTTP) {
  return async (c: Context<{ Bindings: Bindings }>, next: () => Promise<void>) => {
    const method = c.req.method;

    // 只快取 GET 請求
    if (method !== 'GET') {
      return next();
    }

    const cacheKey = KVKeyBuilder.cacheHttp(c.req.url);
    const cache = new CacheManager(c.env);

    // 檢查快取
    const cached = await cache.get('http', cacheKey);
    if (cached) {
      ResponseOptimizer.setCacheHeaders(c, ttl);
      return c.json(cached);
    }

    // 執行請求
    await next();

    // 如果是成功回應，存入快取
    if (c.res.status === 200) {
      try {
        const responseData = await c.res.clone().json();
        await cache.set('http', cacheKey, responseData, ttl);
      } catch {
        // 忽略快取錯誤
      }
    }
  };
}