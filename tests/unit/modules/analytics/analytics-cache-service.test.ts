// Analytics Cache Service 單元測試
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsCacheService } from '@modules/analytics/services/analytics-cache-service';

describe('AnalyticsCacheService', () => {
  let mockKV: any;
  let cacheService: AnalyticsCacheService;

  beforeEach(() => {
    // Mock KV Namespace
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      getWithMetadata: vi.fn()
    };

    cacheService = new AnalyticsCacheService(mockKV, {
      defaultTTL: 300,
      shortTTL: 60,
      longTTL: 1800,
      enabled: true
    });
  });

  describe('generateCacheKey', () => {
    it('should generate consistent cache keys for same parameters', () => {
      const params = { timeRange: '7d', teamId: 5, userId: 123 };

      const key1 = cacheService.generateCacheKey('conversation', params);
      const key2 = cacheService.generateCacheKey('conversation', params);

      expect(key1).toBe(key2);
      expect(key1).toContain('analytics:cache:v1:conversation');
    });

    it('should generate different keys for different parameters', () => {
      const params1 = { timeRange: '7d', teamId: 5 };
      const params2 = { timeRange: '30d', teamId: 5 };

      const key1 = cacheService.generateCacheKey('conversation', params1);
      const key2 = cacheService.generateCacheKey('conversation', params2);

      expect(key1).not.toBe(key2);
    });

    it('should include userId in key when strategy requires it', () => {
      const params = { timeRange: '7d', teamId: 5, userId: 123 };

      const key = cacheService.generateCacheKey('conversation', params, {
        includeUserId: true
      });

      expect(key).toContain('user:123');
    });

    it('should include teamId in key when strategy requires it', () => {
      const params = { timeRange: '7d', teamId: 5, userId: 123 };

      const key = cacheService.generateCacheKey('conversation', params, {
        includeTeamId: true
      });

      expect(key).toContain('team:5');
    });
  });

  describe('get', () => {
    it('should return cached data when available', async () => {
      const cachedData = {
        data: { summary: { totalConversations: 100 } },
        metadata: { cacheHit: false }
      };

      mockKV.get.mockResolvedValue(cachedData);

      const result = await cacheService.get('test-key');

      expect(result).toBeTruthy();
      expect(result?.metadata.cacheHit).toBe(true);
      expect(mockKV.get).toHaveBeenCalledWith('test-key', 'json');
    });

    it('should return null when cache miss', async () => {
      mockKV.get.mockResolvedValue(null);

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
    });

    it('should update stats on cache hit', async () => {
      const cachedData = { data: {}, metadata: {} };
      mockKV.get.mockResolvedValue(cachedData);

      await cacheService.get('test-key');

      const stats = await cacheService.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.totalRequests).toBe(1);
    });

    it('should update stats on cache miss', async () => {
      mockKV.get.mockResolvedValue(null);

      await cacheService.get('test-key');

      const stats = await cacheService.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.totalRequests).toBe(1);
    });

    it('should calculate hit rate correctly', async () => {
      const cachedData = { data: {}, metadata: {} };
      mockKV.get.mockResolvedValueOnce(cachedData); // Hit
      mockKV.get.mockResolvedValueOnce(null);       // Miss
      mockKV.get.mockResolvedValueOnce(cachedData); // Hit

      await cacheService.get('test-key-1');
      await cacheService.get('test-key-2');
      await cacheService.get('test-key-3');

      const stats = await cacheService.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('set', () => {
    it('should store data with TTL', async () => {
      const data = {
        data: { summary: { totalConversations: 100 } },
        metadata: { cacheHit: false, processedAt: new Date().toISOString() }
      };

      mockKV.put.mockResolvedValue(undefined);

      const result = await cacheService.set('test-key', data, 300);

      expect(result).toBe(true);
      expect(mockKV.put).toHaveBeenCalled();

      const callArgs = mockKV.put.mock.calls[0];
      expect(callArgs[0]).toBe('test-key');
      expect(callArgs[2]).toEqual({ expirationTtl: 300 });
    });

    it('should use default TTL when not specified', async () => {
      const data = { data: {}, metadata: {} };
      mockKV.put.mockResolvedValue(undefined);

      await cacheService.set('test-key', data);

      const callArgs = mockKV.put.mock.calls[0];
      expect(callArgs[2]).toEqual({ expirationTtl: 300 }); // defaultTTL
    });

    it('should update stats on set', async () => {
      const data = { data: {}, metadata: {} };
      mockKV.put.mockResolvedValue(undefined);

      await cacheService.set('test-key', data);

      const stats = await cacheService.getStats();
      expect(stats.sets).toBe(1);
    });

    it('should add cache metadata to data', async () => {
      const data = {
        data: { summary: {} },
        metadata: { processedAt: '2025-01-30T00:00:00Z' }
      };

      mockKV.put.mockResolvedValue(undefined);
      await cacheService.set('test-key', data, 300);

      const storedData = JSON.parse(mockKV.put.mock.calls[0][1]);
      expect(storedData.metadata).toHaveProperty('cachedAt');
      expect(storedData.metadata).toHaveProperty('cacheExpiry');
    });
  });

  describe('delete', () => {
    it('should delete cache entry', async () => {
      mockKV.delete.mockResolvedValue(undefined);

      const result = await cacheService.delete('test-key');

      expect(result).toBe(true);
      expect(mockKV.delete).toHaveBeenCalledWith('test-key');
    });

    it('should update stats on delete', async () => {
      mockKV.delete.mockResolvedValue(undefined);

      await cacheService.delete('test-key');

      const stats = await cacheService.getStats();
      expect(stats.deletes).toBe(1);
    });
  });

  describe('getTTLForQueryType', () => {
    it('should return short TTL for realtime queries', () => {
      const ttl = cacheService.getTTLForQueryType('realtime_stats', '1h');
      expect(ttl).toBe(60); // shortTTL
    });

    it('should return long TTL for historical queries', () => {
      const ttl = cacheService.getTTLForQueryType('conversation', '90d');
      expect(ttl).toBe(1800); // longTTL
    });

    it('should return default TTL for standard queries', () => {
      const ttl = cacheService.getTTLForQueryType('conversation', '7d');
      expect(ttl).toBe(300); // defaultTTL
    });
  });

  describe('invalidateQueryType', () => {
    it('should clear all cache entries for a query type', async () => {
      mockKV.list.mockResolvedValue({
        keys: [
          { name: 'analytics:cache:v1:conversation:hash1' },
          { name: 'analytics:cache:v1:conversation:hash2' }
        ],
        list_complete: true
      });
      mockKV.delete.mockResolvedValue(undefined);

      const count = await cacheService.invalidateQueryType('conversation');

      expect(count).toBe(2);
      expect(mockKV.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockKV.get.mockResolvedValue('some-value');

      const exists = await cacheService.exists('test-key');

      expect(exists).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockKV.get.mockResolvedValue(null);

      const exists = await cacheService.exists('test-key');

      expect(exists).toBe(false);
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics to zero', async () => {
      // Generate some stats
      mockKV.get.mockResolvedValueOnce({ data: {} });
      mockKV.get.mockResolvedValueOnce(null);
      await cacheService.get('key1');
      await cacheService.get('key2');

      // Reset
      cacheService.resetStats();

      const stats = await cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });
});