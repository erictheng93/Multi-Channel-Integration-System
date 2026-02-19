/**
 * KV Management Service
 *
 * Provides comprehensive utilities for KV namespace management:
 * 1. Cleanup of obsolete/migration-related keys
 * 2. Key pattern statistics
 * 3. Namespace health monitoring
 * 4. Batch operations with retry logic
 * 5. Data compression/decompression
 * 6. Type-safe key builders
 *
 * @module services/kv-management-service
 */

import type { Bindings } from '../types/bindings';
import {
  KV_TTL,
  KV_BATCH_CONFIG,
  KV_COMPRESSION_CONFIG,
  KV_KEY_PATTERNS,
  LEGACY_KEY_PATTERNS,
  KEY_MIGRATION_MAP,
  getNamespaceForKey,
  validateKVKey,
} from '../config/kv-config';
import { nowMs } from '@/utils/timestamp'

// Re-export for backward compatibility
export { KV_KEY_PATTERNS, LEGACY_KEY_PATTERNS };

// =================== Types ===================

export interface KVCleanupResult {
  namespace: 'SESSIONS' | 'CACHE';
  deletedCount: number;
  deletedKeys: string[];
  migratedKeys: string[];
  errors: string[];
  duration: number;
}

export interface KVStatistics {
  namespace: 'SESSIONS' | 'CACHE';
  totalKeys: number;
  keysByPattern: Record<string, number>;
  legacyKeys: number;
  estimatedSize: string;
}

export interface BatchOperationResult<T> {
  success: boolean;
  processed: number;
  failed: number;
  results: T[];
  errors: string[];
  duration: number;
}

export interface CompressedData {
  compressed: boolean;
  originalSize: number;
  compressedSize?: number;
  data: string;
}

// =================== Compression Utilities ===================

/**
 * Simple compression using base64 and run-length encoding
 * Note: For production, consider using CompressionStream API when available
 */
export class KVCompression {
  /**
   * Check if data should be compressed
   */
  static shouldCompress(key: string, data: string): boolean {
    // Never compress small data
    if (data.length < KV_COMPRESSION_CONFIG.MIN_SIZE_FOR_COMPRESSION) {
      return false;
    }

    // Check never-compress prefixes
    for (const prefix of KV_COMPRESSION_CONFIG.NEVER_COMPRESS_PREFIXES) {
      if (key.startsWith(prefix)) {
        return false;
      }
    }

    // Always compress certain prefixes
    for (const prefix of KV_COMPRESSION_CONFIG.ALWAYS_COMPRESS_PREFIXES) {
      if (key.startsWith(prefix)) {
        return true;
      }
    }

    // Compress if above threshold
    return data.length >= KV_COMPRESSION_CONFIG.MIN_SIZE_FOR_COMPRESSION;
  }

  /**
   * Compress data if beneficial
   */
  static async compress(key: string, data: string): Promise<CompressedData> {
    const originalSize = data.length;

    if (!this.shouldCompress(key, data)) {
      return {
        compressed: false,
        originalSize,
        data,
      };
    }

    try {
      // Use CompressionStream if available (modern browsers/workers)
      if (typeof CompressionStream !== 'undefined') {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(data));
            controller.close();
          },
        });

        const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
        const reader = compressedStream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const compressed = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          compressed.set(chunk, offset);
          offset += chunk.length;
        }

        // Only use compression if it actually reduces size
        const compressedBase64 = btoa(String.fromCharCode(...compressed));
        if (compressedBase64.length < originalSize * 0.9) {
          return {
            compressed: true,
            originalSize,
            compressedSize: compressedBase64.length,
            data: `__COMPRESSED__:${compressedBase64}`,
          };
        }
      }
    } catch (error) {
      console.warn('[KVCompression] Compression failed, storing uncompressed:', error);
    }

    return {
      compressed: false,
      originalSize,
      data,
    };
  }

  /**
   * Decompress data if compressed
   */
  static async decompress(data: string): Promise<string> {
    if (!data.startsWith('__COMPRESSED__:')) {
      return data;
    }

    try {
      const compressedBase64 = data.slice('__COMPRESSED__:'.length);
      const compressedBytes = Uint8Array.from(atob(compressedBase64), c => c.charCodeAt(0));

      if (typeof DecompressionStream !== 'undefined') {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(compressedBytes);
            controller.close();
          },
        });

        const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
        const reader = decompressedStream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        const decoder = new TextDecoder();
        return chunks.map(chunk => decoder.decode(chunk)).join('');
      }
    } catch (error) {
      console.error('[KVCompression] Decompression failed:', error);
      throw new Error('Failed to decompress data');
    }

    return data;
  }
}

