// UserConnection Security
// Handles rate limiting, auth token verification, and message size validation

import { nowMs } from '@/utils/timestamp';

/**
 * Manages security concerns for user connections:
 * rate limiting, authentication, and message validation.
 */
export class UserConnectionSecurity {
  // Rate limiting configuration
  private readonly RATE_LIMIT_WINDOW_MS = 1000; // 1 second window
  private readonly RATE_LIMIT_MAX_MESSAGES = 10; // Max 10 messages per second
  readonly RATE_LIMIT_MAX_MESSAGE_SIZE = 10240; // 10KB max message size

  private rateLimitState = new Map<string, { count: number; windowStart: number }>();

  /**
   * SECURITY: Rate limiting to prevent message flooding and DoS attacks
   * Uses a sliding window approach with per-connection tracking
   */
  checkRateLimit(connectionId: string): boolean {
    const now = nowMs();
    const state = this.rateLimitState.get(connectionId);

    if (!state) {
      // First message from this connection
      this.rateLimitState.set(connectionId, { count: 1, windowStart: now });
      return true;
    }

    // Check if we're in the same time window
    if (now - state.windowStart < this.RATE_LIMIT_WINDOW_MS) {
      // Still in the same window
      if (state.count >= this.RATE_LIMIT_MAX_MESSAGES) {
        // Rate limit exceeded
        return false;
      }
      state.count++;
      return true;
    } else {
      // New time window - reset the counter
      this.rateLimitState.set(connectionId, { count: 1, windowStart: now });
      return true;
    }
  }

  /**
   * Clean up rate limit state for disconnected connections
   */
  cleanupRateLimitState(connectionId: string): void {
    this.rateLimitState.delete(connectionId);
  }

  /**
   * Validate message size against configured limit
   */
  isMessageTooLarge(messageJson: string): boolean {
    return messageJson.length > this.RATE_LIMIT_MAX_MESSAGE_SIZE;
  }

  /**
   * Get message size for error reporting
   */
  getMaxMessageSize(): number {
    return this.RATE_LIMIT_MAX_MESSAGE_SIZE;
  }

  /**
   * Verify JWT authentication token
   */
  async verifyAuthToken(token: string, userId: string, env: Record<string, unknown>): Promise<boolean> {
    try {
      const { verifyJWT } = await import('../utils/auth');
      if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required');
      }
      const payload = await verifyJWT(token, env.JWT_SECRET as string);

      // Verify that the token belongs to the expected user
      if (payload.userId !== userId) {
        console.error(`[UserConnectionSecurity] Token userId mismatch: expected ${userId}, got ${payload.userId}`);
        return false;
      }

      console.log(`[UserConnectionSecurity] Token valid for user ${userId}`);
      return true;
    } catch (error) {
      console.error('[UserConnectionSecurity] Token validation failed:', error);
      return false;
    }
  }
}
