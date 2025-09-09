// 認證主要處理器測試 - Handler-based 架構
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import authMainHandler from '../../../src/handlers/auth-main';
import type { Bindings } from '../../../src/types';

// Mock utilities
vi.mock('../../../src/utils/auth', () => ({
  signJWT: vi.fn(),
  authenticateUser: vi.fn(),
  createUser: vi.fn(),
  createSession: vi.fn()
}));

// Mock Drizzle ORM - 全局mock定義
let mockDrizzleInstance: any;

vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => {
    mockDrizzleInstance = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis()
    };
    return mockDrizzleInstance;
  })
}));

// Mock Activity Service - 最終修復版本
vi.mock('../../../src/services/activity-service', () => {
  class MockActivityService {
    constructor(db: any) {
      // Mock constructor
    }
    
    async logActivity(params: any) {
      // Mock implementation that always succeeds
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

// Mock middleware
vi.mock('../../../src/middleware/auth', () => ({
  jwtAuth: vi.fn((c, next) => {
    c.set('user', { 
      id: 'user-123', 
      role: 'admin',
      displayName: 'admin-user',
      email: 'admin@example.com'
    });
    return next();
  }),
  sessionAuth: vi.fn((c, next) => next()),
  requireRole: vi.fn(() => (c, next) => next()),
  rateLimit: vi.fn(() => (c, next) => next())
}));

describe('Auth Main Handler', () => {
  let app: Hono<{ Bindings: Bindings }>;
  let mockAuthUtils: any;

  beforeEach(async () => {
    app = new Hono<{ Bindings: Bindings }>();

    // Mock context values - must be set before routing
    app.use('*', (c, next) => {
      c.env = {
        DB: {
          prepare: vi.fn().mockReturnValue({
            bind: vi.fn().mockReturnValue({
              first: vi.fn(),
              run: vi.fn()
            })
          })
        } as any,
        JWT_SECRET: 'test-secret',
        SESSIONS: {
          delete: vi.fn()
        } as any
      } as any;
      return next();
    });
    
    // Add the auth handler routes after setting up the environment
    app.route('/api/auth', authMainHandler);

    // Setup auth utils mocks
    const authModule = await import('../../../src/utils/auth');
    mockAuthUtils = {
      signJWT: authModule.signJWT as any,
      authenticateUser: authModule.authenticateUser as any,
      createUser: authModule.createUser as any,
      createSession: authModule.createSession as any
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /login', () => {
    const validLoginRequest = {
      email: 'testuser@example.com',
      password: 'testpass123'
    };

    it('should successfully login user', async () => {
      const mockAuthResult = {
        user: {
          id: 'user-123',
          email: 'testuser@example.com',
          displayName: 'Test User',
          role: 'agent',
          teamId: 1,
          teamName: 'Test Team',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z'
        },
        passwordPolicy: 'valid',
        accountStatus: 'authenticated'
      };

      mockAuthUtils.authenticateUser.mockResolvedValue(mockAuthResult);
      mockAuthUtils.signJWT.mockResolvedValue('mock-jwt-token');
      mockAuthUtils.createSession.mockResolvedValue('session-123');

      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLoginRequest)
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.agent.email).toBe('testuser@example.com');
      expect(result.data.token).toBe('mock-jwt-token');
      expect(result.data.sessionId).toBe('session-123');
    });

    it('should reject invalid credentials', async () => {
      const mockAuthResult = {
        user: null,
        passwordPolicy: null,
        accountStatus: 'wrong_password'
      };
      mockAuthUtils.authenticateUser.mockResolvedValue(mockAuthResult);

      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLoginRequest)
      });

      expect(response.status).toBe(401);

      const result = await response.json();
      expect(result.error).toBe('Wrong password');
    });

    it('should require username and password', async () => {
      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test' })
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.error).toBe('Email and password are required');
    });
  });

  describe('POST /register', () => {
    const validRegisterRequest = {
      email: 'new@example.com',
      password: 'newpass123',
      displayName: 'New User',
      role: 'agent',
      teamId: 1
    };

    it('should successfully register new user', async () => {
      const mockNewUser = {
        id: 'user-456',
        email: 'new@example.com',
        displayName: 'New User',
        role: 'agent',
        teamId: 1,
        teamName: 'Test Team'
      };

      // Mock database to return no existing user
      if (mockDrizzleInstance) {
        mockDrizzleInstance.get = vi.fn().mockResolvedValue(null);
      }
      
      mockAuthUtils.createUser.mockResolvedValue(mockNewUser);

      const response = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRegisterRequest)
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.user.email).toBe('new@example.com');
    });

    it('should reject invalid role', async () => {
      const invalidRequest = { ...validRegisterRequest, role: 'invalid' };

      const response = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest)
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.error).toBe('Invalid role');
    });

    it('should require all fields', async () => {
      const incompleteRequest = { email: 'test' };

      const response = await app.request('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incompleteRequest)
      });

      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.error).toBe('All fields are required');
    });
  });

  describe('POST /logout', () => {
    it('should successfully logout user', async () => {
      const response = await app.request('/api/auth/logout', {
        method: 'POST',
        headers: { 'X-Session-ID': 'session-123' }
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Logged out successfully');
    });
  });

  describe('GET /profile', () => {
    it('should return user profile', async () => {
      const response = await app.request('/api/auth/profile');

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.user.displayName).toBe('admin-user');
    });
  });
});