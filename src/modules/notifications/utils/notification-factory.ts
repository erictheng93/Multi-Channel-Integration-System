// src/modules/notifications/utils/notification-factory.ts
// 通知工廠 - 用於創建標準化的通知

import {
  CreateNotificationRequest,
  NotificationType,
  NotificationPriority
} from '../types';

export class NotificationFactory {
  // 新訊息通知
  static createNewMessageNotification(
    userId: number,
    conversationId: number,
    senderName: string,
    content: string,
    priority: NotificationPriority = 'normal'
  ): CreateNotificationRequest {
    return {
      userId,
      type: 'new_message',
      title: '新訊息',
      content: `${senderName}: ${this.truncateContent(content, 100)}`,
      data: {
        conversationId,
        senderName,
        messagePreview: content
      },
      priority,
      channels: ['sse', 'push'],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小時後過期
    };
  }

  // 對話指派通知
  static createConversationAssignedNotification(
    userId: number,
    conversationId: number,
    customerName: string,
    assignedBy: string,
    assignedByUserId: number
  ): CreateNotificationRequest {
    return {
      userId,
      type: 'conversation_assigned',
      title: '對話已指派',
      content: `${assignedBy} 將與 ${customerName} 的對話指派給您`,
      data: {
        conversationId,
        customerName,
        assignedBy,
        assignedByUserId,
        actionType: 'assignment'
      },
      priority: 'high',
      channels: ['sse', 'email', 'push'],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天後過期
    };
  }

