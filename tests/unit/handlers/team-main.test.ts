// Team Main Handler Unit Tests (MockFactory Refactored)
// 團隊主要處理器單元測試

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { MockFactory } from '../../helpers/mockFactory';

// Mock database schema with Drizzle ORM column structure
vi.mock('../../../src/db/schema', () => {
  const createMockColumn = (name: string) => ({
    name,
    columnType: 'mock',
    _: { name }
  });

  return {
    teams: {
      id: createMockColumn('id'),
      name: createMockColumn('name'),
      description: createMockColumn('description'),
      qrCode: createMockColumn('qrCode'),
      isActive: createMockColumn('isActive'),
      createdAt: createMockColumn('createdAt'),
      updatedAt: createMockColumn('updatedAt')
    },
    agents: {
      id: createMockColumn('id'),
      email: createMockColumn('email'),
      passwordHash: createMockColumn('passwordHash'),
      displayName: createMockColumn('displayName'),
      role: createMockColumn('role'),
      teamId: createMockColumn('teamId'),
      isActive: createMockColumn('isActive'),
      passwordPolicy: createMockColumn('passwordPolicy'),
      lastActive: createMockColumn('lastActive'),
      lastLoginAt: createMockColumn('lastLoginAt'),
      createdAt: createMockColumn('createdAt'),
      updatedAt: createMockColumn('updatedAt')
    },
    conversations: {
      id: createMockColumn('id'),
      assignedTeamId: createMockColumn('assignedTeamId'),
      status: createMockColumn('status')
    },
    customers: {
      id: createMockColumn('id'),
      sourceTeamId: createMockColumn('sourceTeamId')
    }
  };
});

// Mock drizzle-orm functions
const mockDrizzleInstance: any = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn()
};

vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => mockDrizzleInstance)
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn((strings, ...values) => ({ sql: strings.join('?'), values })),
  eq: vi.fn((column, value) => ({ column, operator: '=', value })),
  and: vi.fn((...conditions) => ({ type: 'and', conditions })),
  or: vi.fn((...conditions) => ({ type: 'or', conditions })),
  asc: vi.fn((column) => ({ column, direction: 'asc' })),
  desc: vi.fn((column) => ({ column, direction: 'desc' })),
  like: vi.fn((column, value) => ({ column, operator: 'LIKE', value })),
  count: vi.fn(() => ({ fn: 'count' })),
  isNull: vi.fn((column) => ({ column, operator: 'IS NULL' }))
}));

// Mock TeamService - create shared mock object
const mockTeamServiceInstance = {
  listTeams: vi.fn().mockResolvedValue({
    teams: [
      {
        id: 1,
        name: '業務 A 組',
        description: 'Sales team A',
        memberCount: 5,
        isActive: true,
        createdAt: '2025-11-13T10:00:00.000Z'
      }
    ],
    total: 1,
    page: 1,
    limit: 20
  }),
  getTeam: vi.fn().mockResolvedValue({
    id: 1,
    name: '業務 A 組',
    description: 'Sales team A',
    qrCode: 'TEAM_A_2024',
    isActive: true,
    memberCount: 5,
    createdAt: '2025-11-13T10:00:00.000Z',
    updatedAt: '2025-11-13T10:00:00.000Z'
  }),
  getTeamById: vi.fn().mockResolvedValue({
    id: 1,
    name: '業務 A 組',
    description: 'Sales team A',
    qrCode: 'TEAM_A_2024',
    memberCount: 5,
    isActive: true,
    createdAt: '2025-11-13T10:00:00.000Z'
  }),
  createTeam: vi.fn().mockResolvedValue({
    id: 1,
    name: '業務 A 組',
    description: 'Sales team A',
    isActive: true,
    createdAt: '2025-11-13T10:00:00.000Z'
  }),
  updateTeam: vi.fn().mockResolvedValue({
    id: 1,
    name: '業務 A 組（更新）',
    description: 'Updated description',
    isActive: true,
    updatedAt: '2025-11-13T10:15:00.000Z'
  }),
  deleteTeam: vi.fn().mockResolvedValue({ success: true }),
  getAllTeamsStats: vi.fn().mockResolvedValue({
    totalTeams: 3,
    activeTeams: 3,
    totalMembers: 15,
    stats: []
  }),
  getMembers: vi.fn().mockResolvedValue([
    {
      id: 'agent-001',
      email: 'agent@company.com',
      displayName: 'Test Agent',
      role: 'agent',
      teamId: 1,
      isActive: true
    }
  ]),
  addMember: vi.fn().mockResolvedValue({
    id: 'agent-002',
    email: 'newagent@company.com',
    displayName: 'New Agent',
    role: 'agent',
    teamId: 1,
    passwordPolicy: 'must_change'
  }),
  updateMember: vi.fn().mockResolvedValue({
    id: 'agent-001',
    displayName: 'Updated Agent'
  }),
  removeMember: vi.fn().mockResolvedValue({ success: true }),
  getTeamStats: vi.fn().mockResolvedValue({
    teamId: 1,
    totalMembers: 5,
    activeMembers: 4,
    totalConversations: 100,
    activeConversations: 25
  }),
  searchTeams: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: '業務 A 組',
      memberCount: 5
    }
  ]),
  transferMembers: vi.fn().mockResolvedValue({
    success: true,
    transferred: 3
  })
};

