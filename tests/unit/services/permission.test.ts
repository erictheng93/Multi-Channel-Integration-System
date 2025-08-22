import { describe, test, expect, beforeEach, afterAll, vi } from 'vitest';
import { PermissionService } from '../../../src/services/permission-service';

describe('PermissionService', () => {
  // Mock getUserWithTeam method
  const originalGetUserWithTeam = (PermissionService as any).getUserWithTeam;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  afterAll(() => {
    // Restore original method
    (PermissionService as any).getUserWithTeam = originalGetUserWithTeam;
  });

  describe('checkPermission', () => {
    describe('Admin role permissions', () => {
      beforeEach(() => {
        (PermissionService as any).getUserWithTeam = vi.fn().mockResolvedValue({
          id: 1,
          role: 'admin',
          team_id: 1
        });
      });

      test('should allow admin to access any resource with any action', async () => {
        const result = await PermissionService.checkPermission(1, 'conversation', 'view');
        expect(result).toBe(true);
      });

      test('should allow admin to perform any action on any resource', async () => {
        const result = await PermissionService.checkPermission(1, 'user', 'delete');
        expect(result).toBe(true);
      });

      test('should allow admin regardless of context conditions', async () => {
        const result = await PermissionService.checkPermission(
          1, 
          'conversation', 
          'view', 
          { teamId: 999, assignedUserId: 999 }
        );
        expect(result).toBe(true);
      });
    });

    describe('Manager role permissions', () => {
      beforeEach(() => {
        (PermissionService as any).getUserWithTeam = vi.fn().mockResolvedValue({
          id: 2,
          role: 'manager',
          team_id: 1
        });
      });

      test('should allow manager to view conversations in their team', async () => {
        const result = await PermissionService.checkPermission(
          2, 
          'conversation', 
          'view', 
          { teamId: 1 }
        );
        expect(result).toBe(true);
      });

      test('should deny manager to view conversations outside their team', async () => {
        const result = await PermissionService.checkPermission(
          2, 
          'conversation', 
          'view', 
          { teamId: 2 }
        );
        expect(result).toBe(false);
      });

      test('should allow manager to assign conversations', async () => {
        const result = await PermissionService.checkPermission(2, 'conversation', 'assign');
        expect(result).toBe(true);
      });

      test('should allow manager to transfer conversations', async () => {
        const result = await PermissionService.checkPermission(2, 'conversation', 'transfer');
        expect(result).toBe(true);
      });

      test('should allow manager to manage their own team', async () => {
        const result = await PermissionService.checkPermission(
          2, 
          'team', 
          'manage', 
          { teamId: 1 }
        );
        expect(result).toBe(true);
      });

      test('should deny manager to manage other teams', async () => {
        const result = await PermissionService.checkPermission(
          2, 
          'team', 
          'manage', 
          { teamId: 2 }
        );
        expect(result).toBe(false);
      });

      test('should allow manager to generate QR codes', async () => {
        const result = await PermissionService.checkPermission(2, 'qrcode', 'generate');
        expect(result).toBe(true);
      });

      test('should allow manager all tag actions in team scope', async () => {
        const result = await PermissionService.checkPermission(
          2, 
          'tag', 
          'delete', 
          { teamId: 1 }
        );
        expect(result).toBe(true);
      });

      test('should deny manager tag actions outside team scope', async () => {
        const result = await PermissionService.checkPermission(
          2, 
          'tag', 
          'delete', 
          { teamId: 2 }
        );
        expect(result).toBe(false);
      });

      test('should deny manager unauthorized actions', async () => {
        const result = await PermissionService.checkPermission(2, 'user', 'delete');
        expect(result).toBe(false);
      });
    });

    describe('Agent role permissions', () => {
      beforeEach(() => {
        (PermissionService as any).getUserWithTeam = vi.fn().mockResolvedValue({
          id: 3,
          role: 'agent',
          team_id: 1
        });
      });

      test('should allow agent to view assigned conversations', async () => {
        const result = await PermissionService.checkPermission(
          3, 
          'conversation', 
          'view', 
          { assignedUserId: 3 }
        );
        expect(result).toBe(true);
      });

      test('should deny agent to view non-assigned conversations', async () => {
        const result = await PermissionService.checkPermission(
          3, 
          'conversation', 
          'view', 
          { assignedUserId: 4 }
        );
        expect(result).toBe(false);
      });

      test('should allow agent to reply to conversations', async () => {
        const result = await PermissionService.checkPermission(3, 'conversation', 'reply');
        expect(result).toBe(true);
      });

      test('should allow agent to send messages', async () => {
        const result = await PermissionService.checkPermission(3, 'message', 'send');
        expect(result).toBe(true);
      });

      test('should allow agent to recall their own messages', async () => {
        const result = await PermissionService.checkPermission(
          3, 
          'message', 
          'recall', 
          { ownerId: 3 }
        );
        expect(result).toBe(true);
      });

      test('should deny agent to recall others messages', async () => {
        const result = await PermissionService.checkPermission(
          3, 
          'message', 
          'recall', 
          { ownerId: 4 }
        );
        expect(result).toBe(false);
      });

      test('should allow agent to add tags in team scope', async () => {
        const result = await PermissionService.checkPermission(
          3, 
          'tag', 
          'add', 
          { teamId: 1 }
        );
        expect(result).toBe(true);
      });

      test('should deny agent to add tags outside team scope', async () => {
        const result = await PermissionService.checkPermission(
          3, 
          'tag', 
          'add', 
          { teamId: 2 }
        );
        expect(result).toBe(false);
      });

      test('should deny agent unauthorized actions', async () => {
        const result = await PermissionService.checkPermission(3, 'conversation', 'assign');
        expect(result).toBe(false);
      });
    });

    describe('Edge cases', () => {
      test('should return false for non-existent user', async () => {
        (PermissionService as any).getUserWithTeam = vi.fn().mockResolvedValue(null);
        
        const result = await PermissionService.checkPermission(999, 'conversation', 'view');
        expect(result).toBe(false);
      });

      test('should return false for invalid role', async () => {
        (PermissionService as any).getUserWithTeam = vi.fn().mockResolvedValue({
          id: 1,
          role: 'invalid_role',
          team_id: 1
        });
        
        const result = await PermissionService.checkPermission(1, 'conversation', 'view');
        expect(result).toBe(false);
      });

      test('should handle missing context gracefully', async () => {
        (PermissionService as any).getUserWithTeam = vi.fn().mockResolvedValue({
          id: 3,
          role: 'agent',
          team_id: 1
        });
        
        const result = await PermissionService.checkPermission(3, 'conversation', 'view');
        expect(result).toBe(false); // Should fail because assigned condition is not met
      });

      test('should handle empty context object', async () => {
        (PermissionService as any).getUserWithTeam = vi.fn().mockResolvedValue({
          id: 2,
          role: 'manager',
          team_id: 1
        });
        
        const result = await PermissionService.checkPermission(2, 'conversation', 'view', {});
        expect(result).toBe(false); // Should fail because teamScope condition is not met
      });
    });
  });

  describe('getVisibleConversations', () => {
    test('should return empty array for admin (placeholder)', async () => {
      (PermissionService as any).getUserWithTeam = vi.fn().mockResolvedValue({
        id: 1,
        role: 'admin',
        team_id: 1
      });
      
      const result = await PermissionService.getVisibleConversations(1);
      expect(result).toEqual([]);
    });

    test('should return empty array for manager (placeholder)', async () => {
      (PermissionService as any).getUserWithTeam = vi.fn().mockResolvedValue({
        id: 2,
        role: 'manager',
        team_id: 1
      });
      
      const result = await PermissionService.getVisibleConversations(2);
      expect(result).toEqual([]);
    });

    test('should return empty array for agent (placeholder)', async () => {
      (PermissionService as any).getUserWithTeam = vi.fn().mockResolvedValue({
        id: 3,
        role: 'agent',
        team_id: 1
      });
      
      const result = await PermissionService.getVisibleConversations(3);
      expect(result).toEqual([]);
    });

    test('should return empty array for non-existent user', async () => {
      (PermissionService as any).getUserWithTeam = vi.fn().mockResolvedValue(null);
      
      const result = await PermissionService.getVisibleConversations(999);
      expect(result).toEqual([]);
    });

    test('should return empty array for invalid role', async () => {
      (PermissionService as any).getUserWithTeam = vi.fn().mockResolvedValue({
        id: 1,
        role: 'invalid_role',
        team_id: 1
      });
      
      const result = await PermissionService.getVisibleConversations(1);
      expect(result).toEqual([]);
    });
  });

  describe('Role Hierarchy Methods', () => {
    describe('hasRoleAuthority', () => {
      test('should allow admin to have authority over manager', () => {
        const result = PermissionService.hasRoleAuthority('admin', 'manager');
        expect(result).toBe(true);
      });

      test('should allow admin to have authority over agent', () => {
        const result = PermissionService.hasRoleAuthority('admin', 'agent');
        expect(result).toBe(true);
      });

      test('should allow admin to have authority over admin (same level)', () => {
        const result = PermissionService.hasRoleAuthority('admin', 'admin');
        expect(result).toBe(true);
      });

      test('should allow manager to have authority over agent', () => {
        const result = PermissionService.hasRoleAuthority('manager', 'agent');
        expect(result).toBe(true);
      });

      test('should allow manager to have authority over manager (same level)', () => {
        const result = PermissionService.hasRoleAuthority('manager', 'manager');
        expect(result).toBe(true);
      });

      test('should deny manager authority over admin', () => {
        const result = PermissionService.hasRoleAuthority('manager', 'admin');
        expect(result).toBe(false);
      });

      test('should allow agent to have authority over agent (same level)', () => {
        const result = PermissionService.hasRoleAuthority('agent', 'agent');
        expect(result).toBe(true);
      });

      test('should deny agent authority over manager', () => {
        const result = PermissionService.hasRoleAuthority('agent', 'manager');
        expect(result).toBe(false);
      });

      test('should deny agent authority over admin', () => {
        const result = PermissionService.hasRoleAuthority('agent', 'admin');
        expect(result).toBe(false);
      });

      test('should return false for invalid user role', () => {
        const result = PermissionService.hasRoleAuthority('invalid', 'agent');
        expect(result).toBe(false);
      });

      test('should return false for invalid required role', () => {
        const result = PermissionService.hasRoleAuthority('admin', 'invalid');
        expect(result).toBe(false);
      });

      test('should handle both roles being invalid', () => {
        const result = PermissionService.hasRoleAuthority('invalid1', 'invalid2');
        expect(result).toBe(false);
      });
    });

    describe('getManagedRoles', () => {
      test('should return manager and agent for admin', () => {
        const result = PermissionService.getManagedRoles('admin');
        expect(result).toEqual(expect.arrayContaining(['manager', 'agent']));
        expect(result).toHaveLength(2);
      });

      test('should return only agent for manager', () => {
        const result = PermissionService.getManagedRoles('manager');
        expect(result).toEqual(['agent']);
      });

      test('should return empty array for agent', () => {
        const result = PermissionService.getManagedRoles('agent');
        expect(result).toEqual([]);
      });

      test('should return empty array for invalid role', () => {
        const result = PermissionService.getManagedRoles('invalid');
        expect(result).toEqual([]);
      });

      test('should not include the role itself in managed roles', () => {
        const adminResult = PermissionService.getManagedRoles('admin');
        expect(adminResult).not.toContain('admin');

        const managerResult = PermissionService.getManagedRoles('manager');
        expect(managerResult).not.toContain('manager');
      });
    });
  });

  describe('Enhanced Manager Permissions', () => {
    beforeEach(() => {
      (PermissionService as any).getUserWithTeam = vi.fn().mockResolvedValue({
        id: 2,
        role: 'manager',
        teamId: 1,
        team_id: 1
      });
    });

    test('should allow manager to close conversations', async () => {
      const result = await PermissionService.checkPermission(2, 'conversation', 'close');
      expect(result).toBe(true);
    });

    test('should allow manager to reopen conversations', async () => {
      const result = await PermissionService.checkPermission(2, 'conversation', 'reopen');
      expect(result).toBe(true);
    });

    test('should allow manager to view team agents', async () => {
      const result = await PermissionService.checkPermission(
        2, 
        'agent', 
        'view', 
        { teamId: 1 }
      );
      expect(result).toBe(true);
    });

    test('should allow manager to invite agents to team', async () => {
      const result = await PermissionService.checkPermission(
        2, 
        'agent', 
        'invite', 
        { teamId: 1 }
      );
      expect(result).toBe(true);
    });

    test('should allow manager to view team customers', async () => {
      const result = await PermissionService.checkPermission(
        2, 
        'customer', 
        'view', 
        { teamId: 1 }
      );
      expect(result).toBe(true);
    });

    test('should allow manager to edit team customers', async () => {
      const result = await PermissionService.checkPermission(
        2, 
        'customer', 
        'edit', 
        { teamId: 1 }
      );
      expect(result).toBe(true);
    });

    test('should allow manager to tag team customers', async () => {
      const result = await PermissionService.checkPermission(
        2, 
        'customer', 
        'tag', 
        { teamId: 1 }
      );
      expect(result).toBe(true);
    });

    test('should allow manager to view team messages', async () => {
      const result = await PermissionService.checkPermission(
        2, 
        'message', 
        'view', 
        { teamId: 1 }
      );
      expect(result).toBe(true);
    });

    test('should allow manager to recall team messages', async () => {
      const result = await PermissionService.checkPermission(
        2, 
        'message', 
        'recall', 
        { teamId: 1 }
      );
      expect(result).toBe(true);
    });

    test('should allow manager to view team analytics', async () => {
      const result = await PermissionService.checkPermission(
        2, 
        'analytics', 
        'view', 
        { teamId: 1 }
      );
      expect(result).toBe(true);
    });

    test('should allow manager to generate team reports', async () => {
      const result = await PermissionService.checkPermission(
        2, 
        'report', 
        'generate', 
        { teamId: 1 }
      );
      expect(result).toBe(true);
    });

    test('should deny manager access to other team resources', async () => {
      const result = await PermissionService.checkPermission(
        2, 
        'customer', 
        'view', 
        { teamId: 2 }
      );
      expect(result).toBe(false);
    });
  });
});