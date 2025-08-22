// src/utils/performance.ts
// 性能優化工具

import type { Context } from 'hono';
import type { Bindings, QueryParams, DatabaseRow } from '../types';

// 快取管理器
export class CacheManager {
  private env: Bindings;
  private defaultTTL: number = 300; // 5 分鐘

  constructor(env: Bindings) {
    this.env = env;
  }

  // 生成快取鍵
  private generateKey(prefix: string, identifier: string | number, params?: Record<string, unknown>): string {
    const paramString = params ? `:${JSON.stringify(params)}` : '';
    return `cache:${prefix}:${identifier}${paramString}`;
  }

  // 獲取快取
  async get<T>(prefix: string, identifier: string | number, params?: Record<string, unknown>): Promise<T | null> {
    try {
      const key = this.generateKey(prefix, identifier, params);
      const cached = await this.env.SESSIONS.get(key);
      
      if (cached) {
        const data = JSON.parse(cached);
        // 檢查是否過期
        if (data.expiresAt && Date.now() > data.expiresAt) {
          await this.env.SESSIONS.delete(key);
          return null;
        }
        return data.value as T;
      }
      
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // 設置快取
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
        createdAt: Date.now(),
        expiresAt: Date.now() + (ttl * 1000)
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
    params: QueryParams = [],
    ttl: number = 300
  ): Promise<T | null> {
    // 先檢查快取
    const cached = await this.cache.get<T>('query', cacheKey);
    if (cached) {
      return cached;
    }

    // 執行查詢
    try {
      const result = await this.db.prepare(query).bind(...params).first();
      
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
      const promises = queries.map(({ query, params }) => 
        this.db.prepare(query).bind(...params).first()
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
      const [itemsResult, countResult] = await Promise.all([
        this.db.prepare(`${baseQuery} LIMIT ? OFFSET ?`).bind(...params, pageSize, offset).all(),
        this.db.prepare(countQuery).bind(...params).first()
      ]);

      const items = itemsResult.results as T[];
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

  // 設置 CORS 優化標頭
  static setCORSHeaders(c: Context): void {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    c.header('Access-Control-Max-Age', '86400'); // 24 小時
  }
}

// 連接池管理 (模擬)
export class ConnectionManager {
  private activeConnections: Map<string, number> = new Map();
  // private _maxConnections: number = 1000; // 暫時未使用

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
    const start = Date.now();
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
export function cacheMiddleware(ttl: number = 300) {
  return async (c: Context<{ Bindings: Bindings }>, next: () => Promise<void>) => {
    const method = c.req.method;
    
    // 只快取 GET 請求
    if (method !== 'GET') {
      return next();
    }
    
    const cacheKey = `http:${c.req.url}`;
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
      } catch (error) {
        // 忽略快取錯誤
      }
    }
  };
}