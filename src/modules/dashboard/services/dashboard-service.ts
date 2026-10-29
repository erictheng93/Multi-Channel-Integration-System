// Dashboard aggregates (Asia/Taipei days, visibility-scoped)
//
// Every day boundary is a UTC instant computed from Taipei midnight and compared
// against RAW columns (created_at / closed_at), so idx_messages_sender_type_created_at
// (migration 0066) can serve the message counts. No column is wrapped in a function
// inside a WHERE clause. Platform / day bucketing happens in SELECT / GROUP BY only.
//
// Customer message counts come from the message_daily_stats rollup plus a live delta
// after its watermark (message-rollup-service.ts), so they do not grow with history.
//
// "Yesterday same time" = [yesterday 00:00 Taipei, now - 24h): the same elapsed
// part of the day, so a morning reading is not compared with a full day.

import { getConversationVisibilitySql, type ConversationVisibilityUser } from '@/services/conversation-visibility';
import type {
  DashboardSummary,
  MessageVolumeData,
  MessageVolumeDay
} from '@shared/api-contracts/dashboard';
import {
  DAY_MS,
  TAIPEI_TIMEZONE,
  isoOf,
  taipeiDateString,
  taipeiDayStartMs
} from '@/utils/taipei-time';
import { RowsReadMeter } from '@/utils/d1-rows-read';
import { countRawMessages, readDayCounts } from './message-rollup-service';
import { getWaitingConversations } from './waiting-service';

interface ComparisonRow {
  today: number | string | null;
  yesterday: number | string | null;
}

interface FirstResponseRow {
  todayCount: number | string | null;
  todayAvg: number | string | null;
  yesterdayCount: number | string | null;
  yesterdayAvg: number | string | null;
}

/** Run a prepared statement through .all() (which carries rows_read meta) and return its first row. */
async function firstRow<T>(meter: RowsReadMeter, statement: D1PreparedStatement): Promise<T | null> {
  const result = meter.track(await statement.all<T>());
  return result.results?.[0] ?? null;
}

const num = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const avgOrNull = (value: unknown, count: number): number | null => {
  if (count === 0 || value === null || value === undefined) { return null; }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

/** Cache scope: everything an admin sees vs the exact team set of an agent. */
export function visibilityScopeKey(user: ConversationVisibilityUser): string {
  if (user.role === 'admin') { return 'all'; }
  const ids = [...new Set((user.allowedTeamIds ?? []).filter(Number.isFinite))].sort((a, b) => a - b);
  return `teams:${ids.join(',') || 'none'}`;
}

export async function buildDashboardSummary(
  db: D1Database,
  user: ConversationVisibilityUser,
  nowMs: number
): Promise<DashboardSummary> {
  const todayStart = taipeiDayStartMs(nowMs);
  const yesterdayStart = todayStart - DAY_MS;
  const yesterdayEnd = nowMs - DAY_MS; // same elapsed time yesterday
  const visibility = getConversationVisibilitySql(user, 'c.assigned_team_id');

  const nowIso = isoOf(nowMs);
  const todayIso = isoOf(todayStart);
  const yStartIso = isoOf(yesterdayStart);
  const yEndIso = isoOf(yesterdayEnd);

  // Customer messages: today = rollup day + live delta. Yesterday-same-time is a partial
  // day, so it is the cheaper of "raw head [00:00, same time)" and "rollup day minus raw
  // tail [same time, midnight)" (never more than half a day of messages either way).
  const meter = new RowsReadMeter('dashboard.summary');
  const todayDay = taipeiDateString(todayStart);
  const yesterdayDay = taipeiDateString(yesterdayStart);
  const dayCounts = await readDayCounts(db, user, {
    fromDay: yesterdayDay,
    toDay: todayDay,
    senderTypes: ['customer'],
    nowMs,
    meter
  });
  const dayTotal = (day: string): number => dayCounts.filter(row => row.day === day).reduce((sum, row) => sum + row.n, 0);
  const todayMessages = dayTotal(todayDay);
  const headMs = yesterdayEnd - yesterdayStart;
  const tailMs = todayStart - yesterdayEnd;
  let yesterdayMessages: number;
  if (headMs <= 0) {
    yesterdayMessages = 0;
  } else if (headMs <= tailMs) {
    yesterdayMessages = await countRawMessages(db, user, 'customer', yStartIso, yEndIso, meter);
  } else {
    const tail = await countRawMessages(db, user, 'customer', yEndIso, todayIso, meter);
    yesterdayMessages = Math.max(0, dayTotal(yesterdayDay) - tail);
  }
  const messageRow = { today: todayMessages, yesterday: yesterdayMessages };

  const resolvedRow = await firstRow<ComparisonRow>(meter, db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN c.closed_at >= ? THEN 1 ELSE 0 END), 0) AS today,
      COALESCE(SUM(CASE WHEN c.closed_at < ? THEN 1 ELSE 0 END), 0) AS yesterday
    FROM conversations c
    WHERE c.status = 'closed'
      AND c.closed_at >= ? AND c.closed_at <= ?
      AND ${visibility.clause}
  `).bind(todayIso, yEndIso, yStartIso, nowIso, ...visibility.params));

  const openRow = await firstRow<{ n: number | string | null }>(meter, db.prepare(`
    SELECT COUNT(*) AS n
    FROM conversations c
    WHERE c.status <> 'closed' AND c.deleted_at IS NULL AND ${visibility.clause}
  `).bind(...visibility.params));

  // First response: conversations CREATED in the window whose first human reply
  // is recorded (conversations.first_response_at). For yesterday only replies
  // that had already happened by the same time count, so the two sides compare
  // like with like.
  const frRow = await firstRow<FirstResponseRow>(meter, db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN c.created_at >= ? THEN 1 ELSE 0 END), 0) AS todayCount,
      AVG(CASE WHEN c.created_at >= ?
          THEN (julianday(c.first_response_at) - julianday(c.created_at)) * 86400.0 END) AS todayAvg,
      COALESCE(SUM(CASE WHEN c.created_at < ? AND c.first_response_at <= ? THEN 1 ELSE 0 END), 0) AS yesterdayCount,
      AVG(CASE WHEN c.created_at < ? AND c.first_response_at <= ?
          THEN (julianday(c.first_response_at) - julianday(c.created_at)) * 86400.0 END) AS yesterdayAvg
    FROM conversations c
    WHERE c.created_at >= ? AND c.created_at <= ?
      AND c.first_response_at IS NOT NULL
      AND c.first_response_at >= c.created_at
      AND ${visibility.clause}
  `).bind(
    todayIso, todayIso, yEndIso, yEndIso, yEndIso, yEndIso,
    yStartIso, nowIso, ...visibility.params
  ));

  const waiting = await getWaitingConversations(db, user, 5, nowMs, meter);
  const oldest = waiting.items[0] ?? null;

  meter.flush({ scope: visibilityScopeKey(user) });

  const todayFrCount = num(frRow?.todayCount);
  const yesterdayFrCount = num(frRow?.yesterdayCount);

  return {
    timezone: TAIPEI_TIMEZONE,
    dayStart: todayIso,
    generatedAt: nowIso,
    customerMessages: { today: messageRow.today, yesterdaySameTime: messageRow.yesterday },
    resolved: { today: num(resolvedRow?.today), yesterdaySameTime: num(resolvedRow?.yesterday) },
    openConversations: num(openRow?.n),
    waiting: {
      count: waiting.total,
      oldestWaitingSince: oldest?.waitingSince ?? null,
      oldestWaitingSeconds: oldest?.waitingSeconds ?? null,
      top: waiting.items
    },
    firstResponse: {
      today: { count: todayFrCount, avgSeconds: avgOrNull(frRow?.todayAvg, todayFrCount) },
      yesterdaySameTime: { count: yesterdayFrCount, avgSeconds: avgOrNull(frRow?.yesterdayAvg, yesterdayFrCount) }
    }
  };
}

