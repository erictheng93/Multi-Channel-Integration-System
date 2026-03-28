/**
 * KV Management Service
 *
 * Orchestrator for KV namespace management that delegates to sub-modules:
 * - kv-batch-operations.ts — batch get/put/delete with chunking
 * - kv-compression-service.ts — gzip compression/decompression
 * - kv-key-builder.ts — type-safe key construction + TypedKV wrapper
 * - kv-session-service.ts — session CRUD + validation
 *
 * Provides:
 * 1. Cleanup of obsolete/migration-related keys
 * 2. Key pattern statistics
 * 3. Namespace health monitoring
 * 4. Migration helpers
 *
 * @module services/kv-management-service
 */

import type { Bindings } from '../types/bindings';
import {
  KV_TTL,
  KV_KEY_PATTERNS,
  LEGACY_KEY_PATTERNS,
  validateKVKey,
} from '../config/kv-config';
import { nowMs } from '@/utils/timestamp';

// ── Re-exports from sub-modules (preserve public API) ──────────────

export { KVCompression } from './kv-compression-service';
export type { CompressedData } from './kv-compression-service';

export { KVBatchOperations } from './kv-batch-operations';
export type { BatchOperationResult } from './kv-batch-operations';

export { KVKeyBuilder, TypedKV } from './kv-key-builder';

// Re-export for backward compatibility
export { KV_KEY_PATTERNS, LEGACY_KEY_PATTERNS };

// Import concrete classes used internally
import { KVBatchOperations } from './kv-batch-operations';

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
