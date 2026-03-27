// teams/ActivityService (TeamActivityService_Legacy) Unit Tests
// Verifies that the legacy wrapper delegates correctly to the modularized service

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mock helpers so they are available inside the vi.mock() factory
// (vi.mock() is hoisted to the top of the file by Vitest)
// ---------------------------------------------------------------------------

const {
  mockLogTeamCreate,
  mockLogTeamUpdate,
  mockLogTeamDelete,
  mockLogMemberAdd,
  mockLogMemberRemove,
  mockLogQRCodeGenerate,
  mockACTIVITY_ACTIONS,
  mockRESOURCE_TYPES,
  MockTeamActivityService,
} = vi.hoisted(() => {
  const mockACTIVITY_ACTIONS = {
    TEAM_CREATE: 'team_create',
    TEAM_UPDATE: 'team_update',
    TEAM_DELETE: 'team_delete',
    MEMBER_ADD: 'member_add',
    MEMBER_REMOVE: 'member_remove',
    QR_CODE_GENERATE: 'qr_code_generate',
    TEAM_INVITE: 'team_invite',
    TEAM_MEMBER_UPDATE: 'team_member_update',
  };

  const mockRESOURCE_TYPES = {
    TEAM: 'team',
    QR_CODE: 'qr_code',
  };

  const mockLogTeamCreate = vi.fn().mockResolvedValue({ id: 'act-1', action: 'team_create' });
  const mockLogTeamUpdate = vi.fn().mockResolvedValue({ id: 'act-2', action: 'team_update' });
  const mockLogTeamDelete = vi.fn().mockResolvedValue({ id: 'act-3', action: 'team_delete' });
  const mockLogMemberAdd = vi.fn().mockResolvedValue({ id: 'act-4', action: 'member_add' });
  const mockLogMemberRemove = vi.fn().mockResolvedValue({ id: 'act-5', action: 'member_remove' });
  const mockLogQRCodeGenerate = vi.fn().mockResolvedValue({ id: 'act-6', action: 'qr_code_generate' });

  const MockTeamActivityService = vi.fn().mockImplementation(() => ({
    logTeamCreate: mockLogTeamCreate,
    logTeamUpdate: mockLogTeamUpdate,
    logTeamDelete: mockLogTeamDelete,
    logMemberAdd: mockLogMemberAdd,
    logMemberRemove: mockLogMemberRemove,
    logQRCodeGenerate: mockLogQRCodeGenerate,
  }));

  // Attach static getters to the mock constructor
  Object.defineProperty(MockTeamActivityService, 'ACTIONS', {
    get: () => mockACTIVITY_ACTIONS,
  });
  Object.defineProperty(MockTeamActivityService, 'RESOURCE_TYPES', {
    get: () => mockRESOURCE_TYPES,
  });

  return {
    mockLogTeamCreate,
    mockLogTeamUpdate,
    mockLogTeamDelete,
    mockLogMemberAdd,
    mockLogMemberRemove,
    mockLogQRCodeGenerate,
    mockACTIVITY_ACTIONS,
    mockRESOURCE_TYPES,
    MockTeamActivityService,
  };
});

vi.mock('@modules/activities', () => ({
  TeamActivityService: MockTeamActivityService,
  ACTIVITY_ACTIONS: mockACTIVITY_ACTIONS,
  RESOURCE_TYPES: mockRESOURCE_TYPES,
}));

// ---------------------------------------------------------------------------
// Import the module under test (after mocks are registered)
// ---------------------------------------------------------------------------
import { TeamActivityService_Legacy } from '@modules/teams/services/activity-service';
import { TeamActivityService, ACTIVITY_ACTIONS, RESOURCE_TYPES } from '@modules/activities';

