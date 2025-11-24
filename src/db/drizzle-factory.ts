/**
 * Centralized Drizzle Database Factory
 * 集中式 Drizzle 數據庫工廠
 *
 * This module provides a unified way to create Drizzle database clients
 * with consistent configuration across the entire application.
 *
 * Key Features:
 * - ✅ Unified casing configuration (camelCase for all queries)
 * - ✅ Centralized schema management
 * - ✅ Optional query logging
 * - ✅ Type-safe database client
 * - ✅ Single source of truth for DB configuration
 *
 * Usage:
 * ```typescript
 * import { createDbClient } from '@/db/drizzle-factory';
 *
 * // In your handler or service
 * const db = createDbClient(c.env.DB);
 * ```
 */

import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

/**
 * Drizzle configuration options
 */
export interface DrizzleFactoryOptions {
  /**
   * Enable query logging for debugging
   * @default false in production, true in development
   */
  logger?: boolean;

  /**
   * Casing strategy for column names
   * @default 'camelCase'
   */
  casing?: 'camelCase' | 'snake_case';
}

/**
 * Database client type with schema
 */
export type Database = DrizzleD1Database<typeof schema>;

/**
 * Default configuration for Drizzle
 */
const DEFAULT_CONFIG: Required<DrizzleFactoryOptions> = {
  logger: false, // Disable in production by default
  casing: 'camelCase', // ✅ CRITICAL: Enforce camelCase for all queries
};

/**
 * Create a Drizzle database client with unified configuration
 *
 * @param d1 - Cloudflare D1 database instance
 * @param options - Optional configuration overrides
 * @returns Configured Drizzle database client
 *
 * @example
 * ```typescript
 * // Standard usage
 * const db = createDbClient(c.env.DB);
 *
 * // With custom options
 * const db = createDbClient(c.env.DB, { logger: true });
 * ```
 */
export function createDbClient(
  d1: D1Database,
  options?: DrizzleFactoryOptions
): Database {
  const config = { ...DEFAULT_CONFIG, ...options };

  return drizzle(d1, {
    schema,
    casing: config.casing,
    logger: config.logger,
  });
}

/**
 * Create a database client with logging enabled (for debugging)
 *
 * @param d1 - Cloudflare D1 database instance
 * @returns Drizzle database client with query logging
 */
export function createDbClientWithLogging(d1: D1Database): Database {
  return createDbClient(d1, { logger: true });
}

/**
 * Verify database client configuration
 * Useful for testing and debugging
 *
 * @returns Current factory configuration
 */
export function getFactoryConfig(): Required<DrizzleFactoryOptions> {
  return { ...DEFAULT_CONFIG };
}

// Re-export schema for convenience
export { schema };
export * from './schema';
