// Webhook 路由和驗證服務
// Webhook Router and Validation Service

import type {
  IntegrationPlatform,
  WebhookEventType,
  PlatformEvent,
  IntegrationRecord,
  MessageType
} from '../types/integration-types';

import type { Bindings } from '@/types';
// LineIntegrationService and FacebookIntegrationService reserved for future platform routing
// import { LineIntegrationService } from '@modules/integrations/services/line-integration-service';
// import { FacebookIntegrationService } from '@modules/integrations/services/facebook-integration-service';
import { nowISO, nowMs } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('WebhookRouter');

/**
 * Webhook 路由結果
 */
export interface WebhookRouteResult {
  success: boolean;
  events: PlatformEvent[];
  errors: string[];
  warnings: string[];
  processedAt: string;
}

/**
 * Webhook 驗證結果
 */
interface WebhookValidationResult {
  isValid: boolean;
  platform?: IntegrationPlatform;
  integrationId?: string;
  errors: string[];
  metadata?: {
    sourceIP?: string;
    userAgent?: string;
    contentType?: string;
    signatureValid?: boolean;
  };
}

/**
 * 路由規則
 */
interface RoutingRule {
  platform: IntegrationPlatform;
  pathPattern: RegExp;
  headerChecks: Array<{
    header: string;
    value?: string;
    pattern?: RegExp;
  }>;
  signatureValidation?: {
    enabled: boolean;
    header: string;
    algorithm: string;
  };
}

/**
 * Webhook 路由服務
 */
export class WebhookRouterService {
  private readonly routingRules: RoutingRule[];

  constructor(
    _env: Bindings,
    private db: D1Database,
    private cache: KVNamespace
  ) {
    this.routingRules = this.initializeRoutingRules();
  }

  // ======================== 主要路由方法 ========================

