import { nowMs } from '@/utils/timestamp'
/**
 * RateLimiterDO - Durable Object for Rate Limiting
 *
 * Uses an in-memory cache backed by durable storage for every counted request.
 *
 * Architecture:
 * - In-memory sliding window counters for fast access
 * - Each counted request writes ONLY its own entry (`rl:<clientId>`) before the
 *   response is returned, so eviction can never roll a client's quota back and no
 *   write ever grows with the number of tracked clients
 * - No alarm: expired entries are dropped on every cold start and whenever the entry
 *   count passes MAX_ENTRIES, so an idle object costs nothing
 * - Per-client rate limiting within a shard
 *
 * DO ID Strategy: `ratelimit:${endpoint}:${ipPrefix}`
 * - Groups similar IPs into the same DO instance
 * - Provides good load distribution while minimizing DO instances
 *
 * @module durable-objects/RateLimiterDO
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
  prevCount: number;
  lastAccess: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface CheckRateLimitRequest {
  action: 'check';
  clientId: string;
  config: RateLimitConfig;
}

interface GetStatsRequest {
  action: 'stats';
}

interface CleanupRequest {
  action: 'cleanup';
}

interface ResetRequest {
  action: 'reset';
  clientId?: string;
}

type RateLimitRequest = CheckRateLimitRequest | GetStatsRequest | CleanupRequest | ResetRequest;

interface RateLimitResponse {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

interface RateLimitStats {
  totalClients: number;
  totalRequests: number;
  blockedRequests: number;
  memoryEntries: number;
  lastPersist: number;
  uptime: number;
}

const ENTRY_PREFIX = 'rl:';
/** Whole-map snapshot written by the previous alarm-based design; migrated once on load. */
const LEGACY_SNAPSHOT_KEY = 'rateLimits';
/** DurableObjectStorage.delete() accepts at most 128 keys per call. */
const STORAGE_BATCH = 128;

export class RateLimiterDO implements DurableObject {
  private state: DurableObjectState;

  // In-memory rate limit state (fast access)
  private rateLimits = new Map<string, RateLimitEntry>();

  // Statistics (informational, in memory only; persisting them would cost a write per request)
  private stats = {
    totalRequests: 0,
    blockedRequests: 0,
    lastPersist: nowMs(),
    startTime: nowMs()
  };

  // Configuration
  private readonly ENTRY_TTL_MS = 600000; // 10 minutes TTL for inactive entries
  private readonly MAX_ENTRIES = 10000; // Maximum entries before forced cleanup


  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;

    // Initialize from storage on first request
    this.state.blockConcurrencyWhile(async () => {
      await this.loadFromStorage();
    });
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Handle HTTP API
      if (request.method === 'POST') {
        const body = await request.json() as RateLimitRequest;
        return await this.handleRequest(body);
      }

      // Handle GET requests for stats
      if (request.method === 'GET' && url.pathname === '/stats') {
        return this.handleStats();
      }

