// worker/src/handlers/webhook.ts
// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/src/handlers/webhook.ts
// Created by: Webhook Handler Developer
//
// Phase 4 Refactoring: Thin facade (~230 lines) delegating to:
// - line-event-processor.ts (processLineMessage, processLineFollowEvent, processLineUnfollowEvent)
// - facebook-event-processor.ts (processFacebookMessage)
// - ../services/webhook-customer-service.ts (shared customer lookup/creation)
// - ../services/webhook-conversation-service.ts (shared conversation find/create/update)
// - ../services/webhook-media-service.ts (LINE/Facebook media download & R2 upload)

import { Context } from 'hono';
import type {
  Bindings,
  LineWebhookBody,
  FacebookWebhookBody,
} from '@/types';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  handleApiError
} from '@/utils/api-response';
import { createContextLogger } from '@/utils/logger';

// Context logger for webhook handler
const log = createContextLogger('Webhook');

// P2-1: Import shared webhook services
import {
  verifyWebhookSignature,
} from '@/services/webhook-signature-service';
import {
  validateLineWebhook as validateLinePayload,
  validatePayloadSize,
  isFacebookWebhookBody
} from '@/services/webhook-validation';

// Phase 4: Import event processors
import {
  processLineMessage,
  processLineFollowEvent,
  processLineUnfollowEvent
} from './line-event-processor';
import { processFacebookMessage } from './facebook-event-processor';

/** Callback to defer a promise via executionCtx.waitUntil */
export type DeferFn = (promise: Promise<unknown>) => void;

// Re-export for backward compatibility (these were previously `export async function` in this file)
export { processLineMessage, processLineFollowEvent, processLineUnfollowEvent };

export const webhookHandler = {
  // 處理 Line Webhook
  async line(c: Context<{ Bindings: Bindings }>) {
    console.log('[LINE Webhook] Request received at:', nowISO());

    try {
      // 驗證簽名
      const signature = c.req.header('X-Line-Signature');
      const body = await c.req.text();

      console.log('[LINE Webhook] Headers:', {
        'X-Line-Signature': signature ? 'Present' : 'Missing',
        'Content-Type': c.req.header('Content-Type'),
        'Content-Length': body.length
      });

      // P2-1: 使用共享服務驗證 payload 大小
      const sizeValidation = validatePayloadSize(body, 1024 * 1024); // 1MB limit
      if (!sizeValidation.valid) {
        log.error('LINE Webhook: Payload too large', { size: sizeValidation.size });
        return errorResponse(c, 'Payload too large', 413);
      }

      // P2-1: 使用共享簽名驗證服務
      // P2-6: Use Array.from for better TypeScript compatibility
      const headers = Object.fromEntries(
        Array.from(c.req.raw.headers as unknown as Iterable<[string, string]>).map(([k, v]) => [k.toLowerCase(), v])
      );

      const signatureResult = await verifyWebhookSignature(
        'line',
        body,
        headers,
        c.env.LINE_CHANNEL_SECRET
      );

      if (!signatureResult.valid) {
        log.error('LINE Webhook: Signature verification failed', { error: signatureResult.error });
        return unauthorizedResponse(c, signatureResult.error || 'Invalid signature');
      }

      console.log('[LINE Webhook] Signature verified successfully');

      let data: LineWebhookBody;
      try {
        data = JSON.parse(body) as LineWebhookBody;
      } catch (parseError) {
        return errorResponse(c, 'Invalid JSON payload');
      }

      // P2-1: 使用共享驗證服務
      const validationResult = validateLinePayload(data);
      if (!validationResult.valid) {
        log.error('LINE Webhook: Invalid webhook payload', { errors: validationResult.errors });
        return errorResponse(c, validationResult.errors.join(', ') || 'Invalid webhook payload');
      }

      console.log('[LINE Webhook] Processing events:', {
        destination: data.destination,
        eventCount: data.events.length,
        firstEventType: data.events[0]?.type
      });

      // Create defer function to run tasks after HTTP response via waitUntil
      const defer: DeferFn = (p) => c.executionCtx.waitUntil(p);

      // 處理事件
      for (const event of data.events) {
        console.log('[LINE Webhook] Processing event:', {
          type: event.type,
          userId: event.source?.userId?.substring(0, 10) + '...',
          messageType: event.message?.type
        });

        if (event.type === 'message' && event.message) {
          await processLineMessage(c.env, event, defer);
        } else if (event.type === 'follow') {
          // 處理 QR Code 加好友事件
          await processLineFollowEvent(c.env, event);
        } else if (event.type === 'unfollow') {
          // 處理取消關注事件 - 更新好友狀態為 blocked
          await processLineUnfollowEvent(c.env, event);
        } else {
          console.log('[LINE Webhook] Skipping event:', event.type);
        }
      }

      console.log('[LINE Webhook] All events processed successfully');
      return successResponse(c, null, 'LINE webhook processed successfully');
    } catch (error) {
      return handleApiError(error, c);
    }
  },

  // 處理 Facebook Webhook
  async facebook(c: Context<{ Bindings: Bindings }>) {
    try {
      // Facebook webhook 驗證
      const mode = c.req.query('hub.mode');
      const token = c.req.query('hub.verify_token');
      const challenge = c.req.query('hub.challenge');

      if (mode === 'subscribe' && token === c.env.FB_VERIFY_TOKEN) {
        return c.text(challenge || '');
      }

      // 檢查 Content-Length header 來限制 payload 大小
      const contentLength = c.req.header('content-length');
      if (contentLength && parseInt(contentLength) > 1024 * 1024) {
        return errorResponse(c, 'Payload too large', 413);
      }

      let body: FacebookWebhookBody;
      try {
        body = await c.req.json() as FacebookWebhookBody;
      } catch (parseError) {
        return errorResponse(c, 'Invalid JSON payload');
      }

      // 輸入驗證
      if (!isFacebookWebhookBody(body)) {
        return errorResponse(c, 'Invalid webhook payload');
      }

      // 處理 Facebook 訊息
      if (body.object === 'page') {
        for (const entry of body.entry) {
          if (!entry.messaging || !Array.isArray(entry.messaging)) continue;

          const fbDefer: DeferFn = (p) => c.executionCtx.waitUntil(p);
          for (const messaging of entry.messaging) {
            if (messaging.message) {
              await processFacebookMessage(c.env, messaging, fbDefer);
            }
          }
        }
      }

      return successResponse(c, null, 'Facebook webhook processed successfully');
    } catch (error) {
      return handleApiError(error, c);
    }
  }
};

// ==================== Hono Router Wrapper ====================
import { Hono } from 'hono';
import { nowISO } from '@/utils/timestamp'

/**
 * Webhook Router - Hono wrapper for webhook handlers
 * Provides a unified router interface for LINE and Facebook webhooks
 */
export const webhookRouter = new Hono<{ Bindings: Bindings }>();

// Health check endpoint
webhookRouter.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    module: 'webhook',
    version: '1.0.0',
    timestamp: nowISO()
  });
});

// LINE webhook endpoint
webhookRouter.post('/line', (c) => webhookHandler.line(c));

// Facebook webhook endpoint
webhookRouter.get('/facebook', (c) => webhookHandler.facebook(c));
webhookRouter.post('/facebook', (c) => webhookHandler.facebook(c));

// Default export for route registry
export default webhookRouter;
