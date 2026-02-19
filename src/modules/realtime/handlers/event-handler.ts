// 事件處理器 - 專門處理各種即時事件

import { Context } from 'hono';
import type { Bindings, JWTPayload } from '@/types';
import type {
  EventType,
  EventSource,
  EventPriority,
  EventTargets,
  MessageEventData,
  TypingEventData,
  StatusEventData,
  AssignmentEventData,
  NotificationEventData,
  ConnectionEventData,
  SystemEventData,
  EventStats
} from '../types';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  handleApiError
} from '@/utils/api-response';
// REMOVED: enhancedSSEManager (Phase 3 cleanup - SSE removed, WebSocket only)
// import { enhancedSSEManager } from '@modules/realtime/handlers/sse-handler';
import { createRealtimeEvent } from '@modules/realtime/handlers/realtime-main';
import { nowMs } from '@/utils/timestamp'

// 事件處理統計
class EventProcessingStats {
  private stats = {
    totalProcessed: 0,
    successCount: 0,
    errorCount: 0,
    processingTimes: [] as number[],
    eventsByType: {
      message: 0,
      typing_started: 0,
      typing_stopped: 0,
      typing: 0,
      agent_joined: 0,
      agent_left: 0,
      assignment_changed: 0,
      status_changed: 0,
      notification: 0,
      conversation_updated: 0,
      connection: 0,
      heartbeat: 0,
      connection_status: 0,
      connection_closed: 0,
      new_message: 0,
      system_announcement: 0,
      user_online: 0,
      user_offline: 0
    } as Record<EventType, number>,
    eventsByPriority: {
      low: 0,
      normal: 0,
      high: 0,
      urgent: 0
    } as Record<EventPriority, number>
  };

  recordEvent(
    eventType: EventType,
    priority: EventPriority,
    processingTime: number,
    success: boolean
  ): void {
    this.stats.totalProcessed++;
    if (success) {
      this.stats.successCount++;
    } else {
      this.stats.errorCount++;
    }

    this.stats.processingTimes.push(processingTime);
    // 只保留最近 1000 個處理時間
    if (this.stats.processingTimes.length > 1000) {
      this.stats.processingTimes = this.stats.processingTimes.slice(-1000);
    }

    this.stats.eventsByType[eventType] = (this.stats.eventsByType[eventType] || 0) + 1;
    this.stats.eventsByPriority[priority] = (this.stats.eventsByPriority[priority] || 0) + 1;
  }

  getStats(): EventStats {
    const avgProcessingTime = this.stats.processingTimes.length > 0
      ? this.stats.processingTimes.reduce((a, b) => a + b, 0) / this.stats.processingTimes.length
      : 0;

    const defaultEventsBySource: Record<EventSource, number> = {
      system: 0,
      user: 0,
      api: 0,
      webhook: 0,
      queue: 0,
      manual: 0
    };

    const defaultEventsByType: Record<EventType, number> = {
      message: 0,
      typing_started: 0,
      typing_stopped: 0,
      typing: 0,
      agent_joined: 0,
      agent_left: 0,
      assignment_changed: 0,
      status_changed: 0,
      notification: 0,
      conversation_updated: 0,
      connection: 0,
      heartbeat: 0,
      connection_status: 0,
      connection_closed: 0,
      new_message: 0,
      system_announcement: 0,
      user_online: 0,
      user_offline: 0
    };

    const defaultEventsByPriority: Record<EventPriority, number> = {
      low: 0,
      normal: 0,
      high: 0,
      urgent: 0
    };

    return {
      totalEvents: this.stats.totalProcessed,
      eventsByType: { ...defaultEventsByType, ...this.stats.eventsByType },
      eventsByPriority: { ...defaultEventsByPriority, ...this.stats.eventsByPriority },
      eventsBySource: defaultEventsBySource, // 由外部統計
      averageProcessingTime: avgProcessingTime,
      successRate: this.stats.totalProcessed > 0 ? this.stats.successCount / this.stats.totalProcessed : 0,
      errorRate: this.stats.totalProcessed > 0 ? this.stats.errorCount / this.stats.totalProcessed : 0,
      peakHour: 0, // 需要額外統計
      dailyVolume: [] // 需要額外統計
    };
  }

