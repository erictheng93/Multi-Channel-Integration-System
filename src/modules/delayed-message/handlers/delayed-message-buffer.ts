/**
 * Delayed Message Buffer Handler
 * 使用 Durable Objects 實現的延遲訊息容錯緩衝區
 *
 * 替代原有的 Queues 方案，提供：
 * - 真正的即時撤銷能力 (<100ms)
 * - 毫秒級時間精確度
 * - 100% 可靠，無競態條件
 * - 完整的狀態可見性
 */

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '@/types';
import { jwtAuth } from '@/middleware/auth';
import { PermissionService } from '@/services/permission-service';
import { badRequestResponse, forbiddenResponse, internalErrorResponse, handleApiError } from '@/utils/api-response';
import { errorResponse } from '@/utils/api-response';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';
import { ActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@modules/activities';
import { delayedMessagesV2Contracts, type MessageStatus } from '@shared/api-contracts';
import { contractJson } from '@/utils/api-contract-response';

const log = createContextLogger('DelayedMessageBuffer');

const delayedMessageBufferHandler = new Hono<{ Bindings: Bindings }>();

/**
 * 發送延遲訊息 (使用 Durable Objects)
 *
 * POST /api/delayed-messages-v2/send
 *
 * 流程：
 * 1. 驗證權限
 * 2. 獲取對應的 DO 實例 (基於 conversationId)
 * 3. 調用 DO 的 schedule 方法
 * 4. 即時返回 (無需等待 Queue)
 */
delayedMessageBufferHandler.post('/send', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const {
      conversationId,
      content,
      platform,
      recipientPlatformId,
      delaySeconds = 5, // 預設 5 秒
      messageType = 'text'
    } = await c.req.json();

    // 驗證必填欄位
    if (!conversationId || !content || !platform || !recipientPlatformId) {
      return badRequestResponse(c, 'Missing required fields: conversationId, content, platform, recipientPlatformId');
    }

    // 驗證延遲時間範圍
    if (delaySeconds < 1 || delaySeconds > 120) {
      return badRequestResponse(c, 'Delay seconds must be between 1 and 120');
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
      return forbiddenResponse(c, 'Permission denied');
    }

    // 檢查 Durable Object 綁定
    if (!c.env.DELAYED_MESSAGE_SCHEDULER) {
      return errorResponse(c, 'Delayed message service is not configured', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    // 獲取 DelayedMessageBuffer DO 實例
    // 使用 conversationId 作為 DO 的名稱，確保同一對話的訊息在同一個 DO 中
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
          createdAt: nowISO()
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
      return internalErrorResponse(c, result.error || 'Failed to schedule message');
    }

    log.info(`Message ${messageId} scheduled for ${delaySeconds}s delay`, { messageId, delaySeconds, conversationId });

    // Fire-and-forget activity logging
    const activityService = new ActivityService(c.env.DB);
    activityService.logActivity({
      userId: user.id.toString(),
      userName: user.displayName || 'Unknown',
      userRole: user.role || 'agent',
      action: ACTIVITY_ACTIONS.DELAYED_MESSAGE_SCHEDULE,
      resourceType: RESOURCE_TYPES.DELAYED_MESSAGE,
      resourceId: messageId,
      details: { conversationId, delaySeconds, platform },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    }).catch(() => {});

    return contractJson(c, delayedMessagesV2Contracts.send, {
      success: true,
      data: {
        id: result.messageId ?? messageId,
        conversationId,
        content,
        messageType,
        platform,
        scheduledAt: result.scheduledAt ?? Date.now() + delaySeconds * 1000,
        canCancelUntil: result.canCancelUntil ?? Date.now() + delaySeconds * 1000,
        delaySeconds: result.delaySeconds ?? delaySeconds
      }
    });

  } catch (error) {
    log.error('Schedule error', { error: error instanceof Error ? error.message : String(error) });
    return handleApiError(error, c);
  }
});

/**
 * 撤銷延遲訊息 (真正的即時撤銷)
 *
 * DELETE /api/delayed-messages-v2/cancel/:messageId
 *
 * 優勢：
 * - 直接從 DO 內存刪除
 * - 響應時間 <100ms
 * - 100% 可靠
 */
