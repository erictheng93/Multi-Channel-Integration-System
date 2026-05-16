// src/modules/notifications/services/notification-service.ts
// 通知服務核心業務邏輯

import {
  NotificationBase,
  CreateNotificationRequest,
  BulkCreateNotificationRequest,
  NotificationQuery,
  NotificationListResponse,
  NotificationStats,
  NotificationType,
  NotificationChannel
} from '../types';
import { NotificationRepository } from '@modules/notifications/repositories/notification-repository';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('NotificationService')

import { NotificationCache } from '@modules/notifications/repositories/notification-cache';
import { NotificationChannelService } from '@modules/notifications/services/notification-channel-service';
import { NotificationValidator } from '@modules/notifications/utils/notification-validator';

export class NotificationService {
  private repository: NotificationRepository;
  private cache: NotificationCache;
  private channelService: NotificationChannelService;
  private validator: NotificationValidator;

  constructor(
    database: D1Database,
    kvNamespace: KVNamespace,
    channelService: NotificationChannelService
  ) {
    this.repository = new NotificationRepository(database);
    this.cache = new NotificationCache(kvNamespace);
    this.channelService = channelService;
    this.validator = new NotificationValidator();
  }

  async create(request: CreateNotificationRequest): Promise<string> {
    // 驗證輸入
    this.validator.validateCreateRequest(request);

    // 創建通知
    const notificationId = await this.repository.create(request);

    // 取得創建的通知以供通道發送使用
    const notification = await this.repository.findById(notificationId, request.userId);
    if (!notification) {
      throw new Error('Failed to retrieve created notification');
    }

    // 發送到指定通道
    if (request.channels && request.channels.length > 0) {
      await this.channelService.send(notification, request.channels);
    } else {
      // 使用預設通道
      await this.channelService.sendToDefault(notification);
    }

    // 快取新通知
    await this.cache.cacheNotification(request.userId, notification, 300);

    // 清除相關快取
    await this.cache.invalidateListCache(request.userId);
    await this.cache.invalidateStatsCache(request.userId);
    await this.cache.invalidateUnreadCountCache(request.userId);

    return notificationId;
  }

