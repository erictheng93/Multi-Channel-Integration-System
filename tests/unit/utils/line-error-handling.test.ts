import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendLineReply,
  pushLineMessage,
  verifyLineSignature,
  getLineUserProfile,
  getLineGroupMemberProfile
} from '@backend/utils/line';
import { createTextMessage, createStickerMessage } from '@backend/utils/line';

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
global.btoa = vi.fn();

describe('LINE API Error Handling Tests', () => {
  const mockConfig = {
    accessToken: 'test-access-token',
    channelSecret: 'test-channel-secret',
    replyToken: 'test-reply-token',
    userId: 'test-user-id',
    groupId: 'test-group-id'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default crypto mocks
    mockCrypto.subtle.importKey.mockResolvedValue('mock-key');
    mockCrypto.subtle.sign.mockResolvedValue(new Uint8Array([116, 101, 115, 116]).buffer);
    (global.btoa as any).mockReturnValue('dGVzdA==');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('HTTP Error Status Codes', () => {
    describe('sendLineReply error handling', () => {
      it('should handle 400 Bad Request', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: vi.fn().mockResolvedValue('{"message":"Invalid request body","details":"replyToken is invalid"}')
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const message = createTextMessage('Test message');
        
        const result = await sendLineReply(mockConfig.accessToken, 'invalid-reply-token', [message]);

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
          'LINE API error:',
          400,
          '{"message":"Invalid request body","details":"replyToken is invalid"}'
        );
        
        consoleSpy.mockRestore();
      });

      it('should handle 401 Unauthorized', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: vi.fn().mockResolvedValue('{"message":"Authentication failed"}')
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const message = createTextMessage('Test message');
        
        const result = await sendLineReply('invalid-token', mockConfig.replyToken, [message]);

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
          'LINE API error:',
          401,
          '{"message":"Authentication failed"}'
        );
        
        consoleSpy.mockRestore();
      });

      it('should handle 403 Forbidden', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: vi.fn().mockResolvedValue('{"message":"Insufficient permissions"}')
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const message = createTextMessage('Test message');
        
        const result = await sendLineReply(mockConfig.accessToken, mockConfig.replyToken, [message]);

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
          'LINE API error:',
          403,
          '{"message":"Insufficient permissions"}'
        );
        
        consoleSpy.mockRestore();
      });

      it('should handle 429 Rate Limit Exceeded', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: vi.fn().mockResolvedValue('{"message":"Rate limit exceeded","retryAfter":60}')
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const message = createTextMessage('Test message');
        
        const result = await sendLineReply(mockConfig.accessToken, mockConfig.replyToken, [message]);

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
          'LINE API error:',
          429,
          '{"message":"Rate limit exceeded","retryAfter":60}'
        );
        
        consoleSpy.mockRestore();
      });

      it('should handle 500 Internal Server Error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: vi.fn().mockResolvedValue('{"message":"Internal server error"}')
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const message = createTextMessage('Test message');
        
        const result = await sendLineReply(mockConfig.accessToken, mockConfig.replyToken, [message]);

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
          'LINE API error:',
          500,
          '{"message":"Internal server error"}'
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe('pushLineMessage error handling', () => {
      it('should handle 404 User Not Found', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: vi.fn().mockResolvedValue('{"message":"User not found"}')
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const message = createTextMessage('Push message');
        
        const result = await pushLineMessage(mockConfig.accessToken, 'non-existent-user', [message]);

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
          'LINE Push API error:',
          404,
          '{"message":"User not found"}'
        );
        
        consoleSpy.mockRestore();
      });

      it('should handle 400 Invalid Message Format', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: vi.fn().mockResolvedValue('{"message":"Invalid message format","details":"Text message is too long"}')
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const longMessage = createTextMessage('a'.repeat(5001)); // Exceeds LINE limit
        
        const result = await pushLineMessage(mockConfig.accessToken, mockConfig.userId, [longMessage]);

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
          'LINE Push API error:',
          400,
          '{"message":"Invalid message format","details":"Text message is too long"}'
        );
        
        consoleSpy.mockRestore();
      });
    });

    describe('Profile API error handling', () => {
      it('should handle user profile 404 error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: vi.fn().mockResolvedValue('{"message":"User profile not found"}')
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        const result = await getLineUserProfile(mockConfig.accessToken, 'non-existent-user');

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          'LINE Profile API error:',
          404,
          '{"message":"User profile not found"}'
        );
        
        consoleSpy.mockRestore();
      });

      it('should handle group member profile 403 error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: vi.fn().mockResolvedValue('{"message":"Bot is not in the group"}')
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        const result = await getLineGroupMemberProfile(mockConfig.accessToken, 'invalid-group', mockConfig.userId);

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          'LINE Group Member API error:',
          403,
          '{"message":"Bot is not in the group"}'
        );
        
        consoleSpy.mockRestore();
      });
    });
  });

  describe('Network and Connection Errors', () => {
    it('should handle network timeout', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';
      mockFetch.mockRejectedValueOnce(timeoutError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const message = createTextMessage('Test message');
      
      const result = await sendLineReply(mockConfig.accessToken, mockConfig.replyToken, [message]);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to send LINE message:', timeoutError);
      
      consoleSpy.mockRestore();
    });

    it('should handle DNS resolution failure', async () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND api.line.me');
      dnsError.name = 'DNSError';
      mockFetch.mockRejectedValueOnce(dnsError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const message = createTextMessage('Test message');
      
      const result = await pushLineMessage(mockConfig.accessToken, mockConfig.userId, [message]);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to push LINE message:', dnsError);
      
      consoleSpy.mockRestore();
    });

    it('should handle connection refused', async () => {
      const connectionError = new Error('connect ECONNREFUSED 127.0.0.1:443');
      connectionError.name = 'ConnectionError';
      mockFetch.mockRejectedValueOnce(connectionError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await getLineUserProfile(mockConfig.accessToken, mockConfig.userId);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get LINE user profile:', connectionError);
      
      consoleSpy.mockRestore();
    });

    it('should handle SSL/TLS errors', async () => {
      const sslError = new Error('unable to verify the first certificate');
      sslError.name = 'SSLError';
      mockFetch.mockRejectedValueOnce(sslError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await getLineGroupMemberProfile(mockConfig.accessToken, mockConfig.groupId, mockConfig.userId);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get LINE group member profile:', sslError);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Malformed Response Handling', () => {
    it('should handle invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new Error('Unexpected token in JSON'))
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await getLineUserProfile(mockConfig.accessToken, mockConfig.userId);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get LINE user profile:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle empty response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('')
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const message = createTextMessage('Test message');
      
      const result = await sendLineReply(mockConfig.accessToken, mockConfig.replyToken, [message]);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('LINE API error:', 400, '');
      
      consoleSpy.mockRestore();
    });

    it('should handle response text parsing error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockRejectedValue(new Error('Failed to read response body'))
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const message = createTextMessage('Test message');
      
      const result = await pushLineMessage(mockConfig.accessToken, mockConfig.userId, [message]);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to push LINE message:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Signature Verification Error Scenarios', () => {
    it('should handle crypto API unavailable', async () => {
      // Temporarily remove crypto API
      const originalCrypto = global.crypto;
      delete (global as any).crypto;

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await verifyLineSignature('{"test": "data"}', 'sha256=signature', mockConfig.channelSecret);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Signature verification error:', expect.any(Error));
      
      // Restore crypto API
      global.crypto = originalCrypto;
      consoleSpy.mockRestore();
    });

    it('should handle key import failure', async () => {
      mockCrypto.subtle.importKey.mockRejectedValueOnce(new Error('Key import failed'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await verifyLineSignature('{"test": "data"}', 'sha256=signature', mockConfig.channelSecret);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Signature verification error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle HMAC signing failure', async () => {
      mockCrypto.subtle.importKey.mockResolvedValueOnce('mock-key');
      mockCrypto.subtle.sign.mockRejectedValueOnce(new Error('HMAC signing failed'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await verifyLineSignature('{"test": "data"}', 'sha256=signature', mockConfig.channelSecret);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Signature verification error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should handle base64 encoding failure', async () => {
      mockCrypto.subtle.importKey.mockResolvedValueOnce('mock-key');
      mockCrypto.subtle.sign.mockResolvedValueOnce(new ArrayBuffer(16));
      (global.btoa as any).mockImplementation(() => {
        throw new Error('Base64 encoding failed');
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await verifyLineSignature('{"test": "data"}', 'sha256=signature', mockConfig.channelSecret);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Signature verification error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Edge Case Error Scenarios', () => {
    it('should handle extremely large message payload', async () => {
      const hugeMessage = createTextMessage('x'.repeat(100000)); // Way beyond LINE limits
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        text: vi.fn().mockResolvedValue('{"message":"Payload too large"}')
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await sendLineReply(mockConfig.accessToken, mockConfig.replyToken, [hugeMessage]);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('LINE API error:', 413, '{"message":"Payload too large"}');
      
      consoleSpy.mockRestore();
    });

    it('should handle invalid sticker IDs', async () => {
      const invalidSticker = createStickerMessage('invalid-package', 'invalid-sticker');
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('{"message":"Invalid sticker","details":"Sticker not found"}')
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await sendLineReply(mockConfig.accessToken, mockConfig.replyToken, [invalidSticker]);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('LINE API error:', 400, '{"message":"Invalid sticker","details":"Sticker not found"}');
      
      consoleSpy.mockRestore();
    });

    it('should handle expired reply token', async () => {
      const expiredReplyToken = 'expired-reply-token-123';
      const message = createTextMessage('Test message');
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('{"message":"Invalid reply token","details":"Reply token has expired"}')
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await sendLineReply(mockConfig.accessToken, expiredReplyToken, [message]);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('LINE API error:', 400, '{"message":"Invalid reply token","details":"Reply token has expired"}');
      
      consoleSpy.mockRestore();
    });

    it('should handle service maintenance mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue('{"message":"Service temporarily unavailable","retryAfter":"2024-02-15T10:00:00Z"}')
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const message = createTextMessage('Test message');
      
      const result = await pushLineMessage(mockConfig.accessToken, mockConfig.userId, [message]);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('LINE Push API error:', 503, '{"message":"Service temporarily unavailable","retryAfter":"2024-02-15T10:00:00Z"}');
      
      consoleSpy.mockRestore();
    });
  });
});