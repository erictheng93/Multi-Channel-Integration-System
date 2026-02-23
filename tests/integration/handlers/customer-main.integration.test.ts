/**
 * Customer Main Handler Integration Tests
 *
 * Tests HTTP-level behavior of customer-main.ts endpoints:
 * - GET /api/customers — list all customers
 * - GET /api/customers/:customerId — single customer with conversations
 * - GET /api/customers/platform/:platform/:platformUserId — lookup by platform
 * - Route priority — static/specific routes not captured by parameterized routes
 *
 * Mock strategy:
 * - vi.mock('@/middleware/auth') — bypass JWT, inject payload
 * - vi.mock('@/utils/database') — mock database utility functions
 * - vi.mock('@/db/drizzle-factory') — stub to prevent import errors from customer-tags.ts
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

// ---------------------------------------------------------------------------
// Mocks (hoisted before imports)
// ---------------------------------------------------------------------------

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn((_c: any, next: any) => {
    _c.set('jwtPayload', {
      userId: 'admin-001',
      username: 'testadmin',
      role: 'admin',
      teamId: 1,
    });
    return next();
  }),
  requireRole: vi.fn(() => (_c: any, next: any) => next()),
}));

const mockGetAllCustomers = vi.fn();
const mockGetCustomerById = vi.fn();
const mockGetCustomerByPlatformId = vi.fn();
const mockGetCustomerConversations = vi.fn();

vi.mock('@/utils/database', () => ({
  getAllCustomers: (...args: any[]) => mockGetAllCustomers(...args),
  getCustomerById: (...args: any[]) => mockGetCustomerById(...args),
  getCustomerByPlatformId: (...args: any[]) => mockGetCustomerByPlatformId(...args),
  getCustomerConversations: (...args: any[]) => mockGetCustomerConversations(...args),
}));

// Minimal stub so customer-tags.ts can import without blowing up
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue([]),
  })),
}));

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------

import customerHandler from '@modules/customer/handlers/customer-main';
import type { Bindings } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockEnv() {
  return {
    DB: { prepare: vi.fn() },
    SESSIONS: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    CACHE: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    JWT_SECRET: 'test-secret',
  };
}

function createTestApp(env: ReturnType<typeof createMockEnv>) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use('*', async (c, next) => {
    c.env = env as any;
    await next();
  });
  app.route('/api/customers', customerHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const SAMPLE_CUSTOMER = {
  id: 1,
  displayName: 'John Doe',
  platform: 'line',
  platformUserId: 'U1234567890',
  createdAt: '2025-01-01T00:00:00.000Z',
};

const SAMPLE_CONVERSATIONS = [
  { id: 10, customerId: 1, status: 'active', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 11, customerId: 1, status: 'closed', createdAt: '2025-01-02T00:00:00.000Z' },
];

// ===========================================================================
// Tests
// ===========================================================================

describe('Customer Main Handler — Integration Tests', () => {
  let app: ReturnType<typeof createTestApp>;
  let env: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    app = createTestApp(env);
  });

  // =========================================================================
  // GET /api/customers
  // =========================================================================
  describe('GET /api/customers', () => {
    test('should return 200 with customer list', async () => {
      mockGetAllCustomers.mockResolvedValueOnce([SAMPLE_CUSTOMER]);

      const res = await app.request('/api/customers');
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.customers).toHaveLength(1);
      expect(body.data.count).toBe(1);
    });

    test('should return 200 with empty list when no customers', async () => {
      mockGetAllCustomers.mockResolvedValueOnce([]);

      const res = await app.request('/api/customers');
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.customers).toHaveLength(0);
      expect(body.data.count).toBe(0);
    });

    test('should return 500 on database error', async () => {
      mockGetAllCustomers.mockRejectedValueOnce(new Error('DB connection lost'));

      const res = await app.request('/api/customers');
      expect(res.status).toBe(500);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    test('endpoint should exist (not 404)', async () => {
      mockGetAllCustomers.mockResolvedValueOnce([]);

      const res = await app.request('/api/customers');
      expect(res.status).not.toBe(404);
    });
  });

  // =========================================================================
  // GET /api/customers/:customerId
  // =========================================================================
  describe('GET /api/customers/:customerId', () => {
    test('should return 200 with customer and conversations', async () => {
      mockGetCustomerById.mockResolvedValueOnce(SAMPLE_CUSTOMER);
      mockGetCustomerConversations.mockResolvedValueOnce(SAMPLE_CONVERSATIONS);

      const res = await app.request('/api/customers/1');
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.customer).toEqual(SAMPLE_CUSTOMER);
      expect(body.data.conversations).toHaveLength(2);
    });

    test('should return correct conversationCount', async () => {
      mockGetCustomerById.mockResolvedValueOnce(SAMPLE_CUSTOMER);
      mockGetCustomerConversations.mockResolvedValueOnce(SAMPLE_CONVERSATIONS);

      const res = await app.request('/api/customers/1');
      const body = await res.json() as any;

      expect(body.data.conversationCount).toBe(SAMPLE_CONVERSATIONS.length);
    });

    test('should return 404 when customer not found', async () => {
      mockGetCustomerById.mockResolvedValueOnce(null);

      const res = await app.request('/api/customers/999');
      expect(res.status).toBe(404);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    test('should return 500 on database error', async () => {
      mockGetCustomerById.mockRejectedValueOnce(new Error('query failed'));

      const res = await app.request('/api/customers/1');
      expect(res.status).toBe(500);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    test('should handle NaN customerId gracefully', async () => {
      // "abc" → parseInt → NaN → getCustomerById(DB, NaN) → null
      mockGetCustomerById.mockResolvedValueOnce(null);

      const res = await app.request('/api/customers/abc');
      // Should either 404 or 500 — not crash
      expect(res.status).toBeGreaterThanOrEqual(400);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /api/customers/platform/:platform/:platformUserId
  // =========================================================================
  describe('GET /api/customers/platform/:platform/:platformUserId', () => {
    test('should return 200 with customer and conversations', async () => {
      mockGetCustomerByPlatformId.mockResolvedValueOnce(SAMPLE_CUSTOMER);
      mockGetCustomerConversations.mockResolvedValueOnce(SAMPLE_CONVERSATIONS);

      const res = await app.request('/api/customers/platform/line/U1234567890');
      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.customer).toEqual(SAMPLE_CUSTOMER);
      expect(body.data.conversationCount).toBe(2);
    });

    test('should return 404 when platform customer not found', async () => {
      mockGetCustomerByPlatformId.mockResolvedValueOnce(null);

      const res = await app.request('/api/customers/platform/line/NONEXISTENT');
      expect(res.status).toBe(404);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    test('should pass correct platform and platformUserId params', async () => {
      mockGetCustomerByPlatformId.mockResolvedValueOnce(SAMPLE_CUSTOMER);
      mockGetCustomerConversations.mockResolvedValueOnce([]);

      await app.request('/api/customers/platform/facebook/FB_USER_42');

      expect(mockGetCustomerByPlatformId).toHaveBeenCalledWith(
        expect.anything(), // DB object
        'facebook',
        'FB_USER_42'
      );
    });

    test('should return 500 on database error', async () => {
      mockGetCustomerByPlatformId.mockRejectedValueOnce(new Error('timeout'));

      const res = await app.request('/api/customers/platform/line/U123');
      expect(res.status).toBe(500);

      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });
  });

  // =========================================================================
  // Route Priority
  // =========================================================================
  describe('Route Priority', () => {
    test('/tags/available should NOT be captured by /:customerId', async () => {
      // If route priority is wrong, "tags" would be treated as customerId
      // and getCustomerById would be called with NaN
      const res = await app.request('/api/customers/tags/available');

      // Should not 404 — the tags/available endpoint is registered
      expect(res.status).not.toBe(404);
      // The mock for getAllCustomers should NOT have been called
      expect(mockGetCustomerById).not.toHaveBeenCalled();
    });

    test('/platform/:p/:pid should NOT be captured by /:customerId', async () => {
      mockGetCustomerByPlatformId.mockResolvedValueOnce(SAMPLE_CUSTOMER);
      mockGetCustomerConversations.mockResolvedValueOnce([]);

      const res = await app.request('/api/customers/platform/line/U123');

      // Should use platform handler, not the /:customerId handler
      expect(mockGetCustomerByPlatformId).toHaveBeenCalled();
      expect(mockGetCustomerById).not.toHaveBeenCalled();
    });

    test('/:customerId/tags should be a valid route (handler responds)', async () => {
      // The GET /:customerId/tags endpoint is delegated to customerTagsHandler.
      // The drizzle mock returns [] for the customer existence check, so the
      // handler returns 404 "Customer not found" — but that proves the ROUTE
      // exists (a missing route would return plain text "404 Not Found").
      const res = await app.request('/api/customers/1/tags');
      const body = await res.json() as any;

      // Handler response has success field — Hono 404 would not
      expect(body).toHaveProperty('success');
    });
  });
});
