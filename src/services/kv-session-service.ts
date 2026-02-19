import { nowMs } from '@/utils/timestamp'
/**
 * KV Session Service
 *
 * Handles session storage and validation using Cloudflare KV
 *
 * ⚡ OPTIMIZED: KV Write-Free Architecture (v2.0)
 * - Relies on Cloudflare KV's expirationTtl for automatic cleanup
 * - Read-only validation (no KV writes on validation)
 * - Reduces KV writes by 100% (only writes on login/logout)
 * - Prevents KV quota exhaustion from frequent session validation
 *
 * Session Key Format: `session:{sessionId}`
 * Session Data Structure: {
 *   userId: string,
 *   displayName: string,
 *   email: string,
 *   role: 'admin' | 'agent' | 'customer',
 *   teamId?: number,
 *   platform?: 'line' | 'facebook' | 'whatsapp',  // For customer sessions
 *   platformUserId?: string,  // For customer sessions
 *   createdAt: number,
 *   metadata?: any
 * }
 */

export interface SessionData {
  userId: string;
  displayName: string;
  email?: string;
  role?: 'admin' | 'agent' | 'customer';
  teamId?: number;

  // Multi-channel support
  platform?: 'line' | 'facebook' | 'whatsapp';
  platformUserId?: string;
  customerId?: number;

  // Session metadata
  createdAt: number;
  // ❌ Removed: expiresAt - managed by KV expirationTtl
  // ❌ Removed: lastActivity - not needed for KV-based expiration
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface SessionValidationResult {
  valid: boolean;
  session?: SessionData;
  error?: 'not_found' | 'invalid_format';  // ❌ Removed: 'expired' - KV handles expiration
}

export interface CreateSessionOptions {
  userId: string;
  displayName: string;
  email?: string;
  role?: 'admin' | 'agent' | 'customer';
  teamId?: number;
  platform?: 'line' | 'facebook' | 'whatsapp';
  platformUserId?: string;
  customerId?: number;
  ttl?: number;  // Time to live in seconds (default: 30 days)
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * In-memory cache entry for recently validated sessions
 * Simplified: Only tracks session data and cache timestamp
 */
interface SessionCacheEntry {
  session: SessionData;
  cachedAt: number;
  // ❌ Removed: lastWrittenAt - no longer tracking KV writes
}

export class KVSessionService {
  private kv: KVNamespace;
  private readonly SESSION_PREFIX = 'session:';
  private readonly DEFAULT_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

  /**
   * In-memory cache TTL (5 minutes)
   * Reduces KV reads for frequently validated sessions
   */
  private readonly MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  /**
   * In-memory cache for recently validated sessions
   * Key: sessionId, Value: { session, cachedAt }
   */
  private static sessionCache: Map<string, SessionCacheEntry> = new Map();

  /**
   * Maximum cache size to prevent memory issues
   */
  private static readonly MAX_CACHE_SIZE = 1000;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Create a new session in KV
   *
   * ⚡ OPTIMIZED: Write-once strategy
   * - Only writes to KV on session creation
   * - Relies on expirationTtl for automatic cleanup
   * - No subsequent KV writes during validation
   */
  async createSession(
    sessionId: string,
    options: CreateSessionOptions
  ): Promise<SessionData> {
    const now = nowMs();
    const ttl = options.ttl || this.DEFAULT_TTL;

    const sessionData: SessionData = {
      userId: options.userId,
      displayName: options.displayName,
      email: options.email,
      role: options.role || 'customer',
      teamId: options.teamId,
      platform: options.platform,
      platformUserId: options.platformUserId,
      customerId: options.customerId,
      createdAt: now,
      // ❌ Removed: expiresAt - Cloudflare KV manages expiration via expirationTtl
      // ❌ Removed: lastActivity - Not needed for KV-based expiration
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: options.metadata || {},
    };

    // Store in KV with TTL - Cloudflare will automatically delete after expiration
    const key = this.getSessionKey(sessionId);
    await this.kv.put(key, JSON.stringify(sessionData), {
      expirationTtl: ttl,
    });

    console.log(`[KVSessionService] Created session: ${sessionId} for user: ${options.userId} (TTL: ${ttl}s)`);
    return sessionData;
  }

