// 企業級 Webhook 處理器
// Enterprise-grade Webhook Handler with Advanced Security

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Bindings } from '@/types';
import { createWebhookValidator } from '@modules/integrations/services/webhook-validator';
import { successResponse, errorResponse, unauthorizedResponse } from '@/utils/api-response';

/**
 * Webhook Handler
 *
 * 提供企業級的 Webhook 接收和處理功能
 * 整合完整的安全驗證機制
 */
export const webhookHandler = new Hono<{ Bindings: Bindings }>();

/**
 * Health Check Endpoint
 */
webhookHandler.get('/health', (c) => {
  return successResponse(c, {
    status: 'healthy',
    module: 'webhook-handler',
    version: '2.0.0',
    features: [
      'HMAC signature verification',
      'Timestamp validation',
      'Replay attack protection',
      'Rate limiting',
      'Security monitoring'
    ],
    timestamp: new Date().toISOString()
  });
});

/**
 * LINE Webhook Endpoint
 * POST /api/integrations/webhooks/line/:integrationId
 */
webhookHandler.post('/line/:integrationId', async (c: Context<{ Bindings: Bindings }>) => {
  const startTime = Date.now();
  const integrationId = c.req.param('integrationId');

  console.log(`[Webhook] LINE webhook received for integration: ${integrationId}`);

  try {
    // 獲取請求數據
    const headers: Record<string, string> = {};
    for (const key of ['x-line-signature', 'x-hub-signature', 'x-hub-signature-256', 'content-type', 'user-agent']) {
      const value = c.req.header(key);
      if (value) headers[key] = value;
    }
    const body = await c.req.text();
    const sourceIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Real-IP');

    // 創建驗證器
    const validator = createWebhookValidator(
      c.env,
      c.env.DB,
      c.env.SESSIONS
    );

    // 執行完整驗證
    const validationResult = await validator.validateAndRoute(
      c.req.path,
      'POST',
      headers,
      body,
      sourceIP
    );

    // 檢查驗證結果
    if (!validationResult.success) {
      console.error('[Webhook] LINE validation failed:', validationResult.errors);

      // 根據錯誤類型返回不同的 HTTP 狀態碼
      if (validationResult.security.errors.some(e => e.includes('signature'))) {
        return unauthorizedResponse(c, 'Invalid signature');
      }

      if (validationResult.security.errors.some(e => e.includes('rate limit'))) {
        return errorResponse(c, 'Rate limit exceeded', 429);
      }

      return errorResponse(c, validationResult.errors[0] || 'Validation failed', 400);
    }

    // 驗證成功，處理事件
    const processingTime = Date.now() - startTime;

    console.log(`[Webhook] LINE webhook validated successfully in ${processingTime}ms`);
    console.log(`[Webhook] Processing ${validationResult.routing?.events.length || 0} events`);

    // 記錄處理結果
    if (validationResult.warnings.length > 0) {
      console.warn('[Webhook] Warnings:', validationResult.warnings);
    }

    return successResponse(c, {
      received: true,
      eventsProcessed: validationResult.routing?.events.length || 0,
      processingTimeMs: processingTime,
      warnings: validationResult.warnings
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error('[Webhook] LINE webhook processing error:', error);

    return errorResponse(c, "Internal server error", 500);
  }
});

/**
 * Facebook Webhook Endpoint
 * GET /api/integrations/webhooks/facebook/:integrationId - Verification
 * POST /api/integrations/webhooks/facebook/:integrationId - Webhook events
 */
webhookHandler.get('/facebook/:integrationId', (c: Context<{ Bindings: Bindings }>) => {
  // Facebook Webhook 驗證握手
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  console.log('[Webhook] Facebook verification request:', { mode, token: token ? '***' : 'missing' });

  if (mode === 'subscribe' && token === c.env.FB_VERIFY_TOKEN) {
    console.log('[Webhook] Facebook verification successful');
    return c.text(challenge || '');
  }

  console.warn('[Webhook] Facebook verification failed');
  return errorResponse(c, 'Verification failed', 403);
});

webhookHandler.post('/facebook/:integrationId', async (c: Context<{ Bindings: Bindings }>) => {
  const startTime = Date.now();
  const integrationId = c.req.param('integrationId');

  console.log(`[Webhook] Facebook webhook received for integration: ${integrationId}`);

  try {
    // 獲取請求數據
    const headers: Record<string, string> = {};
    for (const key of ['x-line-signature', 'x-hub-signature', 'x-hub-signature-256', 'content-type', 'user-agent']) {
      const value = c.req.header(key);
      if (value) headers[key] = value;
    }
    const body = await c.req.text();
    const sourceIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Real-IP');

    // 創建驗證器
    const validator = createWebhookValidator(
      c.env,
      c.env.DB,
      c.env.SESSIONS
    );

    // 執行完整驗證
    const validationResult = await validator.validateAndRoute(
      c.req.path,
      'POST',
      headers,
      body,
      sourceIP
    );

    // 檢查驗證結果
    if (!validationResult.success) {
      console.error('[Webhook] Facebook validation failed:', validationResult.errors);

      if (validationResult.security.errors.some(e => e.includes('signature'))) {
        return unauthorizedResponse(c, 'Invalid signature');
      }

      if (validationResult.security.errors.some(e => e.includes('rate limit'))) {
        return errorResponse(c, 'Rate limit exceeded', 429);
      }

      return errorResponse(c, validationResult.errors[0] || 'Validation failed', 400);
    }

    // 驗證成功，處理事件
    const processingTime = Date.now() - startTime;

    console.log(`[Webhook] Facebook webhook validated successfully in ${processingTime}ms`);
    console.log(`[Webhook] Processing ${validationResult.routing?.events.length || 0} events`);

    return successResponse(c, {
      received: true,
      eventsProcessed: validationResult.routing?.events.length || 0,
      processingTimeMs: processingTime,
      warnings: validationResult.warnings
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error('[Webhook] Facebook webhook processing error:', error);

    return errorResponse(c, "Internal server error", 500);
  }
});

/**
 * Instagram Webhook Endpoint (使用 Facebook 系統)
 */
webhookHandler.get('/instagram/:integrationId', (c: Context<{ Bindings: Bindings }>) => {
  // Instagram 使用與 Facebook 相同的驗證機制
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  if (mode === 'subscribe' && token === c.env.FB_VERIFY_TOKEN) {
    return c.text(challenge || '');
  }

  return errorResponse(c, 'Verification failed', 403);
});

webhookHandler.post('/instagram/:integrationId', async (c: Context<{ Bindings: Bindings }>) => {
  // Instagram 使用與 Facebook 相同的處理邏輯
  // 實作與 Facebook endpoint 相同
  const startTime = Date.now();
  const integrationId = c.req.param('integrationId');

  try {
    const headers: Record<string, string> = {};
    for (const key of ['x-line-signature', 'x-hub-signature', 'x-hub-signature-256', 'content-type', 'user-agent']) {
      const value = c.req.header(key);
      if (value) headers[key] = value;
    }
    const body = await c.req.text();
    const sourceIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Real-IP');

    const validator = createWebhookValidator(
      c.env,
      c.env.DB,
      c.env.SESSIONS
    );

    const validationResult = await validator.validateAndRoute(
      c.req.path,
      'POST',
      headers,
      body,
      sourceIP
    );

    if (!validationResult.success) {
      if (validationResult.security.errors.some(e => e.includes('signature'))) {
        return unauthorizedResponse(c, 'Invalid signature');
      }

      if (validationResult.security.errors.some(e => e.includes('rate limit'))) {
        return errorResponse(c, 'Rate limit exceeded', 429);
      }

      return errorResponse(c, validationResult.errors[0] || 'Validation failed', 400);
    }

    const processingTime = Date.now() - startTime;

    return successResponse(c, {
      received: true,
      eventsProcessed: validationResult.routing?.events.length || 0,
      processingTimeMs: processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    return errorResponse(c, "Internal server error", 500);
  }
});

/**
 * Admin Endpoint: 清除速率限制
 * DELETE /api/integrations/webhooks/rate-limit/:integrationId
 */
webhookHandler.delete('/rate-limit/:integrationId', async (c: Context<{ Bindings: Bindings }>) => {
  const integrationId = c.req.param('integrationId');

  try {
    const validator = createWebhookValidator(
      c.env,
      c.env.DB,
      c.env.SESSIONS
    );

    const success = await validator.clearRateLimit(integrationId);

    if (success) {
      return successResponse(c, {
        cleared: true,
        integrationId
      });
    }

    return errorResponse(c, 'Failed to clear rate limit', 500);

  } catch (error) {
    return errorResponse(c, "Internal server error", 500);
  }
});

/**
 * Admin Endpoint: 獲取安全統計
 * GET /api/integrations/webhooks/security/stats?integrationId=xxx&hours=24
 */
webhookHandler.get('/security/stats', async (c: Context<{ Bindings: Bindings }>) => {
  const integrationId = c.req.query('integrationId');
  const hours = parseInt(c.req.query('hours') || '24');

  try {
    const validator = createWebhookValidator(
      c.env,
      c.env.DB,
      c.env.SESSIONS
    );

    const stats = await validator.getSecurityStats(integrationId, hours);

    return successResponse(c, stats);

  } catch (error) {
    return errorResponse(c, "Internal server error", 500);
  }
});

export default webhookHandler;