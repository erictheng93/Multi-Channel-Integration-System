// Session 中間件整合測試
// Session middleware integration tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import {
  checkSessionAccess,
  checkSessionViewPermission,
  checkSessionCreatePermission,
  logSessionOperation
} from '../../../../../src/modules/session/middleware/session-auth';
import {
  validateRequestSize,
  validateSessionId,
  validateCreateSessionData,
  validateSessionListQuery
} from '../../../../../src/modules/session/middleware/session-validation';
import { createMockCreateSessionData } from '../../helpers/session-test-helpers';
import { mockJwtPayloads } from '../../helpers/mock-data';
import type { Bindings } from '@shared/types';

// ======================== Mock Setup ========================

const mockVerifyJWT = vi.fn();
vi.mock('../../../../../src/utils/auth', () => ({
  verifyJWT: mockVerifyJWT
}));

describe('Session Middleware Integration', () => {
  let app: Hono<{ Bindings: Bindings }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Bindings }>();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ======================== 完整中間件鏈測試 ========================

  describe('Complete Middleware Chain', () => {
    describe('Session Creation Flow', () => {
      beforeEach(() => {
        app.post('/sessions',
          validateRequestSize,
          validateCreateSessionData,
          checkSessionAccess,
          checkSessionCreatePermission,
          logSessionOperation,
          (c) => {
            const createData = c.get('createSessionData');
            const payload = c.get('jwtPayload');
            return c.json({
              success: true,
              data: createData,
              user: payload.username
            });
          }
        );
      });

      it('should pass through all middleware with valid request', async () => {
        mockVerifyJWT.mockResolvedValue(mockJwtPayloads.admin);
        const validData = createMockCreateSessionData();

        const response = await app.request('/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid_token',
            'Content-Length': '500'
          },
          body: JSON.stringify(validData)
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.user).toBe('admin');
        expect(data.data.conversationId).toBe(validData.conversationId);
      });

      it('should fail at request size validation', async () => {
        const validData = createMockCreateSessionData();

        const response = await app.request('/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': '2000000' // Too large
          },
          body: JSON.stringify(validData)
        });

        expect(response.status).toBe(413);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Request size too large (max 1MB)');
      });

      it('should fail at data validation', async () => {
        mockVerifyJWT.mockResolvedValue(mockJwtPayloads.admin);

        const invalidData = {
          // Missing required fields
          topic: 'Test Topic'
        };

        const response = await app.request('/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid_token'
          },
          body: JSON.stringify(invalidData)
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('conversationId is required');
      });

      it('should fail at authentication', async () => {
        mockVerifyJWT.mockResolvedValue(null);
        const validData = createMockCreateSessionData();

        const response = await app.request('/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer invalid_token'
          },
          body: JSON.stringify(validData)
        });

        expect(response.status).toBe(401);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid or expired token');
      });

      it('should fail at permission check', async () => {
        const guestUser = { ...mockJwtPayloads.admin, role: 'guest' };
        mockVerifyJWT.mockResolvedValue(guestUser);
        const validData = createMockCreateSessionData();

        const response = await app.request('/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer guest_token'
          },
          body: JSON.stringify(validData)
        });

        expect(response.status).toBe(403);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Insufficient permissions to create sessions');
      });
    });

    describe('Session Retrieval Flow', () => {
      beforeEach(() => {
        app.get('/sessions',
          validateSessionListQuery,
          checkSessionAccess,
          checkSessionViewPermission,
          logSessionOperation,
          (c) => {
            const query = c.get('sessionQuery');
            const payload = c.get('jwtPayload');
            return c.json({
              success: true,
              query,
              user: payload.username
            });
          }
        );
      });

      it('should handle successful session list request', async () => {
        mockVerifyJWT.mockResolvedValue(mockJwtPayloads.teamLead);

        const response = await app.request('/sessions?page=2&pageSize=50&isActive=true', {
          headers: {
            'Authorization': 'Bearer team_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.user).toBe('team_lead');
        expect(data.query.page).toBe(2);
        expect(data.query.pageSize).toBe(50);
        expect(data.query.isActive).toBe(true);
      });

      it('should handle query parameter validation errors', async () => {
        const response = await app.request('/sessions?page=0&pageSize=200', {
          headers: {
            'Authorization': 'Bearer team_token'
          }
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('page must be between 1 and 1000');
      });
    });

    describe('Session Detail Flow', () => {
      beforeEach(() => {
        app.get('/sessions/:sessionId',
          validateSessionId,
          checkSessionAccess,
          checkSessionViewPermission,
          logSessionOperation,
          (c) => {
            const sessionId = c.get('sessionId');
            const payload = c.get('jwtPayload');
            return c.json({
              success: true,
              sessionId,
              user: payload.username
            });
          }
        );
      });

      it('should handle valid session ID request', async () => {
        mockVerifyJWT.mockResolvedValue(mockJwtPayloads.agent);
        const validSessionId = '123e4567-e89b-12d3-a456-426614174000';

        const response = await app.request(`/sessions/${validSessionId}`, {
          headers: {
            'Authorization': 'Bearer agent_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.sessionId).toBe(validSessionId);
        expect(data.user).toBe('agent');
      });

      it('should handle invalid session ID format', async () => {
        const response = await app.request('/sessions/invalid-session-id', {
          headers: {
            'Authorization': 'Bearer agent_token'
          }
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid session ID format');
      });
    });
  });

  // ======================== 不同角色的中間件測試 ========================

  describe('Role-Based Middleware Behavior', () => {
    const roles = [
      { name: 'admin', payload: mockJwtPayloads.admin, token: 'admin_token' },
      { name: 'team', payload: mockJwtPayloads.teamLead, token: 'team_token' },
      { name: 'agent', payload: mockJwtPayloads.agent, token: 'agent_token' }
    ];

    beforeEach(() => {
      // Setup different protected endpoints for each permission level
      app.get('/view-sessions',
        checkSessionAccess,
        checkSessionViewPermission,
        (c) => {
          const payload = c.get('jwtPayload');
          return c.json({ success: true, role: payload.role, action: 'view' });
        }
      );

      app.post('/create-session',
        checkSessionAccess,
        checkSessionCreatePermission,
        (c) => {
          const payload = c.get('jwtPayload');
          return c.json({ success: true, role: payload.role, action: 'create' });
        }
      );

      app.delete('/delete-session',
        checkSessionAccess,
        checkSessionDeletePermission,
        (c) => {
          const payload = c.get('jwtPayload');
          return c.json({ success: true, role: payload.role, action: 'delete' });
        }
      );
    });

    for (const role of roles) {
      describe(`${role.name} role permissions`, () => {
        beforeEach(() => {
          mockVerifyJWT.mockResolvedValue(role.payload);
        });

        it('should allow view permissions', async () => {
          const response = await app.request('/view-sessions', {
            headers: {
              'Authorization': `Bearer ${role.token}`
            }
          });

          expect(response.status).toBe(200);

          const data = await response.json();
          expect(data.success).toBe(true);
          expect(data.role).toBe(role.payload.role);
        });

        it('should allow create permissions', async () => {
          const response = await app.request('/create-session', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${role.token}`
            }
          });

          expect(response.status).toBe(200);

          const data = await response.json();
          expect(data.success).toBe(true);
          expect(data.role).toBe(role.payload.role);
        });

        it(`should ${role.name === 'admin' ? 'allow' : 'deny'} delete permissions`, async () => {
          const response = await app.request('/delete-session', {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${role.token}`
            }
          });

          if (role.name === 'admin') {
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
          } else {
            expect(response.status).toBe(403);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toBe('Only administrators can delete sessions');
          }
        });
      });
    }
  });

  // ======================== 錯誤傳播測試 ========================

  describe('Error Propagation', () => {
    it('should properly propagate validation errors through middleware chain', async () => {
      app.post('/test-chain',
        validateRequestSize,
        validateCreateSessionData,
        checkSessionAccess,
        checkSessionCreatePermission,
        (c) => c.json({ success: true })
      );

      // Test each middleware error point
      const errorTests = [
        {
          name: 'request size validation',
          headers: { 'Content-Length': '2000000' },
          body: '{}',
          expectedStatus: 413,
          expectedError: 'Request size too large (max 1MB)'
        },
        {
          name: 'data validation',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          expectedStatus: 400,
          expectedError: 'conversationId is required'
        },
        {
          name: 'authentication',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer invalid_token'
          },
          body: JSON.stringify(createMockCreateSessionData()),
          expectedStatus: 401,
          expectedError: 'Invalid or expired token'
        }
      ];

      for (const test of errorTests) {
        if (test.name === 'authentication') {
          mockVerifyJWT.mockResolvedValue(null);
        } else {
          mockVerifyJWT.mockResolvedValue(mockJwtPayloads.admin);
        }

        const response = await app.request('/test-chain', {
          method: 'POST',
          headers: test.headers,
          body: test.body
        });

        expect(response.status).toBe(test.expectedStatus);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe(test.expectedError);
      }
    });

    it('should handle middleware exceptions without breaking the chain', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create a middleware that throws an error
      const errorMiddleware = vi.fn().mockImplementation(() => {
        throw new Error('Middleware exception');
      });

      app.get('/error-test',
        checkSessionAccess,
        errorMiddleware,
        (c) => c.json({ success: true })
      );

      mockVerifyJWT.mockResolvedValue(mockJwtPayloads.admin);

      await expect(app.request('/error-test', {
        headers: {
          'Authorization': 'Bearer valid_token'
        }
      })).rejects.toThrow('Middleware exception');

      expect(errorMiddleware).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  // ======================== 中間件順序測試 ========================

  describe('Middleware Execution Order', () => {
    it('should execute middleware in correct order', async () => {
      const executionOrder: string[] = [];

      const trackingMiddleware = (name: string) => {
        return vi.fn().mockImplementation(async (c, next) => {
          executionOrder.push(`${name}-start`);
          await next();
          executionOrder.push(`${name}-end`);
        });
      };

      const middleware1 = trackingMiddleware('middleware1');
      const middleware2 = trackingMiddleware('middleware2');
      const middleware3 = trackingMiddleware('middleware3');

      app.get('/order-test',
        middleware1,
        middleware2,
        middleware3,
        (c) => {
          executionOrder.push('handler');
          return c.json({ success: true });
        }
      );

      const response = await app.request('/order-test');

      expect(response.status).toBe(200);
      expect(executionOrder).toEqual([
        'middleware1-start',
        'middleware2-start',
        'middleware3-start',
        'handler',
        'middleware3-end',
        'middleware2-end',
        'middleware1-end'
      ]);
    });

    it('should stop execution when middleware returns early', async () => {
      const executionOrder: string[] = [];

      const middleware1 = vi.fn().mockImplementation(async (c, next) => {
        executionOrder.push('middleware1');
        await next();
      });

      const middleware2 = vi.fn().mockImplementation(async (c, next) => {
        executionOrder.push('middleware2');
        return c.json({ success: false, error: 'Early return' }, 400);
        // next() is not called, so execution stops here
      });

      const middleware3 = vi.fn().mockImplementation(async (c, next) => {
        executionOrder.push('middleware3');
        await next();
      });

      app.get('/early-return-test',
        middleware1,
        middleware2,
        middleware3,
        (c) => {
          executionOrder.push('handler');
          return c.json({ success: true });
        }
      );

      const response = await app.request('/early-return-test');

      expect(response.status).toBe(400);
      expect(executionOrder).toEqual(['middleware1', 'middleware2']);
      expect(executionOrder).not.toContain('middleware3');
      expect(executionOrder).not.toContain('handler');
    });
  });

  // ======================== 效能和穩定性測試 ========================

  describe('Performance and Stability', () => {
    it('should handle concurrent requests through middleware', async () => {
      mockVerifyJWT.mockResolvedValue(mockJwtPayloads.admin);

      app.get('/concurrent-test',
        checkSessionAccess,
        checkSessionViewPermission,
        logSessionOperation,
        (c) => {
          const payload = c.get('jwtPayload');
          return c.json({ success: true, user: payload.username });
        }
      );

      const concurrentRequests = Array.from({ length: 10 }, () =>
        app.request('/concurrent-test', {
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        })
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify data consistency
      const dataPromises = responses.map(r => r.json());
      const data = await Promise.all(dataPromises);

      data.forEach(d => {
        expect(d.success).toBe(true);
        expect(d.user).toBe('admin');
      });
    });

    it('should handle large payloads within limits', async () => {
      mockVerifyJWT.mockResolvedValue(mockJwtPayloads.admin);

      const largeData = createMockCreateSessionData({
        messageContent: 'A'.repeat(50000), // 50KB
        metadata: {
          largeField: 'B'.repeat(10000)
        }
      });

      app.post('/large-payload-test',
        validateRequestSize,
        validateCreateSessionData,
        checkSessionAccess,
        checkSessionCreatePermission,
        (c) => {
          const data = c.get('createSessionData');
          return c.json({ success: true, dataSize: JSON.stringify(data).length });
        }
      );

      const response = await app.request('/large-payload-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token'
        },
        body: JSON.stringify(largeData)
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.dataSize).toBeGreaterThan(50000);
    });
  });

  // ======================== 實際場景模擬測試 ========================

  describe('Real-World Scenario Simulation', () => {
    it('should handle complete session management workflow', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Setup multiple endpoints simulating real session management
      app.post('/sessions',
        validateRequestSize,
        validateCreateSessionData,
        checkSessionAccess,
        checkSessionCreatePermission,
        logSessionOperation,
        (c) => c.json({ success: true, action: 'created' })
      );

      app.get('/sessions/:sessionId',
        validateSessionId,
        checkSessionAccess,
        checkSessionViewPermission,
        logSessionOperation,
        (c) => c.json({ success: true, action: 'viewed' })
      );

      app.put('/sessions/:sessionId',
        validateRequestSize,
        validateSessionId,
        validateUpdateSessionData,
        checkSessionAccess,
        checkSessionUpdatePermission,
        logSessionOperation,
        (c) => c.json({ success: true, action: 'updated' })
      );

      mockVerifyJWT.mockResolvedValue(mockJwtPayloads.teamLead);

      // Simulate workflow: Create -> View -> Update
      const createData = createMockCreateSessionData();
      const sessionId = '123e4567-e89b-12d3-a456-426614174000';

      // 1. Create session
      let response = await app.request('/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer team_token'
        },
        body: JSON.stringify(createData)
      });

      expect(response.status).toBe(200);
      let data = await response.json();
      expect(data.action).toBe('created');

      // 2. View session
      response = await app.request(`/sessions/${sessionId}`, {
        headers: {
          'Authorization': 'Bearer team_token'
        }
      });

      expect(response.status).toBe(200);
      data = await response.json();
      expect(data.action).toBe('viewed');

      // 3. Update session
      response = await app.request(`/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer team_token'
        },
        body: JSON.stringify({ topic: 'Updated Topic' })
      });

      expect(response.status).toBe(200);
      data = await response.json();
      expect(data.action).toBe('updated');

      // Verify logging was called for all operations
      expect(consoleSpy).toHaveBeenCalledTimes(6); // 3 operations × 2 logs each (start + end)

      consoleSpy.mockRestore();
    });

    it('should handle mixed success and failure scenarios', async () => {
      app.post('/mixed-test/:scenario',
        validateRequestSize,
        checkSessionAccess,
        (c) => {
          const scenario = c.req.param('scenario');
          if (scenario === 'success') {
            return c.json({ success: true });
          } else if (scenario === 'auth-fail') {
            return c.json({ success: false, error: 'This should not be reached' });
          } else {
            return c.json({ success: false, error: 'Unknown scenario' });
          }
        }
      );

      // Test successful scenario
      mockVerifyJWT.mockResolvedValue(mockJwtPayloads.admin);
      let response = await app.request('/mixed-test/success', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid_token'
        }
      });

      expect(response.status).toBe(200);
      let data = await response.json();
      expect(data.success).toBe(true);

      // Test auth failure scenario
      mockVerifyJWT.mockResolvedValue(null);
      response = await app.request('/mixed-test/auth-fail', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid_token'
        }
      });

      expect(response.status).toBe(401);
      data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid or expired token');

      // Test size validation failure
      response = await app.request('/mixed-test/size-fail', {
        method: 'POST',
        headers: {
          'Content-Length': '2000000'
        }
      });

      expect(response.status).toBe(413);
      data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Request size too large (max 1MB)');
    });
  });
});