// src/handlers/notification.ts
// 即時通知系統 - WebSocket/SSE 和通知管理

import { Context } from 'hono';
import type { 
  Bindings, 
  // AuthPayload,
  // NotificationData,
  // D1Result
} from '../types';
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

      let query = `
        SELECT * FROM notifications
        WHERE user_id = ?
      `;

      const params: any[] = [payload?.userId];
      const whereConditions: string[] = [];

      // 通知類型篩選
      if (type) {
        whereConditions.push('type = ?');
        params.push(type);
      }

      // 已讀狀態篩選
      if (isRead !== undefined) {
        whereConditions.push('is_read = ?');
        params.push(isRead === 'true');
      }

      // 日期範圍篩選
      if (dateFrom) {
        whereConditions.push('created_at >= ?');
        params.push(dateFrom);
      }
      if (dateTo) {
        whereConditions.push('created_at <= ?');
        params.push(dateTo);
      }

      // 排除過期通知
      whereConditions.push('(expires_at IS NULL OR expires_at > datetime(\'now\'))');

      if (whereConditions.length > 0) {
        query += ' AND ' + whereConditions.join(' AND ');
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const result = await c.env.DB.prepare(query).bind(...params).all();

      // 計算總數
      let countQuery = `
        SELECT COUNT(*) as total FROM notifications
        WHERE user_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
      `;
      
      const countParams = [payload?.userId];
      if (whereConditions.slice(0, -1).length > 0) { // 排除過期條件
        countQuery += ' AND ' + whereConditions.slice(0, -1).join(' AND ');
        countParams.push(...params.slice(1, -2)); // 排除 limit, offset 和過期條件的參數
      }

      const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first();

      const notifications: Notification[] = result.results.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        type: row.type,
        title: row.title,
        content: row.content,
        data: row.data ? JSON.parse(row.data) : null,
        isRead: Boolean(row.is_read),
        readAt: row.read_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at
      }));

      return paginatedResponse(c, notifications, {
        page: parseInt(page),
        limit,
        total: (countResult?.total as number) || 0
      }, 'Notifications retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 標記通知為已讀
  async markAsRead(c: Context<{ Bindings: Bindings }>) {
    try {
      const notificationId = c.req.param('id');
      const payload = c.get('jwtPayload');

      // 檢查通知是否存在且屬於當前用戶
      const notification = await c.env.DB.prepare(`
        SELECT * FROM notifications WHERE id = ? AND user_id = ?
      `).bind(notificationId, payload?.userId).first();

      if (!notification) {
        return notFoundResponse(c, 'Notification');
      }

      // 標記為已讀
      await c.env.DB.prepare(`
        UPDATE notifications 
        SET is_read = TRUE, read_at = datetime('now')
        WHERE id = ?
      `).bind(notificationId).run();

      return successResponse(c, null, 'Notification marked as read');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 批量標記通知為已讀
  async markAllAsRead(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload');
      const { type } = await c.req.json().catch(() => ({}));

      let query = `
        UPDATE notifications 
        SET is_read = TRUE, read_at = datetime('now')
        WHERE user_id = ? AND is_read = FALSE
      `;

      const params = [payload?.userId];

      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }

      const result = await c.env.DB.prepare(query).bind(...params).run();

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
    try {
      const notificationId = c.req.param('id');
      const payload = c.get('jwtPayload');

      // 檢查通知是否存在且屬於當前用戶
      const notification = await c.env.DB.prepare(`
        SELECT * FROM notifications WHERE id = ? AND user_id = ?
      `).bind(notificationId, payload?.userId).first();

      if (!notification) {
        return notFoundResponse(c, 'Notification');
      }

      // 刪除通知
      await c.env.DB.prepare(`
        DELETE FROM notifications WHERE id = ?
      `).bind(notificationId).run();

      return successResponse(c, null, 'Notification deleted successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 清理過期通知
  async cleanup(c: Context<{ Bindings: Bindings }>) {
    try {
      const payload = c.get('jwtPayload');

      // 只有管理員可以執行清理
      if (payload?.role !== 'admin') {
        return unauthorizedResponse(c, 'Only administrators can cleanup notifications');
      }

      const result = await c.env.DB.prepare(`
        DELETE FROM notifications 
        WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')
      `).run();

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
    try {
      const payload = c.get('jwtPayload');

      // 總通知數
      const totalResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as total FROM notifications
        WHERE user_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(payload?.userId).first();

      // 未讀通知數
      const unreadResult = await c.env.DB.prepare(`
        SELECT COUNT(*) as unread FROM notifications
        WHERE user_id = ? AND is_read = FALSE 
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(payload?.userId).first();

      // 按類型統計
      const typeStats = await c.env.DB.prepare(`
        SELECT type, COUNT(*) as count, 
               SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread_count
        FROM notifications
        WHERE user_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
        GROUP BY type
      `).bind(payload?.userId).all();

      // 最近7天的通知趨勢
      const trendStats = await c.env.DB.prepare(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM notifications
        WHERE user_id = ? AND created_at >= date('now', '-7 days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `).bind(payload?.userId).all();

      const stats = {
        total: totalResult?.total || 0,
        unread: unreadResult?.unread || 0,
        byType: {},
        trend: trendStats.results.map((row: any) => ({
          date: row.date,
          count: row.count
        }))
      };

      // 格式化類型統計
      typeStats.results.forEach((row: any) => {
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
    try {
      const payload = c.get('jwtPayload');

      const settings = await c.env.DB.prepare(`
        SELECT * FROM notification_settings WHERE user_id = ?
      `).bind(payload?.userId).first();

      if (!settings) {
        // 創建預設設定
        await c.env.DB.prepare(`
          INSERT INTO notification_settings 
          (user_id, email_enabled, push_enabled, sound_enabled, 
           mention_enabled, assignment_enabled, message_enabled)
          VALUES (?, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
        `).bind(payload?.userId).run();

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
        userId: Number(settings.user_id),
        emailEnabled: Boolean(settings.email_enabled),
        pushEnabled: Boolean(settings.push_enabled),
        soundEnabled: Boolean(settings.sound_enabled),
        mentionEnabled: Boolean(settings.mention_enabled),
        assignmentEnabled: Boolean(settings.assignment_enabled),
        messageEnabled: Boolean(settings.message_enabled)
      };

      return successResponse(c, notificationSettings, 'Notification settings retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 更新通知設定
  async updateSettings(c: Context<{ Bindings: Bindings }>) {
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
      await c.env.DB.prepare(`
        INSERT OR REPLACE INTO notification_settings 
        (user_id, email_enabled, push_enabled, sound_enabled, 
         mention_enabled, assignment_enabled, message_enabled, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        payload?.userId,
        emailEnabled !== undefined ? emailEnabled : true,
        pushEnabled !== undefined ? pushEnabled : true,
        soundEnabled !== undefined ? soundEnabled : true,
        mentionEnabled !== undefined ? mentionEnabled : true,
        assignmentEnabled !== undefined ? assignmentEnabled : true,
        messageEnabled !== undefined ? messageEnabled : true
      ).run();

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

      // 設置 SSE 標頭
      const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      };

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
            if (connectionClosed) return;

            try {
              // 獲取最近的未讀通知
              const notifications = await c.env.DB.prepare(`
                SELECT * FROM notifications
                WHERE user_id = ? AND is_read = FALSE
                AND created_at > datetime('now', '-1 minute')
                ORDER BY created_at DESC
                LIMIT 10
              `).bind(payload.userId).all();

              if (notifications.results.length > 0) {
                for (const notification of notifications.results) {
                  const eventData = JSON.stringify({
                    type: 'notification',
                    data: {
                      id: notification.id,
                      type: notification.type,
                      title: notification.title,
                      content: notification.content,
                      createdAt: notification.created_at
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
      return c.json({ error: 'Failed to establish SSE connection' }, 500);
    }
  }
};

// 通知創建工具函數
export class NotificationService {
  static async createNotification(
    db: any,
    userId: number,
    type: Notification['type'],
    title: string,
    content: string,
    data?: any,
    expiresAt?: Date
  ): Promise<string> {
    const notificationId = crypto.randomUUID();

    await db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, content, data, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      notificationId,
      userId,
      type,
      title,
      content,
      data ? JSON.stringify(data) : null,
      expiresAt ? expiresAt.toISOString() : null
    ).run();

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