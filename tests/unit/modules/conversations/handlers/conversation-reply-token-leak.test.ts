/**
 * line_reply_token is a live LINE credential (it can send a message to the customer). It must never reach a
 * browser through the conversation list, detail, assign, unassign or close/reopen responses.
 *
 * Runs the real handlers and real Drizzle queries against in-memory SQLite, with a stored token on the row, so
 * a handler that goes back to `select()` / `...row` makes this fail.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { Hono, type Context, type Next } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conversations, customers, teams } from '@/db/schema';
import type { Bindings } from '@/types';

const handle = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('@/db/drizzle-factory', () => ({ createDbClient: () => handle.db }));
vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: Context, next: Next) => {
    c.set('user', { id: 'admin-1', username: 'admin', displayName: 'Admin', role: 'admin', allowedTeamIds: [], teamRoles: {} });
    return next();
  }),
}));
vi.mock('@/services/permission-service', () => ({
  PermissionService: { checkPermission: vi.fn(async () => true) },
}));
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: class {
    broadcastConversationEvent = vi.fn(async () => true);
    broadcastConversationTransferred = vi.fn(async () => true);
  },
}));
vi.mock('@modules/activities', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    ActivityCapture: class {
      buildIrreversibleLog() {
        return { noop: true };
      }
      buildReversibleLog() {
        return { noop: true };
      }
    },
  };
});

import conversationQueriesHandler from '@/modules/conversations/handlers/conversation-queries';
import conversationAssignmentHandler from '@/modules/conversations/handlers/conversation-assignment';

const TOKEN = 'SECRET-LINE-REPLY-TOKEN-0123456789';

function createTable(sqlite: Database.Database, table: Parameters<typeof getTableConfig>[0]) {
  const { name, columns } = getTableConfig(table);
  sqlite.exec(`CREATE TABLE ${name} (${columns.map((col) => `"${col.name}"`).join(', ')})`);
}

// Minimal D1 facade over better-sqlite3. Queries against tables the fixture does not create (messages, read
// states, activity log...) behave like an empty table instead of throwing.
function createD1(sqlite: Database.Database): D1Database {
  const statement = (sql: string, params: unknown[] = []) => {
    const run = <T>(fn: (s: Database.Statement) => T, fallback: T): T => {
      try {
        return fn(sqlite.prepare(sql));
      } catch (error) {
        if (error instanceof Error && /no such (table|column)/.test(error.message)) {
          return fallback;
        }
        throw error;
      }
    };
    return {
      bind: (...next: unknown[]) => statement(sql, next),
      first: async () => run((s) => (s.reader ? (s.get(...params) ?? null) : (s.run(...params), null)), null),
      all: async () => run((s) => ({ results: s.reader ? s.all(...params) : (s.run(...params), []) }), { results: [] }),
      run: async () => run((s) => (s.run(...params), { success: true, meta: { changes: 1 } }), { success: true, meta: { changes: 0 } }),
    };
  };
  return {
    prepare: (sql: string) => statement(sql),
    batch: async (stmts: Array<{ run?: () => Promise<unknown> }>) => {
      const out: unknown[] = [];
      for (const s of stmts) {
        out.push(s.run ? await s.run() : { success: true, meta: { changes: 1 } });
      }
      return out;
    },
  } as unknown as D1Database;
}

function makeApp(env: Bindings) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/conversations', conversationQueriesHandler);
  app.route('/api/conversations', conversationAssignmentHandler);
  return (path: string, init?: RequestInit) => app.request(path, init, env);
}

function post(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

describe('conversation responses never expose the LINE reply token', () => {
  let call: ReturnType<typeof makeApp>;

  beforeEach(() => {
    const sqlite = new Database(':memory:');
    createTable(sqlite, conversations);
    createTable(sqlite, customers);
    createTable(sqlite, teams);
    sqlite.exec(`
      INSERT INTO teams (id, name) VALUES (3, 'Team Three');
      INSERT INTO customers (id, platform, platform_user_id, display_name) VALUES (1, 'line', 'U1', 'Alice');
      INSERT INTO conversations
        (id, customer_id, assigned_team_id, status, line_reply_token, line_reply_token_received_at, updated_at)
      VALUES ('conv-1', 1, 3, 'assigned', '${TOKEN}', ${Date.now()}, '2026-10-29T00:00:00Z');
    `);
    handle.db = drizzle(sqlite);
    call = makeApp({ DB: createD1(sqlite), KV: {}, CACHE: {} } as unknown as Bindings);
  });

  async function expectNoToken(res: Response) {
    const text = await res.text();
    expect(res.status, text).toBe(200);
    expect(text).toContain('conv-1');
    expect(text).not.toContain(TOKEN);
    expect(text).not.toMatch(/line_?reply_?token/i);
  }

  it('list', async () => {
    await expectNoToken(await call('/api/conversations'));
  });

  it('detail', async () => {
    await expectNoToken(await call('/api/conversations/conv-1'));
  });

  it('assign', async () => {
    await expectNoToken(await call('/api/conversations/conv-1/assign', post({ teamId: 3 })));
  });

  it('unassign', async () => {
    await expectNoToken(await call('/api/conversations/conv-1/unassign', post({})));
  });

  it('close and reopen', async () => {
    await expectNoToken(await call('/api/conversations/conv-1/close', { method: 'POST' }));
    await expectNoToken(await call('/api/conversations/conv-1/reopen', { method: 'POST' }));
  });
});
