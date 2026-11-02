// Second layer behind blockSystemAgentTarget: each service refuses the system actor on its own, so a route
// that forgets the middleware (or a body shape it cannot read) still cannot change or delete that row.

import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';


import { MemberService } from '@/modules/teams/services/member-service';
import { AgentTeamsService } from '@/modules/teams/services/agent-teams-service';
import { TeamService } from '@/modules/teams/services/team-service';
import { AgentService } from '@/modules/agents/services/agent-crud';
import { createUser } from '@/utils/auth';
import {
  addTeamMembership, restoreField, restoreFields, restoreSoftDeleted, softDelete
} from '@/modules/activities/services/restore-helpers';

const REFUSED = 'The system account cannot be modified';

// Any query at all fails the test: the guard must fire before the database is touched.
const noDb = new Proxy({}, { get() { throw new Error('database touched'); } }) as unknown as D1Database;

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
    CREATE TABLE agents (id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, display_name TEXT, role TEXT DEFAULT 'agent',
      is_active INTEGER DEFAULT 1, password_policy TEXT DEFAULT 'changeable', last_active TEXT, last_login_at TEXT,
      created_at TEXT, updated_at TEXT, deleted_at TEXT);
    INSERT INTO agents (id, email, password_hash, display_name, role, is_active, created_at, updated_at) VALUES
      ('system', 'system@internal', 'SYSTEM_NO_LOGIN', 'System', 'agent', 0, '2026-01-01', '2026-01-01');
  `);
  return db;
}
const systemRow = (db: Database.Database) => db.prepare("SELECT role, is_active FROM agents WHERE id = 'system'").get();

describe('single-target service writes refuse the system actor before any query', () => {
  const member = new MemberService(noDb);
  const teams = new AgentTeamsService(noDb);
  const team = new TeamService(noDb);
  const crud = new AgentService(noDb as never);
  const caller = { id: 'a1', role: 'admin' };

  it.each<[string, () => Promise<unknown>]>([
    ['updateMemberStatus', () => member.updateMemberStatus('system', { isActive: true } as never, 'a1')],
    ['updateMemberRole', () => member.updateMemberRole('system', { role: 'admin' } as never, 'a1')],
    ['updateMember', () => member.updateMember('system', { displayName: 'x' } as never, 'a1')],
    ['deleteMember', () => member.deleteMember('system', 'a1')],
    ['hardDeleteMember', () => member.hardDeleteMember('system', 'a1')],
    ['updateAgent', () => crud.updateAgent('system', { displayName: 'x' } as never)],
    ['deleteAgent', () => crud.deleteAgent('system')],
    ['addAgentToTeam', () => teams.addAgentToTeam({ agentId: 'system', teamId: 1 })],
    ['addAgentToMultipleTeams', () => teams.addAgentToMultipleTeams('system', [1])],
    ['addMembersToTeam', () => teams.addMembersToTeam(1, ['a1', 'system'])],
    ['removeAgentFromTeam', () => teams.removeAgentFromTeam('system', 1)],
    ['updateAgentTeamRole', () => teams.updateAgentTeamRole('system', 1, { roleInTeam: 'lead' } as never)],
    ['setPrimaryTeam', () => teams.setPrimaryTeam('system', 1)],
    ['team addMember', () => team.addMember(1, { agentId: 'system' } as never)],
    ['team removeMember', () => team.removeMember(1, 'system', caller)],
    ['team bulkRemoveMembers', () => team.bulkRemoveMembers(1, ['a1', 'system'])],
    ['team updateMember', () => team.updateMember(1, 'system', { role: 'admin' } as never)],
    ['team transferMembers', () => team.transferMembers({ fromTeamId: 1, toTeamId: 2, agentIds: ['system'] })]
  ])('%s', async (_name, call) => {
    await expect(call()).rejects.toThrow(REFUSED);
  });
});

describe('bulk member writes treat the system actor as not found', () => {
  it('bulkHardDeleteMembers keeps the row and reports it failed', async () => {
    const db = seed();
    const result = await new MemberService(d1Over(db)).bulkHardDeleteMembers(['system'], 'a1');
    expect(result).toMatchObject({ deleted: [], deletedMembers: [], failed: [{ memberId: 'system' }] });
    expect(systemRow(db)).toEqual({ role: 'agent', is_active: 0 });
  });

  it('bulkUpdateMembers leaves the row unchanged', async () => {
    const db = seed();
    const result = await new MemberService(d1Over(db)).bulkUpdateMembers(['system'], { role: 'admin', isActive: true }, 'a1');
    expect(result).toMatchObject({ updated: [], failed: [{ memberId: 'system' }] });
    expect(systemRow(db)).toEqual({ role: 'agent', is_active: 0 });
  });
});

it('batchTransferAgents reports the system actor as an error and never touches its memberships', async () => {
  const db = {
    select: () => ({ from: () => ({ where: () => ({ get: async () => ({ id: 2 }) }) }) }),
    delete: () => { throw new Error('membership deleted'); }
  };
  const result = await new AgentService(db as never).batchTransferAgents({ agentIds: ['system'], toTeamId: 2 } as never);
  expect(result).toEqual({ success: false, errors: [{ agentId: 'system', error: REFUSED }] });
});

describe('activity restore refuses to write the system actor', () => {
  // prepare() is reached only after the guard, so the control proves the handler would otherwise build a write.
  const db = { prepare: () => ({ bind: () => 'statement' }) } as unknown as D1Database;

  it.each<[string, (id: string) => unknown]>([
    ['restoreFields(agents)', (id) => restoreFields('agents').buildMutation(db, { id, role: 'admin' })],
    ['restoreField(agents.role)', (id) => restoreField('agents', 'role').buildMutation(db, { id, role: 'admin' })],
    ['restoreSoftDeleted(agents)', (id) => restoreSoftDeleted('agents').buildMutation(db, { id })],
    ['softDelete(agents)', (id) => softDelete('agents').buildMutation(db, { id })],
    ['addTeamMembership', (id) => addTeamMembership.buildMutation(db, { agent_id: id, team_id: 1, role_in_team: 'member', is_primary: 0 })]
  ])('%s', (_name, build) => {
    expect(() => build('system')).toThrow(REFUSED);
    expect(build('a1')).toBe('statement');
  });
});

it('createUser never reactivates a soft-deleted system row with the registrant password', async () => {
  const db = seed();
  db.exec("UPDATE agents SET deleted_at = '2026-01-02' WHERE id = 'system'");
  await createUser(d1Over(db), { email: 'system@internal', password: 'Pw-123456', displayName: 'x', role: 'admin' })
    .catch(() => undefined); // the UNIQUE email then refuses the insert, which is the point
  expect(db.prepare("SELECT password_hash, role, deleted_at FROM agents WHERE id = 'system'").get())
    .toEqual({ password_hash: 'SYSTEM_NO_LOGIN', role: 'agent', deleted_at: '2026-01-02' });
});