      return new Response('Method not allowed', { status: 405 });
    } catch (error) {
      console.error('[RateLimiterDO] Error handling request:', error);
      return new Response(JSON.stringify({
        error: 'Internal error',
        allowed: true // Fail open
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleRequest(body: RateLimitRequest): Promise<Response> {
    switch (body.action) {
      case 'check': {
        const response = this.handleCheckRateLimit(body);
        // A 429 changes no counter, so only counted (allowed) requests are written.
        if (response.status !== 429) {
          await this.state.storage.put(ENTRY_PREFIX + body.clientId, this.rateLimits.get(body.clientId));
          if (this.rateLimits.size > this.MAX_ENTRIES) {
            await this.removeFromStorage(this.cleanupExpiredEntries());
          }
        }
        return response;
      }
      case 'stats':
        return this.handleStats();
      case 'cleanup':
        return this.handleCleanup();
      case 'reset':
        return this.handleReset(body.clientId);
      default:
        return new Response('Unknown action', { status: 400 });
    }
  }

  /**
   * Check rate limit for a client
   * Uses sliding window algorithm with in-memory state
   */
  private handleCheckRateLimit(request: CheckRateLimitRequest): Response {
    const { clientId, config } = request;
    const { maxRequests, windowMs } = config;
    const now = nowMs();

    this.stats.totalRequests++;

    // Get or create entry for this client
    let entry = this.rateLimits.get(clientId);

    if (!entry) {
      // New client - create entry
      entry = {
        count: 1,
        windowStart: now,
        prevCount: 0,
        lastAccess: now
      };
      this.rateLimits.set(clientId, entry);

      return this.createResponse(true, maxRequests, maxRequests - 1, now + windowMs);
    }

    // Update last access
    entry.lastAccess = now;

    // Check if window has expired
    if (now - entry.windowStart >= windowMs) {
      const windowsPassed = Math.floor((now - entry.windowStart) / windowMs);

      if (windowsPassed === 1) {
        // Just entered new window - carry over current count as previous
        entry.prevCount = entry.count;
        entry.count = 1;
        entry.windowStart = now;
      } else {
        // Multiple windows passed - reset everything
        entry.prevCount = 0;
        entry.count = 1;
        entry.windowStart = now;
      }

      return this.createResponse(true, maxRequests, maxRequests - 1, now + windowMs);
    }

    // Calculate sliding window count
    const windowProgress = (now - entry.windowStart) / windowMs;
    const prevWeight = 1 - windowProgress;
    const slidingCount = Math.floor(entry.prevCount * prevWeight + entry.count);

    // Check if limit exceeded
    if (slidingCount >= maxRequests) {
      this.stats.blockedRequests++;
      const resetTime = entry.windowStart + windowMs;
      const retryAfter = Math.ceil((resetTime - now) / 1000);

      return this.createResponse(false, maxRequests, 0, resetTime, Math.max(1, retryAfter));
    }

    // Increment count
    entry.count++;

    const remaining = Math.max(0, maxRequests - slidingCount - 1);
    return this.createResponse(true, maxRequests, remaining, entry.windowStart + windowMs);
  }

  private createResponse(
    allowed: boolean,
    limit: number,
    remaining: number,
    reset: number,
    retryAfter?: number
  ): Response {
    const response: RateLimitResponse = {
      allowed,
      limit,
      remaining,
      reset,
      ...(retryAfter !== undefined && { retryAfter })
    };

    return new Response(JSON.stringify(response), {
      status: allowed ? 200 : 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
        ...(retryAfter !== undefined && { 'Retry-After': retryAfter.toString() })
      }
    });
  }

  private handleStats(): Response {
    const stats: RateLimitStats = {
      totalClients: this.rateLimits.size,
      totalRequests: this.stats.totalRequests,
      blockedRequests: this.stats.blockedRequests,
      memoryEntries: this.rateLimits.size,
      lastPersist: this.stats.lastPersist,
      uptime: Date.now() - this.stats.startTime
    };

    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleCleanup(): Promise<Response> {
    const before = this.rateLimits.size;
    await this.removeFromStorage(this.cleanupExpiredEntries());
    const after = this.rateLimits.size;

    return new Response(JSON.stringify({
      success: true,
      entriesBefore: before,
      entriesAfter: after,
      entriesRemoved: before - after
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleReset(clientId?: string): Promise<Response> {
    if (clientId) {
      // Reset specific client
      const existed = this.rateLimits.delete(clientId);
      await this.state.storage.delete([ENTRY_PREFIX + clientId]);
      return new Response(JSON.stringify({
        success: true,
        clientId,
        existed
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Reset all
    const count = this.rateLimits.size;
    const ids = [...this.rateLimits.keys()];
    this.rateLimits.clear();
    this.stats.totalRequests = 0;
    this.stats.blockedRequests = 0;
    await this.removeFromStorage(ids);
    // Cancel an alarm that an earlier release may have left pending.
    await this.state.storage.deleteAlarm();

    return new Response(JSON.stringify({
      success: true,
      entriesCleared: count
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // =================== Storage Management ===================

  private async loadFromStorage(): Promise<void> {
    try {
      const stored = await this.state.storage.list<RateLimitEntry>({ prefix: ENTRY_PREFIX });
      for (const [key, entry] of stored) {
        this.rateLimits.set(key.slice(ENTRY_PREFIX.length), entry);
      }

      // One-time migration of the previous whole-map snapshot.
      const legacy = await this.state.storage.get<Iterable<[string, RateLimitEntry]>>(LEGACY_SNAPSHOT_KEY);
      if (legacy) {
        const migrated: Array<[string, RateLimitEntry]> = [];
        for (const [clientId, entry] of legacy) {
          if (!this.rateLimits.has(clientId)) {
            this.rateLimits.set(clientId, entry);
            migrated.push([clientId, entry]);
          }
        }
        for (let i = 0; i < migrated.length; i += STORAGE_BATCH) {
          await Promise.all(migrated.slice(i, i + STORAGE_BATCH)
            .map(([clientId, entry]) => this.state.storage.put(ENTRY_PREFIX + clientId, entry)));
        }
        await this.state.storage.delete([LEGACY_SNAPSHOT_KEY]);
      }

      // Cold start is a cleanup point for entries that expired while the object was evicted.
      await this.removeFromStorage(this.cleanupExpiredEntries());
      console.log(`[RateLimiterDO] Loaded ${this.rateLimits.size} entries from storage`);
    } catch (error) {
      console.error('[RateLimiterDO] Error loading from storage:', error);
    }
  }

  private async removeFromStorage(clientIds: string[]): Promise<void> {
    for (let i = 0; i < clientIds.length; i += STORAGE_BATCH) {
      await this.state.storage.delete(clientIds.slice(i, i + STORAGE_BATCH).map((id) => ENTRY_PREFIX + id));
    }
  }

  /** Drops expired and excess entries from memory; returns the ids so storage can follow. */
  private cleanupExpiredEntries(): string[] {
    const now = nowMs();
    const removedIds: string[] = [];

    for (const [clientId, entry] of this.rateLimits.entries()) {
      // Remove entries that haven't been accessed recently
      if (now - entry.lastAccess > this.ENTRY_TTL_MS) {
        this.rateLimits.delete(clientId);
        removedIds.push(clientId);
      }
    }

    if (removedIds.length > 0) {
      console.log(`[RateLimiterDO] Cleaned up ${removedIds.length} expired entries`);
    }

    // Force cleanup if we have too many entries
    if (this.rateLimits.size > this.MAX_ENTRIES) {
      const toRemove = this.rateLimits.size - this.MAX_ENTRIES;
      const entries = Array.from(this.rateLimits.entries())
        .sort((a, b) => a[1].lastAccess - b[1].lastAccess)
        .slice(0, toRemove);

      for (const [clientId] of entries) {
        this.rateLimits.delete(clientId);
        removedIds.push(clientId);
      }

      console.log(`[RateLimiterDO] Force cleaned ${toRemove} oldest entries`);
    }

    return removedIds;
  }

  // This object arms no alarm. An alarm armed by an earlier release may still be pending in
  // storage; it fires once here, does nothing and is not re-armed, so that chain ends.
  async alarm(): Promise<void> {}
}
