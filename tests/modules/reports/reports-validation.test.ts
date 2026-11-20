import { beforeEach, describe, expect, test } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { sanitizeString, validateRateLimit, validateRequestSize } from '@/modules/reports/middleware/reports-validation';
import { resetSimpleRateLimitStore } from '@/utils/simple-rate-limiter';

describe('Reports Validation Middleware', () => {
  let app: Hono<{ Bindings: Bindings }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Bindings }>();
    resetSimpleRateLimitStore();
  });

  describe('sanitizeString', () => {
    test('should preserve ordinary text', () => {
      expect(sanitizeString('Customer data: Q3')).toBe('Customer data: Q3');
      expect(sanitizeString('Metadata: weekly export')).toBe('Metadata: weekly export');
      expect(sanitizeString('conversion = 12% this month')).toBe('conversion = 12% this month');
      expect(sanitizeString('Monthly report (region=TW)')).toBe('Monthly report (region=TW)');
    });

    test('should strip script schemes case-insensitively, including nested bypass', () => {
      expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)');
      expect(sanitizeString('VBScript:msgbox(1)')).toBe('msgbox(1)');
      expect(sanitizeString('jajavascript:vascript:alert(1)')).not.toContain('javascript:');
    });

    test('should strip event handlers and angle brackets, and cap at 2000', () => {
      const handler = sanitizeString('onclick=alert(1) Hello World');
      expect(handler).not.toContain('onclick');
      expect(handler).toContain('Hello World');
      expect(sanitizeString('<b>hi</b>')).toBe('bhi/b');
      expect(sanitizeString('A'.repeat(2500))).toBe('A'.repeat(2000));
    });
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
