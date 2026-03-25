/**
 * MetricsCollectorDO - In-memory API metrics accumulator
 *
 * Receives per-request metric data points, maintains running counters,
 * and periodically flushes snapshots to KV for dashboard consumption.
 */

import type { DurableObjectState } from '@cloudflare/workers-types';
import type { Bindings } from '../types';

// =================== Types ===================

interface IngestPayload {
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  timestamp: number;
}

interface EndpointMetrics {
  requestCount: number;
  errorCount: number;
  totalResponseTime: number;
  maxResponseTime: number;
  recentResponseTimes: number[]; // Rolling window for p50/p95
  statusCodes: Record<number, number>;
  lastRequestAt: number;
}

interface MetricsSnapshot {
  endpoints: Record<string, EndpointMetrics & { category?: string; description?: string }>;
  global: {
    totalRequests: number;
    totalErrors: number;
    avgResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    startedAt: number;
    lastUpdatedAt: number;
  };
  generatedAt: number;
}

// =================== Endpoint Metadata ===================

const ENDPOINT_METADATA: Record<string, { category: string; description: string }> = {
  'GET:/api/conversations': { category: 'conversations', description: 'List conversations' },
  'GET:/api/conversations/:id': { category: 'conversations', description: 'Get conversation detail' },
  'POST:/api/conversations/:id/messages': { category: 'messaging', description: 'Send message' },
  'GET:/api/conversations/:id/messages': { category: 'messaging', description: 'Get messages' },
  'GET:/api/customers': { category: 'customers', description: 'List customers' },
  'GET:/api/customers/:id': { category: 'customers', description: 'Get customer detail' },
  'POST:/api/auth/login': { category: 'auth', description: 'User login' },
  'POST:/api/auth/logout': { category: 'auth', description: 'User logout' },
  'GET:/api/auth/me': { category: 'auth', description: 'Get current user' },
  'GET:/api/teams': { category: 'teams', description: 'List teams' },
  'GET:/api/tags': { category: 'tags', description: 'List tags' },
  'GET:/api/system/health': { category: 'system', description: 'Health check' },
  'GET:/api/system/status': { category: 'system', description: 'System status' },
  'GET:/api/system/api-status': { category: 'system', description: 'API status dashboard' },
  'POST:/api/webhooks/line': { category: 'webhooks', description: 'LINE webhook' },
  'POST:/api/webhooks/facebook': { category: 'webhooks', description: 'Facebook webhook' },
  'GET:/api/agents': { category: 'agents', description: 'List agents' },
  'GET:/api/reports/:type': { category: 'reports', description: 'Get report data' },
};

// Max recent response times to keep per endpoint (for percentile calculations)
const MAX_RECENT_RESPONSE_TIMES = 200;

// How often to flush to KV (ms)
const FLUSH_INTERVAL_MS = 60_000;

// Persist to DO storage every N ingests for crash recovery
const PERSIST_EVERY_N_INGESTS = 10;

/**
 * MetricsCollectorDO - Aggregates API request metrics in memory
 */
export class MetricsCollectorDO {
  private state: DurableObjectState;
  private env: Bindings;
  private metrics: Map<string, EndpointMetrics> = new Map();
  private startedAt: number = Date.now();
  private ingestCountSinceLastPersist: number = 0;

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state;
    this.env = env;

