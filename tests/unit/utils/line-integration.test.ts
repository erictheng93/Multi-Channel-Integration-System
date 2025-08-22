import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendLineReply,
  pushLineMessage,
  verifyLineSignature,
  getLineUserProfile,
  getLineGroupMemberProfile,
  createTextMessage,
  createStickerMessage
} from '@backend/utils/line';

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

describe('LINE Integration - End-to-End Scenarios', () => {
  const mockConfig = {
    accessToken: 'test-channel-access-token-123',
    channelSecret: 'test-channel-secret-456',
    replyToken: 'reply-token-789',
    userId: 'U1234567890abcdef1234567890abcdef',
    groupId: 'G1234567890abcdef1234567890abcdef'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    mockFetch.mockReset();
    // Setup default crypto mocks
    mockCrypto.subtle.importKey.mockResolvedValue('mock-key');
    mockCrypto.subtle.sign.mockResolvedValue(new Uint8Array([116, 101, 115, 116]).buffer);
    (global.btoa as any).mockReturnValue('dGVzdA==');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete webhook processing flow', () => {
    it('should handle incoming webhook with signature verification and reply', async () => {
      const webhookBody = JSON.stringify({
        destination: 'U1234567890abcdef1234567890abcdef',
        events: [{
          type: 'message',
          timestamp: Date.now(),
          source: {
            type: 'user',
            userId: mockConfig.userId
          },
          replyToken: mockConfig.replyToken,
          message: {
            id: 'msg123',
            type: 'text',
            text: 'Hello, I need help!'
          }
        }]
      });

      const signature = 'sha256=dGVzdA==';

      // Step 1: Verify signature
      const isValidSignature = await verifyLineSignature(webhookBody, signature, mockConfig.channelSecret);
      expect(isValidSignature).toBe(true);

      // Step 2: Send reply
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const replyMessages = [
        createTextMessage('Hello! How can I help you today?'),
        createStickerMessage('1', '1')
      ];

      const replyResult = await sendLineReply(mockConfig.accessToken, mockConfig.replyToken, replyMessages);
      expect(replyResult).toBe(true);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/reply',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${mockConfig.accessToken}`,
          },
          body: JSON.stringify({
            replyToken: mockConfig.replyToken,
            messages: replyMessages,
            notificationDisabled: false
          })
        })
      );
    });

    it('should handle user profile fetching and personalized response', async () => {
      const mockProfile = {
        userId: mockConfig.userId,
        displayName: 'John Doe',
        pictureUrl: 'https://example.com/avatar.jpg',
        statusMessage: 'Happy coding!'
      };

      // Step 1: Get user profile
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockProfile)
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const profile = await getLineUserProfile(mockConfig.accessToken, mockConfig.userId);
      expect(profile).toEqual(mockProfile);

      // Step 2: Send personalized message
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const personalizedMessage = createTextMessage(`Hello ${profile?.displayName}! Welcome to our service.`);
      const pushResult = await pushLineMessage(mockConfig.accessToken, mockConfig.userId, [personalizedMessage]);
      
      expect(pushResult).toBe(true);
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          body: JSON.stringify({
            to: mockConfig.userId,
            messages: [personalizedMessage],
            notificationDisabled: false
          })
        })
      );

      consoleSpy.mockRestore();
    });

    it('should handle group conversation with member profile', async () => {
      const mockMemberProfile = {
        userId: mockConfig.userId,
        displayName: 'Group Member',
        pictureUrl: 'https://example.com/group-avatar.jpg'
      };

      // Step 1: Get group member profile
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockMemberProfile)
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const memberProfile = await getLineGroupMemberProfile(
        mockConfig.accessToken,
        mockConfig.groupId,
        mockConfig.userId
      );
      expect(memberProfile).toEqual(mockMemberProfile);

      // Step 2: Reply in group context
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const groupReplyMessage = createTextMessage(`@${memberProfile?.displayName} Thanks for your message in the group!`);
      const replyResult = await sendLineReply(mockConfig.accessToken, mockConfig.replyToken, [groupReplyMessage]);
      
      expect(replyResult).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('Error handling and recovery scenarios', () => {
    it('should handle signature verification failure gracefully', async () => {
      const webhookBody = '{"events":[]}';
      const invalidSignature = 'sha256=invalid-signature';

      // Mock crypto to return different signature
      (global.btoa as any).mockReturnValue('different-signature');

      const isValidSignature = await verifyLineSignature(webhookBody, invalidSignature, mockConfig.channelSecret);
      expect(isValidSignature).toBe(false);

      // In real implementation, message sending would be skipped due to invalid signature
      // This test verifies that signature verification correctly identifies invalid signatures
      expect(isValidSignature).toBe(false);
    });

    it('should handle API rate limiting with exponential backoff simulation', async () => {
      const messages = [createTextMessage('Rate limited message')];

      // First attempt - rate limited
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue('Rate limit exceeded')
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const firstAttempt = await sendLineReply(mockConfig.accessToken, mockConfig.replyToken, messages);
      expect(firstAttempt).toBe(false);

      // Second attempt - success (simulating retry after backoff)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const secondAttempt = await sendLineReply(mockConfig.accessToken, mockConfig.replyToken, messages);
      expect(secondAttempt).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should handle partial failure in batch operations', async () => {
      const userId1 = 'user1';
      const userId2 = 'user2';
      const message = createTextMessage('Broadcast message');

      // First user - success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const result1 = await pushLineMessage(mockConfig.accessToken, userId1, [message]);
      expect(result1).toBe(true);

      // Second user - failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue('User not found')
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result2 = await pushLineMessage(mockConfig.accessToken, userId2, [message]);
      expect(result2).toBe(false);

      // Verify both operations were attempted
      expect(mockFetch).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });

  describe('Performance and scalability scenarios', () => {
    beforeEach(() => {
      // Ensure clean state for performance tests
      expect(mockFetch).toHaveBeenCalledTimes(0);
    });

    it('should handle concurrent message sending', async () => {
      const users = ['user1', 'user2', 'user3', 'user4', 'user5'];
      const message = createTextMessage('Concurrent broadcast');

      // Mock all requests to succeed
      users.forEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200
        });
      });

      const promises: Promise<boolean>[] = users.map(userId => 
        pushLineMessage(mockConfig.accessToken, userId, [message])
      );

      const results = await Promise.all(promises);

      expect(results).toEqual([true, true, true, true, true]);
      expect(mockFetch).toHaveBeenCalledTimes(users.length);
      
      // Verify each call was made with correct parameters
      users.forEach((userId, index) => {
        expect(mockFetch).toHaveBeenNthCalledWith(index + 1,
          'https://api.line.me/v2/bot/message/push',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${mockConfig.accessToken}`,
            },
            body: JSON.stringify({
              to: userId,
              messages: [message],
              notificationDisabled: false
            })
          })
        );
      });
    });

    it('should handle large message batches', async () => {
      const largeTextMessage = createTextMessage('A'.repeat(4000)); // Near LINE's 5000 char limit
      const messages = [
        largeTextMessage,
        createStickerMessage('1', '1'),
        createTextMessage('Additional info'),
        createTextMessage('More details'),
        createTextMessage('Final message')
      ]; // Maximum 5 messages per request

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const result = await sendLineReply(mockConfig.accessToken, mockConfig.replyToken, messages);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/reply',
        expect.objectContaining({
          body: JSON.stringify({
            replyToken: mockConfig.replyToken,
            messages: messages,
            notificationDisabled: false
          })
        })
      );
    });

    it('should handle rapid sequential API calls', async () => {
      const rapidCalls = 10;
      const message = createTextMessage('Rapid call test');

      // Mock all calls to succeed
      for (let i = 0; i < rapidCalls; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200
        });
      }

      const startTime = Date.now();
      const promises: Promise<boolean>[] = [];

      for (let i = 0; i < rapidCalls; i++) {
        promises.push(
          pushLineMessage(mockConfig.accessToken, `user${i}`, [message])
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results.every(result => result === true)).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(rapidCalls);
      
      // Verify calls completed in reasonable time (should be fast with mocks)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Real-world integration patterns', () => {
    it('should simulate customer service conversation flow', async () => {
      // Simulate incoming customer message (this would come from webhook)
      const incomingMessage = {
        type: 'message' as const,
        timestamp: Date.now(),
        source: { type: 'user' as const, userId: mockConfig.userId },
        replyToken: mockConfig.replyToken,
        message: { id: 'msg1', type: 'text' as const, text: 'I have a problem with my order' }
      };

      // Get customer profile
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          userId: mockConfig.userId,
          displayName: 'Customer Name',
          pictureUrl: 'https://example.com/customer.jpg'
        })
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const profile = await getLineUserProfile(mockConfig.accessToken, mockConfig.userId);

      // Verify we got the profile
      expect(profile).toBeTruthy();
      expect(profile?.displayName).toBe('Customer Name');

      // Send acknowledgment
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const acknowledgment = [
        createTextMessage(`Hello ${profile?.displayName}! I understand you have an issue with your order.`),
        createTextMessage('Let me help you with that. Could you please provide your order number?'),
        createStickerMessage('11537', '52002734') // Supportive sticker
      ];

      const ackResult = await sendLineReply(mockConfig.accessToken, incomingMessage.replyToken, acknowledgment);
      expect(ackResult).toBe(true);

      // Later, send follow-up
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const followUp = [
        createTextMessage('Thank you for providing the order number. I\'ve found your order and will process the refund within 3-5 business days.'),
        createTextMessage('Is there anything else I can help you with today?')
      ];

      const followUpResult = await pushLineMessage(mockConfig.accessToken, mockConfig.userId, followUp);
      expect(followUpResult).toBe(true);

      // Verify all API calls were made
      expect(mockFetch).toHaveBeenCalledTimes(3); // profile + reply + push

      consoleSpy.mockRestore();
    });

    it('should handle webhook signature verification in production-like scenario', async () => {
      const realWebhookPayload = {
        destination: 'U1234567890abcdef1234567890abcdef',
        events: [
          {
            type: 'message',
            timestamp: 1640995200000,
            source: {
              type: 'user',
              userId: 'U1234567890abcdef1234567890abcdef'
            },
            replyToken: 'replytoken123456789',
            message: {
              id: '123456789012345',
              type: 'text',
              text: 'Hello from production!'
            }
          }
        ]
      };

      const webhookBody = JSON.stringify(realWebhookPayload);
      const signature = 'sha256=production-signature-hash';

      // Mock production-like signature verification
      (global.btoa as any).mockReturnValue('production-signature-hash');

      const isValid = await verifyLineSignature(webhookBody, signature, 'production-channel-secret');
      expect(isValid).toBe(true);

      // Process the webhook
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const response = createTextMessage('Hello! This is an automated response from our production system.');
      const result = await sendLineReply(
        'production-access-token',
        realWebhookPayload.events[0].replyToken!,
        [response]
      );

      expect(result).toBe(true);
    });
  });
});