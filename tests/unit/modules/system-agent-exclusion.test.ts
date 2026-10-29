import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { MemberService } from '@/modules/teams/services/member-service';
import { ActivityStatsService } from '@/modules/activities/services/ActivityStatsService';
import { notSystemAgentSql } from '@/constants/system-agent';

// Just enough of D1 over SQLite for drizzle's d1 driver (prepare/bind/all/raw/run).
function d1Over(sqlite: Database.Database): D1Database {
  const statement = (query: string, params: unknown[] = []) => {
    const stmt = sqlite.prepare(query);
    const reads = stmt.reader;
    return {
      bind: (...next: unknown[]) => statement(query, next),
      all: async () => ({ success: true, results: reads ? stmt.all(...params) : (stmt.run(...params), []), meta: {} }),
      raw: async () => (reads ? stmt.raw().all(...params) : (stmt.run(...params), [])),
      run: async () => { const info = stmt.run(...params); return { success: true, results: [], meta: { changes: info.changes } }; },
      first: async () => (reads ? stmt.get(...params) ?? null : null)
    };
  };
  return { prepare: (q: string) => statement(q), batch: async () => [] } as unknown as D1Database;
}

function seed(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE agents (id TEXT PRIMARY KEY, email TEXT, password_hash TEXT, display_name TEXT, role TEXT DEFAULT 'agent',
      is_active INTEGER DEFAULT 1, password_policy TEXT DEFAULT 'changeable', last_active TEXT, last_login_at TEXT,
      created_at TEXT, updated_at TEXT, deleted_at TEXT);
    CREATE TABLE agent_teams (id INTEGER PRIMARY KEY, agent_id TEXT, team_id INTEGER, role_in_team TEXT, is_primary INTEGER, joined_at TEXT, created_at TEXT);
    CREATE TABLE activities (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, user_name TEXT NOT NULL, user_role TEXT NOT NULL,
      action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT, details TEXT, ip_address TEXT, user_agent TEXT, created_at TEXT);
    INSERT INTO agents (id, email, password_hash, display_name, role, is_active, created_at, updated_at) VALUES
      ('system', 'system@internal', 'SYSTEM_NO_LOGIN', 'System', 'agent', 0, '2026-01-01', '2026-01-01'),
      ('a1', 'a1@x.com', 'h', 'Alice', 'agent', 1, '2026-02-01', '2026-02-01'),
      ('a2', 'a2@x.com', 'h', 'Bob', 'admin', 1, '2026-03-01', '2026-03-01');
  `);
  const now = new Date().toISOString();
  const add = db.prepare('INSERT INTO activities (user_id, user_name, user_role, action, resource_type, created_at) VALUES (?,?,?,?,?,?)');
  add.run('system', '系統', 'system', 'conversation_auto_close', 'conversation', now);
  add.run('system', '系統', 'system', 'conversation_auto_close', 'conversation', now);
  add.run('a1', 'Alice', 'agent', 'conversation_close', 'conversation', now);
  return db;
}

describe('the system actor is not a member', () => {
  it('is excluded from the member list, the total and a direct lookup', async () => {
    const service = new MemberService(d1Over(seed()));
    const list = await service.listMembers({ page: 1, limit: 50 } as never);
    expect(list.members.map(m => m.id).sort()).toEqual(['a1', 'a2']);
    expect(list.total).toBe(2);
    expect(await service.getMember('system')).toBeNull();
    expect((await service.listMembers({ page: 1, limit: 50, search: 'system' } as never)).members).toEqual([]);
  });

  it('is excluded from the activity overview user count and top users, but its rows still exist', async () => {
    const db = seed();
    const overview = await new ActivityStatsService(d1Over(db)).getOverview(7);
    expect(overview.activeUserCount).toBe(1);
    expect(overview.topUsers.map(u => u.userName)).toEqual(['Alice']);
    expect(overview.totalActivities).toBe(3);
    expect(db.prepare("SELECT COUNT(*) AS n FROM activities WHERE user_id = 'system'").get()).toEqual({ n: 2 });
  });

  it('the raw predicate drops it from member counts', () => {
    const row = seed().prepare(`SELECT COUNT(*) AS n FROM agents WHERE deleted_at IS NULL AND ${notSystemAgentSql('id')}`).get();
    expect(row).toEqual({ n: 2 });
  });
});
