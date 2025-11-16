// Customer Handler Integration Tests
// Following proven pattern from Team and Tag handler integration tests

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '@/types';
import { DatabaseTestEnvironment } from '../../helpers/DatabaseTestEnvironment';
import * as schema from '@/db/schema';

// ========================================
// Module-level test environment
// ========================================
let currentTestEnv: DatabaseTestEnvironment | null = null;

// ========================================
// Mock drizzle-orm/d1 to use test database
// ========================================
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => {
    if (!currentTestEnv) {
      throw new Error('DatabaseTestEnvironment not initialized');
    }
    return currentTestEnv.getDrizzleInstance();
  })
}));

// ========================================
// Mock auth middleware
// ========================================
vi.mock('../../../src/middleware/auth', async () => {
  return {
    jwtAuth: vi.fn(async (c, next) => {
      const authHeader = c.req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const token = authHeader.substring(7);
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        c.set('jwtPayload', payload);
        c.set('user', payload);
        await next();
      } catch (error) {
        return c.json({ error: 'Invalid token' }, 401);
      }
    }),
    requireAdmin: vi.fn(() => async (c: any, next: any) => {
      const user = c.get('user');
      if (user?.role !== 'admin') {
        return c.json({ error: 'Admin access required' }, 403);
      }
      await next();
    }),
    requireManagerOrAdmin: vi.fn(() => async (c: any, next: any) => {
      const user = c.get('user');
      if (user?.role !== 'admin' && user?.role !== 'manager') {
        return c.json({ error: 'Manager or admin access required' }, 403);
      }
      await next();
    }),
    requireTeamAccess: vi.fn(() => async (c: any, next: any) => {
      const user = c.get('user');
      if (user?.role === 'admin') {
        await next();
        return;
      }
      const teamId = c.req.param('id');
      if (user?.role === 'agent' && teamId) {
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

// ========================================
// Test Suite
// ========================================
describe('Customer Handler - Integration Tests', () => {
  let env: DatabaseTestEnvironment;
  let app: Hono<{ Bindings: Bindings }>;
  let mockBindings: Bindings;

  // Test users
  let adminUser: any;
  let teamUser1: any;
  let teamUser2: any;

  // Test teams
  let team1: any;
  let team2: any;

  // Test customers
  let customer1: any;
  let customer2: any;
  let customer3: any;

  // Test tags
  let globalTag: any;
  let team1Tag: any;
  let team2Tag: any;

  // ========================================
  // Helper: Create mock bindings
  // ========================================
  const createMockBindings = (db: D1Database): Bindings => {
    const mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn()
    } as any;

    const mockR2 = {
      get: vi.fn(),
      put: vi.fn(),
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
      // Other services
      QUEUE: {} as any,
      DELAYED_MESSAGE_QUEUE: {} as any,
      CONVERSATION_ROOM: {} as any,
      USER_CONNECTION: {} as any,
      MESSAGE_BROADCASTER: {} as any,
      DELAYED_MESSAGE_SCHEDULER: {} as any,
      DISTRIBUTED_LOCK: {} as any,
      LATEST_MESSAGE_COORDINATOR: {} as any,
      CUSTOMER_CONVERSATION_DO: {} as any,
      CUSTOMER_MESSAGE_DO: {} as any
    };
  };

  // ========================================
  // Helper: Create test JWT token
  // ========================================
  const createTestToken = (user: {
    id: string;
    role: string;
    teamId?: number | null;
    displayName?: string;
    email?: string;
  }) => {
    const payload = {
      id: user.id,
      userId: user.id,
      username: user.id,
      displayName: user.displayName || `User ${user.id}`,
      email: user.email || `${user.id}@test.com`,
      role: user.role,
      teamId: user.teamId || null,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = 'test-signature';
    return `${header}.${body}.${signature}`;
  };

  // ========================================
  // Setup and Teardown
  // ========================================
  beforeEach(async () => {
    env = new DatabaseTestEnvironment();
    currentTestEnv = env;
    mockBindings = createMockBindings(env.getMockD1Database());

    // Create test teams
    team1 = await env.createTestTeam({
      name: 'Team A',
      description: 'Test Team A'
    });

    team2 = await env.createTestTeam({
      name: 'Team B',
      description: 'Test Team B'
    });

    // Create test users
    adminUser = await env.createTestAgent({
      email: 'admin@test.com',
      displayName: 'Admin User',
      role: 'admin',
      teamId: null
    });

    teamUser1 = await env.createTestAgent({
      email: 'team1@test.com',
      displayName: 'Team 1 User',
      role: 'agent',
      teamId: team1.id
    });

    teamUser2 = await env.createTestAgent({
      email: 'team2@test.com',
      displayName: 'Team 2 User',
      role: 'agent',
      teamId: team2.id
    });

    // Create test tags
    const [globalTagResult] = await env.db.insert(schema.tags).values({
      name: 'VIP',
      color: '#FFD700',
      description: 'VIP customers',
      teamId: null,
      isActive: true,
      createdBy: adminUser.id
    }).returning();
    globalTag = globalTagResult;

    const [team1TagResult] = await env.db.insert(schema.tags).values({
      name: 'Priority',
      color: '#FF0000',
      description: 'Priority customers for Team A',
      teamId: team1.id,
      isActive: true,
      createdBy: teamUser1.id
    }).returning();
    team1Tag = team1TagResult;

    const [team2TagResult] = await env.db.insert(schema.tags).values({
      name: 'Regular',
      color: '#0000FF',
      description: 'Regular customers for Team B',
      teamId: team2.id,
      isActive: true,
      createdBy: teamUser2.id
    }).returning();
    team2Tag = team2TagResult;

    // Create test customers
    const [customer1Result] = await env.db.insert(schema.customers).values({
      platform: 'line',
      platformUserId: 'U123456789',
      displayName: 'Test Customer 1',
      avatarUrl: 'https://example.com/avatar1.jpg',
      sourceTeamId: team1.id
    }).returning();
    customer1 = customer1Result;

    const [customer2Result] = await env.db.insert(schema.customers).values({
      platform: 'line',
      platformUserId: 'U987654321',
      displayName: 'Test Customer 2',
      email: 'customer2@example.com',
      sourceTeamId: team1.id
    }).returning();
    customer2 = customer2Result;

    const [customer3Result] = await env.db.insert(schema.customers).values({
      platform: 'facebook',
      platformUserId: 'FB123456',
      displayName: 'Test Customer 3',
      sourceTeamId: team2.id
    }).returning();
    customer3 = customer3Result;

    // Create Hono app and mount customer handler
    app = new Hono<{ Bindings: Bindings }>();
    const { default: customerHandler } = await import('../../../src/handlers/customer-main');
    app.route('/api/customers', customerHandler);
  });

  afterEach(async () => {
    env.reset();
    env.close();
    currentTestEnv = null;
  });

  // ==================== List All Customers ====================

  describe('GET / - List All Customers', () => {
    test('admin should see all customers', async () => {
      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request('/api/customers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.customers.length).toBe(3);
      expect(data.data.count).toBe(3);
    });

    test('should require authentication', async () => {
      const res = await app.request('/api/customers', {
        method: 'GET'
      }, mockBindings as any);

      expect(res.status).toBe(401);
    });
  });

  // ==================== Get Customer by ID ====================

  describe('GET /:customerId - Get Customer by ID', () => {
    test('should get customer by ID', async () => {
      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request(`/api/customers/${customer1.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.customer.id).toBe(customer1.id);
      expect(data.data.customer.displayName).toBe('Test Customer 1');
    });

    test('should return 404 for non-existent customer', async () => {
      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request('/api/customers/99999', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(404);
    });
  });

  // ==================== Get Customer by Platform ID ====================

  describe('GET /platform/:platform/:platformUserId - Get Customer by Platform ID', () => {
    test('should get customer by platform ID', async () => {
      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request('/api/customers/platform/line/U123456789', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.customer.platformUserId).toBe('U123456789');
      expect(data.data.customer.displayName).toBe('Test Customer 1');
    });

    test('should return 404 for non-existent platform customer', async () => {
      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request('/api/customers/platform/line/UNONEXISTENT', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(404);
    });
  });

  // ==================== Available Tags ====================

  describe('GET /tags/available - Get Available Tags', () => {
    test('admin should see all tags', async () => {
      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request('/api/customers/tags/available', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.length).toBeGreaterThanOrEqual(3);
    });

    test('team user should see only their team tags and global tags', async () => {
      const token = createTestToken({
        id: teamUser1.id,
        role: 'agent',
        teamId: team1.id
      });

      const res = await app.request('/api/customers/tags/available', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const tagNames = data.data.map((t: any) => t.name);
      expect(tagNames).toContain('VIP'); // Global tag
      expect(tagNames).toContain('Priority'); // Team1 tag
      expect(tagNames).not.toContain('Regular'); // Team2 tag
    });

    test('should support pagination', async () => {
      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request('/api/customers/tags/available?page=1&pageSize=2', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(2);
    });
  });

  // ==================== Customer Tags ====================

  describe('GET /:customerId/tags - Get Customer Tags', () => {
    test('should get customer tags', async () => {
      // First, assign a tag to customer
      await env.db.insert(schema.customerTags).values({
        customerId: customer1.id,
        tagId: globalTag.id,
        assignedBy: adminUser.id
      });

      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request(`/api/customers/${customer1.id}/tags`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.length).toBe(1);
      expect(data.data[0].name).toBe('VIP');
    });

    test('should return empty array for customer with no tags', async () => {
      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request(`/api/customers/${customer2.id}/tags`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.length).toBe(0);
    });

    test('should return 404 for non-existent customer', async () => {
      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request('/api/customers/99999/tags', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      expect(res.status).toBe(404);
    });
  });

  // ==================== Add Tags to Customer ====================

  describe('POST /:customerId/tags - Add Tags to Customer', () => {
    test('should add tags to customer', async () => {
      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request(`/api/customers/${customer1.id}/tags`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tagIds: [globalTag.id, team1Tag.id]
        })
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify tags were added
      const verifyRes = await app.request(`/api/customers/${customer1.id}/tags`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      const verifyData = await verifyRes.json();
      expect(verifyData.data.length).toBe(2);
    });

    test('should validate required fields', async () => {
      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request(`/api/customers/${customer1.id}/tags`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }, mockBindings as any);

      expect([400, 422]).toContain(res.status);
    });

    test('should return 404 for non-existent customer', async () => {
      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request('/api/customers/99999/tags', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tagIds: [globalTag.id]
        })
      }, mockBindings as any);

      expect(res.status).toBe(404);
    });
  });

  // ==================== Remove Tags from Customer ====================

  describe('DELETE /:customerId/tags - Remove Tags from Customer', () => {
    test('should remove tags from customer', async () => {
      // First, add tags
      await env.db.insert(schema.customerTags).values([
        {
          customerId: customer1.id,
          tagId: globalTag.id,
          assignedBy: adminUser.id
        },
        {
          customerId: customer1.id,
          tagId: team1Tag.id,
          assignedBy: adminUser.id
        }
      ]);

      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request(`/api/customers/${customer1.id}/tags`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tagIds: [globalTag.id]
        })
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify only one tag remains
      const verifyRes = await app.request(`/api/customers/${customer1.id}/tags`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      const verifyData = await verifyRes.json();
      expect(verifyData.data.length).toBe(1);
      expect(verifyData.data[0].id).toBe(team1Tag.id);
    });

    test('should return 404 for non-existent customer', async () => {
      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request('/api/customers/99999/tags', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tagIds: [globalTag.id]
        })
      }, mockBindings as any);

      expect(res.status).toBe(404);
    });
  });

  // ==================== Set Customer Tags (Replace All) ====================

  describe('PUT /:customerId/tags - Set Customer Tags', () => {
    test('should replace all customer tags', async () => {
      // First, add initial tags
      await env.db.insert(schema.customerTags).values({
        customerId: customer1.id,
        tagId: globalTag.id,
        assignedBy: adminUser.id
      });

      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request(`/api/customers/${customer1.id}/tags`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tagIds: [team1Tag.id]
        })
      }, mockBindings as any);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify only the new tag exists
      const verifyRes = await app.request(`/api/customers/${customer1.id}/tags`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      const verifyData = await verifyRes.json();
      expect(verifyData.data.length).toBe(1);
      expect(verifyData.data[0].id).toBe(team1Tag.id);
    });

    test('should handle empty tag array (remove all tags)', async () => {
      // First, add tags
      await env.db.insert(schema.customerTags).values({
        customerId: customer1.id,
        tagId: globalTag.id,
        assignedBy: adminUser.id
      });

      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request(`/api/customers/${customer1.id}/tags`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tagIds: []
        })
      }, mockBindings as any);

      expect(res.status).toBe(200);

      // Verify all tags removed
      const verifyRes = await app.request(`/api/customers/${customer1.id}/tags`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }, mockBindings as any);

      const verifyData = await verifyRes.json();
      expect(verifyData.data.length).toBe(0);
    });

    test('should return 404 for non-existent customer', async () => {
      const token = createTestToken({
        id: adminUser.id,
        role: 'admin'
      });

      const res = await app.request('/api/customers/99999/tags', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tagIds: [globalTag.id]
        })
      }, mockBindings as any);

      expect(res.status).toBe(404);
    });
  });

  // ==================== Error Handling ====================

  describe('Error Handling', () => {
    test('should handle missing authorization header', async () => {
      const res = await app.request('/api/customers', {
        method: 'GET'
      }, mockBindings as any);

      expect(res.status).toBe(401);
    });

    test('should handle invalid token format', async () => {
      const res = await app.request('/api/customers', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      }, mockBindings as any);

      expect(res.status).toBe(401);
    });
  });
});
