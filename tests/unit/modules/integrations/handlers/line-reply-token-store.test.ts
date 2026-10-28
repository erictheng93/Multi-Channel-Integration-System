/**
 * LINE replyToken storage: an unused replyToken is kept on the conversation so a later
 * agent reply can use the free Reply API. Auto-reply that ran (or may have run) spends it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const NOW = vi.hoisted(() => 1777267800000);

const mockSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastNewMessage: vi.fn().mockResolvedValue(undefined),
    broadcastMessageEvent: vi.fn().mockResolvedValue(undefined),
    broadcastConversationEvent: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@modules/activities', () => ({
  ActivityService: vi.fn().mockImplementation(() => ({
    logActivity: vi.fn().mockResolvedValue({ id: 'activity-1' }),
  })),
}));

const mockEvaluateAutoReply = vi.fn();
vi.mock('@modules/auto-reply/services/auto-reply-engine', () => ({
  evaluate: (...args: unknown[]) => mockEvaluateAutoReply(...args),
  evaluateWelcome: vi.fn().mockResolvedValue({ matched: false }),
  retryAutoReplyForPlatformMessage: vi.fn().mockResolvedValue({ matched: false }),
  invalidateRulesCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn().mockReturnValue('2026-04-27T03:30:00.000Z'),
  nowMs: vi.fn().mockReturnValue(NOW),
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: vi.fn().mockReturnValue({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

vi.mock('@modules/integrations/services/webhook-conversation-service', () => ({
  findOrCreateConversation: vi.fn().mockResolvedValue({
    id: 'conv-test', customerId: 1, assignedTeamId: null, status: 'active',
  }),
  isDuplicateMessage: vi.fn().mockResolvedValue(false),
  notifyNewConversation: vi.fn().mockResolvedValue(undefined),
  saveMessage: vi.fn().mockResolvedValue('msg-test'),
}));

vi.mock('@modules/integrations/services/webhook-media-service', () => ({
  processLineMedia: vi.fn().mockResolvedValue([]),
}));

vi.mock('@modules/integrations/services/webhook-customer-service', () => ({
  findOrCreateCustomer: vi.fn().mockResolvedValue({
    id: 1, platform: 'line', platformUserId: 'U_test', displayName: 'Test User',
  }),
  triggerBackgroundSyncIfNeeded: vi.fn().mockResolvedValue(undefined),
  updateCustomerProfile: vi.fn().mockResolvedValue(undefined),
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
    update: vi.fn().mockReturnValue({ set: mockSet }),
  })),
}));

vi.mock('drizzle-orm', () => ({
  eq: (...a: unknown[]) => ({ type: 'eq', a }),
  and: (...a: unknown[]) => ({ type: 'and', a }),
  desc: (...a: unknown[]) => ({ type: 'desc', a }),
}));

vi.mock('@/db/schema', () => ({
  customers: { id: {} },
  conversations: { id: {}, lineReplyToken: {}, lineReplyTokenReceivedAt: {} },
  customerTeamAssignments: { platformUserId: {}, assignedAt: {}, teamId: {}, displayName: {} },
  messages: { platformMessageId: {} },
}));

import { processLineMessage } from '@modules/integrations/handlers/line-message-handler';

function createEnv() {
  return {
    DB: {},
    LINE_CHANNEL_ACCESS_TOKEN: 'tok',
    LINE_MESSAGE_QUEUE: { send: vi.fn().mockResolvedValue(undefined) },
  } as never;
}

function lineTextEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'message',
    timestamp: NOW - 2000,
    source: { type: 'user', userId: 'U_test' },
    replyToken: 'reply-token-1',
    message: { id: 'line-msg-id', type: 'text', text: 'hi' },
    ...overrides,
  } as never;
}

describe('LINE replyToken storage on inbound message', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue(undefined);
    mockEvaluateAutoReply.mockResolvedValue({ matched: false });
  });

  it('stores the token with the webhook event time when auto-reply did not match', async () => {
    await processLineMessage(createEnv(), lineTextEvent());

    expect(mockSet).toHaveBeenCalledWith({ lineReplyToken: 'reply-token-1', lineReplyTokenReceivedAt: NOW - 2000 });
  });

  it('caps a future event timestamp at now (conservative)', async () => {
    await processLineMessage(createEnv(), lineTextEvent({ timestamp: NOW + 60000 }));

    expect(mockSet).toHaveBeenCalledWith({ lineReplyToken: 'reply-token-1', lineReplyTokenReceivedAt: NOW });
  });

  it('does not store the token when auto-reply matched (Reply API was used)', async () => {
    mockEvaluateAutoReply.mockResolvedValue({ matched: true, ruleId: 1, replyMethod: 'reply_api' });

    await processLineMessage(createEnv(), lineTextEvent());

    expect(mockSet).not.toHaveBeenCalled();
  });

  it('does not store the token when auto-reply evaluation errored (outcome unknown)', async () => {
    mockEvaluateAutoReply.mockResolvedValue({ matched: false, error: 'boom' });

    await processLineMessage(createEnv(), lineTextEvent());

    expect(mockSet).not.toHaveBeenCalled();
  });

  it('does not store anything when the event has no replyToken', async () => {
    await processLineMessage(createEnv(), lineTextEvent({ replyToken: undefined }));

    expect(mockSet).not.toHaveBeenCalled();
  });

  it('never fails the webhook when the token write throws', async () => {
    mockUpdateWhere.mockRejectedValue(new Error('d1 down'));

    await expect(processLineMessage(createEnv(), lineTextEvent())).resolves.toBeUndefined();
  });
});