  reset(): void {
    this.stats = {
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      processingTimes: [],
      eventsByType: {} as Record<EventType, number>,
      eventsByPriority: {} as Record<EventPriority, number>
    };
  }
}

const eventStats = new EventProcessingStats();

// 事件驗證器
class EventValidator {
  static validateMessageEvent(data: any): data is MessageEventData {
    return data &&
      typeof data.messageId === 'number' &&
      typeof data.conversationId === 'number' &&
      typeof data.content === 'string' &&
      ['text', 'image', 'file', 'sticker', 'location'].includes(data.messageType) &&
      ['customer', 'agent', 'system'].includes(data.senderType);
  }

  static validateTypingEvent(data: any): data is TypingEventData {
    return data &&
      typeof data.conversationId === 'number' &&
      typeof data.userId === 'number' &&
      typeof data.userName === 'string' &&
      typeof data.isTyping === 'boolean';
  }

  static validateStatusEvent(data: any): data is StatusEventData {
    return data &&
      typeof data.conversationId === 'number' &&
      typeof data.oldStatus === 'string' &&
      typeof data.newStatus === 'string' &&
      typeof data.changedBy === 'number';
  }

  static validateAssignmentEvent(data: any): data is AssignmentEventData {
    return data &&
      typeof data.conversationId === 'number' &&
      data.newAssignee &&
      ['user', 'team'].includes(data.newAssignee.type) &&
      typeof data.assignedBy === 'number';
  }

  static validateNotificationEvent(data: any): data is NotificationEventData {
    return data &&
      typeof data.notificationId === 'number' &&
      typeof data.type === 'string' &&
      typeof data.title === 'string' &&
      typeof data.content === 'string' &&
      Array.isArray(data.targetUsers);
  }

  static validateConnectionEvent(data: any): data is ConnectionEventData {
    return data &&
      typeof data.connectionId === 'string' &&
      typeof data.userId === 'number' &&
      ['connected', 'disconnected', 'heartbeat', 'error'].includes(data.action);
  }

  static validateSystemEvent(data: any): data is SystemEventData {
    return data &&
      ['maintenance', 'update', 'alert', 'info'].includes(data.type) &&
      typeof data.message === 'string' &&
      ['low', 'medium', 'high', 'critical'].includes(data.severity);
  }
}

