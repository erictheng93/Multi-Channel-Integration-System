// CORS E2E 測試
// 測試統一 CORS 配置的完整功能

import { describe, it, expect, beforeAll } from 'vitest';

// 測試配置
const BASE_URL = process.env.TEST_BASE_URL || 'https://multi-channel.imfinethankyouandyou.com';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || '';

// 允許的測試 origins
const ALLOWED_ORIGINS = [
  'https://multi-channel.imfinethankyouandyou.com',
  'https://multi-channel-platform-frontend.pages.dev',
  'https://mcp.imfinethankyouandyou.com',
];

// 不允許的測試 origins
const BLOCKED_ORIGINS = [
  'https://malicious-site.com',
  'http://suspicious-origin.example',
  'https://unknown-domain.net',
];

describe('CORS E2E Testing', () => {
  beforeAll(() => {
    if (!ADMIN_TOKEN) {
      console.warn('⚠️ TEST_ADMIN_TOKEN not set. Some tests will be skipped.');
    }
  });

  describe('1. 允許的 Origin 測試', () => {
    it('should allow requests from whitelisted origins', async () => {
      for (const origin of ALLOWED_ORIGINS) {
        const response = await fetch(`${BASE_URL}/api/system/health`, {
          method: 'GET',
          headers: {
            'Origin': origin,
          },
        });

        expect(response.ok).toBe(true);

        // 檢查 CORS headers
        const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
        const corsCredentials = response.headers.get('Access-Control-Allow-Credentials');

        expect(corsOrigin).toBe(origin);
        expect(corsCredentials).toBe('true');

        console.log(`✅ [CORS Test] Allowed origin: ${origin}`);
      }
    });

    it('should handle Cloudflare Pages preview domains', async () => {
      const previewOrigin = 'https://abc123.multi-channel-platform-frontend.pages.dev';

      const response = await fetch(`${BASE_URL}/api/system/health`, {
        method: 'GET',
        headers: {
          'Origin': previewOrigin,
        },
      });

      expect(response.ok).toBe(true);

      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
      const corsCredentials = response.headers.get('Access-Control-Allow-Credentials');

      expect(corsOrigin).toBe(previewOrigin);
      expect(corsCredentials).toBe('true');

      console.log(`✅ [CORS Test] Cloudflare Pages preview domain allowed`);
    });
  });

  describe('2. 被拒絕的 Origin 測試', () => {
    it('should reject requests from non-whitelisted origins', async () => {
      for (const origin of BLOCKED_ORIGINS) {
        const response = await fetch(`${BASE_URL}/api/system/health`, {
          method: 'GET',
          headers: {
            'Origin': origin,
          },
        });

        // 請求本身應該成功（HTTP 狀態碼），但不應有 CORS headers
        // 注意：瀏覽器會阻止請求，但在伺服器端測試中請求會到達

        const corsOrigin = response.headers.get('Access-Control-Allow-Origin');

        // 被拒絕的 origin 不應該返回該 origin
        expect(corsOrigin).not.toBe(origin);

        console.log(`✅ [CORS Test] Rejected origin: ${origin}`);
      }
    });
  });

  describe('3. OPTIONS Preflight 測試', () => {
    it('should handle OPTIONS preflight requests correctly', async () => {
      const origin = ALLOWED_ORIGINS[0];

      const response = await fetch(`${BASE_URL}/api/conversations`, {
        method: 'OPTIONS',
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,Authorization',
        },
      });

      expect(response.status).toBe(204);

      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
      const corsMethods = response.headers.get('Access-Control-Allow-Methods');
      const corsHeaders = response.headers.get('Access-Control-Allow-Headers');
      const corsMaxAge = response.headers.get('Access-Control-Max-Age');

      expect(corsOrigin).toBe(origin);
      expect(corsMethods).toContain('GET');
      expect(corsMethods).toContain('POST');
      expect(corsHeaders).toContain('Content-Type');
      expect(corsHeaders).toContain('Authorization');
      expect(corsMaxAge).toBe('86400'); // 24 hours

      console.log(`✅ [CORS Test] OPTIONS preflight successful`);
    });

    it('should reject OPTIONS from blocked origins', async () => {
      const origin = BLOCKED_ORIGINS[0];

      const response = await fetch(`${BASE_URL}/api/conversations`, {
        method: 'OPTIONS',
        headers: {
          'Origin': origin,
          'Access-Control-Request-Method': 'POST',
        },
      });

      // Blocked origin 的 OPTIONS 請求應該返回 403 或不包含 CORS headers
      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
      expect(corsOrigin).not.toBe(origin);

      console.log(`✅ [CORS Test] OPTIONS blocked for unauthorized origin`);
    });
  });

  describe('4. Credentials 支援測試', () => {
    it('should support credentials for allowed origins', async () => {
      if (!ADMIN_TOKEN) {
        console.log('⏭️ Skipping credentials test (no token)');
        return;
      }

      const origin = ALLOWED_ORIGINS[0];

      const response = await fetch(`${BASE_URL}/api/conversations`, {
        method: 'GET',
        headers: {
          'Origin': origin,
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
        },
        credentials: 'include',
      });

      expect(response.ok).toBe(true);

      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
      const corsCredentials = response.headers.get('Access-Control-Allow-Credentials');

      expect(corsOrigin).toBe(origin);
      expect(corsCredentials).toBe('true');

      console.log(`✅ [CORS Test] Credentials support verified`);
    });
  });

  describe('5. SSE 端點 CORS 測試', () => {
    it('should handle SSE endpoints with proper CORS', async () => {
      const origin = ALLOWED_ORIGINS[0];

      // 測試 SSE 端點的 CORS headers
      const response = await fetch(`${BASE_URL}/api/cors/health`, {
        method: 'GET',
        headers: {
          'Origin': origin,
          'Accept': 'text/event-stream',
        },
      });

      expect(response.ok).toBe(true);

      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');

      // SSE 端點應該返回允許的 origin 或 wildcard
      expect(corsOrigin).toBeTruthy();

      console.log(`✅ [CORS Test] SSE endpoint CORS verified`);
    });

    it('should use wildcard for unknown origins in SSE', async () => {
      const unknownOrigin = 'https://unknown-sse-client.example';

      const response = await fetch(`${BASE_URL}/api/cors/health`, {
        method: 'GET',
        headers: {
          'Origin': unknownOrigin,
          'Accept': 'text/event-stream',
        },
      });

      expect(response.ok).toBe(true);

      // SSE 應該允許連接（可能使用 wildcard），但不支援 credentials
      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
      expect(corsOrigin).toBeTruthy(); // 可能是 '*' 或該 origin

      console.log(`✅ [CORS Test] SSE wildcard fallback verified`);
    });
  });

  describe('6. CORS 監控端點測試', () => {
    it('should access CORS config endpoint without auth', async () => {
      const response = await fetch(`${BASE_URL}/api/cors/config`, {
        method: 'GET',
        headers: {
          'Origin': ALLOWED_ORIGINS[0],
        },
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.allowedOrigins).toBeDefined();
      expect(Array.isArray(data.data.allowedOrigins)).toBe(true);

      console.log(`✅ [CORS Test] CORS config endpoint accessible`);
    });

    it('should require admin for stats endpoint', async () => {
      if (!ADMIN_TOKEN) {
        console.log('⏭️ Skipping admin test (no token)');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/cors/stats`, {
        method: 'GET',
        headers: {
          'Origin': ALLOWED_ORIGINS[0],
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
        },
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.total).toBeDefined();
      expect(data.data.allowed).toBeDefined();
      expect(data.data.rejected).toBeDefined();

      console.log(`✅ [CORS Test] CORS stats retrieved successfully`);
      console.log(`   Total: ${data.data.total}, Allowed: ${data.data.allowed}, Rejected: ${data.data.rejected}`);
    });

    it('should return rejected origins list for admin', async () => {
      if (!ADMIN_TOKEN) {
        console.log('⏭️ Skipping admin test (no token)');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/cors/rejected-origins`, {
        method: 'GET',
        headers: {
          'Origin': ALLOWED_ORIGINS[0],
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
        },
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.rejectedOrigins).toBeDefined();
      expect(Array.isArray(data.data.rejectedOrigins)).toBe(true);

      console.log(`✅ [CORS Test] Rejected origins list retrieved`);
      console.log(`   Rejected count: ${data.data.rejectedOrigins.length}`);
    });
  });

  describe('7. 多端點一致性測試', () => {
    const endpoints = [
      '/api/system/health',
      '/api/cors/health',
      '/api/cors/config',
    ];

    it('should apply same CORS policy across all endpoints', async () => {
      const origin = ALLOWED_ORIGINS[0];

      for (const endpoint of endpoints) {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
          method: 'GET',
          headers: {
            'Origin': origin,
          },
        });

        expect(response.ok).toBe(true);

        const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
        expect(corsOrigin).toBe(origin);

        console.log(`✅ [CORS Test] Consistent policy for ${endpoint}`);
      }
    });
  });

  describe('8. 邊界情況測試', () => {
    it('should handle missing Origin header gracefully', async () => {
      const response = await fetch(`${BASE_URL}/api/system/health`, {
        method: 'GET',
        // 不發送 Origin header
      });

      expect(response.ok).toBe(true);

      // 沒有 Origin header 時，不應該設置 CORS headers
      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
      expect(corsOrigin).toBeNull();

      console.log(`✅ [CORS Test] Missing Origin header handled correctly`);
    });

    it('should handle empty Origin header', async () => {
      const response = await fetch(`${BASE_URL}/api/system/health`, {
        method: 'GET',
        headers: {
          'Origin': '',
        },
      });

      expect(response.ok).toBe(true);

      // Empty Origin 應該被拒絕
      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
      expect(corsOrigin).not.toBe('');

      console.log(`✅ [CORS Test] Empty Origin header handled correctly`);
    });

    it('should handle malformed Origin header', async () => {
      const malformedOrigins = [
        'not-a-url',
        'ftp://invalid-protocol.com',
        'javascript:alert(1)',
      ];

      for (const origin of malformedOrigins) {
        const response = await fetch(`${BASE_URL}/api/system/health`, {
          method: 'GET',
          headers: {
            'Origin': origin,
          },
        });

        // 請求應該被處理，但 CORS 應該拒絕
        expect(response.ok).toBe(true);

        const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
        expect(corsOrigin).not.toBe(origin);

        console.log(`✅ [CORS Test] Malformed origin rejected: ${origin}`);
      }
    });
  });
});

// 運行測試的主函數
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 Running CORS E2E Tests...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Admin Token: ${ADMIN_TOKEN ? '✅ Set' : '❌ Not set'}\n`);
}
