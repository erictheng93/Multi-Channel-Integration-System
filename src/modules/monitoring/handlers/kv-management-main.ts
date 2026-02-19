/**
 * KV Management API Handler
 *
 * Provides admin endpoints for KV namespace management:
 * - GET /api/kv/stats - Get KV statistics
 * - GET /api/kv/health - KV health check
 * - POST /api/kv/cleanup - Clean up legacy keys (dry-run by default)
 * - POST /api/kv/cleanup?execute=true - Execute cleanup
 * - POST /api/kv/migrate - Migrate specific key patterns
 * - GET /api/kv/config - Get KV configuration (TTL, batch, compression)
 *
 * All endpoints require admin authentication.
 */

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import type { Bindings } from '@/types/bindings';
import { jwtAuth } from '@/middleware/auth';
import { KVManagementService, KV_KEY_PATTERNS, LEGACY_KEY_PATTERNS } from '@/services/kv-management-service';
import { KV_TTL, KV_BATCH_CONFIG, KV_COMPRESSION_CONFIG, KEY_MIGRATION_MAP } from '@/config/kv-config';
import { nowISO } from '@/utils/timestamp'

const kvManagementHandler = new Hono<{ Bindings: Bindings }>();

// =================== Statistics Endpoint ===================

/**
 * GET /api/kv/stats
 * Get statistics about KV key usage
 */
