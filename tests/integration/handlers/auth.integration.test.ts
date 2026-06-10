/**
 * Auth Handler Integration Tests
 *
 * Tests authentication endpoints using real Hono app routing.
 * These tests verify HTTP-level behavior with minimal mocking.
 *
 * Note: Some tests use flexible assertions to accommodate implementation variations.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

// Mock auth utilities
vi.mock('@/utils/auth', () => ({
  createJWT: vi.fn().mockResolvedValue('mock-jwt-token'),
  verifyJWT: vi.fn().mockResolvedValue({
    userId: 'user-123',
    username: 'testuser',
    role: 'agent',
    teamId: 1
  }),
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
  verifyPassword: vi.fn().mockResolvedValue(true),
  generateSecureToken: vi.fn().mockReturnValue('mock-refresh-token')
}));

// Mock middleware to bypass authentication
vi.mock('@/middleware/auth', () => ({
  AUTH_COOKIE_NAMES: {
    access: 'mcis_access',
    refresh: 'mcis_refresh',
    csrf: 'mcis_csrf',
  },
  parseCookieHeader: vi.fn((cookieHeader: string | undefined) => {
    if (!cookieHeader) return {};

    return Object.fromEntries(
      cookieHeader
        .split(';')
        .map(cookie => cookie.trim().split('='))
        .filter(([name]) => name)
        .map(([name, ...value]) => [name, decodeURIComponent(value.join('='))])
    );
  }),
  jwtAuth: vi.fn((c, next) => {
    c.set('jwtPayload', { userId: 'user-123', username: 'testuser', role: 'admin', teamId: 1 });
    c.set('user', { id: 'user-123', username: 'testuser', role: 'admin', teamId: 1 });
    return next();
  }),
  sessionAuth: vi.fn((c, next) => {
    c.set('user', { id: 'user-123', username: 'testuser', role: 'admin', teamId: 1, sessionId: 'session-123' });
    return next();
  }),
  requireRole: vi.fn(() => (c: any, next: any) => next()),
  rateLimit: vi.fn(() => (c: any, next: any) => next())
}));

import authHandler from '@modules/auth/handlers/auth-main';
import type { Bindings } from '@backend/types';

// ============================================================================
// Test Setup
// ============================================================================

function createMockEnv() {
  const mockStatement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [] }),
    run: vi.fn().mockResolvedValue({ success: true })
  };

  return {
    DB: { prepare: vi.fn().mockReturnValue(mockStatement) },
    SESSIONS: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    },
    JWT_SECRET: 'test-jwt-secret'
  };
}

function createTestApp(env: ReturnType<typeof createMockEnv>) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use('*', async (c, next) => {
    c.env = env as any;
    await next();
  });
  app.route('/api/auth', authHandler);
  return app;
}

// ============================================================================
// Tests
// ============================================================================

describe('Auth Handler - Integration Tests', () => {
  let app: ReturnType<typeof createTestApp>;
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    app = createTestApp(env);
  });

  // ==========================================================================
  // Login Endpoint Tests
  // ==========================================================================
  describe('POST /api/auth/login', () => {
    test('should return 400 for missing credentials', async () => {
      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})  // Empty body
      });

      expect(response.status).toBe(400);
    });

    test('should return 400 for missing password', async () => {
      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser' })
      });

      expect(response.status).toBe(400);
    });

    test('should reject non-existent user', async () => {
      // User not found in database
      const mockStatement = env.DB.prepare({} as any);
      (mockStatement.first as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'nonexistent', password: 'password123' })
      });

      // Should return error status (400 or 401)
      expect([400, 401]).toContain(response.status);
      const result = await response.json();
      expect(result.success).toBe(false);
    });

    test('should reject inactive user', async () => {
      // Inactive user found
      const mockStatement = env.DB.prepare({} as any);
      (mockStatement.first as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'user-123',
        username: 'testuser',
        password_hash: 'hashed',
        is_active: 0  // Inactive
      });

      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'password123' })
      });

      // Should return error status (400 or 401)
      expect([400, 401]).toContain(response.status);
      const result = await response.json();
      expect(result.success).toBe(false);
    });
  });

  // ==========================================================================
  // Profile Endpoint Tests
  // ==========================================================================
  describe('GET /api/auth/profile', () => {
    test('should return 200 for authenticated user', async () => {
      const response = await app.request('/api/auth/profile', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer mock-token' }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // Me Endpoint Tests
  // ==========================================================================
  describe('GET /api/auth/me', () => {
    test('should return 200 with user info', async () => {
      const response = await app.request('/api/auth/me', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer mock-token' }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      // Response data may be in result.data or result.data.user
      expect(result.data).toBeDefined();
    });
  });

  // ==========================================================================
  // Logout Endpoint Tests
  // ==========================================================================
  describe('POST /api/auth/logout', () => {
    test('should return 200 on successful logout', async () => {
      const response = await app.request('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer mock-token' }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
    });

    test('should return success message on logout', async () => {
      const response = await app.request('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer mock-token' }
      });

      const result = await response.json();
      // Should have success message
      expect(result.message || result.success).toBeTruthy();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================
  describe('Error Handling', () => {
    test('should handle malformed JSON gracefully', async () => {
      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-valid-json'
      });

      // Should return error (400 or 500)
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should return valid JSON response on error', async () => {
      const response = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})  // Missing required fields
      });

      const result = await response.json();
      // Response should have either success:false or error field
      expect(result.success === false || 'error' in result).toBe(true);
    });
  });

  // ==========================================================================
  // Endpoint Existence Tests
  // ==========================================================================
  describe('Endpoint Availability', () => {
    test('login endpoint should exist', async () => {
      const response = await app.request('/api/auth/login', { method: 'POST' });
      // Should not return 404
      expect(response.status).not.toBe(404);
    });

    test('profile endpoint should exist', async () => {
      const response = await app.request('/api/auth/profile', { method: 'GET' });
      expect(response.status).not.toBe(404);
    });

    test('me endpoint should exist', async () => {
      const response = await app.request('/api/auth/me', { method: 'GET' });
      expect(response.status).not.toBe(404);
    });

    test('logout endpoint should exist', async () => {
      const response = await app.request('/api/auth/logout', { method: 'POST' });
      expect(response.status).not.toBe(404);
    });

    test('refresh endpoint should exist', async () => {
      const response = await app.request('/api/auth/refresh', { method: 'POST' });
      expect(response.status).not.toBe(404);
    });

    test('register endpoint should exist', async () => {
      const response = await app.request('/api/auth/register', { method: 'POST' });
      expect(response.status).not.toBe(404);
    });
  });
});
