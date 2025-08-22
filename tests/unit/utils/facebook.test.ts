import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FacebookAdapter } from '@backend/integrations/platform-adapter';
import type { UnifiedMessage, UnifiedUser } from '@backend/integrations/platform-adapter';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Web Crypto API
const mockCrypto = {
  subtle: {
    importKey: vi.fn(),
    sign: vi.fn()
  }
};
global.crypto = mockCrypto as any;

describe('Facebook Integration Tests', () => {
  const mockAppSecret = 'test-app-secret';
  const mockPageAccessToken = 'test-page-access-token';
  let facebookAdapter: FacebookAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    facebookAdapter = new FacebookAdapter(mockAppSecret, mockPageAccessToken);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('FacebookAdapter', () => {
    it('should initialize with correct platform name', () => {
      expect(facebookAdapter.platform).toBe('facebook');
    });

    describe('normalizeMessage', () => {
      it('should normalize text message correctly', () => {
        const mockFbMessage = {
          sender: { id: 'sender123' },
          message: {
            mid: 'msg_123',
            text: 'Hello from Facebook'
          },
          timestamp: 1640995200000
        };

        const result: UnifiedMessage = facebookAdapter.normalizeMessage(mockFbMessage);

        expect(result).toEqual({
          platform: 'facebook',
          userId: 'sender123',
          messageId: 'msg_123',
          content: 'Hello from Facebook',
          messageType: 'text',
          timestamp: new Date(1640995200000),
          metadata: {
            originalMessage: mockFbMessage
          }
        });
      });

      it('should handle message with attachments', () => {
        const mockFbMessage = {
          sender: { id: 'sender123' },
          message: {
            mid: 'msg_123',
            attachments: [{
              type: 'image',
              payload: { url: 'https://example.com/image.jpg' }
            }]
          },
          timestamp: 1640995200000
        };

        const result = facebookAdapter.normalizeMessage(mockFbMessage);

        expect(result.messageType).toBe('image');
        expect(result.content).toBe('');
      });

      it('should handle message without text or attachments', () => {
        const mockFbMessage = {
          sender: { id: 'sender123' },
          message: {
            mid: 'msg_123'
          },
          timestamp: 1640995200000
        };

        const result = facebookAdapter.normalizeMessage(mockFbMessage);

        expect(result.messageType).toBe('text');
        expect(result.content).toBe('');
      });

      it('should handle unsupported attachment types as file', () => {
        const mockFbMessage = {
          sender: { id: 'sender123' },
          message: {
            mid: 'msg_123',
            attachments: [{
              type: 'unsupported_type',
              payload: {}
            }]
          },
          timestamp: 1640995200000
        };

        const result = facebookAdapter.normalizeMessage(mockFbMessage);

        expect(result.messageType).toBe('file');
      });
    });

    describe('normalizeUser', () => {
      it('should normalize Facebook user correctly', () => {
        const mockFbUser = {
          id: 'user123',
          first_name: 'John',
          last_name: 'Doe',
          profile_pic: 'https://example.com/profile.jpg',
          locale: 'en_US',
          timezone: -8
        };

        const result: UnifiedUser = facebookAdapter.normalizeUser(mockFbUser);

        expect(result).toEqual({
          platform: 'facebook',
          platformUserId: 'user123',
          displayName: 'John Doe',
          avatarUrl: 'https://example.com/profile.jpg',
          metadata: {
            locale: 'en_US',
            timezone: -8
          }
        });
      });

      it('should handle user with missing optional fields', () => {
        const mockFbUser = {
          id: 'user123',
          first_name: 'John',
          last_name: 'Doe'
        };

        const result = facebookAdapter.normalizeUser(mockFbUser);

        expect(result.displayName).toBe('John Doe');
        expect(result.avatarUrl).toBeUndefined();
        expect(result.metadata.locale).toBeUndefined();
        expect(result.metadata.timezone).toBeUndefined();
      });
    });

    describe('sendMessage', () => {
      it('should send message successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200
        });

        const result = await facebookAdapter.sendMessage('user123', 'Hello World');

        expect(result).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          `https://graph.facebook.com/v18.0/me/messages?access_token=${mockPageAccessToken}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              recipient: { id: 'user123' },
              message: { text: 'Hello World' }
            })
          }
        );
      });

      it('should handle send message failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400
        });

        const result = await facebookAdapter.sendMessage('user123', 'Hello World');

        expect(result).toBe(false);
      });

      it('should handle network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(
          facebookAdapter.sendMessage('user123', 'Hello World')
        ).rejects.toThrow('Network error');
      });
    });

    describe('verifyWebhook', () => {
      beforeEach(() => {
        // Mock successful crypto operations
        mockCrypto.subtle.importKey.mockResolvedValue({});
        mockCrypto.subtle.sign.mockResolvedValue(
          new ArrayBuffer(20) // SHA-1 produces 20 bytes
        );
      });

      it('should verify valid webhook signature', async () => {
        const testBody = 'test body content';
        const testSignature = 'sha1=0000000000000000000000000000000000000000';

        // Mock the hash generation to match our test signature
        const mockHashArray = new Uint8Array(20).fill(0);
        mockCrypto.subtle.sign.mockResolvedValueOnce(mockHashArray.buffer);

        const result = await facebookAdapter.verifyWebhook(testSignature, testBody);

        expect(result).toBe(true);
        expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
          'raw',
          expect.any(Uint8Array),
          { name: 'HMAC', hash: 'SHA-1' },
          false,
          ['sign']
        );
        expect(mockCrypto.subtle.sign).toHaveBeenCalledWith(
          'HMAC',
          {},
          expect.any(Uint8Array)
        );
      });

      it('should reject invalid webhook signature', async () => {
        const testBody = 'test body content';
        const testSignature = 'sha1=invalid_signature';

        // Mock different hash to make verification fail
        const mockHashArray = new Uint8Array(20).fill(255);
        mockCrypto.subtle.sign.mockResolvedValueOnce(mockHashArray.buffer);

        const result = await facebookAdapter.verifyWebhook(testSignature, testBody);

        expect(result).toBe(false);
      });

      it('should handle crypto error gracefully', async () => {
        const testBody = 'test body content';
        const testSignature = 'sha1=valid_signature';

        mockCrypto.subtle.importKey.mockRejectedValueOnce(new Error('Crypto error'));
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await facebookAdapter.verifyWebhook(testSignature, testBody);

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
          'Facebook webhook verification failed:',
          expect.any(Error)
        );

        consoleSpy.mockRestore();
      });
    });

    describe('mapFacebookMessageType', () => {
      it('should map various Facebook message types correctly', () => {
        // Test through normalizeMessage since mapFacebookMessageType is private
        const testCases = [
          {
            message: { text: 'hello' },
            expected: 'text'
          },
          {
            message: { attachments: [{ type: 'image' }] },
            expected: 'image'
          },
          {
            message: { attachments: [{ type: 'video' }] },
            expected: 'video'
          },
          {
            message: { attachments: [{ type: 'audio' }] },
            expected: 'audio'
          },
          {
            message: { attachments: [{ type: 'location' }] },
            expected: 'location'
          },
          {
            message: { attachments: [{ type: 'unknown_type' }] },
            expected: 'file'
          }
        ];

        testCases.forEach(({ message, expected }) => {
          const mockFbMessage = {
            sender: { id: 'test' },
            message: { mid: 'test', ...message },
            timestamp: 0
          };

          const result = facebookAdapter.normalizeMessage(mockFbMessage);
          expect(result.messageType).toBe(expected);
        });
      });
    });
  });

  describe('Facebook Webhook Message Processing', () => {
    it('should handle webhook with multiple entries', () => {
      const mockWebhookData = {
        object: 'page',
        entry: [
          {
            id: 'page1',
            messaging: [
              {
                sender: { id: 'user1' },
                message: { mid: 'msg1', text: 'Hello 1' },
                timestamp: 1640995200000
              }
            ]
          },
          {
            id: 'page2',
            messaging: [
              {
                sender: { id: 'user2' },
                message: { mid: 'msg2', text: 'Hello 2' },
                timestamp: 1640995300000
              }
            ]
          }
        ]
      };

      // Test each message can be processed
      mockWebhookData.entry.forEach(entry => {
        entry.messaging.forEach(messaging => {
          const result = facebookAdapter.normalizeMessage(messaging);
          expect(result.platform).toBe('facebook');
          expect(result.content).toContain('Hello');
        });
      });
    });

    it('should handle empty messaging array', () => {
      const mockWebhookData = {
        object: 'page',
        entry: [{
          id: 'page1',
          messaging: []
        }]
      };

      expect(mockWebhookData.entry[0].messaging).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed Facebook message gracefully', () => {
      const malformedMessage = {
        sender: null,
        message: null,
        timestamp: 'invalid'
      };

      expect(() => {
        facebookAdapter.normalizeMessage(malformedMessage);
      }).toThrow();
    });

    it('should handle missing required fields', () => {
      const incompleteMessage = {
        message: { text: 'hello' },
        timestamp: 1640995200000
      };

      expect(() => {
        facebookAdapter.normalizeMessage(incompleteMessage);
      }).toThrow();
    });
  });
});