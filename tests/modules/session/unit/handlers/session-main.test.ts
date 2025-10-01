// Session Main Handler 單元測試
// Unit tests for session main handler

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { Hono } from 'hono';
import sessionHandler from '@modules/session/handlers/session-main';
import { SessionService } from '@modules/session/services/session-service';
import {
  createMockSession,
  createMockCreateSessionData,
  createMockUpdateSessionData,
  createMockListQuery,
  createMockSearchQuery,
  createMockBatchOperation,
  createMockSessionMessage,
  validateApiResponse,
  validatePaginationData,
  validateSessionData,
  validateErrorResponse,
  createErrorScenarios
} from '../../helpers/session-test-helpers';
import {
  mockSessions,
  mockSessionStats,
  mockActivityStats,
  mockBatchOperationResults,
  mockApiResponses,
  mockJwtPayloads
} from '../../helpers/mock-data';

// ======================== Mocks Setup ========================

// Mock SessionService
vi.mock('../../../../../src/modules/session/services/session-service');
const MockedSessionService = vi.mocked(SessionService);

// Mock JWT verification
vi.mock('../../../../../src/utils/auth', () => ({
  verifyJWT: vi.fn()
}));

// Mock middleware functions
vi.mock('../../../../../src/modules/session/middleware/index', () => ({
  checkSessionAccess: vi.fn((c, next) => next()),
  checkSessionViewPermission: vi.fn((c, next) => next()),
  checkSessionCreatePermission: vi.fn((c, next) => next()),
  checkSessionUpdatePermission: vi.fn((c, next) => next()),
  checkSessionDeletePermission: vi.fn((c, next) => next()),
  checkSessionStatsPermission: vi.fn((c, next) => next()),
  checkSessionBatchPermission: vi.fn((c, next) => next()),
  validateRequestSize: vi.fn((c, next) => next()),
  validateRateLimit: vi.fn((c, next) => next()),
  validateSessionId: vi.fn((c, next) => {
    c.set('sessionId', c.req.param('sessionId'));
    return next();
  }),
  validateConversationId: vi.fn((c, next) => next()),
  validateCreateSessionData: vi.fn((c, next) => {
    c.set('createSessionData', createMockCreateSessionData());
    return next();
  }),
  validateUpdateSessionData: vi.fn((c, next) => {
    c.set('updateSessionData', createMockUpdateSessionData());
    return next();
  }),
  validateSessionListQuery: vi.fn((c, next) => {
    c.set('sessionQuery', createMockListQuery());
    return next();
  }),
  validateSessionSearchQuery: vi.fn((c, next) => {
    c.set('sessionSearchQuery', createMockSearchQuery());
    return next();
  }),
  validateBatchSessionOperation: vi.fn((c, next) => {
    c.set('batchOperation', createMockBatchOperation());
    return next();
  }),
  logSessionOperation: vi.fn((c, next) => next())
}));

// ======================== Test Setup ========================

