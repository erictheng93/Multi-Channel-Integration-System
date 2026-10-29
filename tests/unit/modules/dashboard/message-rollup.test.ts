import type Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  HEAL_DAYS,
  ROLLUP_LAG_MS,
  ROLLUP_WATERMARK_KEY,
  aggregateMessageRollup,
  getRollupVisibilitySql,
  healRecentMessageRollup,
  readDayCounts,
  readLastActivity,
  readWatermark,
} from '@/modules/dashboard/services/message-rollup-service';
import { buildDashboardSummary, buildMessageVolume } from '@/modules/dashboard/services/dashboard-service';
import { computeMessageStats } from '@/modules/integrations/services/channel-overview-stats-service';
import { getConversationVisibilitySql } from '@/services/conversation-visibility';
import type { Bindings } from '@/types';
import {
  MIGRATION_ROLLUP,
  addConv,
  addCustomer,
  addMsg,
  createDashboardDb,
  d1Of,
  readMigration,
} from '../../../helpers/sqlite-d1';

// 2026-10-29 18:00 Taipei == 10:00 UTC. Taipei midnight today = 2026-10-28T16:00:00Z.
const NOW = Date.parse('2026-10-29T10:00:00.000Z');
const admin = { role: 'admin' as const, allowedTeamIds: [] as number[] };
const agentOfTeam = (...ids: number[]) => ({ role: 'agent' as const, allowedTeamIds: ids });

const setWatermark = (db: Database.Database, iso: string) =>
  db.prepare('UPDATE stats_watermarks SET value = ? WHERE key = ?').run(iso, ROLLUP_WATERMARK_KEY);
const watermarkOf = (db: Database.Database) =>
  (db.prepare('SELECT value FROM stats_watermarks WHERE key = ?').get(ROLLUP_WATERMARK_KEY) as { value: string }).value;
const rollupRows = (db: Database.Database, where = 'team_id >= 0') =>
  db.prepare(`SELECT team_id AS t, sender_type AS s, day, platform, count FROM message_daily_stats WHERE ${where} ORDER BY 1,2,3,4`).all();
/** Messages counted by the per-team rows (what the rollup says exists). */
const rollupTotal = (db: Database.Database) =>
  (db.prepare('SELECT COALESCE(SUM(count),0) AS n FROM message_daily_stats WHERE team_id >= 0').get() as { n: number }).n;

/**
 * Invariants of the three row kinds, plus equality with a direct count of the source up to the watermark:
 *   all-teams row (-1) == sum of the team rows for the same (sender, day, platform)
 *   all-time row == sum of the all-teams day rows for the same (sender, platform)
 */
function expectConsistent(db: Database.Database): void {
  const teamSums = db.prepare(`
    SELECT sender_type AS s, day, platform, SUM(count) AS n FROM message_daily_stats WHERE team_id >= 0 GROUP BY 1,2,3 ORDER BY 1,2,3`).all();
  const allTeams = db.prepare(`
    SELECT sender_type AS s, day, platform, count AS n FROM message_daily_stats WHERE team_id = -1 AND day <> '0000-00-00' ORDER BY 1,2,3`).all();
  expect(allTeams).toEqual(teamSums);
  const daySums = db.prepare(`
    SELECT sender_type AS s, platform, SUM(count) AS n FROM message_daily_stats WHERE team_id = -1 AND day <> '0000-00-00' GROUP BY 1,2 ORDER BY 1,2`).all();
  const allTime = db.prepare(`
    SELECT sender_type AS s, platform, count AS n FROM message_daily_stats WHERE team_id = -1 AND day = '0000-00-00' AND count <> 0 ORDER BY 1,2`).all();
  expect(allTime).toEqual(daySums);
  const direct = db.prepare(`
    SELECT m.sender_type AS s, date(m.created_at, '+8 hours') AS day, COALESCE(cu.platform,'unknown') AS platform, COUNT(*) AS n
    FROM messages m JOIN conversations c ON c.id = m.conversation_id LEFT JOIN customers cu ON cu.id = c.customer_id
    WHERE m.deleted_at IS NULL AND m.created_at <= (SELECT value FROM stats_watermarks WHERE key = 'message_daily_stats')
    GROUP BY 1,2,3 ORDER BY 1,2,3`).all();
  expect(allTeams).toEqual(direct);
}