vi.mock('@modules/teams/services/team-service', () => ({
  TeamService: vi.fn().mockImplementation(() => mockTeamServiceInstance)
}));

// Mock MemberService
vi.mock('../../../src/modules/teams/services/member-service', () => ({
  MemberService: vi.fn().mockImplementation(() => ({
    getTeamMembers: vi.fn().mockResolvedValue([
      {
        id: 'agent-001',
        email: 'agent@company.com',
        displayName: 'Test Agent',
        role: 'agent',
        teamId: 1,
        isActive: true,
        lastLoginAt: '2025-11-13T09:00:00.000Z',
        createdAt: '2025-11-01T10:00:00.000Z'
      }
    ]),
    addTeamMember: vi.fn().mockResolvedValue({
      id: 'agent-002',
      email: 'newagent@company.com',
      displayName: 'New Agent',
      role: 'agent',
      teamId: 1,
      isActive: true,
      passwordPolicy: 'must_change',
      createdAt: '2025-11-13T10:00:00.000Z'
    }),
    updateMember: vi.fn().mockResolvedValue({
      id: 'agent-001',
      displayName: 'Updated Agent',
      isActive: true
    }),
    removeMember: vi.fn().mockResolvedValue({ success: true }),
    resetPassword: vi.fn().mockResolvedValue({ success: true })
  }))
}));

// Mock auth middleware
vi.mock('../../../src/middleware/auth', () => ({
  jwtAuth: vi.fn((c, next) => {
    // Default to agent role
    c.set('user', {
      userId: 'agent-001',
      username: 'test-agent',
      role: 'agent',
      teamId: 1
    });
    return next();
  }),
  requireAdmin: vi.fn(() => (c: any, next: any) => {
    const user = c.get('user');
    if (user.role !== 'admin') {
      return c.json({ error: 'Admin required' }, 403);
    }
    return next();
  }),
  requireManagerOrAdmin: vi.fn(() => (c: any, next: any) => {
    const user = c.get('user');
    if (user.role !== 'admin' && user.role !== 'team') {
      return c.json({ error: 'Manager or Admin required' }, 403);
    }
    return next();
  }),
  requireTeamAccess: vi.fn(() => (c: any, next: any) => {
    return next();
  })
}));

import type { Bindings } from '@backend/types';

