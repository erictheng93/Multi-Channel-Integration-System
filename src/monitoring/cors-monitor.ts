// CORS 錯誤監控系統
// 用於追蹤和分析 CORS 相關的錯誤和訪問模式

import type { Context } from 'hono';
import type { Bindings } from '@/types';

/**
 * CORS 監控事件類型
 */
export type CORSEventType =
  | 'allowed'           // 允許的 origin
  | 'rejected'          // 被拒絕的 origin
  | 'preflight'         // OPTIONS preflight 請求
  | 'sse_connection'    // SSE 連接
  | 'credentials_used'; // 使用了 credentials

/**
 * CORS 事件記錄
 */
export interface CORSEvent {
  timestamp: string;
  type: CORSEventType;
  origin: string | null;
  path: string;
  method: string;
  userAgent?: string;
  statusCode?: number;
  errorMessage?: string;
}

/**
 * CORS 統計數據
 */
export interface CORSStats {
  total: number;
  allowed: number;
  rejected: number;
  preflightRequests: number;
  sseConnections: number;
  credentialsUsed: number;
  topOrigins: Array<{ origin: string; count: number }>;
  topRejectedOrigins: Array<{ origin: string; count: number }>;
  recentEvents: CORSEvent[];
}

/**
 * CORS 監控管理器
 */
export class CORSMonitor {
  private env: Bindings;
  private maxEventsInMemory: number = 100;
  private events: CORSEvent[] = [];

  constructor(env: Bindings) {
    this.env = env;
  }

  /**
   * 記錄 CORS 事件
   */
  async logEvent(event: Omit<CORSEvent, 'timestamp'>): Promise<void> {
    const fullEvent: CORSEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };

    // 添加到記憶體（用於即時查詢）
    this.events.push(fullEvent);
    if (this.events.length > this.maxEventsInMemory) {
      this.events.shift(); // 移除最舊的事件
    }

    // 記錄到 KV（用於持久化和統計）
    try {
      const key = `cors:event:${Date.now()}:${Math.random().toString(36).substring(7)}`;
      await this.env.SESSIONS.put(
        key,
        JSON.stringify(fullEvent),
        { expirationTtl: 86400 } // 24 小時後過期
      );
    } catch (error) {
      console.error('Failed to persist CORS event to KV:', error);
    }

