import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono, type Context, type Next } from 'hono';
import Sqlite from 'better-sqlite3';
import type { Bindings } from '@/types';

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: Context, next: Next) => {
    c.set('user', { id: 'agent-1', username: 'agent', role: 'agent' });
    return next();
  }),
}));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({
    select: vi.fn(() => {
      const chain = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        get: vi.fn(async () => ({ id: 'conv-1', status: 'open' })),
      };
      return chain;
    }),
  })),
}));

vi.mock('@/services/permission-service', () => ({
  PermissionService: { checkPermission: vi.fn(async () => true) },
}));

import conversationReadHandler from '@/modules/conversations/handlers/conversation-read';

let sqlite: Sqlite.Database;

// Real SQLite behind a D1-shaped facade: only the recount SELECT is executed,
// the mark-unread upsert is acknowledged as a successful write.
function makeEnv(): Bindings {
  return {
    DB: {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => sqlite.prepare(sql).get(...args),
          run: async () => ({ meta: { changes: 1 } }),
        }),
      }),
    },
  } as unknown as Bindings;
}

async function markUnread(): Promise<number> {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/conversations', conversationReadHandler);
  const res = await app.request('/api/conversations/conv-1/unread', { method: 'PUT' }, makeEnv());
  const body = await res.json() as { data: { unreadCount: number } };
  return body.data.unreadCount;
}

function addMessages(senderType: string, createdAts: string[]): void {
  const insert = sqlite.prepare(
    'INSERT INTO messages (conversation_id, sender_type, created_at) VALUES (?, ?, ?)'
  );
  createdAts.forEach((at) => insert.run('conv-1', senderType, at));
}

describe('PUT /:id/unread recount honours conversations.unread_floor_at', () => {
  beforeEach(() => {
    sqlite = new Sqlite(':memory:');
    sqlite.exec(`
      CREATE TABLE conversations (id TEXT PRIMARY KEY, unread_floor_at TEXT);
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT, sender_type TEXT, created_at TEXT, deleted_at TEXT
      );
    `);
  });

  afterEach(() => sqlite.close());

  it('counts only post-reopen messages: 5 pre-close + 1 after reopen => 1', async () => {
    sqlite.prepare('INSERT INTO conversations (id, unread_floor_at) VALUES (?, ?)')
      .run('conv-1', '2026-07-10T00:00:00Z');
    addMessages('customer', [
      '2026-07-01T00:00:00Z', '2026-07-02T00:00:00Z', '2026-07-03T00:00:00Z',
      '2026-07-04T00:00:00Z', '2026-07-05T00:00:00Z',
      '2026-07-12T00:00:00Z',
    ]);

    expect(await markUnread()).toBe(1);
  });

  it('without a floor, all customer messages after the last agent reply count', async () => {
    sqlite.prepare('INSERT INTO conversations (id, unread_floor_at) VALUES (?, NULL)').run('conv-1');
    addMessages('agent', ['2026-07-01T00:00:00Z']);
    addMessages('customer', ['2026-07-02T00:00:00Z', '2026-07-03T00:00:00Z']);

    expect(await markUnread()).toBe(2);
  });
});
