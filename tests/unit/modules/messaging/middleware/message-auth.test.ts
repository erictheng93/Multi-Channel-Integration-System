import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings, DbUser, JWTPayload } from '@/types';
import {
  applyMessageScopeFilter,
  checkMessageAccess,
  checkSpecificMessageAccess,
} from '@/modules/messaging/middleware/message-auth';

const mocks = vi.hoisted(() => ({
  drizzle: vi.fn(),
  findById: vi.fn(),
}));

vi.mock('drizzle-orm/d1', () => ({
  drizzle: mocks.drizzle,
}));

vi.mock('@modules/messaging/services/message-crud', () => ({
  MessageCrudService: vi.fn().mockImplementation(() => ({
    findById: mocks.findById,
  })),
}));

type TestUser = Partial<DbUser> & Partial<JWTPayload> & {
  role: 'admin' | 'agent' | 'viewer'
};

function createMockDrizzleDb(allResults: unknown[][]) {
  const all = vi.fn(async () => allResults.shift() ?? []);
  const where = vi.fn(() => ({ all }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    select,
    from,
    where,
    all,
  };
}

function createUserMiddleware(user?: TestUser) {
  return async (c: any, next: any) => {
    if (user) {
      c.set('user', user);
    }
    await next();
  };
}

function createEnv(): Bindings {
  return {
    DB: {} as D1Database,
  } as Bindings;
}

describe('Message Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findById.mockReset();
  });

  test('grants admins global message access without querying conversation scope', async () => {
    const app = new Hono<{ Bindings: Bindings }>();
    app.get('/messages', createUserMiddleware({
      userId: 1,
      role: 'admin',
      displayName: 'Admin',
      iat: 1,
      exp: 2,
    }), checkMessageAccess, applyMessageScopeFilter, (c) => {
      return c.json({
        scope: c.get('messageAccessScope'),
        conversationFilter: c.get('conversationFilter') ?? null,
      });
    });

    const response = await app.request('/messages', {}, createEnv());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.scope).toEqual({ isGlobalAccess: true });
    expect(data.conversationFilter).toBeNull();
    expect(mocks.drizzle).not.toHaveBeenCalled();
  });

  test('builds agent conversation scope from DbUser id, memberships, allowed teams, and primary team', async () => {
    const db = createMockDrizzleDb([
      [{ teamId: 2 }, { teamId: 3 }],
      [{ id: 'conv-team-2' }, { id: 'conv-team-4' }],
    ]);
    mocks.drizzle.mockReturnValue(db);

    const app = new Hono<{ Bindings: Bindings }>();
    app.get('/messages', createUserMiddleware({
      id: 'agent-1',
      email: 'agent@example.com',
      displayName: 'Agent',
      role: 'agent',
      primaryTeamId: 4,
      allowedTeamIds: [3],
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }), checkMessageAccess, applyMessageScopeFilter, (c) => {
      return c.json({
        scope: c.get('messageAccessScope'),
        conversationFilter: c.get('conversationFilter'),
      });
    });

    const response = await app.request('/messages', {}, createEnv());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.scope).toEqual({
      conversationIds: ['conv-team-2', 'conv-team-4'],
      teamIds: [2, 3, 4],
      isGlobalAccess: false,
    });
    expect(data.conversationFilter).toEqual(['conv-team-2', 'conv-team-4']);
    expect(db.all).toHaveBeenCalledTimes(2);
  });

  test('denies a specific message outside the agent conversation scope', async () => {
    const db = createMockDrizzleDb([
      [{ teamId: 2 }],
      [{ id: 'allowed-conversation' }],
    ]);
    mocks.drizzle.mockReturnValue(db);
    mocks.findById.mockResolvedValue({
      id: 'message-1',
      conversationId: 'blocked-conversation',
    });

    const app = new Hono<{ Bindings: Bindings }>();
    app.get('/messages/:id', createUserMiddleware({
      id: 'agent-1',
      email: 'agent@example.com',
      displayName: 'Agent',
      role: 'agent',
      primaryTeamId: 2,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }), checkMessageAccess, checkSpecificMessageAccess, (c) => c.json({ success: true }));

    const response = await app.request('/messages/message-1', {}, createEnv());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe('No permission to access this message');
  });
});
