// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/unit/api/auth.test.ts
// Created by: API Test Developer

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authApi } from '@/api/auth';
import { apiClient } from '@/api/base';

// Mock the base API client
vi.mock('../../../frontend/src/api/base', () => ({
  apiClient: {
    setAuthHeader: vi.fn(),
    removeAuthHeader: vi.fn(),
    post: vi.fn(),
    get: vi.fn()
  }
}));

const mockApiClient = vi.mocked(apiClient);

describe('Authentication API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication Header Management', () => {
    it('should set auth header correctly', () => {
      const token = 'test-jwt-token-123';
      
      authApi.setAuthHeader(token);
      
      expect(mockApiClient.setAuthHeader).toHaveBeenCalledWith(token);
    });

    it('should remove auth header correctly', () => {
      authApi.removeAuthHeader();
      
      expect(mockApiClient.removeAuthHeader).toHaveBeenCalled();
    });
  });

  describe('Login Functionality', () => {
    it('should login with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockResponse = {
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

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await authApi.login(credentials);

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/login', credentials);
      expect(result).toEqual(mockResponse);
    });

    it('should handle login failure', async () => {
      const credentials = {
        email: 'invalid@example.com',
        password: 'wrongpassword'
      };

      const mockResponse = {
        success: false,
        error: '帳號或密碼錯誤'
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await authApi.login(credentials);

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/login', credentials);
      expect(result).toEqual(mockResponse);
    });

    it('should handle network error during login', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockResponse = {
        success: false,
        error: '網路錯誤'
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await authApi.login(credentials);

      expect(result).toEqual(mockResponse);
    });
  });

  describe('User Profile Retrieval', () => {
    it('should get current user profile', async () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        email: 'test@example.com',
        isOnline: true,
        platforms: ['line', 'facebook'],
        role: 'agent'
      };

      const mockResponse = {
        success: true,
        data: mockAgent
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await authApi.me();

      expect(mockApiClient.get).toHaveBeenCalledWith('/auth/me');
      expect(result).toEqual(mockResponse);
    });

    it('should handle unauthorized access to profile', async () => {
      const mockResponse = {
        success: false,
        error: '未授權訪問'
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await authApi.me();

      expect(mockApiClient.get).toHaveBeenCalledWith('/auth/me');
      expect(result).toEqual(mockResponse);
    });

    it('should handle profile not found', async () => {
      const mockResponse = {
        success: false,
        error: '用戶不存在'
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await authApi.me();

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Logout Functionality', () => {
    it('should logout successfully', async () => {
      const mockResponse = {
        success: true,
        data: undefined
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await authApi.logout();

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/logout');
      expect(result).toEqual(mockResponse);
    });

    it('should handle logout error', async () => {
      const mockResponse = {
        success: false,
        error: '登出失敗'
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await authApi.logout();

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/logout');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Request Format Validation', () => {
    it('should send login request with correct format', async () => {
      const credentials = {
        email: 'agent@company.com',
        password: 'securePassword123!'
      };

      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        data: { token: 'token', agent: {} }
      });

      await authApi.login(credentials);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/auth/login',
        expect.objectContaining({
          email: expect.any(String),
          password: expect.any(String)
        })
      );
    });

    it('should validate email format in login request', async () => {
      const credentials = {
        email: 'valid.email@domain.com',
        password: 'password'
      };

      mockApiClient.post.mockResolvedValueOnce({
        success: true,
        data: { token: 'token', agent: {} }
      });

      await authApi.login(credentials);

      const callArgs = mockApiClient.post.mock.calls[0][1];
      expect(callArgs.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });
  });

  describe('Response Data Transformation', () => {
    it('should return properly typed login response', async () => {
      const mockResponse = {
        success: true,
        data: {
          token: 'jwt-token-abc123',
          agent: {
            id: 'agent-123',
            name: 'John Doe',
            email: 'john@example.com',
            isOnline: false,
            platforms: ['line'],
            role: 'admin' as const
          }
        }
      };

      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const result = await authApi.login({
        email: 'john@example.com',
        password: 'password'
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(typeof result.data.token).toBe('string');
        expect(typeof result.data.agent.id).toBe('string');
        expect(typeof result.data.agent.name).toBe('string');
        expect(typeof result.data.agent.email).toBe('string');
        expect(typeof result.data.agent.isOnline).toBe('boolean');
        expect(Array.isArray(result.data.agent.platforms)).toBe(true);
        expect(['admin', 'agent']).toContain(result.data.agent.role);
      }
    });

    it('should return properly typed profile response', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'agent-456',
          name: 'Jane Smith',
          email: 'jane@example.com',
          isOnline: true,
          platforms: ['line', 'facebook'],
          role: 'agent' as const
        }
      };

      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const result = await authApi.me();

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(typeof result.data.id).toBe('string');
        expect(typeof result.data.name).toBe('string');
        expect(typeof result.data.email).toBe('string');
        expect(typeof result.data.isOnline).toBe('boolean');
        expect(Array.isArray(result.data.platforms)).toBe(true);
        expect(['admin', 'agent']).toContain(result.data.role);
      }
    });
  });
});