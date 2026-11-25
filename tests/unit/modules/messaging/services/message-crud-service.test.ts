// MessageCrudService.searchMessages, the only method reached from production
// (GET /api/messages/search). Runs the real Drizzle queries against in-memory SQLite,
// so the visibility scope, soft-delete filter, every query filter and the pagination
// are checked against rows, not against a mock that ignores the WHERE clause.
import { describe, it, expect, beforeEach } from 'vitest';
import Sqlite from 'better-sqlite3';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { agents, conversations, customers, fileAttachments, messages } from '@/db/schema';
import { MessageCrudService } from '@modules/messaging/services/message-crud';
import type { MessageSearchQuery } from '@modules/messaging/types/message-types';
import { d1Of } from '../../../../helpers/sqlite-d1';

function createTable(sqlite: Sqlite.Database, table: SQLiteTable): void {
  const config = getTableConfig(table);
  sqlite.exec(`CREATE TABLE "${config.name}" (${config.columns.map(column =>
    `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`).join(', ')})`);
}

interface Msg {
  id: string;
  conv?: string;
  sender?: 'customer' | 'agent' | 'system';
  content?: string;
  type?: string;
  at?: string;
  recalled?: number;
  status?: string;
  deleted?: string | null;
  metadata?: string | null;
}

const admin = { role: 'admin' as const, allowedTeamIds: [] as number[] };
const agentTeam7 = { role: 'agent' as const, allowedTeamIds: [7] };
const agentNoTeams = { role: 'agent' as const, allowedTeamIds: [] as number[] };

let sqlite: Sqlite.Database;
let service: MessageCrudService;

function addMsg(m: Msg): void {
  const sender = m.sender ?? 'customer';
  sqlite.prepare(`INSERT INTO messages (id, conversation_id, sender_type, customer_sender_id, agent_sender_id, content,
      message_type, is_recalled, is_sent, delivery_status, deleted_at, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`).run(
    m.id, m.conv ?? 'conv-pool', sender,
    sender === 'customer' ? 1 : null, sender === 'agent' ? 'agent-1' : null,
    m.content ?? 'hello', m.type ?? 'text', m.recalled ?? 0, m.status ?? 'sent',
    m.deleted ?? null, m.metadata ?? null, m.at ?? '2026-11-01T00:00:00.000Z'
  );
}

const ids = async (query: MessageSearchQuery, user: { role: 'admin' | 'agent'; allowedTeamIds: number[] } = admin) =>
  (await service.searchMessages(query, user)).messages.map(m => m.id).sort();

beforeEach(() => {
  sqlite = new Sqlite(':memory:');
  for (const table of [agents, customers, conversations, messages, fileAttachments]) createTable(sqlite, table);
  sqlite.exec(`
    INSERT INTO customers (id, platform, platform_user_id, display_name, avatar_url) VALUES (1, 'line', 'U1', 'Customer A', 'https://example.com/a.png');
    INSERT INTO agents (id, display_name) VALUES ('agent-1', 'Agent Smith');
    INSERT INTO conversations (id, customer_id, assigned_team_id, status) VALUES
      ('conv-pool', 1, NULL, 'active'), ('conv-7', 1, 7, 'assigned'), ('conv-9', 1, 9, 'assigned');
  `);
  service = new MessageCrudService(d1Of(sqlite));
});

describe('MessageCrudService.searchMessages visibility', () => {
  beforeEach(() => {
    addMsg({ id: 'pool', conv: 'conv-pool' });
    addMsg({ id: 'team-7', conv: 'conv-7' });
    addMsg({ id: 'team-9', conv: 'conv-9' });
    addMsg({ id: 'deleted', conv: 'conv-7', deleted: '2026-11-02T00:00:00.000Z' });
  });

  it('agents see their teams plus the unassigned pool, never another team', async () => {
    expect(await ids({}, agentTeam7)).toEqual(['pool', 'team-7']);
  });

  it('an agent with no teams sees only the unassigned pool', async () => {
    expect(await ids({}, agentNoTeams)).toEqual(['pool']);
  });

  it('admins see every team', async () => {
    expect(await ids({}, admin)).toEqual(['pool', 'team-7', 'team-9']);
  });

  it('an explicit conversationId cannot reach outside the visibility scope', async () => {
    const result = await service.searchMessages({ conversationId: 'conv-9' }, agentTeam7);
    expect(result.messages).toEqual([]);
    expect(result.total).toBe(0);
    expect(await ids({ conversationId: 'conv-7' }, agentTeam7)).toEqual(['team-7']);
  });

  it('never returns or counts soft-deleted messages', async () => {
    const result = await service.searchMessages({}, admin);
    expect(result.total).toBe(3);
    expect(result.messages.map(m => m.id)).not.toContain('deleted');
  });
});

