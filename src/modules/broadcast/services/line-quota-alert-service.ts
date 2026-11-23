import { and, eq, isNull } from 'drizzle-orm';
import type { Bindings } from '@/types';
import type { Database } from '@/db/drizzle-factory';
import { agents } from '@/db/schema';
import { createContextLogger } from '@/utils/logger';
import { createNotificationService } from '@/utils/notification-trigger';
import type { CreateNotificationRequest } from '@modules/notifications';
import type { LineQuotaChannelSnapshot, LineQuotaSource } from './line-quota-monitor-service';

const log = createContextLogger('LineQuotaAlert');

/** Remaining-quota levels in percent, global for every channel. A channel alerts once per level it drops to. */
export const LINE_QUOTA_ALERT_LEVELS = [20, 10] as const;
/** Consecutive failed CRON polls before admins are told the numbers may be stale. */
export const LINE_QUOTA_FAILURE_ALERT_AFTER = 3;

export const LINE_QUOTA_ALERT_STATE_KV_KEY = 'line-quota:alert-state';
const NOTIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ERROR_LENGTH = 120;

export interface ChannelAlertState {
  /** Levels (percent) already announced and still crossed. */
  notifiedLevels: number[];
  /** Failed cron polls in a row; reset by any successful poll. */
  consecutiveFailures: number;
  /** The failure notice for the current failure streak was sent. */
  failureNotified: boolean;
}

export type LineQuotaAlertState = Record<string, ChannelAlertState>;

interface PendingAlert {
  channelKey: string;
  title: string;
  content: string;
  data: Record<string, unknown>;
  /** State to store for the channel once the notification was created. */
  onSent: ChannelAlertState;
}

const EMPTY_CHANNEL_STATE: ChannelAlertState = { notifiedLevels: [], consecutiveFailures: 0, failureNotified: false };
const numberFormat = new Intl.NumberFormat('en-US');

/**
 * Compare the latest poll (decorated items, so reserve/usableRemaining are set) with the stored alert state,
 * notify every active admin about newly crossed levels or a failure streak, and save the state.
 * State for a channel is only marked after its notification was created, so a failed send retries next poll.
 * Runs on the quota cron and manual refreshes; no Durable Object alarm involved.
 */
export async function evaluateLineQuotaAlerts(
  db: Database,
  env: Bindings,
  items: LineQuotaChannelSnapshot[],
  source: LineQuotaSource
): Promise<void> {
  const raw = await env.CACHE.get(LINE_QUOTA_ALERT_STATE_KV_KEY);
  const previous = parseState(raw);
  const next: LineQuotaAlertState = {};
  const pending: PendingAlert[] = [];

  // Channels missing from the snapshot are dropped here (pruned), since `next` is built from `items` only.
  for (const item of items) {
    const prev = previous[item.channelKey] ?? EMPTY_CHANNEL_STATE;
    const evaluated = evaluateChannel(item, prev, source);
    next[item.channelKey] = evaluated.state;
    if (evaluated.alert) {
      pending.push(evaluated.alert);
    }
  }

  if (pending.length > 0) {
    const adminIds = await loadAdminIds(db);
    if (adminIds.length === 0) {
      log.warn('LINE quota alert has no active admin to notify', { pending: pending.length });
    } else {
      const service = createNotificationService(env);
      for (const alert of pending) {
        if (await sendAlert(service, adminIds, alert)) {
          next[alert.channelKey] = alert.onSent;
        }
      }
    }
  }

  const serialized = serializeState(next);
  if (serialized !== serializeState(previous)) {
    await env.CACHE.put(LINE_QUOTA_ALERT_STATE_KV_KEY, serialized);
  }
}

function evaluateChannel(
  item: LineQuotaChannelSnapshot,
  prev: ChannelAlertState,
  source: LineQuotaSource
): { state: ChannelAlertState; alert: PendingAlert | null } {
  if (item.error !== null) {
    // The numbers on a failed item are the previous poll's; never judge thresholds on them.
    if (source !== 'cron') {
      return { state: prev, alert: null };
    }
    const state: ChannelAlertState = { ...prev, consecutiveFailures: prev.consecutiveFailures + 1 };
    if (state.consecutiveFailures >= LINE_QUOTA_FAILURE_ALERT_AFTER && !state.failureNotified) {
      return { state, alert: failureAlert(item, state) };
    }
    return { state, alert: null };
  }

  const base: ChannelAlertState = { notifiedLevels: [], consecutiveFailures: 0, failureNotified: false };
  if (!item.limited || !item.limit || item.remaining === null) {
    return { state: base, alert: null };
  }

  const ratio = item.remaining / item.limit;
  const crossed: number[] = LINE_QUOTA_ALERT_LEVELS.filter((level) => ratio <= level / 100);
  // ponytail: no month key. Forgetting every level the channel is back above (monthly reset, plan upgrade)
  // re-arms it; inside a month remaining only falls, so a level never flaps between notified and not.
  const kept = prev.notifiedLevels.filter((level) => crossed.includes(level));
  const newly = crossed.filter((level) => !kept.includes(level));
  const state: ChannelAlertState = { ...base, notifiedLevels: kept };
  if (newly.length === 0) {
    return { state, alert: null };
  }
  // One notice for the most severe new level: 25% -> 8% sends the 10% notice only.
  const level = Math.min(...newly);
  return { state, alert: thresholdAlert(item, level, { ...state, notifiedLevels: crossed }) };
}

