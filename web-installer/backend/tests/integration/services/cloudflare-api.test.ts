/**
 * CloudflareAPI Service - Integration Tests
 *
 * Tests the CloudflareAPI service with mocked HTTP responses
 * to verify correct API interactions without hitting real Cloudflare APIs
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CloudflareAPI } from '@/services/CloudflareAPI';
import type { CloudflareAPIConfig } from '@/types/cloudflare';

describe('CloudflareAPI Service - Integration Tests', () => {
  let api: CloudflareAPI;
  let fetchMock: ReturnType<typeof vi.fn>;

  const mockConfig: CloudflareAPIConfig = {
    accountId: 'test-account-123',
    apiToken: 'test-token-456',
    baseUrl: 'https://api.cloudflare.com/client/v4'
  };

  beforeEach(() => {
    // Create a fresh API instance for each test
    api = new CloudflareAPI(mockConfig);

    // Mock global fetch
    fetchMock = vi.fn();
    // vitest 4 narrowed vi.fn()'s default generic, so the bare mock no longer
    // matches the workerd fetch overloads. The mock bodies here are deliberately
    // partial Responses, so cast rather than widen every literal.
    global.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('D1 Database Operations', () => {
    it('should create D1 database successfully', async () => {
      const mockDatabase = {
        uuid: 'db-uuid-123',
        name: 'test-crm-db',
        version: '1.0.0',
        created_on: '2025-01-28T00:00:00Z',
        num_tables: 0,
        file_size: 0
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: mockDatabase
        })
      });

      const result = await api.createD1Database('test-crm-db');

      expect(result).toEqual(mockDatabase);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/d1/database'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockConfig.apiToken}`
          })
        })
      );
    });

    it('should handle D1 creation failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          success: false,
          errors: [{ message: 'Database name already exists' }],
          messages: [],
          result: null
        })
      });

      await expect(api.createD1Database('existing-db')).rejects.toThrow(
        'Database name already exists'
      );
    });

    it('should execute D1 query with parameters', async () => {
      const mockResult = {
        meta: {},
        results: [{ id: 1, name: 'Test' }]
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: mockResult
        })
      });

      const result = await api.executeD1QueryWithParams(
        'db-123',
        'SELECT * FROM users WHERE id = ?',
        [1]
      );

      expect(result).toEqual(mockResult);
    });

    it('should delete D1 database', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: null
        })
      });

      await expect(api.deleteD1Database('db-123')).resolves.not.toThrow();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/d1/database/db-123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('KV Namespace Operations', () => {
    it('should create KV namespace successfully', async () => {
      const mockNamespace = {
        id: 'kv-id-123',
        title: 'test-kv-session',
        supports_url_encoding: true
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: mockNamespace
        })
      });

      const result = await api.createKVNamespace('test-kv-session');

      expect(result).toEqual(mockNamespace);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/storage/kv/namespaces'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should delete KV namespace', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: null
        })
      });

      await expect(api.deleteKVNamespace('kv-123')).resolves.not.toThrow();
    });
  });

  describe('R2 Bucket Operations', () => {
    it('should create R2 bucket successfully', async () => {
      const mockBucket = {
        name: 'test-crm-uploads',
        creation_date: '2025-01-28T00:00:00Z'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: mockBucket
        })
      });

      const result = await api.createR2Bucket('test-crm-uploads');

      expect(result).toEqual(mockBucket);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/r2/buckets'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should delete R2 bucket', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: null
        })
      });

      await expect(api.deleteR2Bucket('test-bucket')).resolves.not.toThrow();
    });

    it('should handle R2 bucket creation conflict', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({
          success: false,
          errors: [{ message: 'Bucket already exists' }],
          messages: [],
          result: null
        })
      });

      await expect(api.createR2Bucket('existing-bucket')).rejects.toThrow(
        'Bucket already exists'
      );
    });
  });

  describe('Queue Operations', () => {
    it('should create Queue successfully', async () => {
      const mockQueue = {
        queue_id: 'queue-id-123',
        queue_name: 'test-delayed-messages',
        created_on: '2025-01-28T00:00:00Z',
        producers: [],
        consumers: [],
        producers_total_count: 0,
        consumers_total_count: 0,
        modified_on: '2025-01-28T00:00:00Z'
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: mockQueue
        })
      });

      const result = await api.createQueue('test-delayed-messages');

      expect(result).toEqual(mockQueue);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/queues'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ queue_name: 'test-delayed-messages' })
        })
      );
    });

    it('should delete Queue', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: null
        })
      });

      await expect(api.deleteQueue('queue-123')).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.createD1Database('test-db')).rejects.toThrow('Network error');
    });

    it('should handle API errors with error array', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          success: false,
          errors: [
            { message: 'Internal server error', code: 500 }
          ],
          messages: [],
          result: null
        })
      });

      await expect(api.createKVNamespace('test-kv')).rejects.toThrow(
        'Internal server error'
      );
    });

    it('should handle API errors without error array', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({
          success: false,
          errors: [],
          messages: [],
          result: null
        })
      });

      await expect(api.createR2Bucket('test-bucket')).rejects.toThrow(
        'Service Unavailable'
      );
    });

    it('should handle malformed JSON responses', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      await expect(api.createD1Database('test-db')).rejects.toThrow();
    });
  });

  describe('Authentication', () => {
    it('should include API token in all requests', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: { uuid: 'db-123', name: 'test' }
        })
      });

      await api.createD1Database('test-db');

      const callArgs = fetchMock.mock.calls[0];
      const headers = callArgs[1].headers;

      expect(headers['Authorization']).toBe(`Bearer ${mockConfig.apiToken}`);
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('Request Body Formatting', () => {
    it('should correctly format D1 create request body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: { uuid: 'db-123', name: 'my-database' }
        })
      });

      await api.createD1Database('my-database');

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toEqual({ name: 'my-database' });
    });

    it('should correctly format KV create request body', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: { id: 'kv-123', title: 'my-kv' }
        })
      });

      await api.createKVNamespace('my-kv');

      const callArgs = fetchMock.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toEqual({ title: 'my-kv' });
    });
  });

  describe('Error Handling - Network Timeouts', () => {
    it('should handle network timeout for D1 operations', async () => {
      fetchMock.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      await expect(
        api.createD1Database('timeout-test')
      ).rejects.toThrow('Request timeout');
    });

    it('should handle timeout for KV operations', async () => {
      fetchMock.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      await expect(
        api.createKVNamespace('timeout-test')
      ).rejects.toThrow('Network timeout');
    });

    it('should handle timeout for R2 operations', async () => {
      fetchMock.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 100)
        )
      );

      await expect(
        api.createR2Bucket('timeout-test')
      ).rejects.toThrow('Connection timeout');
    });
  });

  describe('Error Handling - API Rate Limiting', () => {
    it('should handle 429 Too Many Requests error', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({
          success: false,
          errors: [{ code: 10037, message: 'Rate limit exceeded' }]
        })
      });

      await expect(
        api.createD1Database('rate-limit-test')
      ).rejects.toThrow();
    });

    it('should handle rate limit with Retry-After header', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '60' }),
        text: async () => JSON.stringify({
          success: false,
          errors: [{ message: 'Please retry after 60 seconds' }]
        })
      });

      await expect(
        api.createKVNamespace('rate-limit-test')
      ).rejects.toThrow();
    });
  });

  describe('Error Handling - API Errors', () => {
    it('should handle 400 Bad Request errors', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
          success: false,
          errors: [{ code: 7003, message: 'Invalid database name format' }]
        })
      });

      await expect(
        api.createD1Database('invalid name with spaces')
      ).rejects.toThrow();
    });

    it('should handle 403 Forbidden errors', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({
          success: false,
          errors: [{ code: 10000, message: 'Insufficient permissions' }]
        })
      });

      await expect(
        api.createD1Database('forbidden-test')
      ).rejects.toThrow();
    });

    it('should handle 500 Internal Server Error', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({
          success: false,
          errors: [{ message: 'Internal server error' }]
        })
      });

      await expect(
        api.createR2Bucket('server-error-test')
      ).rejects.toThrow();
    });

    it('should handle malformed API responses', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
        text: async () => 'Not valid JSON at all'
      });

      await expect(
        api.createD1Database('malformed-test')
      ).rejects.toThrow();
    });
  });

  describe('Error Handling - Resource Conflicts', () => {
    it('should handle duplicate database name error', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
          success: false,
          errors: [{ code: 7001, message: 'Database with this name already exists' }]
        })
      });

      await expect(
        api.createD1Database('existing-database')
      ).rejects.toThrow();
    });

    it('should handle duplicate bucket name error', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
          success: false,
          errors: [{ message: 'Bucket name already taken' }]
        })
      });

      await expect(
        api.createR2Bucket('existing-bucket')
      ).rejects.toThrow();
    });
  });

  describe('Error Handling - Network Failures', () => {
    it('should handle DNS resolution failures', async () => {
      fetchMock.mockRejectedValue(new Error('getaddrinfo ENOTFOUND api.cloudflare.com'));

      await expect(
        api.createD1Database('dns-failure-test')
      ).rejects.toThrow('getaddrinfo ENOTFOUND');
    });

    it('should handle connection refused errors', async () => {
      fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));

      await expect(
        api.createKVNamespace('connection-refused-test')
      ).rejects.toThrow('ECONNREFUSED');
    });

    it('should handle SSL/TLS errors', async () => {
      fetchMock.mockRejectedValue(new Error('certificate has expired'));

      await expect(
        api.createR2Bucket('ssl-error-test')
      ).rejects.toThrow('certificate has expired');
    });
  });
});