/** Apply the migration to a populated DB, then rewind: tests drive the cron themselves. */
function resetRollup(db: Database.Database): void {
  db.exec(readMigration(MIGRATION_ROLLUP));
  db.exec('DELETE FROM message_daily_stats');
  db.exec("DELETE FROM stats_watermarks WHERE key LIKE 'last_activity:%'");
  setWatermark(db, '2026-01-01T00:00:00.000Z');
}

/** DB with the rollup migration applied on an EMPTY database, watermark pinned far in the past. */
function rollupDb(): Database.Database {
  const db = createDashboardDb({ rollup: true });
  setWatermark(db, '2026-01-01T00:00:00.000Z');
  return db;
}

describe('migration 0069 backfill', () => {
  it('equals a direct count by Taipei day, platform, sender and team, excluding soft-deleted rows', () => {
    const db = createDashboardDb(); // no rollup yet
    addCustomer(db, 1, 'line');
    addCustomer(db, 2, 'facebook');
    addConv(db, 'a', { customer: 1, team: null });
    addConv(db, 'b', { customer: 2, team: 7 });
    addMsg(db, 'a', 'customer', '2025-03-01T15:59:59.999Z'); // Taipei 03-01 23:59:59
    addMsg(db, 'a', 'customer', '2025-03-01T16:00:00.000Z'); // Taipei 03-02 00:00:00
    addMsg(db, 'a', 'agent', '2025-03-02T01:00:00.000Z');
    addMsg(db, 'a', 'customer', '2025-03-02T02:00:00.000Z', { deleted: '2025-03-03T00:00:00.000Z' });
    addMsg(db, 'b', 'customer', '2025-03-02T03:00:00.000Z');
    addMsg(db, 'b', 'system', '2025-03-02T03:00:01.000Z');

    db.exec(readMigration(MIGRATION_ROLLUP));
    db.exec(readMigration(MIGRATION_ROLLUP)); // re-run safe (CREATE IF NOT EXISTS + DELETE/INSERT backfill)

    expect(rollupRows(db)).toEqual([
      { t: 0, s: 'agent', day: '2025-03-02', platform: 'line', count: 1 },
      { t: 0, s: 'customer', day: '2025-03-01', platform: 'line', count: 2 - 1 },
      { t: 0, s: 'customer', day: '2025-03-02', platform: 'line', count: 1 },
      { t: 7, s: 'customer', day: '2025-03-02', platform: 'facebook', count: 1 },
      { t: 7, s: 'system', day: '2025-03-02', platform: 'facebook', count: 1 },
    ]);
    expect(rollupRows(db, "team_id = -1 AND day = '0000-00-00'")).toEqual([
      { t: -1, s: 'agent', day: '0000-00-00', platform: 'line', count: 1 },
      { t: -1, s: 'customer', day: '0000-00-00', platform: 'facebook', count: 1 },
      { t: -1, s: 'customer', day: '0000-00-00', platform: 'line', count: 2 },
      { t: -1, s: 'system', day: '0000-00-00', platform: 'facebook', count: 1 },
    ]);
    expectConsistent(db);
    const direct = db.prepare("SELECT COUNT(*) AS n FROM messages WHERE deleted_at IS NULL").get() as { n: number };
    expect(rollupTotal(db)).toBe(direct.n);
    // last activity keys exist for customer/agent only
    const keys = db.prepare("SELECT key, value FROM stats_watermarks WHERE key LIKE 'last_activity:%' ORDER BY key").all();
    expect(keys).toEqual([
      { key: 'last_activity:facebook', value: '2025-03-02T03:00:00.000Z' },
      { key: 'last_activity:line', value: '2025-03-02T01:00:00.000Z' },
    ]);
  });

  it('sets a watermark so the cron only needs to fold in what came after', () => {
    const db = createDashboardDb({ rollup: true });
    expect(watermarkOf(db) < new Date().toISOString()).toBe(true);
  });
});