  /**
   * 路由 Webhook 請求
   */
  async routeWebhook(
    path: string,
    method: string,
    headers: Record<string, string>,
    body: any,
    sourceIP?: string
  ): Promise<WebhookRouteResult> {
    const result: WebhookRouteResult = {
      success: false,
      events: [],
      errors: [],
      warnings: [],
      processedAt: nowISO()
    };

    try {
      // 1. 基本請求驗證
      const basicValidation = this.validateBasicRequest(method, headers, body);
      if (!basicValidation.isValid) {
        result.errors.push(...basicValidation.errors);
        return result;
      }

      // 2. 路由匹配
      const matchedRule = this.matchRoutingRule(path, headers);
      if (!matchedRule) {
        result.errors.push('No matching routing rule found');
        return result;
      }

      // 3. 平台特定驗證
      const validation = await this.validateWebhookRequest(
        matchedRule.platform,
        path,
        headers,
        body,
        sourceIP
      );

      if (!validation.isValid) {
        result.errors.push(...validation.errors);
        return result;
      }

      // 4. 獲取整合設定
      const integration = await this.getIntegrationByPath(matchedRule.platform, path);
      if (!integration) {
        result.errors.push('Integration not found or inactive');
        return result;
      }

      // 5. 處理 Webhook 事件
      const events = await this.processWebhookEvents(
        matchedRule.platform,
        integration,
        body
      );

      result.success = true;
      result.events = events;

      // 6. 更新統計
      await this.updateWebhookStats(integration.id, events.length, true);

      return result;
    } catch (error) {
      result.errors.push(
        `Webhook routing error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      log.error('Webhook routing error', {}, error instanceof Error ? error : new Error(String(error)));
      return result;
    }
  }

  /**
   * 批量處理 Webhook 事件
   */
  async processBatchWebhooks(
    webhooks: Array<{
      path: string;
      method: string;
      headers: Record<string, string>;
      body: any;
      sourceIP?: string;
    }>
  ): Promise<WebhookRouteResult[]> {
    const results: WebhookRouteResult[] = [];
    const promises = webhooks.map(webhook =>
      this.routeWebhook(webhook.path, webhook.method, webhook.headers, webhook.body, webhook.sourceIP)
    );

    try {
      const batchResults = await Promise.allSettled(promises);

      for (const promiseResult of batchResults) {
        if (promiseResult.status === 'fulfilled') {
          results.push(promiseResult.value);
        } else {
          results.push({
            success: false,
            events: [],
            errors: [`Batch processing error: ${promiseResult.reason}`],
            warnings: [],
            processedAt: nowISO()
          });
        }
      }

      return results;
    } catch (error) {
      log.error('Batch webhook processing error', {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  // ======================== 驗證方法 ========================

  /**
   * 驗證基本請求
   */
  private validateBasicRequest(
    method: string,
    headers: Record<string, string>,
    body: any
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 檢查 HTTP 方法
    if (method !== 'POST') {
      errors.push(`Invalid HTTP method: ${method}. Only POST is supported.`);
    }

    // 檢查 Content-Type
    const contentType = headers['content-type'] || headers['Content-Type'];
    if (!contentType) {
      errors.push('Missing Content-Type header');
    } else if (!contentType.includes('application/json')) {
      errors.push(`Unsupported Content-Type: ${contentType}`);
    }

    // 檢查請求體
    if (!body) {
      errors.push('Missing request body');
    }

    // 檢查請求大小（防止過大的請求）
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    if (bodyString.length > 1024 * 1024) { // 1MB 限制
      errors.push('Request body too large (max 1MB)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 驗證 Webhook 請求
   */
  private async validateWebhookRequest(
    platform: IntegrationPlatform,
    path: string,
    headers: Record<string, string>,
    body: any,
    sourceIP?: string
  ): Promise<WebhookValidationResult> {
    const result: WebhookValidationResult = {
      isValid: false,
      platform,
      errors: [],
      metadata: {
        sourceIP,
        userAgent: headers['user-agent'] || headers['User-Agent'],
        contentType: headers['content-type'] || headers['Content-Type']
      }
    };

    try {
      switch (platform) {
        case 'line':
          await this.validateLineWebhook(path, headers, body, result);
          break;
        case 'facebook':
          await this.validateFacebookWebhook(path, headers, body, result);
          break;
        default:
          await this.validateGenericWebhook(path, headers, body, result);
      }

      result.isValid = result.errors.length === 0;
      return result;
    } catch (error) {
      result.errors.push(
        `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return result;
    }
  }

  /**
   * 驗證 LINE Webhook
   */
  private async validateLineWebhook(
    path: string,
    headers: Record<string, string>,
    body: any,
    result: WebhookValidationResult
  ): Promise<void> {
    // 檢查 LINE 特定標頭
    const signature = headers['x-line-signature'] || headers['X-Line-Signature'];
    if (!signature) {
      result.errors.push('Missing X-Line-Signature header');
      return;
    }

    // 檢查用戶代理
    const userAgent = headers['user-agent'] || headers['User-Agent'] || '';
    if (!userAgent.includes('LineBotWebhook')) {
      result.errors.push('Invalid User-Agent for LINE webhook');
    }

    // 驗證請求體結構
    if (!body.events || !Array.isArray(body.events)) {
      result.errors.push('Invalid LINE webhook body structure');
    }

    // 提取整合 ID
    const pathMatch = path.match(/\/webhooks\/line\/(.+)/);
    if (pathMatch) {
      result.integrationId = pathMatch[1];
    }

    result.metadata!.signatureValid = signature.length > 0;
  }

  /**
   * 驗證 Facebook Webhook
   */
  private async validateFacebookWebhook(
    path: string,
    headers: Record<string, string>,
    body: any,
    result: WebhookValidationResult
  ): Promise<void> {
    // 檢查 Facebook 特定標頭
    const signature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];
    if (!signature) {
      result.errors.push('Missing X-Hub-Signature-256 header');
      return;
    }

    // 驗證請求體結構
    if (body.object !== 'page') {
      result.errors.push('Invalid Facebook webhook object type');
    }

    if (!body.entry || !Array.isArray(body.entry)) {
      result.errors.push('Invalid Facebook webhook body structure');
    }

    // 提取整合 ID
    const pathMatch = path.match(/\/webhooks\/facebook\/(.+)/);
    if (pathMatch) {
      result.integrationId = pathMatch[1];
    }

    result.metadata!.signatureValid = signature.startsWith('sha256=');
  }