    this.state.blockConcurrencyWhile(async () => {
      await this.loadFromStorage();
      await this.ensureAlarm();
    });
  }

  // =================== Storage ===================

  private async loadFromStorage(): Promise<void> {
    try {
      const stored = await this.state.storage.get<{
        metrics: Array<[string, EndpointMetrics]>;
        startedAt: number;
      }>('metricsState');

      if (stored) {
        this.metrics = new Map(stored.metrics);
        this.startedAt = stored.startedAt;
        console.log(`[MetricsCollectorDO] Restored ${this.metrics.size} endpoint metrics from storage`);
      }
    } catch (error) {
      console.error('[MetricsCollectorDO] Failed to load from storage:', error);
    }
  }

  private async persistToStorage(): Promise<void> {
    try {
      await this.state.storage.put('metricsState', {
        metrics: Array.from(this.metrics.entries()),
        startedAt: this.startedAt,
      });
    } catch (error) {
      console.error('[MetricsCollectorDO] Failed to persist to storage:', error);
    }
  }

  private async ensureAlarm(): Promise<void> {
    const currentAlarm = await this.state.storage.getAlarm();
    if (!currentAlarm) {
      await this.state.storage.setAlarm(Date.now() + FLUSH_INTERVAL_MS);
    }
  }

  // =================== Path Normalization ===================

  private normalizePath(path: string): string {
    // Remove query strings
    const cleanPath = path.split('?')[0];

    // Replace numeric IDs and UUIDs with :id placeholder
    return cleanPath
      .replace(/\/\d+(?=\/|$)/g, '/:id')
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/:id');
  }

  // =================== Fetch Handler ===================

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      switch (url.pathname) {
        case '/ingest':
          return await this.handleIngest(request);
        case '/metrics':
          return this.handleGetMetrics();
        case '/reset':
          return await this.handleReset();
        case '/health':
          return this.handleHealth();
        default:
          return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
      }
    } catch (error) {
      console.error('[MetricsCollectorDO] Request error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // =================== Route Handlers ===================

  private async handleIngest(request: Request): Promise<Response> {
    const payload = (await request.json()) as IngestPayload;

    const { method, path, statusCode, responseTimeMs, timestamp } = payload;
    if (!method || !path || statusCode === undefined || responseTimeMs === undefined) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const normalizedPath = this.normalizePath(path);
    const key = `${method.toUpperCase()}:${normalizedPath}`;

    let endpoint = this.metrics.get(key);
    if (!endpoint) {
      endpoint = {
        requestCount: 0,
        errorCount: 0,
        totalResponseTime: 0,
        maxResponseTime: 0,
        recentResponseTimes: [],
        statusCodes: {},
        lastRequestAt: 0,
      };
      this.metrics.set(key, endpoint);
    }

    // Update counters
    endpoint.requestCount++;
    endpoint.totalResponseTime += responseTimeMs;
    endpoint.maxResponseTime = Math.max(endpoint.maxResponseTime, responseTimeMs);
    endpoint.lastRequestAt = timestamp || Date.now();

    // Track status codes
    endpoint.statusCodes[statusCode] = (endpoint.statusCodes[statusCode] || 0) + 1;

    // Track errors (5xx only)
    if (statusCode >= 500) {
      endpoint.errorCount++;
    }

    // Rolling window of recent response times
    endpoint.recentResponseTimes.push(responseTimeMs);
    if (endpoint.recentResponseTimes.length > MAX_RECENT_RESPONSE_TIMES) {
      endpoint.recentResponseTimes.shift();
    }

    // Periodic persistence
    this.ingestCountSinceLastPersist++;
    if (this.ingestCountSinceLastPersist >= PERSIST_EVERY_N_INGESTS) {
      this.ingestCountSinceLastPersist = 0;
      await this.persistToStorage();
    }

    return new Response(
      JSON.stringify({ success: true, key, requestCount: endpoint.requestCount }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  private handleGetMetrics(): Response {
    const snapshot = this.buildSnapshot();
    return new Response(JSON.stringify({ success: true, data: snapshot }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleReset(): Promise<Response> {
    this.metrics.clear();
    this.startedAt = Date.now();
    this.ingestCountSinceLastPersist = 0;
    await this.state.storage.deleteAll();
    await this.ensureAlarm();

    return new Response(
      JSON.stringify({ success: true, message: 'Metrics reset' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  private handleHealth(): Response {
    return new Response(
      JSON.stringify({
        success: true,
        status: 'healthy',
        endpointCount: this.metrics.size,
        uptimeMs: Date.now() - this.startedAt,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // =================== Snapshot Building ===================

  private buildSnapshot(): MetricsSnapshot {
    const now = Date.now();
    const allResponseTimes: number[] = [];
    let totalRequests = 0;
    let totalErrors = 0;
    let totalResponseTime = 0;

    const endpoints: MetricsSnapshot['endpoints'] = {};

    for (const [key, metrics] of this.metrics.entries()) {
      const meta = ENDPOINT_METADATA[key];
      endpoints[key] = {
        ...metrics,
        category: meta?.category,
        description: meta?.description,
      };

      totalRequests += metrics.requestCount;
      totalErrors += metrics.errorCount;
      totalResponseTime += metrics.totalResponseTime;
      allResponseTimes.push(...metrics.recentResponseTimes);
    }

    // Calculate global percentiles
    allResponseTimes.sort((a, b) => a - b);
    const p50 = this.percentile(allResponseTimes, 50);
    const p95 = this.percentile(allResponseTimes, 95);

    return {
      endpoints,
      global: {
        totalRequests,
        totalErrors,
        avgResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
        p50ResponseTime: p50,
        p95ResponseTime: p95,
        startedAt: this.startedAt,
        lastUpdatedAt: now,
      },
      generatedAt: now,
    };
  }

  private percentile(sorted: number[], pct: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((pct / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  // =================== Alarm Handler ===================

  async alarm(): Promise<void> {
    try {
      const snapshot = this.buildSnapshot();
      const hourBucket = Math.floor(Date.now() / 3_600_000);
      const kvKey = `metrics:snapshot:${hourBucket}`;

      await this.env.CACHE.put(kvKey, JSON.stringify(snapshot), {
        expirationTtl: 86_400, // 24h TTL
      });

      console.log(
        `[MetricsCollectorDO] Flushed snapshot to KV key=${kvKey}, endpoints=${this.metrics.size}, requests=${snapshot.global.totalRequests}`
      );

      // Also persist to DO storage
      await this.persistToStorage();
    } catch (error) {
      console.error('[MetricsCollectorDO] Alarm flush error:', error);
    }

    // Re-schedule next alarm
    await this.state.storage.setAlarm(Date.now() + FLUSH_INTERVAL_MS);
  }
}