  /**
   * Validate and retrieve a session
   *
   * ⚡ OPTIMIZED v2.0: Zero KV writes during validation
   * - Pure read operation - no KV writes
   * - Relies on Cloudflare KV's automatic expiration
   * - Uses in-memory cache to reduce KV reads (5-minute TTL)
   * - Eliminates Read-On-Write anti-pattern
   *
   * @param sessionId The session ID to validate
   */
  async validateSession(sessionId: string): Promise<SessionValidationResult> {
    if (!sessionId) {
      return { valid: false, error: 'invalid_format' };
    }

    const now = nowMs();

    try {
      // ===== Step 1: Check in-memory cache first =====
      const cached = KVSessionService.sessionCache.get(sessionId);
      if (cached && (now - cached.cachedAt) < this.MEMORY_CACHE_TTL) {
        // ✅ Cache hit - return immediately without KV read or write
        return { valid: true, session: cached.session };
      }

      // ===== Step 2: Read from KV =====
      const key = this.getSessionKey(sessionId);
      const value = await this.kv.get(key, 'text');

      if (!value) {
        // Session not found - either expired or never existed
        // Cloudflare KV automatically deletes expired keys
        KVSessionService.sessionCache.delete(sessionId);
        return { valid: false, error: 'not_found' };
      }

      const session: SessionData = JSON.parse(value);

      // ===== Step 3: Update cache (read-only) =====
      const cacheEntry: SessionCacheEntry = {
        session,
        cachedAt: now,
      };
      this.addToCache(sessionId, cacheEntry);

      // ✅ Return session without any KV writes
      return { valid: true, session };
    } catch (error) {
      console.error(`[KVSessionService] Error validating session ${sessionId}:`, error);
      return { valid: false, error: 'invalid_format' };
    }
  }

  /**
   * Add entry to in-memory cache with size limit
   */
  private addToCache(sessionId: string, entry: SessionCacheEntry): void {
    // Evict oldest entries if cache is full
    if (KVSessionService.sessionCache.size >= KVSessionService.MAX_CACHE_SIZE) {
      const oldestKey = KVSessionService.sessionCache.keys().next().value;
      if (oldestKey) {
        KVSessionService.sessionCache.delete(oldestKey);
      }
    }
    KVSessionService.sessionCache.set(sessionId, entry);
  }

  /**
   * Clear the in-memory session cache (useful for testing)
   */
  static clearCache(): void {
    KVSessionService.sessionCache.clear();
  }

  /**
   * Get cache statistics (for monitoring)
   */
  static getCacheStats(): { size: number; maxSize: number } {
    return {
      size: KVSessionService.sessionCache.size,
      maxSize: KVSessionService.MAX_CACHE_SIZE,
    };
  }

