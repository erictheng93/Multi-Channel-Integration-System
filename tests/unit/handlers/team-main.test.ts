// 團隊管理主要處理器測試 - Integration Testing Approach
// Tests handler + service integration by mocking database layer
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '@/types';

// ✅ Mock Drizzle ORM to intercept database calls
let mockDrizzleInstance: any;
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => mockDrizzleInstance)
}));

// Mock middleware (these work fine as they're simple)
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
  requireTeamAccess: vi.fn(() => (c, next) => next()),
  requireManagerOrAdmin: vi.fn(() => (c, next) => next()),
  requireAdmin: vi.fn(() => (c, next) => next())
}));

describe('Team Main Handler - Integration Tests', () => {
  let app: Hono<{ Bindings: Bindings }>;
  let mockDB: any;
  let teamMainHandler: any;

  beforeEach(async () => {
    // Create fresh app instance
    app = new Hono<{ Bindings: Bindings }>();

    // ✅ Integration approach: Mock database, not services
    // Create a comprehensive database mock
    const createMockDBChain = (returnValue: any) => {
      const chain: any = {
        get: vi.fn().mockResolvedValue(returnValue),
        all: vi.fn().mockResolvedValue(Array.isArray(returnValue) ? returnValue : [returnValue]),
        run: vi.fn().mockResolvedValue({ success: true, changes: 1 }),
        _operationType: null  // Track what type of operation this is
      };

      chain.select = vi.fn(() => { chain._operationType = 'select'; return chain; });
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockReturnValue(chain);
      chain.groupBy = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.offset = vi.fn().mockReturnValue(chain);
      chain.insert = vi.fn(() => { chain._operationType = 'insert'; return chain; });
      chain.values = vi.fn().mockReturnValue(chain);
      chain.update = vi.fn(() => { chain._operationType = 'update'; return chain; });
      chain.set = vi.fn().mockReturnValue(chain);
      chain.delete = vi.fn(() => { chain._operationType = 'delete'; return chain; });
      chain.returning = vi.fn().mockReturnValue(chain);
      chain.leftJoin = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);

      // Make chain awaitable (Drizzle queries are directly awaitable)
      // INSERT/UPDATE/DELETE use .run(), SELECT uses .all()
      chain.then = (resolve: any, reject: any) => {
        if (chain._operationType === 'insert' || chain._operationType === 'update' || chain._operationType === 'delete') {
          return chain.run().then(resolve, reject);
        } else {
          return chain.all().then(resolve, reject);
        }
      };

      return chain;
    };

    // Default mock database
    mockDB = createMockDBChain(null);
    mockDrizzleInstance = mockDB; // Connect Drizzle mock to DB chain

    // Setup environment with mocked database
    app.use('*', (c, next) => {
      c.env = {
        DB: mockDB as any,
        JWT_SECRET: 'test-secret',
        SESSIONS: {
          get: vi.fn().mockResolvedValue(null),
          put: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined)
        } as any
      } as any;
      return next();
    });

    // Dynamic import handler after environment is set up
    const handlerModule = await import('@modules/teams/handlers/team');
    teamMainHandler = handlerModule.default;

    // Mount handler
    app.route('/api/teams', teamMainHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /', () => {
    it('should return all teams for admin', async () => {
      // Service expects { team: {...}, memberCount: number } structure from join query
      const mockTeamListQuery = [
        { team: { id: 1, name: 'Team 1', description: 'Test team 1', isActive: true, createdAt: new Date().toISOString() }, memberCount: 5 },
        { team: { id: 2, name: 'Team 2', description: 'Test team 2', isActive: true, createdAt: new Date().toISOString() }, memberCount: 3 }
      ];

      // Mock DB queries in order:
      // 1. Main query with join (returns team list)
      mockDB.all.mockResolvedValueOnce(mockTeamListQuery);

      // 2. Total count query
      mockDB.all.mockResolvedValueOnce([{ total: 2 }]);

      // 3. Active members count for team 1
      mockDB.all.mockResolvedValueOnce([{ activeMembers: 5 }]);

      // 4. Conversation count for team 1
      mockDB.all.mockResolvedValueOnce([{ conversationCount: 10 }]);

      // 5. Active members count for team 2
      mockDB.all.mockResolvedValueOnce([{ activeMembers: 3 }]);

      // 6. Conversation count for team 2
      mockDB.all.mockResolvedValueOnce([{ conversationCount: 8 }]);

      const response = await app.request('/api/teams');

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.teams).toBeDefined();
      expect(result.teams.length).toBe(2);
    });

    it.skip('should return only user team for non-admin', async () => {
      // TODO: Requires middleware context mocking
      const mockTeam = { id: 1, name: 'User Team', description: 'User team', isActive: true };
      mockDB.get.mockResolvedValue(mockTeam);

      const response = await app.request('/api/teams');
      expect(response.status).toBe(200);
    });
  });

  describe('POST /', () => {
    it('should successfully create team', async () => {
      const newTeamData = {
        name: 'New Team',
        description: 'A new test team'
      };

      const mockCreatedTeam = {
        id: 3,
        name: 'New Team',
        description: 'A new test team',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Mock DB: Service does INSERT then SELECT to get created team
      // 1. Insert (no return value needed, just success)
      mockDB.run.mockResolvedValueOnce({ success: true, changes: 1 });

      // 2. Select query to retrieve created team (returns array)
      mockDB.all.mockResolvedValueOnce([mockCreatedTeam]);

      const response = await app.request('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTeamData)
      });

      expect(response.status).toBe(201);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('New Team');
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
        description: 'Test team description',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // getTeam makes multiple queries:
      // 1. Select team by ID
      mockDB.all.mockResolvedValueOnce([mockTeam]);

      // 2. Get member count
      mockDB.all.mockResolvedValueOnce([{ memberCount: 5 }]);

      // 3. Get active members count
      mockDB.all.mockResolvedValueOnce([{ activeMembers: 3 }]);

      // 4. Get conversation count
      mockDB.all.mockResolvedValueOnce([{ conversationCount: 10 }]);

      const response = await app.request('/api/teams/1');

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(1);
      expect(result.data.name).toBe('Test Team');
    });
  });

  describe('PUT /:id', () => {
    it('should successfully update team', async () => {
      const updateData = { name: 'Updated Team Name' };

      const mockUpdatedTeam = {
        id: 1,
        name: 'Updated Team Name',
        description: 'Original description',
        isActive: true,
        updatedAt: new Date().toISOString()
      };

      // updateTeam: UPDATE then SELECT
      // 1. Update operation
      mockDB.run.mockResolvedValueOnce({ success: true, changes: 1 });

      // 2. Select updated team
      mockDB.all.mockResolvedValueOnce([mockUpdatedTeam]);

      const response = await app.request('/api/teams/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Updated Team Name');
    });
  });

  describe('DELETE /:id', () => {
    it('should successfully delete team', async () => {
      const mockTeam = {
        id: 1,
        name: 'Test Team',
        description: 'Test description',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Handler calls getTeam first to verify team exists
      // getTeam queries:
      // 1. Select team by ID
      mockDB.all.mockResolvedValueOnce([mockTeam]);

      // 2. Get member count
      mockDB.all.mockResolvedValueOnce([{ memberCount: 0 }]);

      // 3. Get active members count
      mockDB.all.mockResolvedValueOnce([{ activeMembers: 0 }]);

      // 4. Get conversation count
      mockDB.all.mockResolvedValueOnce([{ conversationCount: 0 }]);

      // 5. Delete operation
      mockDB.run.mockResolvedValueOnce({ success: true, changes: 1 });

      const response = await app.request('/api/teams/1', {
        method: 'DELETE'
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Team deleted successfully');
    });
  });

  describe('GET /:id/members', () => {
    it('should return team members', async () => {
      const mockMembers = [
        { id: 'user-1', username: 'user1', displayName: 'User 1', role: 'agent', teamId: 1 },
        { id: 'user-2', username: 'user2', displayName: 'User 2', role: 'agent', teamId: 1 }
      ];

      mockDB.all.mockResolvedValue(mockMembers);

      const response = await app.request('/api/teams/1/members');

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.length).toBe(2);
    });
  });

  describe('GET /:id/stats', () => {
    it('should return team statistics', async () => {
      const mockMemberCount = { count: 5 };
      const mockConversationStats = [
        { status: 'active', count: 12 },
        { status: 'closed', count: 45 }
      ];

      // Mock multiple DB calls for stats
      mockDB.get
        .mockResolvedValueOnce(mockMemberCount)  // Member count
        .mockResolvedValueOnce({ count: 12 })    // Active conversations
        .mockResolvedValueOnce({ count: 45 });   // Closed conversations

      mockDB.all.mockResolvedValue(mockConversationStats);

      const response = await app.request('/api/teams/1/stats');

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('POST /:id/qr-code', () => {
    it('should generate team QR code', async () => {
      const mockQRCode = {
        id: 'qr-123',
        token: 'abc123',
        teamId: 1,
        campaignName: 'Test Campaign',
        qrCodeUrl: 'https://example.com/qr/abc123',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        isActive: true,
        createdAt: new Date().toISOString()
      };

      mockDB.returning.mockResolvedValue([mockQRCode]);
      mockDB.get.mockResolvedValue(mockQRCode);

      const response = await app.request('/api/teams/1/qr-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: 'Test Campaign',
          maxUses: 10
        })
      });

      expect(response.status).toBe(201);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('GET /:id/qr-codes', () => {
    it('should return team QR codes', async () => {
      const mockQRCodes = [
        { id: 'qr-1', token: 'abc123', campaignName: 'Campaign 1', isActive: true, teamId: 1 },
        { id: 'qr-2', token: 'def456', campaignName: 'Campaign 2', isActive: false, teamId: 1 }
      ];

      mockDB.all.mockResolvedValue(mockQRCodes);

      const response = await app.request('/api/teams/1/qr-codes');

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.length).toBe(2);
    });
  });
});
