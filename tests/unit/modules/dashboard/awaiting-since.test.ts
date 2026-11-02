import type Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { healAwaitingSince } from '@/modules/dashboard/services/awaiting-service';
import { getWaitingConversations } from '@/modules/dashboard/services/waiting-service';
import {
  MIGRATION_AWAITING,
  addConv,
  addCustomer,
  addMsg,
  awaitingOf,
  createDashboardDb,
  d1Of,
  readMigration,
} from '../../../helpers/sqlite-d1';

const NOW = Date.parse('2026-10-29T10:00:00.000Z');
const admin = { role: 'admin' as const, allowedTeamIds: [] as number[] };
const agentOfTeam = (...ids: number[]) => ({ role: 'agent' as const, allowedTeamIds: ids });

function freshDb(): Database.Database {
  const db = createDashboardDb({ awaiting: true });
  addCustomer(db, 1);
  return db;
}

describe('awaiting_since triggers: customer inbound', () => {
  it('is set to the first customer message and not moved by later ones', () => {
    const db = freshDb();
    addConv(db, 'c');
    expect(awaitingOf(db, 'c')).toBeNull();
    addMsg(db, 'c', 'customer', '2026-10-29T01:00:00.000Z');
    addMsg(db, 'c', 'customer', '2026-10-29T02:00:00.000Z');
    expect(awaitingOf(db, 'c')).toBe('2026-10-29T01:00:00.000Z');
  });

  it('is not set by a soft-deleted customer message, an agent message or a system message', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', '2026-10-29T01:00:00.000Z', { deleted: '2026-10-29T01:05:00.000Z' });
    addMsg(db, 'c', 'agent', '2026-10-29T01:10:00.000Z');
    addMsg(db, 'c', 'system', '2026-10-29T01:11:00.000Z');
    expect(awaitingOf(db, 'c')).toBeNull();
  });

  it('starts a new wait after an answered one', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', '2026-10-29T01:00:00.000Z');
    addMsg(db, 'c', 'agent', '2026-10-29T01:05:00.000Z');
    expect(awaitingOf(db, 'c')).toBeNull();
    addMsg(db, 'c', 'customer', '2026-10-29T03:00:00.000Z');
    expect(awaitingOf(db, 'c')).toBe('2026-10-29T03:00:00.000Z');
  });
});

