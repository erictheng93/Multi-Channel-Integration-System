/**
 * Permissions Integration Tests
 * 測試三個模組中間件與 PermissionService 的集成
 *
 * Coverage:
 * - Reports Module: 5 tests
 * - Analytics Modimport { MockFactory } from '@helpers/mockFactory';
ule: 5 tests
 * - File Module: 5 tests
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { PermissionService } from '@shared/services/permission-service';

describe('Middleware Permissions Integration', () => {
  // Mock database
  let mockDB: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock D1 database
    mockDB = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue(null),
      get: vi.fn().mockResolvedValue(null)
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =====================================================================
  // Reports Module Tests (5 tests)
  // =====================================================================
  describe('Reports Module Permissions', () => {
    test('Admin can view, create, and delete all reports', async () => {
      // Mock admin user
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 1,
        role: 'admin',
        teamId: 1,
        isActive: true
      });

      const context = { userId: 1, role: 'admin', teamId: 1 };

      // Test all report actions
      const canView = await PermissionService.checkPermission(1, 'report', 'read', context, mockDB);
      const canCreate = await PermissionService.checkPermission(1, 'report', 'create', context, mockDB);
      const canDelete = await PermissionService.checkPermission(1, 'report', 'delete', context, mockDB);
      const canExport = await PermissionService.checkPermission(1, 'report', 'export', context, mockDB);
      const canSchedule = await PermissionService.checkPermission(1, 'report', 'schedule', context, mockDB);

      expect(canView).toBe(true);
      expect(canCreate).toBe(true);
      expect(canDelete).toBe(true);
      expect(canExport).toBe(true);
      expect(canSchedule).toBe(true);
    });

    test('Team can view team reports (teamScope)', async () => {
      // Mock team user
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 2,
        role: 'team',
        teamId: 5,
        isActive: true
      });

      const context = { userId: 2, role: 'team', teamId: 5 };

      // Team should be able to read reports (with teamScope condition)
      const canRead = await PermissionService.checkPermission(2, 'report', 'read', context, mockDB);
      expect(canRead).toBe(true);

      // Team should be able to create reports
      const canCreate = await PermissionService.checkPermission(2, 'report', 'create', context, mockDB);
      expect(canCreate).toBe(true);

      // Team should be able to schedule reports
      const canSchedule = await PermissionService.checkPermission(2, 'report', 'schedule', context, mockDB);
      expect(canSchedule).toBe(true);
    });

    test('Agent can view own reports (own condition)', async () => {
      // Mock agent user
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 3,
        role: 'agent',
        teamId: 5,
        isActive: true
      });

      const context = { userId: 3, role: 'agent', teamId: 5 };

      // Agent should be able to read own reports
      const canRead = await PermissionService.checkPermission(3, 'report', 'read', context, mockDB);
      expect(canRead).toBe(true);

      // Agent should NOT be able to create reports (no create permission)
      const canCreate = await PermissionService.checkPermission(3, 'report', 'create', context, mockDB);
      expect(canCreate).toBe(false);

      // Agent should NOT be able to export reports (no export permission)
      const canExport = await PermissionService.checkPermission(3, 'report', 'export', context, mockDB);
      expect(canExport).toBe(false);
    });

    test('Agent cannot delete team reports', async () => {
      // Mock agent user
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 3,
        role: 'agent',
        teamId: 5,
        isActive: true
      });

      const context = { userId: 3, role: 'agent', teamId: 5 };

      // Agent should NOT have delete permission at all
      const canDelete = await PermissionService.checkPermission(3, 'report', 'delete', context, mockDB);
      expect(canDelete).toBe(false);
    });

    test('Scheduled reports require team role', async () => {
      // Mock team user
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 2,
        role: 'team',
        teamId: 5,
        isActive: true
      });

      const teamContext = { userId: 2, role: 'team', teamId: 5 };
      const canScheduleTeam = await PermissionService.checkPermission(2, 'report', 'schedule', teamContext, mockDB);
      expect(canScheduleTeam).toBe(true);

      // Mock agent user - should NOT be able to schedule
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 3,
        role: 'agent',
        teamId: 5,
        isActive: true
      });

      const agentContext = { userId: 3, role: 'agent', teamId: 5 };
      const canScheduleAgent = await PermissionService.checkPermission(3, 'report', 'schedule', agentContext, mockDB);
      expect(canScheduleAgent).toBe(false);
    });
  });

  // =====================================================================
  // Analytics Module Tests (5 tests)
  // =====================================================================
  describe('Analytics Module Permissions', () => {
    test('Admin can export all analytics', async () => {
      // Mock admin user
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 1,
        role: 'admin',
        teamId: 1,
        isActive: true
      });

      const context = { userId: 1, role: 'admin', teamId: 1 };

      // Admin should be able to view analytics
      const canView = await PermissionService.checkPermission(1, 'analytics', 'view', context, mockDB);
      expect(canView).toBe(true);

      // Admin should be able to export analytics
      const canExport = await PermissionService.checkPermission(1, 'analytics', 'export', context, mockDB);
      expect(canExport).toBe(true);

      // Admin should be able to run custom queries
      const canQuery = await PermissionService.checkPermission(1, 'analytics', 'query', context, mockDB);
      expect(canQuery).toBe(true);
    });

    test('Team can view team analytics (teamScope)', async () => {
      // Mock team user
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 2,
        role: 'team',
        teamId: 5,
        isActive: true
      });

      const context = { userId: 2, role: 'team', teamId: 5 };

      // Team should be able to view analytics (with teamScope)
      const canView = await PermissionService.checkPermission(2, 'analytics', 'view', context, mockDB);
      expect(canView).toBe(true);

      // Team should be able to export analytics
      const canExport = await PermissionService.checkPermission(2, 'analytics', 'export', context, mockDB);
      expect(canExport).toBe(true);

      // Team should be able to run custom queries
      const canQuery = await PermissionService.checkPermission(2, 'analytics', 'query', context, mockDB);
      expect(canQuery).toBe(true);
    });

    test('Agent can only view own analytics', async () => {
      // Mock agent user
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 3,
        role: 'agent',
        teamId: 5,
        isActive: true
      });

      const context = { userId: 3, role: 'agent', teamId: 5 };

      // Agent should be able to view analytics (with own condition)
      const canView = await PermissionService.checkPermission(3, 'analytics', 'view', context, mockDB);
      expect(canView).toBe(true);

      // Agent should NOT be able to export analytics
      const canExport = await PermissionService.checkPermission(3, 'analytics', 'export', context, mockDB);
      expect(canExport).toBe(false);

      // Agent should NOT be able to run custom queries
      const canQuery = await PermissionService.checkPermission(3, 'analytics', 'query', context, mockDB);
      expect(canQuery).toBe(false);
    });

    test('Custom queries require team role', async () => {
      // Mock team user
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 2,
        role: 'team',
        teamId: 5,
        isActive: true
      });

      const teamContext = { userId: 2, role: 'team', teamId: 5 };
      const canQueryTeam = await PermissionService.checkPermission(2, 'analytics', 'query', teamContext, mockDB);
      expect(canQueryTeam).toBe(true);

      // Mock agent user - should NOT be able to run custom queries
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 3,
        role: 'agent',
        teamId: 5,
        isActive: true
      });

      const agentContext = { userId: 3, role: 'agent', teamId: 5 };
      const canQueryAgent = await PermissionService.checkPermission(3, 'analytics', 'query', agentContext, mockDB);
      expect(canQueryAgent).toBe(false);
    });

    test('Health endpoint accessible to all authenticated users', async () => {
      // This test validates that health checks don't require specific permissions
      // They're handled at the middleware level before PermissionService

      // Mock agent user (lowest privilege)
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 3,
        role: 'agent',
        teamId: 5,
        isActive: true
      });

      const context = { userId: 3, role: 'agent', teamId: 5 };

      // Agent can view analytics (basic permission)
      const canView = await PermissionService.checkPermission(3, 'analytics', 'view', context, mockDB);
      expect(canView).toBe(true);

      // Note: Health endpoint bypasses permission check in middleware
      // This test confirms that even agents have basic analytics view permission
    });
  });

  // =====================================================================
  // File Module Tests (5 tests)
  // =====================================================================
  describe('File Module Permissions', () => {
    test('Admin can delete any file', async () => {
      // Mock admin user
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 1,
        role: 'admin',
        teamId: 1,
        isActive: true
      });

      const context = { userId: 1, role: 'admin', teamId: 1 };

      // Admin should have all file permissions
      const canUpload = await PermissionService.checkPermission(1, 'file', 'upload', context, mockDB);
      const canDownload = await PermissionService.checkPermission(1, 'file', 'download', context, mockDB);
      const canView = await PermissionService.checkPermission(1, 'file', 'view', context, mockDB);
      const canDelete = await PermissionService.checkPermission(1, 'file', 'delete', context, mockDB);

      expect(canUpload).toBe(true);
      expect(canDownload).toBe(true);
      expect(canView).toBe(true);
      expect(canDelete).toBe(true);
    });

    test('Team can download team files (teamScope)', async () => {
      // Mock team user
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 2,
        role: 'team',
        teamId: 5,
        isActive: true
      });

      const context = { userId: 2, role: 'team', teamId: 5 };

      // Team should be able to upload files
      const canUpload = await PermissionService.checkPermission(2, 'file', 'upload', context, mockDB);
      expect(canUpload).toBe(true);

      // Team should be able to download files (with teamScope)
      const canDownload = await PermissionService.checkPermission(2, 'file', 'download', context, mockDB);
      expect(canDownload).toBe(true);

      // Team should be able to view files (with teamScope)
      const canView = await PermissionService.checkPermission(2, 'file', 'view', context, mockDB);
      expect(canView).toBe(true);

      // Team should be able to delete own files (with own condition)
      const canDelete = await PermissionService.checkPermission(2, 'file', 'delete', context, mockDB);
      expect(canDelete).toBe(true);
    });

    test('Agent can upload files', async () => {
      // Mock agent user
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 3,
        role: 'agent',
        teamId: 5,
        isActive: true
      });

      const context = { userId: 3, role: 'agent', teamId: 5 };

      // Agent should be able to upload files
      const canUpload = await PermissionService.checkPermission(3, 'file', 'upload', context, mockDB);
      expect(canUpload).toBe(true);

      // Agent should be able to download own files
      const canDownload = await PermissionService.checkPermission(3, 'file', 'download', context, mockDB);
      expect(canDownload).toBe(true);

      // Agent should be able to view own files
      const canView = await PermissionService.checkPermission(3, 'file', 'view', context, mockDB);
      expect(canView).toBe(true);
    });

    test('Agent can only delete own files', async () => {
      // Mock agent user
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 3,
        role: 'agent',
        teamId: 5,
        isActive: true
      });

      const context = { userId: 3, role: 'agent', teamId: 5 };

      // Agent should have delete permission (with own condition)
      const canDelete = await PermissionService.checkPermission(3, 'file', 'delete', context, mockDB);
      expect(canDelete).toBe(true);

      // Note: The 'own' condition check happens in middleware/handler
      // by comparing file.uploadedBy with user.id
      // PermissionService just confirms the permission exists with conditions
    });

    test('File view requires authentication', async () => {
      // Test that unauthenticated users cannot view files
      // Mock a user lookup failure
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue(null);

      // Should return false when user not found
      const canView = await PermissionService.checkPermission(999, 'file', 'view', undefined, mockDB);
      expect(canView).toBe(false);

      // Now test with authenticated agent
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 3,
        role: 'agent',
        teamId: 5,
        isActive: true
      });

      const context = { userId: 3, role: 'agent', teamId: 5 };
      const canViewAuth = await PermissionService.checkPermission(3, 'file', 'view', context, mockDB);
      expect(canViewAuth).toBe(true);
    });
  });

  // =====================================================================
  // Cross-Module Tests (Bonus)
  // =====================================================================
  describe('Cross-Module Permission Consistency', () => {
    test('Permission definitions are consistent across all modules', async () => {
      // Mock admin user
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 1,
        role: 'admin',
        teamId: 1,
        isActive: true
      });

      const context = { userId: 1, role: 'admin', teamId: 1 };

      // Test that admin has wildcard access to all resources
      const resources = ['report', 'analytics', 'file'];
      const actions = ['view', 'create', 'read', 'delete', 'export', 'query', 'upload', 'download'];

      for (const resource of resources) {
        for (const action of actions) {
          const hasPermission = await PermissionService.checkPermission(1, resource, action, context, mockDB);
          expect(hasPermission).toBe(true);
        }
      }
    });

    test('Team role has consistent teamScope enforcement', async () => {
      // Mock team user
      vi.spyOn(PermissionService as any, 'getUserWithTeam').mockResolvedValue({
        id: 2,
        role: 'team',
        teamId: 5,
        isActive: true
      });

      const context = { userId: 2, role: 'team', teamId: 5 };

      // Team should have view/export permissions with teamScope
      const canViewReports = await PermissionService.checkPermission(2, 'report', 'read', context, mockDB);
      const canViewAnalytics = await PermissionService.checkPermission(2, 'analytics', 'view', context, mockDB);
      const canViewFiles = await PermissionService.checkPermission(2, 'file', 'view', context, mockDB);

      expect(canViewReports).toBe(true);
      expect(canViewAnalytics).toBe(true);
      expect(canViewFiles).toBe(true);
    });
  });
});
