// Handler 測試共用設置工具
import { vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '../../src/types';

/**
 * 創建標準的測試環境設置
 */
export function createTestApp(): Hono<{ Bindings: Bindings }> {
  const app = new Hono<{ Bindings: Bindings }>();

  // 設置完整的環境 mock
  app.use('*', (c, next) => {
    c.env = {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({ test: 1 }),
            all: vi.fn().mockResolvedValue({ results: [], meta: {} }),
            run: vi.fn().mockResolvedValue({ success: true, changes: 1 })
          }),
          first: vi.fn().mockResolvedValue({ test: 1 }),
          all: vi.fn().mockResolvedValue({ results: [], meta: {} }),
          run: vi.fn().mockResolvedValue({ success: true, changes: 1 })
        })
      } as any,
      JWT_SECRET: 'test-secret-key-for-testing',
      SESSIONS: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] })
      } as any,
      DELAYED_MESSAGES: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] })
      } as any,
      LINE_CHANNEL_SECRET: 'test-line-secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'test-line-token',
      FACEBOOK_APP_SECRET: 'test-facebook-secret',
      FACEBOOK_PAGE_ACCESS_TOKEN: 'test-facebook-token'
    } as any;
    return next();
  });

  return app;
}

/**
 * 創建標準的用戶 mock
 */
export function createMockUser(overrides: Partial<any> = {}) {
  return {
    id: 'user-123',
    username: 'test-user',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'admin',
    teamId: 1,
    teamName: 'Test Team',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * 創建標準的認證中間件 mock
 */
export function createAuthMiddlewareMocks() {
  return {
    jwtAuth: vi.fn((c, next) => {
      c.set('user', createMockUser());
      return next();
    }),
    sessionAuth: vi.fn((c, next) => next()),
    requireRole: vi.fn(() => (c, next) => next()),
    requireTeamAccess: vi.fn(() => (c, next) => next()),
    rateLimit: vi.fn(() => (c, next) => next())
  };
}

/**
 * 創建標準的資料庫工具 mock
 */
export function createDatabaseUtilsMocks() {
  return {
    // 用戶相關
    getAllUsers: vi.fn().mockResolvedValue([]),
    getUserById: vi.fn().mockResolvedValue(null),
    createUser: vi.fn().mockResolvedValue(createMockUser()),
    updateUser: vi.fn().mockResolvedValue(createMockUser()),
    deleteUser: vi.fn().mockResolvedValue(true),
    
    // 客戶相關
    getAllCustomers: vi.fn().mockResolvedValue([]),
    getCustomerById: vi.fn().mockResolvedValue(null),
    getCustomerByPlatformId: vi.fn().mockResolvedValue(null),
    
    // 對話相關
    getAllConversations: vi.fn().mockResolvedValue([]),
    getConversationById: vi.fn().mockResolvedValue(null),
    assignConversation: vi.fn().mockResolvedValue(true),
    transferConversation: vi.fn().mockResolvedValue(true),
    
    // 團隊相關
    getAllTeams: vi.fn().mockResolvedValue([]),
    getTeamById: vi.fn().mockResolvedValue(null),
    createTeam: vi.fn().mockResolvedValue({ id: 1, name: 'Test Team' }),
    updateTeam: vi.fn().mockResolvedValue({ id: 1, name: 'Updated Team' }),
    deleteTeam: vi.fn().mockResolvedValue(true),
    getTeamMembers: vi.fn().mockResolvedValue([]),
    getTeamStats: vi.fn().mockResolvedValue({ totalMembers: 0, activeConversations: 0 }),
    
    // 統計相關
    getMessageStats: vi.fn().mockResolvedValue({ total: 0, today: 0 }),
    getConversationStats: vi.fn().mockResolvedValue({ total: 0, active: 0 }),
    getSystemHealth: vi.fn().mockResolvedValue({ status: 'healthy' })
  };
}

/**
 * 創建標準的服務 mock
 */
export function createServiceMocks() {
  return {
    MessageRecallService: vi.fn().mockImplementation(() => ({
      sendDelayedMessage: vi.fn().mockResolvedValue({ messageId: 'msg-123', success: true }),
      recallMessage: vi.fn().mockResolvedValue({ success: true }),
      getPendingMessages: vi.fn().mockResolvedValue([]),
      processQueueMessage: vi.fn().mockResolvedValue({ success: true })
    })),
    PermissionService: {
      canAssignConversation: vi.fn().mockResolvedValue(true),
      canTransferConversation: vi.fn().mockResolvedValue(true),
      canViewConversation: vi.fn().mockResolvedValue(true),
      canAccessTeam: vi.fn().mockResolvedValue(true)
    },
    QRCodeService: {
      generateTeamQRCode: vi.fn().mockResolvedValue({ qrCode: 'qr-code-data', id: 'qr-123' }),
      getTeamQRCodes: vi.fn().mockResolvedValue([])
    }
  };
}

/**
 * 設置完整的測試環境
 */
export function setupHandlerTest() {
  const app = createTestApp();
  const authMocks = createAuthMiddlewareMocks();
  const databaseMocks = createDatabaseUtilsMocks();
  const serviceMocks = createServiceMocks();
  
  return {
    app,
    mocks: {
      auth: authMocks,
      database: databaseMocks,
      services: serviceMocks
    },
    mockUser: createMockUser()
  };
}