/**
 * claimLineReplyToken against real SQLite. The mocked unit suite cannot see SQL semantics; this
 * catches the original bug where UPDATE ... SET token = NULL RETURNING token always returned NULL.
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const handle = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/db/drizzle-factory', () => ({ createDbClient: () => handle.db }));

import { MessageDeliveryService } from '@/modules/conversations/services/message-delivery-service';
import { LINE_REPLY_TOKEN_SAFE_WINDOW_MS } from '@/constants/limits';
import type { Bindings } from '@/types';

describe('claimLineReplyToken (real SQLite)', () => {
  let sqlite: Database.Database;
  const claim = () =>
    (new MessageDeliveryService({} as Bindings) as any).claimLineReplyToken('conv-1') as Promise<string | null>;
  const tokenRow = () => sqlite.prepare('SELECT line_reply_token AS t FROM conversations').get() as { t: string | null };

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.exec('CREATE TABLE conversations (id TEXT PRIMARY KEY, line_reply_token TEXT, line_reply_token_received_at INTEGER)');
    handle.db = drizzle(sqlite);
  });

  const seed = (token: string | null, ageMs: number) =>
    sqlite.prepare('INSERT INTO conversations VALUES (?, ?, ?)').run('conv-1', token, Date.now() - ageMs);

  test('returns the fresh token and clears it, so a second claim gets nothing', async () => {
    seed('reply-token-1', 1000);
    expect(await claim()).toBe('reply-token-1');
    expect(tokenRow().t).toBeNull();
    expect(await claim()).toBeNull();
  });

  test('leaves an expired token alone and returns null', async () => {
    seed('old-token', LINE_REPLY_TOKEN_SAFE_WINDOW_MS + 1000);
    expect(await claim()).toBeNull();
    expect(tokenRow().t).toBe('old-token');
  });

  test('returns null when there is no token', async () => {
    seed(null, 0);
    expect(await claim()).toBeNull();
  });
});