// 事件處理器
export const eventHandler = {
  // 發送消息事件
  sendMessageEvent: async (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => {
    const startTime = nowMs();
    try {
      const payload = c.get('jwtPayload');
      if (!payload) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      const eventData = await c.req.json();
      if (!EventValidator.validateMessageEvent(eventData)) {
        return errorResponse(c, 'Invalid message event data', 400);
      }

      const targets: EventTargets = {
        conversationId: eventData.conversationId,
        broadcast: false
      };

      const eventId = await createRealtimeEvent(
        'message',
        eventData,
        targets,
        'high',
        c.env,
        'user'
      );

      // REMOVED: SSE delivery (Phase 3 cleanup - WebSocket handles all real-time events now)
      // const sseCount = enhancedSSEManager.sendToConversation(...)

      const processingTime = Date.now() - startTime;
      eventStats.recordEvent('message', 'high', processingTime, true);

      return successResponse(c, {
        eventId,
        processingTime
      }, 'Message event sent');

    } catch (error) {
      const processingTime = Date.now() - startTime;
      eventStats.recordEvent('message', 'high', processingTime, false);
      return handleApiError(error, c);
    }
  },

  // 發送打字事件
  sendTypingEvent: async (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => {
    const startTime = nowMs();
    try {
      const payload = c.get('jwtPayload');
      if (!payload) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      const eventData = await c.req.json();
      if (!EventValidator.validateTypingEvent(eventData)) {
        return errorResponse(c, 'Invalid typing event data', 400);
      }

      const eventType: EventType = eventData.isTyping ? 'typing_started' : 'typing_stopped';
      const targets: EventTargets = {
        conversationId: eventData.conversationId,
        excludeUsers: [eventData.userId] // 不發送給打字者本人
      };

      const eventId = await createRealtimeEvent(
        eventType,
        eventData,
        targets,
        'low',
        c.env,
        'user'
      );

      // REMOVED: SSE delivery (Phase 3 cleanup - WebSocket handles all real-time events now)
      // const sseCount = enhancedSSEManager.sendToConversation(...)

      const processingTime = Date.now() - startTime;
      eventStats.recordEvent(eventType, 'low', processingTime, true);

      return successResponse(c, {
        eventId,
        processingTime
      }, 'Typing event sent');

    } catch (error) {
      const processingTime = Date.now() - startTime;
      eventStats.recordEvent('typing_started', 'low', processingTime, false);
      return handleApiError(error, c);
    }
  },

  // 發送狀態變更事件
  sendStatusEvent: async (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => {
    const startTime = nowMs();
    try {
      const payload = c.get('jwtPayload');
      if (!payload) {
        return unauthorizedResponse(c, 'Authentication required');
      }

      const eventData = await c.req.json();
      if (!EventValidator.validateStatusEvent(eventData)) {
        return errorResponse(c, 'Invalid status event data', 400);
      }

      const targets: EventTargets = {
        conversationId: eventData.conversationId,
        broadcast: false
      };

      const eventId = await createRealtimeEvent(
        'status_changed',
        eventData,
        targets,
        'normal',
        c.env,
        'user'
      );

      // REMOVED: SSE delivery (Phase 3 cleanup - WebSocket handles all real-time events now)
      // const sseCount = enhancedSSEManager.sendToConversation(...)

      const processingTime = Date.now() - startTime;
      eventStats.recordEvent('status_changed', 'normal', processingTime, true);

      return successResponse(c, {
        eventId,
        processingTime
      }, 'Status event sent');

    } catch (error) {
      const processingTime = Date.now() - startTime;
      eventStats.recordEvent('status_changed', 'normal', processingTime, false);
      return handleApiError(error, c);
    }
  },

  // 發送分配事件
  sendAssignmentEvent: async (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => {
    const startTime = nowMs();
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !['admin', 'team'].includes(payload.role)) {
        return unauthorizedResponse(c, 'Insufficient permissions');
      }

      const eventData = await c.req.json();
      if (!EventValidator.validateAssignmentEvent(eventData)) {
        return errorResponse(c, 'Invalid assignment event data', 400);
      }

      const targets: EventTargets = {
        conversationId: eventData.conversationId,
        broadcast: false
      };

      // 如果有舊分配者，也通知他們
      if (eventData.oldAssignee) {
        if (eventData.oldAssignee.type === 'user') {
          targets.userIds = [eventData.oldAssignee.id, eventData.newAssignee.id];
        } else {
          targets.teamIds = [eventData.oldAssignee.id, eventData.newAssignee.id];
        }
      }

      const eventId = await createRealtimeEvent(
        'assignment_changed',
        eventData,
        targets,
        'high',
        c.env,
        'user'
      );

      // REMOVED: SSE delivery (Phase 3 cleanup - WebSocket handles all real-time events now)
      // const sseCount = enhancedSSEManager.sendToConversation(...)

      const processingTime = Date.now() - startTime;
      eventStats.recordEvent('assignment_changed', 'high', processingTime, true);

      return successResponse(c, {
        eventId,
        processingTime
      }, 'Assignment event sent');

    } catch (error) {
      const processingTime = Date.now() - startTime;
      eventStats.recordEvent('assignment_changed', 'high', processingTime, false);
      return handleApiError(error, c);
    }
  },

  // 發送通知事件
  sendNotificationEvent: async (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => {
    const startTime = nowMs();
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !['admin', 'team'].includes(payload.role)) {
        return unauthorizedResponse(c, 'Insufficient permissions');
      }

      const eventData = await c.req.json();
      if (!EventValidator.validateNotificationEvent(eventData)) {
        return errorResponse(c, 'Invalid notification event data', 400);
      }

      const targets: EventTargets = {
        userIds: eventData.targetUsers,
        broadcast: false
      };

      const eventId = await createRealtimeEvent(
        'notification',
        eventData,
        targets,
        'normal',
        c.env,
        'system'
      );

      // REMOVED: SSE delivery (Phase 3 cleanup - WebSocket handles all real-time events now)
      // let sseCount = 0;
      // for (const userId of eventData.targetUsers) { enhancedSSEManager.sendToUser(...) }

      const processingTime = Date.now() - startTime;
      eventStats.recordEvent('notification', 'normal', processingTime, true);

      return successResponse(c, {
        eventId,
        targetUsers: eventData.targetUsers.length,
        processingTime
      }, 'Notification event sent');

    } catch (error) {
      const processingTime = Date.now() - startTime;
      eventStats.recordEvent('notification', 'normal', processingTime, false);
      return handleApiError(error, c);
    }
  },

  // 發送系統廣播事件
  sendSystemEvent: async (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => {
    const startTime = nowMs();
    try {
      const payload = c.get('jwtPayload');
      if (!payload || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin access required');
      }

      const eventData = await c.req.json();
      if (!EventValidator.validateSystemEvent(eventData)) {
        return errorResponse(c, 'Invalid system event data', 400);
      }

      const targets: EventTargets = {
        broadcast: true,
        userIds: eventData.affectedUsers
      };

      const priority: EventPriority = eventData.severity === 'critical' ? 'urgent' :
                                      eventData.severity === 'high' ? 'high' : 'normal';

      const eventId = await createRealtimeEvent(
        'system_announcement',
        eventData,
        targets,
        priority,
        c.env,
        'system'
      );

      // REMOVED: SSE delivery (Phase 3 cleanup - WebSocket handles all real-time events now)
      // let sseCount = 0;
      // if (eventData.affectedUsers) { enhancedSSEManager.sendToUser(...) }
      // else { enhancedSSEManager.broadcast(...) }

      const processingTime = Date.now() - startTime;
      eventStats.recordEvent('system_announcement', priority, processingTime, true);

      return successResponse(c, {
        eventId,
        processingTime
      }, 'System event sent');

    } catch (error) {
      const processingTime = Date.now() - startTime;
      eventStats.recordEvent('system_announcement', 'urgent', processingTime, false);
      return handleApiError(error, c);
    }
  },

  // 獲取事件統計
  getEventStats: async (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || !['admin', 'team'].includes(payload.role)) {
        return unauthorizedResponse(c, 'Insufficient permissions');
      }

      const stats = eventStats.getStats();
      return successResponse(c, stats, 'Event statistics retrieved');
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 重置事件統計
  resetEventStats: async (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => {
    try {
      const payload = c.get('jwtPayload');
      if (!payload || payload.role !== 'admin') {
        return unauthorizedResponse(c, 'Admin access required');
      }

      eventStats.reset();
      return successResponse(c, { success: true }, 'Event statistics reset');
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 發送打字狀態
  sendTypingStatus: async (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => {
    try {
      c.get('jwtPayload');
      const { conversationId } = await c.req.json();

      if (!conversationId) {
        return errorResponse(c, 'Conversation ID is required', 400);
      }

      // REMOVED: SSE handler import and delivery (Phase 3 cleanup - WebSocket handles all real-time events now)
      // const { enhancedSSEManager } = await import('./sse-handler');
      // const successCount = enhancedSSEManager.sendToConversation(...)

      return successResponse(c, { success: true }, 'Typing status updated (WebSocket only)');
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 廣播事件到對話
  broadcastToConversation: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const { conversationId, event } = await c.req.json();

      if (!conversationId || !event) {
        return errorResponse(c, 'Conversation ID and event are required', 400);
      }

      // REMOVED: SSE handler import and delivery (Phase 3 cleanup - WebSocket handles all real-time events now)
      // const { enhancedSSEManager } = await import('./sse-handler');
      // const successCount = enhancedSSEManager.sendToConversation(...)

      return successResponse(c, { success: true }, 'Event broadcasted (WebSocket only)');
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 更新在線狀態
  updateOnlineStatus: async (c: Context<{ Bindings: Bindings; Variables: { jwtPayload: JWTPayload } }>) => {
    try {
      c.get('jwtPayload');
      const { isOnline } = await c.req.json();

      // REMOVED: SSE handler import and delivery (Phase 3 cleanup - WebSocket handles all real-time events now)
      // const { enhancedSSEManager } = await import('./sse-handler');
      // let successCount = 0;
      // if (conversationId) { enhancedSSEManager.sendToConversation(...) }
      // else { enhancedSSEManager.broadcast(...) }

      return successResponse(c, {
        success: true,
        isOnline
      }, 'Online status updated (WebSocket only)');
    } catch (error) {
      return handleApiError(error, c);
    }
  }
};

// 導出統計實例供外部使用
export { eventStats, EventValidator };