delayedMessageBufferHandler.delete('/cancel/:messageId', jwtAuth, async (c) => {
  try {
    const user = c.get('user');
    const messageId = c.req.param('messageId');
    const body = await c.req.json();
    const { conversationId, reason } = body;

    if (!messageId) {
      return badRequestResponse(c, 'Message ID is required');
    }

    if (!conversationId) {
      return badRequestResponse(c, 'Conversation ID is required');
    }

    // 檢查 Durable Object 綁定
    if (!c.env.DELAYED_MESSAGE_SCHEDULER) {
      return errorResponse(c, 'Delayed message service is not configured', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    // 獲取對應的 DO 實例
    const doId = c.env.DELAYED_MESSAGE_SCHEDULER.idFromName(conversationId);
    const doStub = c.env.DELAYED_MESSAGE_SCHEDULER.get(doId);

    // 調用 DO 的 cancel 方法
    const response = await doStub.fetch('https://do/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId,
        reason: reason || 'User cancelled'
      })
    });

    const result = await response.json() as {
      success: boolean;
      reason?: string;
      cancelledAt?: number;
    };

    if (!result.success) {
      return badRequestResponse(c, result.reason || 'Failed to cancel message');
    }

    log.info(`Message ${messageId} cancelled by ${user.displayName}`, { messageId, cancelledBy: user.displayName });

    // Fire-and-forget activity logging
    const activityService = new ActivityService(c.env.DB);
    activityService.logActivity({
      userId: user.id.toString(),
      userName: user.displayName || 'Unknown',
      userRole: user.role || 'agent',
      action: ACTIVITY_ACTIONS.DELAYED_MESSAGE_CANCEL,
      resourceType: RESOURCE_TYPES.DELAYED_MESSAGE,
      resourceId: messageId,
      details: { conversationId, reason, messageId },
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent')
    }).catch(() => {});

    return contractJson(c, delayedMessagesV2Contracts.cancel, {
      success: true,
      message: 'Message cancelled successfully'
    });

  } catch (error) {
    log.error('Cancel error', { error: error instanceof Error ? error.message : String(error) });
    return handleApiError(error, c);
  }
});

/**
 * 查詢訊息狀態
 *
 * GET /api/delayed-messages-v2/status/:messageId
 *
 * 用於前端倒數計時和狀態顯示
 */
delayedMessageBufferHandler.get('/status/:messageId', jwtAuth, async (c) => {
  try {
    const messageId = c.req.param('messageId');
    const conversationId = c.req.query('conversationId');

    if (!messageId || !conversationId) {
      return badRequestResponse(c, 'Message ID and Conversation ID are required');
    }

    // 檢查 Durable Object 綁定
    if (!c.env.DELAYED_MESSAGE_SCHEDULER) {
      return errorResponse(c, 'Delayed message service is not configured', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    // 獲取對應的 DO 實例
    const doId = c.env.DELAYED_MESSAGE_SCHEDULER.idFromName(conversationId);
    const doStub = c.env.DELAYED_MESSAGE_SCHEDULER.get(doId);

    // 查詢狀態
    const response = await doStub.fetch(`https://do/status?messageId=${messageId}`);
    const result = await response.json() as {
      exists: boolean;
      status?: string;
      timeRemaining?: number;
      canCancel?: boolean;
      scheduledAt?: number;
    };

    const status: MessageStatus = {
      ...result,
      status: result.status as MessageStatus['status']
    };

    return contractJson(c, delayedMessagesV2Contracts.status, {
      success: true,
      data: status
    });

  } catch (error) {
    log.error('Status query error', { error: error instanceof Error ? error.message : String(error) });
    return handleApiError(error, c);
  }
});

/**
 * 列出待發送訊息
 *
 * GET /api/delayed-messages-v2/pending
 *
 * 查詢指定對話的所有待發送訊息
 */
delayedMessageBufferHandler.get('/pending', jwtAuth, async (c) => {
  try {
    const conversationId = c.req.query('conversationId');

    if (!conversationId) {
      return badRequestResponse(c, 'Conversation ID is required');
    }

    // 檢查 Durable Object 綁定
    if (!c.env.DELAYED_MESSAGE_SCHEDULER) {
      return errorResponse(c, 'Delayed message service is not configured', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    // 獲取對應的 DO 實例
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

    return contractJson(c, delayedMessagesV2Contracts.pending, {
      success: true,
      data: {
      count: result.count,
      messages: result.messages
      }
    });

  } catch (error) {
    log.error('Pending list error', { error: error instanceof Error ? error.message : String(error) });
    return handleApiError(error, c);
  }
});

/**
 * 健康檢查
 *
 * GET /api/delayed-messages-v2/health
 */
delayedMessageBufferHandler.get('/health', async (c) => {
  return contractJson(c, delayedMessagesV2Contracts.health, {
    success: true,
    data: {
      success: true,
      status: 'healthy',
      features: {
        instantCancel: true,
        preciseScheduling: true,
        durableObjects: true
      }
    }
  });
});

export default delayedMessageBufferHandler;
