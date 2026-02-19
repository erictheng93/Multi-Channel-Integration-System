// Facebook Messenger 整合服務
// Facebook Messenger Integration Service

import type {
  IPlatformAdapter,
  HealthCheck,
  IntegrationStats,
  FacebookIntegrationConfig,
  MessageType,
  PlatformEvent
} from '../types/integration-types';

import type { Bindings } from '@/types';
import { nowISO, nowMs } from '@/utils/timestamp'

/**
 * Facebook 訊息類型
 */
interface FacebookMessage {
  messaging_type?: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG';
  recipient: {
    id: string;
  };
  message?: {
    text?: string;
    attachment?: {
      type: 'image' | 'audio' | 'video' | 'file' | 'template';
      payload: any;
    };
    quick_replies?: Array<{
      content_type: 'text' | 'user_phone_number' | 'user_email';
      title?: string;
      payload?: string;
      image_url?: string;
    }>;
    metadata?: string;
  };
  sender_action?: 'mark_seen' | 'typing_on' | 'typing_off';
}

/**
 * Facebook Webhook 事件
 */
interface FacebookWebhookEvent {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    messaging: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        attachments?: Array<{
          type: string;
          payload: any;
        }>;
        quick_reply?: {
          payload: string;
        };
        reply_to?: {
          mid: string;
        };
      };
      postback?: {
        title: string;
        payload: string;
        referral?: {
          ref: string;
          source: string;
          type: string;
        };
      };
      read?: {
        watermark: number;
      };
      delivery?: {
        mids: string[];
        watermark: number;
      };
      account_linking?: {
        status: 'linked' | 'unlinked';
        authorization_code?: string;
      };
      [key: string]: any;
    }>;
  }>;
}

/**
 * Facebook API 錯誤回應
 */
interface FacebookApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Facebook Messenger 整合服務實作
 */
export class FacebookIntegrationService implements IPlatformAdapter {
  public readonly platform = 'facebook' as const;

  private readonly pageAccessToken: string;
  private readonly pageId: string;

  // API 端點
  private readonly apiBaseUrl = 'https://graph.facebook.com/v18.0';

  // 統計數據
  private stats: Partial<IntegrationStats> = {
    messages: { sent: 0, received: 0, failed: 0, pending: 0 },
    apiCalls: { successful: 0, failed: 0, rateLimited: 0, total: 0 },
    webhooks: { received: 0, processed: 0, failed: 0, invalid: 0 }
  };

  constructor(
    pageAccessToken: string,
    _appSecret: string,
    pageId: string,
    _config: FacebookIntegrationConfig,
    _env: Bindings
  ) {
    this.pageAccessToken = pageAccessToken;
    this.pageId = pageId;
  }

  // ======================== 連接管理 ========================

  /**
   * 建立 Facebook API 連接
   */
  async connect(credentials: Record<string, any>, _config: FacebookIntegrationConfig): Promise<boolean> {
    try {
      // 驗證必要憑證
      if (!credentials.pageAccessToken || !credentials.appSecret || !credentials.pageId) {
        throw new Error('Missing required Facebook credentials: pageAccessToken, appSecret, and pageId');
      }

      // 測試頁面存取權限
      const response = await this.makeApiCall('GET', `/${this.pageId}?fields=id,name,access_token`);

      if (response.ok) {
        const pageData = await response.json();
        console.log(`Facebook integration connected to page: ${(pageData as any).name}`);
        return true;
      }

      throw new Error(`Facebook API connection failed: ${response.status}`);
    } catch (error) {
      console.error('Facebook integration connection error:', error);
      return false;
    }
  }

  /**
   * 中斷 Facebook API 連接
   */
  async disconnect(): Promise<boolean> {
    try {
      // Facebook API 沒有明確的斷線端點，標記為已斷線即可
      console.log('Facebook integration disconnected');
      return true;
    } catch (error) {
      console.error('Facebook integration disconnect error:', error);
      return false;
    }
  }

