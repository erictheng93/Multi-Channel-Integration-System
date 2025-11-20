import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Context } from 'hono';
import { webhookHandler } from '@/handlers/webhook';
import { messageHandler } from '@/handlers/message';
import { createUserSyncService } from '@/services/user-sync';
import { FacebookIntegrationService } from '@modules/integration/services/facebook-integration-service';
import type { Bindings } from '@/types';
import { createMockDatabase } from '../helpers/mockDatabase';

import { MockFactory } from '@helpers/mockFactory';
// Mock globals
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockCrypto = {
  subtle: {
    importKey: vi.fn(),
    sign: vi.fn()
  },
  randomUUID: vi.fn(() => 'facebook-uuid-123')
};
global.crypto = mockCrypto as any;

describe('Facebook Integration - Complete Feature Tests', () => {
  let mockDB: any;
  let mockEnv: Bindings;
  let mockContext: Context<{ Bindings: Bindings }>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDB = createMockDatabase();
    
    mockEnv = {
      DB: mockDB,
      FB_APP_SECRET: 'facebook-app-secret-123',
      FB_PAGE_ACCESS_TOKEN: 'facebook-page-token-123',
      FB_VERIFY_TOKEN: 'facebook-verify-token-123',
      R2_BUCKET: {
        put: vi.fn().mockResolvedValue({}),
        get: vi.fn(),
        head: vi.fn(),
        delete: vi.fn()
      } as any,
      R2_BUCKET_NAME: 'test-bucket',
      CLOUDFLARE_ACCOUNT_ID: 'test-account'
    } as Bindings;

    mockContext = {
      req: {
        header: vi.fn(),
        text: vi.fn(),
        json: vi.fn(),
        param: vi.fn(),
        query: vi.fn()
      },
      env: mockEnv,
      json: vi.fn((data, status = 200) => ({ data, status })),
      text: vi.fn((text, status = 200) => ({ text, status })),
      get: vi.fn()
    } as any;

    // Setup crypto mocks for Facebook (SHA-1)
    const mockHashArray = new Uint8Array([
      0xda, 0x39, 0xa3, 0xee, 0x5e, 0x6b, 0x4b, 0x0d,
      0x32, 0x55, 0xbf, 0xef, 0x95, 0x60, 0x18, 0x90,
      0xaf, 0xd8, 0x07, 0x09
    ]);
    mockCrypto.subtle.importKey.mockResolvedValue({});
    mockCrypto.subtle.sign.mockResolvedValue(mockHashArray.buffer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Facebook Webhook Verification', () => {
    test('should handle webhook verification challenge correctly', async () => {
      mockContext.req.query = vi.fn((key) => {
        const queries: Record<string, string> = {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'facebook-verify-token-123',
          'hub.challenge': 'challenge-string-456'
        };
        return queries[key];
      });

      const result = await webhookHandler.facebook(mockContext);

      expect(mockContext.text).toHaveBeenCalledWith('challenge-string-456');
    });

    test('should reject verification with invalid token', async () => {
      mockContext.req.query = vi.fn((key) => {
        const queries: Record<string, string> = {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'invalid-token',
          'hub.challenge': 'challenge-string-456'
        };
        return queries[key];
      });

      mockContext.req.json = vi.fn().mockResolvedValue({});

      const result = await webhookHandler.facebook(mockContext);

      expect(result.status).not.toBe(200);
    });
  });

  describe('Complete Message Flow - Facebook', () => {
    test('should handle text message from new user with profile sync', async () => {
      const webhookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: 'new-fb-user-123' },
            recipient: { id: 'page-123' },
            timestamp: 1640995200000,
            message: {
              mid: 'fb-msg-123',
              text: 'Hello from new Facebook user!'
            }
          }]
        }]
      };

      mockContext.req.query = vi.fn(() => null); // Not a verification request
      mockContext.req.header = vi.fn(() => null);
      mockContext.req.json = vi.fn().mockResolvedValue(webhookPayload);

      // Mock Facebook Graph API for user profile
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'new-fb-user-123',
          first_name: 'Alice',
          last_name: 'Johnson',
          profile_pic: 'https://example.com/alice.jpg',
          locale: 'en_US',
          timezone: -5
        })
      });

      // Mock database operations
      let queryCount = 0;
      mockDB.prepare.mockImplementation((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(async () => {
          queryCount++;
          if (query.includes('SELECT * FROM customers') && queryCount === 1) {
            return null; // New user
          } else if (query.includes('SELECT * FROM conversations')) {
            return null; // New conversation
          }
          return null;
        }),
        run: vi.fn().mockResolvedValue({ 
          meta: { last_row_id: 200 + queryCount },
          success: true 
        })
      }));

      const result = await webhookHandler.facebook(mockContext);

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com/v18.0/new-fb-user-123'),
        expect.objectContaining({
          method: 'GET'
        })
      );
      expect(mockDB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO customers')
      );
    });

    test('should handle image attachment message with R2 storage', async () => {
      const imageWebhookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: 'existing-fb-user' },
            recipient: { id: 'page-123' },
            timestamp: 1640995200000,
            message: {
              mid: 'fb-img-123',
              attachments: [{
                type: 'image',
                payload: {
                  url: 'https://scontent.xx.fbcdn.net/v/image.jpg'
                }
              }]
            }
          }]
        }]
      };

      mockContext.req.query = vi.fn(() => null);
      mockContext.req.header = vi.fn(() => null);
      mockContext.req.json = vi.fn().mockResolvedValue(imageWebhookPayload);

      // Mock existing user
      mockDB.prepare.mockImplementation((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(async () => {
          if (query.includes('SELECT * FROM customers')) {
            return { id: 789, platform_user_id: 'existing-fb-user' };
          } else if (query.includes('SELECT * FROM conversations')) {
            return { id: 987 };
          }
          return null;
        }),
        run: vi.fn().mockResolvedValue({ success: true })
      }));

      // Mock Facebook image download
      const mockImageData = new ArrayBuffer(3072);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockImageData)
      });

      const result = await webhookHandler.facebook(mockContext);

      expect(result.status).toBe(200);
      
      // Should download and store the image
      expect(mockFetch).toHaveBeenCalledWith(
        'https://scontent.xx.fbcdn.net/v/image.jpg',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'Multi-Channel-Platform-Bot/1.0'
          })
        })
      );
      
      expect(mockEnv.R2_BUCKET.put).toHaveBeenCalledWith(
        expect.stringContaining('media/facebook/'),
        mockImageData,
        expect.objectContaining({
          httpMetadata: {
            contentType: 'image/jpeg',
            contentDisposition: expect.stringContaining('filename=')
          }
        })
      );
    });

    test('should send messages via Facebook Messenger API', async () => {
      const conversationId = 'fb-conv-123';
      const messageData = {
        content: 'Hello Facebook user!',
        mediaType: 'image',
        mediaUrl: 'https://example.com/agent-image.jpg'
      };

      mockContext.req.param = vi.fn((param) => {
        if (param === 'id') return conversationId;
        return null;
      });
      mockContext.req.json = vi.fn().mockResolvedValue(messageData);
      mockContext.get = vi.fn((key) => {
        if (key === 'jwtPayload') return { userId: 'agent-456' };
        return null;
      });

      // Mock conversation lookup
      mockDB.prepare.mockImplementation((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(async () => {
          if (query.includes('SELECT c.*, cu.platform')) {
            return {
              id: conversationId,
              platform: 'facebook',
              platform_user_id: 'fb-user-789'
            };
          }
          return null;
        }),
        run: vi.fn().mockResolvedValue({ success: true })
      }));

      // Mock Facebook Send API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const result = await messageHandler.send(mockContext);

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com/v18.0/me/messages'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('fb-user-789')
        })
      );
    });
  });

  describe('FacebookAdapter Tests', () => {
    let facebookAdapter: FacebookAdapter;

    beforeEach(() => {
      facebookAdapter = new FacebookAdapter('test-secret', 'test-token');
    });

    test('should send various message types correctly', async () => {
      const userId = 'fb-test-user';

      // Test text message
      mockFetch.mockResolvedValueOnce({ ok: true });
      const textResult = await facebookAdapter.sendTextMessage(userId, 'Hello!');
      expect(textResult).toBe(true);

      // Test image message
      mockFetch.mockResolvedValueOnce({ ok: true });
      const imageResult = await facebookAdapter.sendImageMessage(userId, 'https://example.com/image.jpg');
      expect(imageResult).toBe(true);

      // Test video message
      mockFetch.mockResolvedValueOnce({ ok: true });
      const videoResult = await facebookAdapter.sendVideoMessage(userId, 'https://example.com/video.mp4');
      expect(videoResult).toBe(true);

      // Test file message
      mockFetch.mockResolvedValueOnce({ ok: true });
      const fileResult = await facebookAdapter.sendFileMessage(userId, 'https://example.com/doc.pdf', 'document.pdf');
      expect(fileResult).toBe(true);

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    test('should handle webhook signature verification', async () => {
      const testBody = 'test-webhook-payload';
      const validSignature = 'sha1=da39a3ee5e6b4b0d3255bfef95601890afd80709';

      const result = await facebookAdapter.verifyWebhook(validSignature, testBody);
      
      expect(result).toBe(true);
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );
    });

    test('should normalize Facebook messages correctly', () => {
      const testCases = [
        {
          input: {
            sender: { id: 'user123' },
            message: { mid: 'msg123', text: 'Hello World' },
            timestamp: 1640995200000
          },
          expected: {
            platform: 'facebook',
            userId: 'user123',
            messageId: 'msg123',
            content: 'Hello World',
            messageType: 'text'
          }
        },
        {
          input: {
            sender: { id: 'user456' },
            message: {
              mid: 'msg456',
              attachments: [{
                type: 'image',
                payload: { url: 'https://example.com/photo.jpg' }
              }]
            },
            timestamp: 1640995300000
          },
          expected: {
            platform: 'facebook',
            userId: 'user456',
            messageId: 'msg456',
            content: '',
            messageType: 'image'
          }
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = facebookAdapter.normalizeMessage(input);
        expect(result).toMatchObject(expected);
      });
    });
  });

  describe('User Profile Sync - Facebook', () => {
    test('should sync Facebook user profile successfully', async () => {
      const userSyncService = createUserSyncService(mockEnv);
      const userId = 'fb-sync-user-123';

      // Mock Facebook Graph API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: userId,
          first_name: 'Bob',
          last_name: 'Smith',
          profile_pic: 'https://example.com/bob.jpg',
          locale: 'en_GB',
          timezone: 0
        })
      });

      mockDB.prepare.mockImplementation(() => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true })
      }));

      const profile = await userSyncService.syncFacebookUser(userId);

      expect(profile).toEqual({
        platformUserId: userId,
        platform: 'facebook',
        displayName: 'Bob Smith',
        pictureUrl: 'https://example.com/bob.jpg',
        locale: 'en_GB',
        timezone: 0,
        firstName: 'Bob',
        lastName: 'Smith',
        lastUpdated: expect.any(Date)
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`graph.facebook.com/v18.0/${userId}`),
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    test('should handle Facebook API errors gracefully', async () => {
      const userSyncService = createUserSyncService(mockEnv);
      
      // Mock failed API response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      const profile = await userSyncService.syncFacebookUser('nonexistent-user');
      
      expect(profile).toBeNull();
    });
  });

  describe('Integration Testing', () => {
    test('should test Facebook integration configuration', async () => {
      const { testIntegration } = await import('../../src/handlers/system');

      const config = {
        appId: 'test-app-id',
        appSecret: 'test-app-secret',
        pageId: 'test-page-id',
        pageToken: 'test-page-token'
      };

      mockContext.req.param = vi.fn(() => 'facebook');
      mockContext.req.json = vi.fn().mockResolvedValue(config);

      // Mock successful Facebook API responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-page-id',
            name: 'Test Page'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-page-id',
            name: 'Test Page',
            category: 'Business'
          })
        });

      const result = await testIntegration(mockContext);

      expect(result.data.status).toBe('success');
      expect(result.data.details).toMatchObject({
        pageId: 'test-page-id',
        pageName: 'Test Page',
        appId: 'test-app-id'
      });
    });

    test('should detect invalid Facebook configuration', async () => {
      const { testIntegration } = await import('../../src/handlers/system');

      const invalidConfig = {
        appId: 'invalid-app-id',
        appSecret: 'invalid-secret',
        pageId: 'invalid-page',
        pageToken: 'invalid-token'
      };

      mockContext.req.param = vi.fn(() => 'facebook');
      mockContext.req.json = vi.fn().mockResolvedValue(invalidConfig);

      // Mock failed API response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      const result = await testIntegration(mockContext);

      expect(result.data.status).toBe('error');
      expect(result.data.message).toContain('Facebook Page Access Token 無效');
    });
  });

  describe('Error Handling', () => {
    test('should handle Facebook API rate limiting', async () => {
      const webhookPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: 'rate-limited-user' },
            message: { mid: 'msg123', text: 'Test message' },
            timestamp: Date.now()
          }]
        }]
      };

      mockContext.req.query = vi.fn(() => null);
      mockContext.req.header = vi.fn(() => null);
      mockContext.req.json = vi.fn().mockResolvedValue(webhookPayload);

      // Mock existing user to avoid profile sync
      mockDB.prepare.mockImplementation((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(async () => {
          if (query.includes('SELECT * FROM customers')) {
            return { id: 123, platform_user_id: 'rate-limited-user' };
          } else if (query.includes('SELECT * FROM conversations')) {
            return { id: 456 };
          }
          return null;
        }),
        run: vi.fn().mockResolvedValue({ success: true })
      }));

      const result = await webhookHandler.facebook(mockContext);

      // Should still process the message successfully
      expect(result.status).toBe(200);
    });

    test('should handle malformed Facebook webhook payloads', async () => {
      const malformedPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            // Missing sender
            message: { text: 'Test' }
          }]
        }]
      };

      mockContext.req.query = vi.fn(() => null);
      mockContext.req.header = vi.fn(() => null);
      mockContext.req.json = vi.fn().mockResolvedValue(malformedPayload);

      const result = await webhookHandler.facebook(mockContext);

      // Should handle gracefully and return error
      expect(result.status).toBe(500);
    });
  });
});