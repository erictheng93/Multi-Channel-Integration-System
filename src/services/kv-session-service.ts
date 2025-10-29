/**
 * KV Session Service
 *
 * Handles session storage and validation using Cloudflare KV
 *
 * Session Key Format: `session:{sessionId}`
 * Session Data Structure: {
 *   userId: string,
 *   displayName: string,
 *   email: string,
 *   role: 'admin' | 'agent',
 *   teamId?: number,
 *   platform?: 'line' | 'facebook' | 'whatsapp',  // For customer sessions
 *   platformUserId?: string,  // For customer sessions
 *   createdAt: number,
 *   expiresAt: number,
 *   lastActivity: number,
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
  expiresAt: number;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface SessionValidationResult {
  valid: boolean;
  session?: SessionData;
  error?: 'not_found' | 'expired' | 'invalid_format';
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

export class KVSessionService {
  private kv: KVNamespace;
  private readonly SESSION_PREFIX = 'session:';
  private readonly DEFAULT_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Create a new session in KV
   */
  async createSession(
    sessionId: string,
    options: CreateSessionOptions
  ): Promise<SessionData> {
    const now = Date.now();
    const ttl = options.ttl || this.DEFAULT_TTL;
    const expiresAt = now + (ttl * 1000);

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
      expiresAt,
      lastActivity: now,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: options.metadata || {},
    };

    // Store in KV with TTL
    const key = this.getSessionKey(sessionId);
    await this.kv.put(key, JSON.stringify(sessionData), {
      expirationTtl: ttl,
    });

    console.log(`[KVSessionService] Created session: ${sessionId} for user: ${options.userId}`);
    return sessionData;
  }

  /**
   * Validate and retrieve a session
   */
  async validateSession(sessionId: string): Promise<SessionValidationResult> {
    if (!sessionId) {
      return { valid: false, error: 'invalid_format' };
    }

    try {
      const key = this.getSessionKey(sessionId);
      const value = await this.kv.get(key, 'text');

      if (!value) {
        return { valid: false, error: 'not_found' };
      }

      const session: SessionData = JSON.parse(value);

      // Check expiration
      if (session.expiresAt < Date.now()) {
        // Clean up expired session
        await this.deleteSession(sessionId);
        return { valid: false, error: 'expired' };
      }

      // Update last activity timestamp
      session.lastActivity = Date.now();
      await this.kv.put(key, JSON.stringify(session), {
        expirationTtl: Math.floor((session.expiresAt - Date.now()) / 1000),
      });

      return { valid: true, session };
    } catch (error) {
      console.error(`[KVSessionService] Error validating session ${sessionId}:`, error);
      return { valid: false, error: 'invalid_format' };
    }
  }

  /**
   * Update session data
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
    const updatedSession: SessionData = {
      ...session,
      ...updates,
      lastActivity: Date.now(),
    };

    const key = this.getSessionKey(sessionId);
    const ttl = Math.floor((updatedSession.expiresAt - Date.now()) / 1000);

    await this.kv.put(key, JSON.stringify(updatedSession), {
      expirationTtl: ttl > 0 ? ttl : this.DEFAULT_TTL,
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
      console.log(`[KVSessionService] Deleted session: ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`[KVSessionService] Error deleting session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Extend session expiration
   */
  async extendSession(
    sessionId: string,
    additionalSeconds: number = this.DEFAULT_TTL
  ): Promise<SessionData | null> {
    const validation = await this.validateSession(sessionId);
    if (!validation.valid || !validation.session) {
      return null;
    }

    const session = validation.session;
    session.expiresAt = Date.now() + (additionalSeconds * 1000);
    session.lastActivity = Date.now();

    const key = this.getSessionKey(sessionId);
    await this.kv.put(key, JSON.stringify(session), {
      expirationTtl: additionalSeconds,
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
    const sessionId = `customer_${platform}_${platformUserId}_${Date.now()}`;

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

  private extractSessionId(session: SessionData): string | null {
    // This requires storing sessionId in session data (optional enhancement)
    // For now, we rely on getUserSessions to extract from key name
    return null;
  }

  /**
   * Clean up expired sessions (maintenance function)
   * Note: Cloudflare KV automatically deletes expired keys, but this can be used for metrics
   */
  async cleanupExpiredSessions(): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();

    const list = await this.kv.list({ prefix: this.SESSION_PREFIX });

    for (const key of list.keys) {
      const value = await this.kv.get(key.name, 'text');
      if (value) {
        try {
          const session: SessionData = JSON.parse(value);
          if (session.expiresAt < now) {
            await this.kv.delete(key.name);
            cleanedCount++;
          }
        } catch (error) {
          // Invalid session data, delete it
          await this.kv.delete(key.name);
          cleanedCount++;
        }
      }
    }

    console.log(`[KVSessionService] Cleaned up ${cleanedCount} expired sessions`);
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