kvManagementHandler.get('/stats', jwtAuth, async (c) => {
  try {
    // Check admin role
    const agent = c.get('agent' as never) as { role?: string } | undefined;
    if (!agent || agent.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, HTTP_STATUS.FORBIDDEN);
    }

    const kvService = new KVManagementService(c.env);
    const stats = await kvService.getStatistics();

    return c.json({
      success: true,
      timestamp: nowISO(),
      statistics: stats,
      keyPatterns: {
        current: KV_KEY_PATTERNS,
        legacy: LEGACY_KEY_PATTERNS,
      },
    });
  } catch (error) {
    console.error('[KV Management] Stats error:', error);
    return c.json({
      success: false,
      error: 'Failed to get KV statistics',
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== Health Check Endpoint ===================

/**
 * GET /api/kv/health
 * Check KV namespace health
 */
kvManagementHandler.get('/health', jwtAuth, async (c) => {
  try {
    const kvService = new KVManagementService(c.env);
    const health = await kvService.healthCheck();

    const allHealthy = health.sessions.healthy && health.cache.healthy;

    return c.json({
      success: true,
      timestamp: nowISO(),
      status: allHealthy ? 'healthy' : 'degraded',
      namespaces: {
        sessions: {
          status: health.sessions.healthy ? 'healthy' : 'unhealthy',
          latency: `${health.sessions.latency}ms`,
        },
        cache: {
          status: health.cache.healthy ? 'healthy' : 'unhealthy',
          latency: `${health.cache.latency}ms`,
        },
      },
    });
  } catch (error) {
    console.error('[KV Management] Health check error:', error);
    return c.json({
      success: false,
      error: 'Failed to check KV health',
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== Cleanup Endpoint ===================

/**
 * POST /api/kv/cleanup
 * Clean up legacy/obsolete keys
 *
 * Query params:
 * - execute: Set to 'true' to actually delete keys (default: dry-run)
 */
kvManagementHandler.post('/cleanup', jwtAuth, async (c) => {
  try {
    // Check admin role
    const agent = c.get('agent' as never) as { role?: string } | undefined;
    if (!agent || agent.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, HTTP_STATUS.FORBIDDEN);
    }

    const execute = c.req.query('execute') === 'true';
    const dryRun = !execute;

    const kvService = new KVManagementService(c.env);
    const result = await kvService.cleanupLegacyKeys(dryRun);

    const totalDeleted = result.sessions.deletedCount + result.cache.deletedCount;
    const totalErrors = result.sessions.errors.length + result.cache.errors.length;

    return c.json({
      success: true,
      timestamp: nowISO(),
      mode: dryRun ? 'dry-run' : 'execute',
      summary: {
        totalKeysFound: totalDeleted,
        totalDeleted: dryRun ? 0 : totalDeleted - totalErrors,
        totalErrors: totalErrors,
        duration: `${result.sessions.duration + result.cache.duration}ms`,
      },
      details: {
        sessions: {
          keysFound: result.sessions.deletedCount,
          deleted: dryRun ? 0 : result.sessions.deletedCount - result.sessions.errors.length,
          errors: result.sessions.errors,
          keys: result.sessions.deletedKeys.slice(0, 50), // Limit to first 50
          hasMore: result.sessions.deletedKeys.length > 50,
        },
        cache: {
          keysFound: result.cache.deletedCount,
          deleted: dryRun ? 0 : result.cache.deletedCount - result.cache.errors.length,
          errors: result.cache.errors,
          keys: result.cache.deletedKeys.slice(0, 50), // Limit to first 50
          hasMore: result.cache.deletedKeys.length > 50,
        },
      },
      legacyPatterns: LEGACY_KEY_PATTERNS,
      note: dryRun
        ? 'This was a dry-run. Add ?execute=true to actually delete keys.'
        : 'Keys have been deleted.',
    });
  } catch (error) {
    console.error('[KV Management] Cleanup error:', error);
    return c.json({
      success: false,
      error: 'Failed to clean up KV keys',
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== Configuration Endpoint ===================

/**
 * GET /api/kv/config
 * Get KV configuration including TTL, batch, and compression settings
 */
kvManagementHandler.get('/config', jwtAuth, async (c) => {
  try {
    // Check admin role
    const agent = c.get('agent' as never) as { role?: string } | undefined;
    if (!agent || agent.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, HTTP_STATUS.FORBIDDEN);
    }

    return c.json({
      success: true,
      timestamp: nowISO(),
      config: {
        ttl: KV_TTL,
        batch: KV_BATCH_CONFIG,
        compression: KV_COMPRESSION_CONFIG,
        migrationMap: KEY_MIGRATION_MAP,
      },
    });
  } catch (error) {
    console.error('[KV Management] Config error:', error);
    return c.json({
      success: false,
      error: 'Failed to get KV configuration',
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== Migration Endpoint ===================

/**
 * POST /api/kv/migrate
 * Migrate keys from old pattern to new pattern
 *
 * Body:
 * - oldPattern: string (required)
 * - newPattern: string (required)
 * - namespace: 'SESSIONS' | 'CACHE' (required)
 * - deleteOld: boolean (default: false)
 */
kvManagementHandler.post('/migrate', jwtAuth, async (c) => {
  try {
    // Check admin role
    const agent = c.get('agent' as never) as { role?: string } | undefined;
    if (!agent || agent.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, HTTP_STATUS.FORBIDDEN);
    }

    const body = await c.req.json();
    const { oldPattern, newPattern, namespace, deleteOld = false } = body;

    if (!oldPattern || !newPattern || !namespace) {
      return c.json({
        success: false,
        error: 'Missing required fields: oldPattern, newPattern, namespace',
      }, HTTP_STATUS.BAD_REQUEST);
    }

    if (namespace !== 'SESSIONS' && namespace !== 'CACHE') {
      return c.json({
        success: false,
        error: 'Invalid namespace. Must be SESSIONS or CACHE',
      }, HTTP_STATUS.BAD_REQUEST);
    }

    const kvService = new KVManagementService(c.env);
    const kv = namespace === 'SESSIONS' ? c.env.SESSIONS : c.env.CACHE;
    const result = await kvService.batchMigrateKeys(kv, oldPattern, newPattern, deleteOld);

    return c.json({
      success: true,
      timestamp: nowISO(),
      migration: {
        oldPattern,
        newPattern,
        namespace,
        deleteOld,
        ...result,
      },
    });
  } catch (error) {
    console.error('[KV Management] Migration error:', error);
    return c.json({
      success: false,
      error: 'Failed to migrate keys',
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

// =================== Key Naming Convention Endpoint ===================

/**
 * GET /api/kv/naming-convention
 * Get the standardized key naming convention documentation
 */
kvManagementHandler.get('/naming-convention', async (c) => {
  return c.json({
    version: '1.0.0',
    description: 'Unified KV Key Naming Convention',
    format: '{namespace}:{entity}:{identifier}[:{sub-key}]',
    namespaces: {
      SESSIONS: {
        description: 'Stateful data (sessions, connections, realtime state)',
        patterns: {
          'session:{sessionId}': {
            description: 'User sessions',
            ttl: '30 days',
            example: 'session:abc123xyz',
          },
          'ws:config': {
            description: 'WebSocket configuration',
            ttl: 'No expiration',
            example: 'ws:config',
          },
          'ws:conn:{connId}': {
            description: 'WebSocket connection tracking',
            ttl: '5 minutes',
            example: 'ws:conn:user-123-1234567890',
          },
          'msg:recall:{messageId}': {
            description: 'Message recall state',
            ttl: '5 minutes',
            example: 'msg:recall:msg-uuid-here',
          },
          'msg:cancel:{messageId}': {
            description: 'Message cancellation state',
            ttl: '5 minutes',
            example: 'msg:cancel:msg-uuid-here',
          },
          'rate:{endpoint}:{identifier}': {
            description: 'Rate limiting counters',
            ttl: '1 minute',
            example: 'rate:api/messages:user-123',
          },
          'cb:stats:{service}': {
            description: 'Circuit breaker statistics',
            ttl: '5 minutes',
            example: 'cb:stats:websocket',
          },
        },
      },
      CACHE: {
        description: 'Cacheable data (can be regenerated from source)',
        patterns: {
          'cache:msg:latest:{convId}': {
            description: 'Latest message per conversation',
            ttl: '24 hours',
            example: 'cache:msg:latest:conv-uuid-here',
          },
          'cache:qr:{teamId}:{qrCodeId}': {
            description: 'QR code image cache',
            ttl: '24 hours',
            example: 'cache:qr:1:latest',
          },
          'cache:agent:status:{agentId}': {
            description: 'Agent status cache',
            ttl: '5 minutes',
            example: 'cache:agent:status:agent-123',
          },
          'cache:agent:skills:{agentId}': {
            description: 'Agent skills cache',
            ttl: '1 hour',
            example: 'cache:agent:skills:agent-123',
          },
          'cache:analytics:{type}:{id}': {
            description: 'Analytics data cache',
            ttl: '1 hour',
            example: 'cache:analytics:daily:2024-01-15',
          },
        },
      },
    },
    deprecatedPatterns: LEGACY_KEY_PATTERNS.map(pattern => ({
      pattern,
      status: 'deprecated',
      action: 'Will be cleaned up',
    })),
  });
});

export { kvManagementHandler };
export default kvManagementHandler;