describe('aggregateMessageRollup', () => {
  it('folds only messages after the watermark, advances it, and is idempotent when run twice', async () => {
    const db = rollupDb();
    addCustomer(db, 1, 'line');
    addConv(db, 'a', { team: 7 });
    addMsg(db, 'a', 'customer', '2026-10-20T01:00:00.000Z');
    addMsg(db, 'a', 'customer', '2026-10-28T15:59:59.999Z'); // Taipei 10-28
    addMsg(db, 'a', 'customer', '2026-10-28T16:00:00.000Z'); // Taipei 10-29
    addMsg(db, 'a', 'agent', '2026-10-29T08:00:00.000Z');
    addMsg(db, 'a', 'customer', '2026-10-29T09:59:30.000Z'); // inside the 60 s lag: left for the next run

    const d1 = d1Of(db);
    const first = await aggregateMessageRollup(d1, NOW);
    expect(first.status).toBe('aggregated');
    expect(watermarkOf(db)).toBe(new Date(NOW - ROLLUP_LAG_MS).toISOString());
    expect(rollupTotal(db)).toBe(4);

    const snapshot = rollupRows(db);
    const second = await aggregateMessageRollup(d1, NOW);
    expect(second.status).toBe('up-to-date');
    expect(rollupRows(db)).toEqual(snapshot);

    // a later run picks up exactly the leftover message, once
    await aggregateMessageRollup(d1, NOW + 5 * 60_000);
    await aggregateMessageRollup(d1, NOW + 5 * 60_000);
    expect(rollupTotal(db)).toBe(5);
    expect(rollupRows(db)).toContainEqual({ t: 7, s: 'customer', day: '2026-10-29', platform: 'line', count: 2 });
    expectConsistent(db);
  });

  it('two overlapping runs that read the same watermark cannot double count (lower bound is read inside the batch)', async () => {
    const db = rollupDb();
    addCustomer(db, 1);
    addConv(db, 'a');
    addMsg(db, 'a', 'customer', '2026-10-29T05:00:00.000Z');
    const d1 = d1Of(db);
    await Promise.all([aggregateMessageRollup(d1, NOW), aggregateMessageRollup(d1, NOW)]);
    expect(rollupTotal(db)).toBe(1);
    expectConsistent(db);
  });

  it('is a no-op (no throw) when migration 0069 has not been applied', async () => {
    const db = createDashboardDb();
    const result = await aggregateMessageRollup(d1Of(db), NOW);
    expect(result).toEqual({ status: 'no-watermark', watermark: null });
  });

  it('keeps the newest customer/agent activity per platform', async () => {
    const db = rollupDb();
    addCustomer(db, 1, 'line');
    addCustomer(db, 2, 'facebook');
    addConv(db, 'a', { customer: 1 });
    addConv(db, 'b', { customer: 2 });
    addMsg(db, 'a', 'customer', '2026-10-29T01:00:00.000Z');
    addMsg(db, 'a', 'system', '2026-10-29T02:00:00.000Z'); // system is not channel activity
    addMsg(db, 'b', 'agent', '2026-10-29T03:00:00.000Z');
    await aggregateMessageRollup(d1Of(db), NOW);
    const last = await readLastActivity(d1Of(db), watermarkOf(db), NOW);
    expect(Object.fromEntries(last)).toEqual({
      line: '2026-10-29T01:00:00.000Z',
      facebook: '2026-10-29T03:00:00.000Z',
    });
  });
});