describe('awaiting_since triggers: what clears the wait', () => {
  const waiting = (db: Database.Database, id = 'c') => {
    addConv(db, id);
    addMsg(db, id, 'customer', '2026-10-29T01:00:00.000Z');
    expect(awaitingOf(db, id)).toBe('2026-10-29T01:00:00.000Z');
  };

  it('an accepted human reply (immediate send path: inserted with is_sent = 1) clears it', () => {
    const db = freshDb();
    waiting(db);
    addMsg(db, 'c', 'agent', '2026-10-29T01:05:00.000Z', { sent: 1 });
    expect(awaitingOf(db, 'c')).toBeNull();
  });

  it('a recall-window reply (inserted unsent) clears it only when delivery flips is_sent to 1', () => {
    const db = freshDb();
    waiting(db);
    const id = addMsg(db, 'c', 'agent', '2026-10-29T01:05:00.000Z', { sent: 0 });
    expect(awaitingOf(db, 'c')).toBe('2026-10-29T01:00:00.000Z');
    db.prepare('UPDATE messages SET is_sent = 1, delivery_status = ? WHERE id = ?').run('sent', id);
    expect(awaitingOf(db, 'c')).toBeNull();
  });

  it('a failed send (never accepted) does not clear it', () => {
    const db = freshDb();
    waiting(db);
    addMsg(db, 'c', 'agent', '2026-10-29T01:05:00.000Z', { sent: 0 });
    expect(awaitingOf(db, 'c')).toBe('2026-10-29T01:00:00.000Z');
  });

  it('auto-reply (system), broadcast and a recalled-on-insert agent message do NOT clear it', () => {
    const db = freshDb();
    waiting(db);
    addMsg(db, 'c', 'system', '2026-10-29T01:01:00.000Z');
    addMsg(db, 'c', 'agent', '2026-10-29T01:02:00.000Z', { metadata: '{"broadcastId":"b1"}' });
    addMsg(db, 'c', 'agent', '2026-10-29T01:03:00.000Z', { recalled: 1 });
    addMsg(db, 'c', 'agent', '2026-10-29T01:04:00.000Z', { deleted: '2026-10-29T02:00:00.000Z' });
    expect(awaitingOf(db, 'c')).toBe('2026-10-29T01:00:00.000Z');
  });

  it('delivering a held reply does not clear a customer message that arrived after the reply was composed', () => {
    const db = freshDb();
    waiting(db);
    const held = addMsg(db, 'c', 'agent', '2026-10-29T01:05:00.000Z', { sent: 0 });
    addMsg(db, 'c', 'customer', '2026-10-29T01:06:00.000Z');
    db.prepare('UPDATE messages SET is_sent = 1 WHERE id = ?').run(held);
    // the 01:00 message is answered, the 01:06 one is not
    expect(awaitingOf(db, 'c')).toBe('2026-10-29T01:06:00.000Z');
  });

  it('a reply older than the current wait leaves it alone', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', '2026-10-29T02:00:00.000Z');
    addMsg(db, 'c', 'agent', '2026-10-29T01:00:00.000Z'); // composed before the wait started
    expect(awaitingOf(db, 'c')).toBe('2026-10-29T02:00:00.000Z');
  });

  it('recalling the reply that ended a wait restores it; deleting the customer message that started it moves it', () => {
    const db = freshDb();
    addConv(db, 'c');
    const first = addMsg(db, 'c', 'customer', '2026-10-29T01:00:00.000Z');
    const reply = addMsg(db, 'c', 'agent', '2026-10-29T01:05:00.000Z');
    addMsg(db, 'c', 'customer', '2026-10-29T02:00:00.000Z');
    expect(awaitingOf(db, 'c')).toBe('2026-10-29T02:00:00.000Z');

    db.prepare('UPDATE messages SET is_recalled = 1 WHERE id = ?').run(reply);
    expect(awaitingOf(db, 'c')).toBe('2026-10-29T01:00:00.000Z');

    db.prepare('UPDATE messages SET deleted_at = ? WHERE id = ?').run('2026-10-29T03:00:00.000Z', first);
    expect(awaitingOf(db, 'c')).toBe('2026-10-29T02:00:00.000Z');
  });

  it('only touches its own conversation', () => {
    const db = freshDb();
    waiting(db, 'a');
    waiting(db, 'b');
    addMsg(db, 'a', 'agent', '2026-10-29T01:05:00.000Z');
    expect(awaitingOf(db, 'a')).toBeNull();
    expect(awaitingOf(db, 'b')).toBe('2026-10-29T01:00:00.000Z');
  });
});

