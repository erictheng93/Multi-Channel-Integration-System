import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendLineReply,
  pushLineMessage,
  getLineUserProfile,
  getLineGroupMemberProfile
} from '@backend/utils/line';
import type { LineReplyMessage } from '@backend/types';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('LINE API Integration Tests', () => {
  const mockAccessToken = 'test-access-token';
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

    test('passes the caller signal to fetch and returns null when it aborts (timeout)', async () => {
      const controller = new AbortController();
      mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      }));

      const pending = getLineUserProfile(mockAccessToken, mockUserId, controller.signal);
      controller.abort(new DOMException('Profile fetch timed out', 'TimeoutError'));

      await expect(pending).resolves.toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.line.me/v2/bot/profile/${mockUserId}`,
        expect.objectContaining({ signal: controller.signal })
      );
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
});
