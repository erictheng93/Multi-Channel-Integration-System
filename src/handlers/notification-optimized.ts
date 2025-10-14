// src/handlers/notification-optimized.ts
// 優化的通知處理器 - 替代原有的通知系統

import { Context } from 'hono';
import type { Bindings } from '../types';
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  // notFoundResponse,
  handleApiError
} from '../utils/api-response';
import { getSSECorsHeaders } from '../config/cors';
import { notifications } from '../db/schema';
import { CacheManager, QueryOptimizer } from '../utils/performance';
import { drizzle } from 'drizzle-orm/d1';
import { sql, eq, and } from 'drizzle-orm';

interface OptimizedNotification {
  id: string;
  userId: number;
  type: 'new_message' | 'conversation_assigned' | 'mention' | 'system' | 'conversation_transferred' | 'priority_changed';
  title: string;
  content: string;
  data?: any;
  isRead: boolean;
  readAt?: string;
  expiresAt?: string;
  createdAt: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export const optimizedNotificationHandler = {
  // 優化的通知列表 - 使用快取和批量查詢
  list: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      const { 
        page = '1', 
        pageSize = '20',
        type,
        isRead,
        priority,
        dateFrom,
        dateTo
      } = c.req.query();

      const cache = new CacheManager(c.env);
      const optimizer = new QueryOptimizer(c.env.DB, cache);

      // 生成快取鍵
      const cacheParams = { type, isRead, priority, dateFrom, dateTo };
      const cacheKey = `notifications:${typeof payload?.userId === 'string' ? payload.userId : payload?.userId?.toString() || ''}:${JSON.stringify(cacheParams)}`;

      // 構建查詢
      let baseQuery = `
        SELECT * FROM notifications
        WHERE user_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
      `;

      let countQuery = `
        SELECT COUNT(*) as total FROM notifications
        WHERE user_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
      `;

      const params: any[] = [typeof payload?.userId === 'string' ? payload.userId : payload?.userId?.toString() || ''];
      const whereConditions: string[] = [];

      // 添加篩選條件
      if (type) {
        whereConditions.push('type = ?');
        params.push(type);
      }

      if (isRead !== undefined) {
        whereConditions.push('is_read = ?');
        params.push(isRead === 'true');
      }

      if (priority) {
        whereConditions.push('priority = ?');
        params.push(priority);
      }

      if (dateFrom) {
        whereConditions.push('created_at >= ?');
        params.push(dateFrom);
      }

      if (dateTo) {
        whereConditions.push('created_at <= ?');
        params.push(dateTo);
      }

      if (whereConditions.length > 0) {
        const whereClause = ' AND ' + whereConditions.join(' AND ');
        baseQuery += whereClause;
        countQuery += whereClause;
      }

      baseQuery += ' ORDER BY priority DESC, created_at DESC';

      // 使用優化的分頁查詢
      const result = await optimizer.paginatedQuery<OptimizedNotification>(
        baseQuery,
        countQuery,
        params,
        parseInt(page),
        parseInt(pageSize),
        cacheKey
      );

      // 格式化通知
      const notifications = result.items.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        type: row.type,
        title: row.title,
        content: row.content,
        data: row.data ? JSON.parse(row.data) : null,
        isRead: Boolean(row.is_read),
        readAt: row.read_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        priority: row.priority || 'normal'
      }));

      // 設置快取標頭
      c.header('Cache-Control', 'private, max-age=30');

      return paginatedResponse(c, notifications, {
        page: result.page,
        limit: result.pageSize,
        total: result.total
      }, 'Notifications retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 批量標記為已讀 - 優化版
  markAllAsRead: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      const { type } = await c.req.json().catch(() => ({}));

      // 構建更新條件
      const drizzleDb = drizzle(c.env.DB);
      const updateConditions = [
        eq(notifications.userId, typeof payload?.userId === 'string' ? payload.userId : payload?.userId?.toString() || ''),
        eq(notifications.isRead, false)
      ];

      if (type) {
        updateConditions.push(eq(notifications.type, type));
      }

      // Note: notifications schema doesn't have priority field
      // if (priority) {
      //   updateConditions.push(eq(notifications.priority, priority));
      // }

      await drizzleDb
        .update(notifications)
        .set({
          isRead: true,
          readAt: sql`datetime('now')`
        })
        .where(and(...updateConditions));

      // 清理相關快取
      const cache = new CacheManager(c.env);
      await cache.deletePattern(`cache:notifications:${typeof payload?.userId === 'string' ? payload.userId : payload?.userId?.toString() || ''}`);

      return successResponse(c, { 
        updated: "success"
      }, "Notifications marked as read successfully");

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取通知統計 - 優化版
  getStats: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');
      const cache = new CacheManager(c.env);
      
      // 檢查快取
      const cacheKey = `notification_stats:${typeof payload?.userId === 'string' ? payload.userId : payload?.userId?.toString() || ''}`;
      const cached = await cache.get('stats', cacheKey);
      if (cached) {
        return successResponse(c, cached, 'Notification statistics retrieved from cache');
      }

      // 使用單一查詢獲取所有統計
      const drizzleDb = drizzle(c.env.DB);
      const stats = await drizzleDb.get(sql`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread,
          SUM(CASE WHEN type = 'new_message' THEN 1 ELSE 0 END) as messages,
          SUM(CASE WHEN type = 'conversation_assigned' THEN 1 ELSE 0 END) as assignments,
          SUM(CASE WHEN type = 'mention' THEN 1 ELSE 0 END) as mentions,
          SUM(CASE WHEN type = 'system' THEN 1 ELSE 0 END) as system,
          SUM(CASE WHEN priority = 'urgent' AND is_read = FALSE THEN 1 ELSE 0 END) as urgent_unread,
          SUM(CASE WHEN priority = 'high' AND is_read = FALSE THEN 1 ELSE 0 END) as high_unread,
          SUM(CASE WHEN created_at >= date('now', '-24 hours') THEN 1 ELSE 0 END) as today,
          SUM(CASE WHEN created_at >= date('now', '-7 days') THEN 1 ELSE 0 END) as this_week
        FROM notifications
        WHERE user_id = ${payload?.userId} AND (expires_at IS NULL OR expires_at > datetime('now'))
      `);

      const formattedStats = {
        total: Number((stats as any)?.total) || 0,
        unread: Number((stats as any)?.unread) || 0,
        byType: {
          new_message: Number((stats as any)?.messages) || 0,
          conversation_assigned: Number((stats as any)?.assignments) || 0,
          mention: Number((stats as any)?.mentions) || 0,
          system: Number((stats as any)?.system) || 0
        },
        byPriority: {
          urgent_unread: Number((stats as any)?.urgent_unread) || 0,
          high_unread: Number((stats as any)?.high_unread) || 0
        },
        timeRange: {
          today: Number((stats as any)?.today) || 0,
          this_week: Number((stats as any)?.this_week) || 0
        }
      };

      // 存入快取 (30 秒)
      await cache.set('stats', cacheKey, formattedStats, 30);

      // 設置快取標頭
      c.header('Cache-Control', 'private, max-age=30');

      return successResponse(c, formattedStats, 'Notification statistics retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 優化的 SSE 通知推送
  optimizedSSE: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload) {
        return unauthorizedResponse(c, 'Authentication required for SSE');
      }

      // 設置優化的 SSE 標頭（使用統一 CORS 配置）
      const baseSseCorsHeaders = getSSECorsHeaders(c.req.header('Origin'), ['Authorization']);
      const headers = {
        ...baseSseCorsHeaders,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Accel-Buffering': 'no',
      };

      const encoder = new TextEncoder();
      let connectionClosed = false;
      let lastNotificationCheck = Date.now();

      const stream = new ReadableStream({
        start(controller) {
          // 發送連接確認
          const connectionEvent = {
            type: 'connection',
            message: 'Optimized SSE connection established',
            timestamp: new Date().toISOString(),
            userId: payload.userId
          };
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(connectionEvent)}\n\n`));

          // 優化的通知檢查 (每 2 秒)
          const checkNotifications = async () => {
            if (connectionClosed) return;

            try {
              const now = Date.now();
              const checkTime = new Date(lastNotificationCheck).toISOString();

              // 只查詢最近的通知
              const drizzleDb = drizzle(c.env.DB);
              const notifications = await drizzleDb.all(sql`
                SELECT * FROM notifications
                WHERE user_id = ${payload.userId} AND is_read = FALSE
                AND created_at > ${checkTime}
                ORDER BY priority DESC, created_at DESC
                LIMIT 3
              `);

              if (notifications && notifications.length > 0) {
                for (const notification of notifications) {
                  const eventData = {
                    type: 'notification',
                    data: {
                      id: (notification as any).id,
                      type: (notification as any).type,
                      title: (notification as any).title,
                      content: (notification as any).content,
                      priority: (notification as any).priority || 'normal',
                      createdAt: (notification as any).created_at
                    },
                    timestamp: new Date().toISOString()
                  };
                  
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`));
                }
              }

              lastNotificationCheck = now;

            } catch (error) {
              console.error('Error checking notifications for optimized SSE:', error);
            }

            // 繼續檢查
            if (!connectionClosed) {
              setTimeout(checkNotifications, 2000);
            }
          };

          // 心跳檢測 (每 30 秒)
          const heartbeat = setInterval(() => {
            if (connectionClosed) {
              clearInterval(heartbeat);
              return;
            }

            try {
              const heartbeatEvent = {
                type: 'heartbeat',
                timestamp: new Date().toISOString(),
                serverTime: Date.now()
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(heartbeatEvent)}\n\n`));
            } catch (error) {
              connectionClosed = true;
              clearInterval(heartbeat);
            }
          }, 30000);

          // 開始檢查通知
          setTimeout(checkNotifications, 1000);
        },

        cancel() {
          connectionClosed = true;
          console.log(`Optimized SSE connection closed for user ${payload.userId}`);
        }
      });

      return new Response(stream, { headers });

    } catch (error) {
      console.error('Optimized SSE error:', error);
      return errorResponse(c, 'Failed to establish optimized SSE connection', 500);
    }
  },

  // 批量創建通知 - 優化版
  createBulkNotifications: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const { notifications } = await c.req.json();

      if (!Array.isArray(notifications) || notifications.length === 0) {
        return validationErrorResponse(c, [
          { field: 'notifications', message: 'Notifications array is required' }
        ]);
      }

      // 批量插入
      const drizzleDb = drizzle(c.env.DB);
      const insertPromises = notifications.map((notification: any) => {
        const notificationId = crypto.randomUUID();
        return drizzleDb.run(sql`
          INSERT INTO notifications (id, user_id, type, title, content, data, priority, expires_at)
          VALUES (${notificationId}, ${notification.userId}, ${notification.type}, ${notification.title}, ${notification.content}, ${notification.data ? JSON.stringify(notification.data) : null}, ${notification.priority || 'normal'}, ${notification.expiresAt || null})
        `);
      });

      await Promise.all(insertPromises);

      // 清理相關快取
      const cache = new CacheManager(c.env);
      const userIds = [...new Set(notifications.map((n: any) => n.userId))];
      for (const userId of userIds) {
        await cache.deletePattern(`cache:notifications:${userId}`);
        await cache.deletePattern(`cache:stats:notification_stats:${userId}`);
      }

      return successResponse(c, { 
        created: notifications.length 
      }, `${notifications.length} notifications created successfully`);

    } catch (error) {
      return handleApiError(error, c);
    }
  }
};