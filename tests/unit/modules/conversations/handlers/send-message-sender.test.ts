import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono, type Context, type Next } from 'hono';
import type { Bindings } from '@/types';

// POST /api/conversations/:id/messages must send as the authenticated agent, never as the
// senderId the client put in the body (which also scopes which uploads get attached).

const mocks = vi.hoisted(() => ({
  validateAndParse: vi.fn(),
  createPendingMessage: vi.fn(),
}));

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: Context, next: Next) => {
    c.set('user', { id: 7, username: 'agent7', displayName: 'Agent 7', role: 'agent' });
    return next();
  }),
}));

vi.mock('@/services/permission-service', () => ({
  PermissionService: { checkPermission: vi.fn(async () => true) },
}));

vi.mock('@/services/recall-window-config', () => ({
  getRecallWindowSeconds: vi.fn(async () => 0),
}));

vi.mock('@modules/conversations/services/message-service', () => ({
  MessageRequestService: { validateAndParse: mocks.validateAndParse },
  MessageService: vi.fn(function () {
    return { createPendingMessage: mocks.createPendingMessage };
  }),
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

vi.mock('@/core/error-handler', () => ({
  globalErrorHandler: {
    handleError: vi.fn((c: Context) => c.json({ success: false }, 500)),
  },
}));

import conversationMessagesHandler from '@/modules/conversations/handlers/conversation-messages';

describe('POST /api/conversations/:id/messages sender identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Stop right after createPendingMessage: the handler throws on a missing messageId.
    mocks.createPendingMessage.mockResolvedValue({ messageId: null, message: null });
  });

  it('replaces a forged body senderId with the authenticated agent id', async () => {
    mocks.validateAndParse.mockResolvedValue({
      conversationId: 'conv-1',
      content: 'hi',
      senderId: 'agent-99',
      messageType: 'text',
      metadata: {},
      attachmentIds: ['att-of-agent-99'],
    });

    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/api/conversations', conversationMessagesHandler);
    await app.request('/api/conversations/conv-1/messages', { method: 'POST' }, {} as Bindings);

    expect(mocks.createPendingMessage).toHaveBeenCalledTimes(1);
    expect(mocks.createPendingMessage.mock.calls[0][0]).toMatchObject({
      senderId: '7',
      attachmentIds: ['att-of-agent-99'],
    });
  });
});
