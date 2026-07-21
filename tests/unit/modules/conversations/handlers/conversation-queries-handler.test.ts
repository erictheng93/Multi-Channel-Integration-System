import Database from 'better-sqlite3';
import { Hono, type Context, type Next } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

const handlerMocks = vi.hoisted(() => ({
  getVisibleConversations: vi.fn(),
  createDbClient: vi.fn(),
}));

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

vi.mock('@/services/permission-service', () => ({
  PermissionService: {
    getVisibleConversations: handlerMocks.getVisibleConversations,
  },
}));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: handlerMocks.createDbClient,
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-07-21T12:00:00Z'),
}));

import conversationQueriesHandler, {
  createConversationUnreadCountQuery,
} from '@/modules/conversations/handlers/conversation-queries';

function makeApp(env: Bindings) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/conversations', conversationQueriesHandler);
  return {
    request: (path: string) => app.request(path, undefined, env),
  };
}

function createSelectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const method of ['from', 'leftJoin', 'innerJoin', 'where', 'orderBy']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown[]) => void, reject?: (error: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function createConversationRows(count: number, startIndex = 1) {
  return Array.from({ length: count }, (_, index) => {
    const conversationIndex = startIndex + index;
    const id = `conv-${conversationIndex}`;
    return {
      conversations: {
        id,
        customerId: conversationIndex,
        assignedTeamId: null,
        status: 'active',
        priority: 'medium',
        firstResponseAt: null,
        closedAt: null,
        lastMessageAt: `2026-07-21T${String(index % 24).padStart(2, '0')}:00:00Z`,
        lastReadAt: null,
        markedUnreadAt: null,
        createdAt: '2026-07-20T00:00:00Z',
        updatedAt: `2026-07-21T${String(index % 24).padStart(2, '0')}:00:00Z`,
        deletedAt: null,
      },
      customers: {
        id: conversationIndex,
        displayName: `Customer ${conversationIndex}`,
        platform: 'line',
        platformUserId: `line-${conversationIndex}`,
        avatarUrl: null,
        createdAt: '2026-07-20T00:00:00Z',
      },
      teams: null,
    };
  });
}

function createMockDrizzle(selectResults: unknown[][]) {
  return {
    select: vi.fn(() => createSelectChain(selectResults.shift() ?? [])),
    selectDistinct: vi.fn(() => createSelectChain([])),
  };
}

function createMockD1() {
  const calls: Array<{ query: string; params: unknown[] }> = [];
  return {
    calls,
    db: {
      prepare: vi.fn((query: string) => ({
        bind: vi.fn((...params: unknown[]) => {
          calls.push({ query, params });
          return {
            all: vi.fn(async () => ({ results: [] })),
            first: vi.fn(async () => null),
          };
        }),
      })),
    } as unknown as D1Database,
  };
}

function createSqliteDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      last_read_at TEXT
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      deleted_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

function insertConversation(db: Database.Database, id: string, lastReadAt: string | null = null) {
  db.prepare('INSERT INTO conversations (id, last_read_at) VALUES (?, ?)').run(id, lastReadAt);
}

function insertMessage(
  db: Database.Database,
  id: string,
  conversationId: string,
  senderType: 'customer' | 'agent' | 'system',
  createdAt: string,
  deletedAt: string | null = null
) {
  db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_type, created_at, deleted_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, conversationId, senderType, createdAt, deletedAt);
}

function unreadRows(db: Database.Database, ids: string[]) {
  const query = createConversationUnreadCountQuery(ids);
  return db.prepare(query).all(...ids) as Array<{ conversationId: string; unreadCount: number }>;
}

