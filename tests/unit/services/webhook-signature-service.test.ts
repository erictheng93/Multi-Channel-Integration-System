// Unit Tests for Webhook Signature Service
// 測試 webhook 簽名驗證服務

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  verifyWebhookSignature,
  timingSafeEqual,
  getSignatureFromHeaders
} from '../../../src/services/webhook-signature-service';

describe('webhook-signature-service', () => {
  describe('timingSafeEqual', () => {
    it('should return true for equal strings', () => {
      expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(timingSafeEqual('abc123', 'abc124')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    });

    it('should return true for empty strings', () => {
      expect(timingSafeEqual('', '')).toBe(true);
    });

    it('should handle unicode strings', () => {
      expect(timingSafeEqual('你好世界', '你好世界')).toBe(true);
      expect(timingSafeEqual('你好世界', '你好地球')).toBe(false);
    });
  });

  describe('getSignatureFromHeaders', () => {
    it('should extract LINE signature from headers', () => {
      const headers = { 'x-line-signature': 'test-signature' };
      expect(getSignatureFromHeaders('line', headers)).toBe('test-signature');
    });

    it('should extract Facebook signature from headers', () => {
      const headers = { 'x-hub-signature-256': 'sha256=test-signature' };
      expect(getSignatureFromHeaders('facebook', headers)).toBe('sha256=test-signature');
    });

    it('should handle case-insensitive headers', () => {
      const headers = { 'X-Line-Signature': 'test-signature' };
      expect(getSignatureFromHeaders('line', headers)).toBe('test-signature');
    });

    it('should return null for missing signature', () => {
      const headers = { 'content-type': 'application/json' };
      expect(getSignatureFromHeaders('line', headers)).toBe(null);
    });
  });

  describe('verifyWebhookSignature', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // tests/vitest.setup.backend.ts replaces btoa with a UTF-8 Buffer encoder, which garbles the
      // binary HMAC string; use the spec (Latin-1) behaviour that Workers has.
      vi.stubGlobal('btoa', (binary: string) => Buffer.from(binary, 'latin1').toString('base64'));
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('should return error for missing LINE signature header', async () => {
      const result = await verifyWebhookSignature(
        'line',
        '{"test": "body"}',
        {},
        'test-secret'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing');
      expect(result.platform).toBe('line');
    });

    it('should return error for missing channel secret', async () => {
      const result = await verifyWebhookSignature(
        'line',
        '{"test": "body"}',
        { 'x-line-signature': 'test-sig' },
        ''
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing');
      expect(result.platform).toBe('line');
    });

    it('should return error for missing Facebook signature header', async () => {
      const result = await verifyWebhookSignature(
        'facebook',
        '{"test": "body"}',
        {},
        'test-secret'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing');
      expect(result.platform).toBe('facebook');
    });

    it('should return error for unsupported platform', async () => {
      const result = await verifyWebhookSignature(
        'unknown' as any,
        '{"test": "body"}',
        {},
        'test-secret'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported');
    });

    // Real HMAC-SHA256 (Web Crypto in the code, node:crypto as the independent reference).
    const body = '{"destination":"U1","events":[{"type":"message","message":{"text":"你好"}}]}';
    const secret = 'channel-secret';
    const lineSig = createHmac('sha256', secret).update(body).digest('base64');
    const fbSig = createHmac('sha256', secret).update(body).digest('hex');

    it('accepts a correct LINE signature and rejects a tampered body or wrong secret', async () => {
      const ok = await verifyWebhookSignature('line', body, { 'x-line-signature': lineSig }, secret);
      expect(ok).toEqual({ valid: true, error: undefined, platform: 'line' });

      const tampered = await verifyWebhookSignature('line', body.replace('你好', 'hi'), { 'x-line-signature': lineSig }, secret);
      expect(tampered).toMatchObject({ valid: false, error: 'Invalid signature' });
      expect((await verifyWebhookSignature('line', body, { 'X-Line-Signature': lineSig }, 'other')).valid).toBe(false);
    });

    it('rejects a LINE signature sent as hex or with a sha256= prefix', async () => {
      expect((await verifyWebhookSignature('line', body, { 'x-line-signature': fbSig }, secret)).valid).toBe(false);
      expect((await verifyWebhookSignature('line', body, { 'x-line-signature': `sha256=${lineSig}` }, secret)).valid).toBe(false);
    });

    it('accepts a correct Facebook/Instagram signature with or without the sha256= prefix', async () => {
      expect((await verifyWebhookSignature('facebook', body, { 'x-hub-signature-256': `sha256=${fbSig}` }, secret)).valid).toBe(true);
      expect((await verifyWebhookSignature('instagram', body, { 'X-Hub-Signature-256': fbSig }, secret)).valid).toBe(true);
    });

    it('rejects a Facebook signature for a tampered body, a wrong secret or base64 encoding', async () => {
      const header = { 'x-hub-signature-256': `sha256=${fbSig}` };
      expect((await verifyWebhookSignature('facebook', body + ' ', header, secret)).valid).toBe(false);
      expect((await verifyWebhookSignature('facebook', body, header, 'other')).valid).toBe(false);
      expect((await verifyWebhookSignature('facebook', body, { 'x-hub-signature-256': `sha256=${lineSig}` }, secret)).valid).toBe(false);
    });

    it('returns an error for a missing Facebook app secret', async () => {
      const result = await verifyWebhookSignature('facebook', body, { 'x-hub-signature-256': `sha256=${fbSig}` }, '');
      expect(result).toMatchObject({ valid: false, error: 'Missing Facebook app secret' });
    });
  });
});