describe('migration 0070 backfill is equivalent to the previous waiting definition', () => {
  /** The pre-0070 waiting query, kept verbatim as the oracle (list of [conversationId, waitingSince]). */
  function legacyWaiting(db: Database.Database): Array<[string, string]> {
    const rows = db.prepare(`
      WITH vis AS (
        SELECT c.id AS id FROM conversations c WHERE c.status <> 'closed' AND c.deleted_at IS NULL
      ),
      last_agent AS (
        SELECT m.conversation_id AS conversation_id, MAX(m.created_at) AS at
        FROM messages m INNER JOIN vis ON vis.id = m.conversation_id
        WHERE m.sender_type = 'agent' AND m.deleted_at IS NULL AND COALESCE(m.is_recalled, 0) = 0
          AND (m.metadata IS NULL OR m.metadata NOT LIKE '%"broadcastId"%')
        GROUP BY m.conversation_id
      )
      SELECT vis.id AS id, MIN(cm.created_at) AS since
      FROM vis
      LEFT JOIN last_agent la ON la.conversation_id = vis.id
      INNER JOIN messages cm ON cm.conversation_id = vis.id AND cm.sender_type = 'customer'
        AND cm.deleted_at IS NULL AND cm.created_at > COALESCE(la.at, '')
      GROUP BY vis.id ORDER BY vis.id
    `).all() as Array<{ id: string; since: string }>;
    return rows.map(r => [r.id, r.since]);
  }

  it('produces the same waiting set and wait start on a mixed dataset (all replies sent)', () => {
    const db = createDashboardDb(); // pre-0070 database with history
    addCustomer(db, 1);
    let state = 7;
    const rnd = () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648; };
    for (let i = 0; i < 60; i++) {
      addConv(db, `c${i}`, { status: i % 9 === 0 ? 'closed' : 'active' });
      const n = 1 + Math.floor(rnd() * 8);
      for (let k = 0; k < n; k++) {
        const at = new Date(Date.parse('2026-10-01T00:00:00.000Z') + (k * 3600_000) + i * 60_000).toISOString();
        const roll = rnd();
        if (roll < 0.5) { addMsg(db, `c${i}`, 'customer', at, { deleted: rnd() < 0.1 ? at : null }); }
        else if (roll < 0.75) { addMsg(db, `c${i}`, 'agent', at); }
        else if (roll < 0.82) { addMsg(db, `c${i}`, 'agent', at, { metadata: '{"broadcastId":"b"}' }); }
        else if (roll < 0.9) { addMsg(db, `c${i}`, 'agent', at, { recalled: 1 }); }
        else if (roll < 0.95) { addMsg(db, `c${i}`, 'agent', at, { deleted: at }); }
        else { addMsg(db, `c${i}`, 'system', at); }
      }
    }
    const expected = legacyWaiting(db);
    expect(expected.length).toBeGreaterThan(5);

    db.exec(readMigration(MIGRATION_AWAITING));
    db.exec('DROP TRIGGER trg_messages_awaiting_customer'); // no writes below; keeps the check about the backfill only
    const actual = (db.prepare(
      "SELECT id, awaiting_since AS since FROM conversations WHERE awaiting_since IS NOT NULL AND status <> 'closed' ORDER BY id"
    ).all() as Array<{ id: string; since: string }>).map(r => [r.id, r.since] as [string, string]);
    expect(actual).toEqual(expected);
  });

  it('treats a failed (unsent) agent message as NOT answering, unlike the old query', () => {
    const db = createDashboardDb();
    addCustomer(db, 1);
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', '2026-10-29T01:00:00.000Z');
    addMsg(db, 'c', 'agent', '2026-10-29T01:05:00.000Z', { sent: 0 });
    db.exec(readMigration(MIGRATION_AWAITING));
    expect(awaitingOf(db, 'c')).toBe('2026-10-29T01:00:00.000Z');
  });

  it('is safe to re-run the trigger/index parts (IF NOT EXISTS) after the column exists', () => {
    const db = createDashboardDb({ awaiting: true });
    const statements = readMigration(MIGRATION_AWAITING).split(/;\s*\n(?=CREATE |UPDATE |ALTER )/);
    const idempotent = statements.filter(s => !s.startsWith('ALTER') && !s.includes('ALTER TABLE'));
    expect(() => db.exec(idempotent.join(';\n'))).not.toThrow();
  });
});

