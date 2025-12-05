/**
 * KV Management Service
 *
 * Provides utilities for KV namespace management:
 * 1. Cleanup of obsolete/migration-related keys
 * 2. Key pattern statistics
 * 3. Namespace health monitoring
 *
 * @module services/kv-management-service
 */

import type { Bindings } from '../types/bindings';

// =================== Key Pattern Definitions ===================

/**
 * Unified KV Key Naming Convention
 *
 * Format: {namespace}:{entity}:{identifier}[:{sub-key}]
 *
 * SESSIONS KV (stateful data):
 * - session:{sessionId}           - User sessions (TTL: 30 days)
 * - ws:config                     - WebSocket configuration (no TTL)
 * - ws:conn:{connId}              - WebSocket connections (TTL: 5 min)
 * - sse:conn:{connId}             - SSE connections (TTL: 5 min)
 * - sse:stats                     - SSE statistics (TTL: 5 min)
 * - msg:recall:{messageId}        - Message recall state (TTL: 5 min)
 * - msg:cancel:{messageId}        - Message cancel state (TTL: 5 min)
 * - msg:pending:{messageId}       - Pending messages (TTL: 1 hour)
 * - rate:{endpoint}:{identifier}  - Rate limiting (TTL: 1 min)
 * - cb:stats:{service}            - Circuit breaker stats (TTL: 5 min)
 * - cb:alerts:{service}           - Circuit breaker alerts (TTL: 5 min)
 * - rt:event:{eventId}            - Realtime events (TTL: 5 min)
 *
 * CACHE KV (cacheable data):
 * - cache:msg:latest:{convId}     - Latest message cache (TTL: 24 hours)
 * - cache:qr:{teamId}:{qrCodeId}  - QR code cache (TTL: 24 hours)
 * - cache:agent:status:{agentId}  - Agent status (TTL: 5 min)
 * - cache:agent:skills:{agentId}  - Agent skills (TTL: 1 hour)
 * - cache:analytics:{type}:{id}   - Analytics cache (TTL: 1 hour)
 * - cache:report:{reportId}       - Report cache (TTL: 1 hour)
 * - cache:dashboard:{dashId}      - Dashboard cache (TTL: 1 hour)
 * - cache:health                  - Health check (TTL: 1 min)
 */

export const KV_KEY_PATTERNS = {
  // SESSIONS KV patterns
  sessions: {
    session: 'session:',
    wsConfig: 'ws:config',
    wsConn: 'ws:conn:',
    sseConn: 'sse:conn:',
    sseStats: 'sse:stats',
    msgRecall: 'msg:recall:',
    msgCancel: 'msg:cancel:',
    msgPending: 'msg:pending:',
    rateLimit: 'rate:',
    circuitBreakerStats: 'cb:stats:',
    circuitBreakerAlerts: 'cb:alerts:',
    realtimeEvent: 'rt:event:',
  },
  // CACHE KV patterns
  cache: {
    latestMessage: 'cache:msg:latest:',
    qrCode: 'cache:qr:',
    agentStatus: 'cache:agent:status:',
    agentSkills: 'cache:agent:skills:',
    analytics: 'cache:analytics:',
    report: 'cache:report:',
    dashboard: 'cache:dashboard:',
    health: 'cache:health',
  },
} as const;

// Legacy key patterns to be cleaned up
export const LEGACY_KEY_PATTERNS = [
  // Migration-related keys (no longer used after WebSocket 100% deployment)
  'migration_counter:',
  'migration_decision:',
  'team_migration_level:',
  'user_feature_flag:',
  'deployment_plan:',
  'deployment_execution:',
  'emergency_action:',
  'migration_config_backup',
  'feature_flag:',
  // Old naming conventions
  'websocket_migration_config', // Renamed to ws:config
  'latest_msg:', // Renamed to cache:msg:latest:
  'qr:team:', // Renamed to cache:qr:
  'recallable:', // Renamed to msg:recall:
  'cancelled:', // Renamed to msg:cancel:
  'sse_connection:', // Renamed to sse:conn:
  'ws_conn:', // Renamed to ws:conn:
  'pending_msg:', // Renamed to msg:pending:
  'rate_limit:', // Renamed to rate:
  'circuit_breaker_', // Renamed to cb:
  'realtime_event:', // Renamed to rt:event:
];

// =================== Service Implementation ===================

export interface KVCleanupResult {
  namespace: 'SESSIONS' | 'CACHE';
  deletedCount: number;
  deletedKeys: string[];
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

export class KVManagementService {
  private env: Bindings;

  constructor(env: Bindings) {
    this.env = env;
  }

  // =================== Cleanup Operations ===================

