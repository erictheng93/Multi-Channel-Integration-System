import { beforeEach, describe, expect, test, vi } from 'vitest';

const getMock = vi.fn();

const drizzleMock = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        get: getMock,
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
});
