// Unit Tests for Webhook Signature Service
// 測試 webhook 簽名驗證服務

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    // Mock crypto.subtle for testing
    const originalCrypto = global.crypto;

    beforeEach(() => {
      // Reset mocks
      vi.clearAllMocks();
    });

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

    // Note: Full signature verification tests require a proper crypto environment
    // These tests verify the error handling paths
  });
});