describe('healRecentMessageRollup (nightly self-heal)', () => {
  it('re-derives the last 2 Taipei days: soft deletes, late rows and reassignments converge; older days stay', async () => {
    const db = rollupDb();
    addCustomer(db, 1);
    addConv(db, 'a', { team: null });
    const old = addMsg(db, 'a', 'customer', '2026-10-20T02:00:00.000Z'); // outside the heal window
    const gone = addMsg(db, 'a', 'customer', '2026-10-28T02:00:00.000Z'); // yesterday (Taipei 10-28)
    addMsg(db, 'a', 'customer', '2026-10-29T02:00:00.000Z');
    const d1 = d1Of(db);
    await aggregateMessageRollup(d1, NOW);
    expect(rollupTotal(db)).toBe(3);

    // after aggregation: a soft delete, a late row inside the aggregated range, a reassignment
    db.prepare('UPDATE messages SET deleted_at = ? WHERE id = ?').run('2026-10-29T09:00:00.000Z', gone);
    db.prepare('UPDATE messages SET deleted_at = ? WHERE id = ?').run('2026-10-29T09:00:00.000Z', old);
    addMsg(db, 'a', 'customer', '2026-10-29T03:00:00.000Z'); // late row: created_at <= watermark but inserted afterwards
    db.prepare('UPDATE conversations SET assigned_team_id = 7 WHERE id = ?').run('a');

    const result = await healRecentMessageRollup(d1, NOW);
    expect(result).toEqual({ fromDay: '2026-10-28', healed: true });
    expect(HEAL_DAYS).toBe(2);
    expect(rollupRows(db, "team_id = -1 AND day >= '2026-10-28'")).toHaveLength(1);

    const byDay = Object.fromEntries(
      (db.prepare('SELECT day, SUM(count) AS n FROM message_daily_stats WHERE team_id >= 0 GROUP BY day').all() as Array<{ day: string; n: number }>)
        .map(r => [r.day, r.n])
    );
    // 10-20 keeps its (now stale) count: only the last 2 days are healed
    expect(byDay).toEqual({ '2026-10-20': 1, '2026-10-29': 2 });
    expect(rollupRows(db).filter(r => (r as { day: string }).day === '2026-10-29')).toEqual([
      { day: '2026-10-29', platform: 'line', s: 'customer', t: 7, count: 2 }, // re-attributed to team 7
    ]);
    // the all-time total moved by exactly the healed difference: 3 aggregated, 1 deleted yesterday, +1 late row, 1 old stale
    expect(rollupRows(db, "team_id = -1 AND day = '0000-00-00'")).toEqual([
      { t: -1, s: 'customer', day: '0000-00-00', platform: 'line', count: 3 },
    ]);
    // the stale 10-20 count (its message was deleted after aggregation) is outside the window and survives until a wider recompute
    expect(rollupRows(db, "team_id = -1 AND day = '2026-10-20'")).toHaveLength(1);
  });

  it('does not touch messages after the watermark (the live delta owns them)', async () => {
    const db = rollupDb();
    addCustomer(db, 1);
    addConv(db, 'a');
    addMsg(db, 'a', 'customer', '2026-10-29T02:00:00.000Z');
    const d1 = d1Of(db);
    await aggregateMessageRollup(d1, NOW);
    addMsg(db, 'a', 'customer', '2026-10-29T09:59:45.000Z'); // after watermark (NOW - 60 s)
    await healRecentMessageRollup(d1, NOW);
    expect(rollupTotal(db)).toBe(1);
    const live = await readDayCounts(d1, admin, {
      fromDay: '2026-10-29', toDay: '2026-10-29', senderTypes: ['customer'], nowMs: NOW,
    });
    expect(live.reduce((s, r) => s + r.n, 0)).toBe(2);
  });

  it('does nothing without a rollup', async () => {
    expect(await healRecentMessageRollup(d1Of(createDashboardDb()), NOW)).toEqual({ fromDay: '2026-10-28', healed: false });
  });
});