describe('MessageCrudService.searchMessages filters', () => {
  it('content is a substring match with LIKE wildcards taken literally', async () => {
    addMsg({ id: 'literal', content: 'refund 100% now' });
    addMsg({ id: 'wildcard-bait', content: 'refund 1000 now' });
    addMsg({ id: 'other', content: 'unrelated' });

    expect(await ids({ content: 'refund' })).toEqual(['literal', 'wildcard-bait']);
    expect(await ids({ content: '100%' })).toEqual(['literal']);
    expect(await ids({ content: '1_0' })).toEqual([]);
  });

  it('senderType, messageType, isRecalled and deliveryStatus each narrow the result', async () => {
    addMsg({ id: 'customer-text', sender: 'customer' });
    addMsg({ id: 'agent-image', sender: 'agent', type: 'image' });
    addMsg({ id: 'agent-recalled', sender: 'agent', recalled: 1 });
    addMsg({ id: 'agent-failed', sender: 'agent', status: 'failed' });

    expect(await ids({ senderType: 'customer' })).toEqual(['customer-text']);
    expect(await ids({ messageType: 'image' })).toEqual(['agent-image']);
    expect(await ids({ isRecalled: true })).toEqual(['agent-recalled']);
    expect(await ids({ isRecalled: false })).toEqual(['agent-failed', 'agent-image', 'customer-text']);
    expect(await ids({ deliveryStatus: 'failed' })).toEqual(['agent-failed']);
  });

  it('dateFrom and dateTo are inclusive bounds on created_at', async () => {
    addMsg({ id: 'before', at: '2026-10-31T23:59:59.000Z' });
    addMsg({ id: 'start', at: '2026-11-01T00:00:00.000Z' });
    addMsg({ id: 'end', at: '2026-11-30T00:00:00.000Z' });
    addMsg({ id: 'after', at: '2026-11-30T00:00:01.000Z' });

    expect(await ids({ dateFrom: '2026-11-01T00:00:00.000Z', dateTo: '2026-11-30T00:00:00.000Z' })).toEqual(['end', 'start']);
  });
});

describe('MessageCrudService.searchMessages pagination and shape', () => {
  it('returns newest first, pages with limit/offset, counts the full match set and reports hasMore', async () => {
    for (let i = 1; i <= 5; i++) addMsg({ id: `m${i}`, at: `2026-11-0${i}T00:00:00.000Z` });

    const first = await service.searchMessages({ limit: 2, offset: 0 }, admin);
    expect(first.messages.map(m => m.id)).toEqual(['m5', 'm4']);
    expect(first.total).toBe(5);
    expect(first.pagination).toEqual({ limit: 2, offset: 0, hasMore: true });

    const last = await service.searchMessages({ limit: 2, offset: 4 }, admin);
    expect(last.messages.map(m => m.id)).toEqual(['m1']);
    expect(last.pagination.hasMore).toBe(false);

    // a page that ends exactly at the last match has nothing more
    expect((await service.searchMessages({ limit: 5, offset: 0 }, admin)).pagination.hasMore).toBe(false);
  });

  it('defaults to limit 50 and offset 0', async () => {
    const result = await service.searchMessages({}, admin);
    expect(result.pagination).toEqual({ limit: 50, offset: 0, hasMore: false });
    expect(result.messages).toEqual([]);
  });

  it('resolves sender names, attachments, booleans and metadata for each hit', async () => {
    addMsg({ id: 'from-customer', sender: 'customer', at: '2026-11-03T00:00:00.000Z', metadata: '{"tags":["vip"]}' });
    addMsg({ id: 'from-agent', sender: 'agent', at: '2026-11-02T00:00:00.000Z', recalled: 1 });
    addMsg({ id: 'from-system', sender: 'system', at: '2026-11-01T00:00:00.000Z' });
    sqlite.prepare(`INSERT INTO file_attachments (id, message_id, conversation_id, filename, mime_type, file_size, file_url, r2_key, uploaded_by, created_at)
      VALUES ('f1', 'from-customer', 'conv-pool', 'invoice.pdf', 'application/pdf', 1024, '/api/files/f1', 'k', 'agent-1', '2026-11-03T00:00:00.000Z')`).run();

    const [customerHit, agentHit, systemHit] = (await service.searchMessages({}, admin)).messages;

    expect(customerHit).toMatchObject({
      id: 'from-customer', senderName: 'Customer A', senderAvatar: 'https://example.com/a.png',
      isRecalled: false, isSent: true, metadata: { tags: ['vip'] }
    });
    expect(customerHit?.attachments).toEqual([expect.objectContaining({ id: 'f1', filename: 'invoice.pdf', size: 1024, url: '/api/files/f1' })]);
    expect(agentHit).toMatchObject({ senderName: 'Agent Smith', isRecalled: true, attachments: [] });
    expect(systemHit?.senderName).toBe('Unknown');
  });

  it('propagates a database failure instead of reporting no results', async () => {
    sqlite.exec('DROP TABLE messages');
    await expect(service.searchMessages({ content: 'x' }, admin)).rejects.toThrow(/Failed query/);
  });
});
