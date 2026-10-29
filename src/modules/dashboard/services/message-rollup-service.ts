// Message count rollup (message_daily_stats, migration 0069)
//
// LAYOUT (see the migration for the full semantics)
//   (team_id, sender_type, day, platform) -> count, WITHOUT ROWID.
//   team_id > 0 team at aggregation time, 0 unassigned pool, -1 ALL teams (admin reads).
//   day 'YYYY-MM-DD' in Asia/Taipei, '0000-00-00' = all-time totals (team -1).
//
// WRITE side (scheduled()):
//   aggregateMessageRollup  every */5 cron: folds messages in (watermark, now - 1 min]
//                           into the three row kinds. One D1 batch = one transaction: the
//                           counts, the per-platform last-activity keys and the new
//                           watermark commit together, and the lower bound is read
//                           INSIDE the batch, so a re-run or an overlapping run can
//                           never count a message twice.
//   healRecentMessageRollup nightly cron: recomputes the last 2 Taipei days from the
//                           source so soft deletes, late rows and team reassignments
//                           inside that window converge, and corrects the all-time totals
//                           by the difference.
//
// READ side (dashboard, channel overview):
//   readDayCounts           rollup rows + a live delta query for messages after the
//                           watermark (minutes of data), so numbers are current without
//                           ever scanning history. If the rollup is absent (migration not
//                           applied) the delta simply covers the requested range: the old
//                           behaviour, slower but correct.
//
// SEMANTICS
//   - A message counts once it is not soft-deleted. Recalled messages still count (as before).
//   - Agent scoping = sum of their teams + the pool, matching conversation-visibility.ts.
//     The live delta uses the CURRENT team, so a reassignment can move not-yet-aggregated
//     messages; the nightly heal re-attributes the last 2 days, older days keep the team
//     they had when aggregated (documented trade-off).
//   - Cost: an admin reads one row per (day, platform, sender) in range; an agent one per
//     (team in scope, day, platform, sender). All-time totals are one row per platform/sender.

import { getConversationVisibilitySql, type ConversationVisibilityUser } from '@/services/conversation-visibility';
import { RowsReadMeter } from '@/utils/d1-rows-read';
import { createContextLogger } from '@/utils/logger';
import { DAY_MS, isoOf, taipeiDateString, taipeiDayStartMs } from '@/utils/taipei-time';

const log = createContextLogger('MessageRollup');

export const ROLLUP_WATERMARK_KEY = 'message_daily_stats';
export const LAST_ACTIVITY_KEY_PREFIX = 'last_activity:';
/** Messages younger than this are left for the next run so rows still being committed are not skipped. */
export const ROLLUP_LAG_MS = 60_000;
/** Taipei days (including today) the nightly heal recomputes. */
export const HEAL_DAYS = 2;
/** team_id of the all-teams rows. */
export const ALL_TEAMS = -1;
/** team_id of the unassigned pool. */
export const POOL_TEAM = 0;
/** day key of the all-time total rows. */
export const ALL_TIME_DAY = '0000-00-00';

export type RollupSender = 'customer' | 'agent' | 'system';

export interface DayCount {
  day: string;
  platform: string;
  senderType: string;
  n: number;
}

interface CountRow {
  day: string | null;
  platform: string | null;
  senderType: string | null;
  n: number | string | null;
}

const num = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Rollup-side visibility. Admin = the all-teams rows. Agent = their teams plus the pool.
 * Both are a leading-key predicate on team_id, so only the rows in scope are read.
 */
export function getRollupVisibilitySql(user: ConversationVisibilityUser): { clause: string; params: unknown[] } {
  if (user.role === 'admin') { return { clause: `team_id = ${ALL_TEAMS}`, params: [] }; }
  const teamIds = [...new Set((user.allowedTeamIds ?? []).filter(id => Number.isFinite(id) && id > 0))];
  return {
    clause: 'team_id IN (SELECT value FROM json_each(?))',
    params: [JSON.stringify([POOL_TEAM, ...teamIds])]
  };
}

const placeholders = (n: number): string => Array.from({ length: n }, () => '?').join(', ');

// SELECT body shared by aggregation, heal and the backfill-equivalent reads. `teamExpr` and
// `dayExpr` pick the row kind; the caller supplies the created_at range in WHERE.
const FROM_MESSAGES = `
  FROM messages m
  INNER JOIN conversations c ON c.id = m.conversation_id
  LEFT JOIN customers cu ON cu.id = c.customer_id`;

