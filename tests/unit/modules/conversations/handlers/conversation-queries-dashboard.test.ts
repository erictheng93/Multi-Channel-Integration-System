import Database from 'better-sqlite3';
import { Hono, type Context, type Next } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

const handlerMocks = vi.hoisted(() => ({
  createDbClient: vi.fn(),
  user: { id: 'agent-1', role: 'agent', allowedTeamIds: [] as number[] },
}));

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: Context, next: Next) => {
    c.set('user', handlerMocks.user);
    return next();
  }),
}));
vi.mock('@/services/permission-service', () => ({ PermissionService: {} }));
vi.mock('@/db/drizzle-factory', () => ({ createDbClient: handlerMocks.createDbClient }));
vi.mock('@/services/recall-window-config', () => ({
  getRecallWindowSeconds: vi.fn(async () => 10),
}));

import conversationQueriesHandler, {
  computeReplyWindowExpiresAt,
  createConversationUnreadCountQuery,
} from '@/modules/conversations/handlers/conversation-queries';

function d1Of(db: Database.Database): D1Database {
  return {
    prepare: (query: string) => ({
      bind: (...params: unknown[]) => ({
        first: async () => db.prepare(query).get(...params) ?? null,
        all: async () => ({ results: db.prepare(query).all(...params) }),
      }),
    }),
  } as unknown as D1Database;
}

function makeApp(env: Bindings) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/conversations', conversationQueriesHandler);
  return { request: (path: string) => app.request(path, undefined, env) };
}

