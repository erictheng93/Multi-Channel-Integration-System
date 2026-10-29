import Database from 'better-sqlite3';
import { Hono, type Context, type Next } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

const mocks = vi.hoisted(() => ({
  user: { id: 'agent-1', role: 'agent', allowedTeamIds: [7] as number[] },
}));

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn(async (c: Context, next: Next) => {
    c.set('user', mocks.user);
    return next();
  }),
}));
vi.mock('@/services/permission-service', () => ({ PermissionService: {} }));
vi.mock('@/db/drizzle-factory', () => ({ createDbClient: vi.fn() }));

import { dashboardHandler } from '@/modules/dashboard/handlers/dashboard-main';
import conversationQueriesHandler from '@/modules/conversations/handlers/conversation-queries';

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

function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE customers (id INTEGER PRIMARY KEY, platform TEXT NOT NULL, display_name TEXT, custom_name TEXT, avatar_url TEXT);
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY, customer_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active',
      assigned_team_id INTEGER, first_response_at TEXT, closed_at TEXT, created_at TEXT, deleted_at TEXT
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, sender_type TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '', message_type TEXT NOT NULL DEFAULT 'text',
      metadata TEXT, is_recalled INTEGER DEFAULT 0, deleted_at TEXT, created_at TEXT NOT NULL
    );
  `);
  db.prepare("INSERT INTO customers (id, platform, display_name) VALUES (1, 'line', 'Alice')").run();
  return db;
}

function kvStore() {
  const store = new Map<string, string>();
  return {
    store,
    kv: {
      get: vi.fn(async (key: string) => (store.has(key) ? JSON.parse(store.get(key)!) : null)),
      put: vi.fn(async (key: string, value: string, options?: { expirationTtl?: number }) => {
        store.set(key, value);
        expect(options?.expirationTtl).toBeGreaterThanOrEqual(60);
      }),
    } as unknown as KVNamespace,
  };
}

function appFor(env: Bindings) {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/dashboard', dashboardHandler);
  app.route('/api/conversations', conversationQueriesHandler);
  return { get: (path: string) => app.request(path, undefined, env) };
}

beforeEach(() => {
  mocks.user = { id: 'agent-1', role: 'agent', allowedTeamIds: [7] };
});

describe('GET /api/dashboard/summary', () => {
  it('returns the scoped summary and caches it per visibility scope for at least 60 s', async () => {
    const db = createDb();
    const { kv, store } = kvStore();
    const app = appFor({ DB: d1Of(db), CACHE: kv } as unknown as Bindings);

    const first = await app.get('/api/dashboard/summary');
    const body = await first.json() as { success: boolean; data: { timezone: string; waiting: { count: number } } };

    expect(first.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.timezone).toBe('Asia/Taipei');
    expect(body.data.waiting.count).toBe(0);
    expect([...store.keys()]).toEqual(['dashboard:v1:summary:teams:7']);

    // new unanswered conversation appears, but the cached value is served inside the TTL
    db.prepare("INSERT INTO conversations (id, customer_id) VALUES ('c1', 1)").run();
    db.prepare("INSERT INTO messages (id, conversation_id, sender_type, created_at) VALUES ('m1', 'c1', 'customer', '2020-01-01T00:00:00.000Z')").run();
    const cached = await (await app.get('/api/dashboard/summary')).json() as { data: { waiting: { count: number } } };
    expect(cached.data.waiting.count).toBe(0);
  });

  it('works without a KV binding', async () => {
    const response = await appFor({ DB: d1Of(createDb()) } as unknown as Bindings).get('/api/dashboard/summary');
    expect(response.status).toBe(200);
  });
});

describe('GET /api/dashboard/message-volume', () => {
  it('defaults to 7 days and accepts 30 and 90', async () => {
    const app = appFor({ DB: d1Of(createDb()) } as unknown as Bindings);
    const get = async (query: string) =>
      (await (await app.get(`/api/dashboard/message-volume${query}`)).json()) as { data: { days: number; current: unknown[]; previous: unknown[] } };

    expect((await get('')).data.days).toBe(7);
    expect((await get('?days=30')).data.current).toHaveLength(30);
    expect((await get('?days=90')).data.previous).toHaveLength(90);
  });

  it('rejects other windows with 400', async () => {
    const app = appFor({ DB: d1Of(createDb()) } as unknown as Bindings);
    for (const bad of ['?days=14', '?days=abc', '?days=0']) {
      expect((await app.get(`/api/dashboard/message-volume${bad}`)).status).toBe(400);
    }
  });

  it('caches 5 minutes under a key that includes the window', async () => {
    const { kv, store } = kvStore();
    const app = appFor({ DB: d1Of(createDb()), CACHE: kv } as unknown as Bindings);
    await app.get('/api/dashboard/message-volume?days=30');
    expect([...store.keys()]).toEqual(['dashboard:v1:volume:teams:7:30']);
    expect(vi.mocked(kv.put).mock.calls[0]?.[2]).toEqual({ expirationTtl: 300 });
  });
});

describe('GET /api/conversations/waiting', () => {
  it('is routed before /:id and returns the scoped waiting list with a limit', async () => {
    const db = createDb();
    db.exec(`
      INSERT INTO conversations (id, customer_id, assigned_team_id) VALUES ('mine', 1, 7), ('theirs', 1, 9);
      INSERT INTO messages (id, conversation_id, sender_type, content, created_at) VALUES
        ('a', 'mine', 'customer', 'need help', '2026-10-29T01:00:00.000Z'),
        ('b', 'theirs', 'customer', 'secret', '2026-10-29T01:00:00.000Z');
    `);
    const app = appFor({ DB: d1Of(db) } as unknown as Bindings);

    const response = await app.get('/api/conversations/waiting?limit=3');
    const body = await response.json() as {
      success: boolean;
      data: { total: number; items: Array<{ conversationId: string; lastCustomerMessage: string }>; generatedAt: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.total).toBe(1);
    expect(body.data.items.map(i => i.conversationId)).toEqual(['mine']);
    expect(body.data.items[0]?.lastCustomerMessage).toBe('need help');
    expect(typeof body.data.generatedAt).toBe('string');
  });

  it('returns an empty state', async () => {
    const response = await appFor({ DB: d1Of(createDb()) } as unknown as Bindings).get('/api/conversations/waiting');
    const body = await response.json() as { data: { total: number; items: unknown[] } };
    expect(body.data.total).toBe(0);
    expect(body.data.items).toEqual([]);
  });
});
