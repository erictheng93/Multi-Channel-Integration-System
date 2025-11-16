// Realtime 主處理器測試
// 測試統一即時通訊模組的核心功能

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Context } from 'hono';
import { realtimeMainHandler, realtimeManagementHandler } from '@real-time/handlers/realtime-main';

// REMOVED: SSE handler mocks (Phase 3 cleanup - SSE removed, WebSocket only)
// vi.mock('@real-time/handlers/sse-handler', ...)

vi.mock('@real-time/handlers/event-handler', () => ({
  eventHandler: {
    sendTypingStatus: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }))),
    broadcastToConversation: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }))),
    updateOnlineStatus: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
  }
}));

// Mock utilities
vi.mock('../../../../src/utils/api-response', () => ({
  successResponse: vi.fn((c, data, message) =>
    new Response(JSON.stringify({ success: true, data, message }), { status: 200 })
  ),
  errorResponse: vi.fn((c, error, status = 400) =>
    new Response(JSON.stringify({ success: false, error }), { status })
  ),
  unauthorizedResponse: vi.fn((c, message) =>
    new Response(JSON.stringify({ success: false, error: message }), { status: 401 })
  ),
  handleApiError: vi.fn((error, c) =>
    new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 })
  )
}));

vi.mock('../../../../src/utils/auth', () => ({
  verifyJWT: vi.fn().mockResolvedValue({ userId: 'test-user', role: 'admin' })
}));

describe('Realtime Main Handler', () => {
  let mockContext: any;
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      SESSIONS: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      CACHE: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null)
      },
      // Phase 2: REALTIME_QUEUE removed (replaced by Durable Objects)
      JWT_SECRET: 'test-secret'
    };

    mockContext = {
      req: {
        header: vi.fn().mockReturnValue('application/json'),
        query: vi.fn().mockReturnValue(undefined),
        json: vi.fn().mockResolvedValue({})
      },
      get: vi.fn().mockReturnValue({ userId: 'test-user', role: 'admin' }),
      env: mockEnv,
      json: vi.fn((data, status) => new Response(JSON.stringify(data), { status }))
    };

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // REMOVED: SSE Connection tests (Phase 3 cleanup - SSE removed, WebSocket only)
  // The realtimeMainHandler.sse() method no longer exists

  describe('Typing Status', () => {
    it('should send typing status successfully', async () => {
      const response = await realtimeMainHandler.sendTypingStatus(mockContext);

      expect(response).toBeInstanceOf(Response);

      // 驗證是否調用了事件處理器
      const { eventHandler } = await import('@real-time/handlers/event-handler');
      expect(eventHandler.sendTypingStatus).toHaveBeenCalledWith(mockContext);
    });

    it('should handle typing status errors', async () => {
      const { eventHandler } = await import('@real-time/handlers/event-handler');
      (eventHandler.sendTypingStatus as any).mockRejectedValueOnce(new Error('Typing status failed'));

      const response = await realtimeMainHandler.sendTypingStatus(mockContext);

      expect(response).toBeInstanceOf(Response);
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
    });
  });

  describe('Broadcast Events', () => {
    it('should broadcast to conversation successfully', async () => {
      // Reset eventHandler mock to ensure fresh mock state
      const { eventHandler } = await import('@real-time/handlers/event-handler');
      (eventHandler.broadcastToConversation as any).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }))
      );

      const response = await realtimeMainHandler.broadcastToConversation(mockContext);

      expect(response).toBeInstanceOf(Response);

      // 驗證是否調用了事件處理器
      expect(eventHandler.broadcastToConversation).toHaveBeenCalledWith(mockContext);
    });

    it('should handle broadcast errors gracefully', async () => {
      const { eventHandler } = await import('@real-time/handlers/event-handler');
      (eventHandler.broadcastToConversation as any).mockRejectedValueOnce(new Error('Broadcast failed'));

      const response = await realtimeMainHandler.broadcastToConversation(mockContext);

      expect(response).toBeInstanceOf(Response);
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
    });
  });

  describe('Conversation Status', () => {
    it('should return deprecation message for SSE removal', async () => {
      // Phase 3: getConversationStatus now returns deprecation message instead of SSE stats
      const response = await realtimeMainHandler.getConversationStatus(mockContext);

      expect(response).toBeInstanceOf(Response);
      const responseBody = await response.json();
      expect(responseBody.success).toBe(true);
      expect(responseBody.message).toContain('WebSocket');
    });
  });

  describe('Online Status', () => {
    it('should update online status successfully', async () => {
      // Mock eventHandler.updateOnlineStatus to return proper response
      const { eventHandler } = await import('@real-time/handlers/event-handler');
      (eventHandler.updateOnlineStatus as any).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }))
      );

      const response = await realtimeMainHandler.updateOnlineStatus(mockContext);

      expect(response).toBeInstanceOf(Response);
      expect(eventHandler.updateOnlineStatus).toHaveBeenCalled();
    });
  });
});