  async createBulk(request: BulkCreateNotificationRequest): Promise<{
    successful: string[];
    failed: Array<{ index: number; error: string }>;
  }> {
    // 驗證批量請求
    this.validator.validateBulkCreateRequest(request);

    const results = {
      successful: [] as string[],
      failed: [] as Array<{ index: number; error: string }>
    };

    // 分批處理以避免超時
    const batchSize = 100;
    const batches = this.chunkArray(request.notifications, batchSize);

    for (const batch of batches) {
      try {
        const notificationIds = await this.repository.createBulk(batch);
        results.successful.push(...notificationIds);

        // 批量發送通知
        const notifications = await Promise.all(
          notificationIds.map(async (id, index) => {
            const notification = await this.repository.findById(id, batch[index].userId);
            return notification;
          })
        );

        const validNotifications = notifications.filter(n => n !== null) as NotificationBase[];
        await this.channelService.sendBulk(validNotifications);

      } catch (error) {
        const startIndex = results.successful.length + results.failed.length;
        batch.forEach((_, index) => {
          results.failed.push({
            index: startIndex + index,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        });
      }
    }

    // 清除受影響用戶的快取
    const userIds = [...new Set(request.notifications.map(n => n.userId))];
    await Promise.allSettled(
      userIds.map(userId => this.cache.invalidateUserCache(userId))
    );

    return results;
  }

  async getById(id: string, userId: string | number): Promise<NotificationBase | null> {
    // 先檢查快取
    const cached = await this.cache.getCachedNotification(userId, id);
    if (cached) {
      return cached;
    }

    // 從資料庫取得
    const notification = await this.repository.findById(id, userId);
    if (notification) {
      // 快取結果
      await this.cache.cacheNotification(userId, notification);
    }

    return notification;
  }

  async getByQuery(query: NotificationQuery): Promise<NotificationListResponse> {
    // 生成快取鍵
    const queryHash = this.cache.generateQueryHash({ ...query });

    // 檢查快取
    const cached = await this.cache.getCachedNotificationList(query.userId, queryHash);
    if (cached) {
      return {
        notifications: cached.notifications,
        pagination: this.calculatePagination(cached.total, query.page || 1, query.pageSize || 20)
      };
    }

    // 從資料庫查詢
    const result = await this.repository.findByQuery(query);

    // 快取結果
    await this.cache.cacheNotificationList(
      query.userId,
      queryHash,
      result.notifications,
      result.total,
      300
    );

    return {
      notifications: result.notifications,
      pagination: this.calculatePagination(result.total, query.page || 1, query.pageSize || 20)
    };
  }

  async markAsRead(id: string, userId: string | number): Promise<boolean> {
    const success = await this.repository.markAsRead(id, userId);

    if (success) {
      // 清除相關快取
      await this.cache.invalidateNotificationCache(userId, id);
    }

    return success;
  }

  async markAllAsRead(userId: string | number, type?: NotificationType): Promise<number> {
    const count = await this.repository.markAllAsRead(userId, type);

    if (count > 0) {
      // 清除相關快取
      await this.cache.invalidateUserCache(userId);
    }

    return count;
  }

  async delete(id: string, userId: string | number): Promise<boolean> {
    const success = await this.repository.delete(id, userId);

    if (success) {
      // 清除相關快取
      await this.cache.invalidateNotificationCache(userId, id);
    }

    return success;
  }

  async getUnreadCount(userId: string | number, type?: NotificationType): Promise<number> {
    // 檢查快取
    const cached = await this.cache.getCachedUnreadCount(userId, type);
    if (cached !== null) {
      return cached;
    }

    // 從資料庫取得
    const count = await this.repository.getUnreadCount(userId, type);

    // 快取結果
    await this.cache.cacheUnreadCount(userId, count, type);

    return count;
  }

  async getStats(userId: string | number): Promise<NotificationStats> {
    // 檢查快取
    const cached = await this.cache.getCachedStats(userId);
    if (cached) {
      return cached;
    }

    // 從資料庫取得統計資料
    const rawStats = await this.repository.getStatsByUserId(userId);

    const stats: NotificationStats = {
      total: Number(rawStats?.total) || 0,
      unread: Number(rawStats?.unread) || 0,
      byType: {
        new_message: { total: Number(rawStats?.messages) || 0, unread: Number(rawStats?.messages_unread) || 0 },
        conversation_assigned: { total: Number(rawStats?.assignments) || 0, unread: Number(rawStats?.assignments_unread) || 0 },
        mention: { total: Number(rawStats?.mentions) || 0, unread: Number(rawStats?.mentions_unread) || 0 },
        system: { total: Number(rawStats?.system) || 0, unread: Number(rawStats?.system_unread) || 0 },
        conversation_transferred: { total: 0, unread: 0 },
        priority_changed: { total: 0, unread: 0 },
        customer_responded: { total: 0, unread: 0 },
        task_reminder: { total: 0, unread: 0 },
        agent_removed_from_team: { total: 0, unread: 0 },
        customer_followed: { total: 0, unread: 0 },  //  新客戶加入通知
        new_conversation: { total: 0, unread: 0 } //  新對話創建通知
      },
      byPriority: {
        low: { total: 0, unread: 0 },
        normal: { total: 0, unread: 0 },
        high: { total: Number(rawStats?.high_total) || 0, unread: Number(rawStats?.high_unread) || 0 },
        urgent: { total: Number(rawStats?.urgent_total) || 0, unread: Number(rawStats?.urgent_unread) || 0 }
      },
      timeRange: {
        today: Number(rawStats?.today) || 0,
        thisWeek: Number(rawStats?.this_week) || 0,
        thisMonth: Number(rawStats?.this_month) || 0
      },
      channelStats: {
        database: { sent: 0, delivered: 0, failed: 0 },
        websocket: { sent: 0, delivered: 0, failed: 0 },
        email: { sent: 0, delivered: 0, failed: 0 },
        push: { sent: 0, delivered: 0, failed: 0 },
        webhook: { sent: 0, delivered: 0, failed: 0 },
        sms: { sent: 0, delivered: 0, failed: 0 }
      }
    };

    // 快取統計資料
    await this.cache.cacheStats(userId, stats, 60);

    return stats;
  }

  async getRecentNotifications(userId: string | number, limit: number = 10): Promise<NotificationBase[]> {
    // 檢查快取
    const cached = await this.cache.getCachedRecentNotifications(userId, limit);
    if (cached) {
      return cached;
    }

    // 從資料庫取得
    const notifications = await this.repository.getRecentNotifications(userId, limit);

    // 快取結果
    await this.cache.cacheRecentNotifications(userId, limit, notifications, 30);

    return notifications;
  }

  async cleanupExpired(): Promise<number> {
    const deletedCount = await this.repository.deleteExpired();

    // 注意：這會影響所有用戶的快取，在生產環境中需要更智能的快取失效策略
    log.info(`Cleaned up ${deletedCount} expired notifications`);

    return deletedCount;
  }

  // 輔助方法
  private calculatePagination(total: number, page: number, pageSize: number) {
    const totalPages = Math.ceil(total / pageSize);
    return {
      page,
      pageSize,
      total,
      totalPages
    };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // 便利方法：創建特定類型的通知
  async notifyNewMessage(
    userId: number,
    conversationId: number,
    senderName: string,
    content: string,
    channels?: NotificationChannel[]
  ): Promise<string> {
    return this.create({
      userId,
      type: 'new_message',
      title: '新訊息',
      content: `${senderName}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
      data: { conversationId, senderName },
      priority: 'normal',
      channels,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小時後過期
    });
  }

  async notifyConversationAssigned(
    userId: number,
    conversationId: number,
    customerName: string,
    assignedBy: string
  ): Promise<string> {
    return this.create({
      userId,
      type: 'conversation_assigned',
      title: '對話已指派',
      content: `${assignedBy} 將與 ${customerName} 的對話指派給您`,
      data: { conversationId, customerName, assignedBy },
      priority: 'high',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天後過期
    });
  }

  async notifySystemMessage(
    userIds: number[],
    title: string,
    content: string,
    data?: Record<string, unknown>
  ): Promise<string[]> {
    const requests = userIds.map(userId => ({
      userId,
      type: 'system' as NotificationType,
      title,
      content,
      data,
      priority: 'normal' as const,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30天後過期
    }));

    const result = await this.createBulk({ notifications: requests });
    return result.successful;
  }
}
