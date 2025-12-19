/**
 * Integration Test Setup Helper
 *
 * This module provides utilities for integration testing Hono handlers
 * with minimal mocking - only external services are mocked.
 *
 * Philosophy:
 * - Test HTTP layer behavior, not implementation details
 * - Mock only what you can't control (databases, external APIs)
 * - Use realistic request/response patterns
 * - Focus on inputs and outputs, not internal calls
 */

import { Hono } from 'hono';
import { vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

export interface MockDatabase {
  prepare: ReturnType<typeof vi.fn>;
  batch: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
  dump: ReturnType<typeof vi.fn>;
}

export interface MockKV {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
}

export interface MockR2Bucket {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
}

export interface MockEnv {
  DB: MockDatabase;
  SESSIONS: MockKV;
  CACHE: MockKV;
  FILE_STORAGE?: MockR2Bucket;
  JWT_SECRET: string;
  LINE_CHANNEL_SECRET?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  FB_VERIFY_TOKEN?: string;
  FB_APP_SECRET?: string;
  FB_PAGE_ACCESS_TOKEN?: string;
}

export interface TestUser {
  userId: string;
  username: string;
  role: 'admin' | 'agent';
  teamId: number;
  email?: string;
}

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Create a mock D1 database that simulates query behavior
 */
export function createMockDatabase(): MockDatabase {
  const mockStatement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [] }),
    run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
    raw: vi.fn().mockResolvedValue([])
  };

  return {
    prepare: vi.fn().mockReturnValue(mockStatement),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0 }),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0))
  };
}

/**
 * Create a mock KV namespace
 */
export function createMockKV(): MockKV {
  const store = new Map<string, string>();

  return {
    get: vi.fn().mockImplementation((key: string) => {
      return Promise.resolve(store.get(key) || null);
    }),
    put: vi.fn().mockImplementation((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    delete: vi.fn().mockImplementation((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
    list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cursor: '' })
  };
}

/**
 * Create a mock R2 bucket
 */
export function createMockR2Bucket(): MockR2Bucket {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue({ key: 'mock-key' }),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ objects: [], truncated: false })
  };
}

/**
 * Create a complete mock environment for testing
 */
export function createMockEnv(overrides: Partial<MockEnv> = {}): MockEnv {
  return {
    DB: createMockDatabase(),
    SESSIONS: createMockKV(),
    CACHE: createMockKV(),
    FILE_STORAGE: createMockR2Bucket(),
    JWT_SECRET: 'test-jwt-secret-for-integration-tests',
    LINE_CHANNEL_SECRET: 'test-line-secret',
    LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
    FB_VERIFY_TOKEN: 'test-fb-verify-token',
    FB_APP_SECRET: 'test-fb-app-secret',
    FB_PAGE_ACCESS_TOKEN: 'test-fb-page-token',
    ...overrides
  };
}

// ============================================================================
// JWT Helpers
// ============================================================================

/**
 * Create a mock JWT token for testing
 * Note: In integration tests, we usually bypass JWT validation
 * and inject the user directly into context
 */
export function createTestToken(user: TestUser): string {
  // Simple base64 encoded payload for testing
  const payload = {
    ...user,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  };
  return `test-token-${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
}

/**
 * Default test users
 */
export const TEST_USERS = {
  admin: {
    userId: 'admin-001',
    username: 'testadmin',
    role: 'admin' as const,
    teamId: 1,
    email: 'admin@test.com'
  },
  agent: {
    userId: 'agent-001',
    username: 'testagent',
    role: 'agent' as const,
    teamId: 1,
    email: 'agent@test.com'
  },
  otherTeamAgent: {
    userId: 'agent-002',
    username: 'otheragent',
    role: 'agent' as const,
    teamId: 2,
    email: 'other@test.com'
  }
};

// ============================================================================
// Request Helpers
// ============================================================================

/**
 * Create request options with authentication
 */
export function withAuth(
  user: TestUser,
  options: RequestInit = {}
): RequestInit {
  return {
    ...options,
    headers: {
      'Authorization': `Bearer ${createTestToken(user)}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  };
}

/**
 * Create a JSON POST request
 */
export function jsonPost(body: unknown, user?: TestUser): RequestInit {
  const options: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
  return user ? withAuth(user, options) : options;
}

/**
 * Create a JSON PUT request
 */
export function jsonPut(body: unknown, user?: TestUser): RequestInit {
  const options: RequestInit = {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
  return user ? withAuth(user, options) : options;
}

/**
 * Create a JSON PATCH request
 */
export function jsonPatch(body: unknown, user?: TestUser): RequestInit {
  const options: RequestInit = {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
  return user ? withAuth(user, options) : options;
}

/**
 * Create a DELETE request
 */
export function deleteRequest(user?: TestUser): RequestInit {
  const options: RequestInit = { method: 'DELETE' };
  return user ? withAuth(user, options) : options;
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Parse JSON response and extract data
 */
export async function parseJsonResponse<T = unknown>(
  response: Response
): Promise<{ status: number; data: T }> {
  const data = await response.json() as T;
  return { status: response.status, data };
}

/**
 * Assert successful response structure
 */
export function assertSuccess(
  data: { success?: boolean; data?: unknown; message?: string }
): void {
  if (!data.success) {
    throw new Error(`Expected success response, got: ${JSON.stringify(data)}`);
  }
}

/**
 * Assert error response structure
 */
export function assertError(
  data: { success?: boolean; error?: string },
  expectedError?: string
): void {
  if (data.success !== false) {
    throw new Error(`Expected error response, got: ${JSON.stringify(data)}`);
  }
  if (expectedError && data.error !== expectedError) {
    throw new Error(`Expected error "${expectedError}", got "${data.error}"`);
  }
}

// ============================================================================
// Integration Test App Factory
// ============================================================================

/**
 * Create a test app with environment bindings
 * Use this to create Hono apps for integration testing
 */
export function createTestApp<T extends Hono>(
  handler: T,
  env: MockEnv = createMockEnv()
): { app: T; env: MockEnv } {
  // Create a wrapper app that injects environment
  const app = new Hono();

  // Inject environment into all requests
  app.use('*', async (c, next) => {
    c.env = env as any;
    await next();
  });

  // Mount the handler
  app.route('/', handler);

  return { app: app as unknown as T, env };
}

// ============================================================================
// Database Query Helpers
// ============================================================================

/**
 * Setup mock database to return specific data for queries
 */
export function mockDbQuery(
  db: MockDatabase,
  responses: Array<{ first?: unknown; all?: unknown[]; run?: unknown }>
): void {
  const statement = db.prepare({} as any);

  responses.forEach((response, index) => {
    if (response.first !== undefined) {
      (statement.first as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(response.first);
    }
    if (response.all !== undefined) {
      (statement.all as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ results: response.all });
    }
    if (response.run !== undefined) {
      (statement.run as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(response.run);
    }
  });
}

// ============================================================================
// Export Everything
// ============================================================================

export default {
  createMockDatabase,
  createMockKV,
  createMockR2Bucket,
  createMockEnv,
  createTestToken,
  createTestApp,
  TEST_USERS,
  withAuth,
  jsonPost,
  jsonPut,
  jsonPatch,
  deleteRequest,
  parseJsonResponse,
  assertSuccess,
  assertError,
  mockDbQuery
};
