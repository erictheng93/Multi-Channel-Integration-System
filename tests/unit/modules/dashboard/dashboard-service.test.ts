import { readFileSync } from 'node:fs';
import { addConv, addCustomer, addMsg, createDashboardDb, d1Of } from '../../../helpers/sqlite-d1';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildDashboardSummary,
  buildMessageVolume,
  visibilityScopeKey,
} from '@/modules/dashboard/services/dashboard-service';
import { clampWaitingLimit, getWaitingConversations } from '@/modules/dashboard/services/waiting-service';
import { readThrough } from '@/modules/dashboard/services/kv-cache';
import {
  taipeiDateString,
  taipeiDayStartMs,
  taipeiWeekStartMs,
} from '@/utils/taipei-time';

// 2026-10-29 18:00 Taipei == 10:00 UTC. Taipei midnight today = 2026-10-28T16:00:00Z.
const NOW = Date.parse('2026-10-29T10:00:00.000Z');

const admin = { role: 'admin' as const, allowedTeamIds: [] as number[] };
const agentOfTeam = (...ids: number[]) => ({ role: 'agent' as const, allowedTeamIds: ids });

// Schema = base tables + the real migration 0070 (awaiting_since column, index, triggers)
const createDb = () => createDashboardDb({ awaiting: true });
let seq = 0;

describe('taipei-time', () => {
  it('finds Taipei midnight as a UTC instant', () => {
    expect(new Date(taipeiDayStartMs(NOW)).toISOString()).toBe('2026-10-28T16:00:00.000Z');
    // 15:59:59Z is still Taipei Oct 28 23:59:59
    expect(new Date(taipeiDayStartMs(Date.parse('2026-10-28T15:59:59.999Z'))).toISOString()).toBe('2026-10-27T16:00:00.000Z');
    // exactly at the boundary the new day starts
    expect(new Date(taipeiDayStartMs(Date.parse('2026-10-28T16:00:00.000Z'))).toISOString()).toBe('2026-10-28T16:00:00.000Z');
  });

  it('formats the Taipei calendar date and week start (Monday)', () => {
    expect(taipeiDateString(Date.parse('2026-10-28T16:00:00Z'))).toBe('2026-10-29');
    expect(taipeiDateString(Date.parse('2026-10-28T15:59:59Z'))).toBe('2026-10-28');
    // 2026-10-29 is a Thursday; Monday is 10-26 00:00 Taipei = 10-25T16:00Z
    expect(new Date(taipeiWeekStartMs(NOW)).toISOString()).toBe('2026-10-25T16:00:00.000Z');
    // Sunday 10-25 18:00 Taipei still belongs to the week starting Monday 10-19
    expect(new Date(taipeiWeekStartMs(Date.parse('2026-10-25T10:00:00Z'))).toISOString()).toBe('2026-10-18T16:00:00.000Z');
  });
});

