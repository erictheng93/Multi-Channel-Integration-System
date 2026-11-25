// ActivityService against a real SQLite-backed D1 double, so the Drizzle filters, ordering,
// pagination and the cleanup cutoff are the SQL that actually runs (no mocked query builder).

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { d1Of } from '../../../../helpers/sqlite-d1';
import { ActivityService } from '@modules/activities/services/ActivityService';

const NOW = new Date('2026-03-27T12:00:00.000Z');

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('ActivityService (real SQL)', () => {
  let sqlite: Database.Database;
  let service: ActivityService;

  function seed(rows: Array<{ userId: string; action: string; resourceType?: string; resourceId?: string; createdAt: string; details?: string }>) {
    const insert = sqlite.prepare(
      `INSERT INTO activities (user_id, user_name, user_role, action, resource_type, resource_id, details, created_at)
       VALUES (?, ?, 'admin', ?, ?, ?, ?, ?)`
    );
    for (const r of rows) {
      insert.run(r.userId, `name-${r.userId}`, r.action, r.resourceType ?? 'team', r.resourceId ?? null, r.details ?? null, r.createdAt);
    }
  }

  const count = () => (sqlite.prepare('SELECT COUNT(*) AS n FROM activities').get() as { n: number }).n;

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
    service = new ActivityService(d1Of(sqlite));
  });

  afterEach(() => {
    vi.useRealTimers();
    sqlite.close();
  });

  describe('logActivity', () => {
    it('persists the row with details as JSON and returns the inserted id', async () => {
      const result = await service.logActivity({
        userId: 'user-1',
        userName: 'Alice',
        userRole: 'admin',
        action: 'team_create',
        resourceType: 'team',
        resourceId: '10',
        details: { teamName: 'Support Team' }
      });

      const row = sqlite.prepare('SELECT * FROM activities').get() as Record<string, unknown>;
      expect(result?.id).toBe(row.id);
      expect(row.user_id).toBe('user-1');
      expect(row.resource_id).toBe('10');
      expect(JSON.parse(row.details as string)).toEqual({ teamName: 'Support Team' });
      expect(row.created_at).toBe(NOW.toISOString());
    });

    it('refuses an unknown role or action and writes nothing (never throws into the caller)', async () => {
      const base = { userId: 'u', userName: 'n', resourceType: 'team' };
      await expect(service.logActivity({ ...base, userRole: 'supervisor', action: 'team_create' })).resolves.toBeNull();
      await expect(service.logActivity({ ...base, userRole: 'admin', action: 'not_an_action' })).resolves.toBeNull();
      expect(count()).toBe(0);
    });

    it('accepts every restore action the restore endpoint records', async () => {
      for (const action of ['tag_restore', 'customer_restore', 'conversation_restore', 'team_restore', 'team_member_restore', 'delayed_message_restore']) {
        await expect(service.logActivity({ userId: 'u', userName: 'n', userRole: 'admin', action, resourceType: 'tag' })).resolves.not.toBeNull();
      }
      expect(count()).toBe(6);
    });
  });

  describe('getActivities', () => {
    beforeEach(() => {
      seed([
        { userId: 'a', action: 'team_create', resourceId: '1', createdAt: daysAgo(1), details: '{"k":1}' },
        { userId: 'a', action: 'team_update', resourceId: '1', createdAt: daysAgo(2) },
        { userId: 'b', action: 'team_create', resourceId: '2', createdAt: daysAgo(3) },
        { userId: 'a', action: 'team_create', resourceId: '3', createdAt: daysAgo(10) }
      ]);
    });

    it('combines filters with AND and returns newest first', async () => {
      const result = await service.getActivities({ userId: 'a', action: 'team_create' });
      expect(result.total).toBe(2);
      expect(result.items.map(i => i.resourceId)).toEqual(['1', '3']);
      expect(result.items[0]?.details).toEqual({ k: 1 });
    });

    it('applies the date range to both the total and the page', async () => {
      const result = await service.getActivities({ startDate: daysAgo(5), endDate: daysAgo(1.5) });
      expect(result.total).toBe(2);
      expect(result.items.map(i => i.resourceId)).toEqual(['1', '2']);
    });

    it('paginates with offset = (page - 1) * pageSize and reports totalPages', async () => {
      const page2 = await service.getActivities({ page: 2, pageSize: 3 });
      expect(page2.total).toBe(4);
      expect(page2.totalPages).toBe(2);
      expect(page2.items.map(i => i.resourceId)).toEqual(['3']);
    });

    it('rejects invalid query parameters before querying', async () => {
      await expect(service.getActivities({ page: 0 })).rejects.toThrow('Invalid query parameters');
      await expect(service.getActivities({ pageSize: 1001 })).rejects.toThrow('Invalid query parameters');
    });
  });

  describe('getUserActivityStats', () => {
    it('counts only the user within the window, grouped by action', async () => {
      seed([
        { userId: 'a', action: 'team_create', createdAt: daysAgo(1) },
        { userId: 'a', action: 'team_create', createdAt: daysAgo(2) },
        { userId: 'a', action: 'team_update', createdAt: daysAgo(3) },
        { userId: 'a', action: 'team_update', createdAt: daysAgo(40) },
        { userId: 'b', action: 'team_create', createdAt: daysAgo(1) }
      ]);

      const stats = await service.getUserActivityStats('a', 30);

      expect(stats.totalActions).toBe(3);
      expect(stats.actionsByType).toEqual({ team_create: 2, team_update: 1 });
      expect(stats.recentActions).toHaveLength(3);
    });
  });

  describe('cleanupOldActivities', () => {
    it('deletes only rows older than the cutoff and returns how many', async () => {
      seed([
        { userId: 'a', action: 'team_create', resourceId: 'keep', createdAt: daysAgo(89) },
        { userId: 'a', action: 'team_create', resourceId: 'drop1', createdAt: daysAgo(91) },
        { userId: 'a', action: 'team_create', resourceId: 'drop2', createdAt: daysAgo(400) }
      ]);

      await expect(service.cleanupOldActivities(90)).resolves.toBe(2);
      expect(sqlite.prepare('SELECT resource_id FROM activities').all()).toEqual([{ resource_id: 'keep' }]);
    });

    it('refuses to keep fewer than 30 days and deletes nothing', async () => {
      seed([{ userId: 'a', action: 'team_create', createdAt: daysAgo(10) }]);
      await expect(service.cleanupOldActivities(5)).rejects.toThrow('Invalid cleanup parameters');
      expect(count()).toBe(1);
    });
  });

  describe('getActivityById', () => {
    it('returns the parsed row, or null when absent', async () => {
      seed([{ userId: 'a', action: 'team_create', resourceId: '7', createdAt: daysAgo(1), details: '{"teamName":"Dev"}' }]);
      const id = (sqlite.prepare('SELECT id FROM activities').get() as { id: number }).id;

      const found = await service.getActivityById(id);
      expect(found?.resourceId).toBe('7');
      expect(found?.details).toEqual({ teamName: 'Dev' });
      await expect(service.getActivityById(id + 1)).resolves.toBeNull();
    });
  });
});
