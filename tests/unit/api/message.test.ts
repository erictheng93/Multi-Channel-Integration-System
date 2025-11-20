// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/unit/api/message.test.ts
// Created by: API Test Developer

import { describe, it, expect, vi, beforeEach } from 'vitest';
iimport { MockFactory } from '@helpers/mockFactory';
mport { messageApi, type SendMessageRequest } from '@/api/message';
import { apiClient } from '@/api/base';

// Mock the base API client
vi.mock('../../../frontend/src/api/base', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

const mockApiClient = vi.mocked(apiClient);

describe('Messages API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });


  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe('Message List Retrieval', () => {
    test('should get messages for conversation', async () => {
      const conversationId = 'conv-123';
      const mockMessages = [
        {
          id: 'msg-1',
          conversationId,
          senderId: 'customer-1',
          senderType: 'customer' as const,
          content: 'Hello, I need help',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          createdAt: new Date('2024-01-15T10:00:00Z'),
          platform: 'line' as const,
          messageType: 'text' as const
        },
        {
          id: 'msg-2',
          conversationId,
          senderId: 'agent-1',
          senderType: 'agent' as const,
          content: 'How can I assist you?',
          timestamp: new Date('2024-01-15T10:01:00Z'),
          createdAt: new Date('2024-01-15T10:01:00Z'),
          platform: 'line' as const,
          messageType: 'text' as const
        }
      ];

      const mockResponse = {
        success: true,
        data: mockMessages
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.list(conversationId);

      expect(mockApiClient.get).toHaveBeenCalledWith(`/api/conversations/${conversationId}/messages`);
      expect(result).toEqual(mockResponse);
    });

    test('should handle empty message list', async () => {
      const conversationId = 'conv-empty';
      const mockResponse = {
        success: true,
        data: []
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.list(conversationId);

      expect(mockApiClient.get).toHaveBeenCalledWith(`/api/conversations/${conversationId}/messages`);
      expect(result).toEqual(mockResponse);
    });

    test('should handle conversation not found', async () => {
      const conversationId = 'non-existent';
      const mockResponse = {
        success: false,
        error: '對話不存在'
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.list(conversationId);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Message Sending', () => {
    test('should send text message to LINE platform', async () => {
      const conversationId = 'conv-123';
      const messageData: SendMessageRequest = {
        content: 'Thank you for contacting us!',
        platform: 'line'
      };

      const mockMessage = {
        id: 'msg-new-1',
        conversationId,
        senderId: 'agent-1',
        senderType: 'agent' as const,
        content: messageData.content,
        timestamp: new Date(),
        createdAt: new Date(),
        platform: 'line' as const,
        messageType: 'text' as const
      };

      const mockResponse = {
        success: true,
        data: mockMessage
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.send(conversationId, messageData);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/api/conversations/${conversationId}/messages`,
        messageData
      );
      expect(result).toEqual(mockResponse);
    });

    test('should send text message to Facebook platform', async () => {
      const conversationId = 'conv-456';
      const messageData: SendMessageRequest = {
        content: 'We will help you shortly',
        platform: 'facebook'
      };

      const mockMessage = {
        id: 'msg-new-2',
        conversationId,
        senderId: 'agent-2',
        senderType: 'agent' as const,
        content: messageData.content,
        timestamp: new Date(),
        createdAt: new Date(),
        platform: 'facebook' as const,
        messageType: 'text' as const
      };

      const mockResponse = {
        success: true,
        data: mockMessage
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.send(conversationId, messageData);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/api/conversations/${conversationId}/messages`,
        messageData
      );
      expect(result).toEqual(mockResponse);
    });

    test('should handle message sending failure', async () => {
      const conversationId = 'conv-123';
      const messageData: SendMessageRequest = {
        content: 'Test message',
        platform: 'line'
      };

      const mockResponse = {
        success: false,
        error: '訊息發送失敗'
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.send(conversationId, messageData);

      expect(result).toEqual(mockResponse);
    });

    test('should handle platform-specific sending errors', async () => {
      const conversationId = 'conv-123';
      const messageData: SendMessageRequest = {
        content: 'Test message',
        platform: 'line'
      };

      const mockResponse = {
        success: false,
        error: 'LINE API 錯誤：訊息格式不正確'
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.send(conversationId, messageData);

      expect(result).toEqual(mockResponse);
    });

    test('should validate message content length', async () => {
      const conversationId = 'conv-123';
      const longContent = 'A'.repeat(5001); // Assuming 5000 char limit
      const messageData: SendMessageRequest = {
        content: longContent,
        platform: 'line'
      };

      const mockResponse = {
        success: false,
        error: '訊息內容過長'
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.send(conversationId, messageData);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Mark as Read Functionality', () => {
    test('should mark messages as read', async () => {
      const conversationId = 'conv-123';

      const mockResponse = {
        success: true,
        data: undefined
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.markAsRead(conversationId);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/api/conversations/${conversationId}/messages/read`
      );
      expect(result).toEqual(mockResponse);
    });

    test('should handle mark as read failure', async () => {
      const conversationId = 'conv-123';

      const mockResponse = {
        success: false,
        error: '標記已讀失敗'
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.markAsRead(conversationId);

      expect(result).toEqual(mockResponse);
    });

    test('should handle unauthorized mark as read', async () => {
      const conversationId = 'conv-123';

      const mockResponse = {
        success: false,
        error: '無權限標記此對話為已讀'
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.markAsRead(conversationId);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Request Format Validation', () => {
    test('should send message with correct request format', async () => {
      const conversationId = 'conv-test';
      const messageData: SendMessageRequest = {
        content: 'Hello world',
        platform: 'line'
      };

      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        data: {}
      });

      await messageApi.send(conversationId, messageData);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/api/conversations/${conversationId}/messages`,
        expect.objectContaining({
          content: expect.any(String),
          platform: expect.stringMatching(/^(line|facebook|instagram|whatsapp)$/)
        })
      );
    });

    test('should validate platform parameter', async () => {
      const conversationId = 'conv-test';
      const messageData: SendMessageRequest = {
        content: 'Test message',
        platform: 'instagram'
      };

      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        data: {}
      });

      await messageApi.send(conversationId, messageData);

      const callArgs = mockApiClient.post.mock.calls[0][1];
      expect(['line', 'facebook', 'instagram', 'whatsapp']).toContain(callArgs.platform);
    });

    test('should handle empty message content', async () => {
      const conversationId = 'conv-test';
      const messageData: SendMessageRequest = {
        content: '',
        platform: 'line'
      };

      const mockResponse = {
        success: false,
        error: '訊息內容不能為空'
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.send(conversationId, messageData);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Response Data Transformation', () => {
    test('should return properly typed message response', async () => {
      const conversationId = 'conv-123';
      const messageData: SendMessageRequest = {
        content: 'Type test message',
        platform: 'line'
      };

      const mockMessage = {
        id: 'msg-typed-1',
        conversationId,
        senderId: 'agent-1',
        senderType: 'agent' as const,
        content: messageData.content,
        timestamp: new Date('2024-01-15T12:00:00Z'),
        createdAt: new Date('2024-01-15T12:00:00Z'),
        platform: 'line' as const,
        messageType: 'text' as const
      };

      const mockResponse = {
        success: true,
        data: mockMessage
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.send(conversationId, messageData);

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(typeof result.data.id).toBe('string');
        expect(typeof result.data.conversationId).toBe('string');
        expect(typeof result.data.senderId).toBe('string');
        expect(['customer', 'agent']).toContain(result.data.senderType);
        expect(typeof result.data.content).toBe('string');
        expect(result.data.timestamp).toBeInstanceOf(Date);
        expect(result.data.createdAt).toBeInstanceOf(Date);
        expect(['line', 'facebook', 'instagram', 'whatsapp']).toContain(result.data.platform);
        expect(['text', 'image', 'file']).toContain(result.data.messageType);
      }
    });

    test('should return properly typed message list response', async () => {
      const conversationId = 'conv-123';
      const mockMessages = [
        {
          id: 'msg-1',
          conversationId,
          senderId: 'customer-1',
          senderType: 'customer' as const,
          content: 'Hello',
          timestamp: new Date(),
          createdAt: new Date(),
          platform: 'line' as const,
          messageType: 'text' as const
        }
      ];

      const mockResponse = {
        success: true,
        data: mockMessages
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.list(conversationId);

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(Array.isArray(result.data)).toBe(true);
        if (result.data.length > 0) {
          const message = result.data[0];
          expect(typeof message.id).toBe('string');
          expect(typeof message.conversationId).toBe('string');
          expect(['customer', 'agent']).toContain(message.senderType);
          expect(['line', 'facebook', 'instagram', 'whatsapp']).toContain(message.platform);
          expect(['text', 'image', 'file']).toContain(message.messageType);
        }
      }
    });
  });

  describe('Error Scenarios', () => {
    test('should handle network timeout', async () => {
      const conversationId = 'conv-123';

      const mockResponse = {
        success: false,
        error: '網路連線逾時'
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.list(conversationId);

      expect(result).toEqual(mockResponse);
    });

    test('should handle server error during message send', async () => {
      const conversationId = 'conv-123';
      const messageData: SendMessageRequest = {
        content: 'Test message',
        platform: 'line'
      };

      const mockResponse = {
        success: false,
        error: '伺服器內部錯誤'
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await messageApi.send(conversationId, messageData);

      expect(result).toEqual(mockResponse);
    });
  });
});