function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'active',
      unread_floor_at TEXT,
      assigned_team_id INTEGER
    );
    CREATE TABLE conversation_read_states (
      agent_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
      last_read_at TEXT, marked_unread_at TEXT,
      PRIMARY KEY (agent_id, conversation_id)
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, sender_type TEXT NOT NULL,
      deleted_at TEXT, created_at TEXT NOT NULL
    );
  `);
  return db;
}

const addConversation = (db: Database.Database, id: string, status: string, team: number | null = null) =>
  db.prepare('INSERT INTO conversations (id, status, assigned_team_id) VALUES (?, ?, ?)').run(id, status, team);
const addMessage = (db: Database.Database, id: string, conv: string, sender: string, at: string) =>
  db.prepare('INSERT INTO messages (id, conversation_id, sender_type, created_at) VALUES (?, ?, ?, ?)').run(id, conv, sender, at);

type StatsBody = {
  data: {
    total: number; active: number; open: number; closed: number;
    byTeam: Array<{ teamId: number | null; open: number; closed: number }>;
    unreadCount: number; oldestUnreadAt: string | null;
  };
};

beforeEach(() => {
  handlerMocks.user = { id: 'agent-1', role: 'agent', allowedTeamIds: [] };
});

describe('GET /conversations/stats open / closed / byTeam / oldestUnreadAt', () => {
  it('splits open and closed overall and per team (null = unassigned pool), sorted by open desc', async () => {
    const db = createDb();
    addConversation(db, 'a', 'active');
    addConversation(db, 'b', 'active');
    addConversation(db, 'c', 'closed');
    handlerMocks.user = { id: 'agent-1', role: 'agent', allowedTeamIds: [7] };
    addConversation(db, 'd', 'assigned', 7);
    addConversation(db, 'e', 'closed', 7);
    addConversation(db, 'f', 'closed', 7);
    addConversation(db, 'other-team', 'active', 9);

    const response = await makeApp({ DB: d1Of(db) } as unknown as Bindings).request('/api/conversations/stats');
    const body = await response.json() as StatsBody;

    expect(response.status).toBe(200);
    // team 9 is not visible to this agent
    expect(body.data.total).toBe(6);
    expect(body.data.active).toBe(2);
    expect(body.data.open).toBe(3);
    expect(body.data.closed).toBe(3);
    expect(body.data.byTeam).toEqual([
      { teamId: null, open: 2, closed: 1 },
      { teamId: 7, open: 1, closed: 2 },
    ]);
  });

  it('admin sees every team', async () => {
    const db = createDb();
    addConversation(db, 'a', 'active', 9);
    addConversation(db, 'b', 'active', 7);
    handlerMocks.user = { id: 'admin-1', role: 'admin', allowedTeamIds: [] };

    const body = await (await makeApp({ DB: d1Of(db) } as unknown as Bindings).request('/api/conversations/stats'))
      .json() as StatsBody;

    expect(body.data.total).toBe(2);
    expect(body.data.byTeam.map(t => t.teamId).sort()).toEqual([7, 9]);
  });

  it('returns zeros and an empty split when nothing is visible', async () => {
    const body = await (await makeApp({ DB: d1Of(createDb()) } as unknown as Bindings).request('/api/conversations/stats'))
      .json() as StatsBody;

    expect(body.data.total).toBe(0);
    expect(body.data.open).toBe(0);
    expect(body.data.closed).toBe(0);
    expect(body.data.byTeam).toEqual([]);
    expect(body.data.oldestUnreadAt).toBeNull();
  });

  it('oldestUnreadAt is the earliest unread customer message, ignoring answered and closed conversations', async () => {
    const db = createDb();
    addConversation(db, 'old', 'active');
    addConversation(db, 'new', 'active');
    addConversation(db, 'answered', 'active');
    addConversation(db, 'closed', 'closed');
    addMessage(db, 'o1', 'old', 'customer', '2026-07-01T05:00:00Z');
    addMessage(db, 'o2', 'old', 'customer', '2026-07-01T09:00:00Z');
    addMessage(db, 'n1', 'new', 'customer', '2026-07-02T01:00:00Z');
    addMessage(db, 'a1', 'answered', 'customer', '2026-06-01T00:00:00Z');
    addMessage(db, 'a2', 'answered', 'agent', '2026-06-01T01:00:00Z');
    addMessage(db, 'c1', 'closed', 'customer', '2026-05-01T00:00:00Z');

    const body = await (await makeApp({ DB: d1Of(db) } as unknown as Bindings).request('/api/conversations/stats'))
      .json() as StatsBody;

    expect(body.data.unreadCount).toBe(3);
    expect(body.data.oldestUnreadAt).toBe('2026-07-01T05:00:00Z');
  });
});

describe('per-conversation oldestUnreadAt (list SQL)', () => {
  it('reports the earliest unread customer message and null when nothing is unread', () => {
    const db = createDb();
    addConversation(db, 'unread', 'active');
    addMessage(db, 'u1', 'unread', 'customer', '2026-07-21T10:00:00Z');
    addMessage(db, 'u2', 'unread', 'customer', '2026-07-21T11:00:00Z');
    addConversation(db, 'answered', 'active');
    addMessage(db, 'a1', 'answered', 'customer', '2026-07-21T10:00:00Z');
    addMessage(db, 'a2', 'answered', 'agent', '2026-07-21T10:30:00Z');

    const ids = ['unread', 'answered'];
    const rows = db.prepare(createConversationUnreadCountQuery(ids)).all(...ids, 'agent-1') as Array<{
      conversationId: string;
      oldestUnreadAt: string | null;
    }>;
    const byId = new Map(rows.map(row => [row.conversationId, row.oldestUnreadAt]));

    expect(byId.get('unread')).toBe('2026-07-21T10:00:00Z');
    expect(byId.get('answered')).toBeNull();
  });
});

describe('reply window and token privacy on the list', () => {
  it('computeReplyWindowExpiresAt mirrors the reply-window endpoint formula', () => {
    const now = 1_000_000;
    // received now, 50 s safe window, 10 s recall window -> usable until now + 40 s
    expect(computeReplyWindowExpiresAt(now, 10, now)).toBe(now + 40_000);
    expect(computeReplyWindowExpiresAt(now - 45_000, 10, now)).toBeNull(); // would have expired 5 s ago
    expect(computeReplyWindowExpiresAt(null, 10, now)).toBeNull();
    expect(computeReplyWindowExpiresAt(undefined, 0, now)).toBeNull();
  });

  function selectChain(result: unknown[]) {
    const chain: Record<string, unknown> = {};
    for (const method of ['from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit', 'offset']) {
      chain[method] = vi.fn(() => chain);
    }
    chain.then = (resolve: (value: unknown[]) => void) => Promise.resolve(result).then(resolve);
    return chain;
  }

  const row = (id: string, replyTokenReceivedAt?: number) => ({
    conversations: {
      id, customerId: 1, assignedTeamId: null, status: 'active', priority: 'normal',
      firstResponseAt: null, closedAt: null, lastMessageAt: null, lastReadAt: null, markedUnreadAt: null,
      createdAt: '2026-07-20T00:00:00Z', updatedAt: '2026-07-21T00:00:00Z', deletedAt: null,
    },
    customers: { id: 1, displayName: 'C', platform: 'line', platformUserId: 'u', avatarUrl: null, createdAt: null },
    teams: null,
    replyTokenReceivedAt,
  });

  it('selects an explicit column allowlist (no line_reply_token) and exposes only the derived expiry', async () => {
    const receivedAt = Date.now();
    const select = vi.fn(() => selectChain([row('c1', receivedAt), row('c2')]));
    handlerMocks.createDbClient.mockReturnValue({ select });
    const db = createDb();

    const response = await makeApp({ DB: d1Of(db) } as unknown as Bindings).request('/api/conversations');
    const body = await response.json() as { data: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    const selection = (select.mock.calls[0] as unknown as [{ conversations: Record<string, unknown> }])[0];
    expect(Object.keys(selection.conversations)).not.toContain('lineReplyToken');
    expect(Object.keys(selection.conversations)).not.toContain('lineReplyTokenReceivedAt');
    for (const item of body.data) {
      expect(item).not.toHaveProperty('lineReplyToken');
      expect(item).not.toHaveProperty('lineReplyTokenReceivedAt');
      expect(item).not.toHaveProperty('replyTokenReceivedAt');
    }
    // mocked recall window = 10 s -> 40 s of free reply left
    expect(body.data[0]?.replyWindowExpiresAt).toBe(receivedAt + 40_000);
    expect(body.data[1]?.replyWindowExpiresAt).toBeNull();
  });
});