describe('visibility on the rollup', () => {
  it('agent = sum of their teams + the unassigned pool, admin = everything', async () => {
    const db = rollupDb();
    addCustomer(db, 1);
    addConv(db, 'pool', { team: null });
    addConv(db, 'mine', { team: 7 });
    addConv(db, 'theirs', { team: 9 });
    for (const c of ['pool', 'mine', 'theirs']) { addMsg(db, c, 'customer', '2026-10-29T02:00:00.000Z'); }
    const d1 = d1Of(db);
    await aggregateMessageRollup(d1, NOW);
    const total = async (user: typeof admin | ReturnType<typeof agentOfTeam>) =>
      (await readDayCounts(d1, user, { fromDay: '2026-10-29', toDay: '2026-10-29', senderTypes: ['customer'], nowMs: NOW }))
        .reduce((s, r) => s + r.n, 0);
    expect(await total(admin)).toBe(3);
    expect(await total(agentOfTeam(7))).toBe(2);
    expect(await total(agentOfTeam(7, 9))).toBe(3);
    expect(await total(agentOfTeam())).toBe(1);
  });

  it('uses 0 for the pool and builds the same shape as the live visibility rule', () => {
    expect(getRollupVisibilitySql(admin)).toEqual({ clause: 'team_id = -1', params: [] });
    expect(getRollupVisibilitySql(agentOfTeam(7, 7, 9)).params).toEqual(['[0,7,9]']);
    expect(getRollupVisibilitySql(agentOfTeam()).params).toEqual(['[0]']);
    expect(getConversationVisibilitySql(agentOfTeam(), 'c.assigned_team_id').clause).toContain('IS NULL');
  });
});