describe('Session Main Handler', () => {
  let app: Hono;
  let mockSessionService: any;
  let testEnv: any;

  beforeEach(() => {
    // 設置測試環境
    testEnv = {
      JWT_SECRET: 'test_secret',
      DB: {} as D1Database,
      KV_NAMESPACE: {} as KVNamespace
    };

    // 設置 mock service
    mockSessionService = {
      create: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      search: vi.fn(),
      closeSession: vi.fn(),
      reopenSession: vi.fn(),
      getMessages: vi.fn(),
      getStats: vi.fn(),
      getActivityStats: vi.fn(),
      batchOperation: vi.fn(),
      analyzeSessionHealth: vi.fn()
    };

    MockedSessionService.mockImplementation(() => mockSessionService);

    // 創建測試應用並設置環境
    app = new Hono();
    app.use('*', (c, next) => {
      c.env = testEnv;
      return next();
    });
    app.route('/sessions', sessionHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ======================== 健康檢查和資訊端點測試 ========================

  describe('Health Check and Info Endpoints', () => {
    it('should return health status', async () => {
      const response = await app.request('/sessions/health', {
        method: 'GET'
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      const validation = validateApiResponse(data);

      expect(validation.isValid).toBe(true);
      expect(data.data.status).toBe('healthy');
      expect(data.data.module).toBe('session');
      expect(data.data.version).toBe('2.0.0');
    });

    it('should return module information', async () => {
      const response = await app.request('/sessions/info', {
        method: 'GET'
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      const validation = validateApiResponse(data);

      expect(validation.isValid).toBe(true);
      expect(data.data.module).toBe('session');
      expect(data.data.features).toBeInstanceOf(Array);
      expect(data.data.endpoints).toBeInstanceOf(Array);
      expect(data.data.endpoints).toHaveLength(16); // 檢查端點數量
      expect(data.data.permissions).toBeDefined();
    });
  });

  // ======================== CRUD 操作測試 ========================

  describe('CRUD Operations', () => {
    describe('POST /sessions - Create Session', () => {
      it('should create a new session successfully', async () => {
        const mockSession = createMockSession();
        mockSessionService.create.mockResolvedValue(mockSession);

        const response = await app.request('/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid_token'
          },
          body: JSON.stringify(createMockCreateSessionData())
        });

        expect(response.status).toBe(201);

        const data = await response.json();
        const validation = validateApiResponse(data);

        expect(validation.isValid).toBe(true);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Session created successfully');

        const sessionValidation = validateSessionData(data.data);
        expect(sessionValidation.isValid).toBe(true);

        expect(mockSessionService.create).toHaveBeenCalledTimes(1);
      });

      it('should handle service creation error', async () => {
        mockSessionService.create.mockRejectedValue(new Error('Database connection failed'));

        const response = await app.request('/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid_token'
          },
          body: JSON.stringify(createMockCreateSessionData())
        });

        expect(response.status).toBe(500);

        const data = await response.json();
        const validation = validateErrorResponse(data, 500, 'Database connection failed');

        expect(validation.isValid).toBe(true);
      });
    });

    describe('GET /sessions - List Sessions', () => {
      it('should return session list with pagination', async () => {
        const mockListResponse = {
          sessions: [mockSessions.activeCustomerSupport, mockSessions.continuousChat],
          pagination: {
            page: 1,
            pageSize: 20,
            total: 2,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          },
          summary: {
            totalSessions: 2,
            activeSessions: 2,
            inactiveSessions: 0,
            byType: { continuous: 1, support: 1, scheduled: 0, marketing: 0 },
            byPriority: { low: 0, medium: 1, high: 1, urgent: 0 }
          }
        };

        mockSessionService.list.mockResolvedValue(mockListResponse);

        const response = await app.request('/sessions?page=1&pageSize=20', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        const validation = validateApiResponse(data);
        const paginationValidation = validatePaginationData(data.data.pagination);

        expect(validation.isValid).toBe(true);
        expect(paginationValidation.isValid).toBe(true);
        expect(data.data.sessions).toHaveLength(2);
        expect(data.data.summary).toBeDefined();

        expect(mockSessionService.list).toHaveBeenCalledTimes(1);
      });

      it('should handle empty session list', async () => {
        const emptyListResponse = {
          sessions: [],
          pagination: {
            page: 1,
            pageSize: 20,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          },
          summary: {
            totalSessions: 0,
            activeSessions: 0,
            inactiveSessions: 0,
            byType: { continuous: 0, support: 0, scheduled: 0, marketing: 0 },
            byPriority: { low: 0, medium: 0, high: 0, urgent: 0 }
          }
        };

        mockSessionService.list.mockResolvedValue(emptyListResponse);

        const response = await app.request('/sessions', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.data.sessions).toHaveLength(0);
        expect(data.data.summary.totalSessions).toBe(0);
      });
    });

    describe('GET /sessions/search - Search Sessions', () => {
      it('should return search results', async () => {
        const searchResults = [mockSessions.activeCustomerSupport];
        mockSessionService.search.mockResolvedValue(searchResults);

        const response = await app.request('/sessions/search?query=support', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        const validation = validateApiResponse(data);

        expect(validation.isValid).toBe(true);
        expect(data.data).toHaveLength(1);
        expect(data.count).toBe(1);

        expect(mockSessionService.search).toHaveBeenCalledTimes(1);
      });

      it('should handle no search results', async () => {
        mockSessionService.search.mockResolvedValue([]);

        const response = await app.request('/sessions/search?query=nonexistent', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.data).toHaveLength(0);
        expect(data.count).toBe(0);
      });
    });

    describe('GET /sessions/:sessionId - Get Session Details', () => {
      it('should return session details', async () => {
        const mockSession = mockSessions.activeCustomerSupport;
        mockSessionService.get.mockResolvedValue(mockSession);

        const response = await app.request('/sessions/session_test_001', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        const validation = validateApiResponse(data);
        const sessionValidation = validateSessionData(data.data);

        expect(validation.isValid).toBe(true);
        expect(sessionValidation.isValid).toBe(true);
        expect(data.data.id).toBe('session_test_001');

        expect(mockSessionService.get).toHaveBeenCalledWith('session_test_001');
      });

      it('should return 404 for non-existent session', async () => {
        mockSessionService.get.mockResolvedValue(null);

        const response = await app.request('/sessions/nonexistent_session', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(404);

        const data = await response.json();
        const validation = validateErrorResponse(data, 404, 'Session not found');

        expect(validation.isValid).toBe(true);
      });
    });

    describe('PUT /sessions/:sessionId - Update Session', () => {
      it('should update session successfully', async () => {
        const updatedSession = { ...mockSessions.activeCustomerSupport, topic: 'Updated Topic' };
        mockSessionService.update.mockResolvedValue(updatedSession);

        const response = await app.request('/sessions/session_test_001', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid_token'
          },
          body: JSON.stringify({ topic: 'Updated Topic' })
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        const validation = validateApiResponse(data);

        expect(validation.isValid).toBe(true);
        expect(data.message).toBe('Session updated successfully');
        expect(data.data.topic).toBe('Updated Topic');

        expect(mockSessionService.update).toHaveBeenCalledTimes(1);
      });

      it('should handle update service error', async () => {
        mockSessionService.update.mockRejectedValue(new Error('Session not found'));

        const response = await app.request('/sessions/session_test_001', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid_token'
          },
          body: JSON.stringify({ topic: 'Updated Topic' })
        });

        expect(response.status).toBe(500);

        const data = await response.json();
        const validation = validateErrorResponse(data, 500, 'Session not found');

        expect(validation.isValid).toBe(true);
      });
    });

    describe('DELETE /sessions/:sessionId - Delete Session', () => {
      it('should delete session successfully', async () => {
        mockSessionService.delete.mockResolvedValue(true);

        const response = await app.request('/sessions/session_test_001', {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        const validation = validateApiResponse(data);

        expect(validation.isValid).toBe(true);
        expect(data.message).toBe('Session deleted successfully');

        expect(mockSessionService.delete).toHaveBeenCalledWith('session_test_001');
      });

      it('should return 404 when session not found for deletion', async () => {
        mockSessionService.delete.mockResolvedValue(false);

        const response = await app.request('/sessions/nonexistent_session', {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(404);

        const data = await response.json();
        const validation = validateErrorResponse(data, 404, 'Session not found or could not be deleted');

        expect(validation.isValid).toBe(true);
      });
    });
  });

  // ======================== 會話管理操作測試 ========================

  describe('Session Management Operations', () => {
    describe('POST /sessions/:sessionId/close - Close Session', () => {
      it('should close session successfully', async () => {
        mockSessionService.closeSession.mockResolvedValue(true);

        const response = await app.request('/sessions/session_test_001/close', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        const validation = validateApiResponse(data);

        expect(validation.isValid).toBe(true);
        expect(data.message).toBe('Session closed successfully');

        expect(mockSessionService.closeSession).toHaveBeenCalledWith('session_test_001');
      });

      it('should handle close session failure', async () => {
        mockSessionService.closeSession.mockResolvedValue(false);

        const response = await app.request('/sessions/session_test_001/close', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(404);

        const data = await response.json();
        const validation = validateErrorResponse(data, 404, 'Session not found or could not be closed');

        expect(validation.isValid).toBe(true);
      });
    });

    describe('POST /sessions/:sessionId/reopen - Reopen Session', () => {
      it('should reopen session successfully', async () => {
        mockSessionService.reopenSession.mockResolvedValue(true);

        const response = await app.request('/sessions/session_test_001/reopen', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        const validation = validateApiResponse(data);

        expect(validation.isValid).toBe(true);
        expect(data.message).toBe('Session reopened successfully');

        expect(mockSessionService.reopenSession).toHaveBeenCalledWith('session_test_001');
      });
    });
  });

  // ======================== 訊息相關操作測試 ========================

  describe('Message Operations', () => {
    describe('GET /sessions/:sessionId/messages - Get Session Messages', () => {
      it('should return session messages with pagination', async () => {
        const mockMessages = [
          createMockSessionMessage({ sessionId: 'session_test_001', sessionSequence: 1 }),
          createMockSessionMessage({ sessionId: 'session_test_001', sessionSequence: 2 })
        ];

        const mockMessageResponse = {
          sessionId: 'session_test_001',
          messages: mockMessages,
          messageCount: 2,
          pagination: {
            page: 1,
            pageSize: 20,
            total: 2,
            totalPages: 1,
            hasNext: false,
            hasPrev: false
          }
        };

        mockSessionService.getMessages.mockResolvedValue(mockMessageResponse);

        const response = await app.request('/sessions/session_test_001/messages?page=1&pageSize=20', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        const validation = validateApiResponse(data);
        const paginationValidation = validatePaginationData(data.data.pagination);

        expect(validation.isValid).toBe(true);
        expect(paginationValidation.isValid).toBe(true);
        expect(data.data.messages).toHaveLength(2);

        expect(mockSessionService.getMessages).toHaveBeenCalledWith('session_test_001', 1, 20);
      });
    });
  });

  // ======================== 統計和分析測試 ========================

  describe('Statistics and Analytics', () => {
    describe('GET /sessions/stats - Get Session Statistics', () => {
      it('should return session statistics', async () => {
        mockSessionService.getStats.mockResolvedValue(mockSessionStats);

        const response = await app.request('/sessions/stats', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        const validation = validateApiResponse(data);

        expect(validation.isValid).toBe(true);
        expect(data.data).toEqual(mockSessionStats);
        expect(data.data.totalSessions).toBe(150);

        expect(mockSessionService.getStats).toHaveBeenCalledWith(undefined);
      });

      it('should return conversation-specific statistics', async () => {
        const conversationId = 'conv_001';
        mockSessionService.getStats.mockResolvedValue(mockSessionStats);

        const response = await app.request(`/sessions/stats?conversation_id=${conversationId}`, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(200);
        expect(mockSessionService.getStats).toHaveBeenCalledWith(conversationId);
      });
    });

    describe('GET /sessions/stats/:conversationId - Get Conversation Session Stats', () => {
      it('should return conversation session statistics', async () => {
        const conversationId = 'conv_001';
        mockSessionService.getStats.mockResolvedValue(mockSessionStats);

        const response = await app.request(`/sessions/stats/${conversationId}`, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        const validation = validateApiResponse(data);

        expect(validation.isValid).toBe(true);
        expect(data.conversation_id).toBe(conversationId);

        expect(mockSessionService.getStats).toHaveBeenCalledWith(conversationId);
      });
    });

    describe('GET /sessions/activity - Get Activity Statistics', () => {
      it('should return activity statistics', async () => {
        mockSessionService.getActivityStats.mockResolvedValue(mockActivityStats);

        const response = await app.request('/sessions/activity?timeRange=week', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        const validation = validateApiResponse(data);

        expect(validation.isValid).toBe(true);
        expect(data.data).toEqual(mockActivityStats);

        expect(mockSessionService.getActivityStats).toHaveBeenCalledWith({
          conversation_id: undefined,
          timeRange: 'week'
        });
      });

      it('should validate timeRange parameter', async () => {
        const response = await app.request('/sessions/activity?timeRange=invalid', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(400);

        const data = await response.json();
        const validation = validateErrorResponse(data, 400, 'timeRange must be one of: day, week, month, year');

        expect(validation.isValid).toBe(true);
      });
    });
  });

  // ======================== 批量操作測試 ========================

  describe('Batch Operations', () => {
    describe('POST /sessions/batch - Batch Operations', () => {
      it('should perform successful batch operation', async () => {
        mockSessionService.batchOperation.mockResolvedValue(mockBatchOperationResults.successfulClose);

        const batchOperation = createMockBatchOperation();

        const response = await app.request('/sessions/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid_token'
          },
          body: JSON.stringify(batchOperation)
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        const validation = validateApiResponse(data);

        expect(validation.isValid).toBe(true);
        expect(data.data).toEqual(mockBatchOperationResults.successfulClose);
        expect(data.message).toContain('Batch operation close completed');

        expect(mockSessionService.batchOperation).toHaveBeenCalledTimes(1);
      });

      it('should handle partial batch operation failure', async () => {
        mockSessionService.batchOperation.mockResolvedValue(mockBatchOperationResults.partialFailure);

        const batchOperation = createMockBatchOperation();

        const response = await app.request('/sessions/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid_token'
          },
          body: JSON.stringify(batchOperation)
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.data.success).toBe(false);
        expect(data.data.successCount).toBe(2);
        expect(data.data.failedCount).toBe(1);
      });
    });
  });

  // ======================== 會話健康檢查測試 ========================

  describe('Session Health Check', () => {
    describe('GET /sessions/:sessionId/health - Analyze Session Health', () => {
      it('should return session health report', async () => {
        const mockHealthReport = {
          healthy: true,
          issues: [],
          suggestions: []
        };

        mockSessionService.analyzeSessionHealth.mockResolvedValue(mockHealthReport);

        const response = await app.request('/sessions/session_test_001/health', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        const validation = validateApiResponse(data);

        expect(validation.isValid).toBe(true);
        expect(data.data).toEqual(mockHealthReport);

        expect(mockSessionService.analyzeSessionHealth).toHaveBeenCalledWith('session_test_001');
      });

      it('should return unhealthy session report', async () => {
        const mockHealthReport = {
          healthy: false,
          issues: ['會話持續時間過長', '會話長時間無活動'],
          suggestions: ['考慮關閉此會話並開始新會話', '考慮主動聯繫客戶或關閉會話']
        };

        mockSessionService.analyzeSessionHealth.mockResolvedValue(mockHealthReport);

        const response = await app.request('/sessions/session_test_001/health', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid_token'
          }
        });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.data.healthy).toBe(false);
        expect(data.data.issues).toHaveLength(2);
        expect(data.data.suggestions).toHaveLength(2);
      });
    });
  });

  // ======================== 錯誤處理測試 ========================

  describe('Error Handling', () => {
    it('should handle 404 for unknown endpoints', async () => {
      const response = await app.request('/sessions/unknown-endpoint', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid_token'
        }
      });

      expect(response.status).toBe(404);

      const data = await response.json();
      const validation = validateErrorResponse(data, 404, 'Session not found');

      expect(validation.isValid).toBe(true);
    });

    it('should handle global error middleware', async () => {
      // Mock service to throw error
      mockSessionService.get.mockRejectedValue(new Error('Unexpected database error'));

      const response = await app.request('/sessions/session_test_001', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid_token'
        }
      });

      expect(response.status).toBe(500);

      const data = await response.json();
      const validation = validateErrorResponse(data, 500, 'Unexpected database error');

      expect(validation.isValid).toBe(true);
    });
  });

  // ======================== 整合度測試 ========================

  describe('Integration Tests', () => {
    it('should handle complete session lifecycle', async () => {
      const createData = createMockCreateSessionData();
      const mockSession = createMockSession();
      const updatedSession = { ...mockSession, topic: 'Updated' };

      // Setup service mocks for lifecycle
      mockSessionService.create.mockResolvedValue(mockSession);
      mockSessionService.get.mockResolvedValue(mockSession);
      mockSessionService.update.mockResolvedValue(updatedSession);
      mockSessionService.closeSession.mockResolvedValue(true);
      mockSessionService.delete.mockResolvedValue(true);

      // 1. Create session
      let response = await app.request('/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token'
        },
        body: JSON.stringify(createData)
      });
      expect(response.status).toBe(201);

      // 2. Get session
      response = await app.request(`/sessions/${mockSession.id}`, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid_token' }
      });
      expect(response.status).toBe(200);

      // 3. Update session
      response = await app.request(`/sessions/${mockSession.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token'
        },
        body: JSON.stringify({ topic: 'Updated' })
      });
      expect(response.status).toBe(200);

      // 4. Close session
      response = await app.request(`/sessions/${mockSession.id}/close`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer valid_token' }
      });
      expect(response.status).toBe(200);

      // 5. Delete session
      response = await app.request(`/sessions/${mockSession.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer valid_token' }
      });
      expect(response.status).toBe(200);

      // Verify all service calls were made
      expect(mockSessionService.create).toHaveBeenCalledTimes(1);
      expect(mockSessionService.get).toHaveBeenCalledTimes(1);
      expect(mockSessionService.update).toHaveBeenCalledTimes(1);
      expect(mockSessionService.closeSession).toHaveBeenCalledTimes(1);
      expect(mockSessionService.delete).toHaveBeenCalledTimes(1);
    });
  });
});