describe('waiting conversations', () => {
  it('lists open conversations whose latest human-relevant message is the customer, oldest wait first', async () => {
    const db = createDb();
    addCustomer(db, 1);
    addCustomer(db, 2, 'facebook');
    addConv(db, 'waits-long', { customer: 1 });
    addConv(db, 'waits-short', { customer: 2 });
    addConv(db, 'answered', { customer: 1 });
    addConv(db, 'closed', { customer: 1, status: 'closed' });

    // waits-long: agent replied, then customer wrote twice -> wait starts at the FIRST message after the reply
    addMsg(db, 'waits-long', 'customer', '2026-10-29T06:00:00.000Z');
    addMsg(db, 'waits-long', 'agent', '2026-10-29T06:10:00.000Z');
    addMsg(db, 'waits-long', 'customer', '2026-10-29T07:00:00.000Z', { content: 'first unanswered' });
    addMsg(db, 'waits-long', 'customer', '2026-10-29T08:00:00.000Z', { content: 'second unanswered' });
    addMsg(db, 'waits-short', 'customer', '2026-10-29T09:30:00.000Z');
    addMsg(db, 'answered', 'customer', '2026-10-29T05:00:00.000Z');
    addMsg(db, 'answered', 'agent', '2026-10-29T05:05:00.000Z');
    addMsg(db, 'closed', 'customer', '2026-10-01T05:00:00.000Z');

    const result = await getWaitingConversations(d1Of(db), admin, 5, NOW);

    expect(result.total).toBe(2);
    expect(result.items.map(i => i.conversationId)).toEqual(['waits-long', 'waits-short']);
    const first = result.items[0]!;
    expect(first.waitingSince).toBe('2026-10-29T07:00:00.000Z');
    expect(first.waitingSeconds).toBe(3 * 3600);
    expect(first.unansweredCount).toBe(2);
    expect(first.lastCustomerMessage).toBe('second unanswered');
    expect(first.platform).toBe('line');
    expect(result.items[1]!.platform).toBe('facebook');
  });

  it('does not let auto-reply, broadcast, recalled or deleted agent messages end a wait', async () => {
    const db = createDb();
    addCustomer(db, 1);
    addConv(db, 'auto');
    addMsg(db, 'auto', 'customer', '2026-10-29T08:00:00.000Z');
    addMsg(db, 'auto', 'system', '2026-10-29T08:00:05.000Z'); // auto-reply
    addConv(db, 'broadcast');
    addMsg(db, 'broadcast', 'customer', '2026-10-29T08:00:00.000Z');
    addMsg(db, 'broadcast', 'agent', '2026-10-29T08:30:00.000Z', { metadata: '{"broadcastId":"b1"}' });
    addConv(db, 'recalled');
    addMsg(db, 'recalled', 'customer', '2026-10-29T08:00:00.000Z');
    addMsg(db, 'recalled', 'agent', '2026-10-29T08:30:00.000Z', { recalled: 1 });
    addConv(db, 'deleted');
    addMsg(db, 'deleted', 'customer', '2026-10-29T08:00:00.000Z');
    addMsg(db, 'deleted', 'agent', '2026-10-29T08:30:00.000Z', { deleted: '2026-10-29T09:00:00.000Z' });

    const result = await getWaitingConversations(d1Of(db), admin, 10, NOW);

    expect(result.total).toBe(4);
    expect(result.items.every(i => i.waitingSince === '2026-10-29T08:00:00.000Z')).toBe(true);
  });

  it('is scoped to the visible conversations and reports the true total beyond the page limit', async () => {
    const db = createDb();
    addCustomer(db, 1);
    addConv(db, 'mine', { team: 7 });
    addConv(db, 'pool', { team: null });
    addConv(db, 'theirs', { team: 9 });
    for (const [i, id] of ['mine', 'pool', 'theirs'].entries()) {
      addMsg(db, id, 'customer', `2026-10-29T0${i + 1}:00:00.000Z`);
    }

    const agent = await getWaitingConversations(d1Of(db), agentOfTeam(7), 1, NOW);
    expect(agent.total).toBe(2); // theirs is invisible
    expect(agent.items).toHaveLength(1);
    expect(agent.items[0]!.conversationId).toBe('mine');

    const noTeam = await getWaitingConversations(d1Of(db), agentOfTeam(), 5, NOW);
    expect(noTeam.items.map(i => i.conversationId)).toEqual(['pool']);

    const all = await getWaitingConversations(d1Of(db), admin, 5, NOW);
    expect(all.total).toBe(3);
  });

  it('returns an empty result when nothing waits', async () => {
    const result = await getWaitingConversations(d1Of(createDb()), admin, 5, NOW);
    expect(result).toEqual({ total: 0, items: [] });
  });

  it('clamps the page size', () => {
    expect(clampWaitingLimit(undefined)).toBe(5);
    expect(clampWaitingLimit(Number.NaN)).toBe(5);
    expect(clampWaitingLimit(0)).toBe(5);
    expect(clampWaitingLimit(3)).toBe(3);
    expect(clampWaitingLimit(9999)).toBe(50);
  });
});