function thresholdAlert(item: LineQuotaChannelSnapshot, level: number, onSent: ChannelAlertState): PendingAlert {
  const limit = item.limit ?? 0;
  const remaining = item.remaining ?? 0;
  const used = item.used ?? limit - remaining;
  const pct = limit > 0 ? Math.round((remaining / limit) * 1000) / 10 : 0;
  let content = `「${item.label}」本月已用 ${fmt(used)} / ${fmt(limit)} 則，剩餘 ${fmt(remaining)} 則（${pct}%）。`;
  if (item.usableRemaining === 0 && item.reserve !== null) {
    content += `群發已無可用額度（保留 ${fmt(item.reserve)} 則給客服回覆），客服回覆不受影響。`;
  }
  return {
    channelKey: item.channelKey,
    title: `LINE 額度剩餘不到 ${level}%`,
    content,
    data: { kind: 'line_quota_alert', channelKey: item.channelKey, level },
    onSent,
  };
}

function failureAlert(item: LineQuotaChannelSnapshot, state: ChannelAlertState): PendingAlert {
  const error = sanitizeError(item.error);
  let content = `「${item.label}」已連續 ${state.consecutiveFailures} 次無法查詢額度，用量數字可能已過期。請檢查此頻道的 Access Token。`;
  if (error) {
    content += `（錯誤：${error}）`;
  }
  return {
    channelKey: item.channelKey,
    title: 'LINE 額度查詢連續失敗',
    content,
    data: { kind: 'line_quota_query_failed', channelKey: item.channelKey },
    onSent: { ...state, failureNotified: true },
  };
}

async function sendAlert(
  service: ReturnType<typeof createNotificationService>,
  adminIds: string[],
  alert: PendingAlert
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + NOTIFICATION_TTL_MS);
  const notifications: CreateNotificationRequest[] = adminIds.map((userId) => ({
    userId,
    type: 'system',
    title: alert.title,
    content: alert.content,
    data: alert.data,
    priority: 'high',
    expiresAt,
  }));
  try {
    const result = await service.createBulk({ notifications });
    if (result.successful.length === 0) {
      log.error('LINE quota alert was not created; it will retry on the next poll', {
        channelKey: alert.channelKey,
        kind: alert.data.kind,
        failed: result.failed.length,
      });
      return false;
    }
    if (result.failed.length > 0) {
      // Marked as sent anyway: retrying would duplicate the notice for the admins who already have it.
      log.warn('LINE quota alert reached only some admins', {
        channelKey: alert.channelKey,
        successful: result.successful.length,
        failed: result.failed.length,
      });
    }
    log.info('LINE quota alert sent', { channelKey: alert.channelKey, kind: alert.data.kind, admins: result.successful.length });
    return true;
  } catch (error) {
    log.error(
      'LINE quota alert send failed; it will retry on the next poll',
      { channelKey: alert.channelKey },
      error instanceof Error ? error : new Error(String(error))
    );
    return false;
  }
}

async function loadAdminIds(db: Database): Promise<string[]> {
  const rows = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.role, 'admin'), eq(agents.isActive, true), isNull(agents.deletedAt)));
  return rows.map((row) => row.id);
}

function parseState(raw: string | null): LineQuotaAlertState {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const state: LineQuotaAlertState = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      state[key] = normalizeEntry(value);
    }
    return state;
  } catch {
    return {};
  }
}

function normalizeEntry(value: unknown): ChannelAlertState {
  if (typeof value !== 'object' || value === null) {
    return { ...EMPTY_CHANNEL_STATE };
  }
  const entry = value as Partial<Record<keyof ChannelAlertState, unknown>>;
  const levels = Array.isArray(entry.notifiedLevels)
    ? entry.notifiedLevels.filter((level): level is number => typeof level === 'number')
    : [];
  return {
    notifiedLevels: levels,
    consecutiveFailures: typeof entry.consecutiveFailures === 'number' ? entry.consecutiveFailures : 0,
    failureNotified: entry.failureNotified === true,
  };
}

/** Stable JSON (sorted channel keys and levels, fixed field order) so "changed?" is a string compare. */
function serializeState(state: LineQuotaAlertState): string {
  const ordered: LineQuotaAlertState = {};
  for (const key of Object.keys(state).sort()) {
    const entry = state[key];
    ordered[key] = {
      notifiedLevels: [...entry.notifiedLevels].sort((a, b) => a - b),
      consecutiveFailures: entry.consecutiveFailures,
      failureNotified: entry.failureNotified,
    };
  }
  return JSON.stringify(ordered);
}

/** Short, single-line error for the notice. Long opaque runs (anything token-like) are masked. */
function sanitizeError(error: string | null): string {
  if (!error) {
    return '';
  }
  const cleaned = error
    .replace(/[A-Za-z0-9+/=_-]{32,}/g, '***')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > MAX_ERROR_LENGTH ? `${cleaned.slice(0, MAX_ERROR_LENGTH)}...` : cleaned;
}

function fmt(value: number): string {
  return numberFormat.format(value);
}
