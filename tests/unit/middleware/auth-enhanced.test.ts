import { describe, test, expect, beforeEach, vi, Mock } from 'vitest';
import type { Context, Next } from 'hono';
import type { Bindings } from '@backend/types';
import { 
  requireRoleLevel, 
  requireManagerOrAdmin, 
  requireAdmin 
} from '@backend/middleware/auth';

import { MockFactory } from '@helpers/mockFactory';
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


  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe('requireRoleLevel', () => {
    test('should allow access when user has sufficient role level', async () => {
      const mockUser = { role: 'admin' };
      mockGet.mockReturnValue(mockUser);

      // Mock PermissionService to return true for admin->agent authority
      const { PermissionService } = await import('@backend/services/permission-service');
      (PermissionService.hasRoleAuthority as Mock).mockReturnValue(true);

      const middleware = requireRoleLevel('agent');
      await middleware(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockJson).not.toHaveBeenCalled();
      expect(PermissionService.hasRoleAuthority).toHaveBeenCalledWith('admin', 'agent');
    });

    test('should deny access when user has insufficient role level', async () => {
      const mockUser = { role: 'agent' };
      mockGet.mockReturnValue(mockUser);

      // Mock PermissionService to return false for agent->admin authority
      const { PermissionService } = await import('@backend/services/permission-service');
      (PermissionService.hasRoleAuthority as Mock).mockReturnValue(false);

      const middleware = requireRoleLevel('admin');
      await middleware(mockContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Insufficient role level',
          required: 'admin',
          current: 'agent'
        }),
        403
      );
      expect(PermissionService.hasRoleAuthority).toHaveBeenCalledWith('agent', 'admin');
    });

    test('should deny access when no user is present', async () => {
      mockGet.mockReturnValue(null);

      const middleware = requireRoleLevel('admin');
      await middleware(mockContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Authentication required'
        }),
        401
      );
    });

    test('should handle all role levels correctly', async () => {
      // 2-tier role system: admin and agent only
      const testCases = [
        { userRole: 'admin', requiredRole: 'admin', expected: true },
        { userRole: 'admin', requiredRole: 'agent', expected: true },
        { userRole: 'agent', requiredRole: 'admin', expected: false },
        { userRole: 'agent', requiredRole: 'agent', expected: true }
      ];

      const { PermissionService } = await import('@backend/services/permission-service');

      for (const { userRole, requiredRole, expected } of testCases) {
        // Reset mocks
        vi.clearAllMocks();
        mockGet.mockReturnValue({ role: userRole });
        (PermissionService.hasRoleAuthority as Mock).mockReturnValue(expected);

        const middleware = requireRoleLevel(requiredRole as 'admin' | 'agent');
        await middleware(mockContext, mockNext);

        if (expected) {
          expect(mockNext).toHaveBeenCalled();
          expect(mockJson).not.toHaveBeenCalled();
        } else {
          expect(mockNext).not.toHaveBeenCalled();
          expect(mockJson).toHaveBeenCalledWith(
            expect.objectContaining({
              error: 'Insufficient role level',
              required: requiredRole,
              current: userRole
            }),
            403
          );
        }
      }
    });
  });

  describe('requireManagerOrAdmin', () => {
    // Note: requireManagerOrAdmin() is now equivalent to requireAdmin() in 2-tier system
    test('should allow admin access', async () => {
      const mockUser = { role: 'admin' };
      mockGet.mockReturnValue(mockUser);

      const { PermissionService } = await import('@backend/services/permission-service');
      (PermissionService.hasRoleAuthority as Mock).mockReturnValue(true);

      const middleware = requireManagerOrAdmin();
      await middleware(mockContext, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockJson).not.toHaveBeenCalled();
      // In 2-tier system, requireManagerOrAdmin checks for admin role
      expect(PermissionService.hasRoleAuthority).toHaveBeenCalledWith('admin', 'admin');
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
        expect.objectContaining({
          error: 'Insufficient role level',
          required: 'admin',
          current: 'agent'
        }),
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

    test('should deny agent access', async () => {
      const mockUser = { role: 'agent' };
      mockGet.mockReturnValue(mockUser);

      const { PermissionService } = await import('@backend/services/permission-service');
      (PermissionService.hasRoleAuthority as Mock).mockReturnValue(false);

      const middleware = requireAdmin();
      await middleware(mockContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Insufficient role level',
          required: 'admin',
          current: 'agent'
        }),
        403
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle undefined user role gracefully', async () => {
      const mockUser = { role: undefined };
      mockGet.mockReturnValue(mockUser);

      const { PermissionService } = await import('@backend/services/permission-service');
      (PermissionService.hasRoleAuthority as Mock).mockReturnValue(false);

      const middleware = requireRoleLevel('admin');
      await middleware(mockContext, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Insufficient role level',
          required: 'admin',
          current: undefined
        }),
        403
      );
    });
  });
});