// Per-platform channel overview: message counts, last activity and webhook failure health.
// Computed on read and cached in KV so the channels page never re-scans messages on every load.

import type { Bindings } from '@/types';
import { RowsReadMeter } from '@/utils/d1-rows-read';
import { taipeiDateString, taipeiDayStartMs } from '@/utils/taipei-time';
import { readDayCounts, readLastActivity, readWatermark, type DayCount } from '@/modules/dashboard/services/message-rollup-service';
import { nowISO, nowMs } from '@/utils/timestamp';
import { createContextLogger } from '@/utils/logger';
import { WEBHOOK_PROCESSING_PREFIX, WEBHOOK_SIGNATURE_PREFIX } from '@/utils/webhook-alert';

const log = createContextLogger('ChannelOverviewStats');

/** Message stats are an aggregate over all messages: refresh at most every 5 minutes. */
export const CHANNEL_MESSAGE_STATS_TTL_SECONDS = 300;
const MESSAGE_STATS_KEY = 'channels:message-stats:v1';
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PlatformMessageStats {
  customerMessages24h: number;
  agentMessages24h: number;
  customerMessagesTotal: number;
  agentMessagesTotal: number;
  /** Newest customer or agent message (system messages are not channel activity). */
  lastActivityAt: string | null;
}

export interface MessageStatsSnapshot {
  computedAt: string;
  platforms: Record<string, PlatformMessageStats>;
}

/**
 * Webhook health from KV alert records (7-day TTL):
 * - processingFailures24h: webhook events accepted but failed to process or enqueue
 *   (alert:webhook_failure:<platform>:<ms>), not timeouts.
 * - signatureFailureMinutes24h: one-minute windows that saw an invalid signature
 *   (alert:webhook_signature_failure:<platform>:<minute-ms>). Writes are capped at one per
 *   minute so unauthenticated traffic cannot amplify KV writes, so this counts windows, not requests.
 */
export interface PlatformWebhookHealth {
  processingFailures24h: number;
  lastProcessingFailureAt: string | null;
  signatureFailureMinutes24h: number;
  lastSignatureFailureAt: string | null;
}

/**
 * Per-platform counts from the message_daily_stats rollup plus a live delta after its
 * watermark (message-rollup-service.ts): cost grows with days, never with messages.
 * "24h" is rolling: whole Taipei days from the cutoff day on, minus the raw messages
 * of the cutoff day that are older than the cutoff (at most one day of rows).
 */
export async function computeMessageStats(env: Bindings, now: number = nowMs()): Promise<MessageStatsSnapshot> {
  const db = env.DB;
  const meter = new RowsReadMeter('channels.message-stats');
  const cutoffMs = now - DAY_MS;
  const cutoffDayStartMs = taipeiDayStartMs(cutoffMs);
  const senders = ['customer', 'agent'] as const;
  const allTeams = { role: 'admin' as const, allowedTeamIds: [] as number[] };

  const watermark = await readWatermark(db, meter);
  const [totals, recent, lastActivity, olderToday] = await Promise.all([
    readDayCounts(db, allTeams, {
      fromDay: '0000-00-00', toDay: '9999-12-31', senderTypes: senders, nowMs: now, allTime: true, watermark, meter
    }),
    readDayCounts(db, allTeams, {
      fromDay: taipeiDateString(cutoffMs), toDay: taipeiDateString(now), senderTypes: senders, nowMs: now, watermark, meter
    }),
    readLastActivity(db, watermark, now, meter),
    countOlderThanCutoff(db, new Date(cutoffDayStartMs).toISOString(), new Date(cutoffMs).toISOString(), meter)
  ]);

  const platforms: Record<string, PlatformMessageStats> = {};
  const entry = (platform: string): PlatformMessageStats => (platforms[platform] ??= {
    customerMessages24h: 0,
    agentMessages24h: 0,
    customerMessagesTotal: 0,
    agentMessagesTotal: 0,
    lastActivityAt: null
  });

  for (const row of totals) {
    if (row.platform === 'unknown') { continue; }
    const target = entry(row.platform);
    if (row.senderType === 'customer') { target.customerMessagesTotal += row.n; }
    if (row.senderType === 'agent') { target.agentMessagesTotal += row.n; }
  }
  for (const row of recent) {
    if (row.platform === 'unknown') { continue; }
    const target = entry(row.platform);
    if (row.senderType === 'customer') { target.customerMessages24h += row.n; }
    if (row.senderType === 'agent') { target.agentMessages24h += row.n; }
  }
  for (const row of olderToday) {
    if (row.platform === 'unknown') { continue; }
    const target = entry(row.platform);
    if (row.senderType === 'customer') { target.customerMessages24h = Math.max(0, target.customerMessages24h - row.n); }
    if (row.senderType === 'agent') { target.agentMessages24h = Math.max(0, target.agentMessages24h - row.n); }
  }
  for (const [platform, at] of lastActivity) {
    if (platform === 'unknown') { continue; }
    entry(platform).lastActivityAt = at;
  }

  meter.flush();
  return { computedAt: nowISO(), platforms };
}