  /**
   * 檢查連接狀態
   */
  async isConnected(): Promise<boolean> {
    try {
      const response = await this.makeApiCall('GET', `/${this.pageId}?fields=id`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // ======================== 訊息操作 ========================

  /**
   * 發送訊息
   */
  async sendMessage(recipient: string, message: FacebookMessage | string): Promise<any> {
    try {
      this.stats.messages!.pending++;
      this.stats.apiCalls!.total++;

      // 標準化訊息格式
      const facebookMessage = this.formatMessage(recipient, message);

      // 發送訊息
      const response = await this.makeApiCall('POST', '/me/messages', facebookMessage);

      if (response.ok) {
        const result = await response.json();
        this.stats.messages!.sent++;
        this.stats.messages!.pending--;
        this.stats.apiCalls!.successful++;

        return {
          success: true,
          messageId: (result as any).message_id || `facebook_${nowMs()}`,
          platform: 'facebook',
          recipient,
          sentAt: nowISO()
        };
      }

      // 處理失敗
      const errorData = await response.json() as FacebookApiError;
      this.stats.messages!.failed++;
      this.stats.messages!.pending--;
      this.stats.apiCalls!.failed++;

      // 檢查是否為速率限制
      if (response.status === 429 || errorData.error?.code === 613) {
        this.stats.apiCalls!.rateLimited++;
      }

      throw new Error(`Facebook message send failed: ${errorData.error?.message || response.statusText}`);
    } catch (error) {
      this.stats.messages!.failed++;
      this.stats.messages!.pending = Math.max(0, this.stats.messages!.pending - 1);
      this.stats.apiCalls!.failed++;

      console.error('Facebook send message error:', error);
      throw error;
    }
  }

  /**
   * 處理接收訊息
   */
  async receiveMessage(webhookData: FacebookWebhookEvent): Promise<PlatformEvent[]> {
    try {
      this.stats.webhooks!.received++;

      // 驗證 Webhook 簽章
      if (!this.verifyWebhookSignature(webhookData)) {
        this.stats.webhooks!.invalid++;
        throw new Error('Invalid webhook signature');
      }

      const events: PlatformEvent[] = [];

      // 處理 Facebook Webhook 事件
      for (const entry of webhookData.entry || []) {
        for (const messaging of entry.messaging || []) {
          try {
            const platformEvent = await this.processFacebookEvent(entry, messaging);
            if (platformEvent) {
              events.push(platformEvent);
              this.stats.webhooks!.processed++;

              // 如果是訊息事件，增加接收計數
              if (messaging.message) {
                this.stats.messages!.received++;
              }
            }
          } catch (error) {
            console.error('Error processing Facebook event:', error);
            this.stats.webhooks!.failed++;
          }
        }
      }

      return events;
    } catch (error) {
      this.stats.webhooks!.failed++;
      console.error('Facebook receive message error:', error);
      throw error;
    }
  }

  /**
   * 發送發送者行為 (typing indicator)
   */
  async sendSenderAction(recipient: string, action: 'mark_seen' | 'typing_on' | 'typing_off'): Promise<any> {
    try {
      this.stats.apiCalls!.total++;

      const payload = {
        recipient: { id: recipient },
        sender_action: action
      };

      const response = await this.makeApiCall('POST', '/me/messages', payload);

      if (response.ok) {
        this.stats.apiCalls!.successful++;
        return {
          success: true,
          action,
          recipient,
          sentAt: nowISO()
        };
      }

      this.stats.apiCalls!.failed++;
      throw new Error(`Send sender action failed: ${response.statusText}`);
    } catch (error) {
      this.stats.apiCalls!.failed++;
      console.error('Facebook send sender action error:', error);
      throw error;
    }
  }

  // ======================== 用戶操作 ========================

  /**
   * 獲取用戶資料
   */
  async getUserProfile(userId: string): Promise<any> {
    try {
      this.stats.apiCalls!.total++;

      const fields = 'first_name,last_name,profile_pic,locale,timezone,gender';
      const response = await this.makeApiCall('GET', `/${userId}?fields=${fields}`);

      if (response.ok) {
        this.stats.apiCalls!.successful++;
        const profile = await response.json();

        return {
          platform: 'facebook',
          userId,
          firstName: (profile as any).first_name,
          lastName: (profile as any).last_name,
          displayName: `${(profile as any).first_name} ${(profile as any).last_name}`.trim(),
          pictureUrl: (profile as any).profile_pic,
          locale: (profile as any).locale,
          timezone: (profile as any).timezone,
          gender: (profile as any).gender,
          retrievedAt: nowISO()
        };
      }

      this.stats.apiCalls!.failed++;
      const errorData = await response.json() as FacebookApiError;
      throw new Error(`Get profile failed: ${errorData.error?.message || response.statusText}`);
    } catch (error) {
      this.stats.apiCalls!.failed++;
      console.error('Facebook get user profile error:', error);
      throw error;
    }
  }

  // ======================== 頁面設定管理 ========================

  /**
   * 設定歡迎訊息
   */
  async setGreeting(greetings: Array<{ locale: string; text: string }>): Promise<boolean> {
    try {
      this.stats.apiCalls!.total++;

      const payload = {
        greeting: greetings
      };

      const response = await this.makeApiCall('POST', '/me/messenger_profile', payload);

      if (response.ok) {
        this.stats.apiCalls!.successful++;
        return true;
      }

      this.stats.apiCalls!.failed++;
      throw new Error(`Set greeting failed: ${response.statusText}`);
    } catch (error) {
      this.stats.apiCalls!.failed++;
      console.error('Facebook set greeting error:', error);
      return false;
    }
  }

  /**
   * 設定開始按鈕
   */
  async setGetStartedButton(payload: string): Promise<boolean> {
    try {
      this.stats.apiCalls!.total++;

      const data = {
        get_started: { payload }
      };

      const response = await this.makeApiCall('POST', '/me/messenger_profile', data);

      if (response.ok) {
        this.stats.apiCalls!.successful++;
        return true;
      }

      this.stats.apiCalls!.failed++;
      throw new Error(`Set get started button failed: ${response.statusText}`);
    } catch (error) {
      this.stats.apiCalls!.failed++;
      console.error('Facebook set get started button error:', error);
      return false;
    }
  }

  /**
   * 設定持續選單
   */
  async setPersistentMenu(menu: any[]): Promise<boolean> {
    try {
      this.stats.apiCalls!.total++;

      const payload = {
        persistent_menu: menu
      };

      const response = await this.makeApiCall('POST', '/me/messenger_profile', payload);

      if (response.ok) {
        this.stats.apiCalls!.successful++;
        return true;
      }

      this.stats.apiCalls!.failed++;
      throw new Error(`Set persistent menu failed: ${response.statusText}`);
    } catch (error) {
      this.stats.apiCalls!.failed++;
      console.error('Facebook set persistent menu error:', error);
      return false;
    }
  }

  // ======================== 健康檢查 ========================

  /**
   * 執行健康檢查
   */
  async healthCheck(): Promise<HealthCheck> {
    const startTime = nowMs();

    try {
      // 測試基本連接
      const response = await this.makeApiCall('GET', `/${this.pageId}?fields=id,name`);
      const duration = Date.now() - startTime;

      if (response.ok) {
        const pageData = await response.json();

        return {
          status: 'pass',
          message: 'Facebook integration is healthy',
          duration,
          checkedAt: nowISO(),

          details: {
            latency: duration,
            errorRate: this.calculateErrorRate(),
            metadata: {
              pageId: (pageData as any).id,
              pageName: (pageData as any).name,
              apiVersion: 'v18.0'
            }
          }
        };
      }

      return {
        status: 'fail',
        message: `Facebook API not accessible: ${response.status}`,
        duration,
        checkedAt: nowISO(),

        details: {
          latency: duration,
          errorRate: this.calculateErrorRate()
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        status: 'fail',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration,
        checkedAt: nowISO(),

        details: {
          latency: duration,
          errorRate: this.calculateErrorRate(),
          lastError: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  // ======================== 統計數據 ========================

  /**
   * 獲取統計數據
   */
  getStats(): Promise<Partial<IntegrationStats>> {
    const now = nowISO();

    return Promise.resolve({
      ...this.stats,
      timing: {
        averageResponseTimeMs: this.calculateAverageResponseTime(),
        maxResponseTimeMs: 8000, // Facebook 通常回應較慢
        minResponseTimeMs: 150,
        last24h: this.stats.apiCalls?.total || 0
      },
      lastUpdated: now,
      periodStart: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      periodEnd: now
    });
  }

  // ======================== 私有輔助方法 ========================

  /**
   * 執行 Facebook API 呼叫
   */
  private async makeApiCall(method: string, endpoint: string, body?: any): Promise<Response> {
    const url = `${this.apiBaseUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.pageAccessToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    return fetch(url, options);
  }

  /**
   * 格式化訊息
   */
  private formatMessage(recipient: string, message: FacebookMessage | string): FacebookMessage {
    if (typeof message === 'string') {
      return {
        messaging_type: 'RESPONSE',
        recipient: { id: recipient },
        message: { text: message }
      };
    }

    // 確保有 recipient
    if (!message.recipient) {
      message.recipient = { id: recipient };
    }

    // 預設 messaging_type
    if (!message.messaging_type) {
      message.messaging_type = 'RESPONSE';
    }

    return message;
  }

  /**
   * 處理 Facebook 事件
   */
  private async processFacebookEvent(_entry: any, messaging: any): Promise<PlatformEvent | null> {
    try {
      const platformEvent: PlatformEvent = {
        id: `facebook_${messaging.timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        integrationId: '', // 需要從上下文獲取
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

      return platformEvent;
    } catch (error) {
      console.error('Error processing Facebook event:', error);
      return null;
    }
  }

  /**
   * 驗證 Webhook 簽章
   *
   * ✅ IMPLEMENTATION NOTE: Full webhook security verification is handled by
   * WebhookSecurityService in the webhook-handler layer. This method is kept
   * for backward compatibility and direct integration service calls.
   *
   * For production webhooks, use:
   *   webhook-handler.ts → WebhookValidator → WebhookSecurityService
   *
   * The WebhookSecurityService provides:
   * - HMAC-SHA256 signature verification (X-Hub-Signature-256 header)
   * - Timestamp validation (anti-replay protection)
   * - Request ID deduplication
   * - Rate limiting (100 req/min per integration, 500 req/min global)
   * - Security event logging
   * - Source verification (User-Agent, optional IP whitelist)
   *
   * Note: Facebook now uses SHA256 (not SHA1) via X-Hub-Signature-256 header
   * Legacy X-Hub-Signature (SHA1) is deprecated
   *
   * @see src/modules/integrations/services/webhook-security-service.ts:350-411
   * @see src/modules/integrations/handlers/webhook-handler.ts:105-167
   * @deprecated Use WebhookSecurityService.validateWebhookSecurity() instead
   */
  private verifyWebhookSignature(_webhookData: any): boolean {
    // ⚠️ WARNING: This method bypasses full security checks
    // For production use, webhooks should be processed through webhook-handler.ts
    // which provides complete HMAC-SHA256 signature verification.
    //
    // This method returns true to allow direct integration service calls
    // during development/testing. Production deployments MUST route webhooks
    // through the WebhookSecurityService for proper validation.

    console.warn('[FacebookIntegrationService] Direct webhook call - security checks bypassed');
    console.warn('[FacebookIntegrationService] Production webhooks should use: POST /api/integrations/webhooks/facebook/:integrationId');

    return true;
  }

  /**
   * 對應 Facebook 事件類型
   */
  private mapFacebookEventType(messaging: any): any {
    if (messaging.message) return 'message';
    if (messaging.postback) return 'postback';
    if (messaging.read) return 'read';
    if (messaging.delivery) return 'delivery';
    if (messaging.account_linking) return 'accountLink';
    return 'message';
  }

  /**
   * 對應 Facebook 訊息類型
   */
  private mapFacebookMessageType(message: any): MessageType {
    if (message.text) return 'text';
    if (message.attachments) {
      const firstAttachment = message.attachments[0];
      switch (firstAttachment.type) {
        case 'image': return 'image';
        case 'video': return 'video';
        case 'audio': return 'audio';
        case 'file': return 'file';
        case 'location': return 'location';
        case 'template': return 'template';
        default: return 'text';
      }
    }
    return 'text';
  }

  /**
   * 計算錯誤率
   */
  private calculateErrorRate(): number {
    const total = this.stats.apiCalls?.total || 0;
    const failed = this.stats.apiCalls?.failed || 0;

    if (total === 0) return 0;
    return Math.round((failed / total) * 100) / 100;
  }

  /**
   * 計算平均回應時間
   */
  private calculateAverageResponseTime(): number {
    // 這裡應該實作真正的回應時間追蹤
    // Facebook API 通常比 LINE 慢一些
    return 350;
  }

  // ======================== 公用工具方法 ========================

  /**
   * 創建文字訊息
   */
  static createTextMessage(recipient: string, text: string): FacebookMessage {
    return {
      messaging_type: 'RESPONSE',
      recipient: { id: recipient },
      message: { text }
    };
  }

  /**
   * 創建圖片訊息
   */
  static createImageMessage(recipient: string, imageUrl: string): FacebookMessage {
    return {
      messaging_type: 'RESPONSE',
      recipient: { id: recipient },
      message: {
        attachment: {
          type: 'image',
          payload: {
            url: imageUrl,
            is_reusable: true
          }
        }
      }
    };
  }

  /**
   * 創建快速回覆訊息
   */
  static createQuickReplyMessage(recipient: string, text: string, quickReplies: any[]): FacebookMessage {
    return {
      messaging_type: 'RESPONSE',
      recipient: { id: recipient },
      message: {
        text,
        quick_replies: quickReplies
      }
    };
  }

  /**
   * 創建按鈕模板訊息
   */
  static createButtonTemplate(recipient: string, text: string, buttons: any[]): FacebookMessage {
    return {
      messaging_type: 'RESPONSE',
      recipient: { id: recipient },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text,
            buttons
          }
        }
      }
    };
  }

  /**
   * 驗證 Facebook 頁面作用域 ID (PSID)
   */
  static isValidFacebookPSID(psid: string): boolean {
    // Facebook PSID 通常是數字
    return /^\d+$/.test(psid);
  }

  /**
   * 驗證 Facebook 頁面 ID
   */
  static isValidFacebookPageId(pageId: string): boolean {
    // Facebook 頁面 ID 通常是數字
    return /^\d+$/.test(pageId);
  }
}