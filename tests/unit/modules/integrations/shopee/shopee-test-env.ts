/** Shared fixtures for the Shopee OAuth/token tests: better-sqlite3 D1, in-memory KV, encryption key. */
import Database from 'better-sqlite3';
import { d1Of } from '../../../../helpers/sqlite-d1';
import { generateEncryptionKey, resetEncryptionService } from '@/services/encryption-service';
import type { Bindings } from '@/types';

export function createShopeeDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE teams (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT, qr_code TEXT, is_active INTEGER DEFAULT 1,
      created_at TEXT, updated_at TEXT, deleted_at TEXT);
    CREATE TABLE channel_integrations (id INTEGER PRIMARY KEY, team_id INTEGER NOT NULL, platform TEXT NOT NULL, config TEXT,
      credentials TEXT, webhook_config TEXT, stats TEXT, is_active INTEGER DEFAULT 1, is_verified INTEGER DEFAULT 0,
      last_verified_at TEXT, configured_by TEXT, config_metadata TEXT, last_error TEXT, error_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO teams (id, name) VALUES (7, 'Shopee team');
  `);
  return db;
}

export function memoryKV(): KVNamespace & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => { store.set(k, v); },
    delete: async (k: string) => { store.delete(k); },
  } as unknown as KVNamespace & { store: Map<string, string> };
}

export async function createShopeeEnv(db: Database.Database): Promise<Bindings & { CACHE: ReturnType<typeof memoryKV> }> {
  resetEncryptionService();
  return {
    DB: d1Of(db),
    CACHE: memoryKV(),
    ENCRYPTION_KEY: await generateEncryptionKey(),
    SHOPEE_ENV: 'sandbox',
    SHOPEE_PARTNER_ID: '1255141',
    SHOPEE_PARTNER_KEY: 'test-partner-key',
    FRONTEND_URL: 'https://app.example.test',
    BACKEND_URL: 'https://api.example.test',
  } as unknown as Bindings & { CACHE: ReturnType<typeof memoryKV> };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