  /**
   * 驗證通用 Webhook
   */
  private async validateGenericWebhook(
    path: string,
    _headers: Record<string, string>,
    body: any,
    result: WebhookValidationResult
  ): Promise<void> {
    // 基本結構驗證
    if (typeof body !== 'object') {
      result.errors.push('Webhook body must be a JSON object');
    }

    // 提取整合 ID
    const pathMatch = path.match(/\/webhooks\/([^\/]+)\/(.+)/);
    if (pathMatch) {
      result.platform = pathMatch[1] as IntegrationPlatform;
      result.integrationId = pathMatch[2];
    }

    result.metadata!.signatureValid = false; // 通用 webhook 不驗證簽章
  }

  // ======================== 路由匹配 ========================

  /**
   * 匹配路由規則
   */
  private matchRoutingRule(path: string, headers: Record<string, string>): RoutingRule | null {
    for (const rule of this.routingRules) {
      // 檢查路徑模式
      if (!rule.pathPattern.test(path)) {
        continue;
      }

      // 檢查標頭要求
      let headerMatches = true;
      for (const headerCheck of rule.headerChecks) {
        const headerValue = headers[headerCheck.header] || headers[headerCheck.header.toLowerCase()];

        if (!headerValue) {
          headerMatches = false;
          break;
        }

        if (headerCheck.value && headerValue !== headerCheck.value) {
          headerMatches = false;
          break;
        }

        if (headerCheck.pattern && !headerCheck.pattern.test(headerValue)) {
          headerMatches = false;
          break;
        }
      }

      if (headerMatches) {
        return rule;
      }
    }

    return null;
  }

  /**
   * 初始化路由規則
   */
  private initializeRoutingRules(): RoutingRule[] {
    return [
      // LINE OA Webhook 規則
      {
        platform: 'line',
        pathPattern: /^\/api\/integrations\/webhooks\/line\/[^\/]+$/,
        headerChecks: [
          { header: 'X-Line-Signature', pattern: /^.+$/ },
          { header: 'Content-Type', value: 'application/json' }
        ],
        signatureValidation: {
          enabled: true,
          header: 'X-Line-Signature',
          algorithm: 'HMAC-SHA256'
        }
      },

      // Facebook Messenger Webhook 規則
      {
        platform: 'facebook',
        pathPattern: /^\/api\/integrations\/webhooks\/facebook\/[^\/]+$/,
        headerChecks: [
          { header: 'X-Hub-Signature-256', pattern: /^sha256=.+$/ },
          { header: 'Content-Type', value: 'application/json' }
        ],
        signatureValidation: {
          enabled: true,
          header: 'X-Hub-Signature-256',
          algorithm: 'SHA256'
        }
      },

      // Instagram Webhook 規則（使用 Facebook 系統）
      {
        platform: 'instagram',
        pathPattern: /^\/api\/integrations\/webhooks\/instagram\/[^\/]+$/,
        headerChecks: [
          { header: 'X-Hub-Signature-256', pattern: /^sha256=.+$/ },
          { header: 'Content-Type', value: 'application/json' }
        ],
        signatureValidation: {
          enabled: true,
          header: 'X-Hub-Signature-256',
          algorithm: 'SHA256'
        }
      },

      // 通用 Webhook 規則
      {
        platform: 'custom',
        pathPattern: /^\/api\/integrations\/webhooks\/[^\/]+\/[^\/]+$/,
        headerChecks: [
          { header: 'Content-Type', value: 'application/json' }
        ]
      }
    ];
  }

  // ======================== 事件處理 ========================

