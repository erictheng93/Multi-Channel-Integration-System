/**
 * Real Integration Test Setup Helper
 *
 * 🎯 Philosophy: Test with REAL Cloudflare Resources
 *
 * This module provides utilities for TRUE integration testing with:
 * - Real Remote D1 Database (no mocks!)
 * - Real KV Namespaces (no mocks!)
 * - Real R2 Buckets (no mocks!)
 * - Real Durable Objects (no mocks!)
 *
 * ⚠️ IMPORTANT: All tests connect to PRODUCTION REMOTE resources
 * This is intentional - we want to test real behavior, not mocked behavior.
 *
 * Why Real Resources?
 * 1. Cloudflare Workers bindings are injected at runtime - mocks can't replicate this
 * 2. D1 uses SQLite dialect with subtle differences - mocks miss these
 * 3. KV has eventual consistency - mocks can't simulate this
 * 4. Durable Objects have unique state management - impossible to mock accurately
 *
 * @see tests/UNIT_TESTS_EVALUATION_REPORT.md for testing strategy
 */

import { Hono } from 'hono';
import { unstable_dev, UnstableDevWorker } from 'wrangler';

// ============================================================================
// Types - Real Cloudflare Bindings
// ============================================================================

/**
 * Real Cloudflare environment bindings
 * These are NOT mocks - they connect to real remote resources
 */
export interface RealEnv {
  DB: D1Database;
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  FILE_STORAGE: R2Bucket;
  DELAYED_MESSAGE_QUEUE?: Queue;
  CONVERSATION_ROOM?: DurableObjectNamespace;
  USER_CONNECTION?: DurableObjectNamespace;
  MESSAGE_BROADCASTER?: DurableObjectNamespace;
  DELAYED_MESSAGE_PROCESSOR?: DurableObjectNamespace;
  DELAYED_MESSAGE_BUFFER?: DurableObjectNamespace;
  JWT_SECRET: string;
  LINE_CHANNEL_SECRET?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  FB_VERIFY_TOKEN?: string;
  FB_APP_SECRET?: string;
  FB_PAGE_ACCESS_TOKEN?: string;
  ENCRYPTION_KEY?: string;
  ENVIRONMENT?: string;
}

export interface TestUser {
  userId: string;
  username: string;
  role: 'admin' | 'agent';
  teamId: number;
  email?: string;
}

// ============================================================================
// Wrangler Dev Worker Management
// ============================================================================

let globalWorker: UnstableDevWorker | null = null;

/**
 * Start Wrangler dev worker with real bindings
 * This connects to REMOTE production resources
 */
export async function startRealWorker(): Promise<UnstableDevWorker> {
  if (globalWorker) {
    return globalWorker;
  }

  console.log('🚀 Starting Wrangler dev worker with REAL remote bindings...');

  globalWorker = await unstable_dev('src/index.ts', {
    experimental: {
      disableExperimentalWarning: true
    },
    config: 'wrangler.toml',
    // Use remote bindings (production resources)
    local: false
  });

  console.log('✅ Worker started with real D1, KV, R2, and Durable Objects');

  return globalWorker;
}

/**
 * Stop the Wrangler dev worker
 */
export async function stopRealWorker(): Promise<void> {
  if (globalWorker) {
    console.log('🛑 Stopping Wrangler dev worker...');
    await globalWorker.stop();
    globalWorker = null;
    console.log('✅ Worker stopped');
  }
}

/**
 * Get the current worker instance
 */
export function getRealWorker(): UnstableDevWorker {
  if (!globalWorker) {
    throw new Error(
      'Worker not started. Call startRealWorker() in beforeAll() first.'
    );
  }
  return globalWorker;
}

// ============================================================================
// Test Users - Same as mock version for consistency
// ============================================================================

export const TEST_USERS = {
  admin: {
    userId: 'admin-test-001',
    username: 'integration-test-admin',
    role: 'admin' as const,
    teamId: 1,
    email: 'integration-admin@test.local'
  },
  agent: {
    userId: 'agent-test-001',
    username: 'integration-test-agent',
    role: 'agent' as const,
    teamId: 1,
    email: 'integration-agent@test.local'
  },
  otherTeamAgent: {
    userId: 'agent-test-002',
    username: 'integration-test-other-agent',
    role: 'agent' as const,
    teamId: 2,
    email: 'integration-other@test.local'
  }
};

// ============================================================================
// JWT Token Generation (Real)
// ============================================================================

/**
 * Generate a REAL JWT token using the same logic as production
 * This ensures auth middleware works exactly as in production
 */
