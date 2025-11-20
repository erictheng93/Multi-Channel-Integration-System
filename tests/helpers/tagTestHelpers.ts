/**
 * Tag Test Helpers - Standardized helpers for tag handler testing
 *
 * Provides utilities to simplify and standardize tag-related tests
 *
 * @module tests/helpers/tagTestHelpers
 */

import { MockFactory } from './mockFactory';
import type { Bindings } from '@/types';

/**
 * Create standard test tag data
 */
export function createTestTagData(overrides?: Partial<any>) {
  return {
    id: 1,
    name: 'test-tag',
    color: '#3B82F6',
    description: 'Test description',
    teamId: 1,
    isActive: true,
    createdBy: 'agent-001',
    createdAt: '2025-11-13T10:00:00.000Z',
    updatedAt: '2025-11-13T10:00:00.000Z',
    ...overrides
  };
}

/**
 * Create multiple test tags
 */
export function createTestTags(count: number, baseOverrides?: Partial<any>): any[] {
  return Array.from({ length: count }, (_, i) =>
    createTestTagData({
      id: i + 1,
      name: `tag-${i + 1}`,
      ...baseOverrides
    })
  );
}

/**
 * Setup complete tag test environment
 *
 * @returns Configured mock environment and database
 */
export function setupTagTestEnvironment(initialData: any[] = []) {
  // Create Drizzle ORM mock with test data
  const drizzleMock = MockFactory.createDatabase(initialData);

  // Create complete environment
  const mockEnv = MockFactory.createEnv({
    DB: MockFactory.createD1(initialData)
  });

  return {
    mockEnv,
    drizzleMock,
    mockDB: drizzleMock
  };
}

/**
 * Create authenticated request helper
 *
 * @param method - HTTP method
 * @param url - Request URL
 * @param options - Additional options
 * @returns Request configuration
 */
export function createAuthenticatedRequest(
  method: string,
  url: string,
  options?: {
    body?: any;
    token?: string;
    headers?: Record<string, string>;
  }
) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${options?.token || 'mock-token'}`,
    'Content-Type': 'application/json',
    ...options?.headers
  };

  const config: any = {
    method,
    headers
  };

  if (options?.body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    config.body = JSON.stringify(options.body);
  }

  return config;
}

/**
 * Configure mock for list query
 *
 * @param mockDrizzle - Drizzle mock instance
 * @param tags - Tags to return
 * @param total - Total count
 */
export function configureMockListQuery(mockDrizzle: any, tags: any[], total: number) {
  // Configure select query to return tags
  mockDrizzle.select.mockReturnValue({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue(tags),
    get: vi.fn().mockResolvedValue(tags[0] || null)
  });

  // Note: Count queries need to be handled separately in tests
  // This is because Drizzle uses different query patterns for count
}

/**
 * Configure mock for insert query
 *
 * @param mockDrizzle - Drizzle mock instance
 * @param insertedData - Data that was "inserted"
 */
export function configureMockInsertQuery(mockDrizzle: any, insertedData: any) {
  mockDrizzle.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([insertedData]),
      execute: vi.fn().mockResolvedValue(undefined),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis()
    })
  });
}

/**
 * Configure mock for update query
 *
 * @param mockDrizzle - Drizzle mock instance
 * @param updatedData - Data that was "updated"
 */
export function configureMockUpdateQuery(mockDrizzle: any, updatedData: any) {
  mockDrizzle.update.mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([updatedData]),
        execute: vi.fn().mockResolvedValue(undefined)
      })
    })
  });
}

/**
 * Configure mock for delete query
 *
 * @param mockDrizzle - Drizzle mock instance
 * @param deletedData - Data that was "deleted"
 */
export function configureMockDeleteQuery(mockDrizzle: any, deletedData: any) {
  mockDrizzle.delete.mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([deletedData]),
      execute: vi.fn().mockResolvedValue(undefined)
    })
  });
}

/**
 * Create test admin user
 */
export function createTestAdmin(overrides?: Partial<any>) {
  return MockFactory.createTestUser({
    id: 'admin-001',
    username: 'test-admin',
    role: 'admin',
    teamId: null, // Admins typically don't belong to a team
    ...overrides
  });
}

/**
 * Create test agent user
 */
export function createTestAgent(overrides?: Partial<any>) {
  return MockFactory.createTestUser({
    id: 'agent-001',
    username: 'test-agent',
    role: 'agent',
    teamId: 1,
    ...overrides
  });
}

/**
 * Expect successful JSON response
 */
export async function expectSuccessResponse(response: Response, expectedStatus = 200) {
  expect(response.status).toBe(expectedStatus);
  const body = await response.json();
  expect(body.success).toBe(true);
  return body;
}

/**
 * Expect error JSON response
 */
export async function expectErrorResponse(response: Response, expectedStatus: number) {
  expect(response.status).toBe(expectedStatus);
  const body = await response.json();
  expect(body.success).toBe(false);
  return body;
}

/**
 * Import vi from vitest for use in helper functions
 */
import { vi } from 'vitest';
