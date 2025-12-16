// src/modules/notifications/utils/notification-validator.ts
// 通知驗證工具

import {
  CreateNotificationRequest,
  BulkCreateNotificationRequest,
  NotificationType,
  NotificationPriority,
  NotificationQuery
} from '../types';

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export class NotificationValidator {
  private readonly MAX_TITLE_LENGTH = 200;
  private readonly MAX_CONTENT_LENGTH = 1000;
  private readonly MAX_BULK_SIZE = 1000;
  private readonly MAX_PAGE_SIZE = 100;

  private readonly VALID_TYPES: NotificationType[] = [
    'new_message',
    'conversation_assigned',
    'conversation_transferred',
    'mention',
    'system',
    'priority_changed',
    'customer_responded',
    'task_reminder',
    'agent_removed_from_team'  // 🆕
  ];

  private readonly VALID_PRIORITIES: NotificationPriority[] = [
    'low',
    'normal',
    'high',
    'urgent'
  ];

  /**
   * 驗證 userId 是否有效
   * 支援字串格式（如 "admin-001"）和數字格式
   */
  private isValidUserId(userId: string | number | undefined | null): boolean {
    if (userId === undefined || userId === null) {
      return false;
    }

    if (typeof userId === 'string') {
      return userId.trim().length > 0;
    }

    if (typeof userId === 'number') {
      return !isNaN(userId) && userId > 0;
    }

    return false;
  }

  validateCreateRequest(request: CreateNotificationRequest): void {
    const errors: ValidationError[] = [];

    // 驗證必填欄位 - 支援字串和數字格式的 userId
    const userIdValid = this.isValidUserId(request.userId);
    if (!userIdValid) {
      errors.push({
        field: 'userId',
        message: 'User ID is required and must be a non-empty string or positive number',
        code: 'INVALID_USER_ID'
      });
    }

    if (!request.type) {
      errors.push({
        field: 'type',
        message: 'Notification type is required',
        code: 'MISSING_TYPE'
      });
    } else if (!this.VALID_TYPES.includes(request.type)) {
      errors.push({
        field: 'type',
        message: `Invalid notification type. Valid types: ${this.VALID_TYPES.join(', ')}`,
        code: 'INVALID_TYPE'
      });
    }

    if (!request.title || request.title.trim().length === 0) {
      errors.push({
        field: 'title',
        message: 'Title is required and cannot be empty',
        code: 'MISSING_TITLE'
      });
    } else if (request.title.length > this.MAX_TITLE_LENGTH) {
      errors.push({
        field: 'title',
        message: `Title cannot exceed ${this.MAX_TITLE_LENGTH} characters`,
        code: 'TITLE_TOO_LONG'
      });
    }

    if (!request.content || request.content.trim().length === 0) {
      errors.push({
        field: 'content',
        message: 'Content is required and cannot be empty',
        code: 'MISSING_CONTENT'
      });
    } else if (request.content.length > this.MAX_CONTENT_LENGTH) {
      errors.push({
        field: 'content',
        message: `Content cannot exceed ${this.MAX_CONTENT_LENGTH} characters`,
        code: 'CONTENT_TOO_LONG'
      });
    }

    // 驗證可選欄位
    if (request.priority && !this.VALID_PRIORITIES.includes(request.priority)) {
      errors.push({
        field: 'priority',
        message: `Invalid priority. Valid priorities: ${this.VALID_PRIORITIES.join(', ')}`,
        code: 'INVALID_PRIORITY'
      });
    }

    // 驗證資料物件
    if (request.data && typeof request.data !== 'object') {
      errors.push({
        field: 'data',
        message: 'Data must be a valid object',
        code: 'INVALID_DATA_TYPE'
      });
    }

    // 驗證過期時間
    if (request.expiresAt) {
      if (!(request.expiresAt instanceof Date)) {
        errors.push({
          field: 'expiresAt',
          message: 'ExpiresAt must be a valid Date object',
          code: 'INVALID_EXPIRES_AT'
        });
      } else if (request.expiresAt <= new Date()) {
        errors.push({
          field: 'expiresAt',
          message: 'ExpiresAt must be in the future',
          code: 'EXPIRES_AT_IN_PAST'
        });
      }
    }

    // 驗證排程時間
    if (request.scheduleAt) {
      if (!(request.scheduleAt instanceof Date)) {
        errors.push({
          field: 'scheduleAt',
          message: 'ScheduleAt must be a valid Date object',
          code: 'INVALID_SCHEDULE_AT'
        });
      } else if (request.scheduleAt <= new Date()) {
        errors.push({
          field: 'scheduleAt',
          message: 'ScheduleAt must be in the future',
          code: 'SCHEDULE_AT_IN_PAST'
        });
      }
    }

    // 驗證通道配置
    if (request.channels && request.channels.length > 0) {
      const validChannels = ['sse', 'websocket', 'email', 'push', 'sms'];
      const invalidChannels = request.channels.filter(channel => !validChannels.includes(channel));

      if (invalidChannels.length > 0) {
        errors.push({
          field: 'channels',
          message: `Invalid channels: ${invalidChannels.join(', ')}. Valid channels: ${validChannels.join(', ')}`,
          code: 'INVALID_CHANNELS'
        });
      }
    }

    if (errors.length > 0) {
      throw new NotificationValidationError('Validation failed', errors);
    }
  }

  validateBulkCreateRequest(request: BulkCreateNotificationRequest): void {
    const errors: ValidationError[] = [];

    if (!request.notifications || !Array.isArray(request.notifications)) {
      errors.push({
        field: 'notifications',
        message: 'Notifications must be an array',
        code: 'INVALID_NOTIFICATIONS_ARRAY'
      });
      throw new NotificationValidationError('Validation failed', errors);
    }

    if (request.notifications.length === 0) {
      errors.push({
        field: 'notifications',
        message: 'At least one notification is required',
        code: 'EMPTY_NOTIFICATIONS_ARRAY'
      });
    } else if (request.notifications.length > this.MAX_BULK_SIZE) {
      errors.push({
        field: 'notifications',
        message: `Cannot create more than ${this.MAX_BULK_SIZE} notifications at once`,
        code: 'BULK_SIZE_EXCEEDED'
      });
    }

    // 驗證每個通知
    request.notifications.forEach((notification, index) => {
      try {
        this.validateCreateRequest(notification);
      } catch (error) {
        if (error instanceof NotificationValidationError) {
          error.errors.forEach(err => {
            errors.push({
              field: `notifications[${index}].${err.field}`,
              message: err.message,
              code: err.code
            });
          });
        }
      }
    });

    if (errors.length > 0) {
      throw new NotificationValidationError('Bulk validation failed', errors);
    }
  }

  validateQuery(query: NotificationQuery): void {
    const errors: ValidationError[] = [];

    // 驗證用戶ID - 支援字串和數字格式
    const userIdValid = this.isValidUserId(query.userId);
    if (!userIdValid) {
      errors.push({
        field: 'userId',
        message: 'User ID is required and must be a non-empty string or positive number',
        code: 'INVALID_USER_ID'
      });
    }

    // 驗證類型
    if (query.type && !this.VALID_TYPES.includes(query.type)) {
      errors.push({
        field: 'type',
        message: `Invalid notification type. Valid types: ${this.VALID_TYPES.join(', ')}`,
        code: 'INVALID_TYPE'
      });
    }

    // 驗證優先級
    if (query.priority && !this.VALID_PRIORITIES.includes(query.priority)) {
      errors.push({
        field: 'priority',
        message: `Invalid priority. Valid priorities: ${this.VALID_PRIORITIES.join(', ')}`,
        code: 'INVALID_PRIORITY'
      });
    }

    // 驗證日期範圍
    if (query.dateFrom && query.dateTo) {
      const fromDate = new Date(query.dateFrom);
      const toDate = new Date(query.dateTo);

      if (isNaN(fromDate.getTime())) {
        errors.push({
          field: 'dateFrom',
          message: 'Invalid dateFrom format',
          code: 'INVALID_DATE_FROM'
        });
      }

      if (isNaN(toDate.getTime())) {
        errors.push({
          field: 'dateTo',
          message: 'Invalid dateTo format',
          code: 'INVALID_DATE_TO'
        });
      }

      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime()) && fromDate > toDate) {
        errors.push({
          field: 'dateRange',
          message: 'dateFrom cannot be later than dateTo',
          code: 'INVALID_DATE_RANGE'
        });
      }
    }

    // 驗證分頁參數
    if (query.page !== undefined) {
      if (!Number.isInteger(query.page) || query.page < 1) {
        errors.push({
          field: 'page',
          message: 'Page must be a positive integer',
          code: 'INVALID_PAGE'
        });
      }
    }

    if (query.pageSize !== undefined) {
      if (!Number.isInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > this.MAX_PAGE_SIZE) {
        errors.push({
          field: 'pageSize',
          message: `Page size must be between 1 and ${this.MAX_PAGE_SIZE}`,
          code: 'INVALID_PAGE_SIZE'
        });
      }
    }

    if (errors.length > 0) {
      throw new NotificationValidationError('Query validation failed', errors);
    }
  }

  // 清理和格式化輸入資料
  sanitizeCreateRequest(request: CreateNotificationRequest): CreateNotificationRequest {
    return {
      ...request,
      title: request.title?.trim(),
      content: request.content?.trim(),
      priority: request.priority || 'normal',
      data: request.data ? this.sanitizeData(request.data) : undefined
    };
  }

  sanitizeQuery(query: NotificationQuery): NotificationQuery {
    return {
      ...query,
      page: query.page || 1,
      pageSize: Math.min(query.pageSize || 20, this.MAX_PAGE_SIZE)
    };
  }

  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    // 深度清理物件，移除潛在的危險內容
    const sanitized: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // 基本的 XSS 防護
        sanitized[key] = value.replace(/<script[^>]*>.*?<\/script>/gi, '')
                              .replace(/<[^>]+>/g, '')
                              .trim();
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

export class NotificationValidationError extends Error {
  public errors: ValidationError[];

  constructor(message: string, errors: ValidationError[]) {
    super(message);
    this.name = 'NotificationValidationError';
    this.errors = errors;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errors: this.errors
    };
  }
}