    // 如果是被拒絕的請求，記錄警告
    if (event.type === 'rejected') {
      console.warn(`🚫 [CORS] Rejected origin: ${event.origin} - Path: ${event.path}`);
    }
  }

  /**
   * 記錄允許的請求
   */
  async logAllowed(c: Context, origin: string): Promise<void> {
    await this.logEvent({
      type: 'allowed',
      origin,
      path: c.req.path,
      method: c.req.method,
      userAgent: c.req.header('User-Agent'),
      statusCode: 200
    });
  }

  /**
   * 記錄被拒絕的請求
   */
  async logRejected(c: Context, origin: string | null, reason?: string): Promise<void> {
    await this.logEvent({
      type: 'rejected',
      origin,
      path: c.req.path,
      method: c.req.method,
      userAgent: c.req.header('User-Agent'),
      statusCode: 403,
      errorMessage: reason || 'Origin not in allowed list'
    });
  }

  /**
   * 記錄 preflight 請求
   */
  async logPreflight(c: Context, origin: string | null, allowed: boolean): Promise<void> {
    await this.logEvent({
      type: 'preflight',
      origin,
      path: c.req.path,
      method: c.req.method,
      userAgent: c.req.header('User-Agent'),
      statusCode: allowed ? 204 : 403
    });
  }

  /**
   * 記錄 SSE 連接
   */
  async logSSEConnection(c: Context, origin: string | null): Promise<void> {
    await this.logEvent({
      type: 'sse_connection',
      origin,
      path: c.req.path,
      method: c.req.method,
      userAgent: c.req.header('User-Agent')
    });
  }

  /**
   * 記錄使用 credentials 的請求
   */
  async logCredentialsUsed(c: Context, origin: string): Promise<void> {
    await this.logEvent({
      type: 'credentials_used',
      origin,
      path: c.req.path,
      method: c.req.method,
      userAgent: c.req.header('User-Agent')
    });
  }

  /**
   * 獲取統計數據
   */
  async getStats(): Promise<CORSStats> {
    // 從 KV 獲取最近 24 小時的事件
    const allEvents: CORSEvent[] = [...this.events];

    try {
      const kvEvents = await this.env.SESSIONS.list({ prefix: 'cors:event:' });
      for (const key of kvEvents.keys) {
        try {
          const eventData = await this.env.SESSIONS.get(key.name);
          if (eventData) {
            allEvents.push(JSON.parse(eventData));
          }
        } catch (error) {
          console.error(`Failed to parse CORS event ${key.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to fetch CORS events from KV:', error);
    }

    // 統計各類事件
    const allowed = allEvents.filter(e => e.type === 'allowed').length;
    const rejected = allEvents.filter(e => e.type === 'rejected').length;
    const preflightRequests = allEvents.filter(e => e.type === 'preflight').length;
    const sseConnections = allEvents.filter(e => e.type === 'sse_connection').length;
    const credentialsUsed = allEvents.filter(e => e.type === 'credentials_used').length;

    // 統計最常見的 origin
    const originCounts = new Map<string, number>();
    const rejectedOriginCounts = new Map<string, number>();

    for (const event of allEvents) {
      if (event.origin) {
        if (event.type === 'allowed' || event.type === 'credentials_used') {
          originCounts.set(event.origin, (originCounts.get(event.origin) || 0) + 1);
        }
        if (event.type === 'rejected') {
          rejectedOriginCounts.set(event.origin, (rejectedOriginCounts.get(event.origin) || 0) + 1);
        }
      }
    }

    // 排序並取前 10
    const topOrigins = Array.from(originCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([origin, count]) => ({ origin, count }));

    const topRejectedOrigins = Array.from(rejectedOriginCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([origin, count]) => ({ origin, count }));

    // 取最近 50 個事件
    const recentEvents = allEvents
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);

    return {
      total: allEvents.length,
      allowed,
      rejected,
      preflightRequests,
      sseConnections,
      credentialsUsed,
      topOrigins,
      topRejectedOrigins,
      recentEvents
    };
  }

  /**
   * 清理過期事件（手動調用）
   */
  async cleanup(): Promise<number> {
    try {
      const kvEvents = await this.env.SESSIONS.list({ prefix: 'cors:event:' });
      let cleaned = 0;

      for (const key of kvEvents.keys) {
        try {
          const eventData = await this.env.SESSIONS.get(key.name);
          if (eventData) {
            const event: CORSEvent = JSON.parse(eventData);
            const eventTime = new Date(event.timestamp).getTime();
            const now = Date.now();

            // 刪除超過 24 小時的事件
            if (now - eventTime > 86400000) {
              await this.env.SESSIONS.delete(key.name);
              cleaned++;
            }
          }
        } catch (error) {
          console.error(`Failed to process event ${key.name}:`, error);
        }
      }

      console.log(`✅ [CORS Monitor] Cleaned ${cleaned} expired events`);
      return cleaned;
    } catch (error) {
      console.error('Failed to cleanup CORS events:', error);
      return 0;
    }
  }
}

/**
 * 創建 CORS 監控中間件
 *
 * Note: This middleware is currently not in use.
 * CORS monitoring is handled directly in the CORS handler (src/handlers/cors-monitoring.ts)
 *
 * @deprecated Use CORSMonitor class directly instead
 */
export function corsMonitoringMiddleware() {
  return async (c: Context<{ Bindings: Bindings }>, next: () => Promise<void>) => {
    const monitor = new CORSMonitor(c.env);
    const origin = c.req.header('Origin');

    await next();

    // Simple logging without context variables
    if (origin) {
      await monitor.logAllowed(c, origin);
    }
  };
}