describe('dashboard summary (Asia/Taipei)', () => {
  it('splits customer messages at Taipei midnight and compares with yesterday at the same time', async () => {
    const db = createDb();
    addCustomer(db, 1);
    addConv(db, 'c1');
    // today (>= 2026-10-28T16:00Z): 3, one of them in the future of "now" is excluded
    addMsg(db, 'c1', 'customer', '2026-10-28T16:00:00.000Z'); // exactly Taipei midnight -> today
    addMsg(db, 'c1', 'customer', '2026-10-29T03:00:00.000Z');
    addMsg(db, 'c1', 'customer', '2026-10-29T09:59:59.000Z');
    addMsg(db, 'c1', 'customer', '2026-10-29T10:00:01.000Z'); // after now
    // yesterday, before the same elapsed time (< 2026-10-28T10:00Z): 2
    addMsg(db, 'c1', 'customer', '2026-10-27T16:00:00.000Z');
    addMsg(db, 'c1', 'customer', '2026-10-28T09:59:59.000Z');
    // yesterday but later than the same time of day: not in "same time", not today
    addMsg(db, 'c1', 'customer', '2026-10-28T12:00:00.000Z');
    // one second before Taipei midnight: yesterday late, not today
    addMsg(db, 'c1', 'customer', '2026-10-28T15:59:59.000Z');
    // not counted: agent, system, soft-deleted
    addMsg(db, 'c1', 'agent', '2026-10-29T04:00:00.000Z');
    addMsg(db, 'c1', 'system', '2026-10-29T04:00:00.000Z');
    addMsg(db, 'c1', 'customer', '2026-10-29T04:00:00.000Z', { deleted: '2026-10-29T05:00:00.000Z' });

    const summary = await buildDashboardSummary(d1Of(db), admin, NOW);

    expect(summary.timezone).toBe('Asia/Taipei');
    expect(summary.dayStart).toBe('2026-10-28T16:00:00.000Z');
    expect(summary.customerMessages).toEqual({ today: 3, yesterdaySameTime: 2 });
  });

  it('counts conversations resolved today vs yesterday-same-time and open conversations, scoped', async () => {
    const db = createDb();
    addCustomer(db, 1);
    addConv(db, 'r-today-1', { status: 'closed', closedAt: '2026-10-28T16:00:00.000Z' });
    addConv(db, 'r-today-2', { status: 'closed', closedAt: '2026-10-29T08:00:00.000Z', team: 7 });
    addConv(db, 'r-today-other-team', { status: 'closed', closedAt: '2026-10-29T08:00:00.000Z', team: 9 });
    addConv(db, 'r-yest-early', { status: 'closed', closedAt: '2026-10-28T02:00:00.000Z' });
    addConv(db, 'r-yest-late', { status: 'closed', closedAt: '2026-10-28T12:00:00.000Z' });
    addConv(db, 'reopened', { status: 'active', closedAt: '2026-10-29T01:00:00.000Z' }); // no longer closed
    addConv(db, 'open-1');
    addConv(db, 'open-2', { team: 7 });
    addConv(db, 'open-3', { team: 9 });

    const asAdmin = await buildDashboardSummary(d1Of(db), admin, NOW);
    expect(asAdmin.resolved).toEqual({ today: 3, yesterdaySameTime: 1 });
    expect(asAdmin.openConversations).toBe(4); // reopened + 3 open

    const asAgent = await buildDashboardSummary(d1Of(db), agentOfTeam(7), NOW);
    expect(asAgent.resolved).toEqual({ today: 2, yesterdaySameTime: 1 });
    expect(asAgent.openConversations).toBe(3); // reopened, open-1 (pool), open-2
  });

  it('averages first response only over conversations created in the window, like with like', async () => {
    const db = createDb();
    addCustomer(db, 1);
    // created today, answered after 60 s and 120 s -> avg 90 s
    addConv(db, 't1', { createdAt: '2026-10-29T01:00:00.000Z', firstResponseAt: '2026-10-29T01:01:00.000Z' });
    addConv(db, 't2', { createdAt: '2026-10-29T02:00:00.000Z', firstResponseAt: '2026-10-29T02:02:00.000Z' });
    addConv(db, 't-unanswered', { createdAt: '2026-10-29T03:00:00.000Z' });
    // created yesterday morning, answered 300 s later (before the same time yesterday) -> counts
    addConv(db, 'y1', { createdAt: '2026-10-28T01:00:00.000Z', firstResponseAt: '2026-10-28T01:05:00.000Z' });
    // created yesterday morning but only answered in the evening (after the cut-off) -> not yet answered "at this time"
    addConv(db, 'y-late', { createdAt: '2026-10-28T02:00:00.000Z', firstResponseAt: '2026-10-28T14:00:00.000Z' });
    // created long ago: its first response today does not belong to today's new conversations
    addConv(db, 'old', { createdAt: '2026-09-01T00:00:00.000Z', firstResponseAt: '2026-10-29T04:00:00.000Z' });

    const summary = await buildDashboardSummary(d1Of(db), admin, NOW);

    expect(summary.firstResponse.today).toEqual({ count: 2, avgSeconds: 90 });
    expect(summary.firstResponse.yesterdaySameTime).toEqual({ count: 1, avgSeconds: 300 });
  });

  it('has an honest empty state', async () => {
    const summary = await buildDashboardSummary(d1Of(createDb()), agentOfTeam(), NOW);

    expect(summary.customerMessages).toEqual({ today: 0, yesterdaySameTime: 0 });
    expect(summary.resolved).toEqual({ today: 0, yesterdaySameTime: 0 });
    expect(summary.openConversations).toBe(0);
    expect(summary.waiting).toEqual({ count: 0, oldestWaitingSince: null, oldestWaitingSeconds: null, top: [] });
    expect(summary.firstResponse.today).toEqual({ count: 0, avgSeconds: null });
    expect(summary.firstResponse.yesterdaySameTime).toEqual({ count: 0, avgSeconds: null });
  });

  it('reports waiting count, the oldest wait and the top five', async () => {
    const db = createDb();
    addCustomer(db, 1);
    for (let i = 0; i < 7; i++) {
      addConv(db, `w${i}`);
      addMsg(db, `w${i}`, 'customer', `2026-10-29T0${i}:30:00.000Z`);
    }

    const summary = await buildDashboardSummary(d1Of(db), admin, NOW);

    expect(summary.waiting.count).toBe(7);
    expect(summary.waiting.top).toHaveLength(5);
    expect(summary.waiting.oldestWaitingSince).toBe('2026-10-29T00:30:00.000Z');
    expect(summary.waiting.oldestWaitingSeconds).toBe(9.5 * 3600);
  });
});