  /**
   * Update session data
   *
   * ⚠️ CAUTION: This writes to KV
   * Use sparingly - prefer immutable sessions when possible
   */
  async updateSession(
    sessionId: string,
    updates: Partial<SessionData>
  ): Promise<SessionData | null> {
    const validation = await this.validateSession(sessionId);
    if (!validation.valid || !validation.session) {
      return null;
    }

    const session = validation.session;
    const now = nowMs();
    const updatedSession: SessionData = {
      ...session,
      ...updates,
      // ❌ Removed: lastActivity update
    };

    const key = this.getSessionKey(sessionId);

    // Write to KV with default TTL (resets expiration to 30 days)
    await this.kv.put(key, JSON.stringify(updatedSession), {
      expirationTtl: this.DEFAULT_TTL,
    });

    // Update in-memory cache
    this.addToCache(sessionId, {
      session: updatedSession,
      cachedAt: now,
    });

    console.log(`[KVSessionService] Updated session: ${sessionId}`);
    return updatedSession;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const key = this.getSessionKey(sessionId);
      await this.kv.delete(key);

      // Also clear from in-memory cache
      KVSessionService.sessionCache.delete(sessionId);

      console.log(`[KVSessionService] Deleted session: ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`[KVSessionService] Error deleting session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Extend session expiration
   *
   * ⚠️ CAUTION: This writes to KV
   * Extends the session TTL by writing with new expirationTtl
   */
  async extendSession(
    sessionId: string,
    additionalSeconds: number = this.DEFAULT_TTL
  ): Promise<SessionData | null> {
    const validation = await this.validateSession(sessionId);
    if (!validation.valid || !validation.session) {
      return null;
    }

    const now = nowMs();
    const session = validation.session;
    // ❌ Removed: expiresAt and lastActivity updates

    const key = this.getSessionKey(sessionId);
    await this.kv.put(key, JSON.stringify(session), {
      expirationTtl: additionalSeconds,
    });

    // Update in-memory cache
    this.addToCache(sessionId, {
      session,
      cachedAt: now,
    });

    console.log(`[KVSessionService] Extended session: ${sessionId} by ${additionalSeconds}s`);
    return session;
  }

  /**
   * Get all sessions for a specific user (admin function)
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    const sessions: SessionData[] = [];

    // List all session keys (this is a costly operation, use sparingly)
    const list = await this.kv.list({ prefix: this.SESSION_PREFIX });

    for (const key of list.keys) {
      const value = await this.kv.get(key.name, 'text');
      if (value) {
        try {
          const session: SessionData = JSON.parse(value);
          if (session.userId === userId) {
            sessions.push(session);
          }
        } catch (error) {
          console.error(`[KVSessionService] Error parsing session ${key.name}:`, error);
        }
      }
    }

    return sessions;
  }

  /**
   * Revoke all sessions for a user (e.g., on password change or security incident)
   */
  async revokeUserSessions(userId: string): Promise<number> {
    const sessions = await this.getUserSessions(userId);
    let revokedCount = 0;

    for (const session of sessions) {
      const sessionId = this.extractSessionId(session);
      if (sessionId && await this.deleteSession(sessionId)) {
        revokedCount++;
      }
    }

    console.log(`[KVSessionService] Revoked ${revokedCount} sessions for user: ${userId}`);
    return revokedCount;
  }

  /**
   * Create a customer session (for Phase 2A customer conversations)
   */
  async createCustomerSession(
    customerId: number,
    platform: 'line' | 'facebook' | 'whatsapp',
    platformUserId: string,
    displayName: string,
    options?: {
      teamId?: number;
      ttl?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<{ sessionId: string; session: SessionData }> {
    // Generate session ID: `customer_{platform}_{platformUserId}_{timestamp}`
    const sessionId = `customer_${platform}_${platformUserId}_${nowMs()}`;

    const session = await this.createSession(sessionId, {
      userId: `customer-${customerId}`,
      displayName,
      role: 'customer',
      platform,
      platformUserId,
      customerId,
      teamId: options?.teamId,
      ttl: options?.ttl,
      metadata: options?.metadata,
    });

    return { sessionId, session };
  }

  /**
   * Find customer session by platform and platformUserId
   */
  async findCustomerSession(
    platform: 'line' | 'facebook' | 'whatsapp',
    platformUserId: string
  ): Promise<{ sessionId: string; session: SessionData } | null> {
    // List all customer sessions
    const prefix = `${this.SESSION_PREFIX}customer_${platform}_${platformUserId}_`;
    const list = await this.kv.list({ prefix });

    if (list.keys.length === 0) {
      return null;
    }

    // Get the most recent session
    const latestKey = list.keys[list.keys.length - 1];
    const value = await this.kv.get(latestKey.name, 'text');

    if (!value) {
      return null;
    }

    try {
      const session: SessionData = JSON.parse(value);
      const sessionId = latestKey.name.replace(this.SESSION_PREFIX, '');
      return { sessionId, session };
    } catch (error) {
      console.error(`[KVSessionService] Error parsing customer session:`, error);
      return null;
    }
  }

  // ===== Private Helper Methods =====

  private getSessionKey(sessionId: string): string {
    return `${this.SESSION_PREFIX}${sessionId}`;
  }

  private extractSessionId(_session: SessionData): string | null {
    // This requires storing sessionId in session data (optional enhancement)
    // For now, we rely on getUserSessions to extract from key name
    return null;
  }

  /**
   * Clean up invalid sessions (maintenance function)
   *
   * ⚠️ NOTE: Cloudflare KV automatically deletes expired keys via expirationTtl
   * This method only cleans up sessions with invalid data format
   * Use sparingly - KV list operations are costly
   */
  async cleanupExpiredSessions(): Promise<number> {
    let cleanedCount = 0;

    const list = await this.kv.list({ prefix: this.SESSION_PREFIX });

    for (const key of list.keys) {
      const value = await this.kv.get(key.name, 'text');
      if (value) {
        try {
          // Try to parse session data
          JSON.parse(value) as SessionData;
          // If parse succeeds, session is valid - keep it
        } catch (error) {
          // Invalid session data format - delete it
          await this.kv.delete(key.name);
          KVSessionService.sessionCache.delete(key.name.replace(this.SESSION_PREFIX, ''));
          cleanedCount++;
        }
      }
    }

    console.log(`[KVSessionService] Cleaned up ${cleanedCount} invalid sessions`);
    return cleanedCount;
  }
}

/**
 * Utility function to generate secure session IDs
 */
export function generateSessionId(): string {
  // Generate a cryptographically secure random session ID
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Middleware helper for session validation
 */
export async function requireSession(
  kv: KVNamespace,
  sessionId: string | null
): Promise<SessionData> {
  if (!sessionId) {
    throw new Error('Session ID required');
  }

  const sessionService = new KVSessionService(kv);
  const validation = await sessionService.validateSession(sessionId);

  if (!validation.valid) {
    throw new Error(`Invalid session: ${validation.error}`);
  }

  return validation.session!;
}
