// Session middleware integration tests

import { describe, it, expect, beforeEach, afterEach, vi, test } from 'vitest';
import { Hono } from 'hono';
import {
  checkSessionAccess,
  checkSessionViewPermission,
  checkSessionCreatePermission,
  checkSessionUpdatePermission,
  checkSessionDeletePermission,
  logSessionOperation
} from '@modules/session/middleware/session-auth';
import {
  validateRequestSize,
  validateSessionId,
  validateCreateSessionData,
  validateUpdateSessionData,
  validateSessionListQuery
} from '@modules/session/middleware/session-validation';
import { createMockCreateSessionData } from '../../helpers/session-test-helpers';
import { mockJwtPayloads } from '../../helpers/mock-data';
import type { Bindings } from '@/types';

// ======================== Mock Setup ========================

const { mockVerifyJWT } = vi.hoisted(() => ({
  mockVerifyJWT: vi.fn()
}));
vi.mock('../../../../../src/utils/auth', () => ({
  verifyJWT: mockVerifyJWT
}));

// Mock HTTP_STATUS constant
vi.mock('@/constants/http-status', () => ({
  HTTP_STATUS: {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    PAYLOAD_TOO_LARGE: 413,
    INTERNAL_SERVER_ERROR: 500
  }
}));

// Env bindings for tests (checkSessionAccess reads c.env.JWT_SECRET)
const mockEnv = { JWT_SECRET: 'test-secret' } as unknown as Bindings;

