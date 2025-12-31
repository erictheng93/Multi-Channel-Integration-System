// src/handlers/notification.ts
// 即時通知系統 - WebSocket/SSE 和通知管理

import { Context } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type {
  Bindings,
  // AuthPayload,
  // NotificationData,
  // D1Result
} from '../types';
import { notifications } from '../db/schema';
import { hasChanges } from '../types';
import {
  successResponse,
  paginatedResponse,
  // errorResponse,
  // validationErrorResponse,
  unauthorizedResponse,
  notFoundResponse,
  handleApiError
} from '../utils/api-response';
import { getSSECorsHeaders } from '../config/cors';
import { createDbClient } from '../db/drizzle-factory';
import { sql, eq, and, or, desc, count, gte, lte } from 'drizzle-orm';

interface Notification {
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
}

interface LocalNotificationSettings {
  userId: number;
  emailEnabled: boolean;
  pushEnabled: boolean;
  soundEnabled: boolean;
  mentionEnabled: boolean;
  assignmentEnabled: boolean;
  messageEnabled: boolean;
}

export const notificationHandler = {
  // 獲取用戶通知列表
  async list(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const payload = c.get('jwtPayload');
      const { 
        page = '1', 
        pageSize = '20',
        type,
        isRead,
        dateFrom,
        dateTo
      } = c.req.query();

      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      const limit = parseInt(pageSize);

      // 使用 Drizzle ORM 構建查詢
      const whereConditions = [eq(notifications.userId, typeof payload?.userId === 'string' ? payload.userId : payload?.userId?.toString() || '')];

      // 通知類型篩選
      if (type) {
        whereConditions.push(eq(notifications.type, type));
      }

      // 已讀狀態篩選
      if (isRead !== undefined) {
        whereConditions.push(eq(notifications.isRead, isRead === 'true'));
      }

      // 日期範圍篩選
      if (dateFrom) {
        whereConditions.push(gte(notifications.createdAt, dateFrom));
      }
      if (dateTo) {
        whereConditions.push(lte(notifications.createdAt, dateTo));
      }

      // 排除過期通知
      const expiredCondition1 = sql`expires_at IS NULL`;
      const expiredCondition2 = sql`expires_at > datetime('now')`;
      whereConditions.push((or as any)(expiredCondition1, expiredCondition2));

      const result = await drizzleDb
        .select()
        .from(notifications)
        .where(and(...whereConditions))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      // 計算總數 - 使用相同的條件
      const countResult = await drizzleDb
        .select({ total: count() })
        .from(notifications)
        .where(and(...whereConditions));

      const notificationList: Notification[] = result.map((row: any) => ({
        id: row.id,
        userId: row.userId,
        type: row.type,
        title: row.title,
        content: row.content,
        data: row.data ? JSON.parse(row.data) : null,
        isRead: Boolean(row.isRead),
        readAt: row.readAt,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt
      }));

      return paginatedResponse(c, notificationList, {
        page: parseInt(page),
        limit,
        total: countResult[0]?.total || 0
      }, 'Notifications retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 標記通知為已讀
  async markAsRead(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const notificationId = c.req.param('id');
      const payload = c.get('jwtPayload');

      // 檢查通知是否存在且屬於當前用戶
      const notification = await drizzleDb.get(sql`
        SELECT * FROM notifications WHERE id = ${notificationId} AND user_id = ${payload?.userId}
      `).catch((): null => null);

      if (!notification) {
        return notFoundResponse(c, 'Notification');
      }

      // 標記為已讀
      await drizzleDb.run(sql`
        UPDATE notifications 
        SET is_read = TRUE, read_at = datetime('now')
        WHERE id = ${notificationId}
      `);

      return successResponse(c, null, 'Notification marked as read');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 批量標記通知為已讀
  async markAllAsRead(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const payload = c.get('jwtPayload');
      const { type } = await c.req.json().catch(() => ({}));

      // 構建更新條件
      const updateConditions = [
        eq(notifications.userId, typeof payload?.userId === 'string' ? payload.userId : payload?.userId?.toString() || ''),
        eq(notifications.isRead, false)
      ];

      if (type) {
        updateConditions.push(eq(notifications.type, type));
      }

      const result = await drizzleDb
        .update(notifications)
        .set({
          isRead: true,
          readAt: sql`datetime('now')`
        })
        .where(and(...updateConditions));

      const changes = hasChanges(result) ? result.changes : 0;

      return successResponse(c, { 
        updated: changes 
      }, `${changes} notifications marked as read`);

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 刪除通知
  async delete(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const notificationId = c.req.param('id');
      const payload = c.get('jwtPayload');

      // 檢查通知是否存在且屬於當前用戶
      const notification = await drizzleDb.get(sql`
        SELECT * FROM notifications WHERE id = ${notificationId} AND user_id = ${payload?.userId}
      `).catch((): null => null);

      if (!notification) {
        return notFoundResponse(c, 'Notification');
      }

      // 刪除通知
      await drizzleDb.run(sql`
        DELETE FROM notifications WHERE id = ${notificationId}
      `);

      return successResponse(c, null, 'Notification deleted successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 清理過期通知
  async cleanup(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const payload = c.get('jwtPayload');

      // 只有管理員可以執行清理
      if (payload?.role !== 'admin') {
        return unauthorizedResponse(c, 'Only administrators can cleanup notifications');
      }

      const result = await drizzleDb.run(sql`
        DELETE FROM notifications 
        WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')
      `);

      const changes = hasChanges(result) ? result.changes : 0;

      return successResponse(c, { 
        deleted: changes 
      }, `${changes} expired notifications deleted`);

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取通知統計
  async getStats(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const payload = c.get('jwtPayload');

      // 總通知數
      const totalResult = await drizzleDb.get(sql`
        SELECT COUNT(*) as total FROM notifications
        WHERE user_id = ${payload?.userId} AND (expires_at IS NULL OR expires_at > datetime('now'))
      `);

      // 未讀通知數
      const unreadResult = await drizzleDb.get(sql`
        SELECT COUNT(*) as unread FROM notifications
        WHERE user_id = ${payload?.userId} AND is_read = FALSE 
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `);

      // 按類型統計
      const typeStats = await drizzleDb.run(sql`
        SELECT type, COUNT(*) as count, 
               SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread_count
        FROM notifications
        WHERE user_id = ${payload?.userId} AND (expires_at IS NULL OR expires_at > datetime('now'))
        GROUP BY type
      `); // parameter inlined

      // 最近7天的通知趨勢
      const trendStats = await drizzleDb.run(sql`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM notifications
        WHERE user_id = ${payload?.userId} AND created_at >= date('now', '-7 days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `); // parameter inlined

      const stats = {
        total: Number((totalResult as any)?.total) || 0,
        unread: Number((unreadResult as any)?.unread) || 0,
        byType: {},
        trend: trendStats.results || [].map((row: any) => ({
          date: row.date,
          count: row.count
        }))
      };

      // 格式化類型統計
      typeStats.results || [].forEach((row: any) => {
        (stats.byType as any)[row.type] = {
          total: row.count,
          unread: row.unread_count
        };
      });

      return successResponse(c, stats, 'Notification statistics retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取通知設定
  async getSettings(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const payload = c.get('jwtPayload');

      const settings = await drizzleDb.get(sql`
        SELECT * FROM notification_settings WHERE user_id = ${payload?.userId}
      `); // parameter inlined

      if (!settings) {
        // 創建預設設定
        await drizzleDb.run(sql`
          INSERT INTO notification_settings 
          (user_id, email_enabled, push_enabled, sound_enabled, 
           mention_enabled, assignment_enabled, message_enabled)
          VALUES (${payload?.userId}, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
        `); // parameter inlined

        return successResponse(c, {
          userId: payload?.userId,
          emailEnabled: true,
          pushEnabled: true,
          soundEnabled: true,
          mentionEnabled: true,
          assignmentEnabled: true,
          messageEnabled: true
        }, 'Default notification settings created');
      }

      const notificationSettings: LocalNotificationSettings = {
        userId: Number((settings as any).user_id),
        emailEnabled: Boolean((settings as any).email_enabled),
        pushEnabled: Boolean((settings as any).push_enabled),
        soundEnabled: Boolean((settings as any).sound_enabled),
        mentionEnabled: Boolean((settings as any).mention_enabled),
        assignmentEnabled: Boolean((settings as any).assignment_enabled),
        messageEnabled: Boolean((settings as any).message_enabled)
      };

      return successResponse(c, notificationSettings, 'Notification settings retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 更新通知設定
  async updateSettings(c: Context<{ Bindings: Bindings }>) {
    const drizzleDb = createDbClient(c.env.DB);
    try {
      const payload = c.get('jwtPayload');
      const {
        emailEnabled,
        pushEnabled,
        soundEnabled,
        mentionEnabled,
        assignmentEnabled,
        messageEnabled
      } = await c.req.json();

      // 更新設定
      await drizzleDb.run(sql`
        INSERT OR REPLACE INTO notification_settings 
        (user_id, email_enabled, push_enabled, sound_enabled, 
         mention_enabled, assignment_enabled, message_enabled, updated_at)
        VALUES (${payload?.userId}, ${emailEnabled !== undefined ? emailEnabled : true}, ${pushEnabled !== undefined ? pushEnabled : true}, ${soundEnabled !== undefined ? soundEnabled : true}, ${mentionEnabled !== undefined ? mentionEnabled : true}, ${assignmentEnabled !== undefined ? assignmentEnabled : true}, ${messageEnabled !== undefined ? messageEnabled : true}, datetime('now'))
      `);

      return successResponse(c, null, 'Notification settings updated successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // Server-Sent Events 端點
  async sse(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload');

      if (!payload) {
        return unauthorizedResponse(c, 'Authentication required for SSE');
      }

      // 設置 SSE 標頭（使用統一 CORS 配置）
      const headers = getSSECorsHeaders(c.req.header('Origin'));

      // 創建 SSE 連接
      const encoder = new TextEncoder();
      let connectionClosed = false;

      const stream = new ReadableStream({
        start(controller) {
          // 發送初始連接確認
          const data = JSON.stringify({
            type: 'connection',
            message: 'SSE connection established',
            timestamp: new Date().toISOString(),
            userId: payload.userId
          });
          
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // 心跳檢測
          const heartbeat = setInterval(() => {
            if (connectionClosed) {
              clearInterval(heartbeat);
              return;
            }

            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'heartbeat',
                timestamp: new Date().toISOString()
              })}\n\n`));
            } catch (error) {
              connectionClosed = true;
              clearInterval(heartbeat);
              console.log('SSE heartbeat failed, connection closed');
            }
          }, 30000); // 每30秒發送心跳

          // 檢查新通知的循環（簡化實現）
          const checkNotifications = async () => {
      const notifDbConnection = createDbClient(c.env.DB);
            if (connectionClosed) return;

            try {
              // 獲取最近的未讀通知
              const notifications = await notifDbConnection.run(sql`
                SELECT * FROM notifications
                WHERE user_id = ${payload.userId} AND is_read = FALSE
                AND created_at > datetime('now', '-1 minute')
                ORDER BY created_at DESC
                LIMIT 10
              `);

              if (notifications.results || [].length > 0) {
                for (const notification of notifications.results || []) {
                  const eventData = JSON.stringify({
                    type: 'notification',
                    data: {
                      id: (notification as any).id,
                      type: (notification as any).type,
                      title: (notification as any).title,
                      content: (notification as any).content,
                      createdAt: (notification as any).created_at
                    },
                    timestamp: new Date().toISOString()
                  });
                  
                  controller.enqueue(encoder.encode(`data: ${eventData}\n\n`));
                }
              }
            } catch (error) {
              console.error('Error checking notifications for SSE:', error);
            }

            // 每10秒檢查一次新通知
            if (!connectionClosed) {
              setTimeout(checkNotifications, 10000);
            }
          };

          // 開始檢查通知
          setTimeout(checkNotifications, 1000);
        },

        cancel() {
          connectionClosed = true;
          console.log(`SSE connection closed for user ${payload.userId}`);
        }
      });

      return new Response(stream, { headers });

    } catch (error) {
      console.error('SSE error:', error);
      return c.json({ error: 'Failed to establish SSE connection' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }
};

// 通知創建工具函數
export class NotificationService {
  static async createNotification(
    drizzleDb: any,
    userId: number,
    type: Notification['type'],
    title: string,
    content: string,
    data?: any,
    expiresAt?: Date
  ): Promise<string> {
    // drizzleDb不需要在靜態方法中聲明
    const notificationId = crypto.randomUUID();

    await drizzleDb.insert(notifications).values({
      id: notificationId,
      userId: userId,
      type: type,
      title: title,
      content: content,
      data: data ? JSON.stringify(data) : null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null
    });

    return notificationId;
  }

  // 為新訊息創建通知
  static async notifyNewMessage(
    db: any,
    conversationId: number,
    senderName: string,
    content: string,
    assignedUserId?: number
  ): Promise<void> {
    // drizzleDb不需要在靜態方法中聲明
    if (!assignedUserId) return;

    await this.createNotification(
      db,
      assignedUserId,
      'new_message',
      '新訊息',
      `${senderName}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
      { conversationId, senderName },
      new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小時後過期
    );
  }

  // 為對話指派創建通知
  static async notifyConversationAssigned(
    db: any,
    userId: number,
    conversationId: number,
    customerName: string,
    assignedBy: string
  ): Promise<void> {
    // drizzleDb不需要在靜態方法中聲明
    await this.createNotification(
      db,
      userId,
      'conversation_assigned',
      '對話已指派',
      `${assignedBy} 將與 ${customerName} 的對話指派給您`,
      { conversationId, customerName, assignedBy },
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天後過期
    );
  }

  // 為對話轉移創建通知
  static async notifyConversationTransferred(
    db: any,
    userId: number,
    conversationId: number,
    customerName: string,
    fromUser: string,
    reason?: string
  ): Promise<void> {
    // drizzleDb不需要在靜態方法中聲明
    await this.createNotification(
      db,
      userId,
      'conversation_transferred',
      '對話已轉移',
      `${fromUser} 將與 ${customerName} 的對話轉移給您${reason ? ` - ${reason}` : ''}`,
      { conversationId, customerName, fromUser, reason },
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    );
  }

  // 為優先級變更創建通知
  static async notifyPriorityChanged(
    db: any,
    userId: number,
    conversationId: number,
    customerName: string,
    newPriority: string,
    changedBy: string
  ): Promise<void> {
    // drizzleDb不需要在靜態方法中聲明
    await this.createNotification(
      db,
      userId,
      'priority_changed',
      '對話優先級已變更',
      `${changedBy} 將與 ${customerName} 的對話優先級設為 ${newPriority}`,
      { conversationId, customerName, newPriority, changedBy },
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3天後過期
    );
  }

  // 為系統通知創建通知
  static async notifySystem(
    db: any,
    userIds: number[],
    title: string,
    content: string,
    data?: any
  ): Promise<void> {
    // drizzleDb不需要在靜態方法中聲明
    for (const userId of userIds) {
      await this.createNotification(
        db,
        userId,
        'system',
        title,
        content,
        data,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30天後過期
      );
    }
  }
}