/**
 * A D1Database test double backed by better-sqlite3, plus the minimal schema the dashboard
 * tests need. The real migration files (0069 rollup, 0070 awaiting_since + triggers) are
 * executed verbatim, so tests exercise the exact SQL that will run in production.
 */
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface QueryLog {
  sql: string;
}

export function d1Of(db: Database.Database, log?: QueryLog[]): D1Database {
  const statement = (query: string, params: unknown[] = []) => {
    const run = () => {
      const stmt = db.prepare(query);
      if (stmt.reader) {
        return { results: stmt.all(...params), meta: { changes: 0 } };
      }
      const info = stmt.run(...params);
      return { results: [], meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
    };
    return {
      __run: run,
      first: async () => {
        log?.push({ sql: query });
        return db.prepare(query).get(...params) ?? null;
      },
      all: async () => {
        log?.push({ sql: query });
        return { success: true, ...run() };
      },
      run: async () => {
        log?.push({ sql: query });
        return { success: true, ...run() };
      }
    };
  };
  return {
    prepare: (query: string) => ({
      ...statement(query),
      bind: (...params: unknown[]) => statement(query, params)
    }),
    batch: async (statements: Array<{ __run: () => unknown }>) => {
      const results: unknown[] = [];
      db.transaction(() => {
        for (const s of statements) { results.push({ success: true, ...(s.__run() as object) }); }
      })();
      return results;
    },
    exec: async (query: string) => { db.exec(query); return { count: 1, duration: 0 }; }
  } as unknown as D1Database;
}

const MIGRATIONS_DIR = resolve(__dirname, '../../migrations');

export function readMigration(file: string): string {
  return readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8');
}

export const MIGRATION_ROLLUP = '0069_add_message_daily_stats.sql';
export const MIGRATION_AWAITING = '0070_add_conversation_awaiting_since.sql';

/** Base tables as they exist before migrations 0069/0070 (only the columns the dashboard reads). */
export function createBaseSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY, platform TEXT NOT NULL, display_name TEXT, custom_name TEXT, avatar_url TEXT
    );
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY, customer_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active',
      assigned_team_id INTEGER, first_response_at TEXT, closed_at TEXT, created_at TEXT, deleted_at TEXT
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, sender_type TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '', message_type TEXT NOT NULL DEFAULT 'text',
      metadata TEXT, is_recalled INTEGER DEFAULT 0, is_sent INTEGER DEFAULT 1, delivery_status TEXT DEFAULT 'delivered',
      deleted_at TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX idx_messages_created_at ON messages(created_at);
    CREATE INDEX idx_messages_sender_type_created_at ON messages(sender_type, created_at);
    CREATE INDEX idx_messages_conv_sender_deleted_created ON messages(conversation_id, sender_type, deleted_at, created_at);
  `);
}

export interface SchemaOptions {
  rollup?: boolean;
  awaiting?: boolean;
}

/** Fresh in-memory database; migrations are applied on top of the base schema when requested. */
export function createDashboardDb(options: SchemaOptions = {}): Database.Database {
  const db = new Database(':memory:');
  createBaseSchema(db);
  if (options.rollup) { db.exec(readMigration(MIGRATION_ROLLUP)); }
  if (options.awaiting) { db.exec(readMigration(MIGRATION_AWAITING)); }
  return db;
}

let seq = 0;

export function addCustomer(db: Database.Database, id: number, platform = 'line', name = `Customer ${id}`): void {
  db.prepare('INSERT OR IGNORE INTO customers (id, platform, display_name) VALUES (?, ?, ?)').run(id, platform, name);
}

export function addConv(
  db: Database.Database,
  id: string,
  opts: {
    customer?: number;
    status?: string;
    team?: number | null;
    createdAt?: string;
    closedAt?: string | null;
    firstResponseAt?: string | null;
  } = {}
): void {
  db.prepare(
    'INSERT INTO conversations (id, customer_id, status, assigned_team_id, created_at, closed_at, first_response_at) VALUES (?,?,?,?,?,?,?)'
  ).run(
    id, opts.customer ?? 1, opts.status ?? 'active', opts.team ?? null,
    opts.createdAt ?? '2026-01-01T00:00:00.000Z', opts.closedAt ?? null, opts.firstResponseAt ?? null
  );
}

export interface MsgExtra {
  content?: string;
  metadata?: string | null;
  recalled?: number;
  deleted?: string | null;
  type?: string;
  sent?: number;
}

export function addMsg(
  db: Database.Database,
  conv: string,
  sender: 'customer' | 'agent' | 'system',
  at: string,
  extra: MsgExtra = {}
): string {
  const id = `m${++seq}`;
  db.prepare(
    'INSERT INTO messages (id, conversation_id, sender_type, content, message_type, metadata, is_recalled, is_sent, deleted_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(
    id, conv, sender, extra.content ?? 'hi', extra.type ?? 'text', extra.metadata ?? null,
    extra.recalled ?? 0, extra.sent ?? 1, extra.deleted ?? null, at
  );
  return id;
}

export function awaitingOf(db: Database.Database, conv: string): string | null {
  const row = db.prepare('SELECT awaiting_since AS a FROM conversations WHERE id = ?').get(conv) as { a: string | null } | undefined;
  return row?.a ?? null;
}
