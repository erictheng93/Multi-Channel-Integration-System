import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono, type Context, type Next } from 'hono';
import type { Bindings } from '@/types';

type ExistingMessage = {
  id: string;
  senderType: string;
  agentSenderId: string;
  isRecalled: boolean;
  recallDeadline: string | null;
  isSent: boolean;
  deliveryStatus: string | null;
  metadata: string | null;
};

const handlerMocks = vi.hoisted(() => ({
  selectGet: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  cancelBufferedDelivery: vi.fn(),
  recallMessage: vi.fn(),
  broadcastMessageEvent: vi.fn(),
  logActivity: vi.fn(),
  fetch: vi.fn(),
}));

function makeSelectChain() {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    get: handlerMocks.selectGet,
  };
  return chain;
}

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: Context, next: Next) => {
    c.set('jwtPayload', {
      userId: 'agent-1',
      username: 'agent',
      role: 'agent',
      primaryTeamId: 1,
    });
    return next();
  }),
}));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => makeSelectChain()),
    update: vi.fn(() => ({
      set: handlerMocks.updateSet,
    })),
  })),
}));

vi.mock('@/modules/conversations/services/buffered-send-scheduler', () => ({
  scheduleBufferedDelivery: vi.fn(),
  downgradeBufferedMessage: vi.fn(),
  cancelBufferedDelivery: handlerMocks.cancelBufferedDelivery,
}));

vi.mock('@modules/messaging/services/message-recall-service', () => ({
  MessageRecallService: vi.fn(function () {
    return {
      recallMessage: handlerMocks.recallMessage,
    };
  }),
}));

vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn(function () {
    return {
      broadcastMessageEvent: handlerMocks.broadcastMessageEvent,
    };
  }),
}));

vi.mock('@modules/activities', () => ({
  ActivityService: vi.fn(function () {
    return {
      logActivity: handlerMocks.logActivity,
    };
  }),
  ACTIVITY_ACTIONS: {
    MESSAGE_RECALL: 'message_recall',
  },
  RESOURCE_TYPES: {
    MESSAGE: 'message',
  },
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-01-15T12:00:00Z'),
  nowMs: vi.fn(() => 1768483200000),
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('@/core/error-handler', () => ({
  globalErrorHandler: {
    handleError: vi.fn((c: Context, error: unknown) => c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500)),
  },
}));

vi.mock('@/services/permission-service', () => ({
  PermissionService: {
    checkPermission: vi.fn(async () => true),
    getVisibleConversations: vi.fn(async () => ['conv-1']),
  },
}));

vi.mock('@modules/conversations/services/message-service', () => ({
  MessageRequestService: {
    validateAndParse: vi.fn(),
  },
  MessageService: vi.fn(),
}));

import conversationMessagesHandler from '@/modules/conversations/handlers/conversation-messages';

function makeEnv(): Bindings {
  return {
    DB: {},
    CACHE: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
  } as unknown as Bindings;
}

function makeApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/conversations', conversationMessagesHandler);
  return app;
}

function makeExisting(overrides: Partial<ExistingMessage> = {}): ExistingMessage {
  return {
    id: 'msg-1',
    senderType: 'agent',
    agentSenderId: 'agent-1',
    isRecalled: false,
    recallDeadline: '2027-01-15T12:01:00Z',
    isSent: false,
    deliveryStatus: 'buffered',
    metadata: JSON.stringify({ platform: 'line' }),
    ...overrides,
  };
}

async function recall(overrides: Partial<ExistingMessage> = {}) {
  handlerMocks.selectGet.mockResolvedValueOnce(makeExisting(overrides));
  return makeApp().request(
    '/api/conversations/conv-1/messages/msg-1',
    { method: 'DELETE' },
    makeEnv()
  );
}

describe('conversation message recall handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlerMocks.updateSet.mockReturnValue({ where: handlerMocks.updateWhere });
    handlerMocks.updateWhere.mockResolvedValue(undefined);
    handlerMocks.cancelBufferedDelivery.mockResolvedValue(true);
    handlerMocks.recallMessage.mockResolvedValue({
      success: true,
      messageId: 'msg-1',
      recalledAt: '2026-01-15T12:00:00Z',
      canRecall: true,
    });
    handlerMocks.broadcastMessageEvent.mockResolvedValue(undefined);
    handlerMocks.logActivity.mockResolvedValue(undefined);
    handlerMocks.fetch.mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = handlerMocks.fetch;
  });

  it('recalls a buffered message after the scheduler cancel succeeds', async () => {
    const response = await recall();

    expect(response.status).toBe(200);
    expect(handlerMocks.cancelBufferedDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ DB: expect.anything() }),
      { messageId: 'msg-1', conversationId: 'conv-1' }
    );
    expect(handlerMocks.recallMessage).toHaveBeenCalledWith(
      'msg-1',
      'agent-1',
      undefined,
      { deadlineAlreadyEnforced: true }
    );
    expect(handlerMocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      isRecalled: true,
      content: '[This message has been recalled]',
    }));
    expect(handlerMocks.fetch).not.toHaveBeenCalled();
  });

  it('rejects a buffered recall when scheduler cancel says the deadline passed', async () => {
    handlerMocks.cancelBufferedDelivery.mockResolvedValueOnce(false);

    const response = await recall();
    const body = await response.json() as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Message recall deadline has passed');
    expect(handlerMocks.recallMessage).not.toHaveBeenCalled();
    expect(handlerMocks.updateSet).not.toHaveBeenCalled();
  });

  it('rejects an already-delivered LINE message before recall service work', async () => {
    const response = await recall({
      isSent: true,
      deliveryStatus: 'sent',
      metadata: JSON.stringify({ platform: 'line' }),
    });
    const body = await response.json() as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain('LINE');
    expect(handlerMocks.cancelBufferedDelivery).not.toHaveBeenCalled();
    expect(handlerMocks.recallMessage).not.toHaveBeenCalled();
  });

  it('allows an already-delivered Facebook message to enter the platform delete branch', async () => {
    const response = await recall({
      isSent: true,
      deliveryStatus: 'sent',
      metadata: JSON.stringify({ platform: 'facebook' }),
    });

    expect(response.status).toBe(200);
    expect(handlerMocks.cancelBufferedDelivery).not.toHaveBeenCalled();
    expect(handlerMocks.recallMessage).toHaveBeenCalledWith(
      'msg-1',
      'agent-1',
      undefined,
      { deadlineAlreadyEnforced: false }
    );
  });

  it('rejects already-recalled messages without mutating the row', async () => {
    const response = await recall({ isRecalled: true });
    const body = await response.json() as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Message has already been recalled');
    expect(handlerMocks.cancelBufferedDelivery).not.toHaveBeenCalled();
    expect(handlerMocks.recallMessage).not.toHaveBeenCalled();
    expect(handlerMocks.updateSet).not.toHaveBeenCalled();
  });
});
