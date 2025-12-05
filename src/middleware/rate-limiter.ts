/**
 * Optimized Rate Limiting Middleware
 *
 * Uses a sliding window counter algorithm with KV storage.
 * This is more efficient than storing all timestamps and provides
 * good accuracy with minimal storage overhead.
 *
 * Features:
 * - Sliding window counter (more accurate than fixed window)
 * - Minimal KV storage (only counter + window start)
 * - Non-blocking on errors (graceful degradation)
 * - Configurable per endpoint/user/IP
 * - Unified key naming convention
 *
 * @module middleware/rate-limiter
 */

import type { Context, Next } from 'hono';
import type { Bindings } from '../types/bindings';
import { KVKeyBuilder } from '../services/kv-management-service';

// =================== Types ===================

interface RateLimitData {
  count: number;       // Request count in current window
  windowStart: number; // Window start timestamp (ms)
  prevCount: number;   // Previous window count (for sliding window)
}

interface RateLimitConfig {
  maxRequests: number;      // Max requests per window
  windowMs: number;         // Window size in milliseconds
  keyPrefix?: string;       // Custom key prefix
  identifier?: (c: Context) => string; // Custom identifier function
  skipFailOpen?: boolean;   // If true, allow requests when rate limit check fails
  onLimitReached?: (c: Context, data: RateLimitInfo) => void; // Callback when limit reached
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;      // Timestamp when window resets
  retryAfter: number; // Seconds until retry allowed
}

// =================== Default Configurations ===================

