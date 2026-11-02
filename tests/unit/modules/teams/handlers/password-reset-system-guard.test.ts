// The password reset UPDATE excludes the system actor on its own. The route guard and auth are stubbed out
// here so the WHERE clause is the only thing standing between the request and the system row.

import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import type { Context, Next } from 'hono';
import { d1Of } from '../../../../helpers/sqlite-d1';

vi.mock('@/middleware/block-system-agent', () => ({ blockSystemAgentTarget: () => (_c: Context, next: Next) => next() }));
vi.mock('@/middleware/auth', () => ({
  jwtAuth: (c: Context, next: Next) => { c.set('user' as never, { id: 'admin1', role: 'admin' } as never); return next(); },
  requireManagerOrAdmin: () => (_c: Context, next: Next) => next()
}));
vi.mock('@/utils/auth-jwt', () => ({ bumpTokensValidAfter: async () => undefined }));
vi.mock('@/services/websocket-access-revocation', () => ({ revokeUserWebSocketSessions: async () => undefined }));

const { default: passwordHandler } = await import('@/modules/teams/handlers/password');

function seed(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE agents (id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, display_name TEXT, role TEXT,
      is_active INTEGER, password_policy TEXT, last_active TEXT, last_login_at TEXT, created_at TEXT, updated_at TEXT,
      deleted_at TEXT);
    INSERT INTO agents (id, email, password_hash, display_name, role, is_active) VALUES
      ('system', 'system@internal', 'SYSTEM_NO_LOGIN', 'System', 'agent', 0),
      ('a1', 'a1@x', 'OLD', 'A1', 'agent', 1);
  `);
  return db;
}

const reset = (db: Database.Database, id: string) => passwordHandler.request(`/${id}/reset`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ newPassword: crypto.randomUUID() }) // generated: a literal trips secret scanners
}, { DB: d1Of(db) });
const hashOf = (db: Database.Database, id: string) =>
  (db.prepare('SELECT password_hash FROM agents WHERE id = ?').get(id) as { password_hash: string }).password_hash;

describe('password reset UPDATE', () => {
  it('leaves the system row untouched and reports it not found', async () => {
    const db = seed();
    expect((await reset(db, 'system')).status).toBe(404);
    expect(hashOf(db, 'system')).toBe('SYSTEM_NO_LOGIN');
  });

  it('still resets another member', async () => {
    const db = seed();
    expect((await reset(db, 'a1')).status).toBe(200);
    expect(hashOf(db, 'a1')).not.toBe('OLD');
  });
});
