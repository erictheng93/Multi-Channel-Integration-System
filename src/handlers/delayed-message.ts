// 延遲發送訊息處理器 - 優化版本
import type { Context } from 'hono';
import type { Bindings } from '../types';
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  handleApiError
} from '../utils/api-response';
import { MessageRecallService } from '../services/message-recall-service';

export interface DelayedSendRequest {
  conversationId: string | number; // 支援字符串和數字類型
  content: string;
  delaySeconds: number; // 1-120 秒
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'file';
  mediaUrl?: string;
}

export interface RecallRequest {
  messageId: string;
}

export const delayedMessageHandler = {
  // 發送延遲訊息
  send: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const user = c.get('user') as any;
      const { conversationId, content, delaySeconds, messageType = 'text', mediaUrl } = await c.req.json() as DelayedSendRequest;

      // 驗證輸入
      if (!content || content.trim().length === 0) {
        return validationErrorResponse(c, [
          { field: 'content', message: 'Content is required' }
        ]);
      }

      if (delaySeconds < 1 || delaySeconds > 120) {
        return validationErrorResponse(c, [
          { field: 'delaySeconds', message: 'Delay must be between 1 and 120 seconds' }
        ]);
      }

      // 獲取對話資訊
      const conversation = await c.env.DB.prepare(`
        SELECT c.*, u.platform, u.platform_user_id
        FROM conversations c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `).bind(conversationId).first();

      if (!conversation) {
        return notFoundResponse(c, 'Conversation');
      }

      // 使用優化的服務
      const recallService = new MessageRecallService(c.env);
      const result = await recallService.sendDelayedMessage({
        conversationId: conversationId.toString(),
        content,
        delaySeconds,
        messageType,
        mediaUrl: mediaUrl || '',
        senderId: user.id,
        recipientPlatformId: String(conversation.platform_user_id),
        platform: conversation.platform as 'line' | 'facebook'
      });

      if (!result.success) {
        return errorResponse(c, result.error || 'Failed to schedule message', 500);
      }

      return successResponse(c, {
        messageId: result.messageId,
        canRecall: true,
        recallDeadline: result.recallDeadline,
        delaySeconds,
        scheduledSendTime: result.scheduledSendTime
      }, 'Message scheduled for delayed sending');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 撤回延遲訊息
  recall: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const user = c.get('user') as any;
      const { messageId } = await c.req.json() as RecallRequest;

      if (!messageId) {
        return validationErrorResponse(c, [
          { field: 'messageId', message: 'Message ID is required' }
        ]);
      }

      // 使用優化的服務
      const recallService = new MessageRecallService(c.env);
      const result = await recallService.recallMessage(messageId, user.id);

      if (!result.success) {
        const statusCode = result.error?.includes('Permission denied') ? 403 :
          result.error?.includes('deadline') ? 400 : 404;
        return errorResponse(c, result.error || 'Failed to recall message', statusCode);
      }

      return successResponse(c, {
        messageId: result.messageId,
        recalled: true,
        recalledAt: new Date().toISOString()
      }, 'Message recalled successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 獲取用戶的待發送訊息列表
  list: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const user = c.get('user') as any;
      const page = parseInt(c.req.query('page') || '1');
      const pageSize = parseInt(c.req.query('pageSize') || '20');

      // 使用優化的服務
      const recallService = new MessageRecallService(c.env);
      const result = await recallService.getPendingMessages(user.id, page, pageSize);

      const items = result.items.map((row: any) => ({
        id: row.id,
        conversationId: row.conversation_id,
        customerName: row.customer_name,
        content: row.content,
        messageType: row.message_type,
        platform: row.platform,
        delaySeconds: row.delay_seconds,
        scheduledSendTime: row.scheduled_send_time,
        recallDeadline: row.recall_deadline,
        status: row.status,
        createdAt: row.created_at,
        canRecall: Boolean(row.can_recall)
      }));

      return successResponse(c, {
        items,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / pageSize)
        }
      }, 'Pending messages retrieved successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 處理佇列中的延遲訊息 (由 Queue Consumer 調用)
  processQueue: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const { messageId } = await c.req.json();

      if (!messageId) {
        return validationErrorResponse(c, [
          { field: 'messageId', message: 'Message ID is required' }
        ]);
      }

      // 使用優化的服務
      const recallService = new MessageRecallService(c.env);
      const result = await recallService.processQueueMessage(messageId);

      if (result.skipped) {
        return successResponse(c, { skipped: true }, 'Message was cancelled');
      }

      if (!result.success) {
        return errorResponse(c, result.error || 'Failed to process message', 500);
      }

      return successResponse(c, {
        messageId,
        success: true,
        status: 'sent'
      }, 'Message sent successfully');

    } catch (error) {
      return handleApiError(error, c);
    }
  }
};