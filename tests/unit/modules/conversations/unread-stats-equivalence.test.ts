import type Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { fastUnreadAggregate, getUnreadAggregate, legacyUnreadAggregate } from '@/modules/conversations/services/unread-stats-service';
import { healMessageMarkers } from '@/modules/conversations/services/message-markers-service';
import { createDashboardDb, d1Of, readMigration, MIGRATION_MARKERS, addCustomer, addConv, addMsg } from '../../../helpers/sqlite-d1';

const NOW = Date.parse('2026-10-29T10:00:00.000Z');
const DAY = 24 * 3600_000;

function lcg(seed: number) {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
}

const iso = (ms: number) => new Date(ms).toISOString();

/** 428 conversations / 5,537 messages, 11 teams + pool, closed ones, deleted and system messages, floors, per-agent read state. */
function seed(db: Database.Database, rnd: () => number): void {
  for (let i = 1; i <= 428; i++) {
    addCustomer(db, i, i % 4 === 0 ? 'facebook' : 'line');
    addConv(db, `c${i}`, { customer: i, team: i % 12 === 0 ? null : (i % 11) + 1, status: i <= 14 ? 'closed' : 'active' });
    if (rnd() < 0.15) {
      db.prepare('UPDATE conversations SET unread_floor_at = ? WHERE id = ?').run(iso(NOW - Math.floor(rnd() * 150 * DAY)), `c${i}`);
    }
  }
  for (let i = 0; i < 5537; i++) {
    const r = rnd();
    const sender = r < 0.6 ? 'customer' : r < 0.9 ? 'agent' : 'system';
    addMsg(db, `c${1 + Math.floor(rnd() * 428)}`, sender, iso(NOW - Math.floor(rnd() * 200 * DAY)), {
      deleted: rnd() < 0.03 ? iso(NOW) : null,
    });
  }
  for (const agent of ['a1', 'a2', 'a3']) {
    for (let i = 1; i <= 428; i++) {
      const roll = rnd();
      if (roll < 0.5) {
        db.prepare('INSERT INTO conversation_read_states (agent_id, conversation_id, last_read_at, marked_unread_at) VALUES (?,?,?,?)').run(
          agent, `c${i}`,
          rnd() < 0.9 ? iso(NOW - Math.floor(rnd() * 200 * DAY)) : null,
          rnd() < 0.08 ? iso(NOW - Math.floor(rnd() * 5 * DAY)) : null
        );
      }
    }
  }
}

function mutate(db: Database.Database, rnd: () => number): void {
  for (let k = 0; k < 150; k++) {
    const conv = `c${1 + Math.floor(rnd() * 428)}`;
    const at = iso(NOW - Math.floor(rnd() * 3 * DAY));
    const r = rnd();
    if (r < 0.4) { addMsg(db, conv, 'customer', at); }
    else if (r < 0.6) { addMsg(db, conv, 'agent', at, { sent: rnd() < 0.8 ? 1 : 0 }); }
    else if (r < 0.7) { addMsg(db, conv, 'system', at); }
    else if (r < 0.85) {
      const row = db.prepare('SELECT id FROM messages WHERE conversation_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1').get(conv) as { id: string } | undefined;
      if (row) { db.prepare('UPDATE messages SET deleted_at = ? WHERE id = ?').run(iso(NOW), row.id); }
    } else if (r < 0.92) {
      const row = db.prepare('SELECT id FROM messages WHERE conversation_id = ? AND deleted_at IS NOT NULL LIMIT 1').get(conv) as { id: string } | undefined;
      if (row) { db.prepare('UPDATE messages SET deleted_at = NULL WHERE id = ?').run(row.id); }
    } else {
      db.prepare("UPDATE conversation_read_states SET last_read_at = ? WHERE conversation_id = ? AND agent_id = 'a1'").run(at, conv);
    }
  }
}

const users = [
  { id: 'admin-1', role: 'admin' as const, allowedTeamIds: [] as number[] },
  { id: 'a1', role: 'agent' as const, allowedTeamIds: [1, 2, 3] },
  { id: 'a2', role: 'agent' as const, allowedTeamIds: [7] },
  { id: 'a3', role: 'agent' as const, allowedTeamIds: [] as number[] },
  { id: 'a1', role: 'agent' as const, allowedTeamIds: [4, 5, 6, 8, 9, 10, 11] },
];