  // 對話轉移通知
  static createConversationTransferredNotification(
    userId: number,
    conversationId: number,
    customerName: string,
    fromUser: string,
    fromUserId: number,
    reason?: string
  ): CreateNotificationRequest {
    const contentParts = [`${fromUser} 將與 ${customerName} 的對話轉移給您`];
    if (reason) {
      contentParts.push(`原因: ${reason}`);
    }

    return {
      userId,
      type: 'conversation_transferred',
      title: '對話已轉移',
      content: contentParts.join('，'),
      data: {
        conversationId,
        customerName,
        fromUser,
        fromUserId,
        reason,
        actionType: 'transfer'
      },
      priority: 'high',
      channels: ['sse', 'email', 'push'],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
  }

  // 提及通知
  static createMentionNotification(
    userId: number,
    conversationId: number,
    mentionedBy: string,
    mentionedByUserId: number,
    context: string
  ): CreateNotificationRequest {
    return {
      userId,
      type: 'mention',
      title: '您被提及',
      content: `${mentionedBy} 在對話中提及了您: ${this.truncateContent(context, 80)}`,
      data: {
        conversationId,
        mentionedBy,
        mentionedByUserId,
        context,
        actionType: 'mention'
      },
      priority: 'high',
      channels: ['sse', 'push'],
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3天後過期
    };
  }

  // 優先級變更通知
  static createPriorityChangedNotification(
    userId: number,
    conversationId: number,
    customerName: string,
    newPriority: string,
    changedBy: string,
    changedByUserId: number,
    oldPriority?: string
  ): CreateNotificationRequest {
    const priorityText = oldPriority
      ? `從 ${oldPriority} 變更為 ${newPriority}`
      : `設為 ${newPriority}`;

    return {
      userId,
      type: 'priority_changed',
      title: '對話優先級已變更',
      content: `${changedBy} 將與 ${customerName} 的對話優先級${priorityText}`,
      data: {
        conversationId,
        customerName,
        newPriority,
        oldPriority,
        changedBy,
        changedByUserId,
        actionType: 'priority_change'
      },
      priority: newPriority === 'urgent' ? 'high' : 'normal',
      channels: ['sse'],
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    };
  }

  // 客戶回覆通知
  static createCustomerResponseNotification(
    userId: number,
    conversationId: number,
    customerName: string,
    message: string,
    platform: string
  ): CreateNotificationRequest {
    return {
      userId,
      type: 'customer_responded',
      title: '客戶回覆',
      content: `${customerName} 在 ${platform} 回覆了: ${this.truncateContent(message, 80)}`,
      data: {
        conversationId,
        customerName,
        message,
        platform,
        actionType: 'customer_response'
      },
      priority: 'normal',
      channels: ['sse', 'push'],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }

  // 任務提醒通知
  static createTaskReminderNotification(
    userId: number,
    taskId: string,
    taskTitle: string,
    dueDate: Date,
    conversationId?: number
  ): CreateNotificationRequest {
    const dueTimeText = this.formatDueTime(dueDate);

    return {
      userId,
      type: 'task_reminder',
      title: '任務提醒',
      content: `任務 "${taskTitle}" ${dueTimeText}`,
      data: {
        taskId,
        taskTitle,
        dueDate: dueDate.toISOString(),
        conversationId,
        actionType: 'task_reminder'
      },
      priority: dueDate <= new Date(Date.now() + 60 * 60 * 1000) ? 'urgent' : 'normal', // 1小時內到期設為緊急
      channels: ['sse', 'push'],
      expiresAt: new Date(dueDate.getTime() + 24 * 60 * 60 * 1000) // 到期後24小時過期
    };
  }

  // 系統通知
  static createSystemNotification(
    userId: number,
    title: string,
    content: string,
    data?: Record<string, any>,
    priority: NotificationPriority = 'normal',
    expiresInDays: number = 30
  ): CreateNotificationRequest {
    return {
      userId,
      type: 'system',
      title,
      content,
      data: {
        ...data,
        actionType: 'system_notification'
      },
      priority,
      channels: ['sse', 'email'],
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    };
  }

  // 批量系統通知
  static createBulkSystemNotifications(
    userIds: number[],
    title: string,
    content: string,
    data?: Record<string, any>,
    priority: NotificationPriority = 'normal',
    expiresInDays: number = 30
  ): CreateNotificationRequest[] {
    return userIds.map(userId =>
      this.createSystemNotification(userId, title, content, data, priority, expiresInDays)
    );
  }

  // 輔助方法：截斷內容
  private static truncateContent(content: string, maxLength: number): string {
    if (!content) return '';

    if (content.length <= maxLength) {
      return content;
    }

    return content.substring(0, maxLength).trim() + '...';
  }

  // 輔助方法：格式化到期時間
  private static formatDueTime(dueDate: Date): string {
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs <= 0) {
      return '已到期';
    } else if (diffMinutes < 60) {
      return `還有 ${diffMinutes} 分鐘到期`;
    } else if (diffHours < 24) {
      return `還有 ${diffHours} 小時到期`;
    } else if (diffDays === 1) {
      return '明天到期';
    } else {
      return `還有 ${diffDays} 天到期`;
    }
  }

  // 🆕 新客戶加入通知 (LINE follow event)
  static createCustomerFollowedNotification(
    targetUserIds: number[],  // 接收通知的用戶 ID 列表（管理員或團隊成員）
    customerName: string,
    platform: string,
    source: 'qr_code' | 'direct',
    teamName?: string,
    conversationId?: number
  ): CreateNotificationRequest[] {
    const sourceText = source === 'qr_code' ? 'QR Code' : '直接';
    const teamText = teamName ? ` 並加入「${teamName}」團隊` : '';
    const content = `新客戶「${customerName}」透過 ${sourceText} 在 ${platform} 加入${teamText}`;

    return targetUserIds.map(userId => ({
      userId,
      type: 'customer_followed',
      title: '🎉 新客戶加入',
      content,
      data: {
        customerName,
        platform,
        source,
        teamName,
        conversationId,
        actionType: 'customer_follow'
      },
      priority: 'high',
      channels: ['sse', 'push', 'websocket'],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天後過期
    }));
  }

  // 🆕 新對話創建通知 (未指派的新對話)
  static createNewConversationNotification(
    targetUserIds: number[],  // 接收通知的用戶 ID 列表（管理員或團隊成員）
    conversationId: number,
    customerName: string,
    platform: string,
    messagePreview?: string
  ): CreateNotificationRequest[] {
    const preview = messagePreview
      ? `: ${this.truncateContent(messagePreview, 50)}`
      : '';
    const content = `新客戶「${customerName}」在 ${platform} 開始了新對話${preview}`;

    return targetUserIds.map(userId => ({
      userId,
      type: 'new_conversation',
      title: '💬 新對話',
      content,
      data: {
        conversationId,
        customerName,
        platform,
        messagePreview,
        actionType: 'new_conversation'
      },
      priority: 'high',
      channels: ['sse', 'push', 'websocket'],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天後過期
    }));
  }

  // 驗證和清理工廠參數
  private static validateUserId(userId: number): void {
    if (!userId || userId <= 0) {
      throw new Error('Invalid userId: must be a positive number');
    }
  }

  private static validateConversationId(conversationId: number): void {
    if (!conversationId || conversationId <= 0) {
      throw new Error('Invalid conversationId: must be a positive number');
    }
  }

  private static sanitizeString(str: string): string {
    return str?.trim().replace(/\s+/g, ' ') || '';
  }
}