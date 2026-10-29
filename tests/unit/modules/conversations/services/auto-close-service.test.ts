import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const broadcastConversationEvent = vi.fn().mockResolvedValue(true);
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: class { broadcastConversationEvent = broadcastConversationEvent; }
}));

import {
  AUTO_CLOSE_IDLE_DAYS,
  AUTO_CLOSE_MAX_PER_RUN,
  autoCloseIdleConversations,
  resolveAutoCloseIdleDays
} from '@modules/conversations/services/auto-close-service';
import { getReopenStatus } from '@/services/customer-conversation-lookup';
import { getWaitingConversations } from '@/modules/dashboard/services/waiting-service';
import type { Bindings } from '@/types';
import { addConv, addCustomer, addMsg, awaitingOf, createDashboardDb, d1Of } from '../../../../helpers/sqlite-d1';

const NOW = Date.parse('2026-10-29T10:00:00.000Z');
const DAY = 24 * 3600_000;
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const admin = { role: 'admin' as const, allowedTeamIds: [] as number[] };

function setup(envExtra: Partial<Bindings> = {}) {
  const db = createDashboardDb({ awaiting: true, hygiene: true });
  db.exec(`
    ALTER TABLE conversations ADD COLUMN updated_at TEXT;
    CREATE TABLE activities (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, user_name TEXT, user_role TEXT, action TEXT,
      resource_type TEXT, resource_id TEXT, details TEXT, ip_address TEXT, user_agent TEXT, created_at TEXT);
  `);
  addCustomer(db, 1);
  const env = { DB: d1Of(db), ...envExtra } as unknown as Bindings;
  return { db, env };
}

const statusOf = (db: Database.Database, id: string) =>
  (db.prepare('SELECT status FROM conversations WHERE id = ?').get(id) as { status: string }).status;

/** The customer asks, then an agent answers `agentAgo` ms before NOW. */
function answered(db: Database.Database, id: string, agentAgo: number, opts: { team?: number } = {}) {
  addConv(db, id, opts.team !== undefined ? { team: opts.team } : {});
  addMsg(db, id, 'customer', ago(agentAgo + 3600_000));
  addMsg(db, id, 'agent', ago(agentAgo));
}

describe('resolveAutoCloseIdleDays', () => {
  it('defaults to 14, honours the env override and 0 disables', () => {
    expect(AUTO_CLOSE_IDLE_DAYS).toBe(14);
    expect(resolveAutoCloseIdleDays(undefined)).toBe(14);
    expect(resolveAutoCloseIdleDays('')).toBe(14);
    expect(resolveAutoCloseIdleDays('30')).toBe(30);
    expect(resolveAutoCloseIdleDays('0')).toBe(0);
    expect(resolveAutoCloseIdleDays('abc')).toBe(14);
    expect(resolveAutoCloseIdleDays('-3')).toBe(14);
  });
});