const TEAM_EXPR = 'COALESCE(c.assigned_team_id, 0)';
const DAY_EXPR = "date(m.created_at, '+8 hours')";
const PLATFORM_EXPR = "COALESCE(cu.platform, 'unknown')";

type RowKind = 'team' | 'all-teams' | 'all-time';

/** INSERT ... SELECT that counts the messages matched by `where` into one row kind. */
function insertCounts(kind: RowKind, where: string, upsert: boolean): string {
  const team = kind === 'team' ? TEAM_EXPR : String(ALL_TEAMS);
  const day = kind === 'all-time' ? `'${ALL_TIME_DAY}'` : DAY_EXPR;
  const groupBy = kind === 'all-time' ? 'm.sender_type, ' + PLATFORM_EXPR
    : kind === 'team' ? `${TEAM_EXPR}, m.sender_type, ${DAY_EXPR}, ${PLATFORM_EXPR}`
      : `m.sender_type, ${DAY_EXPR}, ${PLATFORM_EXPR}`;
  return `
    INSERT INTO message_daily_stats (team_id, sender_type, day, platform, count)
    SELECT ${team}, m.sender_type, ${day}, ${PLATFORM_EXPR}, COUNT(*)
    ${FROM_MESSAGES}
    WHERE ${where} AND m.deleted_at IS NULL
    GROUP BY ${groupBy}
    ${upsert ? 'ON CONFLICT(team_id, sender_type, day, platform) DO UPDATE SET count = count + excluded.count' : ''}
  `;
}

