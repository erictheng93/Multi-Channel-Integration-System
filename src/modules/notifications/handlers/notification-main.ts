// src/modules/notifications/handlers/notification-main.ts
// 統一通知處理器 - 模組化的主要 API 端點

import { Context } from 'hono';
import type { Bindings } from '@/types';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  notFoundResponse,
  handleApiError
} from '@/utils/api-response';
import { notificationContracts, type NotificationSettings as SharedNotificationSettings } from '@shared/api-contracts';
import { contractJson } from '@/utils/api-contract-response';

// 導入通知模組服務
import { NotificationService } from '@modules/notifications/services/notification-service';
import { NotificationChannelService } from '@modules/notifications/services/notification-channel-service';
import { NotificationValidator, NotificationValidationError } from '@modules/notifications/utils/notification-validator';
import {
  CreateNotificationRequest,
  BulkCreateNotificationRequest,
  NotificationQuery,
  NotificationType,
  NotificationPriority,
  ChannelType
} from '../types';
import { triggerSystemNotification } from '@/utils/notification-trigger';
import { createDbClient } from '@/db/drizzle-factory';
import { agents } from '@/db/schema';
import { isNull } from 'drizzle-orm';
import { nowISO } from '@/utils/timestamp'

type NotificationSettingsPatch = Partial<Omit<SharedNotificationSettings, 'userId'>>;

function isChannelType(value: string): value is ChannelType {
  return value === 'database'
    || value === 'websocket'
    || value === 'email'
    || value === 'push'
    || value === 'webhook'
    || value === 'sms';
}

function notificationSettingsKey(userId: string | number): string {
  return `notification_settings:${userId}`;
}

function normalizeSettingsUserId(userId: string | number): string | number {
  if (typeof userId === 'number') {
    return userId;
  }

  const parsed = Number(userId);
  return Number.isFinite(parsed) && String(parsed) === userId ? parsed : userId;
}

function defaultNotificationSettings(userId: string | number): SharedNotificationSettings {
  return {
    userId: normalizeSettingsUserId(userId),
    emailEnabled: false,
    pushEnabled: true,
    soundEnabled: true,
    mentionEnabled: true,
    assignmentEnabled: true,
    messageEnabled: true,
    systemEnabled: true
  };
}

function toNotificationSettingsPatch(value: unknown): NotificationSettingsPatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const input = value as Record<string, unknown>;
  const patch: NotificationSettingsPatch = {};
  for (const key of [
    'emailEnabled',
    'pushEnabled',
    'soundEnabled',
    'mentionEnabled',
    'assignmentEnabled',
    'messageEnabled',
    'systemEnabled'
  ] as const) {
    if (typeof input[key] === 'boolean') {
      patch[key] = input[key];
    }
  }

  return patch;
}

export class NotificationHandler {
  private notificationService: NotificationService;
  private channelService: NotificationChannelService;
  private validator: NotificationValidator;

  constructor(database: D1Database, kvNamespace: KVNamespace) {
    this.channelService = new NotificationChannelService();
    this.notificationService = new NotificationService(database, kvNamespace, this.channelService);
    this.validator = new NotificationValidator();
  }

  private async loadSettings(
    kvNamespace: KVNamespace,
    userId: string | number
  ): Promise<SharedNotificationSettings> {
    const stored = await kvNamespace.get(notificationSettingsKey(userId));
    if (!stored) {
      return defaultNotificationSettings(userId);
    }

    try {
      const parsed = JSON.parse(stored) as Partial<SharedNotificationSettings>;
      return {
        ...defaultNotificationSettings(userId),
        ...parsed,
        userId: parsed.userId ?? normalizeSettingsUserId(userId)
      };
    } catch {
      return defaultNotificationSettings(userId);
    }
  }

  // 獲取通知列表
  list = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      const queryParams = c.req.query();
      const query: NotificationQuery = {
        userId: payload.userId,  // 直接使用，支援字串或數字格式
        type: queryParams.type as NotificationType,
        priority: queryParams.priority as NotificationPriority,
        isRead: queryParams.isRead ? queryParams.isRead === 'true' : undefined,
        dateFrom: queryParams.dateFrom,
        dateTo: queryParams.dateTo,
        page: parseInt(queryParams.page || '1'),
        pageSize: parseInt(queryParams.pageSize || '20')
      };