describe('message volume (day x platform)', () => {
  it('buckets by Taipei day and platform, zero-fills, and returns the prior period', async () => {
    const db = createDb();
    addCustomer(db, 1, 'line');
    addCustomer(db, 2, 'facebook');
    addConv(db, 'line-c', { customer: 1 });
    addConv(db, 'fb-c', { customer: 2 });
    // Taipei Oct 29 (today): 2 line, 1 fb
    addMsg(db, 'line-c', 'customer', '2026-10-28T16:00:00.000Z');
    addMsg(db, 'line-c', 'customer', '2026-10-29T05:00:00.000Z');
    addMsg(db, 'fb-c', 'customer', '2026-10-29T06:00:00.000Z');
    // 15:59:59Z is Taipei Oct 28 23:59:59 -> yesterday's bucket, not today's
    addMsg(db, 'line-c', 'customer', '2026-10-28T15:59:59.000Z');
    // 7 days back = Taipei Oct 22 is in the prior 7-day period (Oct 16..22)
    addMsg(db, 'fb-c', 'customer', '2026-10-22T03:00:00.000Z');
    // outside both periods and non-customer senders are ignored
    addMsg(db, 'line-c', 'customer', '2026-10-01T03:00:00.000Z');
    addMsg(db, 'line-c', 'agent', '2026-10-29T05:00:00.000Z');

    const volume = await buildMessageVolume(d1Of(db), admin, 7, NOW);

    expect(volume.days).toBe(7);
    expect(volume.current).toHaveLength(7);
    expect(volume.previous).toHaveLength(7);
    expect(volume.current.map(d => d.date)).toEqual([
      '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29',
    ]);
    expect(volume.previous[0]!.date).toBe('2026-10-16');
    expect(volume.previous[6]!.date).toBe('2026-10-22');

    const today = volume.current[6]!;
    expect(today).toEqual({ date: '2026-10-29', line: 2, facebook: 1, other: 0, total: 3 });
    expect(volume.current[5]).toEqual({ date: '2026-10-28', line: 1, facebook: 0, other: 0, total: 1 });
    expect(volume.current[0]!.total).toBe(0);
    expect(volume.previous[6]).toEqual({ date: '2026-10-22', line: 0, facebook: 1, other: 0, total: 1 });
    expect(volume.totals).toEqual({ current: 4, previous: 1 });
  });

  it('respects visibility scope and supports 30 and 90 day windows', async () => {
    const db = createDb();
    addCustomer(db, 1, 'line');
    addConv(db, 'mine', { team: 7 });
    addConv(db, 'theirs', { team: 9 });
    addMsg(db, 'mine', 'customer', '2026-10-29T05:00:00.000Z');
    addMsg(db, 'theirs', 'customer', '2026-10-29T05:00:00.000Z');

    const agent = await buildMessageVolume(d1Of(db), agentOfTeam(7), 30, NOW);
    expect(agent.current).toHaveLength(30);
    expect(agent.totals.current).toBe(1);

    const all = await buildMessageVolume(d1Of(db), admin, 90, NOW);
    expect(all.current).toHaveLength(90);
    expect(all.previous).toHaveLength(90);
    expect(all.totals.current).toBe(2);
  });

  it('is all zeros on an empty database', async () => {
    const volume = await buildMessageVolume(d1Of(createDb()), admin, 7, NOW);
    expect(volume.totals).toEqual({ current: 0, previous: 0 });
    expect(volume.current.every(d => d.total === 0)).toBe(true);
  });
});