describe('Realtime Management Handler', () => {
  let mockContext: any;
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      SESSIONS: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null)
      },
      JWT_SECRET: 'test-secret'
    };

    mockContext = {
      req: {
        json: vi.fn().mockResolvedValue({ version: 'v2', enableEventDriven: true })
      },
      get: vi.fn().mockReturnValue({ userId: 'test-user', role: 'admin' }),
      env: mockEnv,
      json: vi.fn((data, status) => new Response(JSON.stringify(data), { status }))
    };

    vi.clearAllMocks();
  });

  describe('Configuration Management', () => {
    it('should get configuration for admin users', async () => {
      const response = await realtimeManagementHandler.getConfig(mockContext);

      expect(response).toBeInstanceOf(Response);
      const responseBody = await response.json();
      expect(responseBody.success).toBe(true);
      expect(responseBody.data).toBeDefined();
    });

    it('should deny access to non-admin users', async () => {
      mockContext.get.mockReturnValue({ userId: 'test-user', role: 'agent' });

      const response = await realtimeManagementHandler.getConfig(mockContext);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(401);
    });

    it('should update configuration for admin users', async () => {
      const response = await realtimeManagementHandler.updateConfig(mockContext);

      expect(response).toBeInstanceOf(Response);
      const responseBody = await response.json();
      expect(responseBody.success).toBe(true);
    });

    it('should deny configuration updates to non-admin users', async () => {
      mockContext.get.mockReturnValue({ userId: 'test-user', role: 'team' });

      const response = await realtimeManagementHandler.updateConfig(mockContext);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(401);
    });
  });

  describe('Statistics', () => {
    it('should get statistics for authorized users', async () => {
      mockContext.get.mockReturnValue({ userId: 'test-user', role: 'team' });

      const response = await realtimeManagementHandler.getStats(mockContext);

      expect(response).toBeInstanceOf(Response);
      const responseBody = await response.json();
      expect(responseBody.success).toBe(true);
      expect(responseBody.data).toBeDefined();
    });

    it('should deny access to unauthorized users', async () => {
      mockContext.get.mockReturnValue({ userId: 'test-user', role: 'agent' });

      const response = await realtimeManagementHandler.getStats(mockContext);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(401);
    });
  });

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      // Phase 3: Health check no longer depends on SSE stats
      const response = await realtimeManagementHandler.healthCheck(mockContext);

      expect(response).toBeInstanceOf(Response);
      const responseBody = await response.json();
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.status).toBe('healthy');
      expect(responseBody.data.note).toContain('WebSocket');
    });

    // REMOVED: SSE import error test (Phase 3 cleanup - SSE removed, WebSocket only)
    // Health check no longer imports SSE handler
  });
});

describe('Configuration Manager', () => {
  beforeEach(async () => {
    // Reset configuration to default before each test
    const { RealtimeConfigManager } = await import('@real-time/handlers/realtime-main');
    const manager = RealtimeConfigManager.getInstance();
    manager.updateConfig({
      version: 'auto',
      enableEventDriven: true,
      enableQueueProcessing: true,
      heartbeatInterval: 8000,
      connectionTimeout: 300000,
      maxRetries: 3,
      eventStorageTtl: 300
    });
  });

  it('should initialize with default configuration', async () => {
    const { RealtimeConfigManager } = await import('@real-time/handlers/realtime-main');
    const manager = RealtimeConfigManager.getInstance();

    const config = manager.getConfig();
    // Configuration should be 'auto' after reset in beforeEach
    expect(config.version).toBe('auto');
    expect(config.enableEventDriven).toBe(true);
    expect(config.enableQueueProcessing).toBe(true);
  });

  it('should update configuration correctly', async () => {
    const { RealtimeConfigManager } = await import('@real-time/handlers/realtime-main');
    const manager = RealtimeConfigManager.getInstance();

    manager.updateConfig({ version: 'v2', heartbeatInterval: 10000 });

    const config = manager.getConfig();
    expect(config.version).toBe('v2');
    expect(config.heartbeatInterval).toBe(10000);
  });

  it('should select version based on context', async () => {
    const { RealtimeConfigManager } = await import('@real-time/handlers/realtime-main');
    const manager = RealtimeConfigManager.getInstance();

    // Ensure config is set to 'auto' for this test
    manager.updateConfig({ version: 'auto' });

    const mockContext = {
      req: {
        header: vi.fn((name: string) => {
          if (name === 'Accept') return 'text/event-stream';
          return undefined;
        })
      }
    };

    const selectedVersion = manager.selectVersion(mockContext);
    expect(selectedVersion).toBe('v2');
  });

  it('should fallback to v1 when EventSource not supported', async () => {
    const { RealtimeConfigManager } = await import('@real-time/handlers/realtime-main');
    const manager = RealtimeConfigManager.getInstance();

    // Ensure config is set to 'auto' for this test
    manager.updateConfig({ version: 'auto' });

    const mockContext = {
      req: {
        header: vi.fn(() => undefined)
      }
    };

    const selectedVersion = manager.selectVersion(mockContext);
    expect(selectedVersion).toBe('v1');
  });
});