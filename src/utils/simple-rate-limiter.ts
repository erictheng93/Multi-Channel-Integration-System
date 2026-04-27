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
  clientType: 'user' | 'ip' | 'anonymous';
  clientHash: string;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function hashIdentifier(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getClientIdentifier(c: Context<{ Bindings: Bindings }>): {
  id: string;
  type: 'user' | 'ip' | 'anonymous';
  hash: string;
} {
  const payload =
    (c.get('jwtPayload' as never) as JWTPayload | undefined) ||
    (c.get('user' as never) as JWTPayload | undefined);

  const userId = payload?.userId || (payload as unknown as { id?: string | number } | undefined)?.id;

  if (userId) {
    const value = String(userId);
    return {
      id: `user:${value}`,
      type: 'user',
      hash: hashIdentifier(value),
    };
  }

  const forwardedFor = c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For') ||
    c.req.header('X-Real-IP');

  if (forwardedFor) {
    const value = forwardedFor.split(',')[0]?.trim() || 'unknown';
    return {
      id: `ip:${value}`,
      type: 'ip',
      hash: hashIdentifier(value),
    };
  }

  return {
    id: 'anonymous',
    type: 'anonymous',
    hash: hashIdentifier('anonymous'),
  };
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
  const client = getClientIdentifier(c);
  const key = `${options.namespace}:${client.id}`;

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
    clientType: client.type,
    clientHash: client.hash,
  };
}

export function resetSimpleRateLimitStore(): void {
  rateLimitStore.clear();
}