  /**
   * Clean up legacy/obsolete keys from KV namespaces
   * @param dryRun If true, only report what would be deleted
   */
  async cleanupLegacyKeys(dryRun: boolean = true): Promise<{
    sessions: KVCleanupResult;
    cache: KVCleanupResult;
  }> {
    const [sessionsResult, cacheResult] = await Promise.all([
      this.cleanupNamespace(this.env.SESSIONS, 'SESSIONS', dryRun),
      this.cleanupNamespace(this.env.CACHE, 'CACHE', dryRun),
    ]);

    return {
      sessions: sessionsResult,
      cache: cacheResult,
    };
  }

  private async cleanupNamespace(
    kv: KVNamespace,
    namespace: 'SESSIONS' | 'CACHE',
    dryRun: boolean
  ): Promise<KVCleanupResult> {
    const startTime = Date.now();
    const result: KVCleanupResult = {
      namespace,
      deletedCount: 0,
      deletedKeys: [],
      errors: [],
      duration: 0,
    };

    try {
      // List all keys
      let cursor: string | undefined;
      const allKeys: string[] = [];

      do {
        const listResult = await kv.list({ cursor, limit: 1000 });
        allKeys.push(...listResult.keys.map(k => k.name));
        cursor = listResult.list_complete ? undefined : listResult.cursor;
      } while (cursor);

      // Filter legacy keys
      const legacyKeys = allKeys.filter(key =>
        LEGACY_KEY_PATTERNS.some(pattern => key.startsWith(pattern))
      );

      result.deletedKeys = legacyKeys;
      result.deletedCount = legacyKeys.length;

      // Delete if not dry run
      if (!dryRun && legacyKeys.length > 0) {
        const deletePromises = legacyKeys.map(async (key) => {
          try {
            await kv.delete(key);
          } catch (error) {
            result.errors.push(`Failed to delete ${key}: ${error}`);
          }
        });

        await Promise.all(deletePromises);
        result.deletedCount = legacyKeys.length - result.errors.length;
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
      // List all keys
      let cursor: string | undefined;
      const allKeys: string[] = [];

      do {
        const listResult = await kv.list({ cursor, limit: 1000 });
        allKeys.push(...listResult.keys.map(k => k.name));
        cursor = listResult.list_complete ? undefined : listResult.cursor;
      } while (cursor);

      stats.totalKeys = allKeys.length;

      // Categorize by pattern
      const patterns = namespace === 'SESSIONS'
        ? Object.values(KV_KEY_PATTERNS.sessions)
        : Object.values(KV_KEY_PATTERNS.cache);

      for (const key of allKeys) {
        // Check current patterns
        let matched = false;
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
      const listResult = await kv.list({ prefix: oldPattern });

      for (const key of listResult.keys) {
        const newKey = key.name.replace(oldPattern, newPattern);
        const success = await this.migrateKey(kv, key.name, newKey, deleteOld);
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
    const testKey = `health:test:${Date.now()}`;
    const testValue = 'health_check';

    const checkNamespace = async (kv: KVNamespace): Promise<{ healthy: boolean; latency: number }> => {
      const start = Date.now();
      try {
        await kv.put(testKey, testValue, { expirationTtl: 60 });
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
}

// =================== Key Builder Utilities ===================

/**
 * Helper functions to build standardized KV keys
 */
export const KVKeyBuilder = {
  // Session keys
  session: (sessionId: string) => `session:${sessionId}`,

  // WebSocket keys
  wsConfig: () => 'ws:config',
  wsConn: (connId: string) => `ws:conn:${connId}`,

  // SSE keys
  sseConn: (connId: string) => `sse:conn:${connId}`,
  sseStats: () => 'sse:stats',

  // Message keys
  msgRecall: (messageId: string) => `msg:recall:${messageId}`,
  msgCancel: (messageId: string) => `msg:cancel:${messageId}`,
  msgPending: (messageId: string) => `msg:pending:${messageId}`,

  // Rate limiting keys
  rateLimit: (endpoint: string, identifier: string) => `rate:${endpoint}:${identifier}`,

  // Circuit breaker keys
  cbStats: (service: string) => `cb:stats:${service}`,
  cbAlerts: (service: string) => `cb:alerts:${service}`,

  // Realtime event keys
  rtEvent: (eventId: string) => `rt:event:${eventId}`,

  // Cache keys
  cacheLatestMsg: (convId: string) => `cache:msg:latest:${convId}`,
  cacheQrCode: (teamId: number, qrCodeId?: string) =>
    qrCodeId ? `cache:qr:${teamId}:${qrCodeId}` : `cache:qr:${teamId}:latest`,
  cacheAgentStatus: (agentId: string) => `cache:agent:status:${agentId}`,
  cacheAgentSkills: (agentId: string) => `cache:agent:skills:${agentId}`,
  cacheAnalytics: (type: string, id: string) => `cache:analytics:${type}:${id}`,
  cacheReport: (reportId: string) => `cache:report:${reportId}`,
  cacheDashboard: (dashId: string) => `cache:dashboard:${dashId}`,
  cacheHealth: () => 'cache:health',
};