// =================== Batch Operations ===================

/**
 * Batch KV operations with retry logic
 */
export class KVBatchOperations {
  private kv: KVNamespace;
  private config = KV_BATCH_CONFIG;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Batch get multiple keys
   */
  async batchGet<T = string>(
    keys: string[],
    options?: { type?: 'text' | 'json' | 'arrayBuffer' }
  ): Promise<BatchOperationResult<{ key: string; value: T | null }>> {
    const startTime = nowMs();
    const results: { key: string; value: T | null }[] = [];
    const errors: string[] = [];

    // Process in chunks
    const chunks = this.chunkArray(keys, this.config.MAX_BATCH_SIZE);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (key) => {
        try {
          let value: T | null = null;
          if (options?.type === 'json') {
            value = await this.kv.get(key, 'json') as T | null;
          } else if (options?.type === 'arrayBuffer') {
            value = await this.kv.get(key, 'arrayBuffer') as T | null;
          } else {
            const raw = await this.kv.get(key, 'text');
            if (raw) {
              value = await KVCompression.decompress(raw) as T;
            }
          }
          return { key, value, error: null };
        } catch (error) {
          return { key, value: null, error: String(error) };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);

      for (const result of chunkResults) {
        if (result.error) {
          errors.push(`${result.key}: ${result.error}`);
        }
        results.push({ key: result.key, value: result.value });
      }
    }

    return {
      success: errors.length === 0,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Batch put multiple key-value pairs
   */
  async batchPut(
    items: Array<{
      key: string;
      value: string;
      ttl?: number;
      metadata?: Record<string, unknown>;
    }>,
    options?: { compress?: boolean }
  ): Promise<BatchOperationResult<{ key: string; success: boolean }>> {
    const startTime = nowMs();
    const results: { key: string; success: boolean }[] = [];
    const errors: string[] = [];

    // Process in chunks with parallel limit
    const chunks = this.chunkArray(items, this.config.MAX_PARALLEL_OPS);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (item) => {
        try {
          let valueToStore = item.value;

          // Apply compression if requested
          if (options?.compress !== false) {
            const compressed = await KVCompression.compress(item.key, item.value);
            valueToStore = compressed.data;
          }

          await this.kv.put(item.key, valueToStore, {
            expirationTtl: item.ttl,
            metadata: item.metadata,
          });

          return { key: item.key, success: true, error: null };
        } catch (error) {
          return { key: item.key, success: false, error: String(error) };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);

      for (const result of chunkResults) {
        if (result.error) {
          errors.push(`${result.key}: ${result.error}`);
        }
        results.push({ key: result.key, success: result.success });
      }
    }

    return {
      success: errors.length === 0,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Batch delete multiple keys
   */
  async batchDelete(keys: string[]): Promise<BatchOperationResult<{ key: string; deleted: boolean }>> {
    const startTime = nowMs();
    const results: { key: string; deleted: boolean }[] = [];
    const errors: string[] = [];

    // Process in chunks
    const chunks = this.chunkArray(keys, this.config.MAX_PARALLEL_OPS);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (key) => {
        try {
          await this.kv.delete(key);
          return { key, deleted: true, error: null };
        } catch (error) {
          return { key, deleted: false, error: String(error) };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);

      for (const result of chunkResults) {
        if (result.error) {
          errors.push(`${result.key}: ${result.error}`);
        }
        results.push({ key: result.key, deleted: result.deleted });
      }
    }

    return {
      success: errors.length === 0,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * List all keys with pagination
   */
  async listAllKeys(prefix?: string): Promise<string[]> {
    const allKeys: string[] = [];
    let cursor: string | undefined;

    do {
      const listResult = await this.kv.list({
        prefix,
        cursor,
        limit: 1000,
      });
      allKeys.push(...listResult.keys.map(k => k.name));
      cursor = listResult.list_complete ? undefined : listResult.cursor;
    } while (cursor);

    return allKeys;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// =================== Main Service ===================

export class KVManagementService {
  private env: Bindings;
  private sessionsBatch: KVBatchOperations;
  private cacheBatch: KVBatchOperations;

  constructor(env: Bindings) {
    this.env = env;
    this.sessionsBatch = new KVBatchOperations(env.SESSIONS);
    this.cacheBatch = new KVBatchOperations(env.CACHE);
  }

  // =================== Cleanup Operations ===================

  /**
   * Clean up legacy/obsolete keys from KV namespaces
   * @param dryRun If true, only report what would be deleted
   * @param migrate If true, migrate keys to new patterns before deleting
   */
  async cleanupLegacyKeys(
    dryRun: boolean = true,
    migrate: boolean = true
  ): Promise<{
    sessions: KVCleanupResult;
    cache: KVCleanupResult;
  }> {
    const [sessionsResult, cacheResult] = await Promise.all([
      this.cleanupNamespace(this.env.SESSIONS, 'SESSIONS', dryRun, migrate),
      this.cleanupNamespace(this.env.CACHE, 'CACHE', dryRun, migrate),
    ]);

    return {
      sessions: sessionsResult,
      cache: cacheResult,
    };
  }

  private async cleanupNamespace(
    kv: KVNamespace,
    namespace: 'SESSIONS' | 'CACHE',
    dryRun: boolean,
    migrate: boolean
  ): Promise<KVCleanupResult> {
    const startTime = nowMs();
    const result: KVCleanupResult = {
      namespace,
      deletedCount: 0,
      deletedKeys: [],
      migratedKeys: [],
      errors: [],
      duration: 0,
    };

    try {
      // List all keys
      const batchOps = new KVBatchOperations(kv);
      const allKeys = await batchOps.listAllKeys();

      // Filter legacy keys
      const legacyKeys = allKeys.filter(key =>
        LEGACY_KEY_PATTERNS.some(pattern => key.startsWith(pattern))
      );

      result.deletedKeys = legacyKeys;
      result.deletedCount = legacyKeys.length;

      if (!dryRun && legacyKeys.length > 0) {
        // Migrate keys if requested
        if (migrate) {
          for (const oldKey of legacyKeys) {
            const validation = validateKVKey(oldKey);
            if (validation.suggestion) {
              const migrated = await this.migrateKey(kv, oldKey, validation.suggestion, false);
              if (migrated) {
                result.migratedKeys.push(`${oldKey} -> ${validation.suggestion}`);
              }
            }
          }
        }

        // Delete legacy keys
        const deleteResult = await batchOps.batchDelete(legacyKeys);
        result.deletedCount = deleteResult.processed - deleteResult.failed;
        result.errors = deleteResult.errors;
      }
    } catch (error) {
      result.errors.push(`Namespace error: ${error}`);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  // =================== Statistics ===================

  /**
   * Get statistics about KV key usage
   */
  async getStatistics(): Promise<{
    sessions: KVStatistics;
    cache: KVStatistics;
  }> {
    const [sessionsStats, cacheStats] = await Promise.all([
      this.getNamespaceStats(this.env.SESSIONS, 'SESSIONS'),
      this.getNamespaceStats(this.env.CACHE, 'CACHE'),
    ]);

    return {
      sessions: sessionsStats,
      cache: cacheStats,
    };
  }

  private async getNamespaceStats(
    kv: KVNamespace,
    namespace: 'SESSIONS' | 'CACHE'
  ): Promise<KVStatistics> {
    const stats: KVStatistics = {
      namespace,
      totalKeys: 0,
      keysByPattern: {},
      legacyKeys: 0,
      estimatedSize: '0 KB',
    };

    try {
      const batchOps = new KVBatchOperations(kv);
      const allKeys = await batchOps.listAllKeys();

      stats.totalKeys = allKeys.length;

      // Categorize by pattern
      const patterns = namespace === 'SESSIONS'
        ? Object.values(KV_KEY_PATTERNS.sessions)
        : Object.values(KV_KEY_PATTERNS.cache);

      for (const key of allKeys) {
        let matched = false;

        // Check current patterns
        for (const pattern of patterns) {
          if (key.startsWith(pattern)) {
            stats.keysByPattern[pattern] = (stats.keysByPattern[pattern] || 0) + 1;
            matched = true;
            break;
          }
        }

        // Check legacy patterns
        if (!matched) {
          for (const legacyPattern of LEGACY_KEY_PATTERNS) {
            if (key.startsWith(legacyPattern)) {
              stats.legacyKeys++;
              stats.keysByPattern[`[LEGACY] ${legacyPattern}`] =
                (stats.keysByPattern[`[LEGACY] ${legacyPattern}`] || 0) + 1;
              matched = true;
              break;
            }
          }
        }

        // Unknown pattern
        if (!matched) {
          stats.keysByPattern['[UNKNOWN]'] = (stats.keysByPattern['[UNKNOWN]'] || 0) + 1;
        }
      }

      // Estimate size (rough approximation: avg 500 bytes per key)
      const estimatedBytes = allKeys.length * 500;
      if (estimatedBytes < 1024) {
        stats.estimatedSize = `${estimatedBytes} B`;
      } else if (estimatedBytes < 1024 * 1024) {
        stats.estimatedSize = `${(estimatedBytes / 1024).toFixed(1)} KB`;
      } else {
        stats.estimatedSize = `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;
      }
    } catch (error) {
      console.error(`[KVManagement] Error getting stats for ${namespace}:`, error);
    }

    return stats;
  }

  // =================== Migration Helpers ===================

  /**
   * Migrate a key from old pattern to new pattern
   */
  async migrateKey(
    kv: KVNamespace,
    oldKey: string,
    newKey: string,
    deleteOld: boolean = false
  ): Promise<boolean> {
    try {
      const value = await kv.get(oldKey);
      if (value === null) {
        return false;
      }

      // Get metadata if available
      const valueWithMeta = await kv.getWithMetadata(oldKey);

      // Write to new key with same expiration if possible
      await kv.put(newKey, value, {
        metadata: valueWithMeta.metadata,
      });

      if (deleteOld) {
        await kv.delete(oldKey);
      }

      return true;
    } catch (error) {
      console.error(`[KVManagement] Migration error ${oldKey} -> ${newKey}:`, error);
      return false;
    }
  }

  /**
   * Batch migrate keys matching a pattern
   */
  async batchMigrateKeys(
    kv: KVNamespace,
    oldPattern: string,
    newPattern: string,
    deleteOld: boolean = false
  ): Promise<{ migrated: number; failed: number }> {
    let migrated = 0;
    let failed = 0;

    try {
      const batchOps = new KVBatchOperations(kv);
      const keys = await batchOps.listAllKeys(oldPattern);

      for (const key of keys) {
        const newKey = key.replace(oldPattern, newPattern);
        const success = await this.migrateKey(kv, key, newKey, deleteOld);
        if (success) {
          migrated++;
        } else {
          failed++;
        }
      }
    } catch (error) {
      console.error(`[KVManagement] Batch migration error:`, error);
    }

    return { migrated, failed };
  }

  // =================== Health Check ===================

  /**
   * Check KV namespace health
   */
  async healthCheck(): Promise<{
    sessions: { healthy: boolean; latency: number };
    cache: { healthy: boolean; latency: number };
  }> {
    const testKey = `health:test:${nowMs()}`;
    const testValue = 'health_check';

    const checkNamespace = async (kv: KVNamespace): Promise<{ healthy: boolean; latency: number }> => {
      const start = nowMs();
      try {
        await kv.put(testKey, testValue, { expirationTtl: KV_TTL.TEST });
        const retrieved = await kv.get(testKey);
        await kv.delete(testKey);
        return {
          healthy: retrieved === testValue,
          latency: Date.now() - start,
        };
      } catch {
        return {
          healthy: false,
          latency: Date.now() - start,
        };
      }
    };

    const [sessions, cache] = await Promise.all([
      checkNamespace(this.env.SESSIONS),
      checkNamespace(this.env.CACHE),
    ]);

    return { sessions, cache };
  }

  // =================== Batch Operation Accessors ===================

  /**
   * Get batch operations for SESSIONS namespace
   */
  get sessions(): KVBatchOperations {
    return this.sessionsBatch;
  }

  /**
   * Get batch operations for CACHE namespace
   */
  get cache(): KVBatchOperations {
    return this.cacheBatch;
  }
}

// =================== Enhanced Key Builder ===================

/**
 * Type-safe KV key builder with TTL helpers
 */
export const KVKeyBuilder = {
  // ─────────────────────────────────────────────────────────
  // Session Keys (SESSIONS namespace)
  // ─────────────────────────────────────────────────────────

  /** User session key */
  session: (sessionId: string) => `session:${sessionId}`,
  sessionTTL: () => KV_TTL.SESSION,

  /** WebSocket configuration */
  wsConfig: () => 'ws:config',

  /** WebSocket connection */
  wsConn: (connId: string) => `ws:conn:${connId}`,
  wsConnTTL: () => KV_TTL.WEBSOCKET_CONNECTION,

  /** Message recall state */
  msgRecall: (messageId: string) => `msg:recall:${messageId}`,
  msgRecallTTL: () => KV_TTL.MESSAGE_RECALL,

  /** Message cancel state */
  msgCancel: (messageId: string) => `msg:cancel:${messageId}`,
  msgCancelTTL: () => KV_TTL.MESSAGE_CANCEL,

  /** Pending message */
  msgPending: (messageId: string) => `msg:pending:${messageId}`,
  msgPendingTTL: () => KV_TTL.MESSAGE_PENDING,

  /** Offline message */
  offlineMsg: (userId: string, messageId: string) => `offline_msg:${userId}:${messageId}`,
  offlineMsgTTL: () => KV_TTL.OFFLINE_MESSAGE,

  /** Rate limiting */
  rateLimit: (endpoint: string, identifier: string) => `rate:${endpoint}:${identifier}`,
  rateLimitTTL: () => KV_TTL.RATE_LIMIT,

  /** Circuit breaker stats */
  cbStats: (service: string) => `cb:stats:${service}`,
  cbStatsTTL: () => KV_TTL.CIRCUIT_BREAKER,

  /** Circuit breaker alerts */
  cbAlerts: (service: string) => `cb:alerts:${service}`,
  cbAlertsTTL: () => KV_TTL.CIRCUIT_BREAKER,

  /** Realtime event */
  rtEvent: (eventId: string) => `rt:event:${eventId}`,
  rtEventTTL: () => KV_TTL.REALTIME_EVENT,

  // ─────────────────────────────────────────────────────────
  // Cache Keys (CACHE namespace)
  // ─────────────────────────────────────────────────────────

  /** Latest message cache */
  cacheLatestMsg: (convId: string) => `cache:msg:latest:${convId}`,
  cacheLatestMsgTTL: () => KV_TTL.CACHE_MESSAGE,

  /** QR code cache */
  cacheQrCode: (teamId: number, qrCodeId?: string) =>
    qrCodeId ? `cache:qr:${teamId}:${qrCodeId}` : `cache:qr:${teamId}:latest`,
  cacheQrCodeTTL: () => KV_TTL.CACHE_QR_CODE,

  /** Agent status cache */
  cacheAgentStatus: (agentId: string) => `cache:agent:status:${agentId}`,
  cacheAgentStatusTTL: () => KV_TTL.CACHE_AGENT_STATUS,

  /** Agent skills cache */
  cacheAgentSkills: (agentId: string) => `cache:agent:skills:${agentId}`,
  cacheAgentSkillsTTL: () => KV_TTL.CACHE_AGENT_SKILLS,

  /** Analytics cache */
  cacheAnalytics: (type: string, id: string) => `cache:analytics:${type}:${id}`,
  cacheAnalyticsTTL: () => KV_TTL.CACHE_ANALYTICS,

  /** Report cache */
  cacheReport: (reportId: string) => `cache:report:${reportId}`,
  cacheReportTTL: () => KV_TTL.CACHE_REPORT,

  /** Dashboard cache */
  cacheDashboard: (dashId: string) => `cache:dashboard:${dashId}`,
  cacheDashboardTTL: () => KV_TTL.CACHE_DASHBOARD,

  /** Health check cache */
  cacheHealth: () => 'cache:health',
  cacheHealthTTL: () => KV_TTL.CACHE_HEALTH,

  /** HTTP response cache */
  cacheHttp: (url: string) => `cache:http:${url}`,
  cacheHttpTTL: () => KV_TTL.CACHE_HTTP,

  /** Query result cache */
  cacheQuery: (queryKey: string) => `cache:query:${queryKey}`,
  cacheQueryTTL: () => KV_TTL.CACHE_QUERY,

  /** Credentials (encrypted) */
  credentials: (platform: string, type: string) => `credentials:${platform}:${type}`,

  /** Alert configuration */
  alertConfig: () => 'alert:config',
  alertConfigTTL: () => KV_TTL.ALERT_CONFIG,

  /** Report template */
  template: (templateId: string) => `template:${templateId}`,
  templateTTL: () => KV_TTL.REPORT_TEMPLATE,

  /** Report generation status */
  generation: (reportId: string) => `generation:${reportId}`,
  generationTTL: () => KV_TTL.GENERATION_STATUS,

  /** Batch operation tracking */
  batch: (batchId: string) => `batch:${batchId}`,
  batchTTL: () => KV_TTL.BATCH_TRACKING,

  // ─────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────

  /** Validate a key against naming conventions */
  validate: validateKVKey,

  /** Get namespace for a key */
  getNamespace: getNamespaceForKey,

  /** Get all TTL values */
  getAllTTL: () => KV_TTL,
};

// =================== Typed KV Wrapper ===================

/**
 * Type-safe KV wrapper with automatic compression and TTL
 */
export class TypedKV<T> {
  private kv: KVNamespace;
  private keyBuilder: (id: string) => string;
  private ttl: number;
  private compress: boolean;

  constructor(
    kv: KVNamespace,
    keyBuilder: (id: string) => string,
    ttl: number,
    compress: boolean = false
  ) {
    this.kv = kv;
    this.keyBuilder = keyBuilder;
    this.ttl = ttl;
    this.compress = compress;
  }

  async get(id: string): Promise<T | null> {
    const key = this.keyBuilder(id);
    const raw = await this.kv.get(key, 'text');
    if (!raw) return null;

    const decompressed = await KVCompression.decompress(raw);
    return JSON.parse(decompressed) as T;
  }

  async set(id: string, value: T): Promise<void> {
    const key = this.keyBuilder(id);
    const serialized = JSON.stringify(value);

    let valueToStore = serialized;
    if (this.compress) {
      const compressed = await KVCompression.compress(key, serialized);
      valueToStore = compressed.data;
    }

    await this.kv.put(key, valueToStore, {
      expirationTtl: this.ttl > 0 ? this.ttl : undefined,
    });
  }

  async delete(id: string): Promise<void> {
    const key = this.keyBuilder(id);
    await this.kv.delete(key);
  }

  async exists(id: string): Promise<boolean> {
    const key = this.keyBuilder(id);
    const value = await this.kv.get(key);
    return value !== null;
  }
}
