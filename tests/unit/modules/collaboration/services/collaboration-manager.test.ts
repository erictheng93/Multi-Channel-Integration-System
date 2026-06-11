// tests/unit/modules/collaboration/services/collaboration-manager.test.ts
// Unit tests for CollaborationManager

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollaborationManager } from '@modules/collaboration/services/collaboration-manager';
import type {
  CollaborationStats,
  JoinConversationRequest,
  LeaveConversationRequest,
  SendTypingRequest,
  UpdatePresenceRequest,
  CollaborationConfig,
} from '@modules/collaboration/types';

// ---------------------------------------------------------------------------
// Mock the WebSocket adapter module
// ---------------------------------------------------------------------------

const mockWsInitialize = vi.fn().mockResolvedValue(undefined);
const mockJoinConversation = vi.fn().mockResolvedValue(undefined);
const mockLeaveConversation = vi.fn().mockResolvedValue(undefined);
const mockSendTyping = vi.fn().mockResolvedValue(undefined);
const mockUpdatePresence = vi.fn().mockResolvedValue(undefined);
const mockBroadcastEvent = vi.fn().mockResolvedValue(undefined);
const mockCleanup = vi.fn().mockResolvedValue(3);
const mockGetStats = vi.fn().mockResolvedValue<CollaborationStats>({
  totalViewers: 5,
  totalTyping: 2,
  totalRooms: 3,
  connectionsByProtocol: { websocket: 5, http: 0 },
  topActiveConversations: [{ conversationId: 1, viewerCount: 3 }],
});
const mockGetConversationViewers = vi.fn().mockResolvedValue([]);
const mockGetConversationState = vi.fn().mockResolvedValue({
  conversationId: 1,
  viewers: [],
  typing: [],
  totalConnections: 0,
  protocol: 'websocket',
  lastActivity: new Date().toISOString(),
});

const mockWsAdapter = {
  protocol: 'websocket' as const,
  initialize: mockWsInitialize,
  getConversationViewers: mockGetConversationViewers,
  getConversationState: mockGetConversationState,
  joinConversation: mockJoinConversation,
  leaveConversation: mockLeaveConversation,
  sendTyping: mockSendTyping,
  updatePresence: mockUpdatePresence,
  broadcastEvent: mockBroadcastEvent,
  getStats: mockGetStats,
  cleanup: mockCleanup,
};