/** Customer/agent messages inside the cutoff day but older than the cutoff, per platform and sender. */
async function countOlderThanCutoff(
  db: D1Database,
  dayStartIso: string,
  cutoffIso: string,
  meter: RowsReadMeter
): Promise<DayCount[]> {
  const result = await db.prepare(`
    SELECT COALESCE(cu.platform, 'unknown') AS platform, m.sender_type AS senderType, COUNT(*) AS n
    FROM messages m
    INNER JOIN conversations c ON c.id = m.conversation_id
    LEFT JOIN customers cu ON cu.id = c.customer_id
    WHERE m.sender_type IN ('customer', 'agent')
      AND m.created_at >= ? AND m.created_at < ?
      AND m.deleted_at IS NULL
    GROUP BY 1, 2
  `).bind(dayStartIso, cutoffIso).all<{ platform: string; senderType: string; n: number | string }>();
  meter.track(result);
  return (result.results ?? []).map(row => ({
    day: '',
    platform: row.platform,
    senderType: row.senderType,
    n: Number(row.n) || 0
  }));
}

export async function getMessageStats(env: Bindings): Promise<MessageStatsSnapshot | null> {
  try {
    const cached = await env.CACHE?.get(MESSAGE_STATS_KEY);
    if (cached) return JSON.parse(cached) as MessageStatsSnapshot;
  } catch {
    // fall through to a fresh computation
  }

  try {
    const fresh = await computeMessageStats(env);
    try {
      await env.CACHE?.put(MESSAGE_STATS_KEY, JSON.stringify(fresh), { expirationTtl: CHANNEL_MESSAGE_STATS_TTL_SECONDS });
    } catch (error) {
      log.warn('Failed to cache channel message stats', { error: error instanceof Error ? error.message : String(error) });
    }
    return fresh;
  } catch (error) {
    // Stats are decoration on the channel list: never fail the list because of them
    log.error('Channel message stats failed', {}, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

async function summarizeAlertKeys(
  env: Bindings,
  prefix: string,
  now: number
): Promise<{ count: number; last: string | null }> {
  const cutoff = now - DAY_MS;
  let count = 0;
  let latest = 0;
  let cursor: string | undefined;

  // Keys end in an epoch-ms suffix, so the 24 h window is decided from the key alone (no value reads).
  do {
    const page: KVNamespaceListResult<unknown> = await env.CACHE.list({ prefix, ...(cursor ? { cursor } : {}) });
    for (const key of page.keys) {
      const ts = Number(key.name.slice(prefix.length));
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      count++;
      if (ts > latest) latest = ts;
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return { count, last: latest > 0 ? new Date(latest).toISOString() : null };
}

export async function getWebhookHealth(env: Bindings, platform: string, now: number = nowMs()): Promise<PlatformWebhookHealth> {
  const empty: PlatformWebhookHealth = {
    processingFailures24h: 0,
    lastProcessingFailureAt: null,
    signatureFailureMinutes24h: 0,
    lastSignatureFailureAt: null
  };
  try {
    const [processing, signature] = await Promise.all([
      summarizeAlertKeys(env, WEBHOOK_PROCESSING_PREFIX(platform), now),
      summarizeAlertKeys(env, WEBHOOK_SIGNATURE_PREFIX(platform), now)
    ]);
    return {
      processingFailures24h: processing.count,
      lastProcessingFailureAt: processing.last,
      signatureFailureMinutes24h: signature.count,
      lastSignatureFailureAt: signature.last
    };
  } catch (error) {
    log.warn('Webhook health lookup failed', { platform, error: error instanceof Error ? error.message : String(error) });
    return empty;
  }
}

export interface ChannelOverview {
  activity: PlatformMessageStats | null;
  webhookHealth: PlatformWebhookHealth;
}

/** Build the per-platform overview attached to each channel in the list response. */
export async function getChannelOverviews(
  env: Bindings,
  platforms: string[]
): Promise<Record<string, ChannelOverview>> {
  const unique = Array.from(new Set(platforms));
  const [snapshot, health] = await Promise.all([
    getMessageStats(env),
    Promise.all(unique.map(async (p) => [p, await getWebhookHealth(env, p)] as const))
  ]);

  const result: Record<string, ChannelOverview> = {};
  for (const [platform, webhookHealth] of health) {
    result[platform] = {
      // No messages for a platform is a real zero, but a failed stats query must stay unknown (null)
      activity: snapshot
        ? snapshot.platforms[platform] ?? {
            customerMessages24h: 0,
            agentMessages24h: 0,
            customerMessagesTotal: 0,
            agentMessagesTotal: 0,
            lastActivityAt: null
          }
        : null,
      webhookHealth
    };
  }
  return result;
}
