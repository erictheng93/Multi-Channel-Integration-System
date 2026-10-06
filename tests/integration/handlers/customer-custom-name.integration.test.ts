/**
 * PATCH /api/customers/:customerId (custom nickname) — real SQLite via a tiny D1 shim.
 * Key case: webhook profile sync (findOrCreateCustomer) must not touch custom_name.
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn((c: any, next: any) => {
    c.set('jwtPayload', { userId: 'admin-001', username: 'admin', role: 'admin', teamId: 1 });
    return next();
  }),
  requireRole: vi.fn(() => (_c: any, next: any) => next()),
}));

const broadcast = vi.fn().mockResolvedValue(true);
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: class {
    broadcastCustomerUpdatedEvent = broadcast;
  },
}));

import customerHandler from '@modules/customer/handlers/customer-main';
import { findOrCreateCustomer } from '@/utils/database';

function d1Shim(db: Database.Database): D1Database {
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    run: async () => {
      const r = db.prepare(sql).run(...args);
      return { success: true, meta: { changes: r.changes, last_row_id: r.lastInsertRowid } };
    },
    all: async () => ({ success: true, results: db.prepare(sql).all(...args), meta: {} }),
    raw: async () => db.prepare(sql).raw().all(...args),
    first: async () => db.prepare(sql).get(...args) ?? null,
  });
  return { prepare: (sql: string) => stmt(sql), batch: async () => [] } as unknown as D1Database;
}

describe('PATCH /api/customers/:customerId customName', () => {
  let sqlite: Database.Database;
  let env: { DB: D1Database };
  const app = new Hono();
  app.route('/api/customers', customerHandler);
  const patch = (body: unknown) =>
    app.request('/api/customers/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, env);
  const row = () => sqlite.prepare('SELECT display_name, custom_name FROM customers WHERE id = 1').get();

  beforeEach(() => {
    broadcast.mockClear();
    sqlite = new Database(':memory:');
    sqlite.exec(`CREATE TABLE customers (
      id INTEGER PRIMARY KEY, platform TEXT NOT NULL, platform_user_id TEXT NOT NULL,
      display_name TEXT, custom_name TEXT, avatar_url TEXT, email TEXT, phone TEXT,
      source_team_id INTEGER, metadata TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT,
      UNIQUE (platform, platform_user_id));
      INSERT INTO customers (id, platform, platform_user_id, display_name) VALUES (1, 'line', 'U1', 'Platform Name');`);
    env = { DB: d1Shim(sqlite) };
  });

  test('too long -> 400, non-string -> 400', async () => {
    expect((await patch({ customName: 'x'.repeat(51) })).status).toBe(400);
    expect((await patch({ customName: 5 })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect(row()).toMatchObject({ custom_name: null });
  });

  test('sets trimmed name, broadcasts payload; blank string -> null', async () => {
    const res = await patch({ customName: '  Boss  ' });
    expect(res.status).toBe(200);
    expect(row()).toEqual({ display_name: 'Platform Name', custom_name: 'Boss' });
    expect(broadcast).toHaveBeenCalledWith({ customerId: 1, customName: 'Boss', platformName: 'Platform Name' });

    expect((await patch({ customName: '   ' })).status).toBe(200);
    expect(row()).toEqual({ display_name: 'Platform Name', custom_name: null });
  });

  test('webhook profile sync updates display_name but keeps custom_name', async () => {
    await patch({ customName: 'Boss' });
    await findOrCreateCustomer(env.DB, 'line', 'U1', { displayName: 'Renamed On LINE' });
    expect(row()).toEqual({ display_name: 'Renamed On LINE', custom_name: 'Boss' });
  });
});
