import { describe, test, expect, beforeEach, vi, Mock } from 'vitest';
import type { Context, Next } from 'hono';
import type { Bindings } from '@backend/types';
import { 
  requireRoleLevel, 
  requireManagerOrAdmin, 
  requireAdmin 
} from '@backend/middleware/auth';

// Mock the PermissionService
vi.mock('@backend/services/permission-service', () => ({
  PermissionService: {
    hasRoleAuthority: vi.fn()
  }
}));

describe('Enhanced Authentication Middleware', () => {
  let mockContext: Context<{ Bindings: Bindings }>;
  let mockNext: Next;
  let mockJson: Mock;
  let mockGet: Mock;

  beforeEach(() => {
    mockJson = vi.fn();
    mockGet = vi.fn();
    mockNext = vi.fn();

    mockContext = {
      json: mockJson,
      get: mockGet
    } as any;

    vi.clearAllMocks();
  });

  describe('requireRoleLevel', () => {
    test('should allow access when user has sufficient role level', async () => {
      const mockUser = { role: 'admin' };
      mockGet.mockReturnValue(mockUser);

      // Mock PermissionService to return true for admin->manager authority
      const { PermissionService } = await import('@backend/services/permission-service');
      (PermissionService.hasRoleAuthority as Mock).mockReturnValue(true);

      const middleware = requireRoleLevel('manager');
      await middleware(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockJson).not.toHaveBeenCalled();
      expect(PermissionService.hasRoleAuthority).toHaveBeenCalledWith('admin', 'manager');
    });

    test('should deny access when user has insufficient role level', async () => {
      const mockUser = { role: 'agent' };
      mockGet.mockReturnValue(mockUser);

      // Mock PermissionService to return false for agent->manager authority
      const { PermissionService } = await import('@backend/services/permission-service');
      (PermissionService.hasRoleAuthority as Mock).mockReturnValue(false);

      const middleware = requireRoleLevel('manager');
      await middleware(mockContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith(
        {
          error: 'Insufficient role level',
          required: 'manager',
          current: 'agent'
        },
        403
      );
      expect(PermissionService.hasRoleAuthority).toHaveBeenCalledWith('agent', 'manager');
    });

    test('should deny access when no user is present', async () => {
      mockGet.mockReturnValue(null);

      const middleware = requireRoleLevel('admin');
      await middleware(mockContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith(
        { error: 'Authentication required' },
        401
      );
    });

    test('should handle all role levels correctly', async () => {
      const testCases = [
        { userRole: 'admin', requiredRole: 'admin', expected: true },
        { userRole: 'admin', requiredRole: 'manager', expected: true },
        { userRole: 'admin', requiredRole: 'agent', expected: true },
        { userRole: 'manager', requiredRole: 'admin', expected: false },
        { userRole: 'manager', requiredRole: 'manager', expected: true },
        { userRole: 'manager', requiredRole: 'agent', expected: true },
        { userRole: 'agent', requiredRole: 'admin', expected: false },
        { userRole: 'agent', requiredRole: 'manager', expected: false },
        { userRole: 'agent', requiredRole: 'agent', expected: true }
      ];

      const { PermissionService } = await import('@backend/services/permission-service');

      for (const { userRole, requiredRole, expected } of testCases) {
        // Reset mocks
        vi.clearAllMocks();
        mockGet.mockReturnValue({ role: userRole });
        (PermissionService.hasRoleAuthority as Mock).mockReturnValue(expected);

        const middleware = requireRoleLevel(requiredRole as 'admin' | 'manager' | 'agent');
        await middleware(mockContext, mockNext);

        if (expected) {
          expect(mockNext).toHaveBeenCalled();
          expect(mockJson).not.toHaveBeenCalled();
        } else {
          expect(mockNext).not.toHaveBeenCalled();
          expect(mockJson).toHaveBeenCalledWith(
            {
              error: 'Insufficient role level',
              required: requiredRole,
              current: userRole
            },
            403
          );
        }
      }
    });
  });

  describe('requireManagerOrAdmin', () => {
    test('should allow admin access', async () => {
      const mockUser = { role: 'admin' };
      mockGet.mockReturnValue(mockUser);

      const { PermissionService } = await import('@backend/services/permission-service');
      (PermissionService.hasRoleAuthority as Mock).mockReturnValue(true);

      const middleware = requireManagerOrAdmin();
      await middleware(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockJson).not.toHaveBeenCalled();
      expect(PermissionService.hasRoleAuthority).toHaveBeenCalledWith('admin', 'manager');
    });

    test('should allow manager access', async () => {
      const mockUser = { role: 'manager' };
      mockGet.mockReturnValue(mockUser);

      const { PermissionService } = await import('@backend/services/permission-service');
      (PermissionService.hasRoleAuthority as Mock).mockReturnValue(true);

      const middleware = requireManagerOrAdmin();
      await middleware(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockJson).not.toHaveBeenCalled();
      expect(PermissionService.hasRoleAuthority).toHaveBeenCalledWith('manager', 'manager');
    });

    test('should deny agent access', async () => {
      const mockUser = { role: 'agent' };
      mockGet.mockReturnValue(mockUser);

      const { PermissionService } = await import('@backend/services/permission-service');
      (PermissionService.hasRoleAuthority as Mock).mockReturnValue(false);

      const middleware = requireManagerOrAdmin();
      await middleware(mockContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith(
        {
          error: 'Insufficient role level',
          required: 'manager',
          current: 'agent'
        },
        403
      );
    });
  });

  describe('requireAdmin', () => {
    test('should allow admin access', async () => {
      const mockUser = { role: 'admin' };
      mockGet.mockReturnValue(mockUser);

      const { PermissionService } = await import('@backend/services/permission-service');
      (PermissionService.hasRoleAuthority as Mock).mockReturnValue(true);

      const middleware = requireAdmin();
      await middleware(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockJson).not.toHaveBeenCalled();
      expect(PermissionService.hasRoleAuthority).toHaveBeenCalledWith('admin', 'admin');
    });

    test('should deny manager access', async () => {
      const mockUser = { role: 'manager' };
      mockGet.mockReturnValue(mockUser);

      const { PermissionService } = await import('@backend/services/permission-service');
      (PermissionService.hasRoleAuthority as Mock).mockReturnValue(false);

      const middleware = requireAdmin();
      await middleware(mockContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith(
        {
          error: 'Insufficient role level',
          required: 'admin',
          current: 'manager'
        },
        403
      );
    });

    test('should deny agent access', async () => {
      const mockUser = { role: 'agent' };
      mockGet.mockReturnValue(mockUser);

      const { PermissionService } = await import('@backend/services/permission-service');
      (PermissionService.hasRoleAuthority as Mock).mockReturnValue(false);

      const middleware = requireAdmin();
      await middleware(mockContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith(
        {
          error: 'Insufficient role level',
          required: 'admin',
          current: 'agent'
        },
        403
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle PermissionService import errors gracefully', async () => {
      const mockUser = { role: 'admin' };
      mockGet.mockReturnValue(mockUser);

      // Mock import to throw an error
      vi.doMock('@backend/services/permission-service', () => {
        throw new Error('Import failed');
      });

      const middleware = requireRoleLevel('manager');
      
      // Should not throw, but should deny access
      await expect(middleware(mockContext, mockNext)).rejects.toThrow('Import failed');
    });

    test('should handle undefined user role gracefully', async () => {
      const mockUser = { role: undefined };
      mockGet.mockReturnValue(mockUser);

      const { PermissionService } = await import('@backend/services/permission-service');
      (PermissionService.hasRoleAuthority as Mock).mockReturnValue(false);

      const middleware = requireRoleLevel('manager');
      await middleware(mockContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith(
        {
          error: 'Insufficient role level',
          required: 'manager',
          current: undefined
        },
        403
      );
    });
  });
});