export async function readWatermark(db: D1Database, meter?: RowsReadMeter): Promise<string | null> {
  try {
    const result = await db
      .prepare('SELECT value FROM stats_watermarks WHERE key = ?')
      .bind(ROLLUP_WATERMARK_KEY)
      .all<{ value: string }>();
    meter?.track(result);
    return result.results?.[0]?.value ?? null;
  } catch (error) {
    // Table missing (migration 0069 not applied yet): readers fall back to the live scan.
    log.warn('Rollup watermark unavailable, falling back to live counts', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export interface AggregateResult {
  status: 'aggregated' | 'up-to-date' | 'no-watermark';
  watermark: string | null;
}

/**
 * Fold messages in (watermark, nowMs - lag] into message_daily_stats. Idempotent: the
 * statements run in one transaction and read the watermark inside it.
 */
export async function aggregateMessageRollup(db: D1Database, nowMs: number): Promise<AggregateResult> {
  const current = await readWatermark(db);
  if (current === null) { return { status: 'no-watermark', watermark: null }; }

  const upTo = isoOf(nowMs - ROLLUP_LAG_MS);
  if (upTo <= current) { return { status: 'up-to-date', watermark: current }; }

  const stamp = isoOf(nowMs);
  const range = 'm.created_at > (SELECT value FROM stats_watermarks WHERE key = ?) AND m.created_at <= ?';

  await db.batch([
    db.prepare(insertCounts('team', range, true)).bind(ROLLUP_WATERMARK_KEY, upTo),
    db.prepare(insertCounts('all-teams', range, true)).bind(ROLLUP_WATERMARK_KEY, upTo),
    db.prepare(insertCounts('all-time', range, true)).bind(ROLLUP_WATERMARK_KEY, upTo),
    db.prepare(`
      INSERT INTO stats_watermarks (key, value, updated_at)
      SELECT '${LAST_ACTIVITY_KEY_PREFIX}' || ${PLATFORM_EXPR}, MAX(m.created_at), ?
      ${FROM_MESSAGES}
      WHERE ${range} AND m.deleted_at IS NULL AND m.sender_type IN ('customer', 'agent')
      GROUP BY ${PLATFORM_EXPR}
      ON CONFLICT(key) DO UPDATE SET value = MAX(value, excluded.value), updated_at = excluded.updated_at
    `).bind(stamp, ROLLUP_WATERMARK_KEY, upTo),
    // Advance last; a concurrent run that already moved it further leaves it alone.
    db.prepare('UPDATE stats_watermarks SET value = ?, updated_at = ? WHERE key = ? AND value < ?')
      .bind(upTo, stamp, ROLLUP_WATERMARK_KEY, upTo)
  ]);

  return { status: 'aggregated', watermark: upTo };
}

/**
 * Recompute the last HEAL_DAYS Taipei days (today included) from the source, up to the
 * watermark. Soft deletes, late rows and team reassignments in that window converge, and
 * the all-time totals move by exactly the difference. One transaction, so readers never
 * see the days half-rebuilt.
 */
export async function healRecentMessageRollup(db: D1Database, nowMs: number): Promise<{ fromDay: string; healed: boolean }> {
  const startMs = taipeiDayStartMs(nowMs) - (HEAL_DAYS - 1) * DAY_MS;
  const fromDay = taipeiDateString(startMs);
  if (await readWatermark(db) === null) { return { fromDay, healed: false }; }

  const range = 'm.created_at >= ? AND m.created_at <= (SELECT value FROM stats_watermarks WHERE key = ?)';
  const dayTotals = `
    SELECT sender_type, platform, SUM(count) AS n FROM message_daily_stats
    WHERE team_id = ${ALL_TEAMS} AND day >= ? GROUP BY sender_type, platform`;

  await db.batch([
    // 1. take the healed days out of the all-time totals ...
    db.prepare(`
      UPDATE message_daily_stats
      SET count = count - COALESCE((
        SELECT SUM(d.count) FROM message_daily_stats d
        WHERE d.team_id = ${ALL_TEAMS} AND d.day >= ?
          AND d.sender_type = message_daily_stats.sender_type AND d.platform = message_daily_stats.platform
      ), 0)
      WHERE team_id = ${ALL_TEAMS} AND day = '${ALL_TIME_DAY}'
    `).bind(fromDay),
    // 2. ... rebuild those days from the source ...
    db.prepare('DELETE FROM message_daily_stats WHERE day >= ?').bind(fromDay),
    db.prepare(insertCounts('team', range, false)).bind(isoOf(startMs), ROLLUP_WATERMARK_KEY),
    db.prepare(insertCounts('all-teams', range, false)).bind(isoOf(startMs), ROLLUP_WATERMARK_KEY),
    // 3. ... and add the rebuilt days back to the totals
    db.prepare(`
      INSERT INTO message_daily_stats (team_id, sender_type, day, platform, count)
      SELECT ${ALL_TEAMS}, sender_type, '${ALL_TIME_DAY}', platform, n FROM (${dayTotals})
      WHERE true
      ON CONFLICT(team_id, sender_type, day, platform) DO UPDATE SET count = count + excluded.count
    `).bind(fromDay)
  ]);
  return { fromDay, healed: true };
}

export interface ReadDayCountsOptions {
  /** Inclusive Taipei day bounds, YYYY-MM-DD (ignored when allTime). */
  fromDay: string;
  toDay: string;
  senderTypes: readonly RollupSender[];
  nowMs: number;
  /** true = read the all-time total rows (admin only); day is returned as ''. */
  allTime?: boolean;
  /** Pass an already-loaded watermark (null = rollup unavailable) to skip the read. */
  watermark?: string | null;
  meter?: RowsReadMeter;
}

/** ISO instant of 00:00 Taipei on a YYYY-MM-DD day ('' for sentinel days with no instant). */
export function taipeiDayStartIso(day: string): string {
  const startMs = Date.parse(`${day}T00:00:00.000Z`) - 8 * 60 * 60 * 1000;
  return Number.isFinite(startMs) && startMs > 0 ? isoOf(startMs) : '';
}

/**
 * Message counts per (day, platform, sender) for the user's visibility: rollup rows plus
 * the live delta after the watermark.
 */
export async function readDayCounts(
  db: D1Database,
  user: ConversationVisibilityUser,
  options: ReadDayCountsOptions
): Promise<DayCount[]> {
  const { fromDay, toDay, senderTypes, nowMs, meter } = options;
  const allTime = options.allTime ?? false;
  const watermark = options.watermark !== undefined ? options.watermark : await readWatermark(db, meter);
  if (senderTypes.length === 0) { return []; }

  const merged = new Map<string, DayCount>();
  const add = (row: CountRow): void => {
    const day = allTime ? '' : (row.day ?? '');
    const platform = row.platform ?? 'unknown';
    const senderType = row.senderType ?? '';
    const key = `${day}|${platform}|${senderType}`;
    const existing = merged.get(key);
    const n = num(row.n);
    if (existing) { existing.n += n; } else { merged.set(key, { day, platform, senderType, n }); }
  };

  if (watermark !== null) {
    const vis = getRollupVisibilitySql(user);
    const dayClause = allTime ? `day = '${ALL_TIME_DAY}'` : 'day >= ? AND day <= ?';
    const dayParams = allTime ? [] : [fromDay, toDay];
    const rollup = await db.prepare(`
      SELECT ${allTime ? "''" : 'day'} AS day, platform, sender_type AS senderType, SUM(count) AS n
      FROM message_daily_stats
      WHERE ${vis.clause}
        AND sender_type IN (${placeholders(senderTypes.length)})
        AND ${dayClause}
      GROUP BY ${allTime ? '' : 'day, '}platform, sender_type
    `).bind(...vis.params, ...senderTypes, ...dayParams).all<CountRow>();
    meter?.track(rollup);
    for (const row of rollup.results ?? []) { add(row); }
  }

  // Live delta: everything after the watermark (or the whole range when there is no rollup).
  const rangeStartIso = allTime ? '' : taipeiDayStartIso(fromDay);
  const lowerExclusive = watermark !== null && watermark >= rangeStartIso ? watermark : null;
  const visLive = getConversationVisibilitySql(user, 'c.assigned_team_id');
  const lowerClause = lowerExclusive !== null ? 'm.created_at > ?' : 'm.created_at >= ?';
  const delta = await db.prepare(`
    SELECT ${DAY_EXPR} AS day, ${PLATFORM_EXPR} AS platform, m.sender_type AS senderType, COUNT(*) AS n
    ${FROM_MESSAGES}
    WHERE m.sender_type IN (${placeholders(senderTypes.length)})
      AND ${lowerClause} AND m.created_at <= ?
      AND m.deleted_at IS NULL
      AND ${visLive.clause}
    GROUP BY 1, 2, 3
  `).bind(...senderTypes, lowerExclusive ?? rangeStartIso, isoOf(nowMs), ...visLive.params).all<CountRow>();
  meter?.track(delta);
  for (const row of delta.results ?? []) {
    if (!allTime && row.day !== null && (row.day < fromDay || row.day > toDay)) { continue; }
    add(row);
  }

  return [...merged.values()];
}

/** Count of raw (non-deleted) messages of one sender in [fromIso, toIso) for the user's visibility. */
export async function countRawMessages(
  db: D1Database,
  user: ConversationVisibilityUser,
  senderType: RollupSender,
  fromIso: string,
  toIso: string,
  meter?: RowsReadMeter
): Promise<number> {
  const vis = getConversationVisibilitySql(user, 'c.assigned_team_id');
  const result = await db.prepare(`
    SELECT COUNT(*) AS n
    FROM messages m
    INNER JOIN conversations c ON c.id = m.conversation_id
    WHERE m.sender_type = ?
      AND m.created_at >= ? AND m.created_at < ?
      AND m.deleted_at IS NULL
      AND ${vis.clause}
  `).bind(senderType, fromIso, toIso, ...vis.params).all<{ n: number | string | null }>();
  meter?.track(result);
  return num(result.results?.[0]?.n);
}

/** Newest customer/agent message per platform: stored keys plus anything after the watermark. */
export async function readLastActivity(
  db: D1Database,
  watermark: string | null,
  nowMs: number,
  meter?: RowsReadMeter
): Promise<Map<string, string>> {
  const latest = new Map<string, string>();
  const bump = (platform: string, at: string | null): void => {
    if (!at) { return; }
    const prev = latest.get(platform);
    if (prev === undefined || at > prev) { latest.set(platform, at); }
  };

  if (watermark !== null) {
    const stored = await db
      .prepare('SELECT key, value FROM stats_watermarks WHERE key >= ? AND key < ?')
      .bind(LAST_ACTIVITY_KEY_PREFIX, `${LAST_ACTIVITY_KEY_PREFIX}￿`)
      .all<{ key: string; value: string }>();
    meter?.track(stored);
    for (const row of stored.results ?? []) {
      bump(row.key.slice(LAST_ACTIVITY_KEY_PREFIX.length), row.value);
    }
  }

  const delta = await db.prepare(`
    SELECT ${PLATFORM_EXPR} AS platform, MAX(m.created_at) AS at
    ${FROM_MESSAGES}
    WHERE m.sender_type IN ('customer', 'agent')
      AND m.created_at > ? AND m.created_at <= ?
      AND m.deleted_at IS NULL
    GROUP BY 1
  `).bind(watermark ?? '', isoOf(nowMs)).all<{ platform: string; at: string | null }>();
  meter?.track(delta);
  for (const row of delta.results ?? []) { bump(row.platform, row.at); }

  return latest;
}
