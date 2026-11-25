// ActivityStatsService against a real SQLite-backed D1 double: the period filters, the system
// actor exclusion and the json_extract "restorable" predicate are the SQL that runs in production.

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { d1Of } from '../../../../helpers/sqlite-d1';
import { ActivityStatsService } from '@modules/activities/services/ActivityStatsService';

const NOW = new Date('2026-03-27T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * HOUR).toISOString();
}

interface Row {
  userId: string;
  userRole?: string;
  action?: string;
  resourceType?: string;
  createdAt: string;
  details?: string | null;
}

describe('ActivityStatsService (real SQL)', () => {
  let sqlite: Database.Database;
  let service: ActivityStatsService;

  function seed(rows: Row[]) {
    const insert = sqlite.prepare(
      `INSERT INTO activities (user_id, user_name, user_role, action, resource_type, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const r of rows) {
      insert.run(r.userId, `name-${r.userId}`, r.userRole ?? 'agent', r.action ?? 'team_create',
        r.resourceType ?? 'team', r.details ?? null, r.createdAt);
    }
  }

  function reversible(overrides: { restoredByActivityId?: number | null; expiresAt?: string } = {}): string {
    return JSON.stringify({
      reversible: true,
      restoredByActivityId: overrides.restoredByActivityId ?? null,
      restorePolicy: { expiresAt: overrides.expiresAt ?? new Date(NOW.getTime() + HOUR).toISOString(), requiresAdmin: false }
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    sqlite = new Database(':memory:');
    sqlite.exec(`CREATE TABLE activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL, user_name TEXT NOT NULL, user_role TEXT NOT NULL,
      action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT,
      details TEXT, ip_address TEXT, user_agent TEXT, created_at TEXT
    )`);
    service = new ActivityStatsService(d1Of(sqlite));
  });

  afterEach(() => {
    vi.useRealTimers();
    sqlite.close();
  });

  describe('getOverview', () => {
    it('counts only the window, and keeps the system actor out of users but not out of totals', async () => {
      seed([
        { userId: 'a', action: 'team_create', createdAt: hoursAgo(1) },
        { userId: 'a', action: 'team_update', createdAt: hoursAgo(2) },
        { userId: 'b', action: 'team_create', createdAt: hoursAgo(3) },
        { userId: 'system', action: 'conversation_close', createdAt: hoursAgo(4) },
        { userId: 'system', action: 'conversation_close', createdAt: hoursAgo(5) },
        { userId: 'system', action: 'conversation_close', createdAt: hoursAgo(6) },
        { userId: 'a', action: 'team_create', createdAt: hoursAgo(24 * 8) }
      ]);

      const overview = await service.getOverview(7);

      expect(overview.totalActivities).toBe(6);
      expect(overview.activeUserCount).toBe(2);
      expect(overview.topUsers.map(u => u.userName)).toEqual(['name-a', 'name-b']);
      expect(overview.actionStats).toEqual({ team_create: 2, team_update: 1, conversation_close: 3 });
      expect(overview.dailyStats).toEqual([{ date: '2026-03-27', count: 6 }]);
    });

    it('restorableCount = reversible, not yet restored, window still open; malformed details are skipped', async () => {
      seed([
        { userId: 'a', createdAt: hoursAgo(1), details: reversible() },
        { userId: 'a', createdAt: hoursAgo(1), details: reversible({ restoredByActivityId: 9 }) },
        { userId: 'a', createdAt: hoursAgo(1), details: reversible({ expiresAt: hoursAgo(0.5) }) },
        { userId: 'a', createdAt: hoursAgo(1), details: JSON.stringify({ reversible: false, irreversibleReason: 'x' }) },
        { userId: 'a', createdAt: hoursAgo(1), details: 'not json {' },
        { userId: 'a', createdAt: hoursAgo(1), details: null }
      ]);

      const overview = await service.getOverview(7);

      expect(overview.totalActivities).toBe(6);
      expect(overview.restorableCount).toBe(1);
    });
  });

  it('getResourceTypeStats returns rounded percentages, largest first', async () => {
    seed([
      { userId: 'a', resourceType: 'team', createdAt: hoursAgo(1) },
      { userId: 'a', resourceType: 'team', createdAt: hoursAgo(1) },
      { userId: 'a', resourceType: 'tag', createdAt: hoursAgo(1) }
    ]);

    const stats = await service.getResourceTypeStats(30);

    expect(stats.map(s => [s.resourceType, s.count, s.percentage])).toEqual([['team', 2, 67], ['tag', 1, 33]]);
  });

  it('getActivityTrends merges the per-action breakdown into each day, oldest first', async () => {
    seed([
      { userId: 'a', action: 'team_create', createdAt: '2026-03-25T10:00:00.000Z' },
      { userId: 'a', action: 'team_create', createdAt: '2026-03-26T10:00:00.000Z' },
      { userId: 'a', action: 'team_update', createdAt: '2026-03-26T11:00:00.000Z' }
    ]);

    await expect(service.getActivityTrends(30)).resolves.toEqual([
      { date: '2026-03-25', count: 1, actions: { team_create: 1 } },
      { date: '2026-03-26', count: 2, actions: { team_create: 1, team_update: 1 } }
    ]);
  });

  it('getActivityHeatmap buckets by UTC hour and grades intensity at 20 and 50', async () => {
    seed([
      ...Array.from({ length: 20 }, () => ({ userId: 'a', createdAt: '2026-03-26T09:10:00.000Z' })),
      ...Array.from({ length: 19 }, () => ({ userId: 'a', createdAt: '2026-03-26T10:10:00.000Z' })),
      ...Array.from({ length: 50 }, () => ({ userId: 'a', createdAt: '2026-03-26T11:10:00.000Z' }))
    ]);

    const heatmap = await service.getActivityHeatmap(30);

    expect(heatmap.map(h => [h.hour, h.count, h.intensity])).toEqual([
      [9, 20, 'medium'],
      [10, 19, 'low'],
      [11, 50, 'high']
    ]);
  });

  it('getPerformanceMetrics picks the peak hour, top non-system user and most common action', async () => {
    seed([
      { userId: 'system', action: 'conversation_close', createdAt: '2026-03-26T03:00:00.000Z' },
      { userId: 'system', action: 'conversation_close', createdAt: '2026-03-26T03:05:00.000Z' },
      { userId: 'system', action: 'conversation_close', createdAt: '2026-03-26T03:10:00.000Z' },
      { userId: 'a', action: 'team_create', createdAt: '2026-03-26T08:00:00.000Z' },
      { userId: 'a', action: 'team_create', createdAt: '2026-03-25T08:00:00.000Z' }
    ]);

    const metrics = await service.getPerformanceMetrics(7);

    expect(metrics.peakHour).toBe(3);
    expect(metrics.mostActiveUser).toBe('name-a');
    expect(metrics.mostCommonAction).toBe('conversation_close');
    expect(metrics.avgActivitiesPerDay).toBe(1);
    expect(metrics.systemLoad).toBe('low');
  });

  it('getCustomPeriodStats includes both bounds and nothing outside them', async () => {
    seed([
      { userId: 'a', createdAt: '2026-03-01T00:00:00.000Z' },
      { userId: 'a', createdAt: '2026-03-05T00:00:00.000Z' },
      { userId: 'a', createdAt: '2026-03-05T00:00:00.001Z' },
      { userId: 'a', createdAt: '2026-02-28T23:59:59.999Z' }
    ]);

    const stats = await service.getCustomPeriodStats('2026-03-01T00:00:00.000Z', '2026-03-05T00:00:00.000Z');

    expect(stats.totalActivities).toBe(2);
    expect(stats.period.days).toBe(4);
  });
});
