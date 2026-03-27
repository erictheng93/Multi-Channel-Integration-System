// ValidationService Unit Tests
// Pure validation logic — no external dependencies, direct instantiation

import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationService } from '@modules/delayed-message/infrastructure/ValidationService';
import { ValidationError } from '@modules/delayed-message/types';
import type { DelayedMessageRequest, DelayedMessageEntity } from '@modules/delayed-message/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidRequest(overrides: Partial<DelayedMessageRequest> = {}): DelayedMessageRequest {
  return {
    conversationId: 'conv-123',
    content: 'Hello, this is a test message',
    delaySeconds: 30,
    senderId: 'agent-456',
    recipientPlatformId: 'U1234567890',
    platform: 'line',
    ...overrides,
  };
}

function makeValidEntity(overrides: Partial<DelayedMessageEntity> = {}): DelayedMessageEntity {
  return {
    id: 'msg-001',
    conversationId: 'conv-123',
    agentId: 'agent-456',
    content: 'Test message',
    messageType: 'text',
    scheduledAt: new Date().toISOString(),
    status: 'pending',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ValidationService', () => {
  let svc: ValidationService;

  beforeEach(() => {
    svc = new ValidationService();
  });

  // -------------------------------------------------------------------------
  // validateDelaySeconds
  // -------------------------------------------------------------------------
  describe('validateDelaySeconds', () => {
    it('accepts the minimum boundary value of 1', () => {
      const result = svc.validateDelaySeconds(1);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts the maximum boundary value of 120', () => {
      const result = svc.validateDelaySeconds(120);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts a mid-range integer value', () => {
      const result = svc.validateDelaySeconds(60);
      expect(result.isValid).toBe(true);
    });

    it('rejects 0 — must be at least 1', () => {
      const result = svc.validateDelaySeconds(0);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/at least 1/i);
    });

    it('rejects negative values', () => {
      const result = svc.validateDelaySeconds(-5);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/at least 1/i);
    });

    it('rejects values above 120', () => {
      const result = svc.validateDelaySeconds(121);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/cannot exceed 120/i);
    });

    it('rejects NaN', () => {
      const result = svc.validateDelaySeconds(NaN);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/valid number/i);
    });

    it('rejects float values', () => {
      const result = svc.validateDelaySeconds(1.5);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/integer/i);
    });
  });

  // -------------------------------------------------------------------------
  // validatePlatform
  // -------------------------------------------------------------------------
  describe('validatePlatform', () => {
    it('accepts "line"', () => {
      const result = svc.validatePlatform('line');
      expect(result.isValid).toBe(true);
    });

    it('accepts "facebook"', () => {
      const result = svc.validatePlatform('facebook');
      expect(result.isValid).toBe(true);
    });

    it('rejects unknown platform', () => {
      const result = svc.validatePlatform('twitter');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/line.*facebook|facebook.*line/i);
    });

    it('rejects empty string', () => {
      const result = svc.validatePlatform('');
      expect(result.isValid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // validateMediaUrl
  // -------------------------------------------------------------------------
  describe('validateMediaUrl', () => {
    it('accepts a valid HTTPS URL', () => {
      const result = svc.validateMediaUrl('https://example.com/image.jpg');
      expect(result.isValid).toBe(true);
    });

    it('rejects HTTP URL (non-HTTPS)', () => {
      const result = svc.validateMediaUrl('http://example.com/image.jpg');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/https/i);
    });

    it('rejects a malformed URL', () => {
      const result = svc.validateMediaUrl('not-a-url-at-all');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/invalid.*url|url.*format/i);
    });

    it('rejects an empty string as malformed', () => {
      const result = svc.validateMediaUrl('');
      expect(result.isValid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // validateDelayedMessageRequest
  // -------------------------------------------------------------------------
  describe('validateDelayedMessageRequest', () => {
    it('passes for a fully valid request', () => {
      const result = svc.validateDelayedMessageRequest(makeValidRequest());
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when conversationId is missing', () => {
      const result = svc.validateDelayedMessageRequest(makeValidRequest({ conversationId: '' }));
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => /conversation id/i.test(e))).toBe(true);
    });

    it('fails when content is missing', () => {
      const result = svc.validateDelayedMessageRequest(makeValidRequest({ content: '' }));
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => /content/i.test(e))).toBe(true);
    });

    it('fails when senderId is missing', () => {
      const result = svc.validateDelayedMessageRequest(makeValidRequest({ senderId: '' }));
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => /sender id/i.test(e))).toBe(true);
    });

    it('fails when recipientPlatformId is missing', () => {
      const result = svc.validateDelayedMessageRequest(makeValidRequest({ recipientPlatformId: '' }));
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => /recipient/i.test(e))).toBe(true);
    });

    it('fails when platform is invalid', () => {
      const req = makeValidRequest({ platform: 'whatsapp' as any });
      const result = svc.validateDelayedMessageRequest(req);
      expect(result.isValid).toBe(false);
    });

    it('fails when delaySeconds is out of range', () => {
      const result = svc.validateDelayedMessageRequest(makeValidRequest({ delaySeconds: 200 }));
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => /exceed 120/i.test(e))).toBe(true);
    });

    it('accumulates multiple errors when multiple fields are invalid', () => {
      const result = svc.validateDelayedMessageRequest(makeValidRequest({ conversationId: '', senderId: '' }));
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('validates optional mediaUrl when provided — rejects HTTP', () => {
      const result = svc.validateDelayedMessageRequest(
        makeValidRequest({ mediaUrl: 'http://insecure.com/file.jpg' })
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => /https/i.test(e))).toBe(true);
    });

    it('accepts optional mediaUrl with HTTPS', () => {
      const result = svc.validateDelayedMessageRequest(
        makeValidRequest({ mediaUrl: 'https://cdn.example.com/img.png' })
      );
      expect(result.isValid).toBe(true);
    });

    it('validates optional messageType when provided — rejects unknown type', () => {
      const result = svc.validateDelayedMessageRequest(
        makeValidRequest({ messageType: 'sticker' as any })
      );
      expect(result.isValid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // validateRecallPermission
  // -------------------------------------------------------------------------
  describe('validateRecallPermission', () => {
    it('passes for valid recall by the original sender within deadline', () => {
      const recallInfo = {
        senderId: 'agent-456',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
      const result = svc.validateRecallPermission('msg-001', 'agent-456', recallInfo);
      expect(result.isValid).toBe(true);
    });

    it('fails when a different user tries to recall', () => {
      const recallInfo = {
        senderId: 'agent-456',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
      const result = svc.validateRecallPermission('msg-001', 'agent-999', recallInfo);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => /permission denied|only the sender/i.test(e))).toBe(true);
    });

    it('fails when the recall deadline has passed', () => {
      const recallInfo = {
        senderId: 'agent-456',
        expiresAt: new Date(Date.now() - 1_000).toISOString(), // 1 second in the past
      };
      const result = svc.validateRecallPermission('msg-001', 'agent-456', recallInfo);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => /deadline.*passed|passed/i.test(e))).toBe(true);
    });

    it('fails immediately when recallInfo is null', () => {
      const result = svc.validateRecallPermission('msg-001', 'agent-456', null);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => /not found|already processed/i.test(e))).toBe(true);
    });

    it('fails when messageId is missing', () => {
      const recallInfo = {
        senderId: 'agent-456',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
      const result = svc.validateRecallPermission('', 'agent-456', recallInfo);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => /message id/i.test(e))).toBe(true);
    });

    it('fails when userId is missing', () => {
      const recallInfo = {
        senderId: 'agent-456',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
      const result = svc.validateRecallPermission('msg-001', '', recallInfo);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => /user id/i.test(e))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // validateDelayedMessageEntity
  // -------------------------------------------------------------------------
  describe('validateDelayedMessageEntity', () => {
    it('passes for a fully valid entity', () => {
      const result = svc.validateDelayedMessageEntity(makeValidEntity());
      expect(result.isValid).toBe(true);
    });

    it('fails when id is missing', () => {
      const result = svc.validateDelayedMessageEntity(makeValidEntity({ id: '' }));
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => /message id/i.test(e))).toBe(true);
    });

    it('fails with invalid status', () => {
      const result = svc.validateDelayedMessageEntity(makeValidEntity({ status: 'unknown' as any }));
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => /status/i.test(e))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // validateMessageContent
  // -------------------------------------------------------------------------
  describe('validateMessageContent', () => {
    it('passes for normal content', () => {
      const result = svc.validateMessageContent('Hello world');
      expect(result.isValid).toBe(true);
    });

    it('rejects empty content', () => {
      const result = svc.validateMessageContent('');
      expect(result.isValid).toBe(false);
    });

    it('rejects content exceeding 5000 characters', () => {
      const result = svc.validateMessageContent('a'.repeat(5001));
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/5000/);
    });

    it('accepts content exactly at 5000 characters', () => {
      const result = svc.validateMessageContent('a'.repeat(5000));
      expect(result.isValid).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // validateMessageType
  // -------------------------------------------------------------------------
  describe('validateMessageType', () => {
    const validTypes = ['text', 'image', 'video', 'audio', 'file'];

    it.each(validTypes)('accepts valid type "%s"', (type) => {
      const result = svc.validateMessageType(type);
      expect(result.isValid).toBe(true);
    });

    it('rejects unknown message type', () => {
      const result = svc.validateMessageType('sticker');
      expect(result.isValid).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Custom rule registration & execution
  // -------------------------------------------------------------------------
  describe('registerRule / executeRule', () => {
    it('registers and executes a custom rule successfully', () => {
      svc.registerRule('evenNumber', {
        validate: (value: number) => ({
          isValid: value % 2 === 0,
          errors: value % 2 === 0 ? [] : ['Must be even'],
        }),
      });

      expect(svc.executeRule('evenNumber', 4).isValid).toBe(true);
      expect(svc.executeRule('evenNumber', 3).isValid).toBe(false);
    });

    it('throws ValidationError for unknown rule name', () => {
      expect(() => svc.executeRule('nonExistentRule', 'value')).toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // createValidationError
  // -------------------------------------------------------------------------
  describe('createValidationError', () => {
    it('returns a ValidationError with correct message and field', () => {
      const err = svc.createValidationError('Bad value', 'myField');
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.message).toBe('Bad value');
      expect(err.field).toBe('myField');
    });
  });

  // -------------------------------------------------------------------------
  // Default rules (uuid, email, nonEmptyString, positiveInteger)
  // -------------------------------------------------------------------------
  describe('built-in default rules', () => {
    it('uuid rule: accepts valid UUID v4', () => {
      const result = svc.executeRule('uuid', '550e8400-e29b-41d4-a716-446655440000');
      expect(result.isValid).toBe(true);
    });

    it('uuid rule: rejects non-UUID string', () => {
      const result = svc.executeRule('uuid', 'not-a-uuid');
      expect(result.isValid).toBe(false);
    });

    it('email rule: accepts valid email', () => {
      const result = svc.executeRule('email', 'user@example.com');
      expect(result.isValid).toBe(true);
    });

    it('email rule: rejects malformed email', () => {
      const result = svc.executeRule('email', 'not-an-email');
      expect(result.isValid).toBe(false);
    });

    it('nonEmptyString rule: accepts non-empty string', () => {
      const result = svc.executeRule('nonEmptyString', 'hello');
      expect(result.isValid).toBe(true);
    });

    it('nonEmptyString rule: rejects empty string', () => {
      const result = svc.executeRule('nonEmptyString', '');
      expect(result.isValid).toBe(false);
    });

    it('positiveInteger rule: accepts positive integer', () => {
      const result = svc.executeRule('positiveInteger', 5);
      expect(result.isValid).toBe(true);
    });

    it('positiveInteger rule: rejects zero', () => {
      const result = svc.executeRule('positiveInteger', 0);
      expect(result.isValid).toBe(false);
    });

    it('positiveInteger rule: rejects negative value', () => {
      const result = svc.executeRule('positiveInteger', -1);
      expect(result.isValid).toBe(false);
    });
  });
});