describe('autoCloseIdleConversations', () => {
  beforeEach(() => broadcastConversationEvent.mockClear());

  it('closes an idle conversation whose last message is a human reply, with a system activity row and a broadcast', async () => {
    const { db, env } = setup();
    answered(db, 'idle', 14 * DAY + 1000);
    const result = await autoCloseIdleConversations(env, NOW);
    expect(result).toMatchObject({ enabled: true, idleDays: 14, candidates: 1, closed: 1 });
    expect(statusOf(db, 'idle')).toBe('closed');
    const row = db.prepare('SELECT closed_at, unread_floor_at FROM conversations WHERE id = ?').get('idle') as { closed_at: string; unread_floor_at: string };
    expect(row.closed_at).not.toBeNull();
    expect(row.unread_floor_at).toBe(row.closed_at);
    const log = db.prepare('SELECT * FROM activities').all() as Array<Record<string, string>>;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ user_id: 'system', user_name: '系統', user_role: 'system', action: 'conversation_auto_close', resource_id: 'idle' });
    expect(JSON.parse(log[0]!.details!)).toMatchObject({ auto: true, idleDays: 14, previousStatus: 'active', status: 'closed' });
    expect(broadcastConversationEvent).toHaveBeenCalledTimes(1);
  });

  it('keeps a conversation idle for 13 days, closes one at 14', async () => {
    const { db, env } = setup();
    answered(db, 'thirteen', 13 * DAY);
    answered(db, 'fourteen', 14 * DAY);
    await autoCloseIdleConversations(env, NOW);
    expect(statusOf(db, 'thirteen')).toBe('active');
    expect(statusOf(db, 'fourteen')).toBe('closed');
  });

  it('never closes a conversation that is awaiting a reply, however old', async () => {
    const { db, env } = setup();
    addConv(db, 'waiting');
    addMsg(db, 'waiting', 'customer', ago(90 * DAY));
    expect(awaitingOf(db, 'waiting')).not.toBeNull();
    const result = await autoCloseIdleConversations(env, NOW);
    expect(result.candidates).toBe(0);
    expect(statusOf(db, 'waiting')).toBe('active');
  });

  it('closes a conversation whose last customer message was a sign-off', async () => {
    const { db, env } = setup();
    answered(db, 'thanks', 30 * DAY);
    addMsg(db, 'thanks', 'customer', ago(20 * DAY), { content: '謝謝' });
    addConv(db, 'sticker');
    addMsg(db, 'sticker', 'customer', ago(40 * DAY));
    addMsg(db, 'sticker', 'agent', ago(39 * DAY));
    addMsg(db, 'sticker', 'customer', ago(30 * DAY), { type: 'sticker', content: '' });
    expect(awaitingOf(db, 'thanks')).toBeNull();
    expect(awaitingOf(db, 'sticker')).toBeNull();
    const result = await autoCloseIdleConversations(env, NOW);
    expect(result.closed).toBe(2);
    expect(statusOf(db, 'thanks')).toBe('closed');
    expect(statusOf(db, 'sticker')).toBe('closed');
  });

  it('a recent sign-off keeps the conversation open (activity inside the window)', async () => {
    const { db, env } = setup();
    answered(db, 'recent-thanks', 30 * DAY);
    addMsg(db, 'recent-thanks', 'customer', ago(2 * DAY), { content: '謝謝' });
    await autoCloseIdleConversations(env, NOW);
    expect(statusOf(db, 'recent-thanks')).toBe('active');
  });

  it('a recent agent message keeps it open too', async () => {
    const { db, env } = setup();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', ago(40 * DAY));
    addMsg(db, 'c', 'agent', ago(3 * DAY));
    await autoCloseIdleConversations(env, NOW);
    expect(statusOf(db, 'c')).toBe('active');
  });

  it('skips closed and soft-deleted conversations', async () => {
    const { db, env } = setup();
    answered(db, 'closed', 30 * DAY);
    db.prepare("UPDATE conversations SET status = 'closed', closed_at = ? WHERE id = 'closed'").run(ago(25 * DAY));
    answered(db, 'deleted', 30 * DAY);
    db.prepare('UPDATE conversations SET deleted_at = ? WHERE id = ?').run(ago(DAY), 'deleted');
    const result = await autoCloseIdleConversations(env, NOW);
    expect(result.candidates).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM activities').get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT status, deleted_at FROM conversations WHERE id = 'deleted'").get()).toEqual({ status: 'active', deleted_at: ago(DAY) });
  });

  it('caps a run at the batch size, oldest first, and finishes the rest on the next run (idempotent)', async () => {
    const { db, env } = setup();
    const total = AUTO_CLOSE_MAX_PER_RUN + 30;
    for (let i = 0; i < total; i++) { answered(db, `c${i}`, 20 * DAY + i * 1000); }
    const first = await autoCloseIdleConversations(env, NOW);
    expect(first).toMatchObject({ candidates: AUTO_CLOSE_MAX_PER_RUN, closed: AUTO_CLOSE_MAX_PER_RUN });
    expect((db.prepare("SELECT COUNT(*) AS n FROM conversations WHERE status = 'closed'").get() as { n: number }).n).toBe(AUTO_CLOSE_MAX_PER_RUN);
    // the highest i has the oldest last customer message, so it goes first
    expect(statusOf(db, `c${total - 1}`)).toBe('closed');
    expect(statusOf(db, 'c0')).toBe('active');

    const second = await autoCloseIdleConversations(env, NOW);
    expect(second).toMatchObject({ candidates: 30, closed: 30 });
    const third = await autoCloseIdleConversations(env, NOW);
    expect(third).toMatchObject({ candidates: 0, closed: 0 });
    expect((db.prepare('SELECT COUNT(*) AS n FROM activities').get() as { n: number }).n).toBe(total);
  });

  it('is disabled when AUTO_CLOSE_IDLE_DAYS = 0 and honours a longer override', async () => {
    const { db, env } = setup({ AUTO_CLOSE_IDLE_DAYS: '0' });
    answered(db, 'idle', 60 * DAY);
    expect(await autoCloseIdleConversations(env, NOW)).toEqual({ enabled: false, idleDays: 0, candidates: 0, closed: 0 });
    expect(statusOf(db, 'idle')).toBe('active');

    const longer = setup({ AUTO_CLOSE_IDLE_DAYS: '30' });
    answered(longer.db, 'a', 20 * DAY);
    answered(longer.db, 'b', 31 * DAY);
    await autoCloseIdleConversations(longer.env, NOW);
    expect(statusOf(longer.db, 'a')).toBe('active');
    expect(statusOf(longer.db, 'b')).toBe('closed');
  });

  it('does not close a conversation whose customer wrote after it was selected (guarded UPDATE)', async () => {
    const { db, env } = setup();
    answered(db, 'racy', 20 * DAY);
    // the select returns the row, then a customer message lands before the close statement runs
    const d1 = env.DB as unknown as { prepare: (q: string) => unknown };
    const realPrepare = d1.prepare.bind(d1);
    let raced = false;
    d1.prepare = (q: string) => {
      const stmt = realPrepare(q) as { bind: (...a: unknown[]) => { all: () => Promise<unknown> } };
      if (q.includes('ORDER BY last_customer_message_at')) {
        return {
          bind: (...a: unknown[]) => ({
            all: async () => {
              const result = await stmt.bind(...a).all();
              if (!raced) { raced = true; addMsg(db, 'racy', 'customer', ago(1000)); }
              return result;
            }
          })
        };
      }
      return stmt;
    };
    const result = await autoCloseIdleConversations(env, NOW);
    expect(result).toMatchObject({ candidates: 1, closed: 0 });
    expect(statusOf(db, 'racy')).toBe('active');
    expect(db.prepare('SELECT COUNT(*) AS n FROM activities').get()).toEqual({ n: 0 });
  });

  it('an inbound message after the auto-close starts a wait and the conversation reopens as before', async () => {
    const { db, env } = setup();
    answered(db, 'back', 20 * DAY, { team: 3 });
    await autoCloseIdleConversations(env, NOW);
    expect(statusOf(db, 'back')).toBe('closed');

    addMsg(db, 'back', 'customer', ago(60_000), { content: '請問還有貨嗎' });
    expect(awaitingOf(db, 'back')).toBe(ago(60_000));
    // the inbound path reopens a closed conversation (customer-conversation-lookup)
    const reopened = getReopenStatus('closed', true);
    expect(reopened).toBe('assigned');
    db.prepare("UPDATE conversations SET status = ?, closed_at = NULL WHERE id = 'back'").run(reopened);

    const waiting = await getWaitingConversations(d1Of(db), admin, 5, NOW);
    expect(waiting.items.map(i => i.conversationId)).toEqual(['back']);
    // and it is not picked up again
    expect((await autoCloseIdleConversations(env, NOW)).candidates).toBe(0);
  });

  it('selects through the partial index without scanning messages', () => {
    const { db } = setup();
    const plan = (db.prepare(`EXPLAIN QUERY PLAN
      SELECT id, status, assigned_team_id FROM conversations
      WHERE awaiting_since IS NULL AND status <> 'closed' AND deleted_at IS NULL
        AND last_customer_message_at <= ?
        AND (last_agent_message_at IS NULL OR last_agent_message_at <= ?)
      ORDER BY last_customer_message_at ASC LIMIT ?`).all('a', 'a', 200) as Array<{ detail: string }>).map(p => p.detail).join(' | ');
    expect(plan).toContain('idx_conversations_auto_close');
    expect(plan).not.toContain('USE TEMP B-TREE');
    expect(plan).not.toMatch(/SCAN messages/);
  });
});
