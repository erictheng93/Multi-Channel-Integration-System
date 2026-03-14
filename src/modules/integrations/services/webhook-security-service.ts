// Webhook 安全驗證服務
// Enterprise-grade Webhook Security Verification Service

import type { Bindings } from '@/types';
import type { IntegrationPlatform } from '@modules/integrations/types/integration-types';
import { createDbClient } from '@/db/drizzle-factory';
import { webhookSecurityEvents } from '@/db/schema';
import { eq, gte, desc } from 'drizzle-orm';
import { IPValidator, LINE_IP_RANGES, FACEBOOK_IP_RANGES } from '@/utils/ip-validator';
import { AlertService, getDefaultAlertChannels } from '@/services/alert-service';
import { nowISO, nowMs } from '@/utils/timestamp'

/**
 * 安全驗證結果
 */
export interface SecurityValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    signatureValid?: boolean;
    timestampValid?: boolean;
    replayCheckPassed?: boolean;
    rateLimitOk?: boolean;
    sourceVerified?: boolean;
  };
  metadata?: {
    requestId?: string;
    timestamp?: string;
    sourceIP?: string;
    platform?: IntegrationPlatform;
  };
}

/**
 * 重放攻擊檢查結果
 */
interface ReplayCheckResult {
  isDuplicate: boolean;
  firstSeen?: string;
  occurrences: number;
}

/**
 * 速率限制檢查結果
 */
interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  resetAt: string;
  retryAfterMs?: number;
}

/**
 * 安全事件類型
 */
type SecurityEventType =
  | 'signature_verification_failed'
  | 'timestamp_validation_failed'
  | 'replay_attack_detected'
  | 'rate_limit_exceeded'
  | 'invalid_source'
  | 'malformed_request'
  | 'suspicious_activity';

/**
 * 安全事件記錄
 */
interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  platform: IntegrationPlatform;
  integrationId?: string;
  sourceIP?: string;
  details: Record<string, any>;
  timestamp: string;
}

/**
 * Webhook 安全驗證服務
 *
 * 提供企業級的 Webhook 安全驗證功能：
 * - HMAC 簽章驗證 (LINE, Facebook)
 * - 時間戳驗證 (防重放攻擊)
 * - Request ID 去重
 * - 速率限制
 * - 安全事件監控
 * - IP 白名單 (可選)
 */
export class WebhookSecurityService {
  // 時間戳容忍度 (5分鐘)
  private readonly TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

  // Request ID 去重期限 (1小時)
  private readonly REQUEST_ID_TTL_SECONDS = 3600;

  // 速率限制 - 每個整合每分鐘最大請求數
  private readonly RATE_LIMIT_PER_INTEGRATION = 100;

  // 速率限制 - 全局每分鐘最大請求數
  private readonly RATE_LIMIT_GLOBAL = 500;

  // 速率限制窗口 (1分鐘)
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 1000;

  // IP 白名單配置
  private readonly IP_WHITELIST_ENABLED: boolean;
  private readonly ipValidator: IPValidator;

  constructor(
    private env: Bindings,
    private db: D1Database,
    private cache: KVNamespace,
    options?: {
      enableIPWhitelist?: boolean;
    }
  ) {
    // IP whitelist configuration (enabled by default for security)
    this.IP_WHITELIST_ENABLED = options?.enableIPWhitelist ?? true;

    // Initialize IP validator with all platform ranges
    this.ipValidator = new IPValidator([...LINE_IP_RANGES, ...FACEBOOK_IP_RANGES]);

    console.log(`[WebhookSecurity] Initialized with IP whitelist ${this.IP_WHITELIST_ENABLED ? 'ENABLED' : 'DISABLED'}`);
    console.log(` Loaded ${this.ipValidator.getTotalRanges()} IP ranges (LINE: ${LINE_IP_RANGES.length}, Facebook: ${FACEBOOK_IP_RANGES.length})`);
  }

  // ======================== 主要驗證方法 ========================

