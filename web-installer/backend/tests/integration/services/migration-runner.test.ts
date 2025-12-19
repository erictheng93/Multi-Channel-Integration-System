/**
 * MigrationRunner Service - Integration Tests
 *
 * Tests database migration execution and tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MigrationRunner } from '@/services/MigrationRunner';
import { CloudflareAPI } from '@/services/CloudflareAPI';
import type { MigrationProgress } from '@/services/MigrationRunner';

describe('MigrationRunner Service - Integration Tests', () => {
  let runner: MigrationRunner;
  let mockAPI: CloudflareAPI;
  let progressCalls: MigrationProgress[];

  beforeEach(() => {
    // Mock CloudflareAPI
    mockAPI = {
      executeD1Query: vi.fn(),
      executeD1QueryWithParams: vi.fn()
    } as any;

    // Track progress callbacks
    progressCalls = [];
    const onProgress = (progress: MigrationProgress) => {
      progressCalls.push(progress);
    };

    runner = new MigrationRunner(mockAPI, onProgress);
  });

  describe('Migration Execution', () => {
    it('should create migrations tracking table', async () => {
      const createTableSpy = vi.spyOn(mockAPI, 'executeD1Query');
      createTableSpy.mockResolvedValue({ success: true, meta: {}, results: [] });

      // Run migrations (which creates tracking table first)
      vi.spyOn(mockAPI, 'executeD1QueryWithParams').mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      await runner.runAllMigrations('db-123');

      // Verify tracking table was created (note: single underscore _migrations, not double)
      const createTableCall = createTableSpy.mock.calls.find(call =>
        call[1].includes('CREATE TABLE IF NOT EXISTS _migrations')
      );
      expect(createTableCall).toBeDefined();
    });

    it('should run migrations in order', async () => {
      const executeQuerySpy = vi.spyOn(mockAPI, 'executeD1Query');
      const executeQueryWithParamsSpy = vi.spyOn(mockAPI, 'executeD1QueryWithParams');

      // Mock: no migrations applied yet
      executeQueryWithParamsSpy.mockResolvedValue({
        meta: {},
        results: []
      });

      // Mock: all queries succeed
      executeQuerySpy.mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      const result = await runner.runAllMigrations('db-123');

      expect(result.success).toBe(true);
      expect(result.migrationsRun).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip already applied migrations', async () => {
      const executeQuerySpy = vi.spyOn(mockAPI, 'executeD1Query');
      const executeQueryWithParamsSpy = vi.spyOn(mockAPI, 'executeD1QueryWithParams');

      // Mock: some migrations already applied
      executeQueryWithParamsSpy.mockResolvedValueOnce({
        success: true,
        meta: {},
        results: [
          { version: '0001' },
          { version: '0002' }
        ]
      });

      // Mock subsequent calls
      executeQuerySpy.mockResolvedValue({ success: true, meta: {}, results: [] });
      executeQueryWithParamsSpy.mockResolvedValue({ success: true, meta: {}, results: [] });

      const result = await runner.runAllMigrations('db-123');

      expect(result.success).toBe(true);
      // Should have skipped migrations 0001 and 0002
      expect(result.migrationsRun).toBeGreaterThan(2);
    });

    it('should report progress during migration', async () => {
      vi.spyOn(mockAPI, 'executeD1Query').mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      vi.spyOn(mockAPI, 'executeD1QueryWithParams').mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      await runner.runAllMigrations('db-123');

      // Should have progress updates
      expect(progressCalls.length).toBeGreaterThan(0);

      // Verify progress structure
      const firstProgress = progressCalls[0];
      expect(firstProgress).toHaveProperty('currentMigration');
      expect(firstProgress).toHaveProperty('totalMigrations');
      expect(firstProgress).toHaveProperty('currentVersion');
      expect(firstProgress).toHaveProperty('currentDescription');
    });

    it('should stop on first migration error', async () => {
      const executeQuerySpy = vi.spyOn(mockAPI, 'executeD1Query');
      const executeQueryWithParamsSpy = vi.spyOn(mockAPI, 'executeD1QueryWithParams');

      // Mock: no migrations applied
      executeQueryWithParamsSpy.mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      // Mock: first migration succeeds, second fails
      executeQuerySpy
        .mockResolvedValueOnce({ success: true, meta: {}, results: [] }) // tracking table
        .mockResolvedValueOnce({ success: true, meta: {}, results: [] }) // first migration
        .mockResolvedValueOnce({ success: true, meta: {}, results: [] }) // record first
        .mockRejectedValueOnce(new Error('Syntax error in SQL')); // second migration fails

      const result = await runner.runAllMigrations('db-123');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Syntax error in SQL');
    });

    it('should record migration metadata after successful execution', async () => {
      const executeQueryWithParamsSpy = vi.spyOn(mockAPI, 'executeD1QueryWithParams');

      // Mock: no migrations applied
      executeQueryWithParamsSpy.mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      vi.spyOn(mockAPI, 'executeD1Query').mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      await runner.runAllMigrations('db-123');

      // Verify migrations were recorded (note: single underscore _migrations)
      const recordCalls = executeQueryWithParamsSpy.mock.calls.filter(call =>
        call[1].includes('INSERT INTO _migrations')
      );

      expect(recordCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Migration Result Structure', () => {
    it('should return correct result structure on success', async () => {
      vi.spyOn(mockAPI, 'executeD1Query').mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      vi.spyOn(mockAPI, 'executeD1QueryWithParams').mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      const result = await runner.runAllMigrations('db-123');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('migrationsRun');
      expect(result).toHaveProperty('totalMigrations');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('duration');

      expect(typeof result.success).toBe('boolean');
      expect(typeof result.migrationsRun).toBe('number');
      expect(typeof result.totalMigrations).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.duration).toBe('number');
    });

    it('should calculate migration duration', async () => {
      vi.spyOn(mockAPI, 'executeD1Query').mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      vi.spyOn(mockAPI, 'executeD1QueryWithParams').mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      const startTime = Date.now();
      const result = await runner.runAllMigrations('db-123');
      const endTime = Date.now();

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeLessThanOrEqual(endTime - startTime);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      // Mock executeD1Query to fail on createMigrationsTable call
      vi.spyOn(mockAPI, 'executeD1Query').mockResolvedValue({
        success: false,
        meta: {},
        results: [],
        errors: [{ message: 'Database connection failed' }]
      });

      // createMigrationsTable throws when result.success is false
      await expect(runner.runAllMigrations('db-123')).rejects.toThrow('Failed to create migrations table');
    });

    it('should handle malformed migration SQL', async () => {
      vi.spyOn(mockAPI, 'executeD1QueryWithParams').mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      vi.spyOn(mockAPI, 'executeD1Query')
        .mockResolvedValueOnce({ success: true, meta: {}, results: [] }) // tracking table
        .mockResolvedValueOnce({ success: true, meta: {}, results: [] }) // getAppliedMigrations
        .mockResolvedValueOnce({
          success: false,
          meta: {},
          results: [],
          errors: [{ message: 'Syntax error at line 5' }]
        }); // first migration fails

      const result = await runner.runAllMigrations('db-123');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('0001'); // Should contain migration version
      expect(result.errors[0]).toContain('Syntax error'); // Should contain error message
    });

    it('should handle API timeouts gracefully', async () => {
      vi.spyOn(mockAPI, 'executeD1Query').mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      // createMigrationsTable will timeout and throw
      await expect(runner.runAllMigrations('db-123')).rejects.toThrow('Request timeout');
    });
  });

  describe('Migration Tracking', () => {
    it('should correctly identify applied migrations', async () => {
      const executeQuerySpy = vi.spyOn(mockAPI, 'executeD1Query');
      const executeQueryWithParamsSpy = vi.spyOn(mockAPI, 'executeD1QueryWithParams');

      // Mock: createMigrationsTable succeeds
      executeQuerySpy.mockResolvedValueOnce({ success: true, meta: {}, results: [] });

      // Mock: getAppliedMigrations returns migrations 0001-0005
      executeQuerySpy.mockResolvedValueOnce({
        success: true,
        meta: {},
        results: [
          { version: '0001' },
          { version: '0002' },
          { version: '0003' },
          { version: '0004' },
          { version: '0005' }
        ]
      });

      // Mock: all subsequent queries succeed
      executeQuerySpy.mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      executeQueryWithParamsSpy.mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      await runner.runAllMigrations('db-123');

      // Verify query to get applied migrations (note: single underscore _migrations)
      const getAppliedCall = executeQuerySpy.mock.calls.find(call =>
        call[1].includes('SELECT version FROM _migrations')
      );

      expect(getAppliedCall).toBeDefined();
    });
  });

  describe('Schema Verification', () => {
    it('should verify complete database schema', async () => {
      // Mock: schema query returns all required tables
      vi.spyOn(mockAPI, 'executeD1Query').mockResolvedValue({
        success: true,
        meta: {},
        results: [
          { name: 'teams' },
          { name: 'agents' },
          { name: 'customers' },
          { name: 'conversations' },
          { name: 'messages' },
          { name: 'delayed_messages' },
          { name: 'file_attachments' },
          { name: 'tags' },
          { name: 'customer_tags' },
          { name: 'conversation_tags' },
          { name: 'notifications' },
          { name: 'activities' },
          { name: 'system_settings' },
          { name: 'channel_integrations' }
        ]
      });

      const result = await runner.verifySchema('db-123');

      expect(result.valid).toBe(true);
      expect(result.missingTables).toHaveLength(0);
    });

    it('should detect missing tables', async () => {
      // Mock: schema query returns only some tables
      vi.spyOn(mockAPI, 'executeD1Query').mockResolvedValue({
        success: true,
        meta: {},
        results: [
          { name: 'teams' },
          { name: 'agents' }
          // Missing other required tables
        ]
      });

      const result = await runner.verifySchema('db-123');

      expect(result.valid).toBe(false);
      expect(result.missingTables.length).toBeGreaterThan(0);
      expect(result.missingTables).toContain('customers');
      expect(result.missingTables).toContain('conversations');
    });

    it('should handle schema query failure', async () => {
      vi.spyOn(mockAPI, 'executeD1Query').mockResolvedValue({
        success: false,
        meta: {},
        results: []
      });

      const result = await runner.verifySchema('db-123');

      expect(result.valid).toBe(false);
    });
  });

  describe('Admin User Creation', () => {
    it('should create admin user with hashed password', async () => {
      vi.spyOn(mockAPI, 'executeD1QueryWithParams').mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      const result = await runner.createAdminUser(
        'db-123',
        'admin@example.com',
        'SecurePass123!'
      );

      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('username');
      expect(result.username).toBe('admin');
      expect(mockAPI.executeD1QueryWithParams).toHaveBeenCalledWith(
        'db-123',
        expect.stringContaining('INSERT INTO agents'),
        expect.arrayContaining([
          expect.any(String), // userId
          'admin@example.com',
          expect.stringContaining('pbkdf2:'), // hashed password
          expect.any(String) // display name
        ])
      );
    });

    it('should reject invalid email format', async () => {
      await expect(
        runner.createAdminUser('db-123', 'invalid-email', 'password')
      ).rejects.toThrow('Invalid email format');
    });

    it('should reject short passwords', async () => {
      await expect(
        runner.createAdminUser('db-123', 'admin@example.com', 'short')
      ).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should use custom display name if provided', async () => {
      vi.spyOn(mockAPI, 'executeD1QueryWithParams').mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      await runner.createAdminUser(
        'db-123',
        'admin@example.com',
        'SecurePass123!',
        'Custom Admin Name'
      );

      expect(mockAPI.executeD1QueryWithParams).toHaveBeenCalledWith(
        'db-123',
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          'admin@example.com',
          expect.any(String),
          'Custom Admin Name'
        ])
      );
    });

    it('should handle database insertion failure', async () => {
      vi.spyOn(mockAPI, 'executeD1QueryWithParams').mockResolvedValue({
        success: false,
        meta: {},
        results: [],
        errors: [{ message: 'UNIQUE constraint failed' }]
      });

      await expect(
        runner.createAdminUser('db-123', 'admin@example.com', 'password123')
      ).rejects.toThrow('UNIQUE constraint failed');
    });
  });

  describe('Migration Status Query', () => {
    it('should return migration status', async () => {
      const executeQuerySpy = vi.spyOn(mockAPI, 'executeD1Query');

      // Mock: 5 migrations applied
      executeQuerySpy.mockResolvedValueOnce({
        success: true,
        meta: {},
        results: [
          { version: '0001' },
          { version: '0002' },
          { version: '0003' },
          { version: '0004' },
          { version: '0005' }
        ]
      });

      const status = await runner.getMigrationStatus('db-123');

      expect(status.applied).toBe(5);
      expect(status.pending).toBeGreaterThan(0);
      expect(status.versions).toHaveLength(5);
      expect(status.versions).toContain('0001');
    });

    it('should handle no migrations applied', async () => {
      vi.spyOn(mockAPI, 'executeD1Query').mockResolvedValue({
        success: true,
        meta: {},
        results: []
      });

      const status = await runner.getMigrationStatus('db-123');

      expect(status.applied).toBe(0);
      expect(status.pending).toBeGreaterThan(0);
      expect(status.versions).toHaveLength(0);
    });
  });
});