// ---------------------------------------------------------------------------
// Mock D1Database binding
// ---------------------------------------------------------------------------
const mockDb = {} as D1Database;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TeamActivityService_Legacy', () => {
  let service: TeamActivityService_Legacy;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TeamActivityService_Legacy(mockDb);
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------
  describe('constructor', () => {
    it('creates an instance without throwing', () => {
      expect(service).toBeInstanceOf(TeamActivityService_Legacy);
    });

    it('instantiates the underlying TeamActivityService with the provided database', () => {
      expect(MockTeamActivityService).toHaveBeenCalledWith(mockDb);
    });
  });

  // -------------------------------------------------------------------------
  // logTeamCreate delegation
  // -------------------------------------------------------------------------
  describe('logTeamCreate', () => {
    it('delegates to the underlying service with correct params', async () => {
      const params = {
        userId: 'u-1',
        userName: 'Alice',
        userRole: 'admin',
        teamId: 10,
        teamName: 'Team Alpha',
        description: 'New team',
      };

      const result = await service.logTeamCreate(params);

      expect(mockLogTeamCreate).toHaveBeenCalledOnce();
      expect(mockLogTeamCreate).toHaveBeenCalledWith(params);
      expect(result).toMatchObject({ action: 'team_create' });
    });
  });

  // -------------------------------------------------------------------------
  // logTeamUpdate delegation
  // -------------------------------------------------------------------------
  describe('logTeamUpdate', () => {
    it('delegates to the underlying service with correct params', async () => {
      const params = {
        userId: 'u-1',
        userName: 'Alice',
        userRole: 'admin',
        teamId: 10,
        teamName: 'Team Alpha',
        updates: { name: 'Team Beta' },
      };

      const result = await service.logTeamUpdate(params);

      expect(mockLogTeamUpdate).toHaveBeenCalledOnce();
      expect(mockLogTeamUpdate).toHaveBeenCalledWith(params);
      expect(result).toMatchObject({ action: 'team_update' });
    });
  });

  // -------------------------------------------------------------------------
  // logTeamDelete delegation
  // -------------------------------------------------------------------------
  describe('logTeamDelete', () => {
    it('delegates to the underlying service with correct params', async () => {
      const params = {
        userId: 'u-1',
        userName: 'Alice',
        userRole: 'admin',
        teamId: 10,
        teamName: 'Team Alpha',
      };

      const result = await service.logTeamDelete(params);

      expect(mockLogTeamDelete).toHaveBeenCalledOnce();
      expect(mockLogTeamDelete).toHaveBeenCalledWith(params);
      expect(result).toMatchObject({ action: 'team_delete' });
    });
  });

  // -------------------------------------------------------------------------
  // logMemberAdd delegation
  // -------------------------------------------------------------------------
  describe('logMemberAdd', () => {
    it('delegates to the underlying service with correct params', async () => {
      const params = {
        userId: 'u-1',
        userName: 'Alice',
        userRole: 'supervisor',
        teamId: 10,
        teamName: 'Team Alpha',
        addedAgentId: 'agent-99',
        addedAgentName: 'Bob',
      };

      const result = await service.logMemberAdd(params);

      expect(mockLogMemberAdd).toHaveBeenCalledOnce();
      expect(mockLogMemberAdd).toHaveBeenCalledWith(params);
      expect(result).toMatchObject({ action: 'member_add' });
    });
  });

  // -------------------------------------------------------------------------
  // logMemberRemove delegation
  // -------------------------------------------------------------------------
  describe('logMemberRemove', () => {
    it('delegates to the underlying service with correct params', async () => {
      const params = {
        userId: 'u-1',
        userName: 'Alice',
        userRole: 'supervisor',
        teamId: 10,
        teamName: 'Team Alpha',
        removedAgentId: 'agent-99',
        removedAgentName: 'Bob',
      };

      const result = await service.logMemberRemove(params);

      expect(mockLogMemberRemove).toHaveBeenCalledOnce();
      expect(mockLogMemberRemove).toHaveBeenCalledWith(params);
      expect(result).toMatchObject({ action: 'member_remove' });
    });
  });

  // -------------------------------------------------------------------------
  // logQRCodeGenerate delegation
  // -------------------------------------------------------------------------
  describe('logQRCodeGenerate', () => {
    it('delegates to the underlying service with correct params', async () => {
      const params = {
        userId: 'u-1',
        userName: 'Alice',
        userRole: 'admin',
        teamId: 10,
        teamName: 'Team Alpha',
        campaignName: 'Summer 2026',
      };

      const result = await service.logQRCodeGenerate(params);

      expect(mockLogQRCodeGenerate).toHaveBeenCalledOnce();
      expect(mockLogQRCodeGenerate).toHaveBeenCalledWith(params);
      expect(result).toMatchObject({ action: 'qr_code_generate' });
    });

    it('works without optional campaignName', async () => {
      const params = {
        userId: 'u-1',
        userName: 'Alice',
        userRole: 'admin',
        teamId: 10,
        teamName: 'Team Alpha',
      };

      await service.logQRCodeGenerate(params);
      expect(mockLogQRCodeGenerate).toHaveBeenCalledWith(params);
    });
  });

  // -------------------------------------------------------------------------
  // Static ACTIONS getter
  // -------------------------------------------------------------------------
  describe('static ACTIONS getter', () => {
    it('returns ACTIVITY_ACTIONS from the underlying service', () => {
      const actions = TeamActivityService_Legacy.ACTIONS;
      expect(actions).toBeDefined();
      expect(actions.TEAM_CREATE).toBe('team_create');
      expect(actions.MEMBER_ADD).toBe('member_add');
    });
  });

  // -------------------------------------------------------------------------
  // Static RESOURCE_TYPES getter
  // -------------------------------------------------------------------------
  describe('static RESOURCE_TYPES getter', () => {
    it('returns RESOURCE_TYPES from the underlying service', () => {
      const resourceTypes = TeamActivityService_Legacy.RESOURCE_TYPES;
      expect(resourceTypes).toBeDefined();
      expect(resourceTypes.TEAM).toBe('team');
      expect(resourceTypes.QR_CODE).toBe('qr_code');
    });
  });
});

// ---------------------------------------------------------------------------
// Exported constants smoke tests
// ---------------------------------------------------------------------------
describe('Exported constants from @modules/activities', () => {
  it('ACTIVITY_ACTIONS is accessible and has expected keys', () => {
    expect(ACTIVITY_ACTIONS).toBeDefined();
    expect(typeof ACTIVITY_ACTIONS).toBe('object');
  });

  it('RESOURCE_TYPES is accessible and has expected keys', () => {
    expect(RESOURCE_TYPES).toBeDefined();
    expect(typeof RESOURCE_TYPES).toBe('object');
  });

  it('TeamActivityService is exported from @modules/activities', () => {
    expect(TeamActivityService).toBeDefined();
  });
});
