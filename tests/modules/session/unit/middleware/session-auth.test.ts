// Session 權限中間件測試
// Session authentication middleware tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import {
  checkSessionAccess,
  checkSessionViewPermission,
  checkSessionCreatePermission,
  checkSessionUpdatePermission,
  checkSessionDeletePermission,
  checkSessionStatsPermission,
  checkSessionBatchPermission,
  logSessionOperation
} from '../../../../../src/modules/session/middleware/session-auth';
import { mockJwtPayloads } from '../../helpers/mock-data';
import type { Bindings } from '@shared/types';

// ======================== Mock Setup ========================

// Mock JWT verification
const mockVerifyJWT = vi.fn();
vi.mock('../../../../../src/utils/auth', () => ({
  verifyJWT: mockVerifyJWT
}));

describe('Session Authentication Middleware', () => {
  let app: Hono<{ Bindings: Bindings }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Bindings }>();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ======================== 基礎權限檢查測試 ========================

  describe('checkSessionAccess', () => {
    beforeEach(() => {
      app.get('/test', checkSessionAccess, (c) => {
        const payload = c.get('jwtPayload');
        return c.json({ success: true, user: payload.username });
      });
    });

    it('should allow access with valid Bearer token', async () => {
      mockVerifyJWT.mockResolvedValue(mockJwtPayloads.admin);

      const response = await app.request('/test', {
        headers: {
          'Authorization': 'Bearer valid_token'
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user).toBe('admin');

      expect(mockVerifyJWT).toHaveBeenCalledWith('valid_token', undefined);
    });

    it('should reject request without Authorization header', async () => {
      const response = await app.request('/test');

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Missing or invalid authorization header');
      expect(data.timestamp).toBeDefined();
    });

    it('should reject request with invalid Authorization format', async () => {
      const response = await app.request('/test', {
        headers: {
          'Authorization': 'Basic invalid_format'
        }
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Missing or invalid authorization header');
    });

    it('should reject request with invalid JWT token', async () => {
      mockVerifyJWT.mockResolvedValue(null);

      const response = await app.request('/test', {
        headers: {
          'Authorization': 'Bearer invalid_token'
        }
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid or expired token');
    });

    it('should reject request with expired JWT token', async () => {
      mockVerifyJWT.mockResolvedValue(mockJwtPayloads.expired);

      const response = await app.request('/test', {
        headers: {
          'Authorization': 'Bearer expired_token'
        }
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid or expired token');
    });

    it('should handle JWT verification errors', async () => {
      mockVerifyJWT.mockRejectedValue(new Error('JWT verification failed'));

      const response = await app.request('/test', {
        headers: {
          'Authorization': 'Bearer error_token'
        }
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication failed');
    });
  });

  // ======================== 具體權限檢查測試 ========================

  describe('checkSessionViewPermission', () => {
    beforeEach(() => {
      app.get('/test', (c, next) => {
        c.set('jwtPayload', c.req.header('mock-payload') ?
          JSON.parse(c.req.header('mock-payload')!) : null);
        return next();
      }, checkSessionViewPermission, (c) => {
        return c.json({ success: true, message: 'View access granted' });
      });
    });

    it('should allow admin to view sessions', async () => {
      const response = await app.request('/test', {
        headers: {
          'mock-payload': JSON.stringify(mockJwtPayloads.admin)
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('View access granted');
    });

    it('should allow team lead to view sessions', async () => {
      const response = await app.request('/test', {
        headers: {
          'mock-payload': JSON.stringify(mockJwtPayloads.teamLead)
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should allow agent to view sessions', async () => {
      const response = await app.request('/test', {
        headers: {
          'mock-payload': JSON.stringify(mockJwtPayloads.agent)
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should reject request without authentication', async () => {
      const response = await app.request('/test');

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication required');
    });

    it('should reject user with invalid role', async () => {
      const invalidUser = { ...mockJwtPayloads.admin, role: 'guest' };

      const response = await app.request('/test', {
        headers: {
          'mock-payload': JSON.stringify(invalidUser)
        }
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Insufficient permissions to view sessions');
    });
  });

  describe('checkSessionCreatePermission', () => {
    beforeEach(() => {
      app.post('/test', (c, next) => {
        c.set('jwtPayload', c.req.header('mock-payload') ?
          JSON.parse(c.req.header('mock-payload')!) : null);
        return next();
      }, checkSessionCreatePermission, (c) => {
        return c.json({ success: true, message: 'Create access granted' });
      });
    });

    it('should allow all valid roles to create sessions', async () => {
      const validRoles = [mockJwtPayloads.admin, mockJwtPayloads.teamLead, mockJwtPayloads.agent];

      for (const payload of validRoles) {
        const response = await app.request('/test', {
          method: 'POST',
          headers: {
            'mock-payload': JSON.stringify(payload)
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.message).toBe('Create access granted');
      }
    });

    it('should reject invalid roles', async () => {
      const invalidUser = { ...mockJwtPayloads.admin, role: 'guest' };

      const response = await app.request('/test', {
        method: 'POST',
        headers: {
          'mock-payload': JSON.stringify(invalidUser)
        }
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Insufficient permissions to create sessions');
    });
  });

  describe('checkSessionUpdatePermission', () => {
    beforeEach(() => {
      app.put('/test', (c, next) => {
        c.set('jwtPayload', c.req.header('mock-payload') ?
          JSON.parse(c.req.header('mock-payload')!) : null);
        return next();
      }, checkSessionUpdatePermission, (c) => {
        return c.json({ success: true, message: 'Update access granted' });
      });
    });

    it('should allow admin to update sessions', async () => {
      const response = await app.request('/test', {
        method: 'PUT',
        headers: {
          'mock-payload': JSON.stringify(mockJwtPayloads.admin)
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should allow team lead to update sessions', async () => {
      const response = await app.request('/test', {
        method: 'PUT',
        headers: {
          'mock-payload': JSON.stringify(mockJwtPayloads.teamLead)
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should allow agent to update sessions (with restrictions)', async () => {
      // Note: Real implementation should check conversation access for agents
      const response = await app.request('/test', {
        method: 'PUT',
        headers: {
          'mock-payload': JSON.stringify(mockJwtPayloads.agent)
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should reject invalid roles', async () => {
      const invalidUser = { ...mockJwtPayloads.admin, role: 'guest' };

      const response = await app.request('/test', {
        method: 'PUT',
        headers: {
          'mock-payload': JSON.stringify(invalidUser)
        }
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Insufficient permissions to update sessions');
    });
  });

  describe('checkSessionDeletePermission', () => {
    beforeEach(() => {
      app.delete('/test', (c, next) => {
        c.set('jwtPayload', c.req.header('mock-payload') ?
          JSON.parse(c.req.header('mock-payload')!) : null);
        return next();
      }, checkSessionDeletePermission, (c) => {
        return c.json({ success: true, message: 'Delete access granted' });
      });
    });

    it('should allow only admin to delete sessions', async () => {
      const response = await app.request('/test', {
        method: 'DELETE',
        headers: {
          'mock-payload': JSON.stringify(mockJwtPayloads.admin)
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Delete access granted');
    });

    it('should reject team lead for delete operations', async () => {
      const response = await app.request('/test', {
        method: 'DELETE',
        headers: {
          'mock-payload': JSON.stringify(mockJwtPayloads.teamLead)
        }
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Only administrators can delete sessions');
    });

    it('should reject agent for delete operations', async () => {
      const response = await app.request('/test', {
        method: 'DELETE',
        headers: {
          'mock-payload': JSON.stringify(mockJwtPayloads.agent)
        }
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Only administrators can delete sessions');
    });
  });

  describe('checkSessionStatsPermission', () => {
    beforeEach(() => {
      app.get('/test', (c, next) => {
        c.set('jwtPayload', c.req.header('mock-payload') ?
          JSON.parse(c.req.header('mock-payload')!) : null);
        return next();
      }, checkSessionStatsPermission, (c) => {
        return c.json({ success: true, message: 'Stats access granted' });
      });
    });

    it('should allow admin to view statistics', async () => {
      const response = await app.request('/test', {
        headers: {
          'mock-payload': JSON.stringify(mockJwtPayloads.admin)
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should allow team lead to view statistics', async () => {
      const response = await app.request('/test', {
        headers: {
          'mock-payload': JSON.stringify(mockJwtPayloads.teamLead)
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should reject agent for statistics access', async () => {
      const response = await app.request('/test', {
        headers: {
          'mock-payload': JSON.stringify(mockJwtPayloads.agent)
        }
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Insufficient permissions to view session statistics');
    });
  });

  describe('checkSessionBatchPermission', () => {
    beforeEach(() => {
      app.post('/test', (c, next) => {
        c.set('jwtPayload', c.req.header('mock-payload') ?
          JSON.parse(c.req.header('mock-payload')!) : null);
        return next();
      }, checkSessionBatchPermission, (c) => {
        return c.json({ success: true, message: 'Batch access granted' });
      });
    });

    it('should allow admin for batch operations', async () => {
      const response = await app.request('/test', {
        method: 'POST',
        headers: {
          'mock-payload': JSON.stringify(mockJwtPayloads.admin)
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should allow team lead for batch operations', async () => {
      const response = await app.request('/test', {
        method: 'POST',
        headers: {
          'mock-payload': JSON.stringify(mockJwtPayloads.teamLead)
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should reject agent for batch operations', async () => {
      const response = await app.request('/test', {
        method: 'POST',
        headers: {
          'mock-payload': JSON.stringify(mockJwtPayloads.agent)
        }
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Insufficient permissions for batch operations');
    });
  });

  // ======================== 日誌記錄中間件測試 ========================

  describe('logSessionOperation', () => {
    let consoleSpy: any;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      app.get('/test', (c, next) => {
        c.set('jwtPayload', mockJwtPayloads.admin);
        return next();
      }, logSessionOperation, (c) => {
        return c.json({ success: true, message: 'Operation completed' });
      });

      app.get('/test-error', (c, next) => {
        c.set('jwtPayload', mockJwtPayloads.admin);
        return next();
      }, logSessionOperation, (c) => {
        throw new Error('Test operation error');
      });
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log successful operations', async () => {
      const response = await app.request('/test');

      expect(response.status).toBe(200);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session operation started: GET /test by user admin_001')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session operation completed: GET /test in')
      );
    });

    it('should log failed operations', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(app.request('/test-error')).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session operation failed: GET /test-error after'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle missing user information', async () => {
      app.get('/test-no-user', logSessionOperation, (c) => {
        return c.json({ success: true });
      });

      const response = await app.request('/test-no-user');

      expect(response.status).toBe(200);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session operation started: GET /test-no-user by user unknown')
      );
    });

    it('should measure operation duration', async () => {
      app.get('/test-delay', (c, next) => {
        c.set('jwtPayload', mockJwtPayloads.admin);
        return next();
      }, logSessionOperation, async (c) => {
        // Add small delay to test duration measurement
        await new Promise(resolve => setTimeout(resolve, 50));
        return c.json({ success: true });
      });

      const response = await app.request('/test-delay');

      expect(response.status).toBe(200);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Session operation completed: GET \/test-delay in \d+ms/)
      );
    });
  });

  // ======================== 中間件組合測試 ========================

  describe('Middleware Chaining', () => {
    beforeEach(() => {
      app.get('/protected',
        checkSessionAccess,
        checkSessionViewPermission,
        logSessionOperation,
        (c) => {
          const payload = c.get('jwtPayload');
          return c.json({
            success: true,
            user: payload.username,
            role: payload.role
          });
        }
      );
    });

    it('should pass through all middleware with valid token', async () => {
      mockVerifyJWT.mockResolvedValue(mockJwtPayloads.admin);

      const response = await app.request('/protected', {
        headers: {
          'Authorization': 'Bearer valid_admin_token'
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user).toBe('admin');
      expect(data.role).toBe('admin');
    });

    it('should fail at first middleware with invalid token', async () => {
      mockVerifyJWT.mockResolvedValue(null);

      const response = await app.request('/protected', {
        headers: {
          'Authorization': 'Bearer invalid_token'
        }
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid or expired token');
    });

    it('should fail at permission check with insufficient role', async () => {
      const guestUser = { ...mockJwtPayloads.admin, role: 'guest' };
      mockVerifyJWT.mockResolvedValue(guestUser);

      const response = await app.request('/protected', {
        headers: {
          'Authorization': 'Bearer guest_token'
        }
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Insufficient permissions to view sessions');
    });
  });

  // ======================== 錯誤處理測試 ========================

  describe('Error Handling', () => {
    it('should handle middleware exceptions gracefully', async () => {
      // Mock JWT verification to throw error
      mockVerifyJWT.mockRejectedValue(new Error('JWT service unavailable'));

      app.get('/error-test', checkSessionAccess, (c) => {
        return c.json({ success: true });
      });

      const response = await app.request('/error-test', {
        headers: {
          'Authorization': 'Bearer any_token'
        }
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication failed');
    });

    it('should handle malformed JWT payload', async () => {
      app.get('/malformed-test', (c, next) => {
        c.set('jwtPayload', { invalid: 'payload' }); // Missing required fields
        return next();
      }, checkSessionViewPermission, (c) => {
        return c.json({ success: true });
      });

      const response = await app.request('/malformed-test');

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should provide consistent error response format', async () => {
      const errorEndpoints = [
        { path: '/auth-error', middleware: checkSessionAccess },
        { path: '/view-error', middleware: checkSessionViewPermission },
        { path: '/create-error', middleware: checkSessionCreatePermission },
        { path: '/update-error', middleware: checkSessionUpdatePermission },
        { path: '/delete-error', middleware: checkSessionDeletePermission },
        { path: '/stats-error', middleware: checkSessionStatsPermission },
        { path: '/batch-error', middleware: checkSessionBatchPermission }
      ];

      for (const endpoint of errorEndpoints) {
        app.get(endpoint.path, endpoint.middleware, (c) => c.json({ success: true }));

        const response = await app.request(endpoint.path);
        const data = await response.json();

        // All error responses should have consistent format
        expect(data).toHaveProperty('success', false);
        expect(data).toHaveProperty('error');
        expect(data).toHaveProperty('timestamp');
        expect(typeof data.timestamp).toBe('string');
      }
    });
  });

  // ======================== 角色階層測試 ========================

  describe('Role Hierarchy', () => {
    const roleTests = [
      {
        role: 'admin',
        payload: mockJwtPayloads.admin,
        permissions: {
          view: true,
          create: true,
          update: true,
          delete: true,
          stats: true,
          batch: true
        }
      },
      {
        role: 'team',
        payload: mockJwtPayloads.teamLead,
        permissions: {
          view: true,
          create: true,
          update: true,
          delete: false,
          stats: true,
          batch: true
        }
      },
      {
        role: 'agent',
        payload: mockJwtPayloads.agent,
        permissions: {
          view: true,
          create: true,
          update: true,
          delete: false,
          stats: false,
          batch: false
        }
      }
    ];

    for (const roleTest of roleTests) {
      describe(`${roleTest.role} permissions`, () => {
        const middlewareTests = [
          { name: 'view', middleware: checkSessionViewPermission, expected: roleTest.permissions.view },
          { name: 'create', middleware: checkSessionCreatePermission, expected: roleTest.permissions.create },
          { name: 'update', middleware: checkSessionUpdatePermission, expected: roleTest.permissions.update },
          { name: 'delete', middleware: checkSessionDeletePermission, expected: roleTest.permissions.delete },
          { name: 'stats', middleware: checkSessionStatsPermission, expected: roleTest.permissions.stats },
          { name: 'batch', middleware: checkSessionBatchPermission, expected: roleTest.permissions.batch }
        ];

        for (const test of middlewareTests) {
          it(`should ${test.expected ? 'allow' : 'deny'} ${test.name} permission for ${roleTest.role}`, async () => {
            app.get(`/test-${test.name}`, (c, next) => {
              c.set('jwtPayload', roleTest.payload);
              return next();
            }, test.middleware, (c) => {
              return c.json({ success: true, permission: test.name });
            });

            const response = await app.request(`/test-${test.name}`);

            if (test.expected) {
              expect(response.status).toBe(200);
              const data = await response.json();
              expect(data.success).toBe(true);
            } else {
              expect(response.status).toBe(403);
              const data = await response.json();
              expect(data.success).toBe(false);
            }
          });
        }
      });
    }
  });
});