describe('rollup + live delta equals the direct (legacy) computation', () => {
  /** The pre-rollup message-volume query, kept verbatim as the oracle. */
  function legacyVolume(db: Database.Database, user: typeof admin | ReturnType<typeof agentOfTeam>, rangeStartIso: string, nowIso: string) {
    const vis = getConversationVisibilitySql(user, 'c.assigned_team_id');
    return db.prepare(`
      SELECT date(m.created_at, '+8 hours') AS d, cu.platform AS platform, COUNT(*) AS n
      FROM messages m
      INNER JOIN conversations c ON c.id = m.conversation_id
      LEFT JOIN customers cu ON cu.id = c.customer_id
      WHERE m.sender_type = 'customer' AND m.created_at >= ? AND m.created_at <= ? AND m.deleted_at IS NULL AND ${vis.clause}
      GROUP BY d, cu.platform
    `).all(rangeStartIso, nowIso, ...vis.params) as Array<{ d: string; platform: string; n: number }>;
  }

  function seedDataset(db: Database.Database): void {
    let state = 42;
    const rnd = () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
    for (let i = 1; i <= 12; i++) {
      addCustomer(db, i, i % 3 === 0 ? 'facebook' : 'line');
      addConv(db, `c${i}`, { customer: i, team: i % 4 === 0 ? null : (i % 4) + 6, status: i % 5 === 0 ? 'closed' : 'active' });
    }
    const senders = ['customer', 'customer', 'customer', 'agent', 'system'] as const;
    for (let i = 0; i < 900; i++) {
      const at = NOW - Math.floor(rnd() * 100 * 24 * 3600_000);
      addMsg(db, `c${1 + Math.floor(rnd() * 12)}`, senders[Math.floor(rnd() * senders.length)]!, new Date(at).toISOString(), {
        deleted: rnd() < 0.03 ? '2026-10-29T00:00:00.000Z' : null,
      });
    }
    // boundary rows around Taipei midnight and around "now - 24h"
    for (const iso of ['2026-10-28T15:59:59.999Z', '2026-10-28T16:00:00.000Z', '2026-10-28T10:00:00.000Z', '2026-10-28T09:59:59.999Z', '2026-10-29T09:59:59.999Z', '2026-10-29T10:00:00.000Z']) {
      addMsg(db, 'c1', 'customer', iso);
    }
  }

  it.each([7, 30, 90] as const)('message volume (%i days) matches for admin and a 2-team agent, with messages after the watermark', async (days) => {
    const plain = createDashboardDb();
    seedDataset(plain);
    const rolled = createDashboardDb();
    seedDataset(rolled);
    resetRollup(rolled);
    // aggregate up to NOW - 30 minutes, leaving a real live delta
    await aggregateMessageRollup(d1Of(rolled), NOW - 30 * 60_000 + ROLLUP_LAG_MS);
    expect(watermarkOf(rolled)).toBe(new Date(NOW - 30 * 60_000).toISOString());

    for (const user of [admin, agentOfTeam(7, 8), agentOfTeam()]) {
      const expected = await buildMessageVolume(d1Of(plain), user, days, NOW);
      const actual = await buildMessageVolume(d1Of(rolled), user, days, NOW);
      expect(actual).toEqual(expected);
      // and the fallback (no rollup) equals the legacy SQL
      const start = new Date(Date.parse('2026-10-28T16:00:00.000Z') - (2 * days - 1) * 24 * 3600_000).toISOString();
      const legacy = legacyVolume(plain, user, start, new Date(NOW).toISOString());
      expect(expected.totals.current + expected.totals.previous).toBe(legacy.reduce((s, r) => s + r.n, 0));
    }
  });

  it('dashboard summary customerMessages (today / yesterday same time) matches at several clock times', async () => {
    // head shorter than tail (early morning), tail shorter than head (evening), and exactly at midnight
    for (const now of [
      Date.parse('2026-10-28T17:30:00.000Z'), // Taipei 01:30 -> head is short
      NOW,                                    // Taipei 18:00 -> tail is short
      Date.parse('2026-10-28T16:00:00.000Z'), // Taipei 00:00 exactly
      Date.parse('2026-10-28T16:03:00.000Z'), // just after midnight: yesterday's rollup day is still incomplete
    ]) {
      const plain = createDashboardDb({ awaiting: true });
      seedDataset(plain);
      const rolled = createDashboardDb({ awaiting: true });
      seedDataset(rolled);
      resetRollup(rolled);
      // the cron last ran 30 minutes before "now": a real live delta exists
      await aggregateMessageRollup(d1Of(rolled), now - 30 * 60_000 + ROLLUP_LAG_MS);
      for (const user of [admin, agentOfTeam(7)]) {
        const expected = (await buildDashboardSummary(d1Of(plain), user, now)).customerMessages;
        const actual = (await buildDashboardSummary(d1Of(rolled), user, now)).customerMessages;
        expect(actual).toEqual(expected);
      }
    }
  });

  it('channel activity (24 h rolling, all time, last activity) matches the live computation', async () => {
    const plain = createDashboardDb();
    seedDataset(plain);
    const rolled = createDashboardDb();
    seedDataset(rolled);
    resetRollup(rolled);
    await aggregateMessageRollup(d1Of(rolled), NOW - 30 * 60_000 + ROLLUP_LAG_MS);

    const expected = await computeMessageStats({ DB: d1Of(plain) } as unknown as Bindings, NOW);
    const actual = await computeMessageStats({ DB: d1Of(rolled) } as unknown as Bindings, NOW);
    expect(actual.platforms).toEqual(expected.platforms);
    expect(Object.keys(actual.platforms).sort()).toEqual(['facebook', 'line']);
  });

  it('readWatermark is null (and readers fall back) when the table does not exist', async () => {
    expect(await readWatermark(d1Of(createDashboardDb()))).toBeNull();
  });
});