export async function createRealTestToken(
  user: TestUser,
  secret: string = 'test-jwt-secret'
): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    userId: user.userId,
    username: user.username,
    role: user.role,
    teamId: user.teamId,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  };

  // Encode header and payload
  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  // Create signature using Web Crypto API (same as production)
  const encoder = new TextEncoder();
  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const keyData = encoder.encode(secret);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

// ============================================================================
// Request Helpers
// ============================================================================

/**
 * Create request options with authentication
 */
export function withAuth(
  token: string,
  options: RequestInit = {}
): RequestInit {
  return {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  };
}

/**
 * Create a JSON POST request
 */
export function jsonPost(body: unknown, token?: string): RequestInit {
  const options: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
  return token ? withAuth(token, options) : options;
}

/**
 * Create a JSON PUT request
 */
export function jsonPut(body: unknown, token?: string): RequestInit {
  const options: RequestInit = {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
  return token ? withAuth(token, options) : options;
}

/**
 * Create a JSON PATCH request
 */
export function jsonPatch(body: unknown, token?: string): RequestInit {
  const options: RequestInit = {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
  return token ? withAuth(token, options) : options;
}

/**
 * Create a DELETE request
 */
export function deleteRequest(token?: string): RequestInit {
  const options: RequestInit = { method: 'DELETE' };
  return token ? withAuth(token, options) : options;
}

/**
 * Create a GET request
 */
export function getRequest(token?: string): RequestInit {
  const options: RequestInit = { method: 'GET' };
  return token ? withAuth(token, options) : options;
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Parse JSON response and extract data
 */
export async function parseJsonResponse<T = any>(
  response: Response
): Promise<{ status: number; data: T }> {
  const data = (await response.json()) as T;
  return { status: response.status, data };
}

/**
 * Assert successful response structure
 */
export function assertSuccess(data: {
  success?: boolean;
  data?: unknown;
  message?: string;
}): asserts data is { success: true; data: unknown } {
  if (!data.success) {
    throw new Error(
      `Expected success response, got: ${JSON.stringify(data, null, 2)}`
    );
  }
}

/**
 * Assert error response structure
 */
export function assertError(
  data: { success?: boolean; error?: string },
  expectedError?: string
): asserts data is { success: false; error: string } {
  if (data.success !== false) {
    throw new Error(
      `Expected error response, got: ${JSON.stringify(data, null, 2)}`
    );
  }
  if (expectedError && data.error !== expectedError) {
    throw new Error(`Expected error "${expectedError}", got "${data.error}"`);
  }
}

// ============================================================================
// Database Helpers - Real D1 Operations
// ============================================================================

/**
 * Clean up test data from real database
 * Call this in afterEach() to prevent test data accumulation
 */
export async function cleanupTestData(
  worker: UnstableDevWorker,
  testPrefix = 'integration-test-'
): Promise<void> {
  // Note: This requires direct D1 access
  // In real integration tests, we accept data accumulation
  // or use database migrations to reset state
  console.log(`🧹 Cleanup test data with prefix: ${testPrefix}`);

  // TODO: Implement cleanup if needed
  // For now, we rely on test data having unique IDs
  // that won't conflict with production data
}

/**
 * Verify database connection
 */
export async function verifyDatabaseConnection(
  worker: UnstableDevWorker
): Promise<boolean> {
  try {
    const response = await worker.fetch('/api/system/health');
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Generate unique test IDs to avoid conflicts
 */
export function generateTestId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Create test conversation data
 */
export function createTestConversation(overrides: Partial<any> = {}) {
  return {
    customerId: generateTestId('customer'),
    channelType: 'line',
    subject: 'Integration Test Conversation',
    status: 'active',
    ...overrides
  };
}

/**
 * Create test message data
 */
export function createTestMessage(
  conversationId: string,
  overrides: Partial<any> = {}
) {
  return {
    conversationId,
    content: 'Integration test message',
    type: 'text',
    direction: 'outgoing',
    ...overrides
  };
}

/**
 * Create test team data
 */
export function createTestTeam(overrides: Partial<any> = {}) {
  return {
    name: `Integration Test Team ${Date.now()}`,
    description: 'Created by integration tests',
    ...overrides
  };
}

// ============================================================================
// Export Everything
// ============================================================================

export default {
  // Worker management
  startRealWorker,
  stopRealWorker,
  getRealWorker,

  // Test users
  TEST_USERS,

  // JWT
  createRealTestToken,

  // Request helpers
  withAuth,
  jsonPost,
  jsonPut,
  jsonPatch,
  deleteRequest,
  getRequest,

  // Response helpers
  parseJsonResponse,
  assertSuccess,
  assertError,

  // Database helpers
  cleanupTestData,
  verifyDatabaseConnection,

  // Test data factories
  generateTestId,
  createTestConversation,
  createTestMessage,
  createTestTeam
};
