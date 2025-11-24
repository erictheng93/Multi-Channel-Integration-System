/**
 * Drizzle Factory Unit Tests
 * 測試集中式 Drizzle 工廠配置
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createDbClient,
  createDbClientWithLogging,
  getFactoryConfig,
  type Database,
} from '@/db/drizzle-factory';

describe('Drizzle Factory', () => {
  // Mock D1 database
  const mockD1 = {} as D1Database;

  describe('createDbClient', () => {
    it('should create database client with default config', () => {
      const db = createDbClient(mockD1);

      expect(db).toBeDefined();
      expect(db).toHaveProperty('query');
      expect(db).toHaveProperty('select');
    });

    it('should create database client with custom options', () => {
      const db = createDbClient(mockD1, { logger: true });

      expect(db).toBeDefined();
    });

    it('should use camelCase casing by default', () => {
      const config = getFactoryConfig();

      expect(config.casing).toBe('camelCase');
    });

    it('should have logger disabled by default', () => {
      const config = getFactoryConfig();

      expect(config.logger).toBe(false);
    });
  });

  describe('createDbClientWithLogging', () => {
    it('should create database client with logging enabled', () => {
      const db = createDbClientWithLogging(mockD1);

      expect(db).toBeDefined();
    });
  });

  describe('getFactoryConfig', () => {
    it('should return current factory configuration', () => {
      const config = getFactoryConfig();

      expect(config).toEqual({
        logger: false,
        casing: 'camelCase',
      });
    });
  });

  describe('Type Safety', () => {
    it('should return correctly typed Database', () => {
      const db: Database = createDbClient(mockD1);

      // Type assertion test
      expect(db).toBeDefined();
    });
  });
});
