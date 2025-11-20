// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/unit/api/conversations.test.ts
// Created by: API Test Developer

import { describe, it, expect, vi, beforeEacimport { MockFactory } from '@helpers/mockFactory';
h } from 'vitest';
import { conversationApi } from '@/api/conversations';
import { apiClient } from '@/api/base';

// Mock the base API client
vi.mock('../../../frontend/src/api/base', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn()
  }
}));

const mockApiClient = vi.mocked(apiClient);

describe('Conversations API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });


  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe('Conversation List Retrieval', () => {
    test('should get conversations without filters', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          customerId: 'customer-1',
          customer: {
            id: 'customer-1',
            name: 'John Doe',
            platform: 'line',
            platformUserId: 'line-user-1'
          },
          platform: 'line',
          status: 'open',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const mockResponse = {
        success: true,
        data: mockConversations
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.getConversations();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/conversations');
      expect(result).toEqual(mockResponse);
    });

    test('should get conversations with filters', async () => {
      const filters = {
        status: 'open' as const,
        platform: 'line' as const,
        assignedTo: 'agent-1'
      };

      const mockResponse = {
        success: true,
        data: []
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.getConversations(filters);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/conversations?')
      );
      expect(result).toEqual(mockResponse);
    });

    test('should get paginated conversations', async () => {
      const params = {
        page: 1,
        pageSize: 10,
        status: 'assigned',
        platform: 'facebook'
      };

      const mockResponse = {
        success: true,
        data: {
          items: [],
          total: 0
        }
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.list(params);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/conversations?page=1&pageSize=10&status=assigned&platform=facebook'
      );
      expect(result).toEqual(mockResponse);
    });

    test('should handle empty pagination parameters', async () => {
      const mockResponse = {
        success: true,
        data: { items: [], total: 0 }
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.list({});

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/conversations');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Single Conversation Retrieval', () => {
    test('should get single conversation by ID', async () => {
      const conversationId = 'conv-123';
      const mockConversation = {
        id: conversationId,
        customerId: 'customer-1',
        customer: {
          id: 'customer-1',
          name: 'Jane Doe',
          platform: 'line',
          platformUserId: 'line-user-2'
        },
        platform: 'line',
        status: 'assigned',
        assignedAgentId: 'agent-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockResponse = {
        success: true,
        data: mockConversation
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.getConversation(conversationId);

      expect(mockApiClient.get).toHaveBeenCalledWith(`/api/conversations/${conversationId}`);
      expect(result).toEqual(mockResponse);
    });

    test('should use alias method for getting conversation', async () => {
      const conversationId = 'conv-456';
      const mockResponse = {
        success: true,
        data: {}
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.get(conversationId);

      expect(mockApiClient.get).toHaveBeenCalledWith(`/api/conversations/${conversationId}`);
      expect(result).toEqual(mockResponse);
    });

    test('should handle conversation not found', async () => {
      const conversationId = 'non-existent';
      const mockResponse = {
        success: false,
        error: '對話不存在'
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.getConversation(conversationId);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Message Management', () => {
    test('should get messages for conversation', async () => {
      const conversationId = 'conv-123';
      const mockMessages = [
        {
          id: 'msg-1',
          conversationId,
          senderId: 'customer-1',
          senderType: 'customer',
          content: 'Hello',
          timestamp: new Date(),
          createdAt: new Date(),
          platform: 'line',
          messageType: 'text'
        }
      ];

      const mockResponse = {
        success: true,
        data: mockMessages
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.getMessages(conversationId);

      expect(mockApiClient.get).toHaveBeenCalledWith(`/api/conversations/${conversationId}/messages`);
      expect(result).toEqual(mockResponse);
    });

    test('should send message to conversation', async () => {
      const conversationId = 'conv-123';
      const content = 'Hello, how can I help you?';

      const mockMessage = {
        id: 'msg-2',
        conversationId,
        senderId: 'agent-1',
        senderType: 'agent',
        content,
        timestamp: new Date(),
        createdAt: new Date(),
        platform: 'line',
        messageType: 'text'
      };

      const mockResponse = {
        success: true,
        data: mockMessage
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.sendMessage(conversationId, content);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/api/conversations/${conversationId}/messages`,
        { content }
      );
      expect(result).toEqual(mockResponse);
    });

    test('should handle message sending failure', async () => {
      const conversationId = 'conv-123';
      const content = 'Test message';

      const mockResponse = {
        success: false,
        error: '訊息發送失敗'
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.sendMessage(conversationId, content);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Conversation Assignment', () => {
    test('should assign conversation to agent', async () => {
      const conversationId = 'conv-123';
      const agentId = 'agent-1';

      const mockResponse = {
        success: true,
        data: undefined
      };

      mockApiClient.put.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.assignConversation(conversationId, agentId);

      expect(mockApiClient.put).toHaveBeenCalledWith(
        `/api/conversations/${conversationId}/assign`,
        { agentId }
      );
      expect(result).toEqual(mockResponse);
    });

    test('should use alias method for assignment', async () => {
      const conversationId = 'conv-456';
      const agentId = 'agent-2';

      const mockResponse = {
        success: true,
        data: undefined
      };

      mockApiClient.put.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.assign(conversationId, agentId);

      expect(mockApiClient.put).toHaveBeenCalledWith(
        `/api/conversations/${conversationId}/assign`,
        { agentId }
      );
      expect(result).toEqual(mockResponse);
    });

    test('should handle assignment failure', async () => {
      const conversationId = 'conv-123';
      const agentId = 'invalid-agent';

      const mockResponse = {
        success: false,
        error: '指派失敗：客服不存在'
      };

      mockApiClient.put.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.assignConversation(conversationId, agentId);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Conversation Closing', () => {
    test('should close conversation', async () => {
      const conversationId = 'conv-123';

      const mockResponse = {
        success: true,
        data: undefined
      };

      mockApiClient.put.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.closeConversation(conversationId);

      expect(mockApiClient.put).toHaveBeenCalledWith(`/api/conversations/${conversationId}/close`);
      expect(result).toEqual(mockResponse);
    });

    test('should use alias method for closing', async () => {
      const conversationId = 'conv-456';

      const mockResponse = {
        success: true,
        data: undefined
      };

      mockApiClient.put.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.close(conversationId);

      expect(mockApiClient.put).toHaveBeenCalledWith(`/api/conversations/${conversationId}/close`);
      expect(result).toEqual(mockResponse);
    });

    test('should handle closing failure', async () => {
      const conversationId = 'conv-123';

      const mockResponse = {
        success: false,
        error: '關閉對話失敗'
      };

      mockApiClient.put.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.closeConversation(conversationId);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Mark as Read Functionality', () => {
    test('should mark conversation as read', async () => {
      const conversationId = 'conv-123';

      const mockResponse = {
        success: true,
        data: undefined
      };

      mockApiClient.put.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.markAsRead(conversationId);

      expect(mockApiClient.put).toHaveBeenCalledWith(`/api/conversations/${conversationId}/read`);
      expect(result).toEqual(mockResponse);
    });

    test('should handle mark as read failure', async () => {
      const conversationId = 'conv-123';

      const mockResponse = {
        success: false,
        error: '標記已讀失敗'
      };

      mockApiClient.put.mockResolvedValueOnce(mockResponse);

      const result = await conversationApi.markAsRead(conversationId);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Query Parameter Handling', () => {
    test('should properly encode query parameters', async () => {
      const filters = {
        status: 'open',
        platform: 'line',
        assignedTo: 'agent with spaces'
      };

      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: []
      });

      await conversationApi.getConversations(filters);

      const callUrl = mockApiClient.get.mock.calls[0][0];
      expect(callUrl).toContain('status=open');
      expect(callUrl).toContain('platform=line');
      // URLSearchParams encodes spaces as + not %20
      expect(callUrl).toContain('assignedTo=agent+with+spaces');
    });

    test('should handle undefined filter values', async () => {
      const filters = {
        status: 'open' as const,
        platform: undefined,
        assignedTo: undefined
      };

      mockApiClient.get.mockResolvedValueOnce({
        success: true,
        data: []
      });

      await conversationApi.getConversations(filters);

      const callUrl = mockApiClient.get.mock.calls[0][0];
      expect(callUrl).toContain('status=open');
      // URLSearchParams will include undefined values as string 'undefined'
      expect(callUrl).toContain('platform=undefined');
      expect(callUrl).toContain('assignedTo=undefined');
    });
  });
});