/**
 * KV Key Builder & Typed KV Wrapper
 *
 * Provides type-safe key construction with TTL helpers
 * and a generic typed KV wrapper with automatic compression.
 *
 * @module services/kv-key-builder
 */

import {
  KV_TTL,
  getNamespaceForKey,
  validateKVKey,
} from '../config/kv-config';
import { KVCompression } from './kv-compression-service';

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
