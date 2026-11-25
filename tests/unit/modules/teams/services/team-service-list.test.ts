// TeamService.listTeams / searchTeams against a real SQLite-backed D1 double. The member counts come
// from a three-way LEFT JOIN, so they are only trustworthy when checked against real SQL: a join
// fan-out or a missing soft-delete filter would inflate them silently.

import Database from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { agents, agentTeams, conversations, teams } from '@/db/schema';
import { d1Of } from '../../../../helpers/sqlite-d1';
import { TeamService } from '@modules/teams/services/team-service';

describe('TeamService list/search (real SQL)', () => {
  let sqlite: Database.Database;
  let service: TeamService;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    for (const t of [teams, agents, agentTeams, conversations]) {
      const { name, columns } = getTableConfig(t);
      sqlite.exec(`CREATE TABLE ${name} (${columns.map((c) => `"${c.name}" ${c.getSQLType()}${c.primary ? ' PRIMARY KEY' : ''}`).join(', ')})`);
    }
    sqlite.exec(`
      INSERT INTO teams (id, name, description, is_active, created_at) VALUES
        (1, 'Support', 'front line', 1, '2026-01-01'),
        (2, 'Sales 50%', 'deals', 1, '2026-01-02'),
        (3, 'Sales 500', 'archive', 0, '2026-01-03'),
        (4, 'Billing', 'invoices', 1, '2026-01-04');
      INSERT INTO agents (id, email, display_name, role, is_active, deleted_at) VALUES
        ('a1', 'a1@x', 'A1', 'agent', 1, NULL),
        ('a2', 'a2@x', 'A2', 'agent', 0, NULL),
        ('a3', 'a3@x', 'A3', 'agent', 1, '2026-02-01');
      INSERT INTO agent_teams (id, agent_id, team_id, role_in_team, is_primary) VALUES
        (1, 'a1', 1, 'member', 1),
        (2, 'a2', 1, 'member', 1),
        (3, 'a3', 1, 'member', 1),
        (4, 'a1', 2, 'member', 0);
      INSERT INTO conversations (id, customer_id, assigned_team_id, status) VALUES
        ('c1', 1, 1, 'active'), ('c2', 2, 1, 'active'), ('c3', 3, 1, 'closed');
    `);
    service = new TeamService(d1Of(sqlite));
  });

  it('counts members once each despite the conversation join, excluding soft-deleted agents', async () => {
    const { teams: list } = await service.listTeams({});
    const support = list.find(t => t.id === 1);

    expect(support).toMatchObject({ memberCount: 2, activeMembers: 1, conversationCount: 3 });
    expect(list.find(t => t.id === 2)).toMatchObject({ memberCount: 1, activeMembers: 1, conversationCount: 0 });
  });

  it('hides inactive teams unless includeInactive is set, in total as well as the page', async () => {
    const active = await service.listTeams({});
    expect(active.teams.map(t => t.id)).toEqual([4, 2, 1]);
    expect(active.pagination.total).toBe(3);

    const all = await service.listTeams({ includeInactive: true });
    expect(all.pagination.total).toBe(4);
  });

  it('treats % in the search as a literal character, matching name or description', async () => {
    const literal = await service.listTeams({ search: '50%', includeInactive: true });
    expect(literal.teams.map(t => t.id)).toEqual([2]);

    const byDescription = await service.listTeams({ search: 'invoice' });
    expect(byDescription.teams.map(t => t.id)).toEqual([4]);
  });

  it('paginates newest first and caps the page size at 100', async () => {
    const page2 = await service.listTeams({ page: 2, limit: 2 });
    expect(page2.teams.map(t => t.id)).toEqual([1]);
    expect(page2.pagination).toMatchObject({ total: 3, totalPages: 2 });

    const capped = await service.listTeams({ limit: 500 });
    expect(capped.pagination.limit).toBe(100);
  });

  it('searchTeams returns only active teams matching name or description', async () => {
    const result = await service.searchTeams('Sales');
    expect(result.map(t => t.id)).toEqual([2]);
  });
});
