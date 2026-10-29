/**
 * ActivityStatsService.getOverview activeUserCount / restorableCount against real SQLite (AC1).
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const handle = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/db/drizzle-factory', () => ({ createDbClient: () => handle.db }));

import { ActivityStatsService } from '@/modules/activities/services/ActivityStatsService';

const DAY = 86_400_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const future = (ms: number) => new Date(Date.now() + ms).toISOString();

describe('ActivityStatsService.getOverview counts (real SQLite)', () => {
  let sqlite: Database.Database;
  const service = () => new ActivityStatsService({} as D1Database);

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.exec(`CREATE TABLE activities (
      id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, user_name TEXT NOT NULL, user_role TEXT NOT NULL,
      action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT, details TEXT,
      ip_address TEXT, user_agent TEXT, created_at TEXT)`);
    handle.db = drizzle(sqlite);
  });

  const add = (userId: string, createdAt: string, details: unknown) =>
    sqlite
      .prepare('INSERT INTO activities (user_id, user_name, user_role, action, resource_type, details, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(userId, `name-${userId}`, 'agent', 'x', 'tag', details === null ? null : typeof details === 'string' ? details : JSON.stringify(details), createdAt);

  test('empty table: zeros', async () => {
    const o = await service().getOverview(7);
    expect(o.totalActivities).toBe(0);
    expect(o.activeUserCount).toBe(0);
    expect(o.restorableCount).toBe(0);
  });

  test('activeUserCount is the number of distinct users in the period', async () => {
    add('u1', ago(1 * DAY), null);
    add('u1', ago(2 * DAY), null);
    add('u2', ago(3 * DAY), null);
    add('u3', ago(30 * DAY), null);
    const o = await service().getOverview(7);
    expect(o.totalActivities).toBe(3);
    expect(o.activeUserCount).toBe(2);
  });

  test('restorableCount counts only reversible, unrestored, unexpired activities in the period', async () => {
    const open = { reversible: true, restorePolicy: { expiresAt: future(DAY) } };
    add('u1', ago(1 * DAY), open); // restorable
    add('u1', ago(1 * DAY), open); // restorable
    add('u1', ago(1 * DAY), { ...open, restoredByActivityId: 9 }); // already restored
    add('u1', ago(1 * DAY), { ...open, restoredByActivityId: -1 }); // restore in progress
    add('u1', ago(1 * DAY), { reversible: true, restorePolicy: { expiresAt: ago(DAY) } }); // expired
    add('u1', ago(1 * DAY), { reversible: false, restorePolicy: { expiresAt: future(DAY) } }); // not reversible
    add('u1', ago(1 * DAY), { restorePolicy: { expiresAt: future(DAY) } }); // flag absent
    add('u1', ago(1 * DAY), { reversible: true }); // no policy
    add('u1', ago(20 * DAY), open); // outside the period
    add('u1', ago(1 * DAY), null); // no details
    add('u1', ago(1 * DAY), 'not json {'); // malformed details must not break the query

    const o = await service().getOverview(7);
    expect(o.restorableCount).toBe(2);
    expect(o.totalActivities).toBe(10);
  });

  test('getCustomPeriodStats returns the same counts for its range', async () => {
    add('u1', '2026-10-10T00:00:00.000Z', { reversible: true, restorePolicy: { expiresAt: future(DAY) } });
    add('u2', '2026-10-11T00:00:00.000Z', null);
    add('u3', '2026-09-01T00:00:00.000Z', null);
    const o = await service().getCustomPeriodStats('2026-10-01T00:00:00.000Z', '2026-10-31T00:00:00.000Z');
    expect(o.activeUserCount).toBe(2);
    expect(o.restorableCount).toBe(1);
  });
});
