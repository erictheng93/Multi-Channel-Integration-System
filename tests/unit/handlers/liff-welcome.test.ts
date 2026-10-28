/**
 * LIFF Welcome Endpoint Unit Tests
 *
 * Tests the /api/liff/welcome endpoint with conversation sync logic.
 * This covers the fix for LINE QR Code auto-assignment for existing friends.
 *
 * Test Scenarios:
 * 1. New user (no customer record) - sends welcome message only
 * 2. Existing user, no conversation - creates new conversation and assigns team
 * 3. Existing user, has conversation with different team - transfers to new team
 * 4. Existing user, has conversation with same team - no update needed
 * 5. Error handling - sync failure should not block welcome message
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '@backend/types';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock WebSocket broadcast service
const mockBroadcastConversationTransferred = vi.fn().mockResolvedValue(undefined);
const mockBroadcastConversationEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn(function () {
    return {
      broadcastConversationTransferred: mockBroadcastConversationTransferred,
      broadcastConversationEvent: mockBroadcastConversationEvent
    };
  })
}));

vi.mock('@/modules/liff/handlers/line-id-token', () => ({
  verifyLiffIdToken: vi.fn(async (t: unknown) => (t === 'valid' ? 'U1234567890' : typeof t === 'string' && t.startsWith('tok:') ? t.slice(4) : null))
}));

vi.mock('@/modules/liff/handlers/line-id-token', () => ({
  verifyLiffIdToken: vi.fn(async (t: unknown) => (t === 'valid' ? 'U1234567890' : typeof t === 'string' && t.startsWith('tok:') ? t.slice(4) : null))
}));

// The conversation lookup orders/limits in SQL; the chainable db mock below cannot model that,
// so feed the scenario's conversation straight through (selection is covered by its own test).
vi.mock('@/services/customer-conversation-lookup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/customer-conversation-lookup')>()),
  findCustomerConversation: vi.fn(async () => mockDbResults.conversation ?? undefined)
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('mock-conversation-uuid')
}));

// Mock db results storage - will be set before each test
let mockDbResults: {
  team: any;
  customer: any;
  conversation: any;
} = { team: null, customer: null, conversation: null };

// Mock createDbClient to return a chainable mock
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn().mockImplementation(() => {
    // Create chainable mock for select queries
    const createSelectChain = (result: any) => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(result)
        }),
        get: vi.fn().mockResolvedValue(result)
      })
    });

    // Track which table is being queried
    let queryCount = 0;

    return {
      select: vi.fn().mockImplementation(() => {
        queryCount++;
        // Order: 1st=team, 2nd=customer, 3rd=conversation
        if (queryCount === 1) return createSelectChain(mockDbResults.team);
        if (queryCount === 2) return createSelectChain(mockDbResults.customer);
        if (queryCount === 3) return createSelectChain(mockDbResults.conversation);
        return createSelectChain(null);
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ success: true })
        })
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue({ success: true })
      })
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
    CACHE: { get: vi.fn().mockResolvedValue(null), put: vi.fn().mockResolvedValue(undefined) },
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

// Mock LINE API fetch
const originalFetch = global.fetch;
function mockLineApiFetch(success = true) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('api.line.me')) {
      return Promise.resolve(
        new Response(JSON.stringify({}), {
          status: success ? 200 : 400,
          headers: { 'Content-Type': 'application/json' }
        })
      );
    }
    return originalFetch(url);
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('LIFF Welcome Endpoint - Conversation Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLineApiFetch(true);
    mockDbResults = { team: null, customer: null, conversation: null };
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ==========================================================================
  // Basic Validation Tests
  // ==========================================================================
  describe('Parameter Validation', () => {
    it('should return 401 when idToken is missing or unverified', async () => {
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: 1 })
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should return 400 when teamId is missing', async () => {
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'valid' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('teamId');
    });

    it('should return 404 when team does not exist', async () => {
      mockDbResults = { team: null, customer: null, conversation: null };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'valid', teamId: 999 })
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('團隊不存在');
    });
  });

  // ==========================================================================
  // Scenario 1: New User (No Customer Record)
  // ==========================================================================
  describe('Scenario 1: New User (No Customer Record)', () => {
    it('should send welcome message without creating conversation', async () => {
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        customer: null,  // No customer record
        conversation: null
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'valid', teamId: 1 })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('歡迎消息已發送');

      // Should NOT broadcast conversation transfer (no customer)
      expect(mockBroadcastConversationTransferred).not.toHaveBeenCalled();

      // Should have called LINE API
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.any(Object)
      );
    });
  });

  describe('Dedupe marker', () => {
    const post = (app: ReturnType<typeof createTestApp>) => app.request('/api/liff/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'valid', teamId: 1 })
    });

    it('does not write the marker when the LINE push fails, so a retry can deliver', async () => {
      mockDbResults = { team: { id: 1, name: 'Test Team' }, customer: null, conversation: null };
      mockLineApiFetch(false);
      const env = createMockEnv();
      const res = await post(createTestApp(env));
      expect(res.status).toBe(500);
      expect(env.CACHE.put).not.toHaveBeenCalled();
    });

    it('writes the marker after a successful push', async () => {
      mockDbResults = { team: { id: 1, name: 'Test Team' }, customer: null, conversation: null };
      const env = createMockEnv();
      expect((await post(createTestApp(env))).status).toBe(200);
      expect(env.CACHE.put).toHaveBeenCalledWith(expect.stringContaining('liff:welcome:'), '1', { expirationTtl: 300 });
    });

    it('still returns success when the marker write fails after the push', async () => {
      mockDbResults = { team: { id: 1, name: 'Test Team' }, customer: null, conversation: null };
      const env = createMockEnv();
      env.CACHE.put.mockRejectedValueOnce(new Error('KV down'));
      expect((await post(createTestApp(env))).status).toBe(200);
    });
  });

  // ==========================================================================
  // Scenario 2: Existing User, No Conversation
  // ==========================================================================
  describe('Scenario 2: Existing User, No Conversation', () => {
    it('should create new conversation and assign to team', async () => {
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        customer: { id: 'cust-123', platformUserId: 'U1234567890', displayName: 'Test User' },
        conversation: null  // No existing conversation
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'valid', teamId: 1 })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Should broadcast new conversation
      expect(mockBroadcastConversationTransferred).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'mock-conversation-uuid',
          fromTeamId: null,
          toTeamId: 1,
          toTeamName: 'Test Team',
          reason: 'LIFF QR Code - New Conversation for Existing Friend'
        })
      );
    });
  });

  // ==========================================================================
  // Scenario 3: Existing User with Conversation in Different Team
  // ==========================================================================
  describe('Scenario 3: Existing User with Conversation in Different Team', () => {
    it('should transfer conversation to new team', async () => {
      mockDbResults = {
        team: { id: 2, name: 'New Team' },
        customer: { id: 'cust-123', platformUserId: 'U1234567890', displayName: 'Test User' },
        conversation: {
          id: 'conv-existing',
          customerId: 'cust-123',
          assignedTeamId: 1,  // Currently in Team 1
          status: 'active'
        }
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'valid', teamId: 2 })  // Scanning Team 2 QR
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Should broadcast conversation transfer
      expect(mockBroadcastConversationTransferred).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-existing',
          fromTeamId: 1,
          toTeamId: 2,
          toTeamName: 'New Team',
          reason: 'LIFF QR Code - Existing Friend Reassignment'
        })
      );
    });
  });

  // ==========================================================================
  // Scenario 4: Existing User with Conversation in Same Team
  // ==========================================================================
  describe('Scenario 4: Existing User with Conversation in Same Team', () => {
    it('should not update conversation when already in correct team', async () => {
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        customer: { id: 'cust-123', platformUserId: 'U1234567890', displayName: 'Test User' },
        conversation: {
          id: 'conv-existing',
          customerId: 'cust-123',
          assignedTeamId: 1,  // Already in Team 1
          status: 'active'
        }
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'valid', teamId: 1 })  // Same team
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Should NOT broadcast - no change needed
      expect(mockBroadcastConversationTransferred).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 4b: Existing User with a Closed Conversation', () => {
    it('reopens the closed conversation even when the team is unchanged', async () => {
      mockBroadcastConversationEvent.mockClear();
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        customer: { id: 'cust-123', platformUserId: 'U1234567890', displayName: 'Test User' },
        conversation: { id: 'conv-closed', customerId: 'cust-123', assignedTeamId: 1, status: 'closed' }
      };
      const app = createTestApp(createMockEnv());

      const response = await app.request('/api/liff/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'valid', teamId: 1 })
      });

      expect(response.status).toBe(200);
      expect(mockBroadcastConversationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversation_status_changed',
          conversationId: 'conv-closed',
          data: expect.objectContaining({ status: 'assigned' })
        })
      );
    });
  });

  // ==========================================================================
  // Scenario 5: Error Handling - Non-blocking Sync Failure
  // ==========================================================================
  describe('Scenario 5: Error Handling', () => {
    it('should still send welcome message when WebSocket broadcast fails', async () => {
      // Mock broadcast to throw error
      mockBroadcastConversationTransferred.mockRejectedValueOnce(new Error('Broadcast failed'));

      mockDbResults = {
        team: { id: 2, name: 'New Team' },
        customer: { id: 'cust-123', platformUserId: 'U1234567890', displayName: 'Test User' },
        conversation: {
          id: 'conv-existing',
          customerId: 'cust-123',
          assignedTeamId: 1,
          status: 'active'
        }
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'valid', teamId: 2 })
      });

      // Should still succeed - sync failure is non-blocking
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('歡迎消息已發送');
    });

    it('should return error when LINE API fails', async () => {
      mockLineApiFetch(false);  // LINE API returns error

      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        customer: null,
        conversation: null
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'valid', teamId: 1 })
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('發送歡迎消息失敗');
    });

    it('should return 500 when LINE_CHANNEL_ACCESS_TOKEN is missing', async () => {
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        customer: null,
        conversation: null
      };
      const env = createMockEnv();
      env.LINE_CHANNEL_ACCESS_TOKEN = '';  // Missing token
      const app = createTestApp(env);

      const response = await app.request('/api/liff/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'valid', teamId: 1 })
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('LINE 整合未配置');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('should handle customer with null displayName', async () => {
      mockDbResults = {
        team: { id: 1, name: 'Test Team' },
        customer: { id: 'cust-123', platformUserId: 'U1234567890', displayName: null },
        conversation: null
      };
      const env = createMockEnv();
      const app = createTestApp(env);

      const response = await app.request('/api/liff/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'valid', teamId: 1 })
      });

      expect(response.status).toBe(200);

      // Should broadcast with undefined customerName (not null)
      expect(mockBroadcastConversationTransferred).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation: expect.objectContaining({
            customerName: undefined  // null ?? undefined = undefined
          })
        })
      );
    });
  });
});

// ============================================================================
// Integration Test: Full Flow
// ============================================================================
describe('LIFF Welcome - Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLineApiFetch(true);
    mockDbResults = { team: null, customer: null, conversation: null };
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should complete full flow: sync conversation + send welcome', async () => {
    mockDbResults = {
      team: { id: 2, name: 'Sales Team' },
      customer: {
        id: 'cust-abc',
        platformUserId: 'Uabcdef123456',
        displayName: 'John Doe'
      },
      conversation: {
        id: 'conv-xyz',
        customerId: 'cust-abc',
        assignedTeamId: 1,  // Was in Support Team (ID: 1)
        status: 'active'
      }
    };
    const env = createMockEnv();
    const app = createTestApp(env);

    const response = await app.request('/api/liff/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: 'tok:Uabcdef123456',
        teamId: 2  // Scanned Sales Team QR
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    // Verify success
    expect(data.success).toBe(true);
    expect(data.data.message).toBe('歡迎消息已發送');

    // Verify WebSocket broadcast was called with correct data
    expect(mockBroadcastConversationTransferred).toHaveBeenCalledTimes(1);
    expect(mockBroadcastConversationTransferred).toHaveBeenCalledWith({
      conversationId: 'conv-xyz',
      fromTeamId: 1,
      toTeamId: 2,
      toTeamName: 'Sales Team',
      conversation: {
        id: 'conv-xyz',
        customerId: 'cust-abc',
        customerName: 'John Doe',
        platform: 'line',
        status: 'active',
        assignedTeamId: 2
      },
      transferredBy: { id: 'system', name: 'QR Code Scan' },
      reason: 'LIFF QR Code - Existing Friend Reassignment'
    });

    // Verify LINE API was called
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/message/push',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock-line-token'
        })
      })
    );
  });
});

describe('LIFF Welcome Endpoint - quota abuse guards', () => {
  const team = { id: 1, name: 'Test Team' };
  const post = (env: ReturnType<typeof createMockEnv>, teamId: unknown) =>
    createTestApp(env).request('/api/liff/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'valid', teamId })
    });
  const withLimiter = (status: number) => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status }));
    const env = { ...createMockEnv(), RATE_LIMITER: { idFromName: vi.fn(() => 'id'), get: vi.fn(() => ({ fetch })) } };
    return { env, fetch };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLineApiFetch(true);
    mockDbResults = { team, customer: null, conversation: null };
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each(['01', '1.0', ' 1', -1, 1.5, '1e0'])('rejects non-canonical teamId %j', async (teamId) => {
    expect((await post(createMockEnv(), teamId)).status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('dedupes per LINE user, not per team', async () => {
    const env = createMockEnv();
    expect((await post(env, '1')).status).toBe(200);
    expect(env.CACHE.put).toHaveBeenCalledWith('liff:welcome:U1234567890', '1', { expirationTtl: 300 });
  });

  it('skips the push when the limiter has already been claimed', async () => {
    const { env } = withLimiter(429);
    expect((await post(env as never, 1)).status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([500, 503])('returns a retryable 503 without pushing when the limiter answers %i', async (status) => {
    const { env } = withLimiter(status);
    expect((await post(env as never, 1)).status).toBe(503);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a retryable 503 without pushing when the limiter throws', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('DO down'));
    const env = { ...createMockEnv(), RATE_LIMITER: { idFromName: vi.fn(() => 'id'), get: vi.fn(() => ({ fetch })) } };
    expect((await post(env as never, 1)).status).toBe(503);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('releases the claim when the LINE push fails', async () => {
    mockLineApiFetch(false);
    const { env, fetch } = withLimiter(200);
    expect((await post(env as never, 1)).status).toBe(500);
    const actions = fetch.mock.calls.map(([, init]) => JSON.parse(init.body).action);
    expect(actions).toEqual(['check', 'reset']);
  });
});
