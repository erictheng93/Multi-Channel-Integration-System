// customer-conversation-lookup: deterministic "one conversation per customer" selection
import { describe, it, expect } from 'vitest';
import Sqlite from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { conversations } from '@/db/schema';
import { createDbClient } from '@/db/drizzle-factory';
import { findCustomerConversation, getReopenStatus } from '@/services/customer-conversation-lookup';
import { d1Of } from '../../helpers/sqlite-d1';

function dbWith(rows: Array<{ id: string; customerId: number; status: string; lastMessageAt: string | null; createdAt: string }>) {
  const sqlite = new Sqlite(':memory:');
  const { columns } = getTableConfig(conversations);
  sqlite.exec(`CREATE TABLE conversations (${columns.map(c => `"${c.name}" ${c.getSQLType()}`).join(', ')})`);
  const insert = sqlite.prepare(
    'INSERT INTO conversations (id, customer_id, status, last_message_at, created_at) VALUES (?, ?, ?, ?, ?)');
  for (const r of rows) insert.run(r.id, r.customerId, r.status, r.lastMessageAt, r.createdAt);
  return createDbClient(d1Of(sqlite));
}

describe('findCustomerConversation', () => {
  it('prefers a non-closed conversation over a newer closed one', async () => {
    const db = dbWith([
      { id: 'closed-new', customerId: 7, status: 'closed', lastMessageAt: '2026-11-20T00:00:00Z', createdAt: '2026-11-01T00:00:00Z' },
      { id: 'live-old', customerId: 7, status: 'active', lastMessageAt: '2026-10-01T00:00:00Z', createdAt: '2026-09-01T00:00:00Z' },
      { id: 'other-customer', customerId: 8, status: 'active', lastMessageAt: '2026-11-24T00:00:00Z', createdAt: '2026-11-24T00:00:00Z' },
    ]);
    expect((await findCustomerConversation(db, 7))?.id).toBe('live-old');
  });

  it('breaks ties by latest activity, then creation time, then id', async () => {
    const db = dbWith([
      { id: 'a', customerId: 7, status: 'closed', lastMessageAt: '2026-11-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'b', customerId: 7, status: 'closed', lastMessageAt: '2026-11-02T00:00:00Z', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'c', customerId: 9, status: 'assigned', lastMessageAt: '2026-11-02T00:00:00Z', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'd', customerId: 9, status: 'assigned', lastMessageAt: '2026-11-02T00:00:00Z', createdAt: '2026-02-01T00:00:00Z' },
      { id: 'e', customerId: 10, status: 'active', lastMessageAt: null, createdAt: '2026-01-01T00:00:00Z' },
      { id: 'f', customerId: 10, status: 'active', lastMessageAt: null, createdAt: '2026-01-01T00:00:00Z' },
    ]);
    expect((await findCustomerConversation(db, 7))?.id).toBe('b');
    expect((await findCustomerConversation(db, 9))?.id).toBe('d');
    expect((await findCustomerConversation(db, 10))?.id).toBe('f');
    expect(await findCustomerConversation(db, 11)).toBeUndefined();
  });
});

describe('getReopenStatus', () => {
  it('returns null for a conversation that is not closed', () => {
    expect(getReopenStatus('active', true)).toBeNull();
    expect(getReopenStatus('assigned', false)).toBeNull();
    expect(getReopenStatus(null, true)).toBeNull();
  });
  it('reopens a closed conversation to assigned with a team, else active', () => {
    expect(getReopenStatus('closed', true)).toBe('assigned');
    expect(getReopenStatus('closed', false)).toBe('active');
  });
});
