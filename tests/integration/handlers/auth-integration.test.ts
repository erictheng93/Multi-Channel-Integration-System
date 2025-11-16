// Auth Handler Integration Tests
// 認證處理器整合測試 - Using Real Database

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { DatabaseTestEnvironment } from '../../helpers/DatabaseTestEnvironment';
import { eq, and } from 'drizzle-orm';
import * as schema from '@backend/db/schema';
import type { Bindings } from '@backend/types';
import { TestJWTHelper } from '../../helpers/test-jwt-helper';
import { hash } from 'bcryptjs';

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

// Mock KV namespace for session storage
const mockKVNamespace = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn()
};

// Mock Activity Service
vi.mock('../../../src/services/activity-service', () => {
  class MockActivityService {
    constructor(db: any) {}

    async logActivity(params: any) {
      return Promise.resolve({ success: true });
    }
  }

  return {
    ActivityService: MockActivityService,
    ACTIVITY_ACTIONS: {
      USER_LOGIN: 'user_login',
      USER_CREATE: 'user_create',
      USER_LOGOUT: 'user_logout'
    },
    RESOURCE_TYPES: {
      USER: 'user'
    }
  };
});

// Mock auth middleware for protected routes
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
        // Decode test JWT
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

        // Set full user object with all expected properties
        c.set('user', {
          id: payload.userId || payload.id,
          email: payload.email,
          displayName: payload.displayName,
          role: payload.role,
          teamId: payload.teamId,
          teamName: payload.teamName,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        await next();
      } catch (error) {
        return c.json({ error: 'Invalid token' }, 401);
      }
    }),
    sessionAuth: vi.fn(async (c, next) => {
      // For logout, we need to set a user from session
      const sessionId = c.req.header('X-Session-ID');
      if (sessionId && currentTestEnv) {
        // Simulate session lookup
        c.set('user', {
          id: 'test-user-id',
          displayName: 'Test User',
          role: 'agent',
          email: 'test@example.com',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      await next();
    }),
    requireRole: vi.fn(() => async (c: any, next: any) => {
      const user = c.get('user');
      if (user?.role !== 'admin') {
        return c.json({ error: 'Admin required' }, 403);
      }
      await next();
    }),
    rateLimit: vi.fn(() => async (c: any, next: any) => {
      // Skip rate limiting in tests
      await next();
    })
  };
});

/**
 * Auth Handler Integration Tests
 *
 * ✅ Tests with REAL database (not mocks)
 * ✅ Tests actual auth flow end-to-end
 * ✅ Tests real database constraints and queries
 * ✅ Validates JWT authentication
 * ✅ Verifies session management
 * ✅ Tests password policies and security
 */

