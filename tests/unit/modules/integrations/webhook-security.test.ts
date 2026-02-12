// Webhook 安全驗證服務單元測試
// Unit Tests for Webhook Security Service

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookSecurityService } from '@modules/integrations/services/webhook-security-service';

// Mock 環境
const createMockEnv = (): any => ({
  LINE_CHANNEL_SECRET: 'test-line-secret',
  FB_APP_SECRET: 'test-fb-secret',
  FB_VERIFY_TOKEN: 'test-verify-token'
});


  afterEach(() => {
    vi.restoreAllMocks();
  });
// Mock D1 Database
const createMockDb = (): any => ({
  prepare: vi.fn((query: string) => ({
    bind: vi.fn((...args: any[]) => ({
      first: vi.fn().mockResolvedValue({
        platform: 'line',
        credentials: JSON.stringify({
          channelSecret: 'test-secret',
          appSecret: 'test-secret'
        })
      }),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] })
    }))
  }))
});

// Mock KV Namespace
const createMockKV = (): any => {
  const store = new Map<string, any>();

  return {
    get: vi.fn(async (key: string, type?: string) => {
      const value = store.get(key);
      if (!value) return null;
      return type === 'json' ? JSON.parse(value) : value;
    }),
    put: vi.fn(async (key: string, value: string, options?: any) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    _store: store // 用於測試檢查
  };
};

describe('WebhookSecurityService', () => {
  let service: WebhookSecurityService;
  let mockEnv: any;
  let mockDb: any;
  let mockKV: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    mockKV = createMockKV();
    service = new WebhookSecurityService(mockEnv, mockDb, mockKV);
  });

  describe('LINE Webhook 簽章驗證', () => {
    test('應該驗證有效的 LINE 簽章', async () => {
      // 準備測試數據
      const secret = 'test-secret';
      const body = JSON.stringify({ events: [] });

      // 計算正確的簽章
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(body)
      );

      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

      // 執行驗證
      const result = await service.validateWebhookSecurity(
        'line',
        'test-integration-id',
        { 'X-Line-Signature': signature },
        body,
        '1.2.3.4'
      );

      expect(result.valid).toBe(true);
      expect(result.details.signatureValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('應該拒絕無效的 LINE 簽章', async () => {
      const body = JSON.stringify({ events: [] });

      const result = await service.validateWebhookSecurity(
        'line',
        'test-integration-id',
        { 'X-Line-Signature': 'invalid-signature' },
        body,
        '1.2.3.4'
      );

      expect(result.valid).toBe(false);
      expect(result.details.signatureValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Signature verification failed');
    });

    test('應該拒絕缺少簽章標頭的請求', async () => {
      const body = JSON.stringify({ events: [] });

      const result = await service.validateWebhookSecurity(
        'line',
        'test-integration-id',
        {}, // 缺少 X-Line-Signature
        body,
        '1.2.3.4'
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Missing X-Line-Signature header');
    });
  });

  describe('Facebook Webhook 簽章驗證', () => {
    test('應該驗證有效的 Facebook 簽章', async () => {
      const secret = 'test-secret';
      const body = JSON.stringify({ object: 'page', entry: [] });

      // 計算正確的簽章 (sha256=<hex>)
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(body)
      );

      const signatureHex = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const signature = `sha256=${signatureHex}`;

      // 執行驗證
      const result = await service.validateWebhookSecurity(
        'facebook',
        'test-integration-id',
        { 'X-Hub-Signature-256': signature },
        body,
        '1.2.3.4'
      );

      expect(result.valid).toBe(true);
      expect(result.details.signatureValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('應該拒絕無效的 Facebook 簽章', async () => {
      const body = JSON.stringify({ object: 'page', entry: [] });

      const result = await service.validateWebhookSecurity(
        'facebook',
        'test-integration-id',
        { 'X-Hub-Signature-256': 'sha256=invalid' },
        body,
        '1.2.3.4'
      );

      expect(result.valid).toBe(false);
      expect(result.details.signatureValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('應該拒絕格式錯誤的簽章標頭', async () => {
      const body = JSON.stringify({ object: 'page', entry: [] });

      const result = await service.validateWebhookSecurity(
        'facebook',
        'test-integration-id',
        { 'X-Hub-Signature-256': 'invalid-format' }, // 缺少 sha256= 前綴
        body,
        '1.2.3.4'
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid signature format');
    });
  });

  describe('時間戳驗證 (防重放攻擊)', () => {
    test('應該接受時間戳在容忍範圍內的請求', async () => {
      const now = Date.now();
      const body = {
        events: [{
          type: 'message',
          timestamp: now
        }]
      };

      // 模擬有效簽章
      const secret = 'test-secret';
      const bodyString = JSON.stringify(body);
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(bodyString)
      );

      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

      const result = await service.validateWebhookSecurity(
        'line',
        'test-integration-id',
        { 'X-Line-Signature': signature },
        bodyString,
        '1.2.3.4'
      );

      expect(result.details.timestampValid).toBe(true);
    });

    test('應該拒絕時間戳超出容忍範圍的請求', async () => {
      const oldTimestamp = Date.now() - (10 * 60 * 1000); // 10分鐘前
      const body = {
        events: [{
          type: 'message',
          timestamp: oldTimestamp
        }]
      };

      const secret = 'test-secret';
      const bodyString = JSON.stringify(body);
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(bodyString)
      );

      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

      const result = await service.validateWebhookSecurity(
        'line',
        'test-integration-id',
        { 'X-Line-Signature': signature },
        bodyString,
        '1.2.3.4'
      );

      expect(result.valid).toBe(false);
      expect(result.details.timestampValid).toBe(false);
      expect(result.errors.some(e => e.includes('Timestamp outside tolerance'))).toBe(true);
    });
  });

  describe('重放攻擊防護', () => {
    test('應該允許首次接收的請求', async () => {
      const requestId = 'unique-request-id-001';
      const body = {
        events: [{
          type: 'message',
          timestamp: Date.now()
        }]
      };

      const secret = 'test-secret';
      const bodyString = JSON.stringify(body);
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(bodyString)
      );

      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

      const result = await service.validateWebhookSecurity(
        'line',
        'test-integration-id',
        {
          'X-Line-Signature': signature,
          'X-Request-Id': requestId
        },
        bodyString,
        '1.2.3.4'
      );

      expect(result.details.replayCheckPassed).toBe(true);
    });

    test('應該拒絕重複的請求', async () => {
      const requestId = 'duplicate-request-id-002';
      const body = {
        events: [{
          type: 'message',
          timestamp: Date.now()
        }]
      };

      const secret = 'test-secret';
      const bodyString = JSON.stringify(body);
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(bodyString)
      );

      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

      const headers = {
        'X-Line-Signature': signature,
        'X-Request-Id': requestId
      };

      // 第一次請求
      const firstResult = await service.validateWebhookSecurity(
        'line',
        'test-integration-id',
        headers,
        bodyString,
        '1.2.3.4'
      );

      expect(firstResult.valid).toBe(true);

      // 第二次請求 (重複)
      const secondResult = await service.validateWebhookSecurity(
        'line',
        'test-integration-id',
        headers,
        bodyString,
        '1.2.3.4'
      );

      expect(secondResult.valid).toBe(false);
      expect(secondResult.details.replayCheckPassed).toBe(false);
      expect(secondResult.errors.some(e => e.includes('Duplicate request detected'))).toBe(true);
    });
  });

  describe('速率限制', () => {
    test('應該允許在速率限制內的請求', async () => {
      const body = {
        events: [{
          type: 'message',
          timestamp: Date.now()
        }]
      };

      const secret = 'test-secret';
      const bodyString = JSON.stringify(body);
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(bodyString)
      );

      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

      // 發送 5 個請求 (應該都在限制內)
      for (let i = 0; i < 5; i++) {
        const result = await service.validateWebhookSecurity(
          'line',
          `test-integration-${i}`, // 不同的整合 ID
          {
            'X-Line-Signature': signature,
            'X-Request-Id': `request-${i}`
          },
          bodyString,
          '1.2.3.4'
        );

        expect(result.details.rateLimitOk).toBe(true);
      }
    });

    test('應該阻擋超出速率限制的請求', async () => {
      const integrationId = 'test-rate-limit-integration';
      const body = {
        events: [{
          type: 'message',
          timestamp: Date.now()
        }]
      };

      const secret = 'test-secret';
      const bodyString = JSON.stringify(body);
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(bodyString)
      );

      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

      // 發送大量請求超過限制 (假設限制為 100 req/min)
      // 這裡只測試邏輯，實際上不會發送 101 個請求
      const results = [];

      for (let i = 0; i < 102; i++) {
        const result = await service.validateWebhookSecurity(
          'line',
          integrationId,
          {
            'X-Line-Signature': signature,
            'X-Request-Id': `rate-limit-request-${i}`
          },
          bodyString,
          '1.2.3.4'
        );

        results.push(result);

        // 如果被速率限制阻擋，停止測試
        if (!result.valid && result.errors.some(e => e.includes('Rate limit'))) {
          break;
        }
      }

      // 應該有一些請求被速率限制阻擋
      const blockedRequests = results.filter(r =>
        !r.valid && r.errors.some(e => e.includes('Rate limit'))
      );

      expect(blockedRequests.length).toBeGreaterThan(0);
    }, 20000); // 增加超時時間
  });

  describe('完整安全驗證流程', () => {
    test('應該通過所有安全檢查', async () => {
      // Use a service with IP whitelist disabled so sourceVerified passes
      const serviceNoIPCheck = new WebhookSecurityService(mockEnv, mockDb, mockKV, { enableIPWhitelist: false });

      const body = {
        events: [{
          type: 'message',
          timestamp: Date.now(),
          source: { userId: 'test-user' },
          message: { id: 'msg-001', type: 'text', text: 'Hello' }
        }],
        destination: 'test-destination'
      };

      const secret = 'test-secret';
      const bodyString = JSON.stringify(body);
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(bodyString)
      );

      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

      const result = await serviceNoIPCheck.validateWebhookSecurity(
        'line',
        'test-complete-validation',
        {
          'X-Line-Signature': signature,
          'X-Request-Id': 'complete-validation-001',
          'User-Agent': 'LineBotWebhook/1.0'
        },
        bodyString,
        '1.2.3.4'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details).toMatchObject({
        signatureValid: true,
        timestampValid: true,
        replayCheckPassed: true,
        rateLimitOk: true,
        sourceVerified: true
      });
    });

    test('應該返回詳細的驗證結果元數據', async () => {
      const body = {
        events: [{
          type: 'message',
          timestamp: Date.now()
        }]
      };

      const secret = 'test-secret';
      const bodyString = JSON.stringify(body);
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(bodyString)
      );

      const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

      const sourceIP = '203.0.113.42';

      const result = await service.validateWebhookSecurity(
        'line',
        'test-metadata',
        {
          'X-Line-Signature': signature,
          'X-Request-Id': 'metadata-test-001'
        },
        bodyString,
        sourceIP
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.platform).toBe('line');
      expect(result.metadata?.sourceIP).toBe(sourceIP);
      expect(result.metadata?.timestamp).toBeDefined();
      expect(result.metadata?.requestId).toBeDefined();
    });
  });

  describe('清除速率限制', () => {
    test('應該成功清除速率限制計數器', async () => {
      const integrationId = 'test-clear-rate-limit';

      const success = await service.clearRateLimit(integrationId);

      expect(success).toBe(true);
      expect(mockKV.delete).toHaveBeenCalledWith(
        `rate_limit:integration:${integrationId}`
      );
    });
  });
});