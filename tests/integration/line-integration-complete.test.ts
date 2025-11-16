import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Context } from 'hono';
import { webhookHandler } from '@/handlers/webhook';
import { messageHandler } from '@/handlers/message';
import { createUserSyncService } from '@/services/user-sync';
import { FileStorageService } from '@/utils/file-storage';
import type { Bindings } from '@/types';
import { createMockDatabase } from '../helpers/mockDatabase';

// Mock globals
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockCrypto = {
  subtle: {
    importKey: vi.fn(),
    sign: vi.fn()
  },
  randomUUID: vi.fn(() => 'test-uuid-123')
};
global.crypto = mockCrypto as any;
global.btoa = vi.fn(() => 'valid-signature');

describe('LINE Integration - Complete Feature Tests', () => {
  let mockDB: any;
  let mockEnv: Bindings;
  let mockContext: Context<{ Bindings: Bindings }>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDB = createMockDatabase();
    
    mockEnv = {
      DB: mockDB,
      LINE_CHANNEL_ACCESS_TOKEN: 'line-access-token-123',
      LINE_CHANNEL_SECRET: 'line-channel-secret-123',
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

    // Setup crypto mocks
    mockCrypto.subtle.importKey.mockResolvedValue({});
    mockCrypto.subtle.sign.mockResolvedValue(new ArrayBuffer(32));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Message Flow - LINE', () => {
    it('should handle text message from new user with profile sync', async () => {
      const webhookPayload = {
        events: [{
          type: 'message',
          timestamp: 1640995200000,
          source: {
            type: 'user',
            userId: 'new-line-user-123'
          },
          replyToken: 'reply-token-123',
          message: {
            id: 'line-msg-123',
            type: 'text',
            text: 'Hello from new LINE user!'
          }
        }]
      };

      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(webhookPayload));

      // Mock LINE Profile API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          userId: 'new-line-user-123',
          displayName: 'John Doe',
          pictureUrl: 'https://example.com/avatar.jpg',
          statusMessage: 'Hello World'
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
          meta: { last_row_id: 100 + queryCount },
          success: true 
        })
      }));

      const result = await webhookHandler.line(mockContext);

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/profile/new-line-user-123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer line-access-token-123'
          })
        })
      );
      expect(mockDB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO customers')
      );
    });

    it('should handle image message with R2 storage', async () => {
      const imageWebhookPayload = {
        events: [{
          type: 'message',
          timestamp: 1640995200000,
          source: {
            type: 'user',
            userId: 'existing-user-123'
          },
          replyToken: 'reply-token-456',
          message: {
            id: 'line-img-123',
            type: 'image'
          }
        }]
      };

      mockContext.req.header = vi.fn((header) => {
        if (header === 'X-Line-Signature') return 'valid-signature';
        return null;
      });
      mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(imageWebhookPayload));

      // Mock existing user
      mockDB.prepare.mockImplementation((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(async () => {
          if (query.includes('SELECT * FROM customers')) {
            return { id: 456, platform_user_id: 'existing-user-123' };
          } else if (query.includes('SELECT * FROM conversations')) {
            return { id: 789 };
          }
          return null;
        }),
        run: vi.fn().mockResolvedValue({ success: true })
      }));

      // Mock LINE Content API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      });

      const result = await webhookHandler.line(mockContext);

      expect(result.status).toBe(200);
      
      // Should have called R2 to store the file
      expect(mockEnv.R2_BUCKET.put).toHaveBeenCalledWith(
        expect.stringContaining('media/line/'),
        expect.any(ArrayBuffer),
        expect.objectContaining({
          httpMetadata: expect.objectContaining({
            contentType: 'image/jpeg'
          })
        })
      );
      
      // Should store file attachment record
      expect(mockDB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO file_attachments')
      );
    });

    it('should send message via LINE Push API with attachments', async () => {
      const conversationId = 'conv-123';
      const messageData = {
        content: 'Hello from agent',
        attachmentIds: ['attach-1', 'attach-2']
      };

      mockContext.req.param = vi.fn((param) => {
        if (param === 'id') return conversationId;
        return null;
      });
      mockContext.req.json = vi.fn().mockResolvedValue(messageData);
      mockContext.get = vi.fn((key) => {
        if (key === 'jwtPayload') return { userId: 'agent-123' };
        return null;
      });

      // Mock conversation lookup
      mockDB.prepare.mockImplementation((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(async () => {
          if (query.includes('SELECT c.*, cu.platform')) {
            return {
              id: conversationId,
              platform: 'line',
              platform_user_id: 'line-user-123'
            };
          }
          return null;
        }),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'attach-1',
              filename: 'image1.jpg',
              mime_type: 'image/jpeg',
              file_url: 'https://example.com/image1.jpg'
            },
            {
              id: 'attach-2', 
              filename: 'doc1.pdf',
              mime_type: 'application/pdf',
              file_url: 'https://example.com/doc1.pdf'
            }
          ]
        }),
        run: vi.fn().mockResolvedValue({ success: true })
      }));

      // Mock LINE Push API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const result = await messageHandler.send(mockContext);

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer line-access-token-123'
          }),
          body: expect.stringContaining('line-user-123')
        })
      );
    });
  });

  describe('User Profile Sync Service', () => {
    it('should sync LINE user profile and update database', async () => {
      const userSyncService = createUserSyncService(mockEnv);
      const userId = 'line-profile-sync-123';

      // Mock LINE Profile API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          userId,
          displayName: 'Jane Smith',
          pictureUrl: 'https://example.com/jane.jpg',
          statusMessage: 'Busy working'
        })
      });

      mockDB.prepare.mockImplementation(() => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true })
      }));

      const profile = await userSyncService.syncLineUser(userId);

      expect(profile).toEqual({
        platformUserId: userId,
        platform: 'line',
        displayName: 'Jane Smith',
        pictureUrl: 'https://example.com/jane.jpg',
        statusMessage: 'Busy working',
        lastUpdated: expect.any(Date)
      });

      expect(mockDB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE customers')
      );
    });

    it('should batch sync multiple users efficiently', async () => {
      const userSyncService = createUserSyncService(mockEnv);
      const userList = [
        { userId: 'user1', platform: 'line' },
        { userId: 'user2', platform: 'line' },
        { userId: 'user3', platform: 'line' }
      ];

      // Mock multiple API responses
      userList.forEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            userId: 'test-user',
            displayName: 'Test User',
            pictureUrl: null
          })
        });
      });

      mockDB.prepare.mockImplementation(() => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true })
      }));

      const results = await userSyncService.syncMultipleUsers(userList);

      expect(results).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('File Storage Service', () => {
    it('should download LINE media and store in R2', async () => {
      const fileStorage = new FileStorageService(mockEnv);
      
      // Mock file download
      const mockFileData = new ArrayBuffer(2048);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockFileData)
      });

      const result = await fileStorage.downloadAndStore(
        'https://api.line.me/v2/bot/message/msg123/content',
        'test-image.jpg',
        'image/jpeg',
        'line',
        'msg123'
      );

      expect(result).toMatchObject({
        id: expect.any(String),
        filename: 'test-image.jpg',
        mimeType: 'image/jpeg',
        size: 2048,
        platform: 'line',
        messageId: 'msg123'
      });

      expect(mockEnv.R2_BUCKET.put).toHaveBeenCalledWith(
        expect.stringMatching(/^media\/line\/\d{4}\/\d{1,2}\//),
        mockFileData,
        expect.objectContaining({
          httpMetadata: {
            contentType: 'image/jpeg',
            contentDisposition: 'inline; filename="test-image.jpg"'
          }
        })
      );
    });

    it('should handle file size limits', async () => {
      const fileStorage = new FileStorageService(mockEnv);
      
      // Mock oversized file (>10MB)
      const oversizedFile = new ArrayBuffer(11 * 1024 * 1024);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(oversizedFile)
      });

      const result = await fileStorage.downloadAndStore(
        'https://example.com/large-file.bin',
        'large-file.bin',
        'application/octet-stream',
        'line'
      );

      expect(result).toBeNull();
      expect(mockEnv.R2_BUCKET.put).not.toHaveBeenCalled();
    });
  });

  describe('Integration Health Checks', () => {
    it('should verify LINE integration status', async () => {
      // Mock successful LINE Bot Info API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          userId: 'bot-123',
          displayName: 'Test Bot'
        })
      });

      // Import and test the health check function
      const { healthCheck } = await import('../../src/handlers/system');
      
      mockDB.prepare.mockImplementation(() => ({
        first: vi.fn().mockResolvedValue({ count: 1 })
      }));

      const result = await healthCheck(mockContext);

      expect(result.data.status).toBe('healthy');
      expect(result.data.checks.integrations.line).toBe(true);
      expect(result.data.details.line).toContain('Test Bot');
    });

    it('should detect LINE integration failures', async () => {
      // Mock failed LINE API
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      const { healthCheck } = await import('../../src/handlers/system');
      
      mockDB.prepare.mockImplementation(() => ({
        first: vi.fn().mockResolvedValue({ count: 1 })
      }));

      const result = await healthCheck(mockContext);

      expect(result.data.checks.integrations.line).toBe(false);
      expect(result.data.details.line).toContain('LINE API error: 401');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle LINE API rate limiting gracefully', async () => {
      const webhookPayload = {
        events: [{
          type: 'message',
          source: { userId: 'rate-limited-user' },
          message: { id: 'msg-123', type: 'text', text: 'Test' }
        }]
      };

      mockContext.req.header = vi.fn(() => 'valid-signature');
      mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(webhookPayload));

      // Mock rate limited response for profile fetch
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (header: string) => header === 'retry-after' ? '60' : null
        }
      });

      // Mock existing user to skip profile fetch
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

      const result = await webhookHandler.line(mockContext);

      // Should still process the message successfully despite rate limiting
      expect(result.status).toBe(200);
    });

    it('should recover from temporary storage failures', async () => {
      const imageWebhookPayload = {
        events: [{
          type: 'message',
          source: { userId: 'storage-fail-user' },
          message: { id: 'img-fail-123', type: 'image' }
        }]
      };

      mockContext.req.header = vi.fn(() => 'valid-signature');
      mockContext.req.text = vi.fn().mockResolvedValue(JSON.stringify(imageWebhookPayload));

      // Mock user and conversation
      mockDB.prepare.mockImplementation((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ id: 123 }),
        run: vi.fn().mockResolvedValue({ success: true })
      }));

      // Mock storage failure
      mockEnv.R2_BUCKET.put = vi.fn().mockRejectedValue(new Error('Storage unavailable'));
      
      // Mock failed file download
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503
      });

      const result = await webhookHandler.line(mockContext);

      // Should still process message successfully, just without file storage
      expect(result.status).toBe(200);
    });
  });
});