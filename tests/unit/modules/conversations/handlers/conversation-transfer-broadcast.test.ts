import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono, type Context, type Next } from 'hono';
import type { Bindings } from '@/types';

const mocks = vi.hoisted(() => ({
  selectLimit: vi.fn(),
  selectGet: vi.fn(),
  broadcastTransferred: vi.fn(),
}));

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: Context, next: Next) => {
    c.set('user', { id: 1, displayName: 'Admin', role: 'admin', allowedTeamIds: [] });
    return next();
  }),
}));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => {
    const chain = {
      from: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: mocks.selectLimit,
      get: mocks.selectGet,
    };
    return { select: vi.fn(() => chain) };
  }),
}));

vi.mock('@modules/activities', () => ({
  ActivityCapture: class {
    buildReversibleLog = vi.fn(() => ({}));
  },
  ACTIVITY_ACTIONS: { CONVERSATION_TRANSFER: 'conversation.transfer' },
  RESOURCE_TYPES: { CONVERSATION: 'conversation' },
}));

vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: class {
    broadcastConversationTransferred = mocks.broadcastTransferred;
  },
}));

vi.mock('@/core/error-handler', () => ({
  globalErrorHandler: {
    handleError: vi.fn((c: Context, error: unknown) =>
      c.json({ error: error instanceof Error ? error.message : String(error) }, 500)),
  },
}));

import conversationAssignmentHandler from '@/modules/conversations/handlers/conversation-assignment';

function transfer() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/conversations', conversationAssignmentHandler);
  const env = {
    DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({ id: 'conv-1', assigned_team_id: 1, status: 'assigned', updated_at: 'x' })),
        })),
      })),
      batch: vi.fn(async () => []),
    },
  } as unknown as Bindings;
  return app.request('/api/conversations/conv-1/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromTeamId: 1, toTeamId: 2 }),
  }, env);
}

describe('POST /:id/transfer broadcast payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectLimit.mockResolvedValue([{ name: 'Team' }]);
    mocks.broadcastTransferred.mockResolvedValue({});
  });

  it('carries customName and platformName so the receiver keeps the nickname', async () => {
    mocks.selectGet.mockResolvedValue({
      id: 'conv-1', customerId: 9, customerName: 'Boss', customName: 'Boss',
      platformName: 'LINE Name', platformUserId: 'U1', avatarUrl: null,
      platform: 'line', status: 'active', lastMessageAt: null,
    });

    expect((await transfer()).status).toBe(200);
    expect(mocks.broadcastTransferred).toHaveBeenCalledWith(expect.objectContaining({
      conversation: expect.objectContaining({
        customerName: 'Boss', customName: 'Boss', platformName: 'LINE Name',
      }),
    }));
  });

  it('sends null customName when the customer has no nickname', async () => {
    mocks.selectGet.mockResolvedValue({
      id: 'conv-1', customerId: 9, customerName: 'LINE Name', customName: null,
      platformName: 'LINE Name', platformUserId: 'U1', avatarUrl: null,
      platform: 'line', status: 'active', lastMessageAt: null,
    });

    await transfer();
    expect(mocks.broadcastTransferred.mock.calls[0]?.[0].conversation).toMatchObject({
      customName: null, platformName: 'LINE Name',
    });
  });
});
