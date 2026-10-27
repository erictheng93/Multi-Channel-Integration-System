import { beforeEach, describe, expect, test, vi } from 'vitest';

const getMock = vi.fn();

const drizzleMock = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        get: getMock,
        all: vi.fn(async () => [{ teamId: 7 }, { teamId: 9 }]),
      })),
    })),
  })),
};

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => drizzleMock),
}));

vi.mock('@modules/teams/services/agent-teams-service', () => ({
  getPrimaryTeamId: vi.fn().mockResolvedValue(7),
}));

import { PermissionService } from '@backend/services/permission-service';

describe('PermissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('preserves text agent ids when loading user permission data', async () => {
    const agentId = 'bd70d6d4-ab10-42ee-86a6-2e4dfaaafd3c';
    getMock.mockResolvedValue({
      id: agentId,
      role: 'admin',
      isActive: true,
    });

    const user = await (PermissionService as unknown as {
      getUserWithTeam(userId: string, db: D1Database): Promise<{ id: string | number } | null>;
    }).getUserWithTeam(agentId, {} as D1Database);

    expect(user?.id).toBe(agentId);
  });

  describe('conversation access follows every team, not just the primary one', () => {
    const asAgent = (primaryTeamId: number, teamIds: number[]) =>
      vi.spyOn(PermissionService as unknown as { getUserWithTeam: () => Promise<unknown> }, 'getUserWithTeam')
        .mockResolvedValue({ id: 'agent-x', role: 'agent', primaryTeamId, teamIds, isActive: true });
    const canView = (assignedTeamId: number | null) => {
      getMock.mockResolvedValueOnce({ assignedTeamId });
      return PermissionService.checkPermission('agent-x', 'conversation', 'view',
        { userId: 1, role: 'agent', resourceId: 'conv-1' }, {} as D1Database);
    };

    test('an agent with no primary team can open their own team conversation', async () => {
      asAgent(0, [4]);
      expect(await canView(4)).toBe(true);
    });

    test('a multi-team agent can open a conversation of a non-primary team', async () => {
      asAgent(2, [2, 4]);
      expect(await canView(4)).toBe(true);
    });

    test('another team stays refused and the unassigned pool stays open', async () => {
      asAgent(0, [4]);
      expect(await canView(3)).toBe(false);
      expect(await canView(null)).toBe(true);
    });

    test('team-scoped actions accept any of the agent teams', async () => {
      asAgent(0, [4]);
      expect(await PermissionService.checkPermission('agent-x', 'tag', 'add', { teamId: 4 }, {} as D1Database)).toBe(true);
      expect(await PermissionService.checkPermission('agent-x', 'tag', 'add', { teamId: 3 }, {} as D1Database)).toBe(false);
    });

    test('loads every team membership from agent_teams', async () => {
      vi.restoreAllMocks();
      getMock.mockResolvedValueOnce({ id: 'agent-x', role: 'agent', isActive: true });
      const user = await (PermissionService as unknown as {
        getUserWithTeam(userId: string, db: D1Database): Promise<{ teamIds: number[] } | null>;
      }).getUserWithTeam('agent-x', {} as D1Database);
      expect(user?.teamIds).toEqual([7, 9]);
    });
  });
});