function emptyDay(date: string): MessageVolumeDay {
  return { date, line: 0, facebook: 0, other: 0, total: 0 };
}

/**
 * Customer messages per Taipei day x platform for `days` days ending today, plus
 * the `days` days before it. Platform comes from the conversation's customer.
 */
export async function buildMessageVolume(
  db: D1Database,
  user: ConversationVisibilityUser,
  days: 7 | 30 | 90,
  nowMs: number
): Promise<MessageVolumeData> {
  const todayStart = taipeiDayStartMs(nowMs);
  const rangeStart = todayStart - (2 * days - 1) * DAY_MS;
  const meter = new RowsReadMeter(`dashboard.message-volume.${days}`);

  // Rollup days + live delta after the watermark; no scan of message history.
  const counts = await readDayCounts(db, user, {
    fromDay: taipeiDateString(rangeStart),
    toDay: taipeiDateString(todayStart),
    senderTypes: ['customer'],
    nowMs,
    meter
  });
  meter.flush({ scope: visibilityScopeKey(user), days });

  const byDate = new Map<string, MessageVolumeDay>();
  for (let i = 0; i < 2 * days; i++) {
    const date = taipeiDateString(rangeStart + i * DAY_MS);
    byDate.set(date, emptyDay(date));
  }
  for (const row of counts) {
    const bucket = byDate.get(row.day);
    if (!bucket) { continue; }
    const n = row.n;
    if (row.platform === 'line') { bucket.line += n; }
    else if (row.platform === 'facebook') { bucket.facebook += n; }
    else { bucket.other += n; }
    bucket.total += n;
  }

  const ordered = [...byDate.values()];
  const previous = ordered.slice(0, days);
  const current = ordered.slice(days);
  const sum = (list: MessageVolumeDay[]) => list.reduce((acc, day) => acc + day.total, 0);

  return {
    timezone: TAIPEI_TIMEZONE,
    days,
    generatedAt: isoOf(nowMs),
    current,
    previous,
    totals: { current: sum(current), previous: sum(previous) }
  };
}
