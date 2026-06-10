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
vi.stubGlobal('fetch', mockFetch);

// Mock Web Crypto API
const mockCrypto = {
  subtle: {
    importKey: vi.fn(),
    sign: vi.fn()
  }
};
vi.stubGlobal('crypto', mockCrypto);

function expectByteView(value: unknown): void {
  expect(ArrayBuffer.isView(value)).toBe(true);
  expect((value as ArrayBufferView).byteLength).toBeGreaterThan(0);
}

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
    // NOTE: Do NOT use vi.restoreAllMocks() — it strips mockImplementation
    // from vi.stubGlobal() factories set at module level.
  });

  describe('sendLineReply', () => {
    const mockMessages: LineReplyMessage[] = [
      { type: 'text', text: 'Hello, World!' }
    ];

    test('should send reply message successfully', async () => {
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

    test('should handle API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Invalid reply token')
      });

      // Source uses structured logger (log.error), not console.error
      const result = await sendLineReply(mockAccessToken, mockReplyToken, mockMessages);

      expect(result).toBe(false);
    });

    test('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await sendLineReply(mockAccessToken, mockReplyToken, mockMessages);

      expect(result).toBe(false);
    });

    test('should send multiple messages', async () => {
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

    test('should push message successfully', async () => {
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

    test('should handle push API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue('Invalid user ID')
      });

      const result = await pushLineMessage(mockAccessToken, mockUserId, mockMessages);

      expect(result).toBe(false);
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
      vi.stubGlobal('btoa', vi.fn().mockReturnValue(mockComputedSignature));
    });

    test('should verify valid signature', async () => {
      const result = await verifyLineSignature(mockBody, mockSignature, mockChannelSecret);

      expect(result).toBe(true);
      const importKeyCall = mockCrypto.subtle.importKey.mock.calls[0];
      expect(importKeyCall[0]).toBe('raw');
      expectByteView(importKeyCall[1]);
      expect(importKeyCall[2]).toEqual({ name: 'HMAC', hash: 'SHA-256' });
      expect(importKeyCall[3]).toBe(false);
      expect(importKeyCall[4]).toEqual(['sign']);

      const signCall = mockCrypto.subtle.sign.mock.calls[0];
      expect(signCall[0]).toBe('HMAC');
      expect(signCall[1]).toBe('mock-key');
      expectByteView(signCall[2]);
    });

    test('should reject invalid signature', async () => {
      vi.stubGlobal('btoa', vi.fn().mockReturnValue('different-signature'));

      const result = await verifyLineSignature(mockBody, mockSignature, mockChannelSecret);

      expect(result).toBe(false);
    });

    test('should reject missing signature', async () => {
      const result = await verifyLineSignature(mockBody, undefined, mockChannelSecret);

      expect(result).toBe(false);
    });

    test('should handle signature without sha256 prefix', async () => {
      const signatureWithoutPrefix = 'test-signature';

      const result = await verifyLineSignature(mockBody, signatureWithoutPrefix, mockChannelSecret);

      expect(result).toBe(true);
    });

    test('should handle crypto error', async () => {
      mockCrypto.subtle.importKey.mockRejectedValueOnce(new Error('Crypto error'));

      const result = await verifyLineSignature(mockBody, mockSignature, mockChannelSecret);

      expect(result).toBe(false);
    });
  });

  describe('createTextMessage', () => {
    test('should create text message with correct format', () => {
      const text = 'Hello, World!';
      const message = createTextMessage(text);

      expect(message).toEqual({
        type: 'text',
        text: text
      });
    });

    test('should handle empty text', () => {
      const text = '';
      const message = createTextMessage(text);

      expect(message).toEqual({
        type: 'text',
        text: ''
      });
    });

    test('should handle special characters', () => {
      const text = '你好！\n換行測試';
      const message = createTextMessage(text);

      expect(message).toEqual({
        type: 'text',
        text: text
      });
    });
  });

  describe('createStickerMessage', () => {
    test('should create sticker message with correct format', () => {
      const packageId = '1';
      const stickerId = '1';
      const message = createStickerMessage(packageId, stickerId);

      expect(message).toEqual({
        type: 'sticker',
        packageId: packageId,
        stickerId: stickerId
      });
    });

    test('should handle different package and sticker IDs', () => {
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

    test('should get user profile successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockProfile)
      });

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
    });

    test('should handle profile API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue('User not found')
      });

      const result = await getLineUserProfile(mockAccessToken, mockUserId);

      expect(result).toBeNull();
    });

    test('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getLineUserProfile(mockAccessToken, mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('getLineGroupMemberProfile', () => {
    const mockMemberProfile = {
      userId: mockUserId,
      displayName: 'Group Member',
      pictureUrl: 'https://example.com/member-avatar.jpg'
    };

    test('should get group member profile successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockMemberProfile)
      });

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
    });

    test('should handle group member API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue('Member not found')
      });

      const result = await getLineGroupMemberProfile(mockAccessToken, mockGroupId, mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('Integration scenarios', () => {
    test('should handle rate limiting gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue('Rate limit exceeded')
      });

      const result = await sendLineReply(mockAccessToken, mockReplyToken, [createTextMessage('test')]);

      expect(result).toBe(false);
    });

    test('should handle invalid access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Invalid access token')
      });

      const result = await pushLineMessage('invalid-token', mockUserId, [createTextMessage('test')]);

      expect(result).toBe(false);
    });

    test('should handle message size limits', async () => {
      const longText = 'a'.repeat(5001); // Exceeds LINE's 5000 character limit
      const message = createTextMessage(longText);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Message too long')
      });

      const result = await sendLineReply(mockAccessToken, mockReplyToken, [message]);

      expect(result).toBe(false);
    });
  });
});
