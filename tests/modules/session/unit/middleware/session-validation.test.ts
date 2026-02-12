// Session 資料驗證中間件測試
// Session data validation middleware tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import {
  validateRequestSize,
  validateRateLimit,
  validateSessionId,
  validateConversationId,
  validateCreateSessionData,
  validateUpdateSessionData,
  validateSessionListQuery,
  validateSessionSearchQuery,
  validateBatchSessionOperation,
  sanitizeString,
  validateNumberRange,
  validateUUID,
  validateISODate
} from '@modules/session/middleware/session-validation';
import {
  createMockCreateSessionData,
  createMockUpdateSessionData,
  createMockBatchOperation
} from '../../helpers/session-test-helpers';
import type { Bindings } from '@shared/types';

// Mock JWT authentication
vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn((c, next) => {
    c.set('jwtPayload', {
      userId: 1,
      username: 'test-user',
      role: 'admin',
      teamId: 1
    });
    return next();
  })
}));

describe('Session Validation Middleware', () => {
  let app: Hono<{ Bindings: Bindings }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Bindings }>();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ======================== 基礎驗證函數測試 ========================

  describe('Basic Validation Functions', () => {
    describe('sanitizeString', () => {
      test('should remove dangerous characters', () => {
        const input = '<script>alert("xss")</script>Hello World';
        const result = sanitizeString(input);

        expect(result).toBe('scriptalert("xss")/scriptHello World');
        expect(result).not.toContain('<');
        expect(result).not.toContain('>');
      });

      test('should remove javascript: protocol', () => {
        const input = 'javascript:alert("hack")';
        const result = sanitizeString(input);

        expect(result).toBe('alert("hack")');
        expect(result).not.toContain('javascript:');
      });

      test('should remove event handlers', () => {
        const input = 'onclick=alert(1) Hello World';
        const result = sanitizeString(input);

        expect(result).toBe(' Hello World');
        expect(result).not.toContain('onclick=');
      });

      test('should trim whitespace and limit length', () => {
        const longInput = '  ' + 'A'.repeat(1500) + '  ';
        const result = sanitizeString(longInput);

        expect(result.length).toBeLessThanOrEqual(1000);
        expect(result.startsWith('A')).toBe(true);
        expect(result.endsWith('A')).toBe(true);
      });

      test('should handle empty and invalid input', () => {
        expect(sanitizeString('')).toBe('');
        expect(sanitizeString(null as any)).toBe('');
        expect(sanitizeString(undefined as any)).toBe('');
        expect(sanitizeString(123 as any)).toBe('');
      });
    });

    describe('validateNumberRange', () => {
      test('should validate numbers within range', () => {
        expect(validateNumberRange('5', 1, 10)).toBe(5);
        expect(validateNumberRange('1', 1, 10)).toBe(1);
        expect(validateNumberRange('10', 1, 10)).toBe(10);
      });

      test('should reject numbers outside range', () => {
        expect(validateNumberRange('0', 1, 10)).toBe(null);
        expect(validateNumberRange('11', 1, 10)).toBe(null);
        expect(validateNumberRange('-5', 1, 10)).toBe(null);
      });

      test('should handle non-numeric input', () => {
        expect(validateNumberRange('abc', 1, 10)).toBe(null);
        expect(validateNumberRange('', 1, 10)).toBe(null);
        expect(validateNumberRange(null, 1, 10)).toBe(null);
      });
    });

    describe('validateUUID', () => {
      test('should validate correct UUID format', () => {
        const validUUIDs = [
          '123e4567-e89b-12d3-a456-426614174000',
          'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
        ];

        validUUIDs.forEach(uuid => {
          expect(validateUUID(uuid)).toBe(true);
        });
      });

      test('should reject invalid UUID format', () => {
        const invalidUUIDs = [
          'not-a-uuid',
          '123e4567-e89b-12d3-a456', // Too short
          '123e4567-e89b-12d3-a456-426614174000-extra', // Too long
          '123g4567-e89b-12d3-a456-426614174000', // Invalid character
          ''
        ];

        invalidUUIDs.forEach(uuid => {
          expect(validateUUID(uuid)).toBe(false);
        });
      });
    });

    describe('validateISODate', () => {
      test('should validate correct ISO date format', () => {
        const validDates = [
          '2024-01-15T10:30:00.000Z',
          '2024-01-15T10:30:00Z',
          '2024-12-31T23:59:59.999Z'
        ];

        validDates.forEach(date => {
          expect(validateISODate(date)).toBe(true);
        });
      });

      test('should reject invalid date format', () => {
        const invalidDates = [
          '2024-01-15',
          '2024-01-15 10:30:00',
          '2024/01/15T10:30:00Z',
          'not-a-date',
          '2024-13-01T10:30:00Z', // Invalid month
          ''
        ];

        invalidDates.forEach(date => {
          expect(validateISODate(date)).toBe(false);
        });
      });
    });
  });

  // ======================== 請求大小和速率限制測試 ========================

  describe('Request Size and Rate Limiting', () => {
    describe('validateRequestSize', () => {
      beforeEach(() => {
        app.post('/test', validateRequestSize, (c) => {
          return c.json({ success: true, message: 'Request size is valid' });
        });
      });

      test('should allow requests within size limit', async () => {
        const response = await app.request('/test', {
          method: 'POST',
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
          headers: {
            'Content-Length': '1000' // 1KB
          },
          body: 'A'.repeat(1000)
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
      });

      test('should reject requests exceeding size limit', async () => {
        const response = await app.request('/test', {
          method: 'POST',
          headers: {
            'Content-Length': '2000000' // 2MB
          },
          body: 'A'.repeat(2000000)
        });

        expect(response.status).toBe(413);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Request size too large (max 1MB)');
        expect(data.timestamp).toBeDefined();
      });

      test('should allow requests without Content-Length header', async () => {
        const response = await app.request('/test', {
          method: 'POST',
          body: 'Small request'
        });

        expect(response.status).toBe(200);
      });
    });

    describe('validateRateLimit', () => {
      beforeEach(() => {
        app.get('/test', validateRateLimit, (c) => {
          return c.json({ success: true, message: 'Rate limit passed' });
        });
      });

      test('should pass through (rate limiting not implemented yet)', async () => {
        const response = await app.request('/test');

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
      });

      // TODO: Add rate limiting implementation tests when available
    });
  });

  // ======================== ID 驗證測試 ========================

  describe('ID Validation', () => {
    describe('validateSessionId', () => {
      beforeEach(() => {
        app.get('/test/:sessionId', validateSessionId, (c) => {
          const sessionId = c.get('sessionId');
          return c.json({ success: true, sessionId });
        });
      });

      test('should validate and set correct session ID', async () => {
        const sessionId = '123e4567-e89b-12d3-a456-426614174000';
        const response = await app.request(`/test/${sessionId}`);

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.sessionId).toBe(sessionId);
      });

      test('should reject invalid session ID format', async () => {
        const response = await app.request('/test/invalid-session-id');

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid session ID format');
      });

      test('should reject missing session ID', async () => {
        // 測試空字串作為 sessionId
        const response = await app.request('/test/ ');

        // 注意:當路由參數缺失時,Hono 返回 404 而非 400
        // 這是預期行為,因為路由不匹配
        expect(response.status).toBe(404);
      });
    });

    describe('validateConversationId', () => {
      beforeEach(() => {
        app.get('/test/:conversationId', validateConversationId, (c) => {
          return c.json({ success: true, message: 'Conversation ID is valid' });
        });
      });

      test('should validate correct conversation ID', async () => {
        const conversationId = '123e4567-e89b-12d3-a456-426614174000';
        const response = await app.request(`/test/${conversationId}`);

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
      });

      test('should reject invalid conversation ID', async () => {
        const response = await app.request('/test/invalid-conversation-id');

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid conversation ID format');
      });
    });
  });

  // ======================== 會話資料驗證測試 ========================

  describe('Session Data Validation', () => {
    describe('validateCreateSessionData', () => {
      beforeEach(() => {
        app.post('/test', validateCreateSessionData, (c) => {
          const createData = c.get('createSessionData');
          return c.json({ success: true, data: createData });
        });
      });

      test('should validate correct create session data', async () => {
        const validData = createMockCreateSessionData();

        const response = await app.request('/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(validData)
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.conversationId).toBe(validData.conversationId);
      });

      test('should reject missing required fields', async () => {
        const invalidData = {
          // Missing conversationId and senderType
          topic: 'Test Topic'
        };

        const response = await app.request('/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidData)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('conversationId is required');
      });

      test('should reject invalid conversation ID format', async () => {
        const invalidData = createMockCreateSessionData({
          conversationId: 'invalid-uuid'
        });

        const response = await app.request('/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidData)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid conversationId format');
      });

      test('should reject invalid sender type', async () => {
        const invalidData = createMockCreateSessionData({
          senderType: 'invalid_sender' as any
        });

        const response = await app.request('/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidData)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('senderType must be one of: customer, agent, system');
      });

      test('should reject invalid session type', async () => {
        const invalidData = createMockCreateSessionData({
          sessionType: 'invalid_type' as any
        });

        const response = await app.request('/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidData)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('sessionType must be one of: continuous, scheduled, support, marketing');
      });

      test('should sanitize and validate topic length', async () => {
        const invalidData = createMockCreateSessionData({
          topic: 'A'.repeat(300) // Too long
        });

        const response = await app.request('/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidData)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('topic cannot exceed 200 characters');
      });

      test('should validate tags array', async () => {
        const invalidData = createMockCreateSessionData({
          tags: Array(15).fill('tag') // Too many tags
        });

        const response = await app.request('/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidData)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('tags must be an array with maximum 10 items');
      });

      test('should handle malformed JSON', async () => {
        const response = await app.request('/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: 'invalid json'
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid JSON data or validation failed');
      });
    });

    describe('validateUpdateSessionData', () => {
      beforeEach(() => {
        app.put('/test', validateUpdateSessionData, (c) => {
          const updateData = c.get('updateSessionData');
          return c.json({ success: true, data: updateData });
        });
      });

      test('should validate correct update session data', async () => {
        const validData = createMockUpdateSessionData();

        const response = await app.request('/test', {
          method: 'PUT',
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(validData)
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.topic).toBe(validData.topic);
      });

      test('should reject empty update data', async () => {
        const response = await app.request('/test', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('At least one field is required for update');
      });

      test('should validate optional fields correctly', async () => {
        const validData = {
          topic: 'Updated Topic',
          isActive: false,
          endTime: '2024-01-15T15:00:00.000Z'
        };

        const response = await app.request('/test', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(validData)
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
      });

      test('should reject invalid boolean values', async () => {
        const invalidData = {
          isActive: 'not-a-boolean'
        };

        const response = await app.request('/test', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidData)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('isActive must be a boolean');
      });

      test('should validate ISO date format for endTime', async () => {
        const invalidData = {
          endTime: '2024-01-15 15:00:00' // Invalid format
        };

        const response = await app.request('/test', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidData)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('endTime must be a valid ISO date string');
      });

      test('should allow null values for optional fields', async () => {
        const validData = {
          topic: null,
          endTime: null
        };

        const response = await app.request('/test', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(validData)
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
      });
    });
  });

  // ======================== 查詢參數驗證測試 ========================

  describe('Query Parameter Validation', () => {
    describe('validateSessionListQuery', () => {
      beforeEach(() => {
        app.get('/test', validateSessionListQuery, (c) => {
          const query = c.get('sessionQuery');
          return c.json({ success: true, query });
        });
      });

      test('should validate correct query parameters', async () => {
        const queryString = 'page=2&pageSize=50&isActive=true&sessionType=support';
        const response = await app.request(`/test?${queryString}`);

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.query.page).toBe(2);
        expect(data.query.pageSize).toBe(50);
        expect(data.query.isActive).toBe(true);
        expect(data.query.sessionType).toBe('support');
      });

      test('should use default values for missing parameters', async () => {
        const response = await app.request('/test');

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.query.page).toBe(1);
        expect(data.query.pageSize).toBe(20);
      });

      test('should reject invalid page values', async () => {
        const response = await app.request('/test?page=0');

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('page must be between 1 and 1000');
      });

      test('should reject invalid pageSize values', async () => {
        const response = await app.request('/test?pageSize=200');

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('pageSize must be between 1 and 100');
      });

      test('should validate conversation ID format', async () => {
        const response = await app.request('/test?conversationId=invalid-uuid');

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid conversationId format');
      });

      test('should validate boolean parameters', async () => {
        const response = await app.request('/test?isActive=maybe');

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('isActive must be true or false');
      });

      test('should validate date parameters', async () => {
        const response = await app.request('/test?startDate=invalid-date');

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('startDate must be a valid ISO date string');
      });

      test('should sanitize string parameters', async () => {
        const response = await app.request('/test?topic=<script>alert("xss")</script>');

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.query.topic).not.toContain('<script>');
      });
    });

    describe('validateSessionSearchQuery', () => {
      beforeEach(() => {
        app.get('/search', validateSessionSearchQuery, (c) => {
          const query = c.get('sessionSearchQuery');
          return c.json({ success: true, query });
        });
      });

      test('should validate correct search query', async () => {
        const response = await app.request('/search?query=support&limit=10');

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.query.query).toBe('support');
        expect(data.query.limit).toBe(10);
      });

      test('should reject missing query parameter', async () => {
        const response = await app.request('/search');

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('query parameter is required');
      });

      test('should reject too short query', async () => {
        const response = await app.request('/search?query=a');

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('query must be at least 2 characters');
      });

      test('should validate limit parameter', async () => {
        const response = await app.request('/search?query=test&limit=200');

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('limit must be between 1 and 100');
      });

      test('should sanitize search query', async () => {
        const response = await app.request('/search?query=<script>malicious</script>');

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.query.query).not.toContain('<script>');
      });
    });
  });

  // ======================== 批量操作驗證測試 ========================

  describe('Batch Operation Validation', () => {
    describe('validateBatchSessionOperation', () => {
      beforeEach(() => {
        app.post('/batch', validateBatchSessionOperation, (c) => {
          const operation = c.get('batchOperation');
          return c.json({ success: true, operation });
        });
      });

      test('should validate correct batch operation', async () => {
        const validOperation = createMockBatchOperation();

        const response = await app.request('/batch', {
          method: 'POST',
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
        headers: { 'Authorization': 'Bearer test-token' },
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(validOperation)
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.operation.action).toBe(validOperation.action);
      });

      test('should reject missing sessionIds', async () => {
        const invalidOperation = {
          action: 'close'
        };

        const response = await app.request('/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidOperation)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('sessionIds must be a non-empty array');
      });

      test('should reject empty sessionIds array', async () => {
        const invalidOperation = {
          action: 'close',
          sessionIds: []
        };

        const response = await app.request('/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidOperation)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('sessionIds must be a non-empty array');
      });

      test('should reject too many session IDs', async () => {
        const invalidOperation = {
          action: 'close',
          sessionIds: Array(150).fill('123e4567-e89b-12d3-a456-426614174000')
        };

        const response = await app.request('/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidOperation)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Cannot process more than 100 sessions at once');
      });

      test('should validate session ID formats in batch', async () => {
        const invalidOperation = {
          action: 'close',
          sessionIds: ['123e4567-e89b-12d3-a456-426614174000', 'invalid-id']
        };

        const response = await app.request('/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidOperation)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toContain('Invalid session ID format: invalid-id');
      });

      test('should validate action types', async () => {
        const invalidOperation = {
          action: 'invalid_action',
          sessionIds: ['123e4567-e89b-12d3-a456-426614174000']
        };

        const response = await app.request('/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidOperation)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('action must be one of: close, reopen, update_priority, add_tags, remove_tags, delete');
      });

      test('should require data for operations that need it', async () => {
        const invalidOperation = {
          action: 'update_priority',
          sessionIds: ['123e4567-e89b-12d3-a456-426614174000']
          // Missing data object
        };

        const response = await app.request('/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidOperation)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('data is required for action: update_priority');
      });

      test('should validate priority data for update_priority action', async () => {
        const invalidOperation = {
          action: 'update_priority',
          sessionIds: ['123e4567-e89b-12d3-a456-426614174000'],
          data: {
            // Missing priority
          }
        };

        const response = await app.request('/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidOperation)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('priority is required in data for update_priority action');
      });

      test('should validate tags data for tag operations', async () => {
        const invalidOperation = {
          action: 'add_tags',
          sessionIds: ['123e4567-e89b-12d3-a456-426614174000'],
          data: {
            // Missing tags
          }
        };

        const response = await app.request('/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidOperation)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('tags are required in data for tag operations');
      });
    });
  });

  // ======================== 錯誤處理和邊界情況測試 ========================

  describe('Error Handling and Edge Cases', () => {
    test('should handle validation errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      app.post('/error-test', validateCreateSessionData, (c) => {
        return c.json({ success: true });
      });

      // Simulate validation error
      const response = await app.request('/error-test', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token' },
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'malformed json'
      });

      expect(response.status).toBe(400);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    test('should provide consistent error response format', async () => {
      const validationEndpoints = [
        { path: '/size-error', middleware: validateRequestSize, method: 'POST', headers: { 'Content-Length': '2000000' } },
        { path: '/session-id-error/:sessionId', middleware: validateSessionId, method: 'GET', sessionId: 'invalid' },
        { path: '/conv-id-error/:conversationId', middleware: validateConversationId, method: 'GET', sessionId: 'invalid' }
      ];

      // 在循環外先添加所有路由,避免 Hono 路由器已構建的錯誤
      for (const endpoint of validationEndpoints) {
        app[endpoint.method.toLowerCase() as 'get'](endpoint.path, endpoint.middleware, (c) => c.json({ success: true }));
      }

      // 然後測試每個端點
      for (const endpoint of validationEndpoints) {
        const path = endpoint.sessionId ? endpoint.path.replace(':sessionId', endpoint.sessionId).replace(':conversationId', endpoint.sessionId) : endpoint.path;
        const options: any = {
          method: endpoint.method
        };

        if (endpoint.headers) {
          options.headers = endpoint.headers;
          options.body = 'A'.repeat(2000000);
        }

        const response = await app.request(path, options);
        const data = await response.json();

        // All validation error responses should have consistent format
        expect(data).toHaveProperty('success', false);
        expect(data).toHaveProperty('error');
        expect(data).toHaveProperty('timestamp');
        expect(typeof data.timestamp).toBe('string');
      }
    });

    test('should handle special characters in validation', async () => {
      app.post('/special-chars', validateCreateSessionData, (c) => {
        const data = c.get('createSessionData');
        return c.json({ success: true, data });
      });

      const specialData = createMockCreateSessionData({
        topic: '🎉✨ Test Topic with Emojis 💬🤔',
        messageContent: 'Message with ñáéíóú and 中文 characters'
      });

      const response = await app.request('/special-chars', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token' },
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(specialData)
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.topic).toBeDefined();
    });

    test('should handle null and undefined values correctly', async () => {
      app.put('/null-test', validateUpdateSessionData, (c) => {
        const data = c.get('updateSessionData');
        return c.json({ success: true, data });
      });

      const nullData = {
        topic: null,
        endTime: null,
        tags: null,
        metadata: null
      };

      const response = await app.request('/null-test', {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer test-token' },
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(nullData)
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});