async function expectSame(db: Database.Database): Promise<void> {
  const d1 = d1Of(db);
  for (const user of users) {
    const expected = await legacyUnreadAggregate(d1, user);
    const actual = await fastUnreadAggregate(d1, user); // no fallback: the fast SQL itself must be equal
    expect(actual, `user ${user.id} teams ${user.allowedTeamIds.join(',')}`).toEqual(expected);
  }
}

describe('GET /conversations/stats unread aggregate: fast path equals the full query', () => {
  it.each([1, 2, 3])('randomized dataset (seed %i): backfill, then triggers after random writes, then nightly heal', async (seedValue) => {
    const rnd = lcg(seedValue * 7919);
    const db = createDashboardDb(); // history exists before migration 0071
    seed(db, rnd);
    db.exec(readMigration(MIGRATION_MARKERS));

    const sample = await legacyUnreadAggregate(d1Of(db), users[1]!);
    expect(Number(sample?.unreadCount)).toBeGreaterThan(0); // the comparison is not vacuous
    await expectSame(db); // columns came from the backfill

    mutate(db, rnd); // inserts, soft delete, undelete, read-state changes go through the triggers
    await expectSame(db);

    // the heal finds nothing to fix when the triggers kept the markers exact
    expect((await healMessageMarkers(d1Of(db), NOW)).corrected).toBe(0);
  });

  it('closed conversations count 0 and manual unread counts 1 even when the agent sent the last message', async () => {
    const db = createDashboardDb({ markers: true });
    addCustomer(db, 1);
    addConv(db, 'open');
    addConv(db, 'closed', { status: 'closed' });
    addMsg(db, 'open', 'customer', '2026-10-29T01:00:00.000Z');
    addMsg(db, 'open', 'agent', '2026-10-29T02:00:00.000Z');
    addMsg(db, 'closed', 'customer', '2026-10-29T01:00:00.000Z');
    db.prepare("INSERT INTO conversation_read_states VALUES ('a1','open',NULL,'2026-10-29T03:00:00.000Z')").run();
    db.prepare("INSERT INTO conversation_read_states VALUES ('a1','closed',NULL,'2026-10-29T03:00:00.000Z')").run();
    const user = { id: 'a1', role: 'agent' as const, allowedTeamIds: [] as number[] };
    const row = await getUnreadAggregate(d1Of(db), user);
    expect(Number(row?.unreadCount)).toBe(1);
    expect(Number(row?.unreadConversations)).toBe(1);
    expect(await fastUnreadAggregate(d1Of(db), user)).toEqual(await legacyUnreadAggregate(d1Of(db), user));
  });

  it('falls back to the full query when migration 0071 is not applied', async () => {
    const db = createDashboardDb();
    addCustomer(db, 1);
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', '2026-10-29T01:00:00.000Z');
    const user = { id: 'a1', role: 'admin' as const, allowedTeamIds: [] as number[] };
    expect(Number((await getUnreadAggregate(d1Of(db), user))?.unreadCount)).toBe(1);
  });

  it('the heal repairs markers that drifted (dropped trigger / direct SQL edit)', async () => {
    const db = createDashboardDb({ markers: true });
    addCustomer(db, 1);
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', '2026-10-29T01:00:00.000Z');
    db.prepare("UPDATE conversations SET last_customer_message_at = NULL WHERE id = 'c'").run();
    expect((await healMessageMarkers(d1Of(db), NOW)).corrected).toBe(1);
    expect((db.prepare("SELECT last_customer_message_at AS v FROM conversations WHERE id='c'").get() as { v: string }).v).toBe('2026-10-29T01:00:00.000Z');
  });

  it('the plan reads the partial covering indexes, not the messages table, to pick candidates', () => {
    const db = createDashboardDb({ markers: true });
    const plan = (db.prepare(`EXPLAIN QUERY PLAN
      SELECT c.id FROM conversations c
      WHERE c.last_customer_message_at > COALESCE(c.last_agent_message_at, '') AND c.status <> 'closed'`).all() as Array<{ detail: string }>)
      .map(p => p.detail).join(' | ');
    expect(plan).toContain('idx_conversations_customer_after_agent');
  });
});
