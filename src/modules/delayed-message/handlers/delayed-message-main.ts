/**
 * 延遲訊息處理器 - Durable Objects 實現
 *
 * ⚠️ 重要變更：已從 Cloudflare Queues + KV 方案遷移到 Durable Objects
 *
 * 優勢：
 * - 真正的即時撤銷 (<100ms)
 * - 毫秒級時間精確度
 * - 100% 可靠，無競態條件
 * - 完整的狀態可見性
 *
 * 此文件現在是 delayed-message-buffer.ts 的別名，保持向後兼容
 */

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '@/types';
import { PermissionService } from '@/services/permission-service';
import { jwtAuth } from '@/middleware/auth';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { handleApiError } from '@/utils/api-response';

const delayedMessageHandler = new Hono<{ Bindings: Bindings }>();

/**
 * 發送延遲訊息（使用 Durable Objects）
 *
 * POST /api/delayed-messages/send
 */
delayedMessageHandler.post('/send', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const {
      conversationId,
      content,
      platform,
      recipientPlatformId,
      delaySeconds = 5,
      messageType = 'text'
    } = await c.req.json();

    // 驗證必填欄位
    if (!conversationId || !content || !platform || !recipientPlatformId) {
      return c.json({
        success: false,
        error: 'Missing required fields: conversationId, content, platform, recipientPlatformId'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 驗證延遲時間範圍 (1-120 秒)
    if (delaySeconds < 1 || delaySeconds > 120) {
      return c.json({
        success: false,
        error: 'Delay seconds must be between 1 and 120'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 檢查權限
    const hasPermission = await PermissionService.checkPermission(
      user.id,
      'message',
      'send',
      {
        userId: user.id,
        role: user.role,
        resourceId: conversationId
      }
    );

    if (!hasPermission) {
      return c.json({
        success: false,
        error: 'Permission denied'
      }, HTTP_STATUS.FORBIDDEN);
    }

    // 檢查 Durable Object 綁定
    if (!c.env.DELAYED_MESSAGE_SCHEDULER) {
      return c.json({
        success: false,
        error: 'Delayed message service is not configured'
      }, HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    // 🎯 使用 Durable Objects 方案
    const doId = c.env.DELAYED_MESSAGE_SCHEDULER.idFromName(conversationId);
    const doStub = c.env.DELAYED_MESSAGE_SCHEDULER.get(doId);

    // 生成 messageId
    const messageId = crypto.randomUUID();

    // 調用 DO 的 schedule 方法
    const response = await doStub.fetch('https://do/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId,
        conversationId,
        agentId: user.id,
        content,
        messageType,
        platform,
        recipientPlatformId,
        delaySeconds,
        metadata: {
          agentName: user.displayName,
          createdAt: new Date().toISOString()
        }
      })
    });

    const result = await response.json() as {
      success: boolean;
      messageId?: string;
      scheduledAt?: number;
      canCancelUntil?: number;
      delaySeconds?: number;
      error?: string;
    };

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error || 'Failed to schedule message'
      }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // 🚀 WebSocket Broadcasting: Delayed Message Scheduled
    if (result.messageId) {
      try {
        const broadcastService = new WebSocketBroadcastService(c.env);
        await broadcastService.broadcastDelayedMessageEvent({
          type: 'delayed_message_countdown',
          conversationId,
          messageId: result.messageId,
          agentId: String(user.id),
          data: {
            content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            messageType,
            platform,
            delaySeconds,
            scheduledSendTime: new Date(result.scheduledAt!).toISOString(),
            recallDeadline: new Date(result.canCancelUntil!).toISOString(),
            countdownStarted: true,
            remainingSeconds: delaySeconds,
            canRecall: true,
            scheduledBy: {
              id: user.id,
              name: user.displayName,
              role: user.role
            },
            timestamp: new Date().toISOString()
          },
          priority: 'normal'
        });
        console.log('✅ [WebSocket] Delayed message countdown started broadcast');
      } catch (broadcastError) {
        console.warn('⚠️ [WebSocket] Delayed message countdown broadcast failed:', broadcastError);
      }
    }

    return c.json({
      success: true,
      data: {
        messageId: result.messageId,
        scheduledSendTime: new Date(result.scheduledAt!).toISOString(),
        recallDeadline: new Date(result.canCancelUntil!).toISOString(),
        delaySeconds: result.delaySeconds
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [DelayedMessage] Send error:', error);
    return handleApiError(error, c);
  }
});

/**
 * 撤回延遲訊息（使用 Durable Objects）
 *
 * POST /api/delayed-messages/recall/:messageId
 */
delayedMessageHandler.post('/recall/:messageId', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const messageId = c.req.param('messageId');
    const { conversationId, reason } = await c.req.json();

    if (!messageId) {
      return c.json({
        success: false,
        error: 'Message ID is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 檢查 Durable Object 綁定
    if (!c.env.DELAYED_MESSAGE_SCHEDULER) {
      return c.json({
        success: false,
        error: 'Delayed message service is not configured'
      }, HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    // 🎯 使用 Durable Objects 方案
    const doId = c.env.DELAYED_MESSAGE_SCHEDULER.idFromName(conversationId);
    const doStub = c.env.DELAYED_MESSAGE_SCHEDULER.get(doId);

    // 調用 DO 的 cancel 方法
    const response = await doStub.fetch('https://do/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId,
        reason: reason || 'User recalled'
      })
    });

    const result = await response.json() as {
      success: boolean;
      reason?: string;
      cancelledAt?: number;
    };

    // 🚀 WebSocket Broadcasting: Message Recall Event
    if (result.success) {
      try {
        const broadcastService = new WebSocketBroadcastService(c.env);
        await broadcastService.broadcastDelayedMessageEvent({
          type: 'delayed_message_recalled',
          conversationId,
          messageId,
          agentId: String(user.id),
          data: {
            recalledBy: {
              id: user.id,
              name: user.displayName,
              role: user.role
            },
            recalledAt: new Date(result.cancelledAt!).toISOString(),
            reason: reason || 'User recalled',
            wasSuccessful: true,
            timestamp: new Date().toISOString()
          },
          priority: 'high'
        });
        console.log('✅ [WebSocket] Message recall success broadcasted');
      } catch (broadcastError) {
        console.warn('⚠️ [WebSocket] Message recall broadcast failed:', broadcastError);
      }

      return c.json({
        success: true,
        data: {
          messageId,
          cancelledAt: result.cancelledAt
        },
        timestamp: new Date().toISOString()
      });
    } else {
      // Broadcast recall failure
      try {
        const broadcastService = new WebSocketBroadcastService(c.env);
        await broadcastService.broadcastDelayedMessageEvent({
          type: 'delayed_message_failed',
          conversationId,
          messageId,
          agentId: String(user.id),
          data: {
            failureReason: result.reason || 'Recall failed',
            attemptedBy: {
              id: user.id,
              name: user.displayName,
              role: user.role
            },
            failedAt: new Date().toISOString(),
            operation: 'recall',
            timestamp: new Date().toISOString()
          },
          priority: 'high'
        });
        console.log('✅ [WebSocket] Message recall failure broadcasted');
      } catch (broadcastError) {
        console.warn('⚠️ [WebSocket] Message recall failure broadcast failed:', broadcastError);
      }

      return c.json({
        success: false,
        error: result.reason || 'Failed to recall message'
      }, HTTP_STATUS.BAD_REQUEST);
    }

  } catch (error) {
    console.error('❌ [DelayedMessage] Recall error:', error);
    return handleApiError(error, c);
  }
});

/**
 * 獲取待發送訊息列表（使用 Durable Objects）
 *
 * GET /api/delayed-messages/pending
 */
delayedMessageHandler.get('/pending', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const conversationId = c.req.query('conversationId');

    if (!conversationId) {
      return c.json({
        success: false,
        error: 'Conversation ID is required'
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // 檢查 Durable Object 綁定
    if (!c.env.DELAYED_MESSAGE_SCHEDULER) {
      return c.json({
        success: false,
        error: 'Delayed message service is not configured'
      }, HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    // 🎯 使用 Durable Objects 方案
    const doId = c.env.DELAYED_MESSAGE_SCHEDULER.idFromName(conversationId);
    const doStub = c.env.DELAYED_MESSAGE_SCHEDULER.get(doId);

    // 查詢待發送列表
    const response = await doStub.fetch('https://do/list');
    const result = await response.json() as {
      success: boolean;
      count: number;
      messages: Array<{
        id: string;
        content: string;
        scheduledAt: number;
        timeRemaining: number;
      }>;
    };

    return c.json({
      success: true,
      data: {
        items: result.messages,
        total: result.count,
        conversationId
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [DelayedMessage] Get pending error:', error);
    return handleApiError(error, c);
  }
});

/**
 * 處理延遲訊息佇列（已棄用 - 保留用於向後兼容）
 *
 * ⚠️ 此端點已不再使用，因為 Durable Objects 使用 Alarm API 自動處理
 *
 * @deprecated 使用 Durable Objects Alarm API 替代
 */
delayedMessageHandler.post('/process', async (c) => {
  return c.json({
    success: true,
    message: 'This endpoint is deprecated. Durable Objects Alarm API handles message processing automatically.',
    deprecated: true
  });
});

export default delayedMessageHandler;
