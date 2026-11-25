// LINE replyToken claim against real SQLite: the 50 s safe window and the single-use clear are SQL
// predicates, so only a real database shows whether they hold (message-delivery-service.test.ts mocks them).
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LINE_REPLY_TOKEN_SAFE_WINDOW_MS } from '@/constants/limits';
import type { Bindings } from '@/types';
import { d1Of } from '../../../../helpers/sqlite-d1';

const NOW = vi.hoisted(() => 1_768_483_200_000);
vi.mock('@/utils/timestamp', () => ({
  nowISO: () => new Date(NOW).toISOString(),
  nowMs: () => NOW,
}));

import { MessageDeliveryService } from '@/modules/conversations/services/message-delivery-service';

type Claimer = { claimLineReplyToken(conversationId: string): Promise<string | null> };

let sqlite: Database.Database;
let claim: (conversationId: string) => Promise<string | null>;

function addConversation(id: string, token: string | null, receivedAt: number | null): void {
  sqlite.prepare('INSERT INTO conversations (id, line_reply_token, line_reply_token_received_at) VALUES (?, ?, ?)')
    .run(id, token, receivedAt);
}

const stored = (id: string) =>
  sqlite.prepare('SELECT line_reply_token AS token, line_reply_token_received_at AS receivedAt FROM conversations WHERE id = ?').get(id);

describe('MessageDeliveryService LINE replyToken claim (real SQL)', () => {
  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.exec('CREATE TABLE conversations (id TEXT PRIMARY KEY, line_reply_token TEXT, line_reply_token_received_at INTEGER)');
    const service = new MessageDeliveryService({ DB: d1Of(sqlite) } as unknown as Bindings) as unknown as Claimer;
    claim = (id) => service.claimLineReplyToken(id);
  });

  it('hands out a fresh token once and clears it, so a second delivery pushes', async () => {
    addConversation('c1', 'tok-1', NOW - 10_000);

    expect(await claim('c1')).toBe('tok-1');
    expect(stored('c1')).toEqual({ token: null, receivedAt: null });
    expect(await claim('c1')).toBeNull();
  });

  it('refuses a token at or past the 50 s safe window and leaves the row alone', async () => {
    addConversation('edge', 'tok-edge', NOW - LINE_REPLY_TOKEN_SAFE_WINDOW_MS);
    addConversation('old', 'tok-old', NOW - LINE_REPLY_TOKEN_SAFE_WINDOW_MS - 1);

    expect(await claim('edge')).toBeNull();
    expect(await claim('old')).toBeNull();
    expect(stored('old')).toEqual({ token: 'tok-old', receivedAt: NOW - LINE_REPLY_TOKEN_SAFE_WINDOW_MS - 1 });
  });

  it('accepts a token just inside the window', async () => {
    addConversation('inside', 'tok-in', NOW - LINE_REPLY_TOKEN_SAFE_WINDOW_MS + 1);

    expect(await claim('inside')).toBe('tok-in');
  });

  it('never claims another conversation token', async () => {
    addConversation('mine', null, null);
    addConversation('other', 'tok-other', NOW - 1_000);

    expect(await claim('mine')).toBeNull();
    expect(stored('other')).toEqual({ token: 'tok-other', receivedAt: NOW - 1_000 });
  });
});