      // 驗證查詢參數
      this.validator.validateQuery(query);

      // 清理和格式化查詢
      const sanitizedQuery = this.validator.sanitizeQuery(query);

      // 獲取通知列表
      const result = await this.notificationService.getByQuery(sanitizedQuery);

      const limit = result.pagination.pageSize;
      const totalPages = result.pagination.totalPages ?? Math.ceil(result.pagination.total / limit);
      return contractJson(c, notificationContracts.list, {
        success: true,
        data: {
          items: result.notifications,
          page: result.pagination.page,
          pageSize: limit,
          limit,
          total: result.pagination.total,
          totalPages,
          hasNext: result.pagination.page < totalPages,
          hasPrev: result.pagination.page > 1
        },
        message: 'Notifications retrieved successfully',
        timestamp: nowISO()
      });

    } catch (error) {
      if (error instanceof NotificationValidationError) {
        return validationErrorResponse(c, error.errors);
      }
      return handleApiError(error, c);
    }
  };

  // 創建單個通知
  create = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId && !payload?.role) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      const requestBody = await c.req.json().catch(() => ({}));

      // 如果請求者不是系統管理員，只能為自己創建通知
      const targetUserId = payload.role === 'admin' ?
        (requestBody.userId || payload.userId) :
        payload.userId;

      const request: CreateNotificationRequest = {
        userId: targetUserId,
        type: requestBody.type,
        title: requestBody.title,
        content: requestBody.content,
        data: requestBody.data,
        priority: requestBody.priority || 'normal',
        channels: requestBody.channels,
        expiresAt: requestBody.expiresAt ? new Date(requestBody.expiresAt) : undefined
      };

      // 驗證和清理請求
      this.validator.validateCreateRequest(request);
      const sanitizedRequest = this.validator.sanitizeCreateRequest(request);

      // 創建通知
      const notificationId = await this.notificationService.create(sanitizedRequest);

      return contractJson(c, notificationContracts.create, {
        success: true,
        data: {
          id: notificationId
        },
        message: 'Notification created successfully',
        timestamp: nowISO()
      }, 201);

    } catch (error) {
      if (error instanceof NotificationValidationError) {
        return validationErrorResponse(c, error.errors);
      }
      return handleApiError(error, c);
    }
  };

  // 批量創建通知
  createBulk = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin privileges required for bulk operations');
      }

      const requestBody = await c.req.json().catch(() => ({}));
      const request: BulkCreateNotificationRequest = {
        notifications: requestBody.notifications || [],
        batchId: requestBody.batchId
      };

      // 驗證批量請求
      this.validator.validateBulkCreateRequest(request);

      // 批量創建通知
      const result = await this.notificationService.createBulk(request);

      return contractJson(c, notificationContracts.createBulk, {
        success: true,
        data: {
          successful: result.successful.length,
          failed: result.failed.length,
          successfulIds: result.successful,
          failures: result.failed
        },
        message: `Bulk operation completed: ${result.successful.length} successful, ${result.failed.length} failed`,
        timestamp: nowISO()
      });

    } catch (error) {
      if (error instanceof NotificationValidationError) {
        return validationErrorResponse(c, error.errors);
      }
      return handleApiError(error, c);
    }
  };

  // 獲取單個通知
  getById = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      const notificationId = c.req.param('id')!;
      const notification = await this.notificationService.getById(notificationId, payload.userId);

      if (!notification) {
        return notFoundResponse(c, 'Notification');
      }

      return contractJson(c, notificationContracts.getById, {
        success: true,
        data: notification,
        message: 'Notification retrieved successfully',
        timestamp: nowISO()
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 標記通知為已讀
  markAsRead = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      const notificationId = c.req.param('id')!;
      const success = await this.notificationService.markAsRead(notificationId, payload.userId);

      if (!success) {
        return notFoundResponse(c, 'Notification');
      }

      return contractJson(c, notificationContracts.markAsRead, {
        success: true,
        message: 'Notification marked as read',
        timestamp: nowISO()
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 批量標記為已讀
  markAllAsRead = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      const { type } = await c.req.json().catch(() => ({}));
      const count = await this.notificationService.markAllAsRead(payload.userId, type);

      return contractJson(c, notificationContracts.markAllAsRead, {
        success: true,
        data: {
          updated: count
        },
        message: `${count} notifications marked as read`,
        timestamp: nowISO()
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 刪除通知
  delete = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      const notificationId = c.req.param('id')!;
      const success = await this.notificationService.delete(notificationId, payload.userId);

      if (!success) {
        return notFoundResponse(c, 'Notification');
      }

      return contractJson(c, notificationContracts.delete, {
        success: true,
        message: 'Notification deleted successfully',
        timestamp: nowISO()
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 獲取通知統計
  getStats = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      const stats = await this.notificationService.getStats(payload.userId);

      return contractJson(c, notificationContracts.stats, {
        success: true,
        data: stats,
        message: 'Notification statistics retrieved successfully',
        timestamp: nowISO()
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 獲取未讀通知數量
  getUnreadCount = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      const { type } = c.req.query();
      const count = await this.notificationService.getUnreadCount(
        payload.userId,
        type as NotificationType
      );

      return contractJson(c, notificationContracts.unreadCount, {
        success: true,
        data: {
          count,
          type: type || 'all'
        },
        message: 'Unread count retrieved successfully',
        timestamp: nowISO()
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 獲取最近通知
  getRecent = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      const { limit = '10' } = c.req.query();
      const limitNum = Math.min(parseInt(limit), 50); // 最多50個

      const notifications = await this.notificationService.getRecentNotifications(
        payload.userId,
        limitNum
      );

      return contractJson(c, notificationContracts.recent, {
        success: true,
        data: {
          notifications,
          count: notifications.length,
          limit: limitNum
        },
        message: 'Recent notifications retrieved successfully',
        timestamp: nowISO()
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 清理過期通知 (僅管理員)
  cleanup = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin privileges required');
      }

      const deletedCount = await this.notificationService.cleanupExpired();

      return contractJson(c, notificationContracts.cleanup, {
        success: true,
        data: {
          deleted: deletedCount
        },
        message: `${deletedCount} expired notifications deleted`,
        timestamp: nowISO()
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 通道管理相關端點

  // 獲取通道狀態
  getChannelStats = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin privileges required');
      }

      const stats = this.channelService.getChannelStats();

      return contractJson(c, notificationContracts.channelStats, {
        success: true,
        data: stats,
        message: 'Channel statistics retrieved successfully',
        timestamp: nowISO()
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 測試通道
  testChannel = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      const channelType = c.req.param('channelType');
      const { message } = await c.req.json().catch(() => ({}));

      if (!channelType || !isChannelType(channelType)) {
        return validationErrorResponse(c, [{ field: 'channelType', message: 'Invalid notification channel' }]);
      }

      const result = await this.channelService.testChannel(
        channelType,
        payload.userId,
        message
      );

      return contractJson(c, notificationContracts.testChannel, {
        success: true,
        data: result,
        message: `Test message sent to ${channelType} channel`,
        timestamp: nowISO()
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 便利方法：創建特定類型的通知

  // 創建新訊息通知
  notifyNewMessage = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const { userId, conversationId, senderName, content, channels } = await c.req.json();

      const notificationId = await this.notificationService.notifyNewMessage(
        userId,
        conversationId,
        senderName,
        content,
        channels
      );

      return contractJson(c, notificationContracts.newMessage, {
        success: true,
        data: {
          id: notificationId
        },
        message: 'New message notification created',
        timestamp: nowISO()
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 創建對話指派通知
  notifyConversationAssigned = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const { userId, conversationId, customerName, assignedBy } = await c.req.json();

      const notificationId = await this.notificationService.notifyConversationAssigned(
        userId,
        conversationId,
        customerName,
        assignedBy
      );

      return contractJson(c, notificationContracts.conversationAssigned, {
        success: true,
        data: {
          id: notificationId
        },
        message: 'Conversation assignment notification created',
        timestamp: nowISO()
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 創建系統通知（含 WebSocket 即時廣播）
  notifySystem = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin privileges required for system notifications');
      }

      const { userIds, title, content, data, broadcastToAll } = await c.req.json();

      if (!title || !content) {
        return errorResponse(c, 'Title and content are required', 400);
      }

      const env = c.env;
      let targetUserIds: string[] = userIds || [];

      // 如果指定廣播給所有用戶，從資料庫獲取所有活躍用戶 ID
      if (broadcastToAll || (!userIds || userIds.length === 0)) {
        const db = createDbClient(env.DB);
        const activeAgents = await db
          .select({ id: agents.id })
          .from(agents)
          .where(isNull(agents.deletedAt));

        targetUserIds = activeAgents.map(agent => agent.id);
      }

      if (targetUserIds.length === 0) {
        return errorResponse(c, 'No target users found', 400);
      }

      // 使用 triggerSystemNotification 觸發通知並廣播至 WebSocket
      const notificationIds = await triggerSystemNotification(env, {
        userIds: targetUserIds,
        title,
        content,
        data
      });

      return contractJson(c, notificationContracts.system, {
        success: true,
        data: {
          ids: notificationIds,
          count: notificationIds.length,
          broadcastedToAll: broadcastToAll || (!userIds || userIds.length === 0)
        },
        message: `${notificationIds.length} system notifications created and broadcasted`,
        timestamp: nowISO()
      });

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  getSettings = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      const settings = await this.loadSettings(c.env.CACHE, payload.userId);

      return contractJson(c, notificationContracts.settings, {
        success: true,
        data: settings,
        message: 'Notification settings retrieved successfully',
        timestamp: nowISO()
      });
    } catch (error) {
      return handleApiError(error, c);
    }
  };

  updateSettings = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      const requestBody = await c.req.json().catch(() => ({}));
      const currentSettings = await this.loadSettings(c.env.CACHE, payload.userId);
      const nextSettings = {
        ...currentSettings,
        ...toNotificationSettingsPatch(requestBody),
        userId: currentSettings.userId
      };

      await c.env.CACHE.put(notificationSettingsKey(payload.userId), JSON.stringify(nextSettings));

      return contractJson(c, notificationContracts.updateSettings, {
        success: true,
        message: 'Notification settings updated successfully',
        timestamp: nowISO()
      });
    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 系統公告廣播端點（簡化版）
  broadcast = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin privileges required for broadcasting');
      }

      const { title, content, priority, data } = await c.req.json();

      if (!title || !content) {
        return errorResponse(c, 'Title and content are required', 400);
      }

      const env = c.env;

      // 獲取所有活躍用戶
      const db = createDbClient(env.DB);
      const activeAgents = await db
        .select({ id: agents.id })
        .from(agents)
        .where(isNull(agents.deletedAt));

      const targetUserIds = activeAgents.map(agent => agent.id);

      if (targetUserIds.length === 0) {
        return errorResponse(c, 'No active users found', 400);
      }

      // 觸發系統通知並廣播
      const notificationIds = await triggerSystemNotification(env, {
        userIds: targetUserIds,
        title,
        content,
        data: { ...data, priority: priority || 'normal', broadcastedBy: payload.userId }
      });

      return successResponse(c, {
        ids: notificationIds,
        recipientCount: targetUserIds.length,
        broadcastedBy: payload.userId,
        timestamp: nowISO()
      }, `System announcement broadcasted to ${targetUserIds.length} users`);

    } catch (error) {
      return handleApiError(error, c);
    }
  };
}

// 工廠函數：創建通知處理器實例
export function createNotificationHandler(database: D1Database, kvNamespace: KVNamespace) {
  return new NotificationHandler(database, kvNamespace);
}

// 匯出處理器方法以用於路由
export function createNotificationHandlerMethods(database: D1Database, kvNamespace: KVNamespace) {
  const handler = new NotificationHandler(database, kvNamespace);

  return {
    list: handler.list,
    create: handler.create,
    createBulk: handler.createBulk,
    getById: handler.getById,
    markAsRead: handler.markAsRead,
    markAllAsRead: handler.markAllAsRead,
    delete: handler.delete,
    getStats: handler.getStats,
    getUnreadCount: handler.getUnreadCount,
    getRecent: handler.getRecent,
    cleanup: handler.cleanup,
    getChannelStats: handler.getChannelStats,
    testChannel: handler.testChannel,
    notifyNewMessage: handler.notifyNewMessage,
    notifyConversationAssigned: handler.notifyConversationAssigned,
    notifySystem: handler.notifySystem,
    getSettings: handler.getSettings,
    updateSettings: handler.updateSettings,
    broadcast: handler.broadcast  //  系統公告廣播
  };
}