describe('Session Middleware Integration', () => {
  let app: Hono<{ Bindings: Bindings }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Bindings }>();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ======================== Complete Middleware Chain Tests ========================

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

      test('should pass through all middleware with valid request', async () => {
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
        }, mockEnv);

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.user).toBe('admin');
        expect(data.data.conversationId).toBe(validData.conversationId);
      });

      test('should fail at request size validation', async () => {
        const validData = createMockCreateSessionData();

        const response = await app.request('/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': '2000000' // Too large
          },
          body: JSON.stringify(validData)
        }, mockEnv);

        expect(response.status).toBe(413);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Request size too large (max 1MB)');
      });

      test('should fail at data validation', async () => {
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
        }, mockEnv);

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('conversationId is required');
      });

      test('should fail at authentication', async () => {
        mockVerifyJWT.mockResolvedValue(null);
        const validData = createMockCreateSessionData();

        const response = await app.request('/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer invalid_token'
          },
          body: JSON.stringify(validData)
        }, mockEnv);

        expect(response.status).toBe(401);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid or expired token');
      });

      test('should fail at permission check', async () => {
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
        }, mockEnv);

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

      test('should handle successful session list request', async () => {
        mockVerifyJWT.mockResolvedValue(mockJwtPayloads.admin);

        const response = await app.request('/sessions?page=2&pageSize=50&isActive=true', {
          headers: {
            'Authorization': 'Bearer admin_token'
          }
        }, mockEnv);

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.user).toBe('admin');
        expect(data.query.page).toBe(2);
        expect(data.query.pageSize).toBe(50);
        expect(data.query.isActive).toBe(true);
      });

      test('should handle query parameter validation errors', async () => {
        const response = await app.request('/sessions?page=0&pageSize=200', {
          headers: {
            'Authorization': 'Bearer admin_token'
          }
        }, mockEnv);

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

      test('should handle valid session ID request', async () => {
        mockVerifyJWT.mockResolvedValue(mockJwtPayloads.agent);
        const validSessionId = '123e4567-e89b-12d3-a456-426614174000';

        const response = await app.request(`/sessions/${validSessionId}`, {
          headers: {
            'Authorization': 'Bearer agent_token'
          }
        }, mockEnv);

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.sessionId).toBe(validSessionId);
        expect(data.user).toBe('agent');
      });

      test('should handle invalid session ID format', async () => {
        const response = await app.request('/sessions/invalid-session-id', {
          headers: {
            'Authorization': 'Bearer agent_token'
          }
        }, mockEnv);

        expect(response.status).toBe(400);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid session ID format');
      });
    });
  });

  // ======================== Role-Based Middleware Behavior Tests ========================

  describe('Role-Based Middleware Behavior', () => {
    // Only admin and agent are valid in 2-tier system
    const roles = [
      { name: 'admin', payload: mockJwtPayloads.admin, token: 'admin_token' },
      { name: 'agent', payload: mockJwtPayloads.agent, token: 'agent_token' }
    ];

    beforeEach(() => {
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

        test('should allow view permissions', async () => {
          const response = await app.request('/view-sessions', {
            headers: {
              'Authorization': `Bearer ${role.token}`
            }
          }, mockEnv);

          expect(response.status).toBe(200);

          const data = await response.json();
          expect(data.success).toBe(true);
          expect(data.role).toBe(role.payload.role);
        });

        test('should allow create permissions', async () => {
          const response = await app.request('/create-session', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${role.token}`
            }
          }, mockEnv);

          expect(response.status).toBe(200);

          const data = await response.json();
          expect(data.success).toBe(true);
          expect(data.role).toBe(role.payload.role);
        });

        test(`should ${role.name === 'admin' ? 'allow' : 'deny'} delete permissions`, async () => {
          const response = await app.request('/delete-session', {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${role.token}`
            }
          }, mockEnv);

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

  // ======================== Error Propagation Tests ========================

  describe('Error Propagation', () => {
    test('should properly propagate validation errors through middleware chain', async () => {
      app.post('/test-chain',
        validateRequestSize,
        validateCreateSessionData,
        checkSessionAccess,
        checkSessionCreatePermission,
        (c) => c.json({ success: true })
      );

      const errorTests = [
        {
          name: 'request size validation',
          headers: { 'Content-Length': '2000000' } as Record<string, string>,
          body: '{}',
          expectedStatus: 413,
          expectedError: 'Request size too large (max 1MB)'
        },
        {
          name: 'data validation',
          headers: { 'Content-Type': 'application/json' } as Record<string, string>,
          body: '{}',
          expectedStatus: 400,
          expectedError: 'conversationId is required'
        },
        {
          name: 'authentication',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer invalid_token'
          } as Record<string, string>,
          body: JSON.stringify(createMockCreateSessionData()),
          expectedStatus: 401,
          expectedError: 'Invalid or expired token'
        }
      ];

      for (const errorTest of errorTests) {
        if (errorTest.name === 'authentication') {
          mockVerifyJWT.mockResolvedValue(null);
        } else {
          mockVerifyJWT.mockResolvedValue(mockJwtPayloads.admin);
        }

        const response = await app.request('/test-chain', {
          method: 'POST',
          headers: errorTest.headers,
          body: errorTest.body
        }, mockEnv);

        expect(response.status).toBe(errorTest.expectedStatus);

        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.error).toBe(errorTest.expectedError);
      }
    });

    test('should handle middleware exceptions without breaking the chain', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorMiddleware = vi.fn().mockImplementation(() => {
        throw new Error('Middleware exception');
      });

      app.get('/error-test',
        checkSessionAccess,
        errorMiddleware,
        (c) => c.json({ success: true })
      );

      mockVerifyJWT.mockResolvedValue(mockJwtPayloads.admin);

      // Hono may catch the error internally or reject the promise
      try {
        const response = await app.request('/error-test', {
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        }, mockEnv);
        expect(response.status).toBe(500);
      } catch {
        // Promise rejection is also acceptable
      }

      expect(errorMiddleware).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  // ======================== Middleware Execution Order Tests ========================

  describe('Middleware Execution Order', () => {
    test('should execute middleware in correct order', async () => {
      const executionOrder: string[] = [];

      const trackingMiddleware = (name: string) => {
        return vi.fn().mockImplementation(async (c: any, next: any) => {
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

    test('should stop execution when middleware returns early', async () => {
      const executionOrder: string[] = [];

      const middleware1 = vi.fn().mockImplementation(async (c: any, next: any) => {
        executionOrder.push('middleware1');
        await next();
      });

      const middleware2 = vi.fn().mockImplementation(async (c: any, _next: any) => {
        executionOrder.push('middleware2');
        return c.json({ success: false, error: 'Early return' }, 400);
      });

      const middleware3 = vi.fn().mockImplementation(async (c: any, next: any) => {
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

  // ======================== Performance and Stability Tests ========================

  describe('Performance and Stability', () => {
    test('should handle concurrent requests through middleware', async () => {
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
        }, mockEnv)
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

    test('should handle large payloads within limits', async () => {
      mockVerifyJWT.mockResolvedValue(mockJwtPayloads.admin);

      const largeData = createMockCreateSessionData({
        messageContent: 'A'.repeat(1000), // Keep within sanitizeString limit
        metadata: {
          largeField: 'B'.repeat(1000)
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
      }, mockEnv);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.dataSize).toBeGreaterThan(100);
    });
  });

  // ======================== Real-World Scenario Simulation Tests ========================

  describe('Real-World Scenario Simulation', () => {
    test('should handle complete session management workflow', async () => {
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

      // Use admin role (valid in 2-tier system)
      mockVerifyJWT.mockResolvedValue(mockJwtPayloads.admin);

      const createData = createMockCreateSessionData();
      const sessionId = '123e4567-e89b-12d3-a456-426614174000';

      // 1. Create session
      let response = await app.request('/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin_token'
        },
        body: JSON.stringify(createData)
      }, mockEnv);

      expect(response.status).toBe(200);
      let data = await response.json();
      expect(data.action).toBe('created');

      // 2. View session
      response = await app.request(`/sessions/${sessionId}`, {
        headers: {
          'Authorization': 'Bearer admin_token'
        }
      }, mockEnv);

      expect(response.status).toBe(200);
      data = await response.json();
      expect(data.action).toBe('viewed');

      // 3. Update session
      response = await app.request(`/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin_token'
        },
        body: JSON.stringify({ topic: 'Updated Topic' })
      }, mockEnv);

      expect(response.status).toBe(200);
      data = await response.json();
      expect(data.action).toBe('updated');

      // Verify logging was called for all operations
      expect(consoleSpy).toHaveBeenCalledTimes(6); // 3 operations x 2 logs each (start + end)

      consoleSpy.mockRestore();
    });

    test('should handle mixed success and failure scenarios', async () => {
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
      }, mockEnv);

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
      }, mockEnv);

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
      }, mockEnv);

      expect(response.status).toBe(413);
      data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Request size too large (max 1MB)');
    });
  });
});
