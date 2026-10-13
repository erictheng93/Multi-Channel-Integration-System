/**
 * MetricsCollectorDO - API metrics accumulator
 *
 * Receives metric data points (the Worker sends them in batches), maintains running
 * counters and serves them on GET /metrics.
 *
 * Cost model (a single global instance, so every call is billed):
 * - The Worker batches samples, so this object is called per batch, not per request.
 * - A call persists ONE value (all endpoint counters, latency samples left out) before
 *   it answers; a cold start reads that one value back.
 * - No alarm and no KV flush: nothing ever read the hourly KV snapshot, so the
 *   per-minute alarm chain and its KV writes were pure cost.
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

/** Upper bound for one /ingest-batch call (the Worker never sends more than this). */
const MAX_BATCH_SAMPLES = 200;

const MAX_ENDPOINTS = 512;
const ENDPOINT_RETENTION_MS = 86_400_000;
const OVERFLOW_KEY = 'OTHER:/api/:overflow';

const STATE_KEY = 'metricsState';
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE']);

/**
 * MetricsCollectorDO - Aggregates API request metrics in memory
 */
export class MetricsCollectorDO {
  private state: DurableObjectState;
  private metrics: Map<string, EndpointMetrics> = new Map();
  private startedAt: number = Date.now();

  constructor(state: DurableObjectState, _env: Bindings) {
    this.state = state;

    this.state.blockConcurrencyWhile(async () => {
      await this.loadFromStorage();
    });
  }

  // =================== Storage ===================

  // Storage layout: ONE value with every endpoint's counters. The object is called once per
  // batch, so a call costs one small write and a cold start one small read; a key per
  // endpoint would need a list() of every endpoint on each cold start. Latency samples are
  // left out, which keeps the value far below the 128 KiB limit even at the endpoint cap;
  // the percentile windows refill from live traffic after a restart.
  private async loadFromStorage(): Promise<void> {
    try {
      const stored = await this.state.storage.get<{
        metrics: Array<[string, EndpointMetrics]>;
        startedAt: number;
      }>(STATE_KEY);

      if (stored) {
        this.metrics = new Map(stored.metrics.slice(-MAX_ENDPOINTS));
        for (const endpoint of this.metrics.values()) {
          endpoint.lastRequestAt = Math.min(endpoint.lastRequestAt, Date.now());
          endpoint.recentResponseTimes = endpoint.recentResponseTimes.slice(-MAX_RECENT_RESPONSE_TIMES);
          endpoint.statusCodes = Object.fromEntries(Object.entries(endpoint.statusCodes)
            .filter(([status]) => /^\d{3}$/.test(status) && Number(status) >= 100 && Number(status) <= 599));
        }
        this.pruneExpiredEndpoints();
        if (this.metrics.size === MAX_ENDPOINTS && !this.metrics.has(OVERFLOW_KEY)) {
          this.metrics.delete(this.metrics.keys().next().value!);
        }
        this.startedAt = stored.startedAt;
        console.log(`[MetricsCollectorDO] Restored ${this.metrics.size} endpoint metrics from storage`);
        return;
      }

      // An interim release kept one key per endpoint (m:<key>). The counters are
      // approximate, so those leftovers are dropped instead of migrated.
      const leftovers = await this.state.storage.list({ prefix: 'm:', limit: 1 });
      if (leftovers.size > 0) {
        await this.state.storage.deleteAll();
      }
    } catch (error) {
      console.error('[MetricsCollectorDO] Failed to load from storage:', error);
    }
  }

  private async persistToStorage(): Promise<void> {
    await this.state.storage.put(STATE_KEY, {
      metrics: Array.from(this.metrics, ([key, endpoint]) => [key, { ...endpoint, recentResponseTimes: [] }]),
      startedAt: this.startedAt,
    });
  }

  private pruneExpiredEndpoints(): void {
    const cutoff = Date.now() - ENDPOINT_RETENTION_MS;
    for (const [key, endpoint] of this.metrics) {
      if (!Number.isFinite(endpoint.lastRequestAt) || endpoint.lastRequestAt <= cutoff) {
        this.metrics.delete(key);
      }
    }
  }

  // =================== Fetch Handler ===================

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      switch (url.pathname) {
        case '/ingest':
          return await this.handleIngest(request);
        case '/ingest-batch':
          return await this.handleIngestBatch(request);
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

  /** Validates and applies one sample in memory; null when the sample is invalid. */
  private record(
    payload: IngestPayload
  ): { key: string; endpoint: EndpointMetrics } | null {
    const { method, path, statusCode, responseTimeMs } = payload ?? {};
    if (typeof method !== 'string' || !method || method.length > 16 ||
        typeof path !== 'string' || !path.startsWith('/api/') || path.length > 512 ||
        !Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599 ||
        typeof responseTimeMs !== 'number' || !Number.isFinite(responseTimeMs) || responseTimeMs < 0) {
      return null;
    }

    const normalizedMethod = method.toUpperCase();
    let key = `${HTTP_METHODS.has(normalizedMethod) ? normalizedMethod : 'OTHER'}:${path}`;
    if (!this.metrics.has(key)) {
      this.pruneExpiredEndpoints();
      // Reserve one slot for overflow so every accepted request still contributes to totals.
      if (this.metrics.size >= MAX_ENDPOINTS - 1) key = OVERFLOW_KEY;
    }

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
    endpoint.lastRequestAt = Date.now();

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

    return { key, endpoint };
  }

  private json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleIngest(request: Request): Promise<Response> {
    const recorded = this.record((await request.json()) as IngestPayload);
    if (!recorded) {
      return this.json({ success: false, error: 'Invalid metric fields' }, 400);
    }
    // Durable before the answer: eviction must not discard an acknowledged increment.
    await this.persistToStorage();
    return this.json({ success: true, key: recorded.key, requestCount: recorded.endpoint.requestCount });
  }

  /** The Worker sends samples in batches so this object is billed per batch, not per request. */
  private async handleIngestBatch(request: Request): Promise<Response> {
    const body = (await request.json()) as { samples?: IngestPayload[] };
    const samples = Array.isArray(body?.samples) ? body.samples.slice(0, MAX_BATCH_SAMPLES) : null;
    if (!samples) {
      return this.json({ success: false, error: 'samples must be an array' }, 400);
    }

    let accepted = 0;
    for (const sample of samples) {
      if (this.record(sample)) accepted++;
    }
    if (accepted > 0) {
      await this.persistToStorage(); // one write for the whole batch
    }
    return this.json({ success: true, accepted, rejected: samples.length - accepted });
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
    await this.state.storage.deleteAll();
    await this.state.storage.deleteAlarm();

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
    this.pruneExpiredEndpoints();
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

  // This object arms no alarm. An alarm armed by an earlier release may still be pending in
  // storage; it fires once here, does nothing and is not re-armed, so that chain ends.
  async alarm(): Promise<void> {}
}
