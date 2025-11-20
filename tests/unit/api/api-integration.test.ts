// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/unit/api/api-integration.test.ts
// Created by: API Integration Test Developer

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/api/base';
import { import { MockFactory } from '@helpers/mockFactory';
authApi } from '@/api/auth';
import { conversationApi } from '@/api/conversations';
import { messageApi } from '@/api/message';

// Mock fetch for integration tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  removeItem: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn()
};

// Mock window.location
const mockLocation = {
  href: ''
};

// Setup global mocks
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});


  afterEach(() => {
    vi.restoreAllMocks();
  });
Object.defineProperty(global, 'window', {
  value: {
    localStorage: mockLocalStorage,
    location: mockLocation
  },
  writable: true
});

describe('API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
    apiClient.removeAuthHeader();
  });

  describe('Authentication Flow Integration', () => {
    test('should complete full authentication flow', async () => {
      // Step 1: Login
      const loginResponse = {
        success: true,
        data: {
          token: 'jwt-token-123',
          agent: {
            id: 'agent-1',
            name: 'Test Agent',
            email: 'test@example.com',
            isOnline: true,
            platforms: ['line', 'facebook'],
            role: 'agent'
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(loginResponse)
      });

      const loginResult = await authApi.login({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(loginResult.success).toBe(true);
      expect(loginResult.data?.token).toBe('jwt-token-123');

      // Step 2: Set auth header
      if (loginResult.success && loginResult.data) {
        authApi.setAuthHeader(loginResult.data.token);
      }

      // Step 3: Get user profile with auth
      const profileResponse = {
        success: true,
        data: {
          id: 'agent-1',
          name: 'Test Agent',
          email: 'test@example.com',
          isOnline: true,
          platforms: ['line', 'facebook'],
          role: 'agent'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(profileResponse)
      });

      const profileResult = await authApi.me();

      expect(profileResult.success).toBe(true);
      expect(profileResult.data?.id).toBe('agent-1');

      // Verify auth header was included
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer jwt-token-123'
          })
        })
      );
    });

    test('should handle authentication failure and redirect', async () => {
      // Mock 401 response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' })
      });

      const result = await authApi.me();

      expect(result.success).toBe(false);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
      expect(mockLocation.href).toBe('/login');
    });
  });

  describe('Conversation Management Flow', () => {
    beforeEach(() => {
      // Set up authenticated state
      authApi.setAuthHeader('valid-token');
    });

    test('should complete conversation management workflow', async () => {
      // Step 1: Get conversation list
      const conversationsResponse = {
        success: true,
        data: [
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
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(conversationsResponse)
      });

      const conversationsResult = await conversationApi.getConversations();
      expect(conversationsResult.success).toBe(true);
      expect(conversationsResult.data).toHaveLength(1);

      // Step 2: Get specific conversation
      const conversationResponse = {
        success: true,
        data: conversationsResponse.data[0]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(conversationResponse)
      });

      const conversationResult = await conversationApi.getConversation('conv-1');
      expect(conversationResult.success).toBe(true);
      expect(conversationResult.data?.id).toBe('conv-1');

      // Step 3: Assign conversation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const assignResult = await conversationApi.assignConversation('conv-1', 'agent-1');
      expect(assignResult.success).toBe(true);

      // Step 4: Get messages
      const messagesResponse = {
        success: true,
        data: [
          {
            id: 'msg-1',
            conversationId: 'conv-1',
            senderId: 'customer-1',
            senderType: 'customer',
            content: 'Hello, I need help',
            timestamp: new Date(),
            createdAt: new Date(),
            platform: 'line',
            messageType: 'text'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(messagesResponse)
      });

      const messagesResult = await conversationApi.getMessages('conv-1');
      expect(messagesResult.success).toBe(true);
      expect(messagesResult.data).toHaveLength(1);

      // Step 5: Send reply
      const sendMessageResponse = {
        success: true,
        data: {
          id: 'msg-2',
          conversationId: 'conv-1',
          senderId: 'agent-1',
          senderType: 'agent',
          content: 'How can I help you?',
          timestamp: new Date(),
          createdAt: new Date(),
          platform: 'line',
          messageType: 'text'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sendMessageResponse)
      });

      const sendResult = await conversationApi.sendMessage('conv-1', 'How can I help you?');
      expect(sendResult.success).toBe(true);
      expect(sendResult.data?.content).toBe('How can I help you?');
    });
  });

  describe('Message API Integration', () => {
    beforeEach(() => {
      authApi.setAuthHeader('valid-token');
    });

    test('should handle message operations with platform support', async () => {
      const conversationId = 'conv-123';

      // Step 1: Get messages
      const messagesResponse = {
        success: true,
        data: [
          {
            id: 'msg-1',
            conversationId,
            senderId: 'customer-1',
            senderType: 'customer',
            content: 'Hello from LINE',
            timestamp: new Date(),
            createdAt: new Date(),
            platform: 'line',
            messageType: 'text'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(messagesResponse)
      });

      const messagesResult = await messageApi.list(conversationId);
      expect(messagesResult.success).toBe(true);

      // Step 2: Send message with platform
      const sendMessageResponse = {
        success: true,
        data: {
          id: 'msg-2',
          conversationId,
          senderId: 'agent-1',
          senderType: 'agent',
          content: 'Reply via LINE',
          timestamp: new Date(),
          createdAt: new Date(),
          platform: 'line',
          messageType: 'text'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(sendMessageResponse)
      });

      const sendResult = await messageApi.send(conversationId, {
        content: 'Reply via LINE',
        platform: 'line'
      });

      expect(sendResult.success).toBe(true);
      expect(sendResult.data?.platform).toBe('line');

      // Step 3: Mark as read
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const readResult = await messageApi.markAsRead(conversationId);
      expect(readResult.success).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle cascading authentication errors', async () => {
      // Set invalid token
      authApi.setAuthHeader('invalid-token');

      // All subsequent requests should handle 401
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Token expired' })
      });

      // Test multiple API calls
      const conversationsResult = await conversationApi.getConversations();
      const messagesResult = await messageApi.list('conv-1');
      const profileResult = await authApi.me();

      expect(conversationsResult.success).toBe(false);
      expect(messagesResult.success).toBe(false);
      expect(profileResult.success).toBe(false);

      // Should redirect to login multiple times
      expect(mockLocation.href).toBe('/login');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
    });

    test('should handle network errors across all APIs', async () => {
      authApi.setAuthHeader('valid-token');

      // Mock network error
      mockFetch.mockRejectedValue(new Error('Network error'));

      const conversationsResult = await conversationApi.getConversations();
      const messagesResult = await messageApi.list('conv-1');
      const sendResult = await messageApi.send('conv-1', {
        content: 'test',
        platform: 'line'
      });

      expect(conversationsResult.success).toBe(false);
      expect(conversationsResult.error).toBe('網路錯誤');
      expect(messagesResult.success).toBe(false);
      expect(messagesResult.error).toBe('網路錯誤');
      expect(sendResult.success).toBe(false);
      expect(sendResult.error).toBe('網路錯誤');
    });
  });

  describe('API Response Format Consistency', () => {
    test('should maintain consistent response format across all APIs', async () => {
      authApi.setAuthHeader('valid-token');

      // Test successful responses
      const successResponse = { success: true, data: {} };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(successResponse)
      });

      const authResult = await authApi.me();
      const conversationsResult = await conversationApi.getConversations();
      const messagesResult = await messageApi.list('conv-1');

      expect(authResult).toHaveProperty('success', true);
      expect(authResult).toHaveProperty('data');
      expect(conversationsResult).toHaveProperty('success', true);
      expect(conversationsResult).toHaveProperty('data');
      expect(messagesResult).toHaveProperty('success', true);
      expect(messagesResult).toHaveProperty('data');

      // Test error responses
      const errorResponse = { success: false, error: 'Test error' };
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorResponse)
      });

      const authError = await authApi.login({ email: 'test', password: 'test' });
      const conversationsError = await conversationApi.getConversations();
      const messagesError = await messageApi.list('conv-1');

      expect(authError).toHaveProperty('success', false);
      expect(authError).toHaveProperty('error');
      expect(conversationsError).toHaveProperty('success', false);
      expect(conversationsError).toHaveProperty('error');
      expect(messagesError).toHaveProperty('success', false);
      expect(messagesError).toHaveProperty('error');
    });
  });
});