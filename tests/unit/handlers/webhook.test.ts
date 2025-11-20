import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Context } from 'hono';
import { webhookHandler } from '@backend/handlers/webhook';
import type { Bindings } from '@backend/types';
import { createMockContext } from '../../helpers/testUtils';
import { createMockDatabase } from '../../helpers/mockDatabase';

import { MockFactory } from '@helpers/mockFactory';
// Mock crypto API
const mockCrypto = {
  subtle: {
    importKey: vi.fn(),
    sign: vi.fn()
  }
};
global.crypto = mockCrypto as any;

// Mock UUID generation
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}));

describe('Webhook Handler Tests', () => {
  let mockContext: Context<{ Bindings: Bindings }>;
  let mockDB: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDB = createMockDatabase();
    mockContext = createMockContext({
      env: {
        DB: mockDB,
        LINE_CHANNEL_SECRET: 'line-channel-secret',
        FB_VERIFY_TOKEN: 'facebook-verify-token',
        FB_APP_SECRET: 'facebook-app-secret'
      }
    }) as Context<{ Bindings: Bindings }>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LINE Webhook Handler', () => {
    beforeEach(() => {
      // Mock successful signature verification
      mockCrypto.subtle.importKey.mockResolvedValue({});
      // Create a mock hash that matches 'valid-signature'
      const mockHashBytes = new TextEncoder().encode('valid-signature');
      const mockHashArray = new Uint8Array(32);
      mockHashArray.set(mockHashBytes.slice(0, 32));
      mockCrypto.subtle.sign.mockResolvedValue(mockHashArray.buffer);
      
      // Mock btoa function
      global.btoa = vi.fn((str) => 'valid-signature');
    });

    test('should process valid LINE webhook successfully', async () => {
      const validLinePayload = {
        events: [{
          type: 'message',
          source: { userId: 'line-user-123' },
          message: { type: 'text', text: 'Hello LINE', id: 'msg-123' },
          replyToken: 'reply-token-123'
        }]
      };

      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-signature';
        return null;
      });

      mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(validLinePayload));

      // Mock database operations
      mockDB.prepare.mockImplementation((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ 
          meta: { last_row_id: 123 },
          success: true 
        })
      }));

      const result = await webhookHandler.line(mockContext);

      expect(result.status).toBe(200);
      expect(mockDB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM customers')
      );
    });

    test('should reject LINE webhook without signature', async () => {
      mockContext.req.header = vi.fn(() => null);
      mockContext.req.text = vi.fn().mockResolvedValue('{}');

      const result = await webhookHandler.line(mockContext);

      expect(result.status).toBe(400);
    });

    test('should reject LINE webhook with invalid signature', async () => {
      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'invalid-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue('{"events":[]}');

      // Mock failed signature verification
      mockCrypto.subtle.sign.mockResolvedValue(new ArrayBuffer(32));

      const result = await webhookHandler.line(mockContext);

      expect(result.status).toBe(401);
    });

    test('should reject LINE webhook with invalid JSON', async () => {
      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue('invalid-json');

      const result = await webhookHandler.line(mockContext);

      expect(result.status).toBe(400);
    });

    test('should reject LINE webhook with payload too large', async () => {
      const largePayload = 'x'.repeat(1024 * 1024 + 1); // Over 1MB
      
      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue(largePayload);

      const result = await webhookHandler.line(mockContext);

      expect(result.status).toBe(413);
    });

    test('should reject LINE webhook with invalid payload structure', async () => {
      const invalidPayload = {
        events: [{
          type: 'message',
          // Missing source.userId
          message: { type: 'text', text: 'Hello' }
        }]
      };

      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(invalidPayload));

      const result = await webhookHandler.line(mockContext);

      expect(result.status).toBe(400);
    });

    test('should handle LINE webhook with existing user', async () => {
      const validLinePayload = {
        events: [{
          type: 'message',
          source: { userId: 'existing-user-123' },
          message: { type: 'text', text: 'Hello again', id: 'msg-456' },
          replyToken: 'reply-token-456'
        }]
      };

      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(validLinePayload));

      // Mock existing user and conversation
      let callCount = 0;
      mockDB.prepare.mockImplementation((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) { // First call for user lookup
            return Promise.resolve({ id: 456, platform_user_id: 'existing-user-123' });
          } else if (callCount === 2) { // Second call for conversation lookup
            return Promise.resolve({ id: 789 });
          }
          return Promise.resolve(null);
        }),
        run: vi.fn().mockResolvedValue({ success: true })
      }));

      const result = await webhookHandler.line(mockContext);

      expect(result.status).toBe(200);
      expect(mockDB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE conversations')
      );
    });

    test('should handle non-text message types gracefully', async () => {
      const stickerPayload = {
        events: [{
          type: 'message',
          source: { userId: 'line-user-123' },
          message: { type: 'sticker', packageId: '1', stickerId: '1', id: 'msg-sticker' },
          replyToken: 'reply-token-sticker'
        }]
      };

      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(stickerPayload));

      const result = await webhookHandler.line(mockContext);

      // Should not process non-text messages
      expect(result.status).toBe(200);
      expect(mockDB.prepare).not.toHaveBeenCalled();
    });
  });

  describe('Facebook Webhook Handler', () => {
    test('should handle Facebook webhook verification', async () => {
      mockContext.req.query = vi.fn((key) => {
        const queries: { [key: string]: string } = {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'facebook-verify-token',
          'hub.challenge': 'challenge-123'
        };
        return queries[key];
      });

      const result = await webhookHandler.facebook(mockContext);

      expect(mockContext.text).toHaveBeenCalledWith('challenge-123');
    });

    test('should reject Facebook webhook verification with invalid token', async () => {
      mockContext.req.query = vi.fn((key) => {
        const queries: { [key: string]: string } = {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'invalid-token',
          'hub.challenge': 'challenge-123'
        };
        return queries[key];
      });

      mockContext.req.json = vi.fn().mockResolvedValue({});

      const result = await webhookHandler.facebook(mockContext);

      expect(result.status).not.toBe(200);
    });

    test('should process valid Facebook webhook message', async () => {
      const validFacebookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: 'fb-user-123' },
            message: { text: 'Hello Facebook', mid: 'fb-msg-123' },
            timestamp: 1640995200000
          }]
        }]
      };

      mockContext.req.query = vi.fn(() => null); // Not a verification request
      mockContext.req.header = vi.fn(() => null);
      mockContext.req.json = vi.fn().mockResolvedValue(validFacebookPayload);

      // Mock database operations
      mockDB.prepare.mockImplementation((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ 
          meta: { last_row_id: 789 },
          success: true 
        })
      }));

      const result = await webhookHandler.facebook(mockContext);

      expect(result.status).toBe(200);
      expect(mockDB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM customers')
      );
    });

    test('should reject Facebook webhook with payload too large', async () => {
      mockContext.req.query = vi.fn(() => null);
      mockContext.req.header = vi.fn((header) => {
        if (header === 'content-length') return '1048577'; // Over 1MB
        return null;
      });

      const result = await webhookHandler.facebook(mockContext);

      expect(result.status).toBe(413);
    });

    test('should reject Facebook webhook with invalid JSON', async () => {
      mockContext.req.query = vi.fn(() => null);
      mockContext.req.header = vi.fn(() => null);
      mockContext.req.json = vi.fn().mockRejectedValue(new Error('Invalid JSON'));

      const result = await webhookHandler.facebook(mockContext);

      expect(result.status).toBe(400);
    });

    test('should reject Facebook webhook with invalid payload structure', async () => {
      const invalidPayload = {
        object: 'user', // Invalid object type
        entry: []
      };

      mockContext.req.query = vi.fn(() => null);
      mockContext.req.header = vi.fn(() => null);
      mockContext.req.json = vi.fn().mockResolvedValue(invalidPayload);

      const result = await webhookHandler.facebook(mockContext);

      expect(result.status).toBe(400);
    });

    test('should handle Facebook webhook with existing user', async () => {
      const validFacebookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: 'existing-fb-user' },
            message: { text: 'Hello again', mid: 'fb-msg-456' },
            timestamp: 1640995300000
          }]
        }]
      };

      mockContext.req.query = vi.fn(() => null);
      mockContext.req.header = vi.fn(() => null);
      mockContext.req.json = vi.fn().mockResolvedValue(validFacebookPayload);

      // Mock existing user and conversation
      let callCount = 0;
      mockDB.prepare.mockImplementation((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) { // User lookup
            return Promise.resolve({ id: 999, platform_user_id: 'existing-fb-user' });
          } else if (callCount === 2) { // Conversation lookup
            return Promise.resolve({ id: 888 });
          }
          return Promise.resolve(null);
        }),
        run: vi.fn().mockResolvedValue({ success: true })
      }));

      const result = await webhookHandler.facebook(mockContext);

      expect(result.status).toBe(200);
    });

    test('should handle Facebook webhook with multiple messaging entries', async () => {
      const multiMessagePayload = {
        object: 'page',
        entry: [{
          messaging: [
            {
              sender: { id: 'fb-user-1' },
              message: { text: 'Message 1', mid: 'msg-1' },
              timestamp: 1640995200000
            },
            {
              sender: { id: 'fb-user-2' },
              message: { text: 'Message 2', mid: 'msg-2' },
              timestamp: 1640995300000
            }
          ]
        }]
      };

      mockContext.req.query = vi.fn(() => null);
      mockContext.req.header = vi.fn(() => null);
      mockContext.req.json = vi.fn().mockResolvedValue(multiMessagePayload);

      mockDB.prepare.mockImplementation(() => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ 
          meta: { last_row_id: 100 },
          success: true 
        })
      }));

      const result = await webhookHandler.facebook(mockContext);

      expect(result.status).toBe(200);
      // Should process both messages - adjust expected call count based on actual implementation
      expect(mockDB.prepare).toHaveBeenCalled();
    });

    test('should handle Facebook webhook without messaging array', async () => {
      const noMessagingPayload = {
        object: 'page',
        entry: [{
          messaging: []
        }]
      };

      mockContext.req.query = vi.fn(() => null);
      mockContext.req.header = vi.fn(() => null);
      mockContext.req.json = vi.fn().mockResolvedValue(noMessagingPayload);

      const result = await webhookHandler.facebook(mockContext);

      expect(result.status).toBe(200);
      expect(mockDB.prepare).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully in LINE webhook', async () => {
      const validLinePayload = {
        events: [{
          type: 'message',
          source: { userId: 'line-user-error' },
          message: { type: 'text', text: 'Test error', id: 'msg-error' },
          replyToken: 'reply-token-error'
        }]
      };

      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(validLinePayload));

      mockCrypto.subtle.importKey.mockResolvedValue({});
      mockCrypto.subtle.sign.mockResolvedValue(new ArrayBuffer(32));

      // Mock database error
      mockDB.prepare.mockImplementation(() => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockRejectedValue(new Error('Database connection failed'))
      }));

      const result = await webhookHandler.line(mockContext);

      expect(result.status).toBe(500);
    });

    test('should handle database errors gracefully in Facebook webhook', async () => {
      const validFacebookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: 'fb-user-error' },
            message: { text: 'Test error', mid: 'fb-msg-error' },
            timestamp: 1640995200000
          }]
        }]
      };

      mockContext.req.query = vi.fn(() => null);
      mockContext.req.header = vi.fn(() => null);
      mockContext.req.json = vi.fn().mockResolvedValue(validFacebookPayload);

      // Mock database error
      mockDB.prepare.mockImplementation(() => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockRejectedValue(new Error('Database connection failed'))
      }));

      const result = await webhookHandler.facebook(mockContext);

      expect(result.status).toBe(500);
    });

    test('should handle crypto errors in LINE signature verification', async () => {
      // Clear the mocks from beforeEach to set up error condition
      vi.clearAllMocks();
      
      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue('{"events":[]}');

      // Mock crypto error - override the beforeEach mock
      mockCrypto.subtle.importKey.mockRejectedValue(new Error('Crypto API failed'));

      const result = await webhookHandler.line(mockContext);

      // Crypto errors are caught and return false, leading to 401 (invalid signature)
      expect(result.status).toBe(401);
    });
  });

  describe('Webhook Payload Validation', () => {
    test('should validate LINE webhook structure correctly', async () => {
      const testCases = [
        {
          payload: { events: [] },
          shouldPass: true
        },
        {
          payload: { events: [{ type: 'message', source: { userId: 'test' } }] },
          shouldPass: true
        },
        {
          payload: { events: [{ type: 'message' }] }, // Missing source
          shouldPass: false
        },
        {
          payload: {}, // Missing events
          shouldPass: false
        },
        {
          payload: { events: 'not-array' }, // Invalid events type
          shouldPass: false
        }
      ];

      for (const testCase of testCases) {
        mockContext.req.header = vi.fn((header) => {
          if (header === 'X-Line-Signature') return 'valid-signature';
          return null;
        });
        mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(testCase.payload));

        mockCrypto.subtle.importKey.mockResolvedValue({});
        mockCrypto.subtle.sign.mockResolvedValue(new ArrayBuffer(32));

        const result = await webhookHandler.line(mockContext);

        if (testCase.shouldPass) {
          expect(result.status).toBe(200);
        } else {
          expect(result.status).toBe(400);
        }
      }
    });

    test('should validate Facebook webhook structure correctly', async () => {
      const testCases = [
        {
          payload: { object: 'page', entry: [{ messaging: [] }] },
          shouldPass: true
        },
        {
          payload: { object: 'user', entry: [] }, // Invalid object
          shouldPass: false
        },
        {
          payload: { object: 'page' }, // Missing entry
          shouldPass: false
        },
        {
          payload: { object: 'page', entry: 'not-array' }, // Invalid entry type
          shouldPass: false
        },
        {
          payload: { object: 'page', entry: [{ messaging: 'not-array' }] }, // Invalid messaging type
          shouldPass: false
        }
      ];

      for (const testCase of testCases) {
        mockContext.req.query = vi.fn(() => null);
        mockContext.req.header = vi.fn(() => null);
        mockContext.req.json = vi.fn().mockResolvedValue(testCase.payload);

        const result = await webhookHandler.facebook(mockContext);

        if (testCase.shouldPass) {
          expect(result.status).toBe(200);
        } else {
          expect(result.status).toBe(400);
        }
      }
    });
  });
});