  /**
   * 處理 Webhook 事件
   */
  private async processWebhookEvents(
    platform: IntegrationPlatform,
    integration: IntegrationRecord,
    webhookBody: any
  ): Promise<PlatformEvent[]> {
    try {
      switch (platform) {
        case 'line':
          return await this.processLineEvents(integration, webhookBody);
        case 'facebook':
          return await this.processFacebookEvents(integration, webhookBody);
        case 'instagram':
          return await this.processInstagramEvents(integration, webhookBody);
        default:
          return await this.processGenericEvents(integration, webhookBody);
      }
    } catch (error) {
      log.error(`Error processing ${platform} events`, {}, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 處理 LINE 事件
   */
  private async processLineEvents(
    integration: IntegrationRecord,
    webhookBody: any
  ): Promise<PlatformEvent[]> {
    const events: PlatformEvent[] = [];

    for (const lineEvent of webhookBody.events || []) {
      try {
        const platformEvent: PlatformEvent = {
          id: `line_${lineEvent.timestamp}_${Math.random().toString(36).substr(2, 9)}`,
          integrationId: integration.id,
          platform: 'line',
          type: this.mapLineEventType(lineEvent.type),

          source: {
            userId: lineEvent.source.userId || '',
            type: lineEvent.source.type,
            id: lineEvent.source.groupId || lineEvent.source.roomId
          },

          timestamp: new Date(lineEvent.timestamp).toISOString(),
          processed: false
        };

        // 處理訊息事件
        if (lineEvent.message) {
          platformEvent.message = {
            id: lineEvent.message.id,
            type: this.mapLineMessageType(lineEvent.message.type),
            content: lineEvent.message,
            timestamp: new Date(lineEvent.timestamp).toISOString()
          };
        }

        events.push(platformEvent);
      } catch (error) {
        log.error('Error processing LINE event', {}, error instanceof Error ? error : new Error(String(error)));
      }
    }

    return events;
  }

  /**
   * 處理 Facebook 事件
   */
  private async processFacebookEvents(
    integration: IntegrationRecord,
    webhookBody: any
  ): Promise<PlatformEvent[]> {
    const events: PlatformEvent[] = [];

    for (const entry of webhookBody.entry || []) {
      for (const messaging of entry.messaging || []) {
        try {
          const platformEvent: PlatformEvent = {
            id: `facebook_${messaging.timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            integrationId: integration.id,
            platform: 'facebook',
            type: this.mapFacebookEventType(messaging),

            source: {
              userId: messaging.sender.id,
              type: 'user'
            },

            timestamp: new Date(messaging.timestamp).toISOString(),
            processed: false
          };

          // 處理訊息事件
          if (messaging.message) {
            platformEvent.message = {
              id: messaging.message.mid,
              type: this.mapFacebookMessageType(messaging.message),
              content: messaging.message,
              timestamp: new Date(messaging.timestamp).toISOString()
            };
          }

          events.push(platformEvent);
        } catch (error) {
          log.error('Error processing Facebook event', {}, error instanceof Error ? error : new Error(String(error)));
        }
      }
    }

    return events;
  }

  /**
   * 處理 Instagram 事件
   */
  private async processInstagramEvents(
    integration: IntegrationRecord,
    webhookBody: any
  ): Promise<PlatformEvent[]> {
    // Instagram 使用與 Facebook 相同的 Webhook 格式
    return await this.processFacebookEvents(integration, webhookBody);
  }

  /**
   * 處理通用事件
   */
  private async processGenericEvents(
    integration: IntegrationRecord,
    webhookBody: any
  ): Promise<PlatformEvent[]> {
    const events: PlatformEvent[] = [];

    try {
      const platformEvent: PlatformEvent = {
        id: `generic_${nowMs()}_${Math.random().toString(36).substr(2, 9)}`,
        integrationId: integration.id,
        platform: integration.platform,
        type: 'message',

        source: {
          userId: webhookBody.userId || webhookBody.from || 'unknown',
          type: 'user'
        },

        timestamp: nowISO(),
        processed: false
      };

      // 嘗試提取訊息內容
      if (webhookBody.message || webhookBody.text) {
        platformEvent.message = {
          id: webhookBody.messageId || `msg_${nowMs()}`,
          type: 'text',
          content: webhookBody.message || webhookBody.text,
          timestamp: nowISO()
        };
      }

      events.push(platformEvent);
    } catch (error) {
      log.error('Error processing generic event', {}, error instanceof Error ? error : new Error(String(error)));
    }

    return events;
  }

  // ======================== 輔助方法 ========================

  /**
   * 根據路徑獲取整合
   */
  private async getIntegrationByPath(
    platform: IntegrationPlatform,
    path: string
  ): Promise<IntegrationRecord | null> {
    try {
      // 從路徑提取整合 ID
      const pathParts = path.split('/');
      const integrationId = pathParts[pathParts.length - 1];

      if (!integrationId) {
        return null;
      }

      // 從快取或資料庫獲取整合設定
      const cacheKey = `integration_${integrationId}`;
      const cached = await this.cache.get(cacheKey, 'json') as IntegrationRecord | null;

      if (cached && cached.status === 'active') {
        return cached;
      }

      // 從資料庫查詢
      const query = `
        SELECT * FROM integrations
        WHERE id = ? AND platform = ? AND status = 'active'
      `;

      const result = await this.db.prepare(query)
        .bind(integrationId, platform)
        .first() as IntegrationRecord | null;

      if (result) {
        // 快取結果
        await this.cache.put(cacheKey, JSON.stringify(result), { expirationTtl: 300 });
      }

      return result;
    } catch (error) {
      log.error('Error getting integration by path', {}, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * 更新 Webhook 統計
   */
  private async updateWebhookStats(
    integrationId: string,
    eventCount: number,
    success: boolean
  ): Promise<void> {
    try {
      const statsKey = `webhook_stats_${integrationId}`;
      const stats = await this.cache.get(statsKey, 'json') || {
        received: 0,
        processed: 0,
        failed: 0,
        lastUpdated: nowISO()
      };

      (stats as any).received += eventCount;
      if (success) {
        (stats as any).processed += eventCount;
      } else {
        (stats as any).failed += eventCount;
      }
      (stats as any).lastUpdated = nowISO();

      await this.cache.put(statsKey, JSON.stringify(stats), { expirationTtl: 86400 });
    } catch (error) {
      log.error('Error updating webhook stats', {}, error instanceof Error ? error : new Error(String(error)));
    }
  }

  // ======================== 事件類型映射 ========================

  private mapLineEventType(lineEventType: string): WebhookEventType {
    const eventMap: Record<string, WebhookEventType> = {
      'message': 'message',
      'postback': 'postback',
      'follow': 'follow',
      'unfollow': 'unfollow',
      'join': 'join',
      'leave': 'leave',
      'memberJoined': 'memberJoin',
      'memberLeft': 'memberLeave',
      'beacon': 'beacon',
      'accountLink': 'accountLink',
      'delivery': 'delivery'
    };

    return eventMap[lineEventType] || 'message';
  }

  private mapLineMessageType(lineMessageType: string): any {
    const messageMap: Record<string, string> = {
      'text': 'text',
      'image': 'image',
      'video': 'video',
      'audio': 'audio',
      'file': 'file',
      'location': 'location',
      'sticker': 'sticker',
      'imagemap': 'imagemap',
      'template': 'template',
      'flex': 'flex'
    };

    return messageMap[lineMessageType] || 'text';
  }

  private mapFacebookEventType(messaging: any): WebhookEventType {
    if (messaging.message) return 'message';
    if (messaging.postback) return 'postback';
    if (messaging.read) return 'read';
    if (messaging.delivery) return 'delivery';
    if (messaging.account_linking) return 'accountLink';
    return 'message';
  }

  private mapFacebookMessageType(message: any): MessageType {
    if (message.text) return 'text';
    if (message.attachments) {
      const firstAttachment = message.attachments[0];
      const attachmentType = firstAttachment.type;
      // 映射 Facebook 附件類型到系統 MessageType
      switch (attachmentType) {
        case 'image':
          return 'image';
        case 'video':
          return 'video';
        case 'audio':
          return 'audio';
        case 'file':
          return 'file';
        case 'location':
          return 'location';
        default:
          return 'text';
      }
    }
    return 'text';
  }
}