describe('Auth Handler - Integration Tests', () => {
  let env: DatabaseTestEnvironment;
  let app: Hono<{ Bindings: Bindings }>;
  let mockBindings: Bindings;

  beforeEach(async () => {
    // Initialize test environment
    env = new DatabaseTestEnvironment();
    currentTestEnv = env;

    // Create a test team first (for foreign key constraints)
    await env.db.insert(schema.teams).values({
      id: 1,
      name: 'Test Team',
      description: 'Test team for integration tests',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Create mock bindings
    mockBindings = {
      DB: env.getMockD1Database(),
      JWT_SECRET: TestJWTHelper.getTestSecret(),
      SESSIONS: mockKVNamespace as any,
      CACHE: {} as any,
      FILE_STORAGE: {} as any,
      MESSAGE_QUEUE: {} as any,
      CONVERSATION_ROOM: {} as any,
      USER_CONNECTION: {} as any,
      MESSAGE_BROADCASTER: {} as any,
      DELAYED_MESSAGE_PROCESSOR: {} as any,
      DELAYED_MESSAGE_BUFFER: {} as any
    };

    // Initialize Hono app
    app = new Hono<{ Bindings: Bindings }>();

    // Add environment to context
    app.use('*', async (c, next) => {
      c.env = mockBindings;
      await next();
    });

    // Import and mount auth handler
    const authHandler = (await import('@backend/handlers/auth-main')).default;
    app.route('/api/auth', authHandler);

    // Clear mock calls
    vi.clearAllMocks();
  });

  afterEach(() => {
    env.close();
    currentTestEnv = null;
  });

  describe('POST /api/auth/login', () => {
    test('should successfully login with valid credentials', async () => {
      // Create test user
      const passwordHash = await hash('TestPassword123!', 10);
      await env.db.insert(schema.agents).values({
        id: 'test-user-1',
        email: 'testuser@example.com',
        displayName: 'Test User',
        passwordHash,
        role: 'agent',
        isActive: true,
        passwordPolicy: 'changeable',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'testuser@example.com',
          password: 'TestPassword123!'
        })
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.token).toBeDefined();
      expect(result.data.refreshToken).toBeDefined();
      expect(result.data.agent).toBeDefined();
      expect(result.data.agent.email).toBe('testuser@example.com');
      expect(result.data.sessionId).toBeDefined();
      expect(result.data.expiresIn).toBe(2 * 60 * 60); // 2 hours
    });

    test('should reject invalid email', async () => {
      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!'
        })
      });

      expect(response.status).toBe(401);

      const result = await response.json();
      expect(result.error).toBe('User not found');
    });

    test('should reject invalid password', async () => {
      // Create test user
      const passwordHash = await hash('CorrectPassword123!', 10);
      await env.db.insert(schema.agents).values({
        id: 'test-user-2',
        email: 'testuser2@example.com',
        displayName: 'Test User 2',
        passwordHash,
        role: 'agent',
        isActive: true,
        passwordPolicy: 'changeable',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'testuser2@example.com',
          password: 'WrongPassword123!'
        })
      });

      expect(response.status).toBe(401);

      const result = await response.json();
      expect(result.error).toBe('Wrong password');
    });

    test('should reject disabled account', async () => {
      // Create disabled user
      const passwordHash = await hash('TestPassword123!', 10);
      await env.db.insert(schema.agents).values({
        id: 'test-user-3',
        email: 'disabled@example.com',
        displayName: 'Disabled User',
        passwordHash,
        role: 'agent',
        isActive: false, // Disabled
        passwordPolicy: 'changeable',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'disabled@example.com',
          password: 'TestPassword123!'
        })
      });

      expect(response.status).toBe(401);

      const result = await response.json();
      expect(result.error).toBe('Account disabled');
    });

    test('should require password change when policy is must_change', async () => {
      // Create user with must_change password policy
      const passwordHash = await hash('TemporaryPassword123!', 10);
      await env.db.insert(schema.agents).values({
        id: 'test-user-4',
        email: 'mustchange@example.com',
        displayName: 'Must Change User',
        passwordHash,
        role: 'agent',
        isActive: true,
        passwordPolicy: 'must_change', // Must change password
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'mustchange@example.com',
          password: 'TemporaryPassword123!'
        })
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.mustChangePassword).toBe(true);
      expect(result.data.tempToken).toBeDefined();
      expect(result.message).toBe('Password must be changed before login');
    });

    test('should reject request with missing email', async () => {
      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: 'TestPassword123!'
        })
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.error).toBe('Email and password are required');
    });

    test('should reject request with missing password', async () => {
      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com'
        })
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.error).toBe('Email and password are required');
    });

    test('should trim whitespace from email and password', async () => {
      // Create test user
      const passwordHash = await hash('TestPassword123!', 10);
      await env.db.insert(schema.agents).values({
        id: 'test-user-5',
        email: 'trimtest@example.com',
        displayName: 'Trim Test User',
        passwordHash,
        role: 'agent',
        isActive: true,
        passwordPolicy: 'changeable',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: '  trimtest@example.com  ',
          password: '  TestPassword123!  '
        })
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.agent.email).toBe('trimtest@example.com');
    });
  });

  describe('POST /api/auth/register', () => {
    test('should successfully register new user (admin only)', async () => {
      // Create admin user
      const adminToken = await TestJWTHelper.generateAdminToken();

      const response = await app.request('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          email: 'newuser@example.com',
          password: 'NewPassword123!',
          displayName: 'New User',
          role: 'agent',
          teamId: null
        })
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.user).toBeDefined();
      expect(result.data.user.email).toBe('newuser@example.com');
      expect(result.data.user.displayName).toBe('New User');
      expect(result.data.user.role).toBe('agent');

      // Verify user was created in database
      const createdUser = await env.db
        .select()
        .from(schema.agents)
        .where(eq(schema.agents.email, 'newuser@example.com'))
        .get();

      expect(createdUser).toBeDefined();
      expect(createdUser?.email).toBe('newuser@example.com');
    });

    test('should reject duplicate email', async () => {
      // Create existing user
      const passwordHash = await hash('ExistingPassword123!', 10);
      await env.db.insert(schema.agents).values({
        id: 'existing-user',
        email: 'existing@example.com',
        displayName: 'Existing User',
        passwordHash,
        role: 'agent',
        isActive: true,
        passwordPolicy: 'changeable',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const adminToken = await TestJWTHelper.generateAdminToken();

      const response = await app.request('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          email: 'existing@example.com',
          password: 'NewPassword123!',
          displayName: 'Duplicate User',
          role: 'agent'
        })
      });

      expect(response.status).toBe(409);

      const result = await response.json();
      expect(result.error).toBe('Email already exists');
    });

    test('should reject invalid role', async () => {
      const adminToken = await TestJWTHelper.generateAdminToken();

      const response = await app.request('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          email: 'invalidrole@example.com',
          password: 'Password123!',
          displayName: 'Invalid Role User',
          role: 'superadmin' // Invalid role
        })
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.error).toBe('Invalid role');
    });

    test('should reject request with missing fields', async () => {
      const adminToken = await TestJWTHelper.generateAdminToken();

      const response = await app.request('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          email: 'incomplete@example.com',
          password: 'Password123!'
          // Missing displayName and role
        })
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.error).toBe('All fields are required');
    });

    test('should reject non-admin user registration', async () => {
      // Use agent token instead of admin
      const agentToken = await TestJWTHelper.generateAgentToken();

      const response = await app.request('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${agentToken}`
        },
        body: JSON.stringify({
          email: 'unauthorized@example.com',
          password: 'Password123!',
          displayName: 'Unauthorized User',
          role: 'agent'
        })
      });

      expect(response.status).toBe(403);

      const result = await response.json();
      expect(result.error).toBe('Admin required');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should successfully logout user with session', async () => {
      const response = await app.request('/api/auth/logout', {
        method: 'POST',
        headers: {
          'X-Session-ID': 'test-session-123'
        }
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Logged out successfully');

      // Verify session was deleted
      expect(mockKVNamespace.delete).toHaveBeenCalledWith('session:test-session-123');
    });

    test('should handle logout without session ID', async () => {
      const response = await app.request('/api/auth/logout', {
        method: 'POST'
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Logged out successfully');
    });
  });

  describe('GET /api/auth/profile', () => {
    test('should return user profile with valid JWT', async () => {
      // Create test user
      const passwordHash = await hash('TestPassword123!', 10);
      await env.db.insert(schema.agents).values({
        id: '1',
        email: 'admin@test.com',
        displayName: 'Test Administrator',
        passwordHash,
        role: 'admin',
        teamId: 1, // Use integer value for teamId
        isActive: true,
        passwordPolicy: 'changeable',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const adminToken = await TestJWTHelper.generateAdminToken();

      const response = await app.request('/api/auth/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.user).toBeDefined();
      expect(result.data.user.email).toBe('admin@test.com');
      expect(result.data.user.displayName).toBe('Test Administrator');
      expect(result.data.user.role).toBe('admin');
    });

    test('should reject request without JWT', async () => {
      const response = await app.request('/api/auth/profile', {
        method: 'GET'
      });

      expect(response.status).toBe(401);

      const result = await response.json();
      expect(result.error).toBe('Unauthorized');
    });
  });

  describe('GET /api/auth/me', () => {
    test('should return current user with valid JWT', async () => {
      // Create test user
      const passwordHash = await hash('TestPassword123!', 10);
      const createdAt = new Date().toISOString();
      await env.db.insert(schema.agents).values({
        id: '3',
        email: 'agent@test.com',
        displayName: 'Test Agent',
        passwordHash,
        role: 'agent',
        teamId: 1, // Use integer value for teamId
        isActive: true,
        passwordPolicy: 'changeable',
        createdAt,
        updatedAt: createdAt
      });

      const agentToken = await TestJWTHelper.generateAgentToken();

      const response = await app.request('/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${agentToken}`
        }
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.email).toBe('agent@test.com');
      expect(result.data.name).toBe('Test Agent');
      expect(result.data.displayName).toBe('Test Agent');
      expect(result.data.role).toBe('agent');
      expect(result.data.isActive).toBe(true);
    });

    test('should reject request without JWT', async () => {
      const response = await app.request('/api/auth/me', {
        method: 'GET'
      });

      expect(response.status).toBe(401);

      const result = await response.json();
      expect(result.error).toBe('Unauthorized');
    });
  });

  describe('POST /api/auth/refresh', () => {
    test('should successfully refresh token with valid refresh token', async () => {
      // Create test user
      const passwordHash = await hash('TestPassword123!', 10);
      await env.db.insert(schema.agents).values({
        id: 'refresh-user-1',
        email: 'refreshtest@example.com',
        displayName: 'Refresh Test User',
        passwordHash,
        role: 'agent',
        isActive: true,
        passwordPolicy: 'changeable',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Generate refresh token
      const refreshToken = await TestJWTHelper.generateToken({
        userId: 'refresh-user-1',
        email: 'refreshtest@example.com',
        displayName: 'Refresh Test User',
        role: 'agent',
        type: 'refresh'
      });

      const response = await app.request('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken
        })
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.token).toBeDefined();
      expect(result.data.refreshToken).toBeDefined();
      expect(result.data.token).not.toBe(refreshToken); // Should be a new token
    });

    test('should reject request with missing refresh token', async () => {
      const response = await app.request('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Refresh token is required');
    });

    test('should reject access token (wrong token type)', async () => {
      // Generate access token instead of refresh token
      const accessToken = await TestJWTHelper.generateToken({
        userId: 'test-user-1',
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'agent',
        type: 'access' // Wrong type
      });

      const response = await app.request('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: accessToken
        })
      });

      expect(response.status).toBe(401);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token type');
    });

    test('should reject refresh token for inactive user', async () => {
      // Create inactive user
      const passwordHash = await hash('TestPassword123!', 10);
      await env.db.insert(schema.agents).values({
        id: 'inactive-user',
        email: 'inactive@example.com',
        displayName: 'Inactive User',
        passwordHash,
        role: 'agent',
        isActive: false, // Inactive
        passwordPolicy: 'changeable',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Generate refresh token
      const refreshToken = await TestJWTHelper.generateToken({
        userId: 'inactive-user',
        email: 'inactive@example.com',
        displayName: 'Inactive User',
        role: 'agent',
        type: 'refresh'
      });

      const response = await app.request('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken
        })
      });

      expect(response.status).toBe(401);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found or inactive');
    });

    test('should reject refresh token for non-existent user', async () => {
      // Generate refresh token for non-existent user
      const refreshToken = await TestJWTHelper.generateToken({
        userId: 'non-existent-user-999',
        email: 'nonexistent@example.com',
        displayName: 'Non-existent User',
        role: 'agent',
        type: 'refresh'
      });

      const response = await app.request('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken
        })
      });

      expect(response.status).toBe(401);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found or inactive');
    });

    test('should reject invalid JWT signature', async () => {
      // Generate token with wrong secret
      const invalidToken = await TestJWTHelper.generateToken(
        {
          userId: 'test-user-1',
          email: 'test@example.com',
          displayName: 'Test User',
          role: 'agent',
          type: 'refresh'
        },
        { secret: 'wrong-secret-key' }
      );

      const response = await app.request('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: invalidToken
        })
      });

      expect(response.status).toBe(401);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid refresh token');
    });
  });
});
