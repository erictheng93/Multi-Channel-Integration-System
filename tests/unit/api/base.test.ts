// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/tests/unit/api/base.test.ts
// Created by: API Test Developer

import { import { MockFactory } from '@helpers/mockFactory';
describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient } from '@/api/base';

// Mock fetch
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

Object.defineProperty(global, 'window', {
  value: {
    localStorage: mockLocalStorage,
    location: mockLocation
  },
  writable: true
});

describe('API Base Client Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
  });

  afterEach(() => {
    apiClient.removeAuthHeader();
  });

  describe('Authentication Header Management', () => {
    test('should set authorization header correctly', async () => {
      const token = 'test-token-123';
      apiClient.setAuthHeader(token);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: 'test' })
      });

      await apiClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${token}`
          })
        })
      );
    });

    test('should remove authorization header', async () => {
      apiClient.setAuthHeader('test-token');
      apiClient.removeAuthHeader();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: 'test' })
      });

      await apiClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String)
          })
        })
      );
    });

    test('should include content-type header by default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: 'test' })
      });

      await apiClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });
  });

  describe('HTTP Methods', () => {
    test('should make GET request correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: 'test-data' })
      });

      const result = await apiClient.get('/test-endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-endpoint'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Object),
          body: undefined
        })
      );

      expect(result).toEqual({
        success: true,
        data: 'test-data'
      });
    });

    test('should make POST request with data', async () => {
      const testData = { name: 'test', value: 123 };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: 'created' })
      });

      const result = await apiClient.post('/test-endpoint', testData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-endpoint'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Object),
          body: JSON.stringify(testData)
        })
      );

      expect(result).toEqual({
        success: true,
        data: 'created'
      });
    });

    test('should make PUT request with data', async () => {
      const testData = { id: '1', name: 'updated' };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: 'updated' })
      });

      const result = await apiClient.put('/test-endpoint', testData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-endpoint'),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.any(Object),
          body: JSON.stringify(testData)
        })
      );

      expect(result).toEqual({
        success: true,
        data: 'updated'
      });
    });

    test('should make DELETE request correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const result = await apiClient.delete('/test-endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-endpoint'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.any(Object),
          body: undefined
        })
      );

      expect(result).toEqual({
        success: true
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle 401 unauthorized error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' })
      });

      const result = await apiClient.get('/protected-endpoint');

      // The API client removes both token and refreshToken on 401
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refreshToken');
      expect(mockLocation.href).toBe('/login');
      expect(result).toEqual({
        success: false,
        error: 'Unauthorized',
        status: 401
      });
    });

    test('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Bad Request' })
      });

      const result = await apiClient.get('/test-endpoint');

      expect(result).toEqual({
        success: false,
        error: 'Bad Request',
        status: 400
      });
    });

    test('should handle HTTP error without error message', async () => {
      // Mock multiple failed responses for retry logic
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      const result = await apiClient.get('/test-endpoint');

      expect(result).toEqual({
        success: false,
        error: '服務器內部錯誤',
        status: 500
      });
    }, 15000);

    test('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await apiClient.get('/test-endpoint');

      expect(result).toEqual({
        success: false,
        error: '網路連接錯誤，請檢查您的網路連接',
        status: 0
      });
    }, 10000);

    test('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      const result = await apiClient.get('/test-endpoint');

      expect(result).toEqual({
        error: '服務器響應格式錯誤'
      });
    });
  });

  describe('Base URL Configuration', () => {
    test('should use correct base URL for requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      await apiClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/^http:\/\/localhost:8787\/test$/),
        expect.any(Object)
      );
    });
  });

  describe('Request Body Handling', () => {
    test('should not include body for GET requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      await apiClient.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: undefined
        })
      );
    });

    test('should stringify JSON data for POST requests', async () => {
      const data = { test: 'value', number: 42 };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      await apiClient.post('/test', data);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(data)
        })
      );
    });
  });
});