  /**
   * 完整的 Webhook 安全驗證
   * 整合所有安全檢查層級
   */
  async validateWebhookSecurity(
    platform: IntegrationPlatform,
    integrationId: string,
    headers: Record<string, string>,
    body: string | any,
    sourceIP?: string
  ): Promise<SecurityValidationResult> {
    const result: SecurityValidationResult = {
      valid: false,
      errors: [],
      warnings: [],
      details: {},
      metadata: {
        platform,
        sourceIP,
        timestamp: nowISO()
      }
    };

    try {
      // 解析 body (如果是字串)
      let parsedBody: any = body;
      if (typeof body === 'string') {
        try {
          parsedBody = JSON.parse(body);
        } catch (e) {
          // 如果解析失敗，保持原樣 (可能是某些平台使用其他格式)
        }
      }

      // 1. 簽章驗證
      const signatureResult = await this.verifySignature(platform, integrationId, headers, body);
      result.details.signatureValid = signatureResult.valid;

      if (!signatureResult.valid) {
        result.errors.push(`Signature verification failed: ${signatureResult.error}`);
        await this.logSecurityEvent({
          type: 'signature_verification_failed',
          severity: 'high',
          platform,
          integrationId,
          sourceIP,
          details: { error: signatureResult.error }
        });
        return result;
      }

      // 2. 時間戳驗證 (防重放攻擊)
      const timestampResult = this.validateTimestamp(platform, headers, parsedBody);
      result.details.timestampValid = timestampResult.valid;

      if (!timestampResult.valid) {
        result.errors.push(`Timestamp validation failed: ${timestampResult.error}`);
        await this.logSecurityEvent({
          type: 'timestamp_validation_failed',
          severity: 'medium',
          platform,
          integrationId,
          sourceIP,
          details: { error: timestampResult.error }
        });
        return result;
      }

      // 3. Request ID 去重檢查
      const requestId = this.extractRequestId(platform, headers, parsedBody);
      if (requestId) {
        result.metadata!.requestId = requestId;
        const replayCheck = await this.checkReplayAttack(requestId);
        result.details.replayCheckPassed = !replayCheck.isDuplicate;

        if (replayCheck.isDuplicate) {
          result.errors.push('Duplicate request detected (replay attack)');
          await this.logSecurityEvent({
            type: 'replay_attack_detected',
            severity: 'critical',
            platform,
            integrationId,
            sourceIP,
            details: {
              requestId,
              firstSeen: replayCheck.firstSeen,
              occurrences: replayCheck.occurrences
            }
          });
          return result;
        }
      }

      // 4. 速率限制檢查
      const rateLimitResult = await this.enforceRateLimit(integrationId, platform);
      result.details.rateLimitOk = rateLimitResult.allowed;

      if (!rateLimitResult.allowed) {
        result.errors.push(`Rate limit exceeded: ${rateLimitResult.current}/${rateLimitResult.limit}`);
        if (result.metadata) {
          (result.metadata as any).retryAfterMs = rateLimitResult.retryAfterMs;
        }
        await this.logSecurityEvent({
          type: 'rate_limit_exceeded',
          severity: 'medium',
          platform,
          integrationId,
          sourceIP,
          details: {
            current: rateLimitResult.current,
            limit: rateLimitResult.limit,
            resetAt: rateLimitResult.resetAt
          }
        });
        return result;
      }

      // 5. 來源驗證 (可選)
      const sourceResult = await this.verifySource(platform, sourceIP, headers);
      result.details.sourceVerified = sourceResult.valid;

      if (!sourceResult.valid) {
        result.warnings.push(`Source verification warning: ${sourceResult.warning}`);
        // 不阻擋請求，只記錄警告
      }

      // 所有檢查通過
      result.valid = true;
      return result;

    } catch (error) {
      result.errors.push(`Security validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('[WebhookSecurity] Validation error:', error);
      return result;
    }
  }

  // ======================== 簽章驗證 ========================

  /**
   * 驗證 Webhook 簽章
   */
  private async verifySignature(
    platform: IntegrationPlatform,
    integrationId: string,
    headers: Record<string, string>,
    body: string | any
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // 獲取平台憑證
      const credentials = await this.getIntegrationCredentials(integrationId);
      if (!credentials) {
        return { valid: false, error: 'Integration credentials not found' };
      }

      const bodyString = typeof body === 'string' ? body : JSON.stringify(body);

      switch (platform) {
        case 'line':
          if (!credentials.channelSecret) {
            return { valid: false, error: 'LINE channel secret not configured' };
          }
          return await this.verifyLineSignature(headers, bodyString, credentials.channelSecret);

        case 'facebook':
        case 'instagram':
          if (!credentials.appSecret) {
            return { valid: false, error: 'Facebook app secret not configured' };
          }
          return await this.verifyFacebookSignature(headers, bodyString, credentials.appSecret);

        default:
          return { valid: true }; // 其他平台暫時跳過
      }
    } catch (error) {
      return {
        valid: false,
        error: `Signature verification error: ${error instanceof Error ? error.message : 'Unknown'}`
      };
    }
  }

  /**
   * 驗證 LINE Webhook 簽章
   * Algorithm: HMAC-SHA256, Output: Base64
   */
  private async verifyLineSignature(
    headers: Record<string, string>,
    body: string,
    channelSecret: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const signature = headers['x-line-signature'] || headers['X-Line-Signature'];

      if (!signature) {
        return { valid: false, error: 'Missing X-Line-Signature header' };
      }

      if (!channelSecret) {
        return { valid: false, error: 'LINE channel secret not configured' };
      }

      // 使用 Web Crypto API 計算 HMAC-SHA256
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(channelSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(body)
      );

      // 轉換為 Base64
      const calculatedSignature = btoa(
        String.fromCharCode(...new Uint8Array(signatureBuffer))
      );

      // 時間安全比較
      const isValid = this.timingSafeEqual(calculatedSignature, signature);

      if (!isValid) {
        console.warn('[LINE Webhook] Signature mismatch', {
          expected: calculatedSignature.substring(0, 20) + '...',
          received: signature.substring(0, 20) + '...'
        });
      }

      return { valid: isValid };
    } catch (error) {
      return {
        valid: false,
        error: `LINE signature verification failed: ${error instanceof Error ? error.message : 'Unknown'}`
      };
    }
  }

  /**
   * 驗證 Facebook/Instagram Webhook 簽章
   * Algorithm: HMAC-SHA256, Output: sha256=<hex>
   */
  private async verifyFacebookSignature(
    headers: Record<string, string>,
    body: string,
    appSecret: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      const signature = headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'];

      if (!signature) {
        return { valid: false, error: 'Missing X-Hub-Signature-256 header' };
      }

      if (!appSecret) {
        return { valid: false, error: 'Facebook app secret not configured' };
      }

      // 簽章格式: sha256=<hex>
      if (!signature.startsWith('sha256=')) {
        return { valid: false, error: 'Invalid signature format (expected sha256=<hex>)' };
      }

      const signatureHash = signature.substring(7); // 移除 "sha256=" 前綴

      // 使用 Web Crypto API 計算 HMAC-SHA256
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(appSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(body)
      );

      // 轉換為 Hex
      const calculatedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // 時間安全比較
      const isValid = this.timingSafeEqual(calculatedSignature, signatureHash);

      if (!isValid) {
        console.warn('[Facebook Webhook] Signature mismatch', {
          expected: calculatedSignature.substring(0, 20) + '...',
          received: signatureHash.substring(0, 20) + '...'
        });
      }

      return { valid: isValid };
    } catch (error) {
      return {
        valid: false,
        error: `Facebook signature verification failed: ${error instanceof Error ? error.message : 'Unknown'}`
      };
    }
  }

  // ======================== 時間戳驗證 ========================

  /**
   * 驗證請求時間戳 (防重放攻擊)
   */
  private validateTimestamp(
    platform: IntegrationPlatform,
    headers: Record<string, string>,
    body: any
  ): { valid: boolean; error?: string } {
    try {
      let timestamp: number | undefined;

      // 根據平台提取時間戳
      switch (platform) {
        case 'line':
          // LINE 的時間戳在請求體的 events 中
          if (body && body.events && Array.isArray(body.events) && body.events.length > 0) {
            timestamp = body.events[0].timestamp;
          }
          break;

        case 'facebook':
        case 'instagram':
          // Facebook 的時間戳在請求體的 entry 中
          if (body && body.entry && Array.isArray(body.entry) && body.entry.length > 0) {
            const entry = body.entry[0];
            if (entry.messaging && Array.isArray(entry.messaging) && entry.messaging.length > 0) {
              timestamp = entry.messaging[0].timestamp;
            } else {
              timestamp = entry.time;
            }
          }
          break;

        default:
          // 其他平台從 headers 或 body 提取
          timestamp = parseInt(headers['x-timestamp'] || '') || body?.timestamp;
      }

      if (!timestamp) {
        // 如果沒有時間戳，只記錄警告，不阻擋
        return { valid: true };
      }

      const now = nowMs();
      const timeDiff = Math.abs(now - timestamp);

      if (timeDiff > this.TIMESTAMP_TOLERANCE_MS) {
        return {
          valid: false,
          error: `Timestamp outside tolerance window: ${timeDiff}ms (max ${this.TIMESTAMP_TOLERANCE_MS}ms)`
        };
      }

      return { valid: true };
    } catch (error) {
      // 時間戳驗證失敗不應阻擋請求
      console.warn('[WebhookSecurity] Timestamp validation error:', error);
      return { valid: true };
    }
  }

  // ======================== 重放攻擊防護 ========================

  /**
   * 檢查重放攻擊 (Request ID 去重)
   */
  private async checkReplayAttack(requestId: string): Promise<ReplayCheckResult> {
    try {
      const key = `webhook_request:${requestId}`;
      const cached = await this.cache.get(key, 'json') as {
        firstSeen: string;
        occurrences: number;
      } | null;

      if (cached) {
        // 發現重複請求
        const updated = {
          firstSeen: cached.firstSeen,
          occurrences: cached.occurrences + 1
        };

        // 更新計數
        await this.cache.put(key, JSON.stringify(updated), {
          expirationTtl: this.REQUEST_ID_TTL_SECONDS
        });

        return {
          isDuplicate: true,
          firstSeen: cached.firstSeen,
          occurrences: updated.occurrences
        };
      }

      // 首次見到此請求，記錄
      await this.cache.put(key, JSON.stringify({
        firstSeen: nowISO(),
        occurrences: 1
      }), {
        expirationTtl: this.REQUEST_ID_TTL_SECONDS
      });

      return { isDuplicate: false, occurrences: 1 };
    } catch (error) {
      console.error('[WebhookSecurity] Replay check error:', error);
      // 檢查失敗時，允許通過（避免誤殺）
      return { isDuplicate: false, occurrences: 1 };
    }
  }

  /**
   * 提取 Request ID
   */
  private extractRequestId(
    platform: IntegrationPlatform,
    headers: Record<string, string>,
    body: any
  ): string | undefined {
    // 嘗試從 headers 獲取
    const requestIdHeader = headers['x-request-id'] || headers['X-Request-Id'];
    if (requestIdHeader) {
      return requestIdHeader;
    }

    // 根據平台從 body 提取唯一標識
    switch (platform) {
      case 'line':
        if (body && body.events && Array.isArray(body.events) && body.events.length > 0) {
          // 使用 destination + timestamp + event type 作為唯一標識
          const event = body.events[0];
          return `line_${body.destination}_${event.timestamp}_${event.type}`;
        }
        break;

      case 'facebook':
      case 'instagram':
        if (body && body.entry && Array.isArray(body.entry) && body.entry.length > 0) {
          const entry = body.entry[0];
          if (entry.messaging && Array.isArray(entry.messaging) && entry.messaging.length > 0) {
            const messaging = entry.messaging[0];
            if (messaging.message && messaging.message.mid) {
              return `fb_${messaging.message.mid}`;
            }
          }
          return `fb_${entry.id}_${entry.time}`;
        }
        break;
    }

    return undefined;
  }

  // ======================== 速率限制 ========================

  /**
   * 執行速率限制檢查
   */
  private async enforceRateLimit(
    integrationId: string,
    platform: IntegrationPlatform
  ): Promise<RateLimitResult> {
    try {
      const now = nowMs();
      const windowStart = Math.floor(now / this.RATE_LIMIT_WINDOW_MS) * this.RATE_LIMIT_WINDOW_MS;

      // 整合級別速率限制
      const integrationKey = `rate_limit:integration:${integrationId}`;
      const integrationCount = await this.incrementRateLimitCounter(integrationKey, windowStart);

      if (integrationCount > this.RATE_LIMIT_PER_INTEGRATION) {
        return {
          allowed: false,
          current: integrationCount,
          limit: this.RATE_LIMIT_PER_INTEGRATION,
          resetAt: new Date(now + this.RATE_LIMIT_WINDOW_MS).toISOString(),
          retryAfterMs: this.RATE_LIMIT_WINDOW_MS
        };
      }

      // 全局級別速率限制
      const globalKey = `rate_limit:global:${platform}`;
      const globalCount = await this.incrementRateLimitCounter(globalKey, windowStart);

      if (globalCount > this.RATE_LIMIT_GLOBAL) {
        return {
          allowed: false,
          current: globalCount,
          limit: this.RATE_LIMIT_GLOBAL,
          resetAt: new Date(now + this.RATE_LIMIT_WINDOW_MS).toISOString(),
          retryAfterMs: this.RATE_LIMIT_WINDOW_MS
        };
      }

      return {
        allowed: true,
        current: integrationCount,
        limit: this.RATE_LIMIT_PER_INTEGRATION,
        resetAt: new Date(now + this.RATE_LIMIT_WINDOW_MS).toISOString()
      };
    } catch (error) {
      console.error('[WebhookSecurity] Rate limit check error:', error);
      // 失敗時允許通過（避免誤殺）
      return {
        allowed: true,
        current: 0,
        limit: this.RATE_LIMIT_PER_INTEGRATION,
        resetAt: nowISO()
      };
    }
  }

  /**
   * 增加速率限制計數器 (滑動窗口算法)
   */
  private async incrementRateLimitCounter(key: string, windowStart: number): Promise<number> {
    try {
      const cached = await this.cache.get(key, 'json') as {
        count: number;
        windowStart: number;
      } | null;

      if (cached && cached.windowStart === windowStart) {
        // 在同一個時間窗口內
        const updated = {
          count: cached.count + 1,
          windowStart
        };

        await this.cache.put(key, JSON.stringify(updated), {
          expirationTtl: Math.ceil(this.RATE_LIMIT_WINDOW_MS / 1000) + 10
        });

        return updated.count;
      }

      // 新的時間窗口
      const newData = {
        count: 1,
        windowStart
      };

      await this.cache.put(key, JSON.stringify(newData), {
        expirationTtl: Math.ceil(this.RATE_LIMIT_WINDOW_MS / 1000) + 10
      });

      return 1;
    } catch (error) {
      console.error('[WebhookSecurity] Rate limit counter error:', error);
      return 0;
    }
  }

  // ======================== 來源驗證 ========================

  /**
   * 驗證請求來源
   * P2-1: IP 白名單檢查 - IMPLEMENTED
   */
  private async verifySource(
    platform: IntegrationPlatform,
    sourceIP?: string,
    headers?: Record<string, string>
  ): Promise<{ valid: boolean; warning?: string }> {
    try {
      // P2-1: IP 白名單檢查
      if (this.IP_WHITELIST_ENABLED && sourceIP) {
        // Normalize platform for IP validation
        const platformForIP = platform === 'instagram' ? 'facebook' : platform;

        // Check if IP is in the whitelist for this platform
        const isAllowed = this.ipValidator.isAllowed(sourceIP, platformForIP);

        if (!isAllowed) {
          console.warn(`[WebhookSecurity] IP ${sourceIP} not in ${platform} whitelist - REJECTED`);
          return {
            valid: false,
            warning: `IP address ${sourceIP} not in ${platform} official IP ranges`
          };
        }

        console.log(`[WebhookSecurity] IP ${sourceIP} validated for ${platform}`);
      } else if (this.IP_WHITELIST_ENABLED && !sourceIP) {
        // IP whitelist is enabled but no IP provided - warning
        console.warn(`[WebhookSecurity] IP whitelist enabled but no source IP provided for ${platform} webhook`);
        return {
          valid: true,
          warning: 'IP whitelist enabled but source IP not available'
        };
      }

      // User-Agent 檢查 (額外驗證層)
      if (headers) {
        const userAgent = headers['user-agent'] || headers['User-Agent'] || '';

        switch (platform) {
          case 'line':
            if (!userAgent.includes('LineBotWebhook')) {
              return {
                valid: true,
                warning: 'Unexpected User-Agent for LINE webhook'
              };
            }
            break;

          case 'facebook':
          case 'instagram':
            if (!userAgent.includes('facebookplatform') && !userAgent.includes('Instagram')) {
              return {
                valid: true,
                warning: 'Unexpected User-Agent for Facebook/Instagram webhook'
              };
            }
            break;
        }
      }

      return { valid: true };
    } catch (error) {
      console.error('[WebhookSecurity] Source verification error:', error);
      // Fail open to avoid blocking legitimate traffic on errors
      return {
        valid: true,
        warning: 'Source verification encountered an error'
      };
    }
  }

  // ======================== 安全事件記錄 ========================

  /**
   * 記錄安全事件
   */
  private async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      const securityEvent: SecurityEvent = {
        id: `sec_${nowMs()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: nowISO(),
        ...event
      };

      // 記錄到 KV (快速查詢)
      const eventKey = `security_event:${securityEvent.id}`;
      await this.cache.put(eventKey, JSON.stringify(securityEvent), {
        expirationTtl: 86400 // 保留 24 小時
      });

      // 記錄到 D1 (持久化) - P2-4 IMPLEMENTED
      const dbClient = createDbClient(this.db);
      await dbClient
        .insert(webhookSecurityEvents)
        .values({
          id: securityEvent.id,
          type: securityEvent.type,
          severity: securityEvent.severity,
          platform: securityEvent.platform,
          integrationId: securityEvent.integrationId ? parseInt(securityEvent.integrationId) : null,
          sourceIp: securityEvent.sourceIP || null,
          details: JSON.stringify(securityEvent.details),
          createdAt: securityEvent.timestamp
        });

      // P2-5: 嚴重事件觸發告警系統
      if (securityEvent.severity === 'critical' || securityEvent.severity === 'high') {
        console.error('[SECURITY ALERT]', securityEvent);

        try {
          // Initialize alert service with configured channels
          const alertChannels = getDefaultAlertChannels(this.env);

          if (alertChannels.length > 0) {
            const alertService = new AlertService(alertChannels, this.env);

            // Send alert with event details
            await alertService.sendAlert(
              `Security Event: ${this.formatEventType(securityEvent.type)}`,
              this.formatAlertMessage(securityEvent),
              securityEvent.severity,
              {
                platform: securityEvent.platform,
                integrationId: securityEvent.integrationId,
                sourceIP: securityEvent.sourceIP,
                eventType: securityEvent.type,
                details: securityEvent.details,
                timestamp: securityEvent.timestamp
              }
            );

            console.log(`[WebhookSecurity] Alert sent for ${securityEvent.severity} severity event`);
          } else {
            console.warn('[WebhookSecurity] No alert channels configured, skipping alert');
          }
        } catch (alertError) {
          console.error('[WebhookSecurity] Failed to send alert:', alertError);
          // Don't throw - alert failure shouldn't prevent event logging
        }
      }

    } catch (error) {
      console.error('[WebhookSecurity] Failed to log security event:', error);
    }
  }

  /**
   * 獲取安全統計數據
   * Get security event statistics from D1
   * P2-4 IMPLEMENTED
   */
  async getSecurityStats(
    integrationId?: number,
    hours: number = 24
  ): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recentEvents: Array<{
      id: string;
      type: string;
      severity: string;
      platform: string;
      integrationId: number | null;
      sourceIp: string | null;
      details: any;
      createdAt: string;
    }>;
  }> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const dbClient = createDbClient(this.db);

