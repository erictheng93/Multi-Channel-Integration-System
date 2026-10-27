/**
 * Rate Limiting Middleware (DO-Based Implementation)
 *
 * Uses Durable Objects for rate limiting instead of KV:
 * - 95%+ reduction in KV write operations
 * - In-memory sliding window counters for fast access
 * - Periodic batch persistence to DO storage
 * - Automatic cleanup of expired windows
 *
 * @module middleware/rate-limiter
 */

import type { Context, Next } from 'hono';
import type { Bindings } from '../types/bindings';

// =================== Types ===================

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
  identifier?: (c: Context) => string | Promise<string>;
  skipFailOpen?: boolean;
  onLimitReached?: (c: Context, data: RateLimitInfo) => void;
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
}

interface DOResponse {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// =================== Default Configurations ===================

export const RATE_LIMIT_PRESETS = {
  standard: {
    maxRequests: 100,
    windowMs: 60 * 1000,
  },
  auth: {
    maxRequests: 10,
    windowMs: 60 * 1000,
  },
  login: {
    maxRequests: 15,
    windowMs: 5 * 60 * 1000,
  },
  // Per-account ceiling across all IPs (distributed brute-force bound).
  // ponytail: one IP can feed at most 45 per 15 min through the tight bucket, so a 3-IP attacker
  // can still trip this and lock the account for 15 min; raise it, or add a known-device bypass, if that bites.
  loginAccount: {
    maxRequests: 100,
    windowMs: 15 * 60 * 1000,
  },
  upload: {
    maxRequests: 20,
    windowMs: 60 * 1000,
  },
  websocket: {
    maxRequests: 30,
    windowMs: 60 * 1000,
  },
  admin: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  highFrequency: {
    maxRequests: 500,
    windowMs: 60 * 1000,
  },
} as const;

// =================== Utility Functions ===================

/**
 * Get client IP from request
 */
export function getClientIP(c: Context): string {
  return (
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
    c.req.header('X-Real-IP') ||
    'unknown'
  );
}

/**
 * Read the normalised (trimmed, lowercased) account email from the login body,
 * or null when the body has no usable email / is not valid JSON.
 *
 * Hono caches the parsed body, so the login handler can still read it afterwards.
 */
async function getLoginEmail(c: Context): Promise<string | null> {
  try {
    const body = await c.req.json<{ email?: unknown }>();
    const rawEmail = body?.email;
    if (typeof rawEmail === 'string') {
      const email = rawEmail.trim().toLowerCase();
      if (email) {
        return email;
      }
    }
  } catch {
    // Malformed / missing body - caller falls back to IP-based limiting.
  }
  return null;
}

/**
 * Tight login bucket: keyed on (account email + client IP).
 *
 * - Keying by IP alone collapses every colleague behind a shared office NAT
 *   into one bucket and locks the whole office out.
 * - Keying by email alone lets ANY anonymous caller who knows a staff email
 *   burn that account's budget from anywhere and lock the real user out
 *   indefinitely (the limiter runs before the password check).
 *
 * Combining both means an attacker's attempts only consume the bucket for
 * (victim email, attacker IP); the victim, coming from a different IP, has a
 * separate bucket. Brute force against one account from one IP stays bounded
 * by the preset. Distributed brute force is bounded by getLoginAccountIdentifier.
 *
 * Falls back to the client IP when the body has no email or is not valid JSON
 * (malformed requests still get a bounded budget).
 */
export async function getLoginIdentifier(c: Context): Promise<string> {
  const email = await getLoginEmail(c);
  if (email) {
    return `account:${email}|ip:${getClientIP(c)}`;
  }
  return getClientIP(c);
}

/**
 * Loose per-account bucket across ALL IPs: a distributed brute-force ceiling.
 * Deliberately much larger than the per-(email+IP) bucket so an attacker
 * cannot cheaply exhaust it, while still capping a botnet guessing passwords.
 */
export async function getLoginAccountIdentifier(c: Context): Promise<string> {
  const email = await getLoginEmail(c);
  if (email) {
    return `account:${email}`;
  }
  return getClientIP(c);
}

/**
 * Extract IP prefix for DO sharding (e.g., "192.168.1.100" -> "192.168.1")
 */
function getIPPrefix(ip: string): string {
  if (ip === 'unknown') return 'unknown';

  // Handle IPv4
  const parts = ip.split('.');
  if (parts.length === 4) {
    return parts.slice(0, 3).join('.');
  }

  // Handle IPv6 - use first 4 segments
  const ipv6Parts = ip.split(':');
  if (ipv6Parts.length > 4) {
    return ipv6Parts.slice(0, 4).join(':');
  }

  return ip;
}

/**
 * Generate DO ID for rate limiting
 */
function generateDOId(endpoint: string, clientId: string): string {
  // Account-scoped keys contain emails (dots are part of the name, not IPv4
  // octet separators) - never truncate them into a shared IP-style prefix.
  if (clientId.startsWith('account:')) {
    return `ratelimit:${endpoint}:${clientId}`;
  }
  const ipPrefix = getIPPrefix(clientId);
  return `ratelimit:${endpoint}:${ipPrefix}`;
}

// =================== Main Rate Limiter (DO-based) ===================

/**
 * Create rate limit middleware using Durable Objects
 *
 * @example
 * app.use('/api/*', createRateLimiter({ maxRequests: 100, windowMs: 60000 }));
 * app.use('/api/auth/*', createRateLimiter(RATE_LIMIT_PRESETS.auth));
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
    try {
      // Check if DO binding is available
      const rateLimiterNamespace = c.env.RATE_LIMITER;
      if (!rateLimiterNamespace) {
        // DO not available - fail open
        console.warn('[RateLimiter] RATE_LIMITER DO binding not available, allowing request');
        await next();
        return;
      }

      // Get client identifier
      const clientId = await identifier(c);

      // Generate DO ID (sharding by endpoint + IP prefix)
      const doId = generateDOId(keyPrefix, clientId);
      const stub = rateLimiterNamespace.get(
        rateLimiterNamespace.idFromName(doId)
      );

      // Call the DO to check rate limit
      const response = await stub.fetch('https://rate-limiter.internal/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check',
          clientId: clientId,
          config: {
            maxRequests,
            windowMs,
          },
        }),
      });

      const result = await response.json() as DOResponse;

      // Set rate limit headers
      c.header('X-RateLimit-Limit', result.limit.toString());
      c.header('X-RateLimit-Remaining', result.remaining.toString());
      c.header('X-RateLimit-Reset', result.reset.toString());

      if (!result.allowed) {
        const retryAfter = result.retryAfter || 1;
        c.header('Retry-After', retryAfter.toString());

        // Call optional callback
        if (onLimitReached) {
          onLimitReached(c, {
            limit: result.limit,
            remaining: 0,
            reset: result.reset,
            retryAfter,
          });
        }

        console.warn(`[RateLimiter] Rate limit exceeded for ${clientId} on ${keyPrefix}`);

        return c.json({
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${retryAfter} seconds.`,
          limit: maxRequests,
          window: `${windowMs / 1000}s`,
          retryAfter,
        }, 429);
      }

      await next();
    } catch (error) {
      console.error('[RateLimiter] Error checking rate limit:', error);

      if (skipFailOpen) {
        console.warn('[RateLimiter] Failing open due to error');
        await next();
      } else {
        return c.json({
          error: 'Rate limit service unavailable',
          message: 'Please try again later.',
        }, 503);
      }
    }
  };
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
  // Keyed on email + IP: a shared office IP does not collapse colleagues into
  // one bucket, and an outsider cannot lock out a real user. See getLoginIdentifier.
  identifier: getLoginIdentifier,
  onLimitReached: (c, info) => {
    console.warn(`[Security] Login rate limit reached - possible brute force`, {
      ip: getClientIP(c),
      path: c.req.path,
      retryAfter: info.retryAfter,
    });
  },
});

/**
 * Loose per-account ceiling across all IPs. Register AFTER loginRateLimiter so
 * a single attacker IP is stopped by its own tight bucket first and cannot burn
 * this shared ceiling faster than ~15 attempts per 5 minutes.
 */
export const loginAccountRateLimiter = createRateLimiter({
  ...RATE_LIMIT_PRESETS.loginAccount,
  keyPrefix: 'login-account',
  identifier: getLoginAccountIdentifier,
  onLimitReached: (c, info) => {
    console.warn(`[Security] Per-account login ceiling reached - possible distributed brute force`, {
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
