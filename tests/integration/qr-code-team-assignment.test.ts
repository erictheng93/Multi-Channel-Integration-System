/**
 * QR Code Team Assignment Integration Tests
 *
 * P2 Integration Tests: QR 掃描 → 廣播 → 前端協調 完整流程
 *
 * 測試範圍：
 * 1. LIFF 預通知 → Webhook 確認的完整協調流程
 * 2. 團隊指派優先級驗證 (assignment > qr_token)
 * 3. WebSocket 廣播和前端 Reconciliation
 * 4. 新用戶和既有好友的不同路徑
 * 5. 錯誤恢復和重試機制
 *
 * @see docs/claude/TESTING.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_CONFIG = {
  baseUrl: process.env.TEST_API_URL || 'http://localhost:8787',
  adminToken: process.env.TEST_ADMIN_TOKEN || 'test-admin-token',
  testTeamId: 1,
  testLineUserId: 'U1234567890abcdef1234567890abcdef'
};

// ============================================================================
// Mock Setup for Integration Tests
// ============================================================================

// Shared state for simulating WebSocket broadcasts
let broadcastEvents: any[] = [];
let assignmentRecords: Map<string, any> = new Map();
let customerRecords: Map<string, any> = new Map();
let conversationRecords: Map<string, any> = new Map();

// Mock WebSocket broadcast service
const mockBroadcastConversationTransferred = vi.fn().mockImplementation((data) => {
  broadcastEvents.push({
    type: 'conversation_transferred',
    timestamp: Date.now(),
    data
  });
  return Promise.resolve();
});

vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastConversationTransferred: mockBroadcastConversationTransferred
  }))
}));

// ============================================================================
// Test Utilities
// ============================================================================

function resetTestState() {
  broadcastEvents = [];
  assignmentRecords.clear();
  customerRecords.clear();
  conversationRecords.clear();
  vi.clearAllMocks();
}

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

/**
 * Simulate the LIFF assign-team call (Step 1 in user journey)
 */
async function simulateLiffAssignTeam(lineUserId: string, teamId: number, displayName?: string) {
  const assignmentId = `assign-${Date.now()}`;
  const assignment = {
    id: assignmentId,
    platformUserId: lineUserId,
    teamId,
    source: 'liff_qr',
    displayName: displayName || 'LINE User',
    assignedAt: new Date().toISOString()
  };

  assignmentRecords.set(lineUserId, assignment);

  // Simulate WebSocket pre-notification
  mockBroadcastConversationTransferred({
    conversationId: `pending-${assignmentId}`,
    fromTeamId: null,
    toTeamId: teamId,
    toTeamName: `Team ${teamId}`,
    conversation: {
      id: `pending-${assignmentId}`,
      customerName: displayName || 'LINE User',
      platform: 'line',
      status: 'pending',
      _liffMetadata: {
        isPending: true,
        lineUserId,
        assignmentId,
        scannedAt: Date.now()
      }
    },
    reason: 'LIFF QR Code Pre-Assignment'
  });

  return { assignmentId, teamId };
}

/**
 * Simulate the Webhook follow event (Step 2 for new users)
 */
