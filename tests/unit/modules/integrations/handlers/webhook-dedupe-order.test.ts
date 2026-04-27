/**
 * Webhook Dedupe Order Tests
 *
 * Asserts the contract introduced by fix B (2026-04-27):
 *   isDuplicateMessage MUST be called BEFORE findOrCreateConversation,
 *   so that LINE/Facebook redeliveries do NOT bump conversations.last_message_at
 *   without storing a corresponding message row.
 *
 * Incident this prevents:
 *   On 2026-04-24 a LINE redelivery for the 元隆企業社 conversation updated
 *   conversations.last_message_at to 08:18:44Z while isDuplicateMessage caused
 *   the handler to silently return — no message row was inserted, but the
 *   conversation list re-sorted as if a new message had arrived. Operators
 *   could not find the "new" message in the chat detail view.
 *
 * Contract verified here:
 *   1. Duplicate inbound message → findOrCreateConversation NOT called,
 *      saveMessage NOT called.
 *   2. Non-duplicate inbound message → findOrCreateConversation called,
 *      saveMessage called, in that order.
 *
 * @see src/modules/integrations/handlers/line-message-handler.ts (EARLY DEDUPE)
 * @see src/modules/integrations/handlers/facebook-event-processor.ts (EARLY DEDUPE)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (mirror webhook-async-optimization.test.ts setup; trimmed to essentials)
// ---------------------------------------------------------------------------

const mockBroadcastNewMessage = vi.fn().mockResolvedValue({
  conversationBroadcast: true,
  globalBroadcast: true,
});
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastNewMessage: mockBroadcastNewMessage,
    broadcastMessageEvent: vi.fn().mockResolvedValue(undefined),
    broadcastConversationEvent: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@modules/activities', () => ({
  ActivityService: vi.fn().mockImplementation(() => ({
    logActivity: vi.fn().mockResolvedValue({ id: 'activity-1' }),
  })),
}));

vi.mock('@/services/user-sync', () => ({
  createUserSyncService: vi.fn().mockImplementation(() => ({
    syncLineUser: vi.fn().mockResolvedValue({ displayName: 'LINE User', pictureUrl: null }),
    syncFacebookUser: vi.fn().mockResolvedValue({ displayName: 'FB User', pictureUrl: null }),
    needsUpdate: vi.fn().mockResolvedValue(false),
  })),
}));

vi.mock('@/utils/notification-trigger', () => ({
  triggerNewConversationNotification: vi.fn().mockResolvedValue(undefined),
  triggerCustomerFollowedNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@modules/auto-reply/services/auto-reply-engine', () => ({
  evaluate: vi.fn().mockResolvedValue({ matched: false }),
  evaluateWelcome: vi.fn().mockResolvedValue({ matched: false }),
  invalidateRulesCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('uuid', () => ({ v4: vi.fn().mockReturnValue('mock-uuid-dedupe') }));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn().mockReturnValue('2026-04-27T03:30:00.000Z'),
  nowMs: vi.fn().mockReturnValue(1777267800000),
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: vi.fn().mockReturnValue({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

const mockFindOrCreateConversation = vi.fn();
const mockIsDuplicateMessage = vi.fn();
const mockSaveMessage = vi.fn();
vi.mock('@modules/integrations/services/webhook-conversation-service', () => ({
  findOrCreateConversation: (...args: unknown[]) => mockFindOrCreateConversation(...args),
  isDuplicateMessage: (...args: unknown[]) => mockIsDuplicateMessage(...args),
  saveMessage: (...args: unknown[]) => mockSaveMessage(...args),
}));

vi.mock('@modules/integrations/services/webhook-media-service', () => ({
  processLineMedia: vi.fn().mockResolvedValue([]),
  processFacebookMedia: vi.fn().mockResolvedValue([]),
}));

const mockFindOrCreateCustomer = vi.fn();
vi.mock('@modules/integrations/services/webhook-customer-service', () => ({
  findOrCreateCustomer: (...args: unknown[]) => mockFindOrCreateCustomer(...args),
  triggerBackgroundSyncIfNeeded: vi.fn().mockResolvedValue(undefined),
  updateCustomerProfile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/distributed-lock-service', () => ({
  DistributedLockService: vi.fn().mockImplementation(() => ({
    withLock: vi.fn().mockImplementation(async (_r: string, fn: () => Promise<unknown>) => fn()),
  })),
}));

const baseChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: vi.fn().mockResolvedValue(null),
};
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn().mockImplementation(() => ({
    select: vi.fn().mockReturnValue(baseChain),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({ success: true }) }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({ success: true }) }),
    }),
  })),
}));

vi.mock('drizzle-orm', () => ({
  eq: (...a: unknown[]) => ({ type: 'eq', a }),
  and: (...a: unknown[]) => ({ type: 'and', a }),
  ne: (...a: unknown[]) => ({ type: 'ne', a }),
  desc: (...a: unknown[]) => ({ type: 'desc', a }),
  isNull: (col: unknown) => ({ type: 'isNull', col }),
}));

vi.mock('@/db/schema', () => ({
  customers: { name: 'customers', platformUserId: {}, platform: {}, id: {} },
  conversations: { name: 'conversations', customerId: {}, status: {}, assignedTeamId: {}, id: {} },
  teams: { id: {}, name: {} },
  customerTeamAssignments: { name: 'customerTeamAssignments', platformUserId: {}, assignedAt: {}, teamId: {}, displayName: {} },
  messages: { name: 'messages', platformMessageId: {} },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { processLineMessage } from '@modules/integrations/handlers/line-message-handler';
import { processFacebookMessage } from '@modules/integrations/handlers/facebook-event-processor';

const mockCustomer = {
  id: 1, platform: 'line', platformUserId: 'U_test', displayName: 'Test User',
  avatarUrl: null, metadata: null,
  createdAt: '2026-04-27T00:00:00.000Z', updatedAt: '2026-04-27T00:00:00.000Z',
};

function createEnv() {
  return {
    DB: {},
    LINE_CHANNEL_ACCESS_TOKEN: 'tok',
    LINE_CHANNEL_SECRET: 'sec',
    SESSIONS: { get: vi.fn().mockResolvedValue(null), put: vi.fn().mockResolvedValue(undefined) },
    LINE_MESSAGE_QUEUE: { send: vi.fn().mockResolvedValue(undefined) },
  } as never;
}

function lineTextEvent(messageId = 'line-msg-id') {
  return {
    type: 'message',
    timestamp: Date.now(),
    source: { type: 'user', userId: 'U_test' },
    replyToken: 'r',
    message: { id: messageId, type: 'text', text: 'hi' },
  } as never;
}

function fbTextMessaging(mid = 'fb-mid-1') {
  return {
    sender: { id: 'fb-user-1' },
    recipient: { id: 'page-1' },
    timestamp: Date.now(),
    message: { mid, text: 'hi from fb' },
  } as never;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('webhook handlers — dedupe runs BEFORE conversation timestamp update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindOrCreateCustomer.mockImplementation(
      async (_env: unknown, _id: unknown, platform: unknown) =>
        ({ ...mockCustomer, platform: platform as string })
    );
    mockFindOrCreateConversation.mockResolvedValue({
      id: 'conv-test', customerId: 1, assignedTeamId: null, status: 'active',
    });
    mockSaveMessage.mockResolvedValue('msg-test');
  });

  describe('LINE processLineMessage', () => {
    it('duplicate message: skips findOrCreateConversation AND saveMessage', async () => {
      mockIsDuplicateMessage.mockResolvedValue(true);

      await processLineMessage(createEnv(), lineTextEvent('dup-id'));

      expect(mockIsDuplicateMessage).toHaveBeenCalledWith(expect.anything(), 'dup-id', 'line');
      expect(mockFindOrCreateConversation).not.toHaveBeenCalled();
      expect(mockSaveMessage).not.toHaveBeenCalled();
    });

    it('non-duplicate message: calls dedupe BEFORE conversation update, then saves', async () => {
      mockIsDuplicateMessage.mockResolvedValue(false);

      await processLineMessage(createEnv(), lineTextEvent('new-id'));

      expect(mockIsDuplicateMessage).toHaveBeenCalledTimes(1);
      expect(mockFindOrCreateConversation).toHaveBeenCalledTimes(1);
      expect(mockSaveMessage).toHaveBeenCalledTimes(1);

      // Order assertion: dedupe must complete BEFORE conversation upsert.
      const dedupeOrder = mockIsDuplicateMessage.mock.invocationCallOrder[0];
      const convOrder = mockFindOrCreateConversation.mock.invocationCallOrder[0];
      const saveOrder = mockSaveMessage.mock.invocationCallOrder[0];
      expect(dedupeOrder).toBeLessThan(convOrder);
      expect(convOrder).toBeLessThan(saveOrder);
    });
  });

  describe('Facebook processFacebookMessage', () => {
    it('duplicate message: skips findOrCreateConversation AND saveMessage', async () => {
      mockIsDuplicateMessage.mockResolvedValue(true);

      await processFacebookMessage(createEnv(), fbTextMessaging('dup-mid'));

      expect(mockIsDuplicateMessage).toHaveBeenCalledWith(expect.anything(), 'dup-mid', 'facebook');
      expect(mockFindOrCreateConversation).not.toHaveBeenCalled();
      expect(mockSaveMessage).not.toHaveBeenCalled();
    });

    it('non-duplicate message: calls dedupe BEFORE conversation update, then saves', async () => {
      mockIsDuplicateMessage.mockResolvedValue(false);

      await processFacebookMessage(createEnv(), fbTextMessaging('new-mid'));

      expect(mockIsDuplicateMessage).toHaveBeenCalledTimes(1);
      expect(mockFindOrCreateConversation).toHaveBeenCalledTimes(1);
      expect(mockSaveMessage).toHaveBeenCalledTimes(1);

      const dedupeOrder = mockIsDuplicateMessage.mock.invocationCallOrder[0];
      const convOrder = mockFindOrCreateConversation.mock.invocationCallOrder[0];
      const saveOrder = mockSaveMessage.mock.invocationCallOrder[0];
      expect(dedupeOrder).toBeLessThan(convOrder);
      expect(convOrder).toBeLessThan(saveOrder);
    });
  });
});
