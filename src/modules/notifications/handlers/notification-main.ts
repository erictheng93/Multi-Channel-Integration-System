// src/modules/notifications/handlers/notification-main.ts
// 統一通知處理器 - 模組化的主要 API 端點

import { Context } from 'hono';
import type { Bindings } from '../../../types';
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  notFoundResponse,
  handleApiError
} from '../../../utils/api-response';

// 導入通知模組服務
import { NotificationService } from '@modules/notifications/services/notification-service';
import { NotificationChannelService } from '@modules/notifications/services/notification-channel-service';
import { NotificationValidator, NotificationValidationError } from '@modules/notifications/utils/notification-validator';
import { NotificationFactory } from '@modules/notifications/utils/notification-factory';
import {
  CreateNotificationRequest,
  BulkCreateNotificationRequest,
  NotificationQuery,
  NotificationType,
  NotificationPriority
} from '../types';

export class NotificationHandler {
  private notificationService: NotificationService;
  private channelService: NotificationChannelService;
  private validator: NotificationValidator;

  constructor(database: D1Database, kvNamespace: KVNamespace) {
    this.channelService = new NotificationChannelService();
    this.notificationService = new NotificationService(database, kvNamespace, this.channelService);
    this.validator = new NotificationValidator();
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
        userId: parseInt(String(payload.userId)),
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

      const pagination = {
        page: result.pagination.page,
        limit: result.pagination.pageSize,
        total: result.pagination.total
      };
      return paginatedResponse(c, result.notifications, pagination, 'Notifications retrieved successfully');

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
        (requestBody.userId || parseInt(String(payload.userId))) :
        parseInt(String(payload.userId));

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

      return successResponse(c, {
        id: notificationId
      }, 'Notification created successfully');

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

      return successResponse(c, {
        successful: result.successful.length,
        failed: result.failed.length,
        successfulIds: result.successful,
        failures: result.failed
      }, `Bulk operation completed: ${result.successful.length} successful, ${result.failed.length} failed`);

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

      const notificationId = c.req.param('id');
      const notification = await this.notificationService.getById(notificationId, parseInt(String(payload.userId)));

      if (!notification) {
        return notFoundResponse(c, 'Notification');
      }

      return successResponse(c, notification, 'Notification retrieved successfully');

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

      const notificationId = c.req.param('id');
      const success = await this.notificationService.markAsRead(notificationId, parseInt(String(payload.userId)));

      if (!success) {
        return notFoundResponse(c, 'Notification');
      }

      return successResponse(c, null, 'Notification marked as read');

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
      const count = await this.notificationService.markAllAsRead(parseInt(String(payload.userId)), type);

      return successResponse(c, {
        updated: count
      }, `${count} notifications marked as read`);

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

      const notificationId = c.req.param('id');
      const success = await this.notificationService.delete(notificationId, parseInt(String(payload.userId)));

      if (!success) {
        return notFoundResponse(c, 'Notification');
      }

      return successResponse(c, null, 'Notification deleted successfully');

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

      const stats = await this.notificationService.getStats(parseInt(String(payload.userId)));

      return successResponse(c, stats, 'Notification statistics retrieved successfully');

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
        parseInt(String(payload.userId)),
        type as NotificationType
      );

      return successResponse(c, {
        count,
        type: type || 'all'
      }, 'Unread count retrieved successfully');

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
        parseInt(String(payload.userId)),
        limitNum
      );

      return successResponse(c, {
        notifications,
        count: notifications.length,
        limit: limitNum
      }, 'Recent notifications retrieved successfully');

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

      return successResponse(c, {
        deleted: deletedCount
      }, `${deletedCount} expired notifications deleted`);

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

      return successResponse(c, stats, 'Channel statistics retrieved successfully');

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

      const channelType = c.req.param('channelType') as any;
      const { message } = await c.req.json().catch(() => ({}));

      const result = await this.channelService.testChannel(
        channelType,
        parseInt(String(payload.userId)),
        message
      );

      return successResponse(c, result, `Test message sent to ${channelType} channel`);

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

      return successResponse(c, {
        id: notificationId
      }, 'New message notification created');

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

      return successResponse(c, {
        id: notificationId
      }, 'Conversation assignment notification created');

    } catch (error) {
      return handleApiError(error, c);
    }
  };

  // 創建系統通知
  notifySystem = async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const payload = c.get('jwtPayload');

      if (!payload?.userId || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin privileges required for system notifications');
      }

      const { userIds, title, content, data } = await c.req.json();

      const notificationIds = await this.notificationService.notifySystemMessage(
        userIds,
        title,
        content,
        data
      );

      return successResponse(c, {
        ids: notificationIds,
        count: notificationIds.length
      }, `${notificationIds.length} system notifications created`);

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
    notifySystem: handler.notifySystem
  };
}