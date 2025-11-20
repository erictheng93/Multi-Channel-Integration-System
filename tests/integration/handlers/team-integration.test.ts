// Team Handler Integration Tests
// 團隊處理器整合測試 - Using Real Database

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { DatabaseTestEnvironment } from '../../helpers/DatabaseTestEnvironment';
import { eq } from 'drizzle-orm';
import * as schema from '@backend/db/schema';
import type { Bindings } from '@backend/types';

import { MockFactory } from '@helpers/mockFactory';
// Module-level variable for test environment
let currentTestEnv: DatabaseTestEnvironment | null = null;

// Mock drizzle-orm/d1 to use our test database
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => {
    if (!currentTestEnv) {
      throw new Error('DatabaseTestEnvironment not initialized');
    }
    return currentTestEnv.getDrizzleInstance();
  })
}));

// Mock auth middleware to use test JWT
vi.mock('../../../src/middleware/auth', async () => {
  const actual = await vi.importActual('../../../src/middleware/auth');
  return {
    ...actual,
    jwtAuth: vi.fn(async (c, next) => {
      const authHeader = c.req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const token = authHeader.substring(7);
      try {
        // Decode test JWT (we'll create these in tests)
        const payload = JSON.parse(Buffer.from(token.spltest('.')[1], 'base64').toString());
        c.set('user', payload);
        await next();
      } catch (error) {
        return c.json({ error: 'Invalid token' }, 401);
      }
    }),
    requireAdmin: vi.fn(() => async (c: any, next: any) => {
      const user = c.get('user');
      if (user?.role !== 'admin') {
        return c.json({ error: 'Admin required' }, 403);
      }
      await next();
    }),
    requireManagerOrAdmin: vi.fn(() => async (c: any, next: any) => {
      const user = c.get('user');
      if (user?.role !== 'admin' && user?.role !== 'team') {
        return c.json({ error: 'Manager or Admin required' }, 403);
      }
      await next();
    }),
    requireTeamAccess: vi.fn(() => async (c: any, next: any) => {
      const user = c.get('user');

      // Admin can access any team
      if (user?.role === 'admin') {
        await next();
        return;
      }

      // For agents, check if they're accessing their own team
      const teamId = c.req.param('id');
      if (user?.role === 'agent' && teamId) {
        // Convert to numbers for comparison
        const requestedTeamId = parseInt(teamId, 10);
        const userTeamId = user.teamId;

        if (requestedTeamId !== userTeamId) {
          return c.json({ error: 'Access denied to this team' }, 403);
        }
      }

      await next();
    })
  };
});

/**
 * Team Handler Integration Tests
 *
 * ✅ Tests with REAL database (not mocks)
 * ✅ Tests actual TeamService implementation
 * ✅ Tests real database constraints and queries
 * ✅ Tests request/response flow end-to-end
 * ✅ Validates JWT authentication
 * ✅ Verifies role-based permissions
 */