describe('visibility scope key and KV read-through', () => {
  it('keys admins together and agents by their sorted team set', () => {
    expect(visibilityScopeKey(admin)).toBe('all');
    expect(visibilityScopeKey(agentOfTeam(9, 7, 7))).toBe('teams:7,9');
    expect(visibilityScopeKey(agentOfTeam())).toBe('teams:none');
  });

  it('computes once, serves the cached value, and survives a broken KV', async () => {
    const store = new Map<string, string>();
    const kv = {
      get: async (key: string) => (store.has(key) ? JSON.parse(store.get(key)!) : null),
      put: async (key: string, value: string) => { store.set(key, value); },
    } as unknown as KVNamespace;
    let calls = 0;
    const compute = async () => ({ n: ++calls });

    expect(await readThrough(kv, 'k', 60, compute)).toEqual({ n: 1 });
    expect(await readThrough(kv, 'k', 60, compute)).toEqual({ n: 1 });
    expect(calls).toBe(1);

    const broken = {
      get: async () => { throw new Error('kv down'); },
      put: async () => { throw new Error('kv down'); },
    } as unknown as KVNamespace;
    expect(await readThrough(broken, 'k', 60, compute)).toEqual({ n: 2 });
    expect(await readThrough(undefined, 'k', 60, compute)).toEqual({ n: 3 });
  });
});

describe('migrations 0066 / 0067', () => {
  const sql = (name: string) => readFileSync(resolve(__dirname, '../../../../migrations', name), 'utf8');

  it('0066 creates the (sender_type, created_at) index and the planner uses it for a day range', () => {
    const db = createDb();
    db.exec(sql('0066_add_messages_sender_type_created_at_index.sql'));
    db.exec(sql('0066_add_messages_sender_type_created_at_index.sql')); // idempotent

    const plan = db.prepare(
      "EXPLAIN QUERY PLAN SELECT COUNT(*) FROM messages WHERE sender_type = 'customer' AND created_at >= ? AND created_at < ?"
    ).all('a', 'b') as Array<{ detail: string }>;
    expect(plan.map(p => p.detail).join(' ')).toContain('idx_messages_sender_type_created_at');
  });

  it('0067 backfills first_response_at from the first real human reply only', () => {
    const db = createDb();
    addCustomer(db, 1);
    const reply = (conv: string, at: string, over: Partial<{ sender: string; metadata: string | null; recalled: number; sent: number; status: string; deleted: string | null }> = {}) =>
      db.prepare(
        'INSERT INTO messages (id, conversation_id, sender_type, metadata, is_recalled, is_sent, delivery_status, deleted_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
      ).run(`b${++seq}`, conv, over.sender ?? 'agent', over.metadata ?? null, over.recalled ?? 0, over.sent ?? 1, over.status ?? 'sent', over.deleted ?? null, at);

    addConv(db, 'human');
    reply('human', '2026-10-02T00:00:00.000Z', { sender: 'system' });                      // auto-reply: skip
    reply('human', '2026-10-02T00:01:00.000Z', { metadata: '{"broadcastId":"b"}' });       // broadcast: skip
    reply('human', '2026-10-02T00:02:00.000Z', { recalled: 1 });                            // recalled: skip
    reply('human', '2026-10-02T00:03:00.000Z', { status: 'failed', sent: 0 });              // failed: skip
    reply('human', '2026-10-02T00:04:00.000Z', { deleted: '2026-10-03T00:00:00.000Z' });    // deleted: skip
    reply('human', '2026-10-02T00:05:00.000Z');                                             // first real reply
    reply('human', '2026-10-02T00:09:00.000Z');
    addConv(db, 'auto-only');
    reply('auto-only', '2026-10-02T00:00:00.000Z', { sender: 'system' });
    addConv(db, 'untouched');
    addConv(db, 'already', { firstResponseAt: '2026-01-01T00:00:00.000Z' });
    reply('already', '2026-10-02T00:05:00.000Z');

    db.exec(sql('0067_backfill_conversation_first_response_at.sql'));
    db.exec(sql('0067_backfill_conversation_first_response_at.sql')); // idempotent

    const first = (id: string) =>
      (db.prepare('SELECT first_response_at AS v FROM conversations WHERE id = ?').get(id) as { v: string | null }).v;
    expect(first('human')).toBe('2026-10-02T00:05:00.000Z');
    expect(first('auto-only')).toBeNull();
    expect(first('untouched')).toBeNull();
    expect(first('already')).toBe('2026-01-01T00:00:00.000Z');
  });
});
