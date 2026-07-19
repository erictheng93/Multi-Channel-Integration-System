import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono, type Context, type Next } from 'hono';
import type { Bindings } from '@/types';

const handlerMocks = vi.hoisted(() => ({
  selectGet: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  checkPermission: vi.fn(),
  prepareFirst: vi.fn(),
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
    update: vi.fn(() => ({
      set: handlerMocks.updateSet,
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
        bind: vi.fn(() => ({
          first: handlerMocks.prepareFirst,
        })),
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

describe('conversation unread handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlerMocks.checkPermission.mockResolvedValue(true);
    handlerMocks.selectGet.mockResolvedValue({ id: 'conv-1' });
    handlerMocks.updateSet.mockReturnValue({ where: handlerMocks.updateWhere });
    handlerMocks.updateWhere.mockResolvedValue(undefined);
    handlerMocks.prepareFirst.mockResolvedValue({ unreadCount: 3 });
  });

  it('clears lastReadAt and returns the recomputed unread count', async () => {
    const response = await markUnread();
    const body = await response.json() as {
      success: boolean;
      data: { unreadCount: number };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.unreadCount).toBe(3);
    expect(handlerMocks.updateSet).toHaveBeenCalledWith({
      lastReadAt: null,
      updatedAt: '2026-07-19T12:00:00Z',
    });
  });

  it('returns 403 without mutating when permission is denied', async () => {
    handlerMocks.checkPermission.mockResolvedValueOnce(false);

    const response = await markUnread();

    expect(response.status).toBe(403);
    expect(handlerMocks.updateSet).not.toHaveBeenCalled();
  });

  it('returns 404 without mutating when the conversation does not exist', async () => {
    handlerMocks.selectGet.mockResolvedValueOnce(undefined);

    const response = await markUnread();

    expect(response.status).toBe(404);
    expect(handlerMocks.updateSet).not.toHaveBeenCalled();
  });

  it('returns unreadCount 0 when the recount query yields no row', async () => {
    handlerMocks.prepareFirst.mockResolvedValueOnce(null);

    const response = await markUnread();
    const body = await response.json() as { data: { unreadCount: number } };

    expect(response.status).toBe(200);
    expect(body.data.unreadCount).toBe(0);
  });

  it('keeps the existing mark-as-read endpoint working (regression)', async () => {
    const response = await makeApp().request(
      '/api/conversations/conv-1/read',
      { method: 'PUT' },
      makeEnv()
    );
    const body = await response.json() as {
      success: boolean;
      data: { lastReadAt: string };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.lastReadAt).toBe('2026-07-19T12:00:00Z');
    expect(handlerMocks.updateSet).toHaveBeenCalledWith({
      lastReadAt: '2026-07-19T12:00:00Z',
    });
  });
});