describe('conversation unread count SQL', () => {
  it('covers unread threshold edge cases and chunks larger than 90 ids', () => {
    const db = createSqliteDb();

    insertConversation(db, 'no-agent');
    insertMessage(db, 'm1', 'no-agent', 'customer', '2026-07-21T10:00:00Z');
    insertMessage(db, 'm2', 'no-agent', 'customer', '2026-07-21T11:00:00Z');

    insertConversation(db, 'no-last-read');
    insertMessage(db, 'm3', 'no-last-read', 'agent', '2026-07-21T10:00:00Z');
    insertMessage(db, 'm4', 'no-last-read', 'customer', '2026-07-21T11:00:00Z');

    insertConversation(db, 'agent-later', '2026-07-21T09:00:00Z');
    insertMessage(db, 'm5', 'agent-later', 'agent', '2026-07-21T10:00:00Z');
    insertMessage(db, 'm6', 'agent-later', 'customer', '2026-07-21T10:30:00Z');

    insertConversation(db, 'read-later', '2026-07-21T11:00:00Z');
    insertMessage(db, 'm7', 'read-later', 'agent', '2026-07-21T10:00:00Z');
    insertMessage(db, 'm8', 'read-later', 'customer', '2026-07-21T10:30:00Z');
    insertMessage(db, 'm9', 'read-later', 'customer', '2026-07-21T11:30:00Z');

    insertConversation(db, 'deleted-customer');
    insertMessage(db, 'm10', 'deleted-customer', 'customer', '2026-07-21T10:00:00Z', '2026-07-21T10:05:00Z');
    insertMessage(db, 'm11', 'deleted-customer', 'customer', '2026-07-21T11:00:00Z');

    insertConversation(db, 'system-threshold');
    insertMessage(db, 'm12', 'system-threshold', 'system', '2026-07-21T10:00:00Z');
    insertMessage(db, 'm13', 'system-threshold', 'customer', '2026-07-21T09:00:00Z');
    insertMessage(db, 'm14', 'system-threshold', 'customer', '2026-07-21T11:00:00Z');

    insertConversation(db, 'same-timestamp');
    insertMessage(db, 'm15', 'same-timestamp', 'agent', '2026-07-21T10:00:00Z');
    insertMessage(db, 'm16', 'same-timestamp', 'customer', '2026-07-21T10:00:00Z');
    insertMessage(db, 'm17', 'same-timestamp', 'customer', '2026-07-21T10:00:01Z');

    const fillerIds = Array.from({ length: 91 }, (_, index) => `filler-${index + 1}`);
    for (const id of fillerIds) {
      insertConversation(db, id);
    }

    const rows = unreadRows(db, [
      'no-agent',
      'no-last-read',
      'agent-later',
      'read-later',
      'deleted-customer',
      'system-threshold',
      'same-timestamp',
      ...fillerIds,
    ]);
    const counts = new Map(rows.map(row => [row.conversationId, Number(row.unreadCount)]));

    expect(counts.get('no-agent')).toBe(2);
    expect(counts.get('no-last-read')).toBe(1);
    expect(counts.get('agent-later')).toBe(1);
    expect(counts.get('read-later')).toBe(1);
    expect(counts.get('deleted-customer')).toBe(1);
    expect(counts.get('system-threshold')).toBe(1);
    expect(counts.get('same-timestamp')).toBe(1);
    expect(rows.some(row => row.conversationId.startsWith('filler-'))).toBe(false);
  });
});

describe('conversation list pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enriches only the requested page of conversations', async () => {
    const visibleIds = Array.from({ length: 120 }, (_, index) => `conv-${index + 1}`);
    handlerMocks.getVisibleConversations.mockResolvedValue(visibleIds);

    const mockDrizzle = createMockDrizzle([
      createConversationRows(90),
      createConversationRows(30, 91),
    ]);
    handlerMocks.createDbClient.mockReturnValue(mockDrizzle);

    const d1 = createMockD1();
    const response = await makeApp({ DB: d1.db } as unknown as Bindings)
      .request('/api/conversations?page=1&pageSize=50');
    const body = await response.json() as {
      success: boolean;
      data: { items: unknown[]; total: number; page: number; pageSize: number };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(50);
    expect(body.data.total).toBe(120);
    expect(body.data.page).toBe(1);
    expect(body.data.pageSize).toBe(50);

    const latestMessageCall = d1.calls.find(call => call.query.includes('MAX(created_at) as max_created_at'));
    const unreadCall = d1.calls.find(call => call.query.includes('WITH ids(id) AS'));

    expect(latestMessageCall?.params).toHaveLength(50);
    expect(unreadCall?.params).toHaveLength(50);
  });
});
