import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and } from 'drizzle-orm';
import { conversations } from '@/db/schema';
import { getConversationVisibilityCondition } from '@/services/conversation-visibility';
import {
  staleReviewOrderBy,
  staleViewConditions
} from '@/modules/conversations/handlers/conversation-queries';
import { buildConversationQuery } from '@shared/api-contracts/conversations';

const NOW = Date.parse('2026-10-29T10:00:00.000Z');
const DAY = 24 * 3600_000;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

function setup() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE conversations (
      id TEXT PRIMARY KEY, status TEXT NOT NULL, assigned_team_id INTEGER, awaiting_since TEXT, deleted_at TEXT
    );
    CREATE INDEX idx_conversations_awaiting_since ON conversations(awaiting_since, id, status, assigned_team_id, deleted_at)
      WHERE awaiting_since IS NOT NULL;
    CREATE TABLE messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, sender_type TEXT NOT NULL, deleted_at TEXT,
      is_recalled INTEGER DEFAULT 0, is_sent INTEGER DEFAULT 1, metadata TEXT, created_at TEXT
    );
    CREATE INDEX idx_messages_conv_sender_deleted_created ON messages(conversation_id, sender_type, deleted_at, created_at);
  `);
  const conv = sqlite.prepare('INSERT INTO conversations VALUES (?,?,?,?,?)');
  const msg = sqlite.prepare('INSERT INTO messages (id, conversation_id, sender_type, metadata, created_at) VALUES (?,?,?,?,?)');
  let n = 0;
  return {
    sqlite,
    conv: (id: string, status: string, team: number | null, awaiting: string | null, deleted: string | null = null) => conv.run(id, status, team, awaiting, deleted),
    msg: (c: string, sender: string, metadata: string | null = null) => msg.run(`m${++n}`, c, sender, metadata, ago(100 * DAY))
  };
}

function staleIds(h: ReturnType<typeof setup>, user = { role: 'admin' as const, allowedTeamIds: [] as number[] }): string[] {
  return drizzle(h.sqlite)
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(getConversationVisibilityCondition(user), ...staleViewConditions(NOW)))
    .orderBy(...staleReviewOrderBy())
    .all()
    .map(r => r.id);
}

describe('awaiting=stale list (逾期待回覆)', () => {
  it('lists only open, not-deleted waits older than 7 days; never-replied first, then oldest', () => {
    const h = setup();
    h.conv('replied-old', 'active', null, ago(60 * DAY));
    h.msg('replied-old', 'agent');
    h.conv('never-new', 'active', null, ago(10 * DAY));
    h.conv('never-old', 'assigned', 3, ago(90 * DAY));
    h.conv('auto-reply-only', 'active', null, ago(20 * DAY));
    h.msg('auto-reply-only', 'system');
    h.msg('auto-reply-only', 'agent', '{"broadcastId":"b"}');
    h.conv('in-window', 'active', null, ago(6 * DAY));
    h.conv('edge', 'active', null, ago(7 * DAY + 1));
    h.conv('closed', 'closed', null, ago(60 * DAY));
    h.conv('deleted', 'active', null, ago(60 * DAY), ago(DAY));
    h.conv('answered', 'active', null, null);
    expect(staleIds(h)).toEqual(['never-old', 'auto-reply-only', 'never-new', 'edge', 'replied-old'].sort((a, b) => order(a) - order(b)));
    function order(id: string): number {
      return ['never-old', 'auto-reply-only', 'never-new', 'edge', 'replied-old'].indexOf(id);
    }
  });

  it('is scoped by the existing visibility rule', () => {
    const h = setup();
    h.conv('mine', 'active', 7, ago(30 * DAY));
    h.conv('pool', 'active', null, ago(30 * DAY));
    h.conv('theirs', 'active', 9, ago(30 * DAY));
    expect(staleIds(h).sort()).toEqual(['mine', 'pool', 'theirs']);
    expect(staleIds(h, { role: 'agent', allowedTeamIds: [7] }).sort()).toEqual(['mine', 'pool']);
    expect(staleIds(h, { role: 'agent', allowedTeamIds: [] })).toEqual(['pool']);
  });

  it('filters through the partial awaiting_since index', () => {
    const h = setup();
    const query = drizzle(h.sqlite).select({ id: conversations.id }).from(conversations)
      .where(and(...staleViewConditions(NOW))).toSQL();
    const plan = (h.sqlite.prepare(`EXPLAIN QUERY PLAN ${query.sql}`).all(...query.params) as Array<{ detail: string }>)
      .map(p => p.detail).join(' | ');
    expect(plan).toContain('idx_conversations_awaiting_since');
  });

  it('the client query string carries awaiting=stale', () => {
    expect(buildConversationQuery({ awaiting: 'stale', page: 1, pageSize: 20 })).toContain('awaiting=stale');
    expect(buildConversationQuery({ page: 1 })).not.toContain('awaiting');
  });
});
