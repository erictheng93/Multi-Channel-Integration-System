/**
 * LIFF Assign-Team Endpoint Unit Tests
 *
 * Tests the /api/liff/assign-team endpoint in liff.ts
 * This covers the pre-assignment recording when users scan QR codes via LIFF.
 *
 * Test Scenarios:
 * 1. Basic assignment creation - records team assignment successfully
 * 2. Parameter validation - missing lineUserId or teamId
 * 3. Team existence validation - team not found
 * 4. Idempotency - duplicate assignment returns existing record
 * 5. QR code scan count update
 * 6. WebSocket pre-notification broadcast
 * 7. Error handling - broadcast failure is non-blocking
 *
 * @see src/handlers/liff.ts (lines 118-270)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '@backend/types';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock WebSocket broadcast service
const mockBroadcastConversationTransferred = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastConversationTransferred: mockBroadcastConversationTransferred
  }))
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('mock-assignment-uuid')
}));

// Database mock results storage
let mockDbResults: {
  team: any;
  existingAssignment: any;
  qrCode: any;
} = { team: null, existingAssignment: null, qrCode: null };

// Track database operations
let dbOperations: {
  inserts: { table: string; values: any }[];
  updates: { table: string; set: any }[];
} = { inserts: [], updates: [] };

// Mock createDbClient
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn().mockImplementation(() => {
    let selectQueryCount = 0;

    const createSelectChain = (result: any) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(result)
        }),
        get: vi.fn().mockResolvedValue(result)
      })
    });

    return {
      select: vi.fn().mockImplementation(() => {
        selectQueryCount++;
        // Query order in assign-team endpoint:
        // 1. Check team exists
        // 2. Check existing assignment
        // 3. Check QR code for scan count
        if (selectQueryCount === 1) return createSelectChain(mockDbResults.team);
        if (selectQueryCount === 2) return createSelectChain(mockDbResults.existingAssignment);
        if (selectQueryCount === 3) return createSelectChain(mockDbResults.qrCode);
        return createSelectChain(null);
      }),
      insert: vi.fn().mockImplementation((table: any) => ({
        values: vi.fn().mockImplementation((values: any) => {
          dbOperations.inserts.push({ table: table?.name || 'customerTeamAssignments', values });
          return Promise.resolve({ success: true });
        })
      })),
      update: vi.fn().mockImplementation((table: any) => ({
        set: vi.fn().mockImplementation((setValues: any) => ({
          where: vi.fn().mockImplementation(() => {
            dbOperations.updates.push({ table: table?.name || 'teamLiffQrCodes', set: setValues });
            return Promise.resolve({ success: true });
          })
        }))
      }))
    };
  })
}));

// Import handler after mocks
import liffHandler from '@modules/liff/handlers/liff';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockEnv() {
  return {
    DB: {},
    LINE_CHANNEL_ACCESS_TOKEN: 'mock-line-token',
    SESSIONS: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined)
    },
    MESSAGE_BROADCASTER: {
      idFromName: vi.fn().mockReturnValue({ toString: () => 'mock-do-id' }),
      get: vi.fn().mockReturnValue({
        fetch: vi.fn().mockResolvedValue(new Response('{}'))
      })
    }
  };
}

function createTestApp(env: ReturnType<typeof createMockEnv>) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use('*', async (c, next) => {
    c.env = env as any;
    await next();
  });
  app.route('/api/liff', liffHandler);
  return app;
}

// ============================================================================
// Tests
// ============================================================================

describe('LIFF Assign-Team Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbResults = { team: null, existingAssignment: null, qrCode: null };
    dbOperations = { inserts: [], updates: [] };
  });

  // ==========================================================================
  // Parameter Validation Tests
  // ==========================================================================
  describe('Parameter Validation', () => {
    it('should return 400 when lineUserId is missing', async () => {
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: 1 })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('lineUserId');
    });

    it('should return 400 when teamId is missing', async () => {
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: 'U1234567890' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('teamId');
    });

    it('should return 400 when both parameters are missing', async () => {
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  // ==========================================================================
  // Team Validation Tests
  // ==========================================================================
  describe('Team Validation', () => {
    it('should return 404 when team does not exist', async () => {
      mockDbResults = { team: null, existingAssignment: null, qrCode: null };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: 'U1234567890', teamId: 999 })
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('團隊不存在');
    });
  });

  // ==========================================================================
  // Successful Assignment Tests
  // ==========================================================================
  describe('Successful Assignment', () => {
    it('should create new assignment record when no existing assignment', async () => {
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        existingAssignment: null,
        qrCode: { id: 'qr-1', teamId: 1, scanCount: 5 }
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: 'U1234567890',
          teamId: 1,
          displayName: 'Test User'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.assignmentId).toBe('mock-assignment-uuid');
      expect(data.data.teamName).toBe('Test Team');
      expect(data.data.message).toBe('團隊分配記錄成功');

      // Verify assignment was inserted
      const insertOp = dbOperations.inserts.find(i => i.table === 'customerTeamAssignments');
      expect(insertOp).toBeDefined();
      expect(insertOp?.values).toMatchObject({
        id: 'mock-assignment-uuid',
        platformUserId: 'U1234567890',
        teamId: 1,
        source: 'liff_qr',
        displayName: 'Test User'
      });
    });

    it('should update QR code scan count', async () => {
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        existingAssignment: null,
        qrCode: { id: 'qr-1', teamId: 1, scanCount: 10 }
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: 'U1234567890', teamId: 1 })
      });

      expect(response.status).toBe(200);

      // Verify scan count was updated
      const updateOp = dbOperations.updates.find(u => u.table === 'teamLiffQrCodes');
      expect(updateOp).toBeDefined();
      expect(updateOp?.set.scanCount).toBe(11);
    });

    it('should handle assignment without QR code record', async () => {
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        existingAssignment: null,
        qrCode: null // No QR code record
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: 'U1234567890', teamId: 1 })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Should not update scan count (no QR code record)
      expect(dbOperations.updates).toHaveLength(0);
    });

    it('should include metadata with user agent and timestamp', async () => {
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        existingAssignment: null,
        qrCode: null
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 LIFF/2.0'
        },
        body: JSON.stringify({ lineUserId: 'U1234567890', teamId: 1 })
      });

      expect(response.status).toBe(200);

      const insertOp = dbOperations.inserts.find(i => i.table === 'customerTeamAssignments');
      const metadata = JSON.parse(insertOp?.values.metadata);
      expect(metadata.userAgent).toBe('Mozilla/5.0 LIFF/2.0');
      expect(metadata.timestamp).toBeDefined();
    });

    it('should use provided timestamp if available', async () => {
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        existingAssignment: null,
        qrCode: null
      };
      const env = createMockEnv();
      const app = createTestApp(env);
      const customTimestamp = '2024-06-15T12:00:00Z';

      const response = await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: 'U1234567890',
          teamId: 1,
          timestamp: customTimestamp
        })
      });

      expect(response.status).toBe(200);

      const insertOp = dbOperations.inserts.find(i => i.table === 'customerTeamAssignments');
      expect(insertOp?.values.assignedAt).toBe(customTimestamp);
    });
  });

  // ==========================================================================
  // Idempotency Tests
  // ==========================================================================
  describe('Idempotency', () => {
    it('should return existing assignment when duplicate request', async () => {
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        existingAssignment: {
          id: 'existing-assignment-id',
          platformUserId: 'U1234567890',
          teamId: 1,
          source: 'liff_qr'
        },
        qrCode: null
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: 'U1234567890', teamId: 1 })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.assignmentId).toBe('existing-assignment-id');
      expect(data.data.message).toBe('已經記錄過團隊分配');

      // Should NOT insert new record
      expect(dbOperations.inserts).toHaveLength(0);
    });

    it('should not update scan count for duplicate assignment', async () => {
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        existingAssignment: { id: 'existing-id' },
        qrCode: { id: 'qr-1', scanCount: 10 }
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: 'U1234567890', teamId: 1 })
      });

      // Should NOT update scan count for duplicate
      expect(dbOperations.updates).toHaveLength(0);
    });
  });

  // ==========================================================================
  // WebSocket Pre-notification Tests
  // ==========================================================================
  describe('WebSocket Pre-notification', () => {
    it('should broadcast pending conversation via WebSocket', async () => {
      mockDbResults = {
        team: { id: 5, name: 'Sales Team' },
        existingAssignment: null,
        qrCode: null
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId: 'Uabcdef123456',
          teamId: 5,
          displayName: 'John Doe'
        })
      });

      expect(response.status).toBe(200);

      expect(mockBroadcastConversationTransferred).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: expect.stringContaining('pending-'),
          fromTeamId: null,
          toTeamId: 5,
          toTeamName: 'Sales Team',
          conversation: expect.objectContaining({
            customerName: 'John Doe',
            platform: 'line',
            status: 'pending',
            _liffMetadata: expect.objectContaining({
              isPending: true,
              lineUserId: 'Uabcdef123456',
              assignmentId: 'mock-assignment-uuid'
            })
          }),
          reason: 'LIFF QR Code Pre-Assignment'
        })
      );
    });

    it('should use default name when displayName not provided', async () => {
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        existingAssignment: null,
        qrCode: null
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: 'U1234567890', teamId: 1 })
      });

      expect(mockBroadcastConversationTransferred).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation: expect.objectContaining({
            customerName: 'LINE 用戶'
          })
        })
      );
    });

    it('should continue when broadcast fails (non-blocking)', async () => {
      mockBroadcastConversationTransferred.mockRejectedValueOnce(new Error('Broadcast failed'));
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        existingAssignment: null,
        qrCode: null
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: 'U1234567890', teamId: 1 })
      });

      // Should still return success
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toBe('團隊分配記錄成功');
    });

    it('should not broadcast for duplicate assignment', async () => {
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        existingAssignment: { id: 'existing-id' },
        qrCode: null
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: 'U1234567890', teamId: 1 })
      });

      // Should NOT broadcast for duplicate
      expect(mockBroadcastConversationTransferred).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================
  describe('Error Handling', () => {
    it('should return 500 when database insert fails', async () => {
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        existingAssignment: null,
        qrCode: null
      };

      // Mock insert to throw error
      vi.mocked((await import('@/db/drizzle-factory')).createDbClient).mockImplementationOnce(() => ({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              get: vi.fn()
                .mockResolvedValueOnce({ id: 1, name: 'Test Team' }) // team
                .mockResolvedValueOnce(null) // no existing assignment
            })
          })
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockRejectedValue(new Error('Insert failed'))
        })
      }));

      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: 'U1234567890', teamId: 1 })
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      // globalErrorHandler returns a nested error object, not a flat string
      expect(data.error).toBeTruthy();
    });

    it('should handle invalid JSON body', async () => {
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      // Hono returns 400 for malformed JSON bodies
      expect(response.status).toBe(400);
    });
  });

  // ==========================================================================
  // Integration Test
  // ==========================================================================
  describe('Integration: Full Flow', () => {
    it('should complete full assignment flow with all features', async () => {
      mockDbResults = {
        team: { id: 7, name: 'Support Team' },
        existingAssignment: null,
        qrCode: { id: 'qr-abc', teamId: 7, scanCount: 42 }
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/assign-team', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LIFF/2.0 iPhone'
        },
        body: JSON.stringify({
          lineUserId: 'U9876543210',
          teamId: 7,
          displayName: 'Jane Smith',
          timestamp: '2024-06-20T15:30:00Z'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // 1. Verify response
      expect(data.success).toBe(true);
      expect(data.data.assignmentId).toBe('mock-assignment-uuid');
      expect(data.data.teamName).toBe('Support Team');

      // 2. Verify assignment record
      const insertOp = dbOperations.inserts[0];
      expect(insertOp.values).toMatchObject({
        platformUserId: 'U9876543210',
        teamId: 7,
        source: 'liff_qr',
        displayName: 'Jane Smith',
        assignedAt: '2024-06-20T15:30:00Z'
      });

      // 3. Verify scan count update
      const updateOp = dbOperations.updates[0];
      expect(updateOp.set.scanCount).toBe(43);

      // 4. Verify WebSocket broadcast
      expect(mockBroadcastConversationTransferred).toHaveBeenCalledWith(
        expect.objectContaining({
          toTeamId: 7,
          toTeamName: 'Support Team',
          conversation: expect.objectContaining({
            customerName: 'Jane Smith',
            _liffMetadata: expect.objectContaining({
              isPending: true,
              lineUserId: 'U9876543210'
            })
          })
        })
      );
    });
  });
});
