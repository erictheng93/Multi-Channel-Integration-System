// src/utils/notification-trigger.ts
// 通知觸發工具函數 - 簡化業務邏輯與通知服務的整合
// 整合 Durable Objects WebSocket 廣播實現真正的即時推送

import { NotificationService, NotificationChannelService } from '@modules/notifications';
import { WebSocketBroadcastService } from '../services/websocket-broadcast-service';
import type { NotificationPriority } from '@modules/notifications/types';
import type { Bindings } from '../types';

/**
 * 通知觸發器配置 - 需要完整的 Worker 環境綁定
 */
type NotificationTriggerEnv = Bindings;

/**
 * 創建通知服務實例的工廠函數
 */
export function createNotificationService(env: NotificationTriggerEnv): NotificationService {
  const channelService = new NotificationChannelService();
  return new NotificationService(env.DB, env.CACHE, channelService);
}

/**
 * 安全地解析用戶 ID 為數字
 */
function parseUserId(userId: string | number): number {
  if (typeof userId === 'number') return userId;
  const parsed = parseInt(userId, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid user ID: ${userId}`);
  }
  return parsed;
}

/**
 * 透過 Durable Objects 廣播通知到用戶的 WebSocket 連線
 * 這是實現即時通知的核心方法
 */
async function broadcastNotificationViaWebSocket(
  env: NotificationTriggerEnv,
  userId: string | number,
  notification: {
    id: string;
    type: string;
    title: string;
    content: string;
    priority: string;
    data?: Record<string, unknown>;
  }
): Promise<boolean> {
  try {
    const broadcastService = new WebSocketBroadcastService(env);

    const success = await broadcastService.broadcastNotificationEvent({
      type: 'notification',
      userId: String(userId),
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        priority: notification.priority,
        data: notification.data,
        createdAt: new Date().toISOString()
      }
    });

    if (success) {
      console.log('📡 [Notification] WebSocket broadcast successful:', {
        userId,
        notificationId: notification.id,
        type: notification.type
      });
    }

    return success;
  } catch (error) {
    console.warn('⚠️ [Notification] WebSocket broadcast failed (notification still saved):', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      notificationId: notification.id
    });
    return false;
  }
}

/**
 * 新訊息通知觸發器
 * 當客戶發送新訊息時，通知負責的客服
 */
export async function triggerNewMessageNotification(
  env: NotificationTriggerEnv,
  options: {
    assignedUserId: string | number;
    conversationId: string | number;
    senderName: string;
    messageContent: string;
  }
): Promise<string | null> {
  try {
    const service = createNotificationService(env);
    const userId = parseUserId(options.assignedUserId);
    const conversationId = typeof options.conversationId === 'string'
      ? parseInt(options.conversationId, 10) || 0
      : options.conversationId;

    // 1. 建立通知記錄到資料庫
    const notificationId = await service.notifyNewMessage(
      userId,
      conversationId,
      options.senderName,
      options.messageContent
    );

    console.log('✅ [Notification] New message notification created:', {
      notificationId,
      userId,
      conversationId,
      senderName: options.senderName
    });

    // 2. 透過 WebSocket 即時推送通知
    await broadcastNotificationViaWebSocket(env, options.assignedUserId, {
      id: notificationId,
      type: 'new_message',
      title: '新訊息',
      content: `${options.senderName}: ${options.messageContent.substring(0, 100)}${options.messageContent.length > 100 ? '...' : ''}`,
      priority: 'normal',
      data: { conversationId, senderName: options.senderName }
    });

    return notificationId;
  } catch (error) {
    console.warn('⚠️ [Notification] Failed to send new message notification:', {
      error: error instanceof Error ? error.message : String(error),
      ...options
    });
    return null;
  }
}

/**
 * 對話指派通知觸發器
 * 當對話被指派給客服時通知該客服
 */
export async function triggerConversationAssignedNotification(
  env: NotificationTriggerEnv,
  options: {
    assignedUserId: string | number;
    conversationId: string | number;
    customerName: string;
    assignedBy: string;
  }
): Promise<string | null> {
  try {
    const service = createNotificationService(env);
    const userId = parseUserId(options.assignedUserId);
    const conversationId = typeof options.conversationId === 'string'
      ? parseInt(options.conversationId, 10) || 0
      : options.conversationId;

    // 1. 建立通知記錄到資料庫
    const notificationId = await service.notifyConversationAssigned(
      userId,
      conversationId,
      options.customerName,
      options.assignedBy
    );

    console.log('✅ [Notification] Conversation assigned notification created:', {
      notificationId,
      userId,
      conversationId,
      customerName: options.customerName,
      assignedBy: options.assignedBy
    });

    // 2. 透過 WebSocket 即時推送通知
    await broadcastNotificationViaWebSocket(env, options.assignedUserId, {
      id: notificationId,
      type: 'conversation_assigned',
      title: '對話已指派',
      content: `${options.assignedBy} 將與 ${options.customerName} 的對話指派給您`,
      priority: 'high',
      data: { conversationId, customerName: options.customerName, assignedBy: options.assignedBy }
    });

    return notificationId;
  } catch (error) {
    console.warn('⚠️ [Notification] Failed to send assignment notification:', {
      error: error instanceof Error ? error.message : String(error),
      ...options
    });
    return null;
  }
}

/**
 * 對話轉移通知觸發器
 * 當對話被轉移時通知目標客服
 */
export async function triggerConversationTransferredNotification(
  env: NotificationTriggerEnv,
  options: {
    toUserId: string | number;
    conversationId: string | number;
    customerName: string;
    transferredBy: string;
    fromUserId?: string | number;
    reason?: string;
  }
): Promise<string | null> {
  try {
    const service = createNotificationService(env);
    const userId = parseUserId(options.toUserId);
    const conversationId = typeof options.conversationId === 'string'
      ? parseInt(options.conversationId, 10) || 0
      : options.conversationId;

    const content = `${options.transferredBy} 將與 ${options.customerName} 的對話轉移給您`;

    // 1. 建立通知記錄到資料庫
    const notificationId = await service.create({
      userId,
      type: 'conversation_transferred',
      title: '對話已轉移',
      content,
      data: {
        conversationId,
        customerName: options.customerName,
        transferredBy: options.transferredBy,
        fromUserId: options.fromUserId,
        reason: options.reason
      },
      priority: 'high',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天後過期
    });

    console.log('✅ [Notification] Conversation transferred notification created:', {
      notificationId,
      userId,
      conversationId,
      transferredBy: options.transferredBy
    });

    // 2. 透過 WebSocket 即時推送通知
    await broadcastNotificationViaWebSocket(env, options.toUserId, {
      id: notificationId,
      type: 'conversation_transferred',
      title: '對話已轉移',
      content,
      priority: 'high',
      data: {
        conversationId,
        customerName: options.customerName,
        transferredBy: options.transferredBy,
        fromUserId: options.fromUserId,
        reason: options.reason
      }
    });

    return notificationId;
  } catch (error) {
    console.warn('⚠️ [Notification] Failed to send transfer notification:', {
      error: error instanceof Error ? error.message : String(error),
      ...options
    });
    return null;
  }
}

/**
 * 優先級變更通知觸發器
 * 當對話優先級變更時通知負責的客服
 */
export async function triggerPriorityChangedNotification(
  env: NotificationTriggerEnv,
  options: {
    userId: string | number;
    conversationIds: string[];
    newPriority: string;
    changedBy: string;
  }
): Promise<string | null> {
  try {
    const service = createNotificationService(env);
    const parsedUserId = parseUserId(options.userId);

    // 確定通知優先級
    const notificationPriority: NotificationPriority =
      options.newPriority === 'urgent' ? 'urgent' :
      options.newPriority === 'high' ? 'high' : 'normal';

    const content = options.conversationIds.length === 1
      ? `對話優先級已變更為「${getPriorityLabel(options.newPriority)}」`
      : `${options.conversationIds.length} 個對話的優先級已變更為「${getPriorityLabel(options.newPriority)}」`;

    // 1. 建立通知記錄到資料庫
    const notificationId = await service.create({
      userId: parsedUserId,
      type: 'priority_changed',
      title: '對話優先級已變更',
      content,
      data: {
        conversationIds: options.conversationIds,
        newPriority: options.newPriority,
        changedBy: options.changedBy
      },
      priority: notificationPriority,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天後過期
    });

    console.log('✅ [Notification] Priority changed notification created:', {
      notificationId,
      userId: parsedUserId,
      conversationCount: options.conversationIds.length,
      newPriority: options.newPriority
    });

    // 2. 透過 WebSocket 即時推送通知
    await broadcastNotificationViaWebSocket(env, options.userId, {
      id: notificationId,
      type: 'priority_changed',
      title: '對話優先級已變更',
      content,
      priority: notificationPriority,
      data: {
        conversationIds: options.conversationIds,
        newPriority: options.newPriority,
        changedBy: options.changedBy
      }
    });

    return notificationId;
  } catch (error) {
    console.warn('⚠️ [Notification] Failed to send priority change notification:', {
      error: error instanceof Error ? error.message : String(error),
      ...options
    });
    return null;
  }
}

/**
 * 客戶回覆通知觸發器
 * 當客戶回覆時通知負責的客服 (用於待處理對話)
 */
export async function triggerCustomerRespondedNotification(
  env: NotificationTriggerEnv,
  options: {
    assignedUserId: string | number;
    conversationId: string | number;
    customerName: string;
    messagePreview: string;
  }
): Promise<string | null> {
  try {
    const service = createNotificationService(env);
    const userId = parseUserId(options.assignedUserId);
    const conversationId = typeof options.conversationId === 'string'
      ? parseInt(options.conversationId, 10) || 0
      : options.conversationId;

    const content = `${options.customerName}: ${options.messagePreview.substring(0, 50)}${options.messagePreview.length > 50 ? '...' : ''}`;

    // 1. 建立通知記錄到資料庫
    const notificationId = await service.create({
      userId,
      type: 'customer_responded',
      title: '客戶已回覆',
      content,
      data: {
        conversationId,
        customerName: options.customerName
      },
      priority: 'normal',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小時後過期
    });

    console.log('✅ [Notification] Customer responded notification created:', {
      notificationId,
      userId,
      conversationId
    });

    // 2. 透過 WebSocket 即時推送通知
    await broadcastNotificationViaWebSocket(env, options.assignedUserId, {
      id: notificationId,
      type: 'customer_responded',
      title: '客戶已回覆',
      content,
      priority: 'normal',
      data: { conversationId, customerName: options.customerName }
    });

    return notificationId;
  } catch (error) {
    console.warn('⚠️ [Notification] Failed to send customer responded notification:', {
      error: error instanceof Error ? error.message : String(error),
      ...options
    });
    return null;
  }
}

/**
 * 系統通知觸發器
 * 發送系統公告給多個用戶
 */
export async function triggerSystemNotification(
  env: NotificationTriggerEnv,
  options: {
    userIds: (string | number)[];
    title: string;
    content: string;
    data?: Record<string, unknown>;
  }
): Promise<string[]> {
  try {
    const service = createNotificationService(env);
    const parsedUserIds = options.userIds.map(id => parseUserId(id));

    // 1. 建立通知記錄到資料庫
    const notificationIds = await service.notifySystemMessage(
      parsedUserIds,
      options.title,
      options.content,
      options.data
    );

    console.log('✅ [Notification] System notifications created:', {
      notificationIds,
      userCount: parsedUserIds.length
    });

    // 2. 透過 WebSocket 即時推送通知給每個用戶
    const broadcastPromises = options.userIds.map((userId, index) =>
      broadcastNotificationViaWebSocket(env, userId, {
        id: notificationIds[index] || crypto.randomUUID(),
        type: 'system',
        title: options.title,
        content: options.content,
        priority: 'normal',
        data: options.data
      })
    );

    await Promise.allSettled(broadcastPromises);

    return notificationIds;
  } catch (error) {
    console.warn('⚠️ [Notification] Failed to send system notifications:', {
      error: error instanceof Error ? error.message : String(error),
      ...options
    });
    return [];
  }
}

/**
 * 🆕 Agent 移出團隊通知觸發器
 * 當 Agent 被移出團隊時，通知該 Agent 並觸發前端刷新對話列表
 * 如果 Agent 正在查看該團隊的對話，前端應強制關閉對話視窗
 */
export async function triggerAgentRemovedFromTeamNotification(
  env: NotificationTriggerEnv,
  options: {
    agentId: string;
    teamId: number;
    teamName: string;
    removedBy: string;
    affectedConversationIds?: string[]; // 移出後無法再看到的對話 ID 列表
  }
): Promise<string | null> {
  try {
    const service = createNotificationService(env);
    const userId = parseUserId(options.agentId);

    const content = `您已被 ${options.removedBy} 移出「${options.teamName}」團隊`;

    // 1. 建立通知記錄到資料庫
    const notificationId = await service.create({
      userId,
      type: 'agent_removed_from_team',
      title: '團隊成員變更',
      content,
      data: {
        teamId: options.teamId,
        teamName: options.teamName,
        removedBy: options.removedBy,
        affectedConversationIds: options.affectedConversationIds || []
      },
      priority: 'high',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天後過期
    });

    console.log('✅ [Notification] Agent removed from team notification created:', {
      notificationId,
      agentId: options.agentId,
      teamId: options.teamId,
      teamName: options.teamName,
      removedBy: options.removedBy,
      affectedConversationCount: options.affectedConversationIds?.length || 0
    });

    // 2. 透過 WebSocket 即時推送通知
    // 這會觸發前端：1) 顯示 Toast 2) 刷新對話列表 3) 如果正在查看受影響的對話，強制關閉
    await broadcastNotificationViaWebSocket(env, options.agentId, {
      id: notificationId,
      type: 'agent_removed_from_team',
      title: '團隊成員變更',
      content,
      priority: 'high',
      data: {
        teamId: options.teamId,
        teamName: options.teamName,
        removedBy: options.removedBy,
        affectedConversationIds: options.affectedConversationIds || []
      }
    });

    return notificationId;
  } catch (error) {
    console.warn('⚠️ [Notification] Failed to send agent removed from team notification:', {
      error: error instanceof Error ? error.message : String(error),
      ...options
    });
    return null;
  }
}

/**
 * 🆕 團隊成員變更廣播觸發器
 * 當團隊成員新增或移除時，廣播事件讓所有管理頁面即時更新 memberCount
 * 這不會創建通知記錄，只是廣播 WebSocket 事件
 */
export async function triggerTeamMemberChangeEvent(
  env: NotificationTriggerEnv,
  options: {
    type: 'added' | 'removed';
    teamId: number;
    teamName: string;
    agentId: string;
    agentName?: string;
    memberCount: number;
    changedBy: string;
  }
): Promise<boolean> {
  try {
    const broadcastService = new WebSocketBroadcastService(env);

    const success = await broadcastService.broadcastTeamMemberEvent({
      type: options.type === 'added' ? 'team_member_added' : 'team_member_removed',
      teamId: options.teamId,
      teamName: options.teamName,
      agentId: options.agentId,
      agentName: options.agentName,
      memberCount: options.memberCount,
      changedBy: options.changedBy
    });

    if (success) {
      console.log('📡 [Team Event] Member change broadcast successful:', {
        type: options.type,
        teamId: options.teamId,
        teamName: options.teamName,
        memberCount: options.memberCount
      });
    }

    return success;
  } catch (error) {
    console.warn('⚠️ [Team Event] Member change broadcast failed:', {
      error: error instanceof Error ? error.message : String(error),
      ...options
    });
    return false;
  }
}

/**
 * 🆕 團隊資訊更新廣播觸發器
 * 當團隊資訊變更時（名稱、狀態等），廣播事件讓所有管理頁面即時更新
 */
export async function triggerTeamUpdateEvent(
  env: NotificationTriggerEnv,
  options: {
    teamId: number;
    teamName: string;
    changes: {
      name?: string;
      description?: string;
      isActive?: boolean;
      memberCount?: number;
    };
    changedBy: string;
  }
): Promise<boolean> {
  try {
    const broadcastService = new WebSocketBroadcastService(env);

    const success = await broadcastService.broadcastTeamUpdateEvent({
      teamId: options.teamId,
      teamName: options.teamName,
      changes: options.changes,
      changedBy: options.changedBy
    });

    if (success) {
      console.log('📡 [Team Event] Update broadcast successful:', {
        teamId: options.teamId,
        changes: options.changes
      });
    }

    return success;
  } catch (error) {
    console.warn('⚠️ [Team Event] Update broadcast failed:', {
      error: error instanceof Error ? error.message : String(error),
      ...options
    });
    return false;
  }
}

/**
 * 🆕 任務提醒通知觸發器
 * 當任務提醒到期時發送通知
 */
export async function triggerTaskReminderNotification(
  env: NotificationTriggerEnv,
  options: {
    userId: string | number;
    reminderId: string;
    title: string;
    content: string;
    conversationId?: string | number;
  }
): Promise<string | null> {
  try {
    const service = createNotificationService(env);
    const userId = parseUserId(options.userId);

    const notificationContent = options.content
      ? `${options.title}: ${options.content.substring(0, 50)}${options.content.length > 50 ? '...' : ''}`
      : options.title;

    // 1. 建立通知記錄到資料庫
    const notificationId = await service.create({
      userId,
      type: 'task_reminder',
      title: '⏰ 任務提醒',
      content: notificationContent,
      data: {
        reminderId: options.reminderId,
        originalTitle: options.title,
        conversationId: options.conversationId
      },
      priority: 'high',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小時後過期
    });

    console.log('✅ [Notification] Task reminder notification created:', {
      notificationId,
      userId: options.userId,
      reminderId: options.reminderId,
      title: options.title
    });

    // 2. 透過 WebSocket 即時推送通知
    await broadcastNotificationViaWebSocket(env, options.userId, {
      id: notificationId,
      type: 'task_reminder',
      title: '⏰ 任務提醒',
      content: notificationContent,
      priority: 'high',
      data: {
        reminderId: options.reminderId,
        originalTitle: options.title,
        conversationId: options.conversationId
      }
    });

    return notificationId;
  } catch (error) {
    console.warn('⚠️ [Notification] Failed to send task reminder notification:', {
      error: error instanceof Error ? error.message : String(error),
      ...options
    });
    return null;
  }
}

/**
 * 🆕 @提及通知觸發器
 * 當訊息中提及其他客服時發送通知
 */
export async function triggerMentionNotification(
  env: NotificationTriggerEnv,
  options: {
    mentionedUserId: string | number;
    mentionerName: string;
    mentionerId: string | number;
    conversationId: string | number;
    messagePreview: string;
  }
): Promise<string | null> {
  try {
    const service = createNotificationService(env);
    const userId = parseUserId(options.mentionedUserId);
    const conversationId = typeof options.conversationId === 'string'
      ? parseInt(options.conversationId, 10) || 0
      : options.conversationId;

    const content = `${options.mentionerName} 在對話中提及了您：${options.messagePreview.substring(0, 50)}${options.messagePreview.length > 50 ? '...' : ''}`;

    // 1. 建立通知記錄到資料庫
    const notificationId = await service.create({
      userId,
      type: 'mention',
      title: '有人提及了您',
      content,
      data: {
        conversationId,
        mentionerName: options.mentionerName,
        mentionerId: options.mentionerId
      },
      priority: 'high',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天後過期
    });

    console.log('✅ [Notification] Mention notification created:', {
      notificationId,
      mentionedUserId: options.mentionedUserId,
      mentionerId: options.mentionerId,
      conversationId
    });

    // 2. 透過 WebSocket 即時推送通知
    await broadcastNotificationViaWebSocket(env, options.mentionedUserId, {
      id: notificationId,
      type: 'mention',
      title: '有人提及了您',
      content,
      priority: 'high',
      data: {
        conversationId,
        mentionerName: options.mentionerName,
        mentionerId: options.mentionerId
      }
    });

    return notificationId;
  } catch (error) {
    console.warn('⚠️ [Notification] Failed to send mention notification:', {
      error: error instanceof Error ? error.message : String(error),
      ...options
    });
    return null;
  }
}

/**
 * 🆕 新客戶加入通知觸發器 (LINE follow event)
 * 當新客戶通過 LINE 加入時通知管理員或團隊成員
 */
export async function triggerCustomerFollowedNotification(
  env: NotificationTriggerEnv,
  options: {
    customerName: string;
    platform: string;
    source: 'qr_code' | 'direct';
    teamId?: number;
    teamName?: string;
    conversationId?: string;
  }
): Promise<string[]> {
  try {
    const service = createNotificationService(env);

    // 獲取應該接收通知的用戶列表
    const targetUserIds = await getNotificationTargetUsers(env, options.teamId);

    if (targetUserIds.length === 0) {
      console.log('⚠️ [Notification] No target users for customer followed notification');
      return [];
    }

    const conversationId = options.conversationId
      ? (typeof options.conversationId === 'string' ? parseInt(options.conversationId, 10) : options.conversationId)
      : undefined;

    // 創建批量通知 - 使用 try-catch 包裝每個通知創建，確保一個失敗不影響其他
    const notificationIds: string[] = [];
    const errors: Array<{ userId: string; error: string }> = [];

    for (const userId of targetUserIds) {
      try {
        console.log(`🔄 [Notification] Creating customer_followed notification for user ${userId}...`);

        const notificationId = await service.create({
          userId,
          type: 'customer_followed',
          title: '🎉 新客戶加入',
          content: `新客戶「${options.customerName}」透過 ${options.source === 'qr_code' ? 'QR Code' : '直接'} 在 ${options.platform} 加入${options.teamName ? ` 並加入「${options.teamName}」團隊` : ''}`,
          data: {
            customerName: options.customerName,
            platform: options.platform,
            source: options.source,
            teamId: options.teamId,
            teamName: options.teamName,
            conversationId
          },
          priority: 'high',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        if (notificationId) {
          console.log(`✅ [Notification] Created customer_followed notification ${notificationId} for user ${userId}`);
          notificationIds.push(notificationId);

          // 透過 WebSocket 即時推送通知
          await broadcastNotificationViaWebSocket(env, userId, {
            id: notificationId,
            type: 'customer_followed',
            title: '🎉 新客戶加入',
            content: `新客戶「${options.customerName}」透過 ${options.source === 'qr_code' ? 'QR Code' : '直接'} 在 ${options.platform} 加入${options.teamName ? ` 並加入「${options.teamName}」團隊` : ''}`,
            priority: 'high',
            data: {
              customerName: options.customerName,
              platform: options.platform,
              source: options.source,
              teamId: options.teamId,
              teamName: options.teamName,
              conversationId
            }
          });
        }
      } catch (userError) {
        const errorMsg = userError instanceof Error ? userError.message : String(userError);
        console.error(`❌ [Notification] Failed to create customer_followed notification for user ${userId}:`, errorMsg);
        errors.push({ userId: String(userId), error: errorMsg });
      }
    }

    // 記錄錯誤摘要（如果有）
    if (errors.length > 0) {
      console.warn(`⚠️ [Notification] Failed to create customer_followed notifications for ${errors.length}/${targetUserIds.length} users:`, errors);
    }

    console.log('✅ [Notification] Customer followed notifications created:', {
      notificationIds,
      targetUserCount: targetUserIds.length,
      customerName: options.customerName,
      source: options.source
    });

    return notificationIds;
  } catch (error) {
    console.warn('⚠️ [Notification] Failed to send customer followed notifications:', {
      error: error instanceof Error ? error.message : String(error),
      ...options
    });
    return [];
  }
}

/**
 * 🆕 新對話創建通知觸發器
 * 當創建新對話時（無論是否指派）通知管理員或團隊成員
 */
export async function triggerNewConversationNotification(
  env: NotificationTriggerEnv,
  options: {
    conversationId: string;
    customerName: string;
    platform: string;
    messagePreview?: string;
    teamId?: number;
  }
): Promise<string[]> {
  try {
    const service = createNotificationService(env);

    // 獲取應該接收通知的用戶列表
    const targetUserIds = await getNotificationTargetUsers(env, options.teamId);

    if (targetUserIds.length === 0) {
      console.log('⚠️ [Notification] No target users for new conversation notification');
      return [];
    }

    const conversationId = typeof options.conversationId === 'string'
      ? parseInt(options.conversationId, 10) || 0
      : options.conversationId;

    const preview = options.messagePreview
      ? `: ${options.messagePreview.substring(0, 50)}${options.messagePreview.length > 50 ? '...' : ''}`
      : '';

    console.log(`🚀 [Notification] Creating bulk notifications for ${targetUserIds.length} users`);

    // 準備批量通知請求
    const bulkRequests = targetUserIds.map(userId => ({
      userId,
      type: 'new_conversation' as const,
      title: '💬 新對話',
      content: `新客戶「${options.customerName}」在 ${options.platform} 開始了新對話${preview}`,
      data: {
        conversationId,
        customerName: options.customerName,
        platform: options.platform,
        messagePreview: options.messagePreview
      },
      priority: 'high' as const,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }));

    // 使用批量創建 API（一次性創建所有通知）
    const bulkResult = await service.createBulk({ notifications: bulkRequests });
    const notificationIds = bulkResult.successful;

    console.log(`✅ [Notification] Bulk create completed:`, {
      successful: bulkResult.successful.length,
      failed: bulkResult.failed.length,
      total: targetUserIds.length
    });

    // 如果有失敗，記錄詳細信息
    if (bulkResult.failed.length > 0) {
      console.warn(`⚠️ [Notification] Some notifications failed:`, bulkResult.failed);
    }

    // 批量廣播 WebSocket 通知（不阻塞）
    const broadcastPromises = notificationIds.map((notificationId, index) =>
      broadcastNotificationViaWebSocket(env, targetUserIds[index], {
        id: notificationId,
        type: 'new_conversation',
        title: '💬 新對話',
        content: `新客戶「${options.customerName}」在 ${options.platform} 開始了新對話${preview}`,
        priority: 'high',
        data: {
          conversationId,
          customerName: options.customerName,
          platform: options.platform,
          messagePreview: options.messagePreview
        }
      })
    );

    // 並行執行 WebSocket 廣播（不等待結果）
    Promise.allSettled(broadcastPromises).then(results => {
      const failedBroadcasts = results.filter(r => r.status === 'rejected').length;
      if (failedBroadcasts > 0) {
        console.warn(`⚠️ [Notification] ${failedBroadcasts} WebSocket broadcasts failed`);
      }
    });

    console.log('✅ [Notification] New conversation notifications created:', {
      notificationIds,
      targetUserCount: targetUserIds.length,
      conversationId: options.conversationId,
      customerName: options.customerName
    });

    return notificationIds;
  } catch (error) {
    console.warn('⚠️ [Notification] Failed to send new conversation notifications:', {
      error: error instanceof Error ? error.message : String(error),
      ...options
    });
    return [];
  }
}

/**
 * 🆕 輔助函數：獲取應該接收通知的用戶列表
 * 根據團隊 ID 獲取管理員和團隊成員（或所有客服人員）
 *
 * 行為邏輯：
 * - 如果有 teamId：返回「所有管理員 + 該團隊的所有成員」
 * - 如果沒有 teamId：返回「所有管理員 + 所有客服人員」
 */
async function getNotificationTargetUsers(
  env: NotificationTriggerEnv,
  teamId?: number
): Promise<string[]> {
  try {
    const { createDbClient } = await import('../db/drizzle-factory');
    const { agents } = await import('../db/schema');
    const { eq, and, or, inArray } = await import('drizzle-orm');

    const db = createDbClient(env.DB);

    // Step 1: 總是獲取所有活躍的管理員
    const admins = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(
        eq(agents.role, 'admin'),
        eq(agents.isActive, true)
      ))
      .all();

    const adminIds = new Set(admins.map(a => a.id));

    // Step 2: 獲取應該通知的客服人員
    let agentIds: string[] = [];

    if (teamId) {
      // 情況 A: 有指定團隊 → 獲取該團隊的所有成員
      const { agentTeams } = await import('../db/schema');
      const teamMembers = await db
        .select({ agentId: agentTeams.agentId })
        .from(agentTeams)
        .where(eq(agentTeams.teamId, teamId))
        .all();

      agentIds = teamMembers.map(m => m.agentId);

      console.log('📋 [Notification Target] Team-specific:', {
        teamId,
        teamMemberCount: agentIds.length,
        adminCount: adminIds.size
      });
    } else {
      // 情況 B: 沒有指定團隊 → 獲取所有活躍的客服人員
      const allAgents = await db
        .select({ id: agents.id })
        .from(agents)
        .where(and(
          eq(agents.role, 'agent'),
          eq(agents.isActive, true)
        ))
        .all();

      agentIds = allAgents.map(a => a.id);

      console.log('📋 [Notification Target] All agents:', {
        agentCount: agentIds.length,
        adminCount: adminIds.size
      });
    }

    // Step 3: 合併管理員和客服人員（去重）
    const allTargetUsers = [...adminIds];
    for (const agentId of agentIds) {
      if (!adminIds.has(agentId)) {
        allTargetUsers.push(agentId);
      }
    }

    console.log('✅ [Notification Target] Final target users:', {
      totalCount: allTargetUsers.length,
      adminCount: adminIds.size,
      agentCount: agentIds.length,
      teamId: teamId || 'none'
    });

    return allTargetUsers;
  } catch (error) {
    console.error('❌ [Notification Target] Error getting notification target users:', error);
    return [];
  }
}

/**
 * 輔助函數：獲取優先級的中文標籤
 */
function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    low: '低',
    normal: '一般',
    high: '高',
    urgent: '緊急'
  };
  return labels[priority] || priority;
}
