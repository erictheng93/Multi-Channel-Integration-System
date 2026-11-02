// Infrastructure health checkers for R2, Durable Objects and Queues.
// Each check performs the cheapest real operation against the binding and reports measured
// latency only. No alarms are armed and no storage is written (see CLAUDE.md DO alarm rules).

import { HealthLevel, type HealthChecker, type HealthCheckResult, type HealthCheckConfig } from '../types/health-check';
import type { HealthProbePayload } from '../types/bindings';
import { nowISO, nowMs } from '@/utils/timestamp';

const SLOW_MS = 1000;

function config(timeoutMs: number): HealthCheckConfig {
  return {
    // on-demand only: never self-scheduled (a periodic Queue send / DO wake would bill continuously)
    enabled: false,
    interval: 300,
    timeout: timeoutMs,
    retries: 1,
    alertThresholds: { warning: SLOW_MS, critical: timeoutMs },
    notifications: {}
  };
}

function failure(label: string, startedAt: number, error: unknown): HealthCheckResult {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return {
    status: 'critical',
    message: `${label} check failed: ${message}`,
    timestamp: nowISO(),
    responseTime: nowMs() - startedAt,
    details: { error: message }
  };
}

function timed(label: string, startedAt: number, detail: Record<string, unknown>): HealthCheckResult {
  const responseTime = nowMs() - startedAt;
  return {
    status: responseTime > SLOW_MS ? 'warning' : 'healthy',
    message: responseTime > SLOW_MS ? `${label} is slow: ${responseTime}ms` : `${label} is responsive`,
    timestamp: nowISO(),
    responseTime,
    details: detail
  };
}

/** R2: a HEAD of a key that normally does not exist (a null result is still a successful round trip). */
export class R2HealthChecker implements HealthChecker {
  name = 'r2';
  level = HealthLevel.INFRASTRUCTURE;
  description = 'R2 object storage reachability';

  constructor(private bucket: R2Bucket | undefined) {}

  async check(): Promise<HealthCheckResult> {
    if (!this.bucket) {
      return { status: 'unknown', message: 'R2 binding not configured', timestamp: nowISO() };
    }
    const startedAt = nowMs();
    try {
      await this.bucket.head('health-check-probe');
      return timed('R2', startedAt, { operation: 'head' });
    } catch (error) {
      return failure('R2', startedAt, error);
    }
  }

  getConfig(): HealthCheckConfig {
    return config(3000);
  }
}

/** Durable Object: one request to MessageBroadcaster's read-only /health route (in-memory counters only). */
export class DurableObjectHealthChecker implements HealthChecker {
  name = 'durable_object';
  level = HealthLevel.INFRASTRUCTURE;
  description = 'Durable Object request round trip (MessageBroadcaster /health)';

  constructor(private namespace: DurableObjectNamespace | undefined) {}

  async check(): Promise<HealthCheckResult> {
    if (!this.namespace) {
      return { status: 'unknown', message: 'Durable Object binding not configured', timestamp: nowISO() };
    }
    const startedAt = nowMs();
    try {
      const stub = this.namespace.get(this.namespace.idFromName('global'));
      const response = await stub.fetch('https://do.internal/health');
      if (!response.ok) {
        return {
          status: 'critical',
          message: `Durable Object responded with HTTP ${response.status}`,
          timestamp: nowISO(),
          responseTime: nowMs() - startedAt,
          details: { httpStatus: response.status }
        };
      }
      return timed('Durable Object', startedAt, { object: 'MessageBroadcaster', route: '/health' });
    } catch (error) {
      return failure('Durable Object', startedAt, error);
    }
  }

  getConfig(): HealthCheckConfig {
    return config(3000);
  }
}

/** Queue: times one enqueue of a health_probe message, which the consumer acks and ignores. */
export class QueueHealthChecker implements HealthChecker {
  name = 'queue';
  level = HealthLevel.INFRASTRUCTURE;
  description = 'Queue enqueue timing (line-message-queue)';

  constructor(private queue: Queue<HealthProbePayload> | undefined) {}

  async check(): Promise<HealthCheckResult> {
    if (!this.queue) {
      return { status: 'unknown', message: 'Queue binding not configured', timestamp: nowISO() };
    }
    const startedAt = nowMs();
    try {
      await this.queue.send({ type: 'health_probe', enqueuedAt: startedAt });
      return timed('Queue enqueue', startedAt, { queue: 'line-message-queue', operation: 'send' });
    } catch (error) {
      return failure('Queue enqueue', startedAt, error);
    }
  }

  getConfig(): HealthCheckConfig {
    return config(3000);
  }
}
