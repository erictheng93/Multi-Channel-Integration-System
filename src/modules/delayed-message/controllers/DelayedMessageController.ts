// Delayed Message Module - API Controller
// 延遲訊息模組 - API 控制器

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Bindings } from '@/types';
import type { DelayedMessageRequest } from '@modules/delayed-message/types';
import { DelayedMessageManager } from '@modules/delayed-message/services/DelayedMessageManager';
import { jwtAuth } from '@/middleware/auth';
import { successResponse, badRequestResponse, internalErrorResponse } from '@/utils/api-response';
import { errorResponse } from '@/utils/api-response';
import { createContextLogger } from '@/utils/logger';
import { DELAYED_MESSAGE_LIMITS } from '@/constants/limits';

const log = createContextLogger('DelayedMessageController');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// 擴展 Context 類型以包含用戶信息
type AuthenticatedContext = Context<{ Bindings: Bindings }> & {
  get(key: 'user'): { id: string; displayName?: string; role?: string };
};

/**
 * DelayedMessageController - API 控制層
 *
 * 職責：
 * - 處理 HTTP 路由和參數驗證
 * - 統一 API 回應格式
 * - 權限檢查委派
 * - 錯誤處理和狀態碼管理
 */
export class DelayedMessageController {
  private manager: DelayedMessageManager;
  public router: Hono<{ Bindings: Bindings }>;

  constructor(env: Bindings) {
    this.manager = new DelayedMessageManager(env);
    this.router = new Hono<{ Bindings: Bindings }>();
    this.setupRoutes();
  }

  /**
   * 設定路由
   */
  private setupRoutes(): void {
    // 發送延遲訊息
    this.router.post('/send', jwtAuth, this.sendDelayedMessage.bind(this));

    // 撤回延遲訊息
    this.router.post('/recall/:messageId', jwtAuth, this.recallDelayedMessage.bind(this));

    // 獲取待發送訊息列表
    this.router.get('/pending', jwtAuth, this.getPendingMessages.bind(this));

    // 重新排程訊息
    this.router.post('/reschedule/:messageId', jwtAuth, this.rescheduleMessage.bind(this));

    // 處理延遲訊息佇列 (內部API，供Queue Consumer使用)
    this.router.post('/process', this.processQueueMessage.bind(this));

    // 批量處理
    this.router.post('/process-batch', this.processBatch.bind(this));

    // 健康檢查
    this.router.get('/health', this.healthCheck.bind(this));

    // 統計資訊
    this.router.get('/stats/:userId?', jwtAuth, this.getStats.bind(this));
  }

  /**
   * 發送延遲訊息
   */
  private async sendDelayedMessage(c: Context<{ Bindings: Bindings }>): Promise<Response> {
    try {
      const user = (c as AuthenticatedContext).get('user');
      const requestBody = await c.req.json();

      // 驗證必填欄位
      const validationResult = this.validateSendRequest(requestBody);
      if (!validationResult.isValid) {
        return badRequestResponse(c, `Invalid request: ${validationResult.errors.join(', ')}`);
      }

      const request: DelayedMessageRequest = {
        conversationId: requestBody.conversationId,
        content: requestBody.content,
        platform: requestBody.platform,
        recipientPlatformId: requestBody.recipientPlatformId,
        delaySeconds: requestBody.delaySeconds,
        messageType: requestBody.messageType || 'text',
        mediaUrl: requestBody.mediaUrl,
        senderId: user.id
      };

      const result = await this.manager.sendDelayedMessage(request, user);

      if (!result.success) {
        return badRequestResponse(c, result.error || 'Failed to send delayed message');
      }

      return successResponse(c, {
        messageId: result.messageId,
        scheduledSendTime: result.scheduledSendTime,
        recallDeadline: result.recallDeadline
      });

    } catch (error) {
      log.error('Send delayed message error', { error: error instanceof Error ? error.message : String(error) });
      return internalErrorResponse(c, error instanceof Error ? error.message : 'Failed to send delayed message');
    }
  }

  /**
   * 撤回延遲訊息
   */
  private async recallDelayedMessage(c: Context<{ Bindings: Bindings }>): Promise<Response> {
    try {
      const user = (c as AuthenticatedContext).get('user');
      const messageId = c.req.param('messageId');

      if (!messageId?.trim()) {
        return badRequestResponse(c, 'Message ID is required');
      }

      const result = await this.manager.recallDelayedMessage(messageId, user);

      if (!result.success) {
        return badRequestResponse(c, result.error || 'Failed to recall message');
      }

      return successResponse(c, { messageId: result.messageId });

    } catch (error) {
      log.error('Recall delayed message error', { error: error instanceof Error ? error.message : String(error) });
      return internalErrorResponse(c, error instanceof Error ? error.message : 'Failed to recall message');
    }
  }

  /**
   * 獲取待發送訊息列表
   */
  private async getPendingMessages(c: Context<{ Bindings: Bindings }>): Promise<Response> {
    try {
      const user = (c as AuthenticatedContext).get('user');
      const page = parseInt(c.req.query('page') || '1');
      const pageSize = parseInt(c.req.query('pageSize') || '20');

      // 驗證分頁參數
      if (page < 1 || pageSize < 1 || pageSize > 100) {
        return badRequestResponse(c, 'Invalid pagination parameters');
      }

      const result = await this.manager.getPendingMessages(user.id, page, pageSize);

      return successResponse(c, result);

    } catch (error) {
      log.error('Get pending messages error', { error: error instanceof Error ? error.message : String(error) });
      return internalErrorResponse(c, error instanceof Error ? error.message : 'Failed to get pending messages');
    }
  }

