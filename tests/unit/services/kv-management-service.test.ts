/**
 * KV Management Service Unit Tests
 *
 * Tests for KV namespace management, compression, batch operations,
 * and key builders
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  KVCompression,
  KVBatchOperations,
  KVManagementService,
  KVKeyBuilder,
  TypedKV,
  KVCleanupResult,
  KVStatistics,
} from '@shared/services/kv-management-service';

// Mock the config module
vi.mock('@/config/kv-config', () => ({
  KV_TTL: {
    SESSION: 2592000,
    WEBSOCKET_CONNECTION: 3600,
    SSE_CONNECTION: 300,
    MESSAGE_RECALL: 86400,
    MESSAGE_CANCEL: 300,
    MESSAGE_PENDING: 300,
    OFFLINE_MESSAGE: 604800,
    RATE_LIMIT: 60,
    CIRCUIT_BREAKER: 300,
    REALTIME_EVENT: 60,
    CACHE_MESSAGE: 300,
    CACHE_QR_CODE: 3600,
    CACHE_AGENT_STATUS: 60,
    CACHE_AGENT_SKILLS: 3600,
    CACHE_ANALYTICS: 300,
    CACHE_REPORT: 3600,
    CACHE_DASHBOARD: 60,
    CACHE_HEALTH: 30,
    CACHE_HTTP: 300,
    CACHE_QUERY: 60,
    ALERT_CONFIG: 86400,
    REPORT_TEMPLATE: 86400,
    GENERATION_STATUS: 3600,
    BATCH_TRACKING: 3600,
    TEST: 60,
  },
  KV_BATCH_CONFIG: {
    MAX_BATCH_SIZE: 100,
    MAX_PARALLEL_OPS: 10,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 100,
  },
  KV_COMPRESSION_CONFIG: {
    MIN_SIZE_FOR_COMPRESSION: 1024,
    NEVER_COMPRESS_PREFIXES: ['session:', 'rate:'],
    ALWAYS_COMPRESS_PREFIXES: ['cache:analytics:', 'cache:report:'],
  },
  KV_KEY_PATTERNS: {
    sessions: {
      session: 'session:',
      wsConfig: 'ws:config',
      wsConn: 'ws:conn:',
    },
    cache: {
      latestMsg: 'cache:msg:latest:',
      qrCode: 'cache:qr:',
    },
  },
  LEGACY_KEY_PATTERNS: ['old_session:', 'deprecated:'],
  KEY_MIGRATION_MAP: {
    'old_session:': 'session:',
  },
  getNamespaceForKey: vi.fn((key: string) => {
    if (key.startsWith('session:') || key.startsWith('ws:')) return 'SESSIONS';
    if (key.startsWith('cache:')) return 'CACHE';
    return 'UNKNOWN';
  }),
  validateKVKey: vi.fn((key: string) => ({
    valid: !key.startsWith('old_') && !key.startsWith('deprecated:'),
    suggestion: key.startsWith('old_session:') ? key.replace('old_session:', 'session:') : undefined,
  })),
}));

// =================== Mock KV Namespace ===================

function createMockKV() {
  const store = new Map<string, string>();

  return {
    store,
    get: vi.fn(async (key: string, type?: string) => {
      const value = store.get(key);
      if (!value) return null;
      if (type === 'json') return JSON.parse(value);
      if (type === 'arrayBuffer') return new TextEncoder().encode(value).buffer;
      return value;
    }),
    put: vi.fn(async (key: string, value: string, _options?: { expirationTtl?: number; metadata?: unknown }) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (options?: { prefix?: string; cursor?: string; limit?: number }) => {
      const keys: { name: string }[] = [];
      for (const key of store.keys()) {
        if (!options?.prefix || key.startsWith(options.prefix)) {
          keys.push({ name: key });
        }
      }
      return { keys, list_complete: true, cursor: undefined };
    }),
    getWithMetadata: vi.fn(async (key: string) => {
      const value = store.get(key);
      return { value: value || null, metadata: null };
    }),
  } as unknown as KVNamespace & { store: Map<string, string> };
}

// =================== KVCompression Tests ===================

describe('KVCompression', () => {
  describe('shouldCompress', () => {
    it('should not compress small data', () => {
      const result = KVCompression.shouldCompress('cache:test', 'small');
      expect(result).toBe(false);
    });

    it('should not compress data with never-compress prefix', () => {
      const largeData = 'x'.repeat(2000);
      const result = KVCompression.shouldCompress('session:123', largeData);
      expect(result).toBe(false);
    });

    it('should not compress rate limit keys', () => {
      const largeData = 'x'.repeat(2000);
      const result = KVCompression.shouldCompress('rate:api:user123', largeData);
      expect(result).toBe(false);
    });

    it('should compress data with always-compress prefix', () => {
      const largeData = 'x'.repeat(2000);
      const result = KVCompression.shouldCompress('cache:analytics:daily', largeData);
      expect(result).toBe(true);
    });

    it('should compress large data above threshold', () => {
      const largeData = 'x'.repeat(2000);
      const result = KVCompression.shouldCompress('other:key', largeData);
      expect(result).toBe(true);
    });
  });

  describe('compress', () => {
    it('should return uncompressed data for small inputs', async () => {
      const data = 'small data';
      const result = await KVCompression.compress('test:key', data);

      expect(result.compressed).toBe(false);
      expect(result.data).toBe(data);
      expect(result.originalSize).toBe(data.length);
    });

    it('should return uncompressed data for never-compress keys', async () => {
      const data = 'x'.repeat(2000);
      const result = await KVCompression.compress('session:123', data);

      expect(result.compressed).toBe(false);
      expect(result.data).toBe(data);
    });

    it('should attempt compression for large data', async () => {
      const data = 'x'.repeat(2000);
      const result = await KVCompression.compress('cache:analytics:test', data);

      // Note: Actual compression depends on CompressionStream availability
      expect(result.originalSize).toBe(data.length);
    });
  });

  describe('decompress', () => {
    it('should return data as-is if not compressed', async () => {
      const data = 'not compressed data';
      const result = await KVCompression.decompress(data);

      expect(result).toBe(data);
    });

    it('should identify compressed data by prefix', async () => {
      const normalData = 'normal data without prefix';
      const result = await KVCompression.decompress(normalData);

      expect(result).toBe(normalData);
    });
  });
});

// =================== KVBatchOperations Tests ===================

describe('KVBatchOperations', () => {
  let mockKV: ReturnType<typeof createMockKV>;
  let batchOps: KVBatchOperations;

  beforeEach(() => {
    mockKV = createMockKV();
    batchOps = new KVBatchOperations(mockKV);
  });

  describe('batchGet', () => {
    it('should get multiple keys', async () => {
      mockKV.store.set('key1', 'value1');
      mockKV.store.set('key2', 'value2');
      mockKV.store.set('key3', 'value3');

      const result = await batchOps.batchGet(['key1', 'key2', 'key3']);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it('should handle missing keys', async () => {
      mockKV.store.set('key1', 'value1');

      const result = await batchOps.batchGet(['key1', 'missing-key']);

      expect(result.processed).toBe(2);
      expect(result.results.find(r => r.key === 'missing-key')?.value).toBeNull();
    });

    it('should handle empty keys array', async () => {
      const result = await batchOps.batchGet([]);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(0);
    });

    it('should support JSON type', async () => {
      mockKV.store.set('json-key', JSON.stringify({ test: 'value' }));

      const result = await batchOps.batchGet<{ test: string }>(['json-key'], { type: 'json' });

      expect(result.results[0].value).toEqual({ test: 'value' });
    });
  });

  describe('batchPut', () => {
    it('should put multiple key-value pairs', async () => {
      const items = [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
        { key: 'key3', value: 'value3' },
      ];

      const result = await batchOps.batchPut(items);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(3);
      expect(mockKV.store.get('key1')).toBe('value1');
      expect(mockKV.store.get('key2')).toBe('value2');
    });

    it('should handle empty items array', async () => {
      const result = await batchOps.batchPut([]);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(0);
    });

    it('should support TTL option', async () => {
      const items = [
        { key: 'key1', value: 'value1', ttl: 3600 },
      ];

      await batchOps.batchPut(items);

      expect(mockKV.put).toHaveBeenCalledWith(
        'key1',
        expect.any(String),
        expect.objectContaining({ expirationTtl: 3600 })
      );
    });

    it('should respect compress option', async () => {
      const items = [
        { key: 'key1', value: 'small value' },
      ];

      await batchOps.batchPut(items, { compress: false });

      expect(mockKV.store.get('key1')).toBe('small value');
    });
  });

  describe('batchDelete', () => {
    it('should delete multiple keys', async () => {
      mockKV.store.set('key1', 'value1');
      mockKV.store.set('key2', 'value2');
      mockKV.store.set('key3', 'value3');

      const result = await batchOps.batchDelete(['key1', 'key2']);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(mockKV.delete).toHaveBeenCalledWith('key1');
      expect(mockKV.delete).toHaveBeenCalledWith('key2');
    });

    it('should handle empty keys array', async () => {
      const result = await batchOps.batchDelete([]);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(0);
    });
  });

  describe('listAllKeys', () => {
    it('should list all keys', async () => {
      mockKV.store.set('key1', 'value1');
      mockKV.store.set('key2', 'value2');
      mockKV.store.set('other:key', 'value3');

      const keys = await batchOps.listAllKeys();

      expect(keys).toHaveLength(3);
    });

    it('should filter by prefix', async () => {
      mockKV.store.set('session:1', 'value1');
      mockKV.store.set('session:2', 'value2');
      mockKV.store.set('cache:1', 'value3');

      const keys = await batchOps.listAllKeys('session:');

      expect(keys).toHaveLength(2);
      expect(keys.every(k => k.startsWith('session:'))).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      mockKV.store.set('key1', 'value1');

      const keys = await batchOps.listAllKeys('nonexistent:');

      expect(keys).toEqual([]);
    });
  });
});

// =================== KVManagementService Tests ===================

describe('KVManagementService', () => {
  let mockEnv: { SESSIONS: ReturnType<typeof createMockKV>; CACHE: ReturnType<typeof createMockKV> };
  let service: KVManagementService;

  beforeEach(() => {
    mockEnv = {
      SESSIONS: createMockKV(),
      CACHE: createMockKV(),
    };
    service = new KVManagementService(mockEnv as any);
  });

  describe('cleanupLegacyKeys', () => {
    it('should identify legacy keys in dry run mode', async () => {
      mockEnv.SESSIONS.store.set('old_session:123', 'data');
      mockEnv.SESSIONS.store.set('deprecated:key', 'data');
      mockEnv.SESSIONS.store.set('session:valid', 'data');

      const result = await service.cleanupLegacyKeys(true, false);

      expect(result.sessions.deletedKeys).toContain('old_session:123');
      expect(result.sessions.deletedKeys).toContain('deprecated:key');
      expect(result.sessions.deletedKeys).not.toContain('session:valid');
    });

    it('should not delete in dry run mode', async () => {
      mockEnv.SESSIONS.store.set('old_session:123', 'data');

      await service.cleanupLegacyKeys(true, false);

      expect(mockEnv.SESSIONS.store.has('old_session:123')).toBe(true);
    });

    it('should delete legacy keys when not in dry run', async () => {
      mockEnv.SESSIONS.store.set('old_session:123', 'data');

      await service.cleanupLegacyKeys(false, false);

      expect(mockEnv.SESSIONS.delete).toHaveBeenCalled();
    });

    it('should handle empty namespaces', async () => {
      const result = await service.cleanupLegacyKeys(true, false);

      expect(result.sessions.deletedCount).toBe(0);
      expect(result.cache.deletedCount).toBe(0);
    });
  });

  describe('getStatistics', () => {
    it('should return statistics for both namespaces', async () => {
      mockEnv.SESSIONS.store.set('session:1', 'data');
      mockEnv.SESSIONS.store.set('session:2', 'data');
      mockEnv.CACHE.store.set('cache:msg:latest:1', 'data');

      const stats = await service.getStatistics();

      expect(stats.sessions.namespace).toBe('SESSIONS');
      expect(stats.cache.namespace).toBe('CACHE');
      expect(stats.sessions.totalKeys).toBe(2);
      expect(stats.cache.totalKeys).toBe(1);
    });

    it('should categorize keys by pattern', async () => {
      mockEnv.SESSIONS.store.set('session:1', 'data');
      mockEnv.SESSIONS.store.set('session:2', 'data');
      mockEnv.SESSIONS.store.set('ws:conn:1', 'data');

      const stats = await service.getStatistics();

      expect(stats.sessions.keysByPattern['session:']).toBe(2);
    });

    it('should identify legacy keys', async () => {
      mockEnv.SESSIONS.store.set('old_session:1', 'data');
      mockEnv.SESSIONS.store.set('deprecated:key', 'data');

      const stats = await service.getStatistics();

      expect(stats.sessions.legacyKeys).toBe(2);
    });

    it('should estimate size', async () => {
      mockEnv.SESSIONS.store.set('key1', 'data');
      mockEnv.SESSIONS.store.set('key2', 'data');

      const stats = await service.getStatistics();

      expect(stats.sessions.estimatedSize).toMatch(/\d+(\.\d+)?\s*(B|KB|MB)/);
    });
  });

  describe('migrateKey', () => {
    it('should migrate key from old to new pattern', async () => {
      mockEnv.SESSIONS.store.set('old-key', 'test-value');

      const result = await service.migrateKey(
        mockEnv.SESSIONS,
        'old-key',
        'new-key',
        false
      );

      expect(result).toBe(true);
      expect(mockEnv.SESSIONS.store.get('new-key')).toBe('test-value');
    });

    it('should optionally delete old key', async () => {
      mockEnv.SESSIONS.store.set('old-key', 'test-value');

      await service.migrateKey(
        mockEnv.SESSIONS,
        'old-key',
        'new-key',
        true
      );

      expect(mockEnv.SESSIONS.delete).toHaveBeenCalledWith('old-key');
    });

    it('should return false for non-existent key', async () => {
      const result = await service.migrateKey(
        mockEnv.SESSIONS,
        'non-existent',
        'new-key',
        false
      );

      expect(result).toBe(false);
    });
  });

  describe('batchMigrateKeys', () => {
    it('should migrate multiple keys', async () => {
      mockEnv.SESSIONS.store.set('old:1', 'value1');
      mockEnv.SESSIONS.store.set('old:2', 'value2');
      mockEnv.SESSIONS.store.set('old:3', 'value3');

      const result = await service.batchMigrateKeys(
        mockEnv.SESSIONS,
        'old:',
        'new:',
        false
      );

      expect(result.migrated).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('should handle no matching keys', async () => {
      mockEnv.SESSIONS.store.set('other:key', 'value');

      const result = await service.batchMigrateKeys(
        mockEnv.SESSIONS,
        'nonexistent:',
        'new:',
        false
      );

      expect(result.migrated).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status for working KV', async () => {
      const result = await service.healthCheck();

      expect(result.sessions.healthy).toBe(true);
      expect(result.cache.healthy).toBe(true);
    });

    it('should measure latency', async () => {
      const result = await service.healthCheck();

      expect(typeof result.sessions.latency).toBe('number');
      expect(result.sessions.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('accessor methods', () => {
    it('should provide sessions batch operations', () => {
      const sessions = service.sessions;
      expect(sessions).toBeInstanceOf(KVBatchOperations);
    });

    it('should provide cache batch operations', () => {
      const cache = service.cache;
      expect(cache).toBeInstanceOf(KVBatchOperations);
    });
  });
});

// =================== KVKeyBuilder Tests ===================

describe('KVKeyBuilder', () => {
  describe('session keys', () => {
    it('should build session key', () => {
      expect(KVKeyBuilder.session('abc123')).toBe('session:abc123');
    });

    it('should return session TTL', () => {
      expect(typeof KVKeyBuilder.sessionTTL()).toBe('number');
    });
  });

  describe('websocket keys', () => {
    it('should build ws config key', () => {
      expect(KVKeyBuilder.wsConfig()).toBe('ws:config');
    });

    it('should build ws connection key', () => {
      expect(KVKeyBuilder.wsConn('conn123')).toBe('ws:conn:conn123');
    });
  });

  describe('message keys', () => {
    it('should build message recall key', () => {
      expect(KVKeyBuilder.msgRecall('msg123')).toBe('msg:recall:msg123');
    });

    it('should build message cancel key', () => {
      expect(KVKeyBuilder.msgCancel('msg123')).toBe('msg:cancel:msg123');
    });

    it('should build pending message key', () => {
      expect(KVKeyBuilder.msgPending('msg123')).toBe('msg:pending:msg123');
    });
  });

  describe('cache keys', () => {
    it('should build latest message cache key', () => {
      expect(KVKeyBuilder.cacheLatestMsg('conv123')).toBe('cache:msg:latest:conv123');
    });

    it('should build QR code cache key', () => {
      expect(KVKeyBuilder.cacheQrCode(1, 'qr123')).toBe('cache:qr:1:qr123');
      expect(KVKeyBuilder.cacheQrCode(1)).toBe('cache:qr:1:latest');
    });

    it('should build agent status cache key', () => {
      expect(KVKeyBuilder.cacheAgentStatus('agent1')).toBe('cache:agent:status:agent1');
    });

    it('should build analytics cache key', () => {
      expect(KVKeyBuilder.cacheAnalytics('daily', 'team1')).toBe('cache:analytics:daily:team1');
    });
  });

  describe('utility keys', () => {
    it('should build rate limit key', () => {
      expect(KVKeyBuilder.rateLimit('/api/messages', 'user123')).toBe('rate:/api/messages:user123');
    });

    it('should build circuit breaker stats key', () => {
      expect(KVKeyBuilder.cbStats('line-api')).toBe('cb:stats:line-api');
    });

    it('should build offline message key', () => {
      expect(KVKeyBuilder.offlineMsg('user1', 'msg1')).toBe('offline_msg:user1:msg1');
    });
  });

  describe('getAllTTL', () => {
    it('should return all TTL values', () => {
      const ttls = KVKeyBuilder.getAllTTL();
      expect(typeof ttls.SESSION).toBe('number');
      expect(typeof ttls.CACHE_MESSAGE).toBe('number');
    });
  });
});

// =================== TypedKV Tests ===================

describe('TypedKV', () => {
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockKV = createMockKV();
  });

  interface TestData {
    id: number;
    name: string;
    active: boolean;
  }

  it('should get typed data', async () => {
    const typedKV = new TypedKV<TestData>(
      mockKV,
      (id) => `test:${id}`,
      3600,
      false
    );

    const testData: TestData = { id: 1, name: 'Test', active: true };
    mockKV.store.set('test:1', JSON.stringify(testData));

    const result = await typedKV.get('1');

    expect(result).toEqual(testData);
  });

  it('should return null for missing key', async () => {
    const typedKV = new TypedKV<TestData>(
      mockKV,
      (id) => `test:${id}`,
      3600,
      false
    );

    const result = await typedKV.get('nonexistent');

    expect(result).toBeNull();
  });

  it('should set typed data', async () => {
    const typedKV = new TypedKV<TestData>(
      mockKV,
      (id) => `test:${id}`,
      3600,
      false
    );

    const testData: TestData = { id: 1, name: 'Test', active: true };
    await typedKV.set('1', testData);

    const stored = JSON.parse(mockKV.store.get('test:1')!);
    expect(stored).toEqual(testData);
  });

  it('should delete data', async () => {
    const typedKV = new TypedKV<TestData>(
      mockKV,
      (id) => `test:${id}`,
      3600,
      false
    );

    mockKV.store.set('test:1', JSON.stringify({ id: 1, name: 'Test', active: true }));
    await typedKV.delete('1');

    expect(mockKV.delete).toHaveBeenCalledWith('test:1');
  });

  it('should check existence', async () => {
    const typedKV = new TypedKV<TestData>(
      mockKV,
      (id) => `test:${id}`,
      3600,
      false
    );

    mockKV.store.set('test:1', JSON.stringify({ id: 1, name: 'Test', active: true }));

    expect(await typedKV.exists('1')).toBe(true);
    expect(await typedKV.exists('2')).toBe(false);
  });

  it('should apply TTL on set', async () => {
    const typedKV = new TypedKV<TestData>(
      mockKV,
      (id) => `test:${id}`,
      7200,
      false
    );

    await typedKV.set('1', { id: 1, name: 'Test', active: true });

    expect(mockKV.put).toHaveBeenCalledWith(
      'test:1',
      expect.any(String),
      expect.objectContaining({ expirationTtl: 7200 })
    );
  });
});

// =================== Integration Tests ===================

describe('KV Management Integration', () => {
  let mockEnv: { SESSIONS: ReturnType<typeof createMockKV>; CACHE: ReturnType<typeof createMockKV> };

  beforeEach(() => {
    mockEnv = {
      SESSIONS: createMockKV(),
      CACHE: createMockKV(),
    };
  });

  it('should handle full cleanup workflow', async () => {
    // Setup legacy keys
    mockEnv.SESSIONS.store.set('old_session:1', 'data1');
    mockEnv.SESSIONS.store.set('old_session:2', 'data2');
    mockEnv.SESSIONS.store.set('session:valid', 'valid-data');
    mockEnv.CACHE.store.set('deprecated:cache', 'old-data');

    const service = new KVManagementService(mockEnv as any);

    // Dry run first
    const dryRunResult = await service.cleanupLegacyKeys(true, false);
    expect(dryRunResult.sessions.deletedCount).toBe(2);
    expect(dryRunResult.cache.deletedCount).toBe(1);

    // Actual cleanup
    const cleanupResult = await service.cleanupLegacyKeys(false, false);
    // Duration should be a non-negative number (can be 0 if very fast)
    expect(cleanupResult.sessions.duration).toBeGreaterThanOrEqual(0);
  });

  it('should handle statistics with mixed key patterns', async () => {
    mockEnv.SESSIONS.store.set('session:1', 'data');
    mockEnv.SESSIONS.store.set('session:2', 'data');
    mockEnv.SESSIONS.store.set('ws:conn:1', 'data');
    mockEnv.SESSIONS.store.set('old_session:legacy', 'data');
    mockEnv.CACHE.store.set('cache:msg:latest:1', 'data');
    mockEnv.CACHE.store.set('cache:analytics:daily:1', 'data');

    const service = new KVManagementService(mockEnv as any);
    const stats = await service.getStatistics();

    expect(stats.sessions.totalKeys).toBe(4);
    expect(stats.sessions.legacyKeys).toBe(1);
    expect(stats.cache.totalKeys).toBe(2);
  });
});
