// CORS E2E æ¸¬è©¦
// æ¸¬è©¦çµ±ä? CORS ?ç½®?„å??´å???

import { describe, it, expect, beforeAll } from 'vitest';

// æ¸¬è©¦?ç½®
const BASE_URL = process.env.TEST_BASE_URL || 'https://your-api-domain.example.com';
const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || '';

// ?è¨±?„æ¸¬è©?origins
const ALLOWED_ORIGINS = [
  'https://your-api-domain.example.com',
  'https://multi-channel-platform-frontend.pages.dev',
  'https://your-frontend-domain.example.com',
];

// ä¸å?è¨±ç?æ¸¬è©¦ origins
const BLOCKED_ORIGINS = [
  'https://malicious-site.com',
  'http://suspicious-origin.example',
  'https://unknown-domain.net',
];

describe('CORS E2E Testing', () => {
  beforeAll(() => {
    if (!ADMIN_TOKEN) {
      console.warn('? ï? TEST_ADMIN_TOKEN not set. Some tests will be skipped.');
    }
  });

  describe('1. ?è¨±??Origin æ¸¬è©¦', () => {
    it('should allow requests from whitelisted origins', async () => {
      for (const origin of ALLOWED_ORIGINS) {
        const response = await fetch(`${BASE_URL}/api/system/health`, {
          method: 'GET',
          headers: {
            'Origin': origin,
          },
        });

        expect(response.ok).toBe(true);

        // æª¢æŸ¥ CORS headers
        const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
        const corsCredentials = response.headers.get('Access-Control-Allow-Credentials');

        expect(corsOrigin).toBe(origin);
        expect(corsCredentials).toBe('true');

        console.log(`??[CORS Test] Allowed origin: ${origin}`);
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

      console.log(`??[CORS Test] Cloudflare Pages preview domain allowed`);
    });
  });

  describe('2. è¢«æ?çµ•ç? Origin æ¸¬è©¦', () => {
    it('should reject requests from non-whitelisted origins', async () => {
      for (const origin of BLOCKED_ORIGINS) {
        const response = await fetch(`${BASE_URL}/api/system/health`, {
          method: 'GET',
          headers: {
            'Origin': origin,
          },
        });

        // è«‹æ??¬èº«?‰è©²?å?ï¼ˆHTTP ?€?‹ç¢¼ï¼‰ï?ä½†ä??‰æ? CORS headers
        // æ³¨æ?ï¼šç€è¦½?¨æ??»æ­¢è«‹æ?ï¼Œä??¨ä¼º?å™¨ç«¯æ¸¬è©¦ä¸­è«‹æ??ƒåˆ°??

        const corsOrigin = response.headers.get('Access-Control-Allow-Origin');

        // è¢«æ?çµ•ç? origin ä¸æ?è©²è??žè©² origin
        expect(corsOrigin).not.toBe(origin);

        console.log(`??[CORS Test] Rejected origin: ${origin}`);
      }
    });
  });

  describe('3. OPTIONS Preflight æ¸¬è©¦', () => {
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

      console.log(`??[CORS Test] OPTIONS preflight successful`);
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

      // Blocked origin ??OPTIONS è«‹æ??‰è©²è¿”å? 403 ?–ä??…å« CORS headers
      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
      expect(corsOrigin).not.toBe(origin);

      console.log(`??[CORS Test] OPTIONS blocked for unauthorized origin`);
    });
  });

  describe('4. Credentials ?¯æ´æ¸¬è©¦', () => {
    it('should support credentials for allowed origins', async () => {
      if (!ADMIN_TOKEN) {
        console.log('?­ï? Skipping credentials test (no token)');
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

      console.log(`??[CORS Test] Credentials support verified`);
    });
  });

  describe('5. SSE ç«¯é? CORS æ¸¬è©¦', () => {
    it('should handle SSE endpoints with proper CORS', async () => {
      const origin = ALLOWED_ORIGINS[0];

      // æ¸¬è©¦ SSE ç«¯é???CORS headers
      const response = await fetch(`${BASE_URL}/api/cors/health`, {
        method: 'GET',
        headers: {
          'Origin': origin,
          'Accept': 'text/event-stream',
        },
      });

      expect(response.ok).toBe(true);

      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');

      // SSE ç«¯é??‰è©²è¿”å??è¨±??origin ??wildcard
      expect(corsOrigin).toBeTruthy();

      console.log(`??[CORS Test] SSE endpoint CORS verified`);
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

      // SSE ?‰è©²?è¨±??Ž¥ï¼ˆå¯?½ä½¿??wildcardï¼‰ï?ä½†ä??¯æ´ credentials
      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
      expect(corsOrigin).toBeTruthy(); // ?¯èƒ½??'*' ?–è©² origin

      console.log(`??[CORS Test] SSE wildcard fallback verified`);
    });
  });

  describe('6. CORS ??Ž§ç«¯é?æ¸¬è©¦', () => {
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

      console.log(`??[CORS Test] CORS config endpoint accessible`);
    });

    it('should require admin for stats endpoint', async () => {
      if (!ADMIN_TOKEN) {
        console.log('?­ï? Skipping admin test (no token)');
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

      console.log(`??[CORS Test] CORS stats retrieved successfully`);
      console.log(`   Total: ${data.data.total}, Allowed: ${data.data.allowed}, Rejected: ${data.data.rejected}`);
    });

    it('should return rejected origins list for admin', async () => {
      if (!ADMIN_TOKEN) {
        console.log('?­ï? Skipping admin test (no token)');
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

      console.log(`??[CORS Test] Rejected origins list retrieved`);
      console.log(`   Rejected count: ${data.data.rejectedOrigins.length}`);
    });
  });

  describe('7. å¤šç«¯é»žä??´æ€§æ¸¬è©?, () => {
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

        console.log(`??[CORS Test] Consistent policy for ${endpoint}`);
      }
    });
  });

  describe('8. ?Šç??…æ?æ¸¬è©¦', () => {
    it('should handle missing Origin header gracefully', async () => {
      const response = await fetch(`${BASE_URL}/api/system/health`, {
        method: 'GET',
        // ä¸ç™¼??Origin header
      });

      expect(response.ok).toBe(true);

      // æ²’æ? Origin header ?‚ï?ä¸æ?è©²è¨­ç½?CORS headers
      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
      expect(corsOrigin).toBeNull();

      console.log(`??[CORS Test] Missing Origin header handled correctly`);
    });

    it('should handle empty Origin header', async () => {
      const response = await fetch(`${BASE_URL}/api/system/health`, {
        method: 'GET',
        headers: {
          'Origin': '',
        },
      });

      expect(response.ok).toBe(true);

      // Empty Origin ?‰è©²è¢«æ?çµ?
      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
      expect(corsOrigin).not.toBe('');

      console.log(`??[CORS Test] Empty Origin header handled correctly`);
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

        // è«‹æ??‰è©²è¢«è??†ï?ä½?CORS ?‰è©²?’ç?
        expect(response.ok).toBe(true);

        const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
        expect(corsOrigin).not.toBe(origin);

        console.log(`??[CORS Test] Malformed origin rejected: ${origin}`);
      }
    });
  });
});

// ?‹è?æ¸¬è©¦?„ä¸»?½æ•¸
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('?§ª Running CORS E2E Tests...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Admin Token: ${ADMIN_TOKEN ? '??Set' : '??Not set'}\n`);
}
