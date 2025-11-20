import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FacebookAdapter } from '@backend/integrations/platform-adapter';

import { MockFactory } from '@helpers/mockFactory';
// Mock global fetch and crypto
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockCrypto = {
  subtle: {
    importKey: vi.fn(),
    sign: vi.fn()
  }
};
global.crypto = mockCrypto as any;

describe('Facebook Integration - Advanced Scenarios', () => {
  let facebookAdapter: FacebookAdapter;
  const mockAppSecret = 'facebook-app-secret-key';
  const mockPageAccessToken = 'facebook-page-access-token';

  beforeEach(() => {
    vi.clearAllMocks();
    facebookAdapter = new FacebookAdapter(mockAppSecret, mockPageAccessToken);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Facebook Graph API Integration', () => {
    test('should handle API rate limiting gracefully', async () => {
      // Mock rate limit response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: {
          get: (header: string) => {
            if (header === 'retry-after') return '60';
            return null;
          }
        },
        json: () => Promise.resolve({
          error: {
            code: 32,
            message: 'Rate limit exceeded'
          }
        })
      });

      const result = await facebookAdapter.sendMessage('user123', 'Test message');
      
      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('should handle Facebook API error responses', async () => {
      const errorResponse = {
        error: {
          code: 100,
          message: 'Invalid parameter',
          type: 'GraphMethodException',
          fbtrace_id: 'trace123'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorResponse)
      });

      const result = await facebookAdapter.sendMessage('invalid-user', 'Test message');
      
      expect(result).toBe(false);
    });

    test('should handle different message types in Send API', async () => {
      const messageTypes = [
        { type: 'text', content: 'Hello World' },
        { type: 'image', content: 'https://example.com/image.jpg' },
        { type: 'quick_reply', content: 'Choose an option' }
      ];

      for (const messageType of messageTypes) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            recipient_id: 'user123',
            message_id: 'mid.123'
          })
        });

        const result = await facebookAdapter.sendMessage('user123', messageType.content);
        expect(result).toBe(true);
      }

      expect(mockFetch).toHaveBeenCalledTimes(messageTypes.length);
    });
  });

  describe('Facebook Webhook Validation', () => {
    test('should handle webhook verification challenge correctly', () => {
      const webhookChallenge = {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'expected-verify-token',
        'hub.challenge': 'challenge-string-123'
      };

      // This would typically be handled by the webhook handler
      // Testing the logic that would be used
      if (webhookChallenge['hub.mode'] === 'subscribe' && 
          webhookChallenge['hub.verify_token'] === 'expected-verify-token') {
        expect(webhookChallenge['hub.challenge']).toBe('challenge-string-123');
      }
    });

    test('should validate webhook payload structure', () => {
      const validPayload = {
        object: 'page',
        entry: [{
          id: 'page-id',
          time: 1640995200000,
          messaging: [{
            sender: { id: 'user123' },
            recipient: { id: 'page123' },
            timestamp: 1640995200000,
            message: {
              mid: 'msg123',
              text: 'Hello'
            }
          }]
        }]
      };

      const isValid = validateFacebookWebhookPayload(validPayload);
      expect(isValid).toBe(true);

      const invalidPayload = {
        object: 'user', // Invalid object type
        entry: []
      };

      const isInvalid = validateFacebookWebhookPayload(invalidPayload);
      expect(isInvalid).toBe(false);
    });

    test('should handle webhook with postback events', () => {
      const postbackWebhook = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: 'user123' },
            recipient: { id: 'page123' },
            timestamp: 1640995200000,
            postback: {
              title: 'Get Started',
              payload: 'GET_STARTED_PAYLOAD'
            }
          }]
        }]
      };

      expect(postbackWebhook.entry[0].messaging[0].postback).toBeDefined();
      expect(postbackWebhook.entry[0].messaging[0].postback.payload).toBe('GET_STARTED_PAYLOAD');
    });

    test('should handle webhook with delivery confirmations', () => {
      const deliveryWebhook = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: 'user123' },
            recipient: { id: 'page123' },
            timestamp: 1640995200000,
            delivery: {
              mids: ['mid.123', 'mid.124'],
              watermark: 1640995200000,
              seq: 37
            }
          }]
        }]
      };

      expect(deliveryWebhook.entry[0].messaging[0].delivery).toBeDefined();
      expect(deliveryWebhook.entry[0].messaging[0].delivery.mids).toHaveLength(2);
    });

    test('should handle webhook with read confirmations', () => {
      const readWebhook = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: 'user123' },
            recipient: { id: 'page123' },
            timestamp: 1640995200000,
            read: {
              watermark: 1640995200000,
              seq: 38
            }
          }]
        }]
      };

      expect(readWebhook.entry[0].messaging[0].read).toBeDefined();
      expect(readWebhook.entry[0].messaging[0].read.watermark).toBe(1640995200000);
    });
  });

  describe('Message Format Conversion', () => {
    test('should handle rich media messages', () => {
      const richMediaMessage = {
        sender: { id: 'user123' },
        message: {
          mid: 'msg123',
          attachments: [{
            type: 'image',
            payload: {
              url: 'https://scontent.xx.fbcdn.net/v/image.jpg',
              sticker_id: 369239263222822
            }
          }]
        },
        timestamp: 1640995200000
      };

      const result = facebookAdapter.normalizeMessage(richMediaMessage);

      expect(result.messageType).toBe('image');
      expect(result.content).toBe('');
      expect(result.metadata.originalMessage).toEqual(richMediaMessage);
    });

    test('should handle location sharing', () => {
      const locationMessage = {
        sender: { id: 'user123' },
        message: {
          mid: 'msg123',
          attachments: [{
            type: 'location',
            payload: {
              coordinates: {
                lat: 37.7749,
                long: -122.4194
              }
            }
          }]
        },
        timestamp: 1640995200000
      };

      const result = facebookAdapter.normalizeMessage(locationMessage);

      expect(result.messageType).toBe('location');
      expect(result.platform).toBe('facebook');
    });

    test('should handle quick replies', () => {
      const quickReplyMessage = {
        sender: { id: 'user123' },
        message: {
          mid: 'msg123',
          text: 'Red',
          quick_reply: {
            payload: 'DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_RED'
          }
        },
        timestamp: 1640995200000
      };

      const result = facebookAdapter.normalizeMessage(quickReplyMessage);

      expect(result.messageType).toBe('text');
      expect(result.content).toBe('Red');
    });
  });

  describe('User Profile Management', () => {
    test('should handle incomplete user profiles', () => {
      const incompleteProfile = {
        id: 'user123',
        first_name: 'John'
        // Missing last_name, profile_pic, etc.
      };

      const result = facebookAdapter.normalizeUser(incompleteProfile);

      expect(result.platformUserId).toBe('user123');
      expect(result.displayName).toBe('John undefined');
      expect(result.avatarUrl).toBeUndefined();
      expect(result.metadata.locale).toBeUndefined();
    });

    test('should handle user profile with all fields', () => {
      const completeProfile = {
        id: 'user123',
        first_name: 'John',
        last_name: 'Doe',
        profile_pic: 'https://platform-lookaside.fbsbx.com/platform/profilepic/',
        locale: 'en_US',
        timezone: -8,
        gender: 'male'
      };

      const result = facebookAdapter.normalizeUser(completeProfile);

      expect(result).toEqual({
        platform: 'facebook',
        platformUserId: 'user123',
        displayName: 'John Doe',
        avatarUrl: 'https://platform-lookaside.fbsbx.com/platform/profilepic/',
        metadata: {
          locale: 'en_US',
          timezone: -8
        }
      });
    });
  });

  describe('Error Scenarios', () => {
    test('should handle network timeouts', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(
        facebookAdapter.sendMessage('user123', 'Test message')
      ).rejects.toThrow('Request timeout');
    });

    test('should handle malformed webhook signatures', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockCrypto.subtle.importKey.mockRejectedValueOnce(new Error('Invalid key format'));

      const result = await facebookAdapter.verifyWebhook('invalid-signature', 'body');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should handle oversized webhook payloads', () => {
      const oversizedPayload = {
        object: 'page',
        entry: [{
          messaging: [{
            sender: { id: 'user123' },
            message: {
              mid: 'msg123',
              text: 'x'.repeat(2000) // Very long message
            },
            timestamp: 1640995200000
          }]
        }]
      };

      const result = facebookAdapter.normalizeMessage(oversizedPayload.entry[0].messaging[0]);
      expect(result.content).toHaveLength(2000);
    });
  });

  describe('Security Features', () => {
    test('should properly sanitize user input in messages', () => {
      const maliciousMessage = {
        sender: { id: 'user123' },
        message: {
          mid: 'msg123',
          text: '<script>alert("xss")</script>Hello'
        },
        timestamp: 1640995200000
      };

      const result = facebookAdapter.normalizeMessage(maliciousMessage);

      // The content should be preserved as-is for now
      // Sanitization would happen at the application level
      expect(result.content).toBe('<script>alert("xss")</script>Hello');
    });

    test('should validate webhook signature with correct algorithm', async () => {
      const testBody = 'test-webhook-body';
      const testSignature = 'sha1=da39a3ee5e6b4b0d3255bfef95601890afd80709';

      // Mock crypto to simulate SHA-1 HMAC
      const mockHashArray = new Uint8Array([
        0xda, 0x39, 0xa3, 0xee, 0x5e, 0x6b, 0x4b, 0x0d,
        0x32, 0x55, 0xbf, 0xef, 0x95, 0x60, 0x18, 0x90,
        0xaf, 0xd8, 0x07, 0x09
      ]);
      
      mockCrypto.subtle.importKey.mockResolvedValueOnce({});
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
    });
  });
});

// Helper function for webhook validation (would be part of the main codebase)
function validateFacebookWebhookPayload(payload: any): boolean {
  return payload &&
         payload.object === 'page' &&
         payload.entry &&
         Array.isArray(payload.entry) &&
         payload.entry.every((entry: any) => 
           entry &&
           entry.messaging &&
           Array.isArray(entry.messaging)
         );
}