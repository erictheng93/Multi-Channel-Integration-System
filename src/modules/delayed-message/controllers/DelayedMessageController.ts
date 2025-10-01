// Delayed Message Module - API Controller
// 延遲訊息模組 - API 控制器

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Bindings } from '@/types';
import type { DelayedMessageRequest } from '@modules/delayed-message/types';
import { DelayedMessageManager } from '@modules/delayed-message/services/DelayedMessageManager';
import { jwtAuth } from '@/middleware/auth';

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
        return c.json({
          success: false,
          error: `Invalid request: ${validationResult.errors.join(', ')}`,
          timestamp: new Date().toISOString()
        }, 400);
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

      const statusCode = result.success ? 200 : 400;
      return c.json({
        success: result.success,
        data: result.success ? {
          messageId: result.messageId,
          scheduledSendTime: result.scheduledSendTime,
          recallDeadline: result.recallDeadline
        } : null,
        error: result.error,
        timestamp: new Date().toISOString()
      }, statusCode);

    } catch (error) {
      console.error('❌ [DelayedMessageController] Send delayed message error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send delayed message',
        timestamp: new Date().toISOString()
      }, 500);
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
        return c.json({
          success: false,
          error: 'Message ID is required',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const result = await this.manager.recallDelayedMessage(messageId, user);

      const statusCode = result.success ? 200 : 400;
      return c.json({
        success: result.success,
        data: result.success ? { messageId: result.messageId } : null,
        error: result.error,
        timestamp: new Date().toISOString()
      }, statusCode);

    } catch (error) {
      console.error('❌ [DelayedMessageController] Recall delayed message error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to recall message',
        timestamp: new Date().toISOString()
      }, 500);
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
        return c.json({
          success: false,
          error: 'Invalid pagination parameters',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const result = await this.manager.getPendingMessages(user.id, page, pageSize);

      return c.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ [DelayedMessageController] Get pending messages error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pending messages',
        timestamp: new Date().toISOString()
      }, 500);
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
        return c.json({
          success: false,
          error: 'Message ID is required',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const newDelaySeconds = requestBody.newDelaySeconds;
      if (typeof newDelaySeconds !== 'number' || newDelaySeconds < 1 || newDelaySeconds > 120) {
        return c.json({
          success: false,
          error: 'Invalid delay seconds (must be between 1 and 120)',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const result = await this.manager.rescheduleMessage(messageId, newDelaySeconds, user);

      const statusCode = result.success ? 200 : 400;
      return c.json({
        success: result.success,
        data: result.success ? {
          messageId: result.messageId,
          newScheduledSendTime: result.scheduledSendTime
        } : null,
        error: result.error,
        timestamp: new Date().toISOString()
      }, statusCode);

    } catch (error) {
      console.error('❌ [DelayedMessageController] Reschedule message error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reschedule message',
        timestamp: new Date().toISOString()
      }, 500);
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
        return c.json({
          success: false,
          error: 'Message ID is required',
          timestamp: new Date().toISOString()
        }, 400);
      }

      // 從查詢參數獲取對話ID（可選）
      const conversationId = c.req.query('conversationId');

      const result = await this.manager.processQueueMessage(messageId, conversationId || undefined);

      return c.json({
        success: result.success,
        data: {
          messageId,
          processed: result.success,
          skipped: result.skipped || false
        },
        error: result.error,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ [DelayedMessageController] Process queue message error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process queue message',
        timestamp: new Date().toISOString()
      }, 500);
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
        return c.json({
          success: false,
          error: 'Message IDs array is required',
          timestamp: new Date().toISOString()
        }, 400);
      }

      if (messageIds.length > 50) {
        return c.json({
          success: false,
          error: 'Batch size cannot exceed 50 messages',
          timestamp: new Date().toISOString()
        }, 400);
      }

      const results = await this.manager.processBatch(messageIds);

      const successCount = results.filter(r => r.result.success).length;

      return c.json({
        success: true,
        data: {
          results,
          summary: {
            total: messageIds.length,
            successful: successCount,
            failed: messageIds.length - successCount
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ [DelayedMessageController] Process batch error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process batch',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }

  /**
   * 健康檢查
   */
  private async healthCheck(c: Context<{ Bindings: Bindings }>): Promise<Response> {
    try {
      const health = await this.manager.healthCheck();

      const statusCode = health.healthy ? 200 : 503;
      return c.json({
        success: health.healthy,
        data: {
          status: health.healthy ? 'healthy' : 'unhealthy',
          services: health.services,
          timestamp: health.timestamp
        }
      }, statusCode);

    } catch (error) {
      console.error('❌ [DelayedMessageController] Health check error:', error);
      return c.json({
        success: false,
        data: {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Health check failed',
          timestamp: new Date().toISOString()
        }
      }, 503);
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

      return c.json({
        success: true,
        data: {
          health: health.healthy,
          services: health.services,
          metrics: {
            // 可以添加更多統計指標
            uptime: process.uptime?.() || 0
          },
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ [DelayedMessageController] Get stats error:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stats',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }

  // 私有輔助方法

  /**
   * 驗證發送請求
   */
  private validateSendRequest(body: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!body.conversationId?.trim()) {
      errors.push('conversationId is required');
    }

    if (!body.content?.trim()) {
      errors.push('content is required');
    }

    if (!body.platform?.trim()) {
      errors.push('platform is required');
    }

    if (!body.recipientPlatformId?.trim()) {
      errors.push('recipientPlatformId is required');
    }

    if (typeof body.delaySeconds !== 'number') {
      errors.push('delaySeconds must be a number');
    } else if (body.delaySeconds < 1 || body.delaySeconds > 120) {
      errors.push('delaySeconds must be between 1 and 120');
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