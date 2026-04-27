import type { Context } from 'hono';
import type { Bindings, JWTPayload } from '@/types';

interface RateLimitOptions {
  namespace: string;
  windowMs: number;
  maxRequests: number;
  maxEntries?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  resetTime: number;
  retryAfterSeconds: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function getClientIdentifier(c: Context<{ Bindings: Bindings }>): string {
  const payload =
    (c.get('jwtPayload' as never) as JWTPayload | undefined) ||
    (c.get('user' as never) as JWTPayload | undefined);

  if (payload?.userId) {
    return `user:${payload.userId}`;
  }

  const forwardedFor = c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For') ||
    c.req.header('X-Real-IP');

  if (forwardedFor) {
    return `ip:${forwardedFor.split(',')[0]?.trim() || 'unknown'}`;
  }

  return 'anonymous';
}

function cleanupExpiredEntries(now: number, maxEntries: number): void {
  if (rateLimitStore.size <= maxEntries) {
    return;
  }

  for (const [key, entry] of rateLimitStore) {
    if (entry.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function checkSimpleRateLimit(
  c: Context<{ Bindings: Bindings }>,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const maxEntries = options.maxEntries ?? 5000;
  const clientId = getClientIdentifier(c);
  const key = `${options.namespace}:${clientId}`;

  cleanupExpiredEntries(now, maxEntries);

  let entry = rateLimitStore.get(key);
  if (!entry || entry.resetTime <= now) {
    entry = {
      count: 0,
      resetTime: now + options.windowMs,
    };
  }

  entry.count += 1;
  rateLimitStore.set(key, entry);

  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));

  return {
    allowed: entry.count <= options.maxRequests,
    count: entry.count,
    limit: options.maxRequests,
    resetTime: entry.resetTime,
    retryAfterSeconds,
  };
}

export function resetSimpleRateLimitStore(): void {
  rateLimitStore.clear();
}