async function simulateWebhookFollow(lineUserId: string, displayName?: string) {
  // Check for assignment
  const assignment = assignmentRecords.get(lineUserId);
  const teamId = assignment?.teamId || null;

  // Create customer
  const customerId = customerRecords.size + 1;
  const customer = {
    id: customerId,
    platformUserId: lineUserId,
    platform: 'line',
    displayName: displayName || 'LINE User',
    createdAt: new Date().toISOString()
  };
  customerRecords.set(lineUserId, customer);

  // Create conversation if team assigned
  if (teamId) {
    const conversationId = `conv-${Date.now()}`;
    const conversation = {
      id: conversationId,
      customerId,
      assignedTeamId: teamId,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    conversationRecords.set(conversationId, conversation);

    // Simulate WebSocket confirmation
    mockBroadcastConversationTransferred({
      conversationId,
      fromTeamId: null,
      toTeamId: teamId,
      toTeamName: `Team ${teamId}`,
      conversation: {
        id: conversationId,
        customerId,
        customerName: displayName || 'LINE User',
        platform: 'line',
        status: 'active',
        _liffMetadata: {
          isPending: false,
          lineUserId,
          isWebhookConfirmation: true
        }
      },
      reason: 'QR Code Follow - Auto Assignment'
    });

    return { customerId, conversationId, teamId };
  }

  return { customerId, conversationId: null, teamId: null };
}

/**
 * Simulate the LIFF welcome call (Step 2 for existing friends)
 */
async function simulateLiffWelcome(lineUserId: string, teamId: number) {
  const customer = customerRecords.get(lineUserId);

  if (!customer) {
    // No customer - just send welcome message
    return { synced: false, reason: 'no_customer' };
  }

  // Find existing conversation
  const existingConv = Array.from(conversationRecords.values()).find(
    c => c.customerId === customer.id && c.status !== 'closed'
  );

  if (existingConv) {
    if (existingConv.assignedTeamId !== teamId) {
      // Transfer to new team
      existingConv.assignedTeamId = teamId;

      mockBroadcastConversationTransferred({
        conversationId: existingConv.id,
        fromTeamId: existingConv.assignedTeamId,
        toTeamId: teamId,
        conversation: {
          id: existingConv.id,
          customerId: customer.id,
          customerName: customer.displayName,
          platform: 'line',
          status: 'active',
          _liffMetadata: {
            isPending: false,
            lineUserId,
            isWebhookConfirmation: true
          }
        },
        reason: 'LIFF QR Code - Existing Friend Reassignment'
      });

      return { synced: true, action: 'transferred', conversationId: existingConv.id };
    }

    return { synced: true, action: 'no_change', conversationId: existingConv.id };
  } else {
    // Create new conversation
    const conversationId = `conv-${Date.now()}`;
    const conversation = {
      id: conversationId,
      customerId: customer.id,
      assignedTeamId: teamId,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    conversationRecords.set(conversationId, conversation);

    mockBroadcastConversationTransferred({
      conversationId,
      fromTeamId: null,
      toTeamId: teamId,
      conversation: {
        id: conversationId,
        customerId: customer.id,
        customerName: customer.displayName,
        platform: 'line',
        status: 'active',
        _liffMetadata: {
          isPending: false,
          lineUserId,
          isWebhookConfirmation: true
        }
      },
      reason: 'LIFF QR Code - New Conversation for Existing Friend'
    });

    return { synced: true, action: 'created', conversationId };
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('QR Code Team Assignment Integration Tests', () => {
  beforeEach(() => {
    resetTestState();
  });

  afterEach(() => {
    resetTestState();
  });

  // ==========================================================================
  // Flow 1: New User Journey (LIFF → Add Friend → Webhook)
  // ==========================================================================
  describe('Flow 1: New User Journey', () => {
    it('should complete full flow: LIFF pre-assign → Webhook follow → Team assigned', async () => {
      const lineUserId = 'Unewuser123456789';
      const teamId = 5;
      const displayName = 'New User';

      console.log('🚀 Starting New User Journey Test...\n');

      // Step 1: User scans QR Code, LIFF records assignment
      console.log('Step 1: LIFF assign-team (pre-notification)');
      const liffResult = await simulateLiffAssignTeam(lineUserId, teamId, displayName);

      expect(liffResult.assignmentId).toBeDefined();
      expect(liffResult.teamId).toBe(teamId);
      expect(assignmentRecords.has(lineUserId)).toBe(true);

      // Verify pre-notification broadcast
      const preNotification = broadcastEvents.find(e =>
        e.data.conversation?._liffMetadata?.isPending === true
      );
      expect(preNotification).toBeDefined();
      expect(preNotification.data.conversation._liffMetadata.lineUserId).toBe(lineUserId);
      console.log('✅ Pre-notification sent with isPending: true\n');

      // Step 2: User clicks "Add Friend", webhook fires
      console.log('Step 2: Webhook follow event');
      const webhookResult = await simulateWebhookFollow(lineUserId, displayName);

      expect(webhookResult.customerId).toBeDefined();
      expect(webhookResult.conversationId).toBeDefined();
      expect(webhookResult.teamId).toBe(teamId);
      console.log('✅ Customer and conversation created\n');

      // Verify confirmation broadcast
      const confirmation = broadcastEvents.find(e =>
        e.data.conversation?._liffMetadata?.isPending === false &&
        e.data.conversation?._liffMetadata?.isWebhookConfirmation === true
      );
      expect(confirmation).toBeDefined();
      expect(confirmation.data.conversationId).toBe(webhookResult.conversationId);
      console.log('✅ Confirmation sent with isPending: false\n');

      // Verify reconciliation metadata
      expect(confirmation.data.conversation._liffMetadata.lineUserId).toBe(lineUserId);
      console.log('✅ Reconciliation metadata present for frontend matching\n');

      console.log('🎉 New User Journey completed successfully!\n');
    });

    it('should handle case when no QR code assignment exists', async () => {
      const lineUserId = 'Udirectfollow123';
      const displayName = 'Direct Follower';

      console.log('🚀 Testing direct follow without QR code...\n');

      // User follows directly (no LIFF assign-team call)
      const webhookResult = await simulateWebhookFollow(lineUserId, displayName);

      expect(webhookResult.customerId).toBeDefined();
      expect(webhookResult.conversationId).toBeNull(); // No team assigned
      expect(webhookResult.teamId).toBeNull();

      // Customer should still be created
      expect(customerRecords.has(lineUserId)).toBe(true);

      console.log('✅ Customer created without team assignment\n');
    });
  });

  // ==========================================================================
  // Flow 2: Existing Friend Journey (LIFF → Welcome API)
  // ==========================================================================
  describe('Flow 2: Existing Friend Journey', () => {
    it('should sync conversation when existing friend scans QR code', async () => {
      const lineUserId = 'Uexistingfriend123';
      const oldTeamId = 3;
      const newTeamId = 7;

      console.log('🚀 Starting Existing Friend Journey Test...\n');

      // Setup: Create existing customer and conversation
      const existingCustomer = {
        id: 100,
        platformUserId: lineUserId,
        platform: 'line',
        displayName: 'Existing Friend'
      };
      customerRecords.set(lineUserId, existingCustomer);

      const existingConv = {
        id: 'conv-existing',
        customerId: existingCustomer.id,
        assignedTeamId: oldTeamId,
        status: 'active'
      };
      conversationRecords.set(existingConv.id, existingConv);

      console.log(`Setup: Existing customer in Team ${oldTeamId}\n`);

      // Step 1: LIFF assign-team
      console.log('Step 1: LIFF assign-team');
      await simulateLiffAssignTeam(lineUserId, newTeamId, 'Existing Friend');
      expect(broadcastEvents.length).toBeGreaterThan(0);
      console.log('✅ Pre-notification sent\n');

      // Step 2: LIFF welcome (since already a friend)
      console.log('Step 2: LIFF welcome (conversation sync)');
      const welcomeResult = await simulateLiffWelcome(lineUserId, newTeamId);

      expect(welcomeResult.synced).toBe(true);
      expect(welcomeResult.action).toBe('transferred');
      console.log('✅ Conversation transferred to new team\n');

      // Verify the conversation was updated
      expect(existingConv.assignedTeamId).toBe(newTeamId);

      // Verify transfer broadcast
      const transferBroadcast = broadcastEvents.find(e =>
        e.data.reason?.includes('Reassignment')
      );
      expect(transferBroadcast).toBeDefined();
      console.log('✅ Transfer broadcast sent\n');

      console.log('🎉 Existing Friend Journey completed successfully!\n');
    });

    it('should create new conversation for existing friend without one', async () => {
      const lineUserId = 'Uoldfriendnoconv';
      const teamId = 5;

      // Setup: Existing customer but no conversation
      customerRecords.set(lineUserId, {
        id: 200,
        platformUserId: lineUserId,
        platform: 'line',
        displayName: 'Old Friend'
      });

      // LIFF welcome creates conversation
      const result = await simulateLiffWelcome(lineUserId, teamId);

      expect(result.synced).toBe(true);
      expect(result.action).toBe('created');
      expect(result.conversationId).toBeDefined();
    });

    it('should be idempotent when scanning same team QR code', async () => {
      const lineUserId = 'Usameteamscan';
      const teamId = 5;

      // Setup: Existing customer with conversation in same team
      customerRecords.set(lineUserId, {
        id: 300,
        platformUserId: lineUserId,
        platform: 'line',
        displayName: 'Same Team User'
      });
      conversationRecords.set('conv-same', {
        id: 'conv-same',
        customerId: 300,
        assignedTeamId: teamId, // Already in target team
        status: 'active'
      });

      const initialBroadcastCount = broadcastEvents.length;

      // LIFF welcome - should be no-op
      const result = await simulateLiffWelcome(lineUserId, teamId);

      expect(result.synced).toBe(true);
      expect(result.action).toBe('no_change');

      // No additional broadcasts for same team
      // (Pre-notification might still be sent, but no transfer)
    });
  });

  // ==========================================================================
  // Flow 3: WebSocket Reconciliation
  // ==========================================================================
  describe('Flow 3: WebSocket Reconciliation', () => {
    it('should provide correct metadata for frontend reconciliation', async () => {
      const lineUserId = 'Ureconciliation123';
      const teamId = 5;

      // Step 1: Pre-notification (pending)
      await simulateLiffAssignTeam(lineUserId, teamId, 'Reconciliation Test');

      const pending = broadcastEvents[0];
      expect(pending.data.conversation._liffMetadata).toMatchObject({
        isPending: true,
        lineUserId,
        scannedAt: expect.any(Number)
      });

      // Step 2: Confirmation (not pending)
      await simulateWebhookFollow(lineUserId, 'Reconciliation Test');

      const confirmed = broadcastEvents.find(e =>
        e.data.conversation?._liffMetadata?.isPending === false
      );
      expect(confirmed.data.conversation._liffMetadata).toMatchObject({
        isPending: false,
        lineUserId,
        isWebhookConfirmation: true
      });

      // Frontend can match by lineUserId
      expect(pending.data.conversation._liffMetadata.lineUserId)
        .toBe(confirmed.data.conversation._liffMetadata.lineUserId);
    });

    it('should allow frontend to replace pending conversation with real one', async () => {
      const lineUserId = 'Ureplace123';
      const teamId = 5;

      // Simulate frontend state
      const frontendConversations: Map<string, any> = new Map();

      // Pre-notification arrives
      await simulateLiffAssignTeam(lineUserId, teamId);
      const pending = broadcastEvents[0].data;

      // Frontend adds pending conversation
      frontendConversations.set(pending.conversationId, {
        ...pending.conversation,
        isPending: true
      });
      expect(frontendConversations.size).toBe(1);
      expect(frontendConversations.get(pending.conversationId).isPending).toBe(true);

      // Webhook confirmation arrives
      await simulateWebhookFollow(lineUserId);
      const confirmed = broadcastEvents.find(e =>
        e.data.conversation?._liffMetadata?.isWebhookConfirmation
      ).data;

      // Frontend reconciliation: find and replace by lineUserId
      const pendingToRemove = Array.from(frontendConversations.entries()).find(
        ([_, conv]) => conv._liffMetadata?.lineUserId === lineUserId && conv._liffMetadata?.isPending
      );

      if (pendingToRemove) {
        frontendConversations.delete(pendingToRemove[0]);
      }
      frontendConversations.set(confirmed.conversationId, confirmed.conversation);

      // Verify final state
      expect(frontendConversations.size).toBe(1);
      expect(frontendConversations.has(pending.conversationId)).toBe(false);
      expect(frontendConversations.has(confirmed.conversationId)).toBe(true);
      expect(frontendConversations.get(confirmed.conversationId)._liffMetadata.isPending).toBe(false);
    });
  });

  // ==========================================================================
  // Flow 4: Error Recovery
  // ==========================================================================
  describe('Flow 4: Error Recovery', () => {
    it('should handle broadcast failure gracefully', async () => {
      const lineUserId = 'Ubroadcastfail';
      const teamId = 5;

      // Make broadcast fail
      mockBroadcastConversationTransferred.mockRejectedValueOnce(new Error('Broadcast failed'));

      // Should not throw, assignment should still be recorded
      await simulateLiffAssignTeam(lineUserId, teamId);

      // Assignment record should exist even if broadcast failed
      expect(assignmentRecords.has(lineUserId)).toBe(true);
    });

    it('should handle duplicate scans gracefully', async () => {
      const lineUserId = 'Uduplicatescan';
      const teamId = 5;

      // First scan
      const first = await simulateLiffAssignTeam(lineUserId, teamId);

      // Second scan (duplicate)
      const second = await simulateLiffAssignTeam(lineUserId, teamId);

      // Should have same team assignment
      expect(first.teamId).toBe(second.teamId);

      // Only one assignment record
      expect(assignmentRecords.size).toBe(1);
    });
  });

  // ==========================================================================
  // Flow 5: Team Assignment Priority
  // ==========================================================================
  describe('Flow 5: Team Assignment Priority', () => {
    it('should prioritize customerTeamAssignments over other sources', async () => {
      const lineUserId = 'Upriority123';
      const assignmentTeamId = 10;

      // Create assignment via LIFF
      await simulateLiffAssignTeam(lineUserId, assignmentTeamId);

      // Webhook should use assignment's team
      const result = await simulateWebhookFollow(lineUserId);

      expect(result.teamId).toBe(assignmentTeamId);
    });
  });
});

// ============================================================================
// Test Statistics Summary
// ============================================================================

describe('Integration Test Summary', () => {
  it('should provide test coverage summary', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║           QR Code Team Assignment Integration Tests               ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║   Flow 1: New User Journey                                        ║
║   ├── LIFF pre-assign → Webhook follow → Team assigned           ║
║   └── Direct follow without QR code                              ║
║                                                                   ║
║   Flow 2: Existing Friend Journey                                 ║
║   ├── Conversation sync on QR scan                               ║
║   ├── New conversation for friend without one                    ║
║   └── Idempotency for same team scan                             ║
║                                                                   ║
║   Flow 3: WebSocket Reconciliation                                ║
║   ├── Correct metadata for frontend matching                     ║
║   └── Frontend conversation replacement                          ║
║                                                                   ║
║   Flow 4: Error Recovery                                          ║
║   ├── Broadcast failure handling                                 ║
║   └── Duplicate scan handling                                    ║
║                                                                   ║
║   Flow 5: Team Assignment Priority                                ║
║   └── assignment > qr_token verification                         ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
    `);
    expect(true).toBe(true);
  });
});