export const RATE_LIMIT_PRESETS = {
  // Standard API endpoints
  standard: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },

  // Authentication endpoints (more restrictive)
  auth: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },

  // Login endpoints (very restrictive to prevent brute force)
  login: {
    maxRequests: 5,
    windowMs: 5 * 60 * 1000, // 5 minutes
  },

  // File upload endpoints
  upload: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
  },

  // WebSocket connections
  websocket: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  },

  // Admin endpoints (more lenient)
  admin: {
    maxRequests: 200,
    windowMs: 60 * 1000, // 1 minute
  },

  // High frequency endpoints (e.g., polling)
  highFrequency: {
    maxRequests: 500,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;

// =================== Utility Functions ===================

/**
 * Get client identifier from request
 * Priority: CF-Connecting-IP > X-Forwarded-For > X-Real-IP > 'unknown'
 */
function getClientIP(c: Context): string {
  return (
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
    c.req.header('X-Real-IP') ||
    'unknown'
  );
}

/**
 * Generate rate limit key
 */
function generateKey(endpoint: string, identifier: string): string {
  return KVKeyBuilder.rateLimit(endpoint, identifier);
}

/**
 * Calculate sliding window request count
 * This provides more accurate rate limiting than fixed windows
 */
function calculateSlidingWindowCount(
  data: RateLimitData,
  now: number,
  windowMs: number
): number {
  const windowProgress = (now - data.windowStart) / windowMs;

  // If we're still in the current window
  if (windowProgress < 1) {
    // Weighted average of previous and current window
    const prevWeight = 1 - windowProgress;
    return Math.floor(data.prevCount * prevWeight + data.count);
  }

  // Window has passed, only count current
  return data.count;
}

// =================== Main Rate Limiter ===================

/**
 * Create rate limit middleware with optimized sliding window algorithm
 *
 * @example
 * // Basic usage
 * app.use('/api/*', createRateLimiter({ maxRequests: 100, windowMs: 60000 }));
 *
 * // With preset
 * app.use('/api/auth/*', createRateLimiter(RATE_LIMIT_PRESETS.auth));
 *
 * // Custom identifier
 * app.use('/api/user/*', createRateLimiter({
 *   ...RATE_LIMIT_PRESETS.standard,
 *   identifier: (c) => c.get('userId') || getClientIP(c),
 * }));
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    maxRequests,
    windowMs,
    keyPrefix = 'api',
    identifier = getClientIP,
    skipFailOpen = true,
    onLimitReached,
  } = config;

  return async (c: Context<{ Bindings: Bindings }>, next: Next): Promise<Response | void> => {
    const now = Date.now();

    try {
      // Generate unique key for this client/endpoint
      const clientId = identifier(c);
      const key = generateKey(keyPrefix, clientId);

      // Get current rate limit data from KV
      const currentData = await c.env.SESSIONS.get(key, 'json') as RateLimitData | null;

      let data: RateLimitData;

      if (!currentData) {
        // First request - initialize new window
        data = {
          count: 1,
          windowStart: now,
          prevCount: 0,
        };
      } else if (now - currentData.windowStart >= windowMs) {
        // Window expired - start new window
        const windowsPassed = Math.floor((now - currentData.windowStart) / windowMs);

        if (windowsPassed === 1) {
          // Just entered new window - carry over current count as previous
          data = {
            count: 1,
            windowStart: now,
            prevCount: currentData.count,
          };
        } else {
          // Multiple windows passed - reset everything
          data = {
            count: 1,
            windowStart: now,
            prevCount: 0,
          };
        }
      } else {
        // Same window - increment count
        data = {
          ...currentData,
          count: currentData.count + 1,
        };
      }

      // Calculate sliding window count
      const slidingCount = calculateSlidingWindowCount(data, now, windowMs);

      // Check if limit exceeded
      if (slidingCount > maxRequests) {
        const resetTime = data.windowStart + windowMs;
        const retryAfter = Math.ceil((resetTime - now) / 1000);

        const rateLimitInfo: RateLimitInfo = {
          limit: maxRequests,
          remaining: 0,
          reset: resetTime,
          retryAfter: Math.max(1, retryAfter),
        };

        // Set rate limit headers
        c.header('X-RateLimit-Limit', maxRequests.toString());
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', resetTime.toString());
        c.header('Retry-After', rateLimitInfo.retryAfter.toString());

        // Call optional callback
        if (onLimitReached) {
          onLimitReached(c, rateLimitInfo);
        }

        console.warn(`[RateLimiter] Rate limit exceeded for ${clientId} on ${keyPrefix}`, {
          count: slidingCount,
          limit: maxRequests,
          key,
        });

        return c.json({
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${rateLimitInfo.retryAfter} seconds.`,
          limit: maxRequests,
          window: `${windowMs / 1000}s`,
          retryAfter: rateLimitInfo.retryAfter,
        }, 429);
      }

      // Update KV with new count
      await c.env.SESSIONS.put(key, JSON.stringify(data), {
        expirationTtl: Math.ceil((windowMs * 2) / 1000), // Keep for 2 windows for sliding calculation
      });

      // Set rate limit headers on successful request
      const remaining = Math.max(0, maxRequests - slidingCount);
      c.header('X-RateLimit-Limit', maxRequests.toString());
      c.header('X-RateLimit-Remaining', remaining.toString());
      c.header('X-RateLimit-Reset', (data.windowStart + windowMs).toString());

      await next();
    } catch (error) {
      console.error('[RateLimiter] Error checking rate limit:', error);

      if (skipFailOpen) {
        // Fail open - allow request to proceed
        console.warn('[RateLimiter] Failing open due to error');
        await next();
      } else {
        // Fail closed - reject request
        return c.json({
          error: 'Rate limit service unavailable',
          message: 'Please try again later.',
        }, 503);
      }
    }
  };
}

// =================== Legacy Compatible Wrapper ===================

/**
 * Legacy-compatible rate limit middleware
 * Drop-in replacement for the old rateLimit function
 *
 * @deprecated Use createRateLimiter instead for better configuration
 */
export function rateLimit(maxRequests: number = 100, windowMs: number = 60 * 1000) {
  return createRateLimiter({
    maxRequests,
    windowMs,
    keyPrefix: 'legacy',
    skipFailOpen: true,
  });
}

// =================== Specialized Rate Limiters ===================

/**
 * Rate limiter for authentication endpoints
 */
export const authRateLimiter = createRateLimiter({
  ...RATE_LIMIT_PRESETS.auth,
  keyPrefix: 'auth',
  onLimitReached: (c, info) => {
    console.warn(`[Security] Auth rate limit reached`, {
      ip: getClientIP(c),
      path: c.req.path,
      retryAfter: info.retryAfter,
    });
  },
});

/**
 * Rate limiter for login endpoints (stricter)
 */
export const loginRateLimiter = createRateLimiter({
  ...RATE_LIMIT_PRESETS.login,
  keyPrefix: 'login',
  onLimitReached: (c, info) => {
    console.warn(`[Security] Login rate limit reached - possible brute force`, {
      ip: getClientIP(c),
      path: c.req.path,
      retryAfter: info.retryAfter,
    });
  },
});

/**
 * Rate limiter for file upload endpoints
 */
export const uploadRateLimiter = createRateLimiter({
  ...RATE_LIMIT_PRESETS.upload,
  keyPrefix: 'upload',
});

/**
 * Rate limiter for WebSocket connections
 */
export const websocketRateLimiter = createRateLimiter({
  ...RATE_LIMIT_PRESETS.websocket,
  keyPrefix: 'websocket',
});

/**
 * Rate limiter for admin endpoints
 */
export const adminRateLimiter = createRateLimiter({
  ...RATE_LIMIT_PRESETS.admin,
  keyPrefix: 'admin',
});

// =================== Export Helper ===================

/**
 * Create a rate limiter with custom endpoint name
 * Useful for protecting specific routes
 */
export function rateLimitEndpoint(
  endpoint: string,
  preset: keyof typeof RATE_LIMIT_PRESETS = 'standard'
) {
  return createRateLimiter({
    ...RATE_LIMIT_PRESETS[preset],
    keyPrefix: endpoint,
  });
}
