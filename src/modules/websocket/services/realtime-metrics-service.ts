// Realtime metrics: MessageBroadcaster reads, the */5 snapshot writer and the history query.
// No alarms, no timers: the only periodic work is the existing */5 cron calling recordWsMetricsSnapshot().

import { asc, gte, lt } from 'drizzle-orm';
import type { Bindings } from '@/types';
import type { Database } from '@/db/drizzle-factory';
import { createDbClient } from '@/db/drizzle-factory';
import { wsMetricsSnapshots, type WsMetricsSnapshot } from '@/db/schema';
import { createContextLogger } from '@/utils/logger';
import { nowMs } from '@/utils/timestamp';

const log = createContextLogger('RealtimeMetrics');

export const WS_METRICS_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const WS_METRICS_MAX_POINTS = 300;

export const WS_METRICS_RANGES = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': WS_METRICS_RETENTION_MS
} as const;
export type WsMetricsRange = keyof typeof WS_METRICS_RANGES;

export function isWsMetricsRange(value: string): value is WsMetricsRange {
  return Object.prototype.hasOwnProperty.call(WS_METRICS_RANGES, value);
}

/** Shape of MessageBroadcaster GET /metrics. Rates and errorRate are null when there was no reference window. */
export interface BroadcasterMetrics {
  totalEvents: number;
  eventsIn: number;
  eventsOut: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  windowSeconds: number;
  eventsInPerSecond: number | null;
  eventsOutPerSecond: number | null;
  errorRate: number | null;
  errorRateLifetime: number;
  averageLatency: number;
  queueDepth: number;
  /** Registered connections: user registry plus conversation rooms. */
  registeredConnections: number;
  /** Alias of registeredConnections kept for older consumers. */
  activeConnections: number;
  /** Distinct users in the registry. */
  onlineAgents: number;
  conversationRooms: number;
  userConnections: number;
  timestamp: number;
}

export async function fetchBroadcasterMetrics(env: Pick<Bindings, 'MESSAGE_BROADCASTER'>): Promise<BroadcasterMetrics | null> {
  if (!env.MESSAGE_BROADCASTER) return null;
  const stub = env.MESSAGE_BROADCASTER.get(env.MESSAGE_BROADCASTER.idFromName('global'));
  const response = await stub.fetch(new Request('https://message-broadcaster/metrics'));
  if (!response.ok) return null;
  return await response.json() as BroadcasterMetrics;
}

export async function fetchOnlineUserIds(env: Pick<Bindings, 'MESSAGE_BROADCASTER'>): Promise<string[] | null> {
  if (!env.MESSAGE_BROADCASTER) return null;
  const stub = env.MESSAGE_BROADCASTER.get(env.MESSAGE_BROADCASTER.idFromName('global'));
  const response = await stub.fetch(new Request('https://message-broadcaster/online-users'));
  if (!response.ok) return null;
  const body = await response.json() as { userIds?: unknown };
  return Array.isArray(body.userIds) ? body.userIds.map(String) : null;
}

/**
 * Cron entry point. One broadcaster request per run, one insert, one prune.
 * Never throws: a broadcaster that is unavailable records nothing (no zero rows that would
 * read as "everybody went offline"), but the prune still runs so the table stays bounded.
 */
export async function recordWsMetricsSnapshot(
  env: Pick<Bindings, 'MESSAGE_BROADCASTER' | 'DB'>,
  now: number = nowMs()
): Promise<boolean> {
  let db: Database;
  try {
    db = createDbClient(env.DB);
  } catch (error) {
    log.error('ws metrics snapshot: database unavailable', {}, error instanceof Error ? error : new Error(String(error)));
    return false;
  }

  let recorded = false;
  try {
    const metrics = await fetchBroadcasterMetrics(env);
    if (metrics) {
      await db.insert(wsMetricsSnapshots).values({
        ts: now,
        activeConnections: metrics.registeredConnections ?? metrics.activeConnections ?? 0,
        onlineAgents: metrics.onlineAgents ?? 0,
        eventsInPerS: metrics.eventsInPerSecond ?? null,
        eventsOutPerS: metrics.eventsOutPerSecond ?? null,
        avgProcessingMs: metrics.averageLatency ?? null,
        errorRate: metrics.errorRate ?? null
      });
      recorded = true;
    } else {
      log.warn('ws metrics snapshot skipped: broadcaster unavailable');
    }
  } catch (error) {
    log.warn('ws metrics snapshot failed', { error: error instanceof Error ? error.message : String(error) });
  }

  try {
    await db.delete(wsMetricsSnapshots).where(lt(wsMetricsSnapshots.ts, now - WS_METRICS_RETENTION_MS));
  } catch (error) {
    log.warn('ws metrics prune failed', { error: error instanceof Error ? error.message : String(error) });
  }
  return recorded;
}

export interface WsMetricsPoint {
  ts: number;
  activeConnections: number;
  onlineAgents: number;
  eventsInPerS: number | null;
  eventsOutPerS: number | null;
  avgProcessingMs: number | null;
  errorRate: number | null;
}

function averageOrNull(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

/** Bucket-average rows into at most maxPoints points; rows must be ordered by ts. */
export function downsample(rows: WsMetricsSnapshot[], maxPoints: number = WS_METRICS_MAX_POINTS): WsMetricsPoint[] {
  const toPoint = (group: WsMetricsSnapshot[]): WsMetricsPoint => ({
    ts: group[0].ts,
    activeConnections: Math.round(group.reduce((sum, row) => sum + row.activeConnections, 0) / group.length),
    onlineAgents: Math.round(group.reduce((sum, row) => sum + row.onlineAgents, 0) / group.length),
    eventsInPerS: averageOrNull(group.map(row => row.eventsInPerS)),
    eventsOutPerS: averageOrNull(group.map(row => row.eventsOutPerS)),
    avgProcessingMs: averageOrNull(group.map(row => row.avgProcessingMs)),
    errorRate: averageOrNull(group.map(row => row.errorRate))
  });

  if (rows.length <= maxPoints) return rows.map(row => toPoint([row]));
  const size = Math.ceil(rows.length / maxPoints);
  const points: WsMetricsPoint[] = [];
  for (let i = 0; i < rows.length; i += size) points.push(toPoint(rows.slice(i, i + size)));
  return points;
}

export async function getWsMetricsHistory(
  db: Database,
  range: WsMetricsRange,
  now: number = nowMs()
): Promise<WsMetricsPoint[]> {
  const rows = await db
    .select()
    .from(wsMetricsSnapshots)
    .where(gte(wsMetricsSnapshots.ts, now - WS_METRICS_RANGES[range]))
    .orderBy(asc(wsMetricsSnapshots.ts));
  return downsample(rows);
}