  /**
   * 重新排程訊息
   */
  private async rescheduleMessage(c: Context<{ Bindings: Bindings }>): Promise<Response> {
    try {
      const user = (c as AuthenticatedContext).get('user');
      const messageId = c.req.param('messageId');
      const requestBody = await c.req.json();

      if (!messageId?.trim()) {
        return badRequestResponse(c, 'Message ID is required');
      }

      const newDelaySeconds = requestBody.newDelaySeconds;
      if (
        typeof newDelaySeconds !== 'number' ||
        newDelaySeconds < DELAYED_MESSAGE_LIMITS.MIN_DELAY_SECONDS ||
        newDelaySeconds > DELAYED_MESSAGE_LIMITS.MAX_DELAY_SECONDS
      ) {
        return badRequestResponse(c, `Invalid delay seconds (must be between ${DELAYED_MESSAGE_LIMITS.MIN_DELAY_SECONDS} and ${DELAYED_MESSAGE_LIMITS.MAX_DELAY_SECONDS})`);
      }

      const result = await this.manager.rescheduleMessage(messageId, newDelaySeconds, user);

      if (!result.success) {
        return badRequestResponse(c, result.error || 'Failed to reschedule message');
      }

      return successResponse(c, {
        messageId: result.messageId,
        newScheduledSendTime: result.scheduledSendTime
      });

    } catch (error) {
      log.error('Reschedule message error', { error: error instanceof Error ? error.message : String(error) });
      return internalErrorResponse(c, error instanceof Error ? error.message : 'Failed to reschedule message');
    }
  }

  /**
   * 處理延遲訊息佇列 (內部API)
   */
  private async processQueueMessage(c: Context<{ Bindings: Bindings }>): Promise<Response> {
    try {
      const requestBody = await c.req.json();
      const { messageId } = requestBody;

      if (!messageId?.trim()) {
        return badRequestResponse(c, 'Message ID is required');
      }

      // 從查詢參數獲取對話ID（可選）
      const conversationId = c.req.query('conversationId');

      const result = await this.manager.processQueueMessage(messageId, conversationId || undefined);

      return successResponse(c, {
        messageId,
        processed: result.success,
        skipped: result.skipped || false
      });

    } catch (error) {
      log.error('Process queue message error', { error: error instanceof Error ? error.message : String(error) });
      return internalErrorResponse(c, error instanceof Error ? error.message : 'Failed to process queue message');
    }
  }

  /**
   * 批量處理訊息
   */
  private async processBatch(c: Context<{ Bindings: Bindings }>): Promise<Response> {
    try {
      const requestBody = await c.req.json();
      const { messageIds } = requestBody;

      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return badRequestResponse(c, 'Message IDs array is required');
      }

      if (messageIds.length > 50) {
        return badRequestResponse(c, 'Batch size cannot exceed 50 messages');
      }

      const results = await this.manager.processBatch(messageIds);

      const successCount = results.filter(r => r.result.success).length;

      return successResponse(c, {
        results,
        summary: {
          total: messageIds.length,
          successful: successCount,
          failed: messageIds.length - successCount
        }
      });

    } catch (error) {
      log.error('Process batch error', { error: error instanceof Error ? error.message : String(error) });
      return internalErrorResponse(c, error instanceof Error ? error.message : 'Failed to process batch');
    }
  }

  /**
   * 健康檢查
   */
  private async healthCheck(c: Context<{ Bindings: Bindings }>): Promise<Response> {
    try {
      const health = await this.manager.healthCheck();

      const statusCode = health.healthy ? 200 : 503;
      if (!health.healthy) {
        return errorResponse(c, 'Service unhealthy', statusCode);
      }

      return successResponse(c, {
        status: 'healthy',
        services: health.services,
        timestamp: health.timestamp
      });

    } catch (error) {
      log.error('Health check error', { error: error instanceof Error ? error.message : String(error) });
      return errorResponse(c, error instanceof Error ? error.message : 'Health check failed', 503);
    }
  }

  /**
   * 獲取統計資訊
   */
  private async getStats(c: Context<{ Bindings: Bindings }>): Promise<Response> {
    try {
      // 這裡可以實現統計資訊邏輯
      // 目前返回基本健康狀態
      const health = await this.manager.healthCheck();

      return successResponse(c, {
        health: health.healthy,
        services: health.services,
        metrics: {
          // 可以添加更多統計指標
          uptime: process.uptime?.() || 0
        }
      });

    } catch (error) {
      log.error('Get stats error', { error: error instanceof Error ? error.message : String(error) });
      return internalErrorResponse(c, error instanceof Error ? error.message : 'Failed to get stats');
    }
  }

  // 私有輔助方法

  /**
   * 驗證發送請求
   */
  private validateSendRequest(body: unknown): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const data = isRecord(body) ? body : {};

    if (!isNonEmptyString(data.conversationId)) {
      errors.push('conversationId is required');
    }

    if (!isNonEmptyString(data.content)) {
      errors.push('content is required');
    }

    if (!isNonEmptyString(data.platform)) {
      errors.push('platform is required');
    }

    if (!isNonEmptyString(data.recipientPlatformId)) {
      errors.push('recipientPlatformId is required');
    }

    if (typeof data.delaySeconds !== 'number') {
      errors.push('delaySeconds must be a number');
    } else if (
      data.delaySeconds < DELAYED_MESSAGE_LIMITS.MIN_DELAY_SECONDS ||
      data.delaySeconds > DELAYED_MESSAGE_LIMITS.MAX_DELAY_SECONDS
    ) {
      errors.push(`delaySeconds must be between ${DELAYED_MESSAGE_LIMITS.MIN_DELAY_SECONDS} and ${DELAYED_MESSAGE_LIMITS.MAX_DELAY_SECONDS}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 獲取路由器實例 (供主應用使用)
   */
  public getRouter(): Hono<{ Bindings: Bindings }> {
    return this.router;
  }
}