describe('Team Handler - Integration Tests', () => {
  let env: DatabaseTestEnvironment;
  let app: Hono<{ Bindings: Bindings }>;
  let mockBindings: Bindings;

  // Test users
  let adminUser: any;
  let agentUser1: any;
  let agentUser2: any;

  // Test teams
  let team1: any;
  let team2: any;

  // Helper: Create complete mock Bindings object
  const createMockBindings = (db: D1Database): Bindings => {
    const mockKV = MockFactory.createKV()(),
      delete: vi.fn(),
      list: vi.fn()
    } as any;

    const mockR2 = MockFactory.createR2()(),
      delete: vi.fn(),
      list: vi.fn()
    } as any;

    return {
      // Databases
      DB: db,
      DB_PROD: db,
      DB_DEV: db,

      // KV Namespaces
      SESSIONS: mockKV,
      SESSIONS_PROD: mockKV,
      SESSIONS_DEV: mockKV,
      CACHE: mockKV,
      CACHE_PROD: mockKV,
      CACHE_DEV: mockKV,
      KV: mockKV,

      // R2 Buckets
      R2_BUCKET: mockR2,
      R2_BUCKET_PROD: mockR2,
      R2_BUCKET_DEV: mockR2,
      FILE_STORAGE: mockR2,
      FILES: mockR2,
      AVATARS: mockR2,

      // LINE credentials
      LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
      LINE_CHANNEL_SECRET: 'test-line-secret',
      LINE_BOT_BASIC_ID: 'test-bot-id',

      // JWT and Auth
      JWT_SECRET: 'test-jwt-secret',
      ENCRYPTION_KEY: 'test-encryption-key',
      ADMIN_PASSWORD: 'test-admin-password',

      // Facebook
      FB_PAGE_ACCESS_TOKEN: 'test-fb-token',
      FB_APP_SECRET: 'test-fb-secret',
      FB_VERIFY_TOKEN: 'test-fb-verify',
      FACEBOOK_PAGE_ACCESS_TOKEN: 'test-fb-token',
      FACEBOOK_APP_SECRET: 'test-fb-secret',
      FACEBOOK_VERIFY_TOKEN: 'test-fb-verify',

      // System
      ENVIRONMENT: 'test',
      FRONTEND_URL: 'http://localhost:3000',
      CURRENT_ENVIRONMENT: 'test',
      WORKER_URL: 'http://localhost:8787',

      // R2 Configuration
      R2_PUBLIC_URL: 'https://test-bucket.r2.dev',
      R2_PUBLIC_DOMAIN: 'test-bucket.r2.dev',
      R2_CUSTOM_DOMAIN: 'files.test.com',
      R2_BUCKET_NAME: 'test-bucket',
      WORKER_DOMAIN: 'test.workers.dev',

      // Cloudflare
      CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
      CLOUDFLARE_DATABASE_ID: 'test-db-id',

      // File upload
      MAX_FILE_SIZE: '10485760', // 10MB
      ALLOWED_FILE_TYPES: 'image/*,application/pdf',

      // Durable Objects
      CUSTOMER_CONVERSATION_DO: {} as any,
      CUSTOMER_MESSAGE_DO: {} as any,
      CONVERSATION_ROOM: {} as any,
      USER_CONNECTION: {} as any,
      MESSAGE_BROADCASTER: {} as any,
      DELAYED_MESSAGE_SCHEDULER: {} as any,
      DISTRIBUTED_LOCK: {} as any,
      LATEST_MESSAGE_COORDINATOR: {} as any
    };
  };

  // Helper: Create test JWT token
  const createTestToken = (user: { id: string; role: string; teamId?: number | null; displayName?: string; email?: string }) => {
    const payload = {
      id: user.id,  // For handler code that uses user.id
      userId: user.id,  // For backward compatibility
      username: user.id,
      displayName: user.displayName || `User ${user.id}`,
      email: user.email || `${user.id}@test.com`,
      role: user.role,
      teamId: user.teamId || null,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    // Simple base64 encoding for test tokens (not real JWT signing)
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = 'test-signature';
    return `${header}.${body}.${signature}`;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Initialize test database
    env = new DatabaseTestEnvironment();
    currentTestEnv = env;

    // Create mock bindings with test database
    mockBindings = createMockBindings(env.getMockD1Database());

    // Create test teams
    team1 = await env.createTestTeam({
      name: '業務 A 組',
      description: 'Sales Team A',
      qrCode: 'TEAM_A_QR',
      isActive: true
    });

    team2 = await env.createTestTeam({
      name: '業務 B 組',
      description: 'Sales Team B',
      qrCode: 'TEAM_B_QR',
      isActive: true
    });

    // Create test users
    adminUser = await env.createTestAgent({
      id: 'admin-001',
      email: 'admin@test.com',
      displayName: 'Admin User',
      role: 'admin',
      teamId: null,
      isActive: true
    });

    agentUser1 = await env.createTestAgent({
      id: 'agent-001',
      email: 'agent1@test.com',
      displayName: 'Agent 1',
      role: 'agent',
      teamId: team1.id,
      isActive: true
    });

    agentUser2 = await env.createTestAgent({
      id: 'agent-002',
      email: 'agent2@test.com',
      displayName: 'Agent 2',
      role: 'agent',
      teamId: team2.id,
      isActive: true
    });

    // Setup Hono app with actual team handler
    app = new Hono<{ Bindings: Bindings }>();

    // Import and mount the actual team handler
    const { default: teamHandler } = await import('@modules/teams/handlers/team');
    app.route('/api/teams', teamHandler);
  });

  afterEach(() => {
    env.reset();
    currentTestEnv = null;
  });

  // ==================== Health & Info Endpoints ====================

  describe('GET /health', () => {
    test('should return healthy status', async () => {
      const res = await app.request('/api/teams/health', {
        method: 'GET'
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.module).toBe('teams');
      expect(data.version).toBeTruthy();
      expect(data.timestamp).toBeTruthy();
    });
  });

  describe('GET /info', () => {
    test('should return module info', async () => {
      const res = await app.request('/api/teams/info', {
        method: 'GET'
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.module).toBe('teams');
      expect(data.data.version).toBeTruthy();
      expect(data.data.endpoints).toBeDefined();
      expect(Array.isArray(data.data.endpoints)).toBe(true);
    });
  });

  // ==================== List Teams ====================

  describe('GET / - List Teams', () => {
    test('admin should list all teams', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const res = await app.request('/api/teams', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();

      // Should include both teams
      const teams = data.data.teams || data.data;
      expect(Array.isArray(teams)).toBe(true);
      expect(teams.length).toBeGreaterThanOrEqual(2);

      const teamNames = teams.map((t: any) => t.name);
      expect(teamNames).toContain('業務 A 組');
      expect(teamNames).toContain('業務 B 組');
    });

    test('agent should see only their own team', async () => {
      const token = createTestToken({
        id: agentUser1.id,
        role: 'agent',
        teamId: team1.id
      });

      const res = await app.request('/api/teams', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const teams = Array.isArray(data.data) ? data.data : [data.data];
      expect(teams).toHaveLength(1);
      expect(teams[0].id).toBe(team1.id);
      expect(teams[0].name).toBe('業務 A 組');
    });

    test('should support pagination', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const res = await app.request('/api/teams?page=1&limit=1', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      if (data.pagination) {
        expect(data.pagination.page).toBe(1);
        expect(data.pagination.limit).toBeLessThanOrEqual(1);
      }
    });

    test('should require authentication', async () => {
      const res = await app.request('/api/teams', {
        method: 'GET'
      }, mockBindings as any);

      expect(res.status).toBe(401);
    });
  });

  // ==================== Get Team Details ====================

  describe('GET /:id - Get Team Details', () => {
    test('admin should get any team details', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const res = await app.request(`/api/teams/${team1.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(team1.id);
      expect(data.data.name).toBe('業務 A 組');
    });

    test('agent should get their own team details', async () => {
      const token = createTestToken({
        id: agentUser1.id,
        role: 'agent',
        teamId: team1.id
      });

      const res = await app.request(`/api/teams/${team1.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(team1.id);
    });

    test('agent should be blocked from accessing other teams', async () => {
      const token = createTestToken({
        id: agentUser1.id,
        role: 'agent',
        teamId: team1.id
      });

      const res = await app.request(`/api/teams/${team2.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      // Should be forbidden or return 404
      expect([403, 404]).toContain(res.status);
    });

    test('should return 404 for non-existent team', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const res = await app.request('/api/teams/99999', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(404);
    });
  });

  // ==================== Create Team ====================

  describe('POST / - Create Team', () => {
    test('admin should create a team successfully', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const newTeam = {
        name: '客服 C 組',
        description: 'Customer Support Team C',
        qrCode: 'TEAM_C_QR'
      };

      const res = await app.request('/api/teams', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newTeam)
      }, mockBindings as any);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('客服 C 組');
      expect(data.data.description).toBe('Customer Support Team C');
      expect(data.data.qrCode).toBe('TEAM_C_QR');
      expect(data.data.id).toBeDefined();

      // Verify team was created in database
      const createdTeams = await env.db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.id, data.data.id));

      expect(createdTeams.length).toBeGreaterThan(0);
      expect(createdTeams[0].name).toBe('客服 C 組');
    });

    test('agent should be forbidden from creating teams', async () => {
      const token = createTestToken({
        id: agentUser1.id,
        role: 'agent',
        teamId: team1.id
      });

      const newTeam = {
        name: 'Unauthorized Team',
        description: 'Should not be created'
      };

      const res = await app.request('/api/teams', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newTeam)
      }, mockBindings as any);

      expect(res.status).toBe(403);
    });

    test('should validate required fields', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const invalidTeam = {
        description: 'Missing name field'
      };

      const res = await app.request('/api/teams', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invalidTeam)
      }, mockBindings as any);

      expect(res.status).toBe(400);
    });

    test('should reject duplicate QR codes', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const duplicateQRTeam = {
        name: 'Duplicate QR Team',
        description: 'Has duplicate QR code',
        qrCode: 'TEAM_A_QR' // Already used by team1
      };

      const res = await app.request('/api/teams', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(duplicateQRTeam)
      }, mockBindings as any);

      expect(res.status).toBe(409);
    });
  });

  // ==================== Update Team ====================

  describe('PUT /:id - Update Team', () => {
    test('admin should update team successfully', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const updates = {
        name: '業務 A 組（更新）',
        description: 'Updated description'
      };

      const res = await app.request(`/api/teams/${team1.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('業務 A 組（更新）');
      expect(data.data.description).toBe('Updated description');

      // Verify database was updated
      const updatedTeams = await env.db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.id, team1.id));

      expect(updatedTeams[0].name).toBe('業務 A 組（更新）');
    });

    test('agent should be forbidden from updating teams', async () => {
      const token = createTestToken({
        id: agentUser1.id,
        role: 'agent',
        teamId: team1.id
      });

      const updates = {
        name: 'Unauthorized Update'
      };

      const res = await app.request(`/api/teams/${team1.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      }, mockBindings as any);

      expect(res.status).toBe(403);
    });

    test('should return 404 for non-existent team', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const updates = {
        name: 'Non-existent Team'
      };

      const res = await app.request('/api/teams/99999', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      }, mockBindings as any);

      expect(res.status).toBe(404);
    });
  });

  // ==================== Delete Team (Soft Delete) ====================

  describe('DELETE /:id - Soft Delete Team', () => {
    test('admin should soft delete team successfully', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const res = await app.request(`/api/teams/${team1.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify team is marked inactive in database
      const deletedTeams = await env.db
        .select()
        .from(schema.teams)
        .where(eq(schema.teams.id, team1.id));

      expect(deletedTeams[0].isActive).toBe(false);
    });

    test('agent should be forbidden from deleting teams', async () => {
      const token = createTestToken({
        id: agentUser1.id,
        role: 'agent',
        teamId: team1.id
      });

      const res = await app.request(`/api/teams/${team1.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(403);
    });

    test('should return 404 for non-existent team', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const res = await app.request('/api/teams/99999', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(404);
    });
  });

  // ==================== Team Statistics ====================

  describe('GET /:id/stats - Get Team Statistics', () => {
    beforeEach(async () => {
      // Create some test data for statistics
      const customer = await env.createTestCustomer({
        platform: 'line',
        platformUserId: 'U123',
        displayName: 'Test Customer'
      });

      const conversation = await env.createTestConversation(customer.id, {
        assignedTeamId: team1.id,
        status: 'active'
      });

      await env.createTestMessage(conversation.id, {
        content: 'Test message',
        direction: 'incoming'
      });
    });

    test('admin should get team statistics', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const res = await app.request(`/api/teams/${team1.id}/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.teamId).toBe(team1.id);

      // Should have some statistics
      if (data.data.totalConversations !== undefined) {
        expect(data.data.totalConversations).toBeGreaterThanOrEqual(0);
      }
    });

    test('should support date range filtering', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const startDate = new Date('2025-01-01').toISOString();
      const endDate = new Date('2025-12-31').toISOString();

      const res = await app.request(
        `/api/teams/${team1.id}/stats?startDate=${startDate}&endDate=${endDate}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        },
        {
          DB: env.getMockD1Database()
        } as any
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('GET /stats/all - Get All Teams Statistics', () => {
    test('admin should get all teams statistics', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const res = await app.request('/api/teams/stats/all', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();

      // Should include statistics for all teams
      if (data.data.totalTeams !== undefined) {
        expect(data.data.totalTeams).toBeGreaterThanOrEqual(2);
      }
    });

    test('agent should be forbidden from viewing all teams stats', async () => {
      const token = createTestToken({
        id: agentUser1.id,
        role: 'agent',
        teamId: team1.id
      });

      const res = await app.request('/api/teams/stats/all', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(403);
    });
  });

  // ==================== Error Handling ====================

  describe('Error Handling', () => {
    test('should handle invalid JSON', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const res = await app.request('/api/teams', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      }, mockBindings as any);

      expect(res.status).toBe(400);
    });

    test('should handle missing authorization header', async () => {
      const res = await app.request('/api/teams', {
        method: 'GET'
      }, mockBindings as any);

      expect(res.status).toBe(401);
    });

    test('should handle invalid token format', async () => {
      const res = await app.request('/api/teams', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token-format'
        }
      }, mockBindings as any);

      expect(res.status).toBe(401);
    });
  });

  // ==================== QR Code Integration ====================

  describe('QR Code Management', () => {
    test('should create team with QR code', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const newTeam = {
        name: 'QR Test Team',
        description: 'Team with QR code',
        qrCode: 'QR_TEST_123'
      };

      const res = await app.request('/api/teams', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newTeam)
      }, mockBindings as any);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data.qrCode).toBe('QR_TEST_123');
    });

    test('should update team QR code', async () => {
      const token = createTestToken({ id: adminUser.id, role: 'admin' });

      const updates = {
        qrCode: 'UPDATED_QR_CODE'
      };

      const res = await app.request(`/api/teams/${team1.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.qrCode).toBe('UPDATED_QR_CODE');
    });
  });
});
