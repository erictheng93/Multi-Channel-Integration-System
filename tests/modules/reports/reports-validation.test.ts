import { beforeEach, describe, expect, test } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { validateRateLimit, validateRequestSize } from '@/modules/reports/middleware/reports-validation';
import { resetSimpleRateLimitStore } from '@/utils/simple-rate-limiter';

describe('Reports Validation Middleware', () => {
  let app: Hono<{ Bindings: Bindings }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Bindings }>();
    resetSimpleRateLimitStore();
  });

  describe('validateRequestSize', () => {
    beforeEach(() => {
      app.post('/reports', validateRequestSize, (c) => c.json({ success: true }));
    });

    test('allows requests within the 2MB limit', async () => {
      const response = await app.request('/reports', {
        method: 'POST',
        headers: {
          'Content-Length': '1024',
        },
        body: 'A'.repeat(1024),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ success: true });
    });

    test('rejects requests above the 2MB limit', async () => {
      const response = await app.request('/reports', {
        method: 'POST',
        headers: {
          'Content-Length': '2097153',
        },
        body: 'A',
      });

      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: 'Request size too large (max 2MB)',
      });
    });
  });

  describe('validateRateLimit', () => {
    beforeEach(() => {
      app.get('/reports', validateRateLimit, (c) => c.json({ success: true }));
    });

    test('allows requests under the reports per-minute limit', async () => {
      const response = await app.request('/reports', {
        headers: {
          'CF-Connecting-IP': '198.51.100.10',
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('30');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('29');
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
      await expect(response.json()).resolves.toEqual({ success: true });
    });

    test('rejects requests above the reports per-minute limit', async () => {
      for (let i = 0; i < 30; i += 1) {
        const response = await app.request('/reports', {
          headers: {
            'CF-Connecting-IP': '198.51.100.20',
          },
        });
        expect(response.status).toBe(200);
      }

      const response = await app.request('/reports', {
        headers: {
          'CF-Connecting-IP': '198.51.100.20',
        },
      });

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        error: 'Rate limit exceeded',
      });
    });

    test('tracks report rate limits separately per client', async () => {
      for (let i = 0; i < 30; i += 1) {
        await app.request('/reports', {
          headers: {
            'CF-Connecting-IP': '198.51.100.30',
          },
        });
      }

      const response = await app.request('/reports', {
        headers: {
          'CF-Connecting-IP': '198.51.100.31',
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('29');
    });
  });
});
