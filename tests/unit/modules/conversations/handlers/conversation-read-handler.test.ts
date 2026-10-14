import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono, type Context, type Next } from 'hono';
import type { Bindings } from '@/types';

const handlerMocks = vi.hoisted(() => ({
  selectGet: vi.fn(),
  insertValues: vi.fn(),
  insertOnConflict: vi.fn(),
  checkPermission: vi.fn(),
  prepareBind: vi.fn(),
  prepareFirst: vi.fn(),
  prepareRun: vi.fn(),
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
    c.set('user', {
      id: 'agent-1',
      username: 'agent',
      role: 'agent',
    });
    return next();
  }),
}));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn(() => ({
      values: handlerMocks.insertValues,
    })),
  })),
}));

vi.mock('@/services/permission-service', () => ({
  PermissionService: {
    checkPermission: handlerMocks.checkPermission,
  },
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-07-19T12:00:00Z'),
}));

vi.mock('@/core/error-handler', () => ({
  globalErrorHandler: {
    handleError: vi.fn((c: Context, error: unknown) => c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500)),
  },
}));

import conversationReadHandler from '@/modules/conversations/handlers/conversation-read';

function makeEnv(): Bindings {
  return {
    DB: {
      prepare: vi.fn(() => ({
        bind: handlerMocks.prepareBind,
      })),
    },
  } as unknown as Bindings;
}

function makeApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/conversations', conversationReadHandler);
  return app;
}

async function markUnread() {
  return makeApp().request(
    '/api/conversations/conv-1/unread',
    { method: 'PUT' },
    makeEnv()
  );
}

async function markRead() {
  return makeApp().request(
    '/api/conversations/conv-1/read',
    { method: 'PUT' },
    makeEnv()
  );
}

describe('conversation unread handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlerMocks.checkPermission.mockResolvedValue(true);
    handlerMocks.selectGet.mockResolvedValue({ id: 'conv-1' });
    handlerMocks.insertValues.mockReturnValue({ onConflictDoUpdate: handlerMocks.insertOnConflict });
    handlerMocks.insertOnConflict.mockResolvedValue(undefined);
    handlerMocks.prepareBind.mockReturnValue({ first: handlerMocks.prepareFirst, run: handlerMocks.prepareRun });
    handlerMocks.prepareRun.mockResolvedValue({ meta: { changes: 1 } });
    handlerMocks.prepareFirst.mockResolvedValue({ unreadCount: 3 });
  });

  it('clears lastReadAt, sets the manual unread override and returns the recomputed unread count', async () => {
    const response = await markUnread();
    const body = await response.json() as {
      success: boolean;
      data: { unreadCount: number };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.unreadCount).toBe(3);
    expect(handlerMocks.prepareBind).toHaveBeenCalledWith('agent-1', 'conv-1', '2026-07-19T12:00:00Z', '2026-07-19T12:00:00Z', 'conv-1');
  });

  // Read state is per-agent (Migration 0060): the write must be scoped to the
  // acting agent and is one status-conditional upsert, so closing by another
  // agent cannot interleave between the check and the write.
  it('writes one status-conditional upsert scoped to the acting agent', async () => {
    await markUnread();

    expect(handlerMocks.prepareRun).toHaveBeenCalledTimes(1);
    expect(handlerMocks.prepareBind.mock.calls[0]?.[0]).toBe('agent-1');
    expect(handlerMocks.insertValues).not.toHaveBeenCalled();
  });

  // The threshold is MAX(last_agent_reply, last_read_at) and mark-unread just
  // cleared this agent's last_read_at, so the recount only needs the
  // conversation id twice. A third bound id would mean the query is still
  // reading the retired global conversations.last_read_at column.
  it('recounts against the global last agent reply only', async () => {
    await markUnread();

    expect(handlerMocks.prepareBind).toHaveBeenCalledWith('conv-1', 'conv-1');
  });

  it('returns 403 without mutating when permission is denied', async () => {
    handlerMocks.checkPermission.mockResolvedValueOnce(false);

    const response = await markUnread();

    expect(response.status).toBe(403);
    expect(handlerMocks.insertValues).not.toHaveBeenCalled();
  });

  it('returns 404 without mutating when the conversation does not exist', async () => {
    handlerMocks.selectGet.mockResolvedValueOnce(undefined);

    const response = await markUnread();

    expect(response.status).toBe(404);
    expect(handlerMocks.insertValues).not.toHaveBeenCalled();
  });

  it('returns 409 without mutating when the conversation is closed', async () => {
    handlerMocks.prepareRun.mockResolvedValueOnce({ meta: { changes: 0 } });

    const response = await markUnread();

    expect(response.status).toBe(409);
    expect(handlerMocks.prepareFirst).not.toHaveBeenCalled();
  });

  it('floors unreadCount at 1 when the derived count is 0 (agent sent the last message)', async () => {
    handlerMocks.prepareFirst.mockResolvedValueOnce({ unreadCount: 0 });

    const response = await markUnread();
    const body = await response.json() as {
      success: boolean;
      data: { unreadCount: number };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.unreadCount).toBe(1);
    expect(handlerMocks.prepareBind).toHaveBeenCalledWith('agent-1', 'conv-1', '2026-07-19T12:00:00Z', '2026-07-19T12:00:00Z', 'conv-1');
  });

  it('floors unreadCount at 1 when the recount query yields no row', async () => {
    handlerMocks.prepareFirst.mockResolvedValueOnce(null);

    const response = await markUnread();
    const body = await response.json() as { data: { unreadCount: number } };

    expect(response.status).toBe(200);
    expect(body.data.unreadCount).toBe(1);
  });

  it('mark-as-read updates lastReadAt and clears the manual unread override', async () => {
    const response = await markRead();
    const body = await response.json() as {
      success: boolean;
      data: { lastReadAt: string };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.lastReadAt).toBe('2026-07-19T12:00:00Z');
    expect(handlerMocks.insertValues).toHaveBeenCalledWith({
      agentId: 'agent-1',
      conversationId: 'conv-1',
      lastReadAt: '2026-07-19T12:00:00Z',
      markedUnreadAt: null,
      updatedAt: '2026-07-19T12:00:00Z',
    });
  });

  it('mark-as-read scopes the clear to the acting agent', async () => {
    await markRead();

    const inserted = handlerMocks.insertValues.mock.calls[0]?.[0] as { agentId: string };
    expect(inserted.agentId).toBe('agent-1');
  });
});