      // Build query with optional integration filter
      let query = dbClient
        .select()
        .from(webhookSecurityEvents)
        .where(gte(webhookSecurityEvents.createdAt, since))
        .$dynamic();

      if (integrationId) {
        query = query.where(eq(webhookSecurityEvents.integrationId, integrationId));
      }

      const events = await query
        .orderBy(desc(webhookSecurityEvents.createdAt))
        .limit(100);

      // Calculate statistics
      const byType: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};

      events.forEach(event => {
        byType[event.type] = (byType[event.type] || 0) + 1;
        bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      });

      return {
        totalEvents: events.length,
        byType,
        bySeverity,
        recentEvents: events.slice(0, 10).map(e => ({
          id: e.id,
          type: e.type,
          severity: e.severity,
          platform: e.platform,
          integrationId: e.integrationId,
          sourceIp: e.sourceIp,
          details: e.details ? JSON.parse(e.details) : {},
          createdAt: e.createdAt
        }))
      };
    } catch (error) {
      console.error('[WebhookSecurity] Failed to get security stats:', error);
      throw error;
    }
  }

  // ======================== 輔助方法 ========================

  /**
   * 格式化事件類型為人類可讀文本
   * Format event type for human-readable alerts
   */
  private formatEventType(type: SecurityEventType): string {
    const typeLabels: Record<SecurityEventType, string> = {
      signature_verification_failed: 'Signature Verification Failed',
      timestamp_validation_failed: 'Timestamp Validation Failed',
      replay_attack_detected: 'Replay Attack Detected',
      rate_limit_exceeded: 'Rate Limit Exceeded',
      invalid_source: 'Invalid Source IP',
      malformed_request: 'Malformed Request',
      suspicious_activity: 'Suspicious Activity'
    };

    return typeLabels[type] || type;
  }

  /**
   * 格式化告警消息
   * Format alert message with event details
   */
  private formatAlertMessage(event: SecurityEvent): string {
    const messages: Record<SecurityEventType, string> = {
      signature_verification_failed: `Webhook signature verification failed for ${event.platform}. This indicates a potential spoofing attempt or misconfigured integration.`,
      timestamp_validation_failed: `Webhook timestamp validation failed for ${event.platform}. The request may be too old or the server time is out of sync.`,
      replay_attack_detected: `Potential replay attack detected for ${event.platform}. A duplicate webhook request was received.`,
      rate_limit_exceeded: `Rate limit exceeded for ${event.platform}. Too many requests received in a short period.`,
      invalid_source: `Invalid source IP detected for ${event.platform}. The request came from an IP not in the official whitelist.`,
      malformed_request: `Malformed webhook request received from ${event.platform}. The request structure is invalid.`,
      suspicious_activity: `Suspicious activity detected for ${event.platform}. Multiple security checks failed.`
    };

    let message = messages[event.type] || `Security event: ${event.type}`;

    // Add additional context if available
    if (event.details) {
      const detailsStr = Object.entries(event.details)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(', ');

      if (detailsStr) {
        message += `\n\nAdditional Details: ${detailsStr}`;
      }
    }

    return message;
  }

  /**
   * 獲取整合憑證
   */
  private async getIntegrationCredentials(
    integrationId: string
  ): Promise<{ channelSecret?: string; appSecret?: string } | null> {
    try {
      // 從 KV 快取獲取
      const cacheKey = `integration_credentials:${integrationId}`;
      const cached = await this.cache.get(cacheKey, 'json');
      if (cached) {
        return cached as any;
      }

      // 從資料庫獲取
      const query = `
        SELECT platform, credentials FROM integrations WHERE id = ? AND status = 'active'
      `;

      const result = await this.db.prepare(query).bind(integrationId).first() as {
        platform: string;
        credentials: string;
      } | null;

      if (!result) {
        return null;
      }

      // 解密憑證
      const credentials = JSON.parse(result.credentials);

      // 快取憑證
      await this.cache.put(cacheKey, JSON.stringify(credentials), {
        expirationTtl: 300 // 5 分鐘
      });

      return credentials;
    } catch (error) {
      console.error('[WebhookSecurity] Failed to get credentials:', error);
      return null;
    }
  }

  /**
   * 時間安全的字串比較 (防止 timing attack)
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  // ======================== 公共查詢方法 ========================

  /**
   * 清除速率限制計數器 (管理員功能)
   */
  async clearRateLimit(integrationId: string): Promise<boolean> {
    try {
      const key = `rate_limit:integration:${integrationId}`;
      await this.cache.delete(key);
      return true;
    } catch (error) {
      console.error('[WebhookSecurity] Failed to clear rate limit:', error);
      return false;
    }
  }
}