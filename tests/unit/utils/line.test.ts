import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendLineReply,
  pushLineMessage,
  verifyLineSignature,
  createTextMessage,
  createStickerMessage,
  getLineUserProfile,
  getLineGroupMemberProfile
} from '@backend/utils/line';
import type { LineReplyMessage } from '@backend/types';

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

describe('LINE API Integration Tests', () => {
  const mockAccessToken = 'test-access-token';
  const mockChannelSecret = 'test-channel-secret';
  const mockReplyToken = 'test-reply-token';
  const mockUserId = 'test-user-id';
  const mockGroupId = 'test-group-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendLineReply', () => {
    const mockMessages: LineReplyMessage[] = [
      { type: 'text', text: 'Hello, World!' }
    ];

    it('should send reply message successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const result = await sendLineReply(mockAccessToken, mockReplyToken, mockMessages);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/reply',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockAccessToken}`,
          },
          body: JSON.stringify({
            replyToken: mockReplyToken,
            messages: mockMessages,
            notificationDisabled: false
          }),
        }
      );
    });

    it('should handle API error response', async () => {
      const mockErrorText = 'Invalid reply token';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue(mockErrorText)
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await sendLineReply(mockAccessToken, mockReplyToken, mockMessages);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('LINE API error:', 400, mockErrorText);
      
      consoleSpy.mockRestore();
    });

    it('should handle network error', async () => {
      const mockError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(mockError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await sendLineReply(mockAccessToken, mockReplyToken, mockMessages);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to send LINE message:', mockError);
      
      consoleSpy.mockRestore();
    });

    it('should send multiple messages', async () => {
      const multipleMessages: LineReplyMessage[] = [
        { type: 'text', text: 'First message' },
        { type: 'text', text: 'Second message' },
        { type: 'sticker', packageId: '1', stickerId: '1' }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const result = await sendLineReply(mockAccessToken, mockReplyToken, multipleMessages);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/reply',
        expect.objectContaining({
          body: JSON.stringify({
            replyToken: mockReplyToken,
            messages: multipleMessages,
            notificationDisabled: false
          })
        })
      );
    });
  });

  describe('pushLineMessage', () => {
    const mockMessages: LineReplyMessage[] = [
      { type: 'text', text: 'Push message' }
    ];

    it('should push message successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const result = await pushLineMessage(mockAccessToken, mockUserId, mockMessages);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockAccessToken}`,
          },
          body: JSON.stringify({
            to: mockUserId,
            messages: mockMessages,
            notificationDisabled: false
          }),
        }
      );
    });

    it('should handle push API error', async () => {
      const mockErrorText = 'Invalid user ID';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue(mockErrorText)
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await pushLineMessage(mockAccessToken, mockUserId, mockMessages);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('LINE Push API error:', 404, mockErrorText);
      
      consoleSpy.mockRestore();
    });
  });

  describe('verifyLineSignature', () => {
    const mockBody = '{"events":[]}';
    const mockSignature = 'sha256=test-signature';
    const mockComputedSignature = 'test-signature';

    beforeEach(() => {
      // Mock Web Crypto API methods
      mockCrypto.subtle.importKey.mockResolvedValue('mock-key');
      mockCrypto.subtle.sign.mockResolvedValue(
        new Uint8Array([116, 101, 115, 116, 45, 115, 105, 103, 110, 97, 116, 117, 114, 101]) // "test-signature" in bytes
      );
      
      // Mock btoa
      global.btoa = vi.fn().mockReturnValue(mockComputedSignature);
    });

    it('should verify valid signature', async () => {
      const result = await verifyLineSignature(mockBody, mockSignature, mockChannelSecret);

      expect(result).toBe(true);
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      expect(mockCrypto.subtle.sign).toHaveBeenCalledWith(
        'HMAC',
        'mock-key',
        expect.any(Uint8Array)
      );
    });

    it('should reject invalid signature', async () => {
      global.btoa = vi.fn().mockReturnValue('different-signature');

      const result = await verifyLineSignature(mockBody, mockSignature, mockChannelSecret);

      expect(result).toBe(false);
    });

    it('should reject missing signature', async () => {
      const result = await verifyLineSignature(mockBody, undefined, mockChannelSecret);

      expect(result).toBe(false);
    });

    it('should handle signature without sha256 prefix', async () => {
      const signatureWithoutPrefix = 'test-signature';
      
      const result = await verifyLineSignature(mockBody, signatureWithoutPrefix, mockChannelSecret);

      expect(result).toBe(true);
    });

    it('should handle crypto error', async () => {
      mockCrypto.subtle.importKey.mockRejectedValueOnce(new Error('Crypto error'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await verifyLineSignature(mockBody, mockSignature, mockChannelSecret);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Signature verification error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('createTextMessage', () => {
    it('should create text message with correct format', () => {
      const text = 'Hello, World!';
      const message = createTextMessage(text);

      expect(message).toEqual({
        type: 'text',
        text: text
      });
    });

    it('should handle empty text', () => {
      const text = '';
      const message = createTextMessage(text);

      expect(message).toEqual({
        type: 'text',
        text: ''
      });
    });

    it('should handle special characters', () => {
      const text = '你好！🎉\n換行測試';
      const message = createTextMessage(text);

      expect(message).toEqual({
        type: 'text',
        text: text
      });
    });
  });

  describe('createStickerMessage', () => {
    it('should create sticker message with correct format', () => {
      const packageId = '1';
      const stickerId = '1';
      const message = createStickerMessage(packageId, stickerId);

      expect(message).toEqual({
        type: 'sticker',
        packageId: packageId,
        stickerId: stickerId
      });
    });

    it('should handle different package and sticker IDs', () => {
      const packageId = '11537';
      const stickerId = '52002734';
      const message = createStickerMessage(packageId, stickerId);

      expect(message).toEqual({
        type: 'sticker',
        packageId: packageId,
        stickerId: stickerId
      });
    });
  });

  describe('getLineUserProfile', () => {
    const mockProfile = {
      userId: mockUserId,
      displayName: 'Test User',
      pictureUrl: 'https://example.com/avatar.jpg',
      statusMessage: 'Hello!'
    };

    it('should get user profile successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockProfile)
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await getLineUserProfile(mockAccessToken, mockUserId);

      expect(result).toEqual(mockProfile);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.line.me/v2/bot/profile/${mockUserId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${mockAccessToken}`,
          },
        }
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        `📋 獲取用戶資訊成功 - ${mockProfile.displayName} (${mockUserId})`
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle profile API error', async () => {
      const mockErrorText = 'User not found';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue(mockErrorText)
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await getLineUserProfile(mockAccessToken, mockUserId);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('LINE Profile API error:', 404, mockErrorText);
      
      consoleSpy.mockRestore();
    });

    it('should handle network error', async () => {
      const mockError = new Error('Network error');
      mockFetch.mockRejectedValueOnce(mockError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await getLineUserProfile(mockAccessToken, mockUserId);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get LINE user profile:', mockError);
      
      consoleSpy.mockRestore();
    });
  });

  describe('getLineGroupMemberProfile', () => {
    const mockMemberProfile = {
      userId: mockUserId,
      displayName: 'Group Member',
      pictureUrl: 'https://example.com/member-avatar.jpg'
    };

    it('should get group member profile successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockMemberProfile)
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await getLineGroupMemberProfile(mockAccessToken, mockGroupId, mockUserId);

      expect(result).toEqual(mockMemberProfile);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.line.me/v2/bot/group/${mockGroupId}/member/${mockUserId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${mockAccessToken}`,
          },
        }
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        `📋 獲取群組成員資訊成功 - ${mockMemberProfile.displayName} (${mockUserId})`
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle group member API error', async () => {
      const mockErrorText = 'Member not found';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue(mockErrorText)
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await getLineGroupMemberProfile(mockAccessToken, mockGroupId, mockUserId);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('LINE Group Member API error:', 404, mockErrorText);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle rate limiting gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue('Rate limit exceeded')
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await sendLineReply(mockAccessToken, mockReplyToken, [createTextMessage('test')]);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('LINE API error:', 429, 'Rate limit exceeded');
      
      consoleSpy.mockRestore();
    });

    it('should handle invalid access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Invalid access token')
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await pushLineMessage('invalid-token', mockUserId, [createTextMessage('test')]);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('LINE Push API error:', 401, 'Invalid access token');
      
      consoleSpy.mockRestore();
    });

    it('should handle message size limits', async () => {
      const longText = 'a'.repeat(5001); // Exceeds LINE's 5000 character limit
      const message = createTextMessage(longText);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Message too long')
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await sendLineReply(mockAccessToken, mockReplyToken, [message]);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('LINE API error:', 400, 'Message too long');
      
      consoleSpy.mockRestore();
    });
  });
});