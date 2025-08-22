// 團隊管理主要處理器測試 - Handler-based 架構
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import teamMainHandler from '../../../src/handlers/team-main';
import { setupHandlerTest } from '../../helpers/handler-test-setup';

// Mock utilities
vi.mock('../../../src/utils/team', () => ({
  createTeam: vi.fn(),
  getAllTeams: vi.fn(),
  getTeamById: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  getTeamMembers: vi.fn(),
  getTeamStats: vi.fn()
}));

vi.mock('../../../src/services/qrcode-service', () => ({
  QRCodeService: {
    generateTeamQRCode: vi.fn(),
    getTeamQRCodes: vi.fn()
  }
}));

// Mock middleware
vi.mock('../../../src/middleware/auth', () => ({
  jwtAuth: vi.fn((c, next) => {
    c.set('user', { 
      id: 'user-123', 
      role: 'admin',
      username: 'admin-user',
      teamId: 1
    });
    return next();
  }),
  requireRole: vi.fn(() => (c, next) => next()),
  requireTeamAccess: vi.fn(() => (c, next) => next())
}));

describe('Team Main Handler', () => {
  let app: any;
  let mockTeamUtils: any;
  let mockQRCodeService: any;

  beforeEach(async () => {
    const testSetup = setupHandlerTest();
    app = testSetup.app;
    
    // Add the team handler routes after setting up the environment
    app.route('/api/teams', teamMainHandler);

    // Setup mocks
    const teamModule = await import('../../../src/utils/team');
    const qrModule = await import('../../../src/services/qrcode-service');
    
    mockTeamUtils = {
      createTeam: teamModule.createTeam as any,
      getAllTeams: teamModule.getAllTeams as any,
      getTeamById: teamModule.getTeamById as any,
      updateTeam: teamModule.updateTeam as any,
      deleteTeam: teamModule.deleteTeam as any,
      getTeamMembers: teamModule.getTeamMembers as any,
      getTeamStats: teamModule.getTeamStats as any
    };

    mockQRCodeService = qrModule.QRCodeService;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /', () => {
    it('should return all teams for admin', async () => {
      const mockTeams = [
        { id: 1, name: 'Team 1', description: 'Test team 1' },
        { id: 2, name: 'Team 2', description: 'Test team 2' }
      ];

      mockTeamUtils.getAllTeams.mockResolvedValue(mockTeams);

      const response = await app.request('/api/teams');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTeams);

      expect(mockTeamUtils.getAllTeams).toHaveBeenCalledWith(
        expect.any(Object),
        false
      );
    });

    it.skip('should return only user team for non-admin', async () => {
      // TODO: Fix this test - middleware mocking issue
      // This test needs to be fixed to properly mock the user context
      const mockTeam = { id: 1, name: 'User Team', description: 'User team' };
      mockTeamUtils.getTeamById.mockResolvedValue(mockTeam);

      const response = await app.request('/api/teams');
      expect(response.status).toBe(200);
    });
  });

  describe('POST /', () => {
    const validTeamRequest = {
      name: 'New Team',
      description: 'A new test team'
    };

    it('should successfully create team', async () => {
      const mockNewTeam = {
        id: 3,
        name: 'New Team',
        description: 'A new test team',
        isActive: true
      };

      mockTeamUtils.createTeam.mockResolvedValue(mockNewTeam);

      const response = await app.request('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validTeamRequest)
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockNewTeam);

      expect(mockTeamUtils.createTeam).toHaveBeenCalledWith(
        expect.any(Object),
        {
          name: 'New Team',
          description: 'A new test team',
          isActive: true
        }
      );
    });

    it('should require team name', async () => {
      const response = await app.request('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'No name' })
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.error).toBe('Team name is required');
    });
  });

  describe('GET /:id', () => {
    it('should return team details', async () => {
      const mockTeam = {
        id: 1,
        name: 'Test Team',
        description: 'Test team description'
      };

      mockTeamUtils.getTeamById.mockResolvedValue(mockTeam);

      const response = await app.request('/api/teams/1');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTeam);

      expect(mockTeamUtils.getTeamById).toHaveBeenCalledWith(
        expect.any(Object),
        1
      );
    });
  });

  describe('PUT /:id', () => {
    it('should successfully update team', async () => {
      const updateData = { name: 'Updated Team Name' };
      const mockUpdatedTeam = {
        id: 1,
        name: 'Updated Team Name',
        description: 'Original description'
      };

      mockTeamUtils.updateTeam.mockResolvedValue(mockUpdatedTeam);

      const response = await app.request('/api/teams/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedTeam);

      expect(mockTeamUtils.updateTeam).toHaveBeenCalledWith(
        expect.any(Object),
        1,
        updateData
      );
    });
  });

  describe('DELETE /:id', () => {
    it('should successfully delete team', async () => {
      mockTeamUtils.deleteTeam.mockResolvedValue(undefined);

      const response = await app.request('/api/teams/1', {
        method: 'DELETE'
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Team deleted successfully');

      expect(mockTeamUtils.deleteTeam).toHaveBeenCalledWith(
        expect.any(Object),
        1
      );
    });
  });

  describe('GET /:id/members', () => {
    it('should return team members', async () => {
      const mockMembers = [
        { id: 'user-1', name: 'User 1', role: 'agent' },
        { id: 'user-2', name: 'User 2', role: 'agent' }
      ];

      mockTeamUtils.getTeamMembers.mockResolvedValue(mockMembers);

      const response = await app.request('/api/teams/1/members');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMembers);

      expect(mockTeamUtils.getTeamMembers).toHaveBeenCalledWith(
        expect.any(Object),
        1
      );
    });
  });

  describe('GET /:id/stats', () => {
    it('should return team statistics', async () => {
      const mockStats = {
        totalMembers: 5,
        activeConversations: 12,
        completedConversations: 45
      };

      mockTeamUtils.getTeamStats.mockResolvedValue(mockStats);

      const response = await app.request('/api/teams/1/stats');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStats);

      expect(mockTeamUtils.getTeamStats).toHaveBeenCalledWith(
        expect.any(Object),
        1
      );
    });
  });

  describe('POST /:id/qr-code', () => {
    it('should generate team QR code', async () => {
      const mockQRInfo = {
        qrCodeUrl: 'https://example.com/qr/abc123',
        token: 'abc123',
        expiresAt: '2025-02-01T00:00:00Z'
      };

      mockQRCodeService.generateTeamQRCode.mockResolvedValue(mockQRInfo);

      const response = await app.request('/api/teams/1/qr-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: 'Test Campaign',
          maxUses: 10
        })
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockQRInfo);

      expect(mockQRCodeService.generateTeamQRCode).toHaveBeenCalledWith({
        teamId: 1,
        campaignName: 'Test Campaign',
        expiresAt: expect.any(Date),
        maxUses: 10
      });
    });
  });

  describe('GET /:id/qr-codes', () => {
    it('should return team QR codes', async () => {
      const mockQRCodes = [
        { token: 'abc123', campaignName: 'Campaign 1', isActive: true },
        { token: 'def456', campaignName: 'Campaign 2', isActive: false }
      ];

      mockQRCodeService.getTeamQRCodes.mockResolvedValue(mockQRCodes);

      const response = await app.request('/api/teams/1/qr-codes');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockQRCodes);

      expect(mockQRCodeService.getTeamQRCodes).toHaveBeenCalledWith(1);
    });
  });
});