describe('waiting query reads the stored marker', () => {
  it('lists waiting conversations oldest first with unanswered count and latest customer message', async () => {
    const db = freshDb();
    addConv(db, 'late');
    addConv(db, 'early');
    addMsg(db, 'late', 'customer', '2026-10-29T08:00:00.000Z', { content: 'late one' });
    addMsg(db, 'early', 'customer', '2026-10-29T06:00:00.000Z', { content: 'first' });
    addMsg(db, 'early', 'customer', '2026-10-29T07:00:00.000Z', { content: 'second' });
    const result = await getWaitingConversations(d1Of(db), admin, 5, NOW);
    expect(result.total).toBe(2);
    expect(result.items.map(i => i.conversationId)).toEqual(['early', 'late']);
    expect(result.items[0]).toMatchObject({ unansweredCount: 2, lastCustomerMessage: 'second', waitingSeconds: 4 * 3600 });
  });

  it('excludes closed conversations and respects visibility; total counts beyond the page', async () => {
    const db = freshDb();
    addConv(db, 'closed', { status: 'closed' });
    addConv(db, 'mine', { team: 7 });
    addConv(db, 'pool');
    addConv(db, 'theirs', { team: 9 });
    ['closed', 'mine', 'pool', 'theirs'].forEach((c, i) => addMsg(db, c, 'customer', `2026-10-29T0${i + 1}:00:00.000Z`));
    expect((await getWaitingConversations(d1Of(db), admin, 1, NOW)).total).toBe(3);
    const agent = await getWaitingConversations(d1Of(db), agentOfTeam(7), 5, NOW);
    expect(agent.items.map(i => i.conversationId)).toEqual(['mine', 'pool']);
  });

  it('touches only waiting rows: the plan uses the partial index and never scans messages for the list', () => {
    const db = freshDb();
    const plan = (db.prepare(`EXPLAIN QUERY PLAN
      SELECT c.id FROM conversations c
      WHERE c.awaiting_since IS NOT NULL AND c.status <> 'closed' AND c.deleted_at IS NULL
      ORDER BY c.awaiting_since ASC, c.id ASC LIMIT 5`).all() as Array<{ detail: string }>).map(p => p.detail).join(' | ');
    expect(plan).toContain('idx_conversations_awaiting_since');
    expect(plan).not.toMatch(/SCAN c(?!\s+USING)/);
    expect(plan).not.toContain('USE TEMP B-TREE');

    const count = (db.prepare(`EXPLAIN QUERY PLAN
      SELECT COUNT(*) FROM conversations c2
      WHERE c2.awaiting_since IS NOT NULL AND c2.status <> 'closed' AND c2.deleted_at IS NULL`).all() as Array<{ detail: string }>)
      .map(p => p.detail).join(' | ');
    expect(count).toContain('COVERING INDEX idx_conversations_awaiting_since');

    const sub = (db.prepare(`EXPLAIN QUERY PLAN
      SELECT COUNT(*) FROM messages cm WHERE cm.conversation_id = ? AND cm.sender_type = 'customer'
        AND cm.deleted_at IS NULL AND cm.created_at >= ?`).all('x', 'y') as Array<{ detail: string }>).map(p => p.detail).join(' | ');
    expect(sub).toContain('idx_messages_conv_sender_deleted_created');
  });
});

describe('healAwaitingSince (nightly)', () => {
  it('rewrites only markers that disagree with the messages, bounded to recent or marked open conversations', async () => {
    const db = freshDb();
    addConv(db, 'ok');
    addMsg(db, 'ok', 'customer', '2026-10-29T01:00:00.000Z');
    addConv(db, 'stale'); // marker set but the wait is actually over
    addMsg(db, 'stale', 'customer', '2026-10-29T01:00:00.000Z');
    addMsg(db, 'stale', 'agent', '2026-10-29T01:05:00.000Z');
    addConv(db, 'missed'); // marker lost (e.g. dropped trigger) but a customer message is unanswered
    addMsg(db, 'missed', 'customer', '2026-10-29T02:00:00.000Z');
    addConv(db, 'old-missed'); // old and unmarked: outside the heal window, left alone
    addMsg(db, 'old-missed', 'customer', '2026-09-01T02:00:00.000Z');
    addConv(db, 'closed', { status: 'closed' });
    addMsg(db, 'closed', 'customer', '2026-10-29T02:00:00.000Z');

    db.prepare("UPDATE conversations SET awaiting_since = '2026-10-29T01:00:00.000Z' WHERE id = 'stale'").run();
    db.prepare("UPDATE conversations SET awaiting_since = NULL WHERE id IN ('missed', 'old-missed', 'closed')").run();

    const result = await healAwaitingSince(d1Of(db), NOW);
    expect(result.corrected).toBe(2);
    expect(awaitingOf(db, 'ok')).toBe('2026-10-29T01:00:00.000Z');
    expect(awaitingOf(db, 'stale')).toBeNull();
    expect(awaitingOf(db, 'missed')).toBe('2026-10-29T02:00:00.000Z');
    expect(awaitingOf(db, 'old-missed')).toBeNull();
    expect(awaitingOf(db, 'closed')).toBeNull();

    // converged: a second run writes nothing
    expect((await healAwaitingSince(d1Of(db), NOW)).corrected).toBe(0);
  });
});
