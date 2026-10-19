import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono, type Context, type Next } from 'hono';
import type { Bindings } from '@/types';

const mocks = vi.hoisted(() => ({
  selectLimit: vi.fn(),
  batch: vi.fn(),
  bind: vi.fn(),
  broadcast: vi.fn(),
}));

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: Context, next: Next) => {
    c.set('user', { id: 7, displayName: 'Agent', role: 'agent', allowedTeamIds: [3] });
    return next();
  }),
}));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: mocks.selectLimit,
    };
    return { select: vi.fn(() => chain) };
  }),
}));

vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: class {
    broadcastConversationEvent = mocks.broadcast;
  },
}));

vi.mock('@/utils/timestamp', () => ({ nowISO: vi.fn(() => '2026-10-14T00:00:00.000Z') }));

vi.mock('@/core/error-handler', () => ({
  globalErrorHandler: {
    handleError: vi.fn((c: Context, error: unknown) =>
      c.json({ error: error instanceof Error ? error.message : String(error) }, 500)),
  },
}));

import conversationAssignmentHandler from '@/modules/conversations/handlers/conversation-assignment';

function request(action: 'close' | 'reopen') {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/conversations', conversationAssignmentHandler);
  const env = {
    DB: {
      prepare: vi.fn(() => ({ bind: mocks.bind.mockReturnValue({}) })),
      batch: mocks.batch,
    },
  } as unknown as Bindings;
  return app.request(`/api/conversations/conv-1/${action}`, { method: 'POST' }, env);
}

// The UPDATE is bound first (the guarded activity row follows it); its params are [status, closedAt, unreadFloor, updatedAt, id]
const updateParams = () => mocks.bind.mock.calls[0];

describe('POST /:id/close and /:id/reopen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Each guarded UPDATE reports one changed row (the race-lost case is covered in conversation-close-service.test.ts)
    mocks.batch.mockImplementation(async (stmts: unknown[]) => stmts.map(() => ({ meta: { changes: 1 } })));
    mocks.broadcast.mockResolvedValue(true);
  });

  it('closes an open conversation and broadcasts the new status', async () => {
    mocks.selectLimit.mockResolvedValue([{ id: 'conv-1', status: 'assigned', assignedTeamId: 3 }]);

    const res = await request('close');
    const body = await res.json() as { data: { status: string; closedAt: string } };

    expect(res.status).toBe(200);
    expect(body.data.status).toBe('closed');
    expect(updateParams()).toEqual(['closed', '2026-10-14T00:00:00.000Z', '2026-10-14T00:00:00.000Z', '2026-10-14T00:00:00.000Z', 'conv-1']);
    expect(mocks.broadcast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'conversation_status_changed',
      data: expect.objectContaining({ status: 'closed' }),
    }));
  });

  it('reopens to assigned when the conversation has a team', async () => {
    mocks.selectLimit.mockResolvedValue([{ id: 'conv-1', status: 'closed', assignedTeamId: 3 }]);

    const body = await (await request('reopen')).json() as { data: { status: string } };

    expect(body.data.status).toBe('assigned');
    expect(updateParams()?.[0]).toBe('assigned');
  });

  it('reopens to active when the conversation has no team', async () => {
    mocks.selectLimit.mockResolvedValue([{ id: 'conv-1', status: 'closed', assignedTeamId: null }]);

    const body = await (await request('reopen')).json() as { data: { status: string } };

    expect(body.data.status).toBe('active');
  });

  it('is a no-op when reopening a conversation that is not closed', async () => {
    mocks.selectLimit.mockResolvedValue([{ id: 'conv-1', status: 'in-progress', assignedTeamId: 3 }]);

    const body = await (await request('reopen')).json() as { data: { status: string } };

    expect(body.data.status).toBe('in-progress');
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(mocks.broadcast).not.toHaveBeenCalled();
  });

  it('returns 404 when the conversation is not visible to the agent', async () => {
    mocks.selectLimit.mockResolvedValue([]);

    const res = await request('close');

    expect(res.status).toBe(404);
    expect(mocks.batch).not.toHaveBeenCalled();
  });
});
