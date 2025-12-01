// Unit Tests for Webhook Validation Service
// 測試 webhook 驗證服務

import { describe, it, expect } from 'vitest';
import {
  validateLineWebhook,
  validateFacebookWebhook,
  validatePayloadSize,
  validateTimestamp,
  isLineWebhookBody,
  isFacebookWebhookBody
} from '../../../src/services/webhook-validation';

describe('webhook-validation', () => {
  describe('validateLineWebhook', () => {
    it('should validate a correct LINE webhook payload', () => {
      const validPayload = {
        destination: 'U1234567890abcdef',
        events: [
          {
            type: 'message',
            timestamp: Date.now(),
            source: {
              type: 'user',
              userId: 'U1234567890abcdef'
            },
            message: {
              type: 'text',
              text: 'Hello'
            }
          }
        ]
      };

      const result = validateLineWebhook(validPayload);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.eventCount).toBe(1);
    });

    it('should reject null payload', () => {
      const result = validateLineWebhook(null);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject payload without events array', () => {
      const result = validateLineWebhook({ destination: 'test' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing events array');
    });

    it('should reject payload with non-array events', () => {
      const result = validateLineWebhook({
        destination: 'test',
        events: 'not-an-array'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Events field is not an array');
    });

    it('should add warning for missing destination', () => {
      const result = validateLineWebhook({
        events: []
      });
      expect(result.valid).toBe(true); // Still valid, just with warnings
      expect(result.warnings).toContain('Missing or invalid destination field');
    });

    it('should handle empty events array', () => {
      const result = validateLineWebhook({
        destination: 'test',
        events: []
      });
      expect(result.valid).toBe(true);
      expect(result.eventCount).toBe(0);
    });
  });

  describe('validateFacebookWebhook', () => {
    it('should validate a correct Facebook webhook payload', () => {
      const validPayload = {
        object: 'page',
        entry: [
          {
            id: '123456789',
            time: Date.now(),
            messaging: [
              {
                sender: { id: 'user123' },
                recipient: { id: 'page123' },
                timestamp: Date.now(),
                message: { text: 'Hello' }
              }
            ]
          }
        ]
      };

      const result = validateFacebookWebhook(validPayload);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject payload with invalid object type', () => {
      const result = validateFacebookWebhook({
        object: 'invalid',
        entry: []
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid object type'))).toBe(true);
    });

    it('should reject payload without entry array', () => {
      const result = validateFacebookWebhook({
        object: 'page'
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing entry array');
    });

    it('should accept instagram object type', () => {
      const result = validateFacebookWebhook({
        object: 'instagram',
        entry: []
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePayloadSize', () => {
    it('should accept payload within size limit', () => {
      const result = validatePayloadSize('{"test": "data"}', 1024);
      expect(result.valid).toBe(true);
      expect(result.size).toBeLessThan(1024);
    });

    it('should reject payload exceeding size limit', () => {
      const largePayload = 'x'.repeat(2000);
      const result = validatePayloadSize(largePayload, 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
      expect(result.size).toBe(2000);
    });

    it('should use default 5MB limit if not specified', () => {
      const result = validatePayloadSize('{"test": "data"}');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateTimestamp', () => {
    it('should accept timestamp within tolerance', () => {
      const result = validateTimestamp(Date.now());
      expect(result.valid).toBe(true);
    });

    it('should reject timestamp too old', () => {
      const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const result = validateTimestamp(oldTimestamp, 5 * 60 * 1000); // 5 min tolerance
      expect(result.valid).toBe(false);
      expect(result.error).toContain('drift');
    });

    it('should reject timestamp in the future beyond tolerance', () => {
      const futureTimestamp = Date.now() + 10 * 60 * 1000; // 10 minutes in future
      const result = validateTimestamp(futureTimestamp, 5 * 60 * 1000);
      expect(result.valid).toBe(false);
    });
  });

  describe('Type Guards', () => {
    it('isLineWebhookBody should return true for valid LINE payload', () => {
      const payload = {
        destination: 'test',
        events: [
          {
            type: 'message',
            timestamp: Date.now(),
            source: { type: 'user', userId: 'test' }
          }
        ]
      };
      expect(isLineWebhookBody(payload)).toBe(true);
    });

    it('isLineWebhookBody should return false for invalid payload', () => {
      expect(isLineWebhookBody(null)).toBe(false);
      expect(isLineWebhookBody({})).toBe(false);
    });

    it('isFacebookWebhookBody should return true for valid Facebook payload', () => {
      const payload = {
        object: 'page',
        entry: [{ id: '123', time: Date.now() }]
      };
      expect(isFacebookWebhookBody(payload)).toBe(true);
    });

    it('isFacebookWebhookBody should return false for invalid payload', () => {
      expect(isFacebookWebhookBody(null)).toBe(false);
      expect(isFacebookWebhookBody({ object: 'invalid' })).toBe(false);
    });
  });
});