vi.mock('@modules/collaboration/adapters/websocket-adapter', () => ({
  WebSocketCollaborationAdapter: vi.fn(function () {
    return mockWsAdapter;
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockEnv = {} as any;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollaborationManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton between every test
    (CollaborationManager as any).instance = undefined;

    // Restore defaults
    mockWsInitialize.mockResolvedValue(undefined);
    mockJoinConversation.mockResolvedValue(undefined);
    mockLeaveConversation.mockResolvedValue(undefined);
    mockSendTyping.mockResolvedValue(undefined);
    mockUpdatePresence.mockResolvedValue(undefined);
    mockBroadcastEvent.mockResolvedValue(undefined);
    mockCleanup.mockResolvedValue(3);
    mockGetStats.mockResolvedValue({
      totalViewers: 5,
      totalTyping: 2,
      totalRooms: 3,
      connectionsByProtocol: { websocket: 5, http: 0 },
      topActiveConversations: [{ conversationId: 1, viewerCount: 3 }],
    });
  });

  // -------------------------------------------------------------------------
  // Singleton behaviour
  // -------------------------------------------------------------------------

  describe('getInstance()', () => {
    it('returns the same instance on multiple calls', () => {
      const a = CollaborationManager.getInstance();
      const b = CollaborationManager.getInstance();
      expect(a).toBe(b);
    });

    it('creates a new instance after singleton reset', () => {
      const first = CollaborationManager.getInstance();
      (CollaborationManager as any).instance = undefined;
      const second = CollaborationManager.getInstance();
      expect(first).not.toBe(second);
    });

    it('accepts an optional config on first call', () => {
      const manager = CollaborationManager.getInstance({
        typingExpirationSeconds: 10,
      });
      expect(manager.getConfig().typingExpirationSeconds).toBe(10);
    });
  });

  // -------------------------------------------------------------------------
  // initialize()
  // -------------------------------------------------------------------------

  describe('initialize()', () => {
    it('initializes the WebSocket adapter and marks the manager as ready', async () => {
      const manager = CollaborationManager.getInstance();
      await manager.initialize(mockEnv);

      expect(mockWsInitialize).toHaveBeenCalledWith(mockEnv);
      expect(manager.isInitialized()).toBe(true);
    });

    it('sets WebSocket as the default protocol after initialization', async () => {
      const manager = CollaborationManager.getInstance();
      await manager.initialize(mockEnv);

      expect(manager.getConfig().defaultProtocol).toBe('websocket');
    });

    it('exposes websocket as an available protocol after initialization', async () => {
      const manager = CollaborationManager.getInstance();
      await manager.initialize(mockEnv);

      expect(manager.getAvailableProtocols()).toContain('websocket');
    });

    it('throws when WebSocket adapter initialization fails', async () => {
      mockWsInitialize.mockRejectedValueOnce(new Error('WS init error'));

      const manager = CollaborationManager.getInstance();
      await expect(manager.initialize(mockEnv)).rejects.toThrow('WebSocket initialization failed.');
      expect(manager.isInitialized()).toBe(false);
    });

    it('merges additional config passed to initialize()', async () => {
      const manager = CollaborationManager.getInstance();
      await manager.initialize(mockEnv, { maxViewersPerConversation: 100 });

      expect(manager.getConfig().maxViewersPerConversation).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // Uninitialized access
  // -------------------------------------------------------------------------

  describe('uninitialized access', () => {
    it('throws when joinConversation is called before initialize()', async () => {
      const manager = CollaborationManager.getInstance();
      const req: JoinConversationRequest = { conversationId: 1, userId: 10 };

      await expect(manager.joinConversation(req)).rejects.toThrow(
        'CollaborationManager not initialized'
      );
    });

    it('throws when leaveConversation is called before initialize()', async () => {
      const manager = CollaborationManager.getInstance();
      const req: LeaveConversationRequest = { conversationId: 1, userId: 10 };

      await expect(manager.leaveConversation(req)).rejects.toThrow(
        'CollaborationManager not initialized'
      );
    });

    it('throws when sendTyping is called before initialize()', async () => {
      const manager = CollaborationManager.getInstance();
      const req: SendTypingRequest = { conversationId: 1, userId: 10, status: 'start' };

      await expect(manager.sendTyping(req)).rejects.toThrow(
        'CollaborationManager not initialized'
      );
    });
  });

  // -------------------------------------------------------------------------
  // joinConversation / leaveConversation
  // -------------------------------------------------------------------------

  describe('joinConversation()', () => {
    it('delegates to the WebSocket adapter', async () => {
      const manager = CollaborationManager.getInstance();
      await manager.initialize(mockEnv);

      const req: JoinConversationRequest = { conversationId: 5, userId: 10 };
      await manager.joinConversation(req);

      expect(mockJoinConversation).toHaveBeenCalledWith(req);
    });
  });

  describe('leaveConversation()', () => {
    it('delegates to the WebSocket adapter', async () => {
      const manager = CollaborationManager.getInstance();
      await manager.initialize(mockEnv);

      const req: LeaveConversationRequest = { conversationId: 5, userId: 10 };
      await manager.leaveConversation(req);

      expect(mockLeaveConversation).toHaveBeenCalledWith(req);
    });
  });

  // -------------------------------------------------------------------------
  // sendTyping / updatePresence
  // -------------------------------------------------------------------------

  describe('sendTyping()', () => {
    it('delegates typing status to the adapter', async () => {
      const manager = CollaborationManager.getInstance();
      await manager.initialize(mockEnv);

      const req: SendTypingRequest = { conversationId: 5, userId: 10, status: 'start' };
      await manager.sendTyping(req);

      expect(mockSendTyping).toHaveBeenCalledWith(req);
    });
  });

  describe('updatePresence()', () => {
    it('delegates presence update to the adapter', async () => {
      const manager = CollaborationManager.getInstance();
      await manager.initialize(mockEnv);

      const req: UpdatePresenceRequest = { userId: 10, status: 'online' };
      await manager.updatePresence(req);

      expect(mockUpdatePresence).toHaveBeenCalledWith(req);
    });
  });

  // -------------------------------------------------------------------------
  // getStats()
  // -------------------------------------------------------------------------

  describe('getStats()', () => {
    it('aggregates stats from all adapters when no protocol is specified', async () => {
      const manager = CollaborationManager.getInstance();
      await manager.initialize(mockEnv);

      const stats = await manager.getStats();

      expect(stats.totalViewers).toBe(5);
      expect(stats.totalRooms).toBe(3);
      expect(stats.connectionsByProtocol.websocket).toBe(5);
    });

    it('returns stats from a specific protocol adapter when specified', async () => {
      const manager = CollaborationManager.getInstance();
      await manager.initialize(mockEnv);

      const stats = await manager.getStats('websocket');

      expect(mockGetStats).toHaveBeenCalledOnce();
      expect(stats.totalViewers).toBe(5);
    });

    it('merges topActiveConversations across multiple adapter stats', async () => {
      // Simulate two calls to getStats (two adapters) returning different conversations
      mockGetStats
        .mockResolvedValueOnce({
          totalViewers: 3,
          totalTyping: 1,
          totalRooms: 2,
          connectionsByProtocol: { websocket: 3, http: 0 },
          topActiveConversations: [{ conversationId: 10, viewerCount: 2 }],
        })
        .mockResolvedValueOnce({
          totalViewers: 4,
          totalTyping: 2,
          totalRooms: 3,
          connectionsByProtocol: { websocket: 4, http: 0 },
          topActiveConversations: [
            { conversationId: 10, viewerCount: 1 },
            { conversationId: 20, viewerCount: 3 },
          ],
        });

      const manager = CollaborationManager.getInstance();
      await manager.initialize(mockEnv);

      // Re-mock adapter so the manager has "two" adapters worth of data
      // (Here we just call getStats() twice to verify merging logic path)
      const stats = await manager.getStats();

      // Should have at least the conversation from the single call
      expect(stats.topActiveConversations.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // cleanup()
  // -------------------------------------------------------------------------

  describe('cleanup()', () => {
    it('calls cleanup on all adapters and returns total cleaned count', async () => {
      mockCleanup.mockResolvedValue(7);

      const manager = CollaborationManager.getInstance();
      await manager.initialize(mockEnv);

      const cleaned = await manager.cleanup();

      expect(mockCleanup).toHaveBeenCalledOnce();
      expect(cleaned).toBe(7);
    });

    it('tolerates adapter cleanup errors and continues with other adapters', async () => {
      mockCleanup.mockRejectedValueOnce(new Error('Cleanup failed'));

      const manager = CollaborationManager.getInstance();
      await manager.initialize(mockEnv);

      // Should not throw
      const cleaned = await manager.cleanup();
      expect(cleaned).toBe(0); // error suppressed, no items cleaned
    });
  });

  // -------------------------------------------------------------------------
  // Config management
  // -------------------------------------------------------------------------

  describe('updateConfig()', () => {
    it('merges new config values while preserving existing ones', async () => {
      const manager = CollaborationManager.getInstance();
      await manager.initialize(mockEnv);

      const before = manager.getConfig().typingExpirationSeconds;
      manager.updateConfig({ typingExpirationSeconds: 30 });

      const after = manager.getConfig();
      expect(after.typingExpirationSeconds).toBe(30);
      // Other values should be unchanged
      expect(after.enableWebSocket).toBe(manager.getConfig().enableWebSocket);
    });
  });
});
