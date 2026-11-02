import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Sqlite from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { drizzle, type RemoteCallback } from 'drizzle-orm/sqlite-proxy';
import * as schema from '@/db/schema';
import type { Bindings } from '@/types';
import type { ReportViewer } from '@modules/reports/types/report-types';

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('drizzle-orm/d1', () => ({ drizzle: () => state.db }));
vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { ReportManagerService } from '@modules/reports/services/report-manager-service';
import { ReportGeneratorService } from '@modules/reports/services/report-generator-service';

const PAST = '2020-01-01T00:00:00.000Z';
const FUTURE = '2999-01-01T00:00:00.000Z';

describe('ReportManagerService listing and details', () => {
  let sqlite: Sqlite.Database;
  let manager: ReportManagerService;
  let generator: ReportGeneratorService;

  const admin: ReportViewer = { userId: 'admin-1', role: 'admin', teamIds: [] };
  const alice: ReportViewer = { userId: 'alice', role: 'agent', teamIds: [1] };

  const addReport = (
    id: string,
    o: Partial<{ title: string; status: string; format: string; createdBy: string; teamId: number | null; expiresAt: string; deletedAt: string | null; createdAt: string; type: string }> = {}
  ) =>
    sqlite
      .prepare(
        'INSERT INTO reports (id, title, type, format, status, created_by, team_id, expires_at, deleted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(id, o.title ?? id, o.type ?? 'conversation_summary', o.format ?? 'json', o.status ?? 'completed',
        o.createdBy ?? 'alice', o.teamId ?? null, o.expiresAt ?? FUTURE, o.deletedAt ?? null, o.createdAt ?? '2026-10-01T00:00:00.000Z');

  beforeEach(() => {
    sqlite = new Sqlite(':memory:');
    for (const table of [schema.reports, schema.reportDownloadHistory, schema.agents]) {
      const config = getTableConfig(table);
      sqlite.exec(`CREATE TABLE "${config.name}" (${config.columns.map((column) =>
        `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`
      ).join(', ')})`);
    }
    const execute: RemoteCallback = async (query, params, method) => {
      const statement = sqlite.prepare(query);
      if (method === 'run') { statement.run(...params); return { rows: [] }; }
      const rows = statement.raw().all(...params);
      return { rows: method === 'get' ? rows[0] as unknown[] : rows };
    };
    state.db = drizzle(execute, { schema });
    const env = { DB: {}, R2_BUCKET: {} } as unknown as Bindings;
    manager = new ReportManagerService(env);
    generator = new ReportGeneratorService(env);
  });
  afterEach(() => sqlite.close());

  it('returns an empty list and zero summary when there are no reports', async () => {
    const result = await manager.listReports({}, admin);

    expect(result.reports).toEqual([]);
    expect(result.pagination.total).toBe(0);
    expect(result.summary).toEqual({
      totalReports: 0, pendingReports: 0, generatingReports: 0, completedReports: 0, failedReports: 0, expiredReports: 0,
    });
  });

  it('excludes soft-deleted reports from the list, the total and the summary', async () => {
    addReport('keep');
    addReport('gone', { deletedAt: '2026-10-02T00:00:00.000Z' });

    const result = await manager.listReports({}, admin);

    expect(result.reports.map((r) => r.id)).toEqual(['keep']);
    expect(result.pagination.total).toBe(1);
    expect(result.summary.totalReports).toBe(1);
  });

  it('summarises every status including generating, with completed split from expired', async () => {
    addReport('p', { status: 'pending' });
    addReport('g', { status: 'generating' });
    addReport('c1');
    addReport('c2');
    addReport('e', { expiresAt: PAST });
    addReport('f', { status: 'failed' });

    const { summary } = await manager.listReports({}, admin);

    expect(summary).toEqual({
      totalReports: 6, pendingReports: 1, generatingReports: 1, completedReports: 2, failedReports: 1, expiredReports: 1,
    });
  });

  it('reports a completed report past expiresAt as expired and filters by that status', async () => {
    addReport('fresh');
    addReport('old', { expiresAt: PAST });

    const all = await manager.listReports({}, admin);
    expect(Object.fromEntries(all.reports.map((r) => [r.id, r.status]))).toEqual({ fresh: 'completed', old: 'expired' });
    expect(all.reports.find((r) => r.id === 'old')?.expiresAt).toBe(PAST);

    expect((await manager.listReports({ status: 'expired' }, admin)).reports.map((r) => r.id)).toEqual(['old']);
    expect((await manager.listReports({ status: 'completed' }, admin)).reports.map((r) => r.id)).toEqual(['fresh']);
  });

  it('applies the format filter, the title search and the sort order', async () => {
    addReport('a', { title: 'Alpha weekly', format: 'json', createdAt: '2026-10-01T00:00:00.000Z' });
    addReport('b', { title: 'Beta weekly', format: 'csv', createdAt: '2026-10-02T00:00:00.000Z' });
    addReport('c', { title: 'Gamma 100%', format: 'csv', createdAt: '2026-10-03T00:00:00.000Z' });

    expect((await manager.listReports({ format: 'csv' }, admin)).reports.map((r) => r.id)).toEqual(['c', 'b']);
    expect((await manager.listReports({ search: 'weekly' }, admin)).reports.map((r) => r.id)).toEqual(['b', 'a']);
    expect((await manager.listReports({ search: '100%' }, admin)).reports.map((r) => r.id)).toEqual(['c']);
    expect((await manager.listReports({ sortOrder: 'asc' }, admin)).reports.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect((await manager.listReports({ sortBy: 'title', sortOrder: 'asc' }, admin)).reports.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect((await manager.listReports({ sortBy: 'title', sortOrder: 'desc' }, admin)).reports.map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });

  it('lets a non-admin see only own and own-team reports, in the list and the summary', async () => {
    addReport('mine', { createdBy: 'alice' });
    addReport('team', { createdBy: 'bob', teamId: 1 });
    addReport('other-team', { createdBy: 'bob', teamId: 2 });
    addReport('stranger', { createdBy: 'bob', status: 'failed' });

    const result = await manager.listReports({}, alice);

    expect(result.reports.map((r) => r.id).sort()).toEqual(['mine', 'team']);
    expect(result.summary.totalReports).toBe(2);
    expect(result.summary.failedReports).toBe(0);
    expect((await manager.listReports({}, admin)).reports).toHaveLength(4);
  });

  it('gives an agent with no teams only their own reports', async () => {
    addReport('mine', { createdBy: 'alice' });
    addReport('team', { createdBy: 'bob', teamId: 1 });

    const result = await manager.listReports({}, { ...alice, teamIds: [] });

    expect(result.reports.map((r) => r.id)).toEqual(['mine']);
  });

  describe('getReportDetails', () => {
    it('returns stored data only: no canned log, execution time, record count or fake downloads', async () => {
      addReport('r1', { createdBy: 'alice' });
      sqlite.prepare('UPDATE reports SET execution_time = 7, generation_started_at = ?, completed_at = ?, filters = ? WHERE id = ?')
        .run('2026-10-01T00:00:01.000Z', '2026-10-01T00:00:08.000Z', '{"platforms":["line"]}', 'r1');

      const details = await manager.getReportDetails('r1', generator, alice);

      expect(details?.executionTime).toBe(7);
      expect(details?.dataSource).toEqual({ filters: { platforms: ['line'] } });
      expect(details?.dataSource?.recordCount).toBeUndefined();
      expect(details?.downloadHistory).toEqual([]);
      expect(details?.generationLog).toEqual([
        '2026-10-01T00:00:00.000Z - Report requested',
        '2026-10-01T00:00:01.000Z - Generation started',
        '2026-10-01T00:00:08.000Z - Generation completed',
      ]);
      expect(JSON.stringify(details)).not.toContain('2025-09-01');
      expect(JSON.stringify(details)).not.toContain('192.168.1.100');
    });

    it('returns the real download history from report_download_history, newest first', async () => {
      addReport('r1', { createdBy: 'alice' });
      sqlite.prepare('INSERT INTO agents (id, display_name) VALUES (?, ?)').run('bob', 'Bob');
      const insert = sqlite.prepare('INSERT INTO report_download_history (id, report_id, downloaded_by, downloaded_at, ip_address) VALUES (?, ?, ?, ?, ?)');
      insert.run('d1', 'r1', 'alice', '2026-10-02T00:00:00.000Z', '10.0.0.1');
      insert.run('d2', 'r1', 'bob', '2026-10-03T00:00:00.000Z', null);

      const details = await manager.getReportDetails('r1', generator, admin);

      expect(details?.downloadHistory).toEqual([
        { downloadedAt: '2026-10-03T00:00:00.000Z', downloadedBy: 'bob', downloadedByName: 'Bob', ipAddress: undefined },
        { downloadedAt: '2026-10-02T00:00:00.000Z', downloadedBy: 'alice', downloadedByName: undefined, ipAddress: '10.0.0.1' },
      ]);
    });

    it('records the failure time and message for a failed report', async () => {
      addReport('r1', { status: 'failed' });
      sqlite.prepare('UPDATE reports SET failed_at = ?, error_message = ? WHERE id = ?').run('2026-10-01T00:00:05.000Z', 'boom', 'r1');

      const details = await manager.getReportDetails('r1', generator, admin);

      expect(details?.generationLog?.at(-1)).toBe('2026-10-01T00:00:05.000Z - Generation failed: boom');
    });

    it('hides soft-deleted reports and reports the viewer cannot see', async () => {
      addReport('deleted', { deletedAt: '2026-10-02T00:00:00.000Z' });
      addReport('theirs', { createdBy: 'bob', teamId: 2 });
      addReport('team', { createdBy: 'bob', teamId: 1 });

      expect(await manager.getReportDetails('deleted', generator, admin)).toBeNull();
      expect(await manager.getReportDetails('theirs', generator, alice)).toBeNull();
      expect(await manager.getReportDetails('theirs', generator, admin)).not.toBeNull();
      expect(await manager.getReportDetails('team', generator, alice)).not.toBeNull();
    });
  });
});
