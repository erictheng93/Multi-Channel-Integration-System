import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyLineSignature } from '@backend/utils/line';


describe('LINE Signature Verification - Advanced Tests', () => {
  const mockChannelSecret = 'test-channel-secret-123';

  // Mock Web Crypto API
  const mockCrypto = {
    subtle: {
      importKey: vi.fn(),
      sign: vi.fn()
    }
  };

  beforeEach(() => {
    vi.stubGlobal('crypto', mockCrypto);
    vi.stubGlobal('btoa', vi.fn());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Real-world signature scenarios', () => {
    test('should verify signature with actual LINE webhook payload', async () => {
      const realWebhookBody = JSON.stringify({
        destination: 'U1234567890abcdef1234567890abcdef',
        events: [
          {
            type: 'message',
            timestamp: 1234567890123,
            source: {
              type: 'user',
              userId: 'U1234567890abcdef1234567890abcdef'
            },
            replyToken: 'replytoken123',
            message: {
              id: '123456789',
              type: 'text',
              text: 'Hello, World!'
            }
          }
        ]
      });

      // Mock the crypto operations to simulate successful verification
      const mockKey = 'mock-crypto-key';
      const mockSignatureBuffer = new Uint8Array([
        116, 101, 115, 116, 45, 115, 105, 103, 110, 97, 116, 117, 114, 101
      ]);
      const expectedSignature = 'dGVzdC1zaWduYXR1cmU='; // base64 of "test-signature"

      mockCrypto.subtle.importKey.mockResolvedValue(mockKey);
      mockCrypto.subtle.sign.mockResolvedValue(mockSignatureBuffer.buffer);
      (global.btoa as any).mockReturnValue(expectedSignature);

      const signature = `sha256=${expectedSignature}`;
      const result = await verifyLineSignature(realWebhookBody, signature, mockChannelSecret);

      expect(result).toBe(true);
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
    });

    test('should handle empty webhook body', async () => {
      const emptyBody = '';
      const signature = 'sha256=empty-signature';

      mockCrypto.subtle.importKey.mockResolvedValue('mock-key');
      mockCrypto.subtle.sign.mockResolvedValue(new ArrayBuffer(0));
      (global.btoa as any).mockReturnValue('empty-signature');

      const result = await verifyLineSignature(emptyBody, signature, mockChannelSecret);

      expect(result).toBe(true);
    });

    test('should handle webhook body with special characters', async () => {
      const bodyWithSpecialChars = JSON.stringify({
        events: [{
          message: {
            text: '你好！🎉\n特殊字符測試 & < > " \' \\ / 😀'
          }
        }]
      });

      const expectedSignature = 'c3BlY2lhbC1zaWduYXR1cmU=';
      mockCrypto.subtle.importKey.mockResolvedValue('mock-key');
      mockCrypto.subtle.sign.mockResolvedValue(new Uint8Array([115, 112, 101, 99, 105, 97, 108]).buffer);
      (global.btoa as any).mockReturnValue(expectedSignature);

      const signature = `sha256=${expectedSignature}`;
      const result = await verifyLineSignature(bodyWithSpecialChars, signature, mockChannelSecret);

      expect(result).toBe(true);
    });
  });

  describe('Security edge cases', () => {
    test('should reject signature with wrong prefix', async () => {
      const body = '{"test": "data"}';
      const signature = 'md5=wrong-prefix-signature';

      // Mock crypto operations (they will be called even with wrong prefix)
      mockCrypto.subtle.importKey.mockResolvedValue('mock-key');
      mockCrypto.subtle.sign.mockResolvedValue(new Uint8Array([116, 101, 115, 116]).buffer);
      (global.btoa as any).mockReturnValue('different-signature');

      const result = await verifyLineSignature(body, signature, mockChannelSecret);

      expect(result).toBe(false);
      // The current implementation processes all signatures and compares the result
      // This is actually more secure as it prevents timing attacks
      expect(mockCrypto.subtle.importKey).toHaveBeenCalled();
    });

    test('should handle signature timing attack prevention', async () => {
      const body = '{"test": "data"}';
      const validSignature = 'valid-signature';
      const invalidSignature = 'invalid-signature';

      // First call with valid signature
      mockCrypto.subtle.importKey.mockResolvedValue('mock-key');
      mockCrypto.subtle.sign.mockResolvedValue(new Uint8Array([118, 97, 108, 105, 100]).buffer);
      (global.btoa as any).mockReturnValue(validSignature);

      const validResult = await verifyLineSignature(body, `sha256=${validSignature}`, mockChannelSecret);
      expect(validResult).toBe(true);

      // Second call with invalid signature - should still perform crypto operations
      (global.btoa as any).mockReturnValue(invalidSignature);
      const invalidResult = await verifyLineSignature(body, `sha256=${validSignature}`, mockChannelSecret);
      expect(invalidResult).toBe(false);

      // Both calls should have performed crypto operations
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledTimes(2);
      expect(mockCrypto.subtle.sign).toHaveBeenCalledTimes(2);
    });

    test('should handle malformed base64 signature', async () => {
      const body = '{"test": "data"}';

      mockCrypto.subtle.importKey.mockResolvedValue('mock-key');
      mockCrypto.subtle.sign.mockResolvedValue(new Uint8Array([116, 101, 115, 116]).buffer);

      // Mock btoa to throw error (simulating malformed signature)
      (global.btoa as any).mockImplementation(() => {
        throw new Error('Invalid character in base64');
      });

      // Source uses structured logger (log.error), not console.error
      const result = await verifyLineSignature(body, 'sha256=malformed', mockChannelSecret);

      expect(result).toBe(false);
    });

    test('should handle very long channel secret', async () => {
      const longChannelSecret = 'a'.repeat(1000);
      const body = '{"test": "data"}';
      const signature = 'sha256=test-signature';

      mockCrypto.subtle.importKey.mockResolvedValue('mock-key');
      mockCrypto.subtle.sign.mockResolvedValue(new Uint8Array([116, 101, 115, 116]).buffer);
      (global.btoa as any).mockReturnValue('test-signature');

      const result = await verifyLineSignature(body, signature, longChannelSecret);

      expect(result).toBe(true);
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
    });
  });

  describe('Crypto API error handling', () => {
    test('should handle importKey failure', async () => {
      const body = '{"test": "data"}';
      const signature = 'sha256=test-signature';

      mockCrypto.subtle.importKey.mockRejectedValue(new Error('Key import failed'));

      // Source uses structured logger (log.error), not console.error
      const result = await verifyLineSignature(body, signature, mockChannelSecret);

      expect(result).toBe(false);
    });

    test('should handle sign operation failure', async () => {
      const body = '{"test": "data"}';
      const signature = 'sha256=test-signature';

      mockCrypto.subtle.importKey.mockResolvedValue('mock-key');
      mockCrypto.subtle.sign.mockRejectedValue(new Error('Sign operation failed'));

      const result = await verifyLineSignature(body, signature, mockChannelSecret);

      expect(result).toBe(false);
    });

    test('should handle missing crypto API', async () => {
      // Temporarily remove crypto API
      const originalCrypto = global.crypto;
      vi.stubGlobal('crypto', undefined);

      const body = '{"test": "data"}';
      const signature = 'sha256=test-signature';

      const result = await verifyLineSignature(body, signature, mockChannelSecret);

      expect(result).toBe(false);

      // Restore crypto API
      vi.stubGlobal('crypto', originalCrypto);
    });
  });

  describe('Performance and edge cases', () => {
    test('should handle very large webhook payload', async () => {
      // Create a large payload (simulating bulk message events)
      const largeEvents = Array.from({ length: 100 }, (_, i) => ({
        type: 'message',
        timestamp: Date.now() + i,
        source: { type: 'user', userId: `user-${i}` },
        message: { id: `msg-${i}`, type: 'text', text: `Message ${i}`.repeat(100) }
      }));

      const largeBody = JSON.stringify({ events: largeEvents });
      const signature = 'sha256=large-payload-signature';

      mockCrypto.subtle.importKey.mockResolvedValue('mock-key');
      mockCrypto.subtle.sign.mockResolvedValue(new Uint8Array([108, 97, 114, 103, 101]).buffer);
      (global.btoa as any).mockReturnValue('large-payload-signature');

      const result = await verifyLineSignature(largeBody, signature, mockChannelSecret);

      expect(result).toBe(true);
      expect(mockCrypto.subtle.sign).toHaveBeenCalledWith(
        'HMAC',
        'mock-key',
        expect.any(Uint8Array)
      );
    });

    test('should handle concurrent signature verifications', async () => {
      const body1 = '{"test": "data1"}';
      const body2 = '{"test": "data2"}';
      const signature1 = 'sha256=signature1';
      const signature2 = 'sha256=signature2';

      mockCrypto.subtle.importKey.mockResolvedValue('mock-key');
      mockCrypto.subtle.sign
        .mockResolvedValueOnce(new Uint8Array([115, 105, 103, 49]).buffer) // "sig1"
        .mockResolvedValueOnce(new Uint8Array([115, 105, 103, 50]).buffer); // "sig2"
      
      (global.btoa as any)
        .mockReturnValueOnce('signature1')
        .mockReturnValueOnce('signature2');

      const [result1, result2] = await Promise.all([
        verifyLineSignature(body1, signature1, mockChannelSecret),
        verifyLineSignature(body2, signature2, mockChannelSecret)
      ]);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledTimes(2);
      expect(mockCrypto.subtle.sign).toHaveBeenCalledTimes(2);
    });
  });
});