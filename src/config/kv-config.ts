/**
 * Centralized KV Configuration
 *
 * Single source of truth for all KV-related settings:
 * - TTL (Time-To-Live) constants
 * - Key naming conventions
 * - Batch operation settings
 * - Compression thresholds
 *
 * @module config/kv-config
 */

// =================== TTL Configuration ===================

/**
 * Centralized TTL settings in SECONDS
 *
 * Usage:
 *   import { KV_TTL } from '../config/kv-config';
 *   await kv.put(key, value, { expirationTtl: KV_TTL.SESSION });
 */
export const KV_TTL = {
  // ─────────────────────────────────────────────────────────
  // SESSIONS KV - Stateful Data
  // ─────────────────────────────────────────────────────────

  /** User sessions - 30 days */
  SESSION: 30 * 24 * 60 * 60, // 2,592,000 seconds

  /** WebSocket connections - 5 minutes (auto-cleanup) */
  WEBSOCKET_CONNECTION: 5 * 60, // 300 seconds

  /** SSE connections - 5 minutes (legacy, being phased out) */
  SSE_CONNECTION: 5 * 60, // 300 seconds

  /** Message recall state - 5 minutes */
  MESSAGE_RECALL: 5 * 60, // 300 seconds

  /** Message cancellation state - 5 minutes */
  MESSAGE_CANCEL: 5 * 60, // 300 seconds

  /** Pending messages (offline buffer) - 1 hour */
  MESSAGE_PENDING: 60 * 60, // 3,600 seconds

  /** Offline messages - 7 days */
  OFFLINE_MESSAGE: 7 * 24 * 60 * 60, // 604,800 seconds

  /** Rate limiting window - 2 minutes (2x window for sliding) */
  RATE_LIMIT: 2 * 60, // 120 seconds

  /** Circuit breaker stats - 5 minutes */
  CIRCUIT_BREAKER: 5 * 60, // 300 seconds

  /** Realtime events - 5 minutes */
  REALTIME_EVENT: 5 * 60, // 300 seconds

  // ─────────────────────────────────────────────────────────
  // CACHE KV - Regenerable Data
  // ─────────────────────────────────────────────────────────

  /** Latest message cache - 24 hours */
  CACHE_MESSAGE: 24 * 60 * 60, // 86,400 seconds

  /** QR code image cache - 24 hours */
  CACHE_QR_CODE: 24 * 60 * 60, // 86,400 seconds

  /** Agent status cache - 5 minutes */
  CACHE_AGENT_STATUS: 5 * 60, // 300 seconds

  /** Agent skills cache - 1 hour */
  CACHE_AGENT_SKILLS: 60 * 60, // 3,600 seconds

  /** Analytics cache - 1 hour */
  CACHE_ANALYTICS: 60 * 60, // 3,600 seconds

  /** Report cache - 1 hour */
  CACHE_REPORT: 60 * 60, // 3,600 seconds

  /** Dashboard cache - 1 hour */
  CACHE_DASHBOARD: 60 * 60, // 3,600 seconds

  /** Health check cache - 1 minute */
  CACHE_HEALTH: 60, // 60 seconds

  /** HTTP response cache - 5 minutes */
  CACHE_HTTP: 5 * 60, // 300 seconds

  /** Query result cache - 5 minutes (default) */
  CACHE_QUERY: 5 * 60, // 300 seconds

  /** Paginated result cache - 1 minute */
  CACHE_PAGINATED: 60, // 60 seconds

  // ─────────────────────────────────────────────────────────
  // Special TTLs
  // ─────────────────────────────────────────────────────────

  /** No expiration (credentials, config) */
  PERMANENT: 0, // 0 means no TTL

  /** Short-lived for tests - 1 minute */
  TEST: 60, // 60 seconds

  /** Alert configuration - 1 year */
  ALERT_CONFIG: 365 * 24 * 60 * 60, // 31,536,000 seconds

  /** Report templates - 30 days */
  REPORT_TEMPLATE: 30 * 24 * 60 * 60, // 2,592,000 seconds

  /** Report configuration - 7 days */
  REPORT_CONFIG: 7 * 24 * 60 * 60, // 604,800 seconds

  /** Batch operations tracking - 1 hour */
  BATCH_TRACKING: 60 * 60, // 3,600 seconds

  /** Report generation status - 1 hour */
  GENERATION_STATUS: 60 * 60, // 3,600 seconds
} as const;

// Type for TTL keys
export type KVTTLKey = keyof typeof KV_TTL;

// =================== Batch Operation Configuration ===================

/**
 * Settings for batch KV operations
 */
export const KV_BATCH_CONFIG = {
  /** Maximum keys per batch operation */
  MAX_BATCH_SIZE: 100,

  /** Maximum parallel operations */
  MAX_PARALLEL_OPS: 10,

  /** Timeout for batch operations (ms) */
  BATCH_TIMEOUT: 30000, // 30 seconds

  /** Retry attempts for failed operations */
  RETRY_ATTEMPTS: 3,

  /** Delay between retries (ms) */
  RETRY_DELAY: 1000, // 1 second
} as const;

// =================== Compression Configuration ===================

/**
 * Settings for KV data compression
 */
export const KV_COMPRESSION_CONFIG = {
  /** Minimum size in bytes to trigger compression */
  MIN_SIZE_FOR_COMPRESSION: 1024, // 1 KB

  /** Maximum uncompressed size before forcing compression */
  MAX_UNCOMPRESSED_SIZE: 10 * 1024, // 10 KB

  /** Compression level (1-9, higher = better compression, slower) */
  COMPRESSION_LEVEL: 6,

  /** Key prefixes that should always be compressed */
  ALWAYS_COMPRESS_PREFIXES: [
    'cache:report:',
    'cache:analytics:',
    'cache:dashboard:',
    'offline_msg:',
  ],

  /** Key prefixes that should never be compressed (small/frequent access) */
  NEVER_COMPRESS_PREFIXES: [
    'rate:',
    'cb:stats:',
    'cache:health',
    'ws:conn:',
    'session:', // Sessions need fast access
  ],
} as const;

// =================== Key Pattern Definitions ===================

/**
 * Unified KV Key Patterns
 *
 * Format: {namespace}:{entity}:{identifier}[:{sub-key}]
 */
export const KV_KEY_PATTERNS = {
  // SESSIONS KV patterns (stateful data)
  sessions: {
    session: 'session:',
    wsConfig: 'ws:config',
    wsConn: 'ws:conn:',
    sseConn: 'sse:conn:',
    sseStats: 'sse:stats',
    msgRecall: 'msg:recall:',
    msgCancel: 'msg:cancel:',
    msgPending: 'msg:pending:',
    offlineMsg: 'offline_msg:',
    rateLimit: 'rate:',
    circuitBreakerStats: 'cb:stats:',
    circuitBreakerAlerts: 'cb:alerts:',
    realtimeEvent: 'rt:event:',
  },
  // CACHE KV patterns (regenerable data)
  cache: {
    latestMessage: 'cache:msg:latest:',
    qrCode: 'cache:qr:',
    agentStatus: 'cache:agent:status:',
    agentSkills: 'cache:agent:skills:',
    analytics: 'cache:analytics:',
    report: 'cache:report:',
    dashboard: 'cache:dashboard:',
    health: 'cache:health',
    http: 'cache:http:',
    query: 'cache:query:',
    paginated: 'cache:paginated:',
    credentials: 'credentials:',
    alertConfig: 'alert:config',
    template: 'template:',
    generation: 'generation:',
    batch: 'batch:',
  },
} as const;

// =================== Legacy Key Patterns (for cleanup) ===================

/**
 * Deprecated key patterns that should be migrated or cleaned up
 */
export const LEGACY_KEY_PATTERNS = [
  // Migration-related keys (no longer used)
  'migration_counter:',
  'migration_decision:',
  'team_migration_level:',
  'user_feature_flag:',
  'deployment_plan:',
  'deployment_execution:',
  'emergency_action:',
  'migration_config_backup',
  'feature_flag:',

  // Old naming conventions (to be migrated)
  'websocket_migration_config', // → ws:config
  'latest_msg:',                // → cache:msg:latest:
  'qr:team:',                   // → cache:qr:
  'recallable:',                // → msg:recall:
  'cancelled:',                 // → msg:cancel:
  'sse_connection:',            // → sse:conn:
  'ws_conn:',                   // → ws:conn:
  'pending_msg:',               // → msg:pending:
  'rate_limit:',                // → rate:
  'circuit_breaker_',           // → cb:
  'realtime_event:',            // → rt:event:
] as const;

/**
 * Migration mapping from legacy to new patterns
 */
export const KEY_MIGRATION_MAP: Record<string, string> = {
  'websocket_migration_config': 'ws:config',
  'latest_msg:': 'cache:msg:latest:',
  'qr:team:': 'cache:qr:',
  'recallable:': 'msg:recall:',
  'cancelled:': 'msg:cancel:',
  'sse_connection:': 'sse:conn:',
  'ws_conn:': 'ws:conn:',
  'pending_msg:': 'msg:pending:',
  'rate_limit:': 'rate:',
  'circuit_breaker_': 'cb:',
  'realtime_event:': 'rt:event:',
};

// =================== Namespace Configuration ===================

/**
 * KV namespace routing configuration
 */
export const KV_NAMESPACE_ROUTING = {
  /** Patterns that belong to SESSIONS namespace */
  sessions: [
    'session:',
    'ws:',
    'sse:',
    'msg:',
    'offline_msg:',
    'rate:',
    'cb:',
    'rt:',
  ],
  /** Patterns that belong to CACHE namespace */
  cache: [
    'cache:',
    'credentials:',
    'alert:',
    'template:',
    'generation:',
    'batch:',
  ],
} as const;

/**
 * Determine which namespace a key belongs to
 */
export function getNamespaceForKey(key: string): 'SESSIONS' | 'CACHE' {
  for (const prefix of KV_NAMESPACE_ROUTING.sessions) {
    if (key.startsWith(prefix)) {
      return 'SESSIONS';
    }
  }
  return 'CACHE';
}

// =================== Validation ===================

/**
 * Validate a KV key against naming conventions
 */
export function validateKVKey(key: string): {
  valid: boolean;
  namespace: 'SESSIONS' | 'CACHE';
  isLegacy: boolean;
  suggestion?: string;
} {
  const namespace = getNamespaceForKey(key);
  const isLegacy = LEGACY_KEY_PATTERNS.some(pattern => key.startsWith(pattern));

  // Find migration suggestion for legacy keys
  let suggestion: string | undefined;
  if (isLegacy) {
    for (const [legacy, modern] of Object.entries(KEY_MIGRATION_MAP)) {
      if (key.startsWith(legacy)) {
        suggestion = key.replace(legacy, modern);
        break;
      }
    }
  }

  return {
    valid: !isLegacy,
    namespace,
    isLegacy,
    suggestion,
  };
}

// =================== Export Summary ===================

export default {
  TTL: KV_TTL,
  BATCH: KV_BATCH_CONFIG,
  COMPRESSION: KV_COMPRESSION_CONFIG,
  PATTERNS: KV_KEY_PATTERNS,
  LEGACY: LEGACY_KEY_PATTERNS,
  MIGRATION: KEY_MIGRATION_MAP,
  ROUTING: KV_NAMESPACE_ROUTING,
  getNamespaceForKey,
  validateKVKey,
};
