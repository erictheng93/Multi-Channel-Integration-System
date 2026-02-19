import { nowMs } from '@/utils/timestamp'
/**
 * RateLimiterDO - Durable Object for Rate Limiting
 *
 * Replaces KV-based rate limiting with in-memory counting and batch persistence.
 * This dramatically reduces KV write operations (from ~100% to ~5% of requests).
 *
 * Architecture:
 * - In-memory sliding window counters for fast access
 * - Periodic batch persistence to DO storage
 * - Automatic cleanup of expired windows
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

export class RateLimiterDO implements DurableObject {
  private state: DurableObjectState;
  private env: any;

  // In-memory rate limit state (fast access)
  private rateLimits = new Map<string, RateLimitEntry>();

  // Statistics
  private stats = {
    totalRequests: 0,
    blockedRequests: 0,
    lastPersist: nowMs(),
    startTime: nowMs()
  };

  // Configuration
  private readonly PERSIST_INTERVAL_MS = 60000; // Persist every 60 seconds
  private readonly CLEANUP_INTERVAL_MS = 300000; // Cleanup every 5 minutes
  private readonly MAX_ENTRIES = 10000; // Maximum entries before forced cleanup
  private readonly ENTRY_TTL_MS = 600000; // 10 minutes TTL for inactive entries

  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;

    // Initialize from storage on first request
    this.state.blockConcurrencyWhile(async () => {
      await this.loadFromStorage();
      this.setupTimers();
    });
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Handle HTTP API
      if (request.method === 'POST') {
        const body = await request.json() as RateLimitRequest;
        return this.handleRequest(body);
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

  private handleRequest(body: RateLimitRequest): Response {
    switch (body.action) {
      case 'check':
        return this.handleCheckRateLimit(body);
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

  private handleCleanup(): Response {
    const before = this.rateLimits.size;
    this.cleanupExpiredEntries();
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

  private handleReset(clientId?: string): Response {
    if (clientId) {
      // Reset specific client
      const existed = this.rateLimits.delete(clientId);
      return new Response(JSON.stringify({
        success: true,
        clientId,
        existed
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Reset all
      const count = this.rateLimits.size;
      this.rateLimits.clear();
      this.stats.totalRequests = 0;
      this.stats.blockedRequests = 0;

      return new Response(JSON.stringify({
        success: true,
        entriesCleared: count
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // =================== Storage Management ===================

  private async loadFromStorage(): Promise<void> {
    try {
      // Load persisted rate limits
      const stored = await this.state.storage.get<Map<string, RateLimitEntry>>('rateLimits');
      if (stored) {
        this.rateLimits = new Map(stored);
        console.log(`[RateLimiterDO] Loaded ${this.rateLimits.size} entries from storage`);
      }

      // Load stats
      const storedStats = await this.state.storage.get<typeof this.stats>('stats');
      if (storedStats) {
        this.stats = { ...this.stats, ...storedStats, startTime: nowMs() };
      }
    } catch (error) {
      console.error('[RateLimiterDO] Error loading from storage:', error);
    }
  }

  private async persistToStorage(): Promise<void> {
    try {
      // Only persist if we have entries
      if (this.rateLimits.size > 0) {
        await this.state.storage.put('rateLimits', this.rateLimits);
      }
      await this.state.storage.put('stats', this.stats);

      this.stats.lastPersist = nowMs();
      console.log(`[RateLimiterDO] Persisted ${this.rateLimits.size} entries to storage`);
    } catch (error) {
      console.error('[RateLimiterDO] Error persisting to storage:', error);
    }
  }

  private cleanupExpiredEntries(): void {
    const now = nowMs();
    let removed = 0;

    for (const [clientId, entry] of this.rateLimits.entries()) {
      // Remove entries that haven't been accessed recently
      if (now - entry.lastAccess > this.ENTRY_TTL_MS) {
        this.rateLimits.delete(clientId);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[RateLimiterDO] Cleaned up ${removed} expired entries`);
    }

    // Force cleanup if we have too many entries
    if (this.rateLimits.size > this.MAX_ENTRIES) {
      const toRemove = this.rateLimits.size - this.MAX_ENTRIES;
      const entries = Array.from(this.rateLimits.entries())
        .sort((a, b) => a[1].lastAccess - b[1].lastAccess)
        .slice(0, toRemove);

      for (const [clientId] of entries) {
        this.rateLimits.delete(clientId);
      }

      console.log(`[RateLimiterDO] Force cleaned ${toRemove} oldest entries`);
    }
  }

  private setupTimers(): void {
    // Periodic persist
    this.persistTimer = setInterval(() => {
      this.persistToStorage();
    }, this.PERSIST_INTERVAL_MS);

    // Periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.CLEANUP_INTERVAL_MS);
  }

  // Called when the DO is about to be evicted
  async alarm(): Promise<void> {
    // Persist before eviction
    await this.persistToStorage();
  }
}