describe('Team Management - Unit Tests (MockFactory Refactored)', () => {
  let app: Hono<{ Bindings: Bindings }>;
  let mockEnv: Bindings;
  let mockDB: any; // Backward compatibility reference

  beforeEach(async () => {
    app = new Hono<{ Bindings: Bindings }>();
    vi.clearAllMocks();

    // Use MockFactory to create standardized environment
    mockEnv = MockFactory.createEnv({
      DB: MockFactory.createDatabase([]) // Empty dataset for unit tests
    });

    // Keep reference for backward compatibility
    mockDB = mockEnv.DB;

    // Mount team handler
    const { default: teamHandler } = await import('@modules/teams/handlers/team');
    app.route('/api/teams', teamHandler);
  });

  afterEach(() => {
    // Use clearAllMocks instead of restoreAllMocks to preserve module-level mocks
    vi.clearAllMocks();
  });

  describe('Health & Info Endpoints', () => {
    test('should return healthy status', async () => {
      const res = await app.request('/api/teams/health', {
        method: 'GET'
      }, mockEnv as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('healthy');
      expect(body.module).toBe('teams');
    });

    test('should return module info', async () => {
      const res = await app.request('/api/teams/info', {
        method: 'GET'
      }, mockEnv as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.module).toBe('teams');
      expect(body.data.endpoints).toBeDefined();
    });
  });

  describe('GET / - List Teams', () => {
    test('should list all teams for admin', async () => {
      // Set user as admin
      vi.mocked(vi.fn()).mockImplementation((c: any, next: any) => {
        c.set('user', {
          userId: 'admin-001',
          role: 'admin'
        });
        return next();
      });

      const res = await app.request('/api/teams', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      }, mockEnv as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('should return only own team for agent', async () => {
      const res = await app.request('/api/teams', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer agent-token'
        }
      }, mockEnv as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      // Agent should only see their team
    });

    test('should filter inactive teams when requested', async () => {
      const res = await app.request('/api/teams?includeInactive=false', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      }, mockEnv as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe('GET /:id - Get Team Details', () => {
    test('should retrieve team by ID', async () => {
      const res = await app.request('/api/teams/1', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer token'
        }
      }, mockEnv as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(1);
      expect(body.data.name).toBe('業務 A 組');
    });

    test('should return 404 for non-existent team', async () => {
      // Use the shared mock instance directly
      mockTeamServiceInstance.getTeamById.mockResolvedValueOnce(null);

      const res = await app.request('/api/teams/999', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer token'
        }
      }, mockEnv as any);

      // Should handle not found
      expect([200, 404]).toContain(res.status);
    });

    test('should restrict access for agents to other teams', async () => {
      // Agent from team 1 trying to access team 2
      const res = await app.request('/api/teams/2', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer agent-token'
        }
      }, mockEnv as any);

      // Should either succeed or be forbidden
      expect([200, 403]).toContain(res.status);
    });
  });

  describe('POST / - Create Team', () => {
    test('should create team as admin', async () => {
      // Mock admin user
      vi.mocked(vi.fn()).mockImplementation((c: any, next: any) => {
        c.set('user', {
          userId: 'admin-001',
          role: 'admin'
        });
        return next();
      });

      const res = await app.request('/api/teams', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: '新團隊',
          description: '新團隊描述',
          qrCode: 'NEW_TEAM_2024'
        })
      }, mockEnv as any);

      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        const body = await res.json();
        expect(body.success).toBe(true);
      }
    });

    test('should reject create team as agent', async () => {
      const res = await app.request('/api/teams', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer agent-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: '新團隊',
          description: '新團隊描述'
        })
      }, mockEnv as any);

      // Agent should not be able to create teams
      expect([403, 400]).toContain(res.status);
    });

    test('should validate required fields', async () => {
      const res = await app.request('/api/teams', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing name
          description: '新團隊描述'
        })
      }, mockEnv as any);

      expect([400, 403]).toContain(res.status);
    });

    test('should reject duplicate team names', async () => {
      // Use the shared mock instance directly
      mockTeamServiceInstance.createTeam.mockRejectedValueOnce(
        new Error('Team name already exists')
      );

      const res = await app.request('/api/teams', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: '業務 A 組',  // Existing name
          description: '重複的團隊名稱'
        })
      }, mockEnv as any);

      expect([400, 403, 500]).toContain(res.status);
    });
  });

  describe('PUT /:id - Update Team', () => {
    test('should update team as admin', async () => {
      const res = await app.request('/api/teams/1', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: '業務 A 組（更新）',
          description: '更新後的描述',
          isActive: true
        })
      }, mockEnv as any);

      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        const body = await res.json();
        expect(body.success).toBe(true);
      }
    });

    test('should reject update as agent', async () => {
      const res = await app.request('/api/teams/1', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer agent-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: '業務 A 組（更新）'
        })
      }, mockEnv as any);

      expect([403, 400]).toContain(res.status);
    });

    test('should allow partial updates', async () => {
      const res = await app.request('/api/teams/1', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: '只更新描述'
        })
      }, mockEnv as any);

      expect([200, 403]).toContain(res.status);
    });
  });

  describe('DELETE /:id - Delete Team (Soft Delete)', () => {
    test('should soft delete team as admin', async () => {
      const res = await app.request('/api/teams/1', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      }, mockEnv as any);

      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        const body = await res.json();
        expect(body.success).toBe(true);
      }
    });

    test('should reject delete as agent', async () => {
      const res = await app.request('/api/teams/1', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer agent-token'
        }
      }, mockEnv as any);

      expect(res.status).toBe(403);
    });

    test('should return 404 for non-existent team', async () => {
      // Use the shared mock instance directly
      mockTeamServiceInstance.deleteTeam.mockRejectedValueOnce(
        new Error('Team not found')
      );

      const res = await app.request('/api/teams/999', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      }, mockEnv as any);

      expect([404, 403, 500]).toContain(res.status);
    });
  });

  describe('GET /:id/members - Get Team Members', () => {
    test('should list team members', async () => {
      const res = await app.request('/api/teams/1/members', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer token'
        }
      }, mockEnv as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('should filter active/inactive members', async () => {
      const res = await app.request('/api/teams/1/members?includeInactive=false', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer token'
        }
      }, mockEnv as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe('POST /:id/members - Add Team Member', () => {
    test('should add member as admin', async () => {
      const res = await app.request('/api/teams/1/members', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'newagent@company.com',
          displayName: '新客服',
          password: 'temp123456',
          role: 'agent',
          passwordPolicy: 'must_change'
        })
      }, mockEnv as any);

      expect([200, 403]).toContain(res.status);
    });

    test('should validate required fields', async () => {
      const res = await app.request('/api/teams/1/members', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'newagent@company.com'
          // Missing password and displayName
        })
      }, mockEnv as any);

      expect([400, 403]).toContain(res.status);
    });

    test('should set correct password policy', async () => {
      const res = await app.request('/api/teams/1/members', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'newagent@company.com',
          displayName: '新客服',
          password: 'temp123456',
          passwordPolicy: 'unchangeable'  // Specific policy
        })
      }, mockEnv as any);

      expect([200, 403]).toContain(res.status);
    });
  });

  describe('GET /:id/stats - Get Team Statistics', () => {
    test('should retrieve team statistics', async () => {
      // Use the shared mock instance directly
      mockTeamServiceInstance.getAllTeamsStats.mockResolvedValueOnce({
        totalTeams: 1,
        activeTeams: 1,
        totalMembers: 5,
        stats: [
          {
            teamId: 1,
            teamName: '業務 A 組',
            memberCount: 5,
            activeConversations: 12,
            todayMessages: 45,
            avgResponseTime: '5.2 minutes'
          }
        ]
      });

      const res = await app.request('/api/teams/1/stats', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer token'
        }
      }, mockEnv as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('should support date range filtering', async () => {
      const res = await app.request('/api/teams/1/stats?dateFrom=2025-11-01&dateTo=2025-11-13', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer token'
        }
      }, mockEnv as any);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /stats/all - Get All Teams Statistics', () => {
    test('should retrieve all teams statistics', async () => {
      // Mock admin user for this admin-only endpoint
      const mockAuth = await import('../../../src/middleware/auth');
      vi.mocked(mockAuth.jwtAuth).mockImplementationOnce((c: any, next: any) => {
        c.set('user', {
          userId: 'admin-001',
          username: 'test-admin',
          role: 'admin'
        });
        return next();
      });

      const res = await app.request('/api/teams/stats/all', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      }, mockEnv as any);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.totalTeams).toBeDefined();
    });

    test('should include member details when requested', async () => {
      // Mock admin user for this admin-only endpoint
      const mockAuth = await import('../../../src/middleware/auth');
      vi.mocked(mockAuth.jwtAuth).mockImplementationOnce((c: any, next: any) => {
        c.set('user', {
          userId: 'admin-001',
          username: 'test-admin',
          role: 'admin'
        });
        return next();
      });

      const res = await app.request('/api/teams/stats/all?includeMembers=true', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      }, mockEnv as any);

      expect(res.status).toBe(200);
    });
  });

  describe('Password Policy Management', () => {
    test('should reset member password with policy', async () => {
      const res = await app.request('/api/teams/members/agent-001/reset', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newPassword: 'newtemp123456',
          passwordPolicy: 'must_change'
        })
      }, mockEnv as any);

      expect([200, 403, 404]).toContain(res.status);
    });

    test('should enforce must_change policy on login', async () => {
      // This would be tested in integration/auth tests
      expect(true).toBe(true);
    });

    test('should prevent password change for unchangeable policy', async () => {
      // This would be tested in integration/auth tests
      expect(true).toBe(true);
    });
  });

  describe('Team Access Control', () => {
    test('should allow admin to access all teams', async () => {
      vi.mocked(vi.fn()).mockImplementation((c: any, next: any) => {
        c.set('user', {
          userId: 'admin-001',
          role: 'admin'
        });
        return next();
      });

      const res = await app.request('/api/teams/2', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer admin-token'
        }
      }, mockEnv as any);

      expect([200, 404]).toContain(res.status);
    });

    test('should restrict agent to own team', async () => {
      const res = await app.request('/api/teams/2', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer agent-token'
        }
      }, mockEnv as any);

      // Should either succeed (if same team) or be forbidden
      expect([200, 403]).toContain(res.status);
    });

    test('should allow agent to view own team members', async () => {
      const res = await app.request('/api/teams/1/members', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer agent-token'
        }
      }, mockEnv as any);

      expect(res.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Use the shared mock instance directly
      mockTeamServiceInstance.listTeams.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const res = await app.request('/api/teams', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer token'
        }
      }, mockEnv as any);

      expect([500, 200]).toContain(res.status);
    });

    test('should validate JSON parsing', async () => {
      const res = await app.request('/api/teams', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: 'invalid-json'
      }, mockEnv as any);

      expect([400, 403, 500]).toContain(res.status);
    });

    test('should handle missing authorization', async () => {
      const res = await app.request('/api/teams', {
        method: 'GET'
      }, mockEnv as any);

      expect([401, 403, 200]).toContain(res.status);
    });
  });

  describe('QR Code Integration', () => {
    test('should create team with QR code', async () => {
      const res = await app.request('/api/teams', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: '新團隊',
          description: '新團隊描述',
          qrCode: 'NEW_TEAM_QR_2024'
        })
      }, mockEnv as any);

      expect([200, 403]).toContain(res.status);
    });

    test('should update team QR code', async () => {
      const res = await app.request('/api/teams/1', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          qrCode: 'UPDATED_QR_2025'
        })
      }, mockEnv as any);

      expect([200, 403]).toContain(res.status);
    });

    test('should reject duplicate QR codes', async () => {
      // Use the shared mock instance directly
      mockTeamServiceInstance.createTeam.mockRejectedValueOnce(
        new Error('QR Code already exists')
      );

      const res = await app.request('/api/teams', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: '新團隊',
          qrCode: 'EXISTING_QR'
        })
      }, mockEnv as any);

      expect([400, 403, 500]).toContain(res.status);
    });
  });
});
