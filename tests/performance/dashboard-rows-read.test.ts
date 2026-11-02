/**
 * Measured D1 rows_read, before vs after the rollup / awaiting_since work (migrations 0069, 0070).
 *
 * Runs the REAL services against workerd's local D1 (wrangler getPlatformProxy), whose
 * `meta.rows_read` follows the same accounting as production D1 billing. It starts a local
 * workerd, so it is opt-in:
 *
 *   MEASURE_ROWS_READ=1 npx vitest run tests/performance/dashboard-rows-read.test.ts
 *
 * Dataset mirrors production on 2026-10-29: 5,537 messages (~27/day), 428 conversations of
 * which 414 are open, 11 teams, ~60 conversations waiting. The "before" numbers come from
 * the pre-rollup queries kept verbatim below; the "after" numbers from the shipped services.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { buildDashboardSummary, buildMessageVolume } from '@/modules/dashboard/services/dashboard-service';
import { aggregateMessageRollup } from '@/modules/dashboard/services/message-rollup-service';
import { getWaitingConversations } from '@/modules/dashboard/services/waiting-service';
import { computeMessageStats } from '@/modules/integrations/services/channel-overview-stats-service';
import { getConversationVisibilitySql } from '@/services/conversation-visibility';
import { rowsReadOf } from '@/utils/d1-rows-read';
import type { Bindings } from '@/types';
import { fastUnreadAggregate, legacyUnreadAggregate } from '@/modules/conversations/services/unread-stats-service';
import { MIGRATION_AWAITING, MIGRATION_HYGIENE, MIGRATION_MARKERS, MIGRATION_ROLLUP, readMigration } from '../helpers/sqlite-d1';
import { autoCloseIdleConversations } from '@/modules/conversations/services/auto-close-service';
import { healAwaitingSince } from '@/modules/dashboard/services/awaiting-service';
import { getStaleWaitingSummary, getNeverRepliedIds } from '@/modules/dashboard/services/stale-waiting-service';
import { waitingWindowStartIso } from '@/modules/dashboard/services/waiting-service';
import { neverRepliedSql } from '@/modules/dashboard/services/awaiting-rules';

const enabled = process.env.MEASURE_ROWS_READ === '1';
const DAY = 24 * 3600_000;
const admin = { role: 'admin' as const, allowedTeamIds: [] as number[] };
const agent = { role: 'agent' as const, allowedTeamIds: [3, 4] };

/** Split a migration into statements (CREATE TRIGGER bodies end with a line "END;"). */
function statementsOf(sql: string): string[] {
  const out: string[] = [];
  let current: string[] = [];
  let inTrigger = false;
  for (const line of sql.split('\n')) {
    if (line.trim().startsWith('--') && current.length === 0) { continue; }
    current.push(line);
    if (/^\s*CREATE TRIGGER/i.test(line)) { inTrigger = true; }
    const done = inTrigger ? line.trim() === 'END;' : line.trim().endsWith(';');
    if (done) { out.push(current.join('\n')); current = []; inTrigger = false; }
  }
  return out.filter(s => s.trim().length > 0);
}

/** Wrap D1 so every result's rows_read is summed (first() is routed through all() to get meta). */
function counting(db: D1Database) {
  let total = 0;
  const wrapStatement = (stmt: D1PreparedStatement): D1PreparedStatement => new Proxy(stmt, {
    get(target, prop) {
      if (prop === 'bind') { return (...args: unknown[]) => wrapStatement(target.bind(...args)); }
      if (prop === 'first') {
        return async () => {
          const result = await target.all();
          total += rowsReadOf(result);
          return result.results?.[0] ?? null;
        };
      }
      if (prop === 'all' || prop === 'run') {
        return async () => {
          const result = await (target[prop as 'all'])();
          total += rowsReadOf(result);
          return result;
        };
      }
      return Reflect.get(target, prop);
    }
  });
  const wrapped = new Proxy(db, {
    get(target, prop) {
      if (prop === 'prepare') { return (q: string) => wrapStatement(target.prepare(q)); }
      if (prop === 'batch') {
        return async (stmts: D1PreparedStatement[]) => {
          const result = await target.batch(stmts);
          total += rowsReadOf(result);
          return result;
        };
      }
      return Reflect.get(target, prop);
    }
  });
  return { d1: wrapped, reset: () => { total = 0; }, get: () => total };
}

describe.skipIf(!enabled)('dashboard rows_read, before vs after (local D1 engine)', () => {
  let dispose: () => Promise<void>;
  let raw: D1Database;
  let NOW = 0;
  const results: Array<{ endpoint: string; before: number; after: number }> = [];

  const run = async (db: D1Database, sql: string, params: unknown[] = []) => db.prepare(sql).bind(...params).run();
  const insertBatch = async (db: D1Database, sql: string, rows: unknown[][]) => {
    for (let i = 0; i < rows.length; i += 50) {
      await db.batch(rows.slice(i, i + 50).map(r => db.prepare(sql).bind(...r)));
    }
  };

  beforeAll(async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcis-rows-read-'));
    writeFileSync(join(dir, 'w.toml'), [
      'name = "probe"', 'compatibility_date = "2025-01-01"',
      '[[d1_databases]]', 'binding = "DB"', 'database_name = "probe"', 'database_id = "00000000-0000-0000-0000-000000000000"'
    ].join('\n'));
    const proxy = await getPlatformProxy<{ DB: D1Database }>({ configPath: join(dir, 'w.toml'), persist: { path: join(dir, 'state') } });
    dispose = proxy.dispose;
    raw = proxy.env.DB;
    NOW = Date.now();

    for (const ddl of [
      'CREATE TABLE customers (id INTEGER PRIMARY KEY, platform TEXT NOT NULL, display_name TEXT, custom_name TEXT, avatar_url TEXT)',
      `CREATE TABLE conversations (id TEXT PRIMARY KEY, customer_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active',
        assigned_team_id INTEGER, first_response_at TEXT, closed_at TEXT, created_at TEXT, deleted_at TEXT, unread_floor_at TEXT, updated_at TEXT)`,
      `CREATE TABLE agents (id TEXT PRIMARY KEY, email TEXT, password_hash TEXT, display_name TEXT, role TEXT, is_active INTEGER, created_at TEXT, updated_at TEXT)`,
      `CREATE TABLE activities (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, user_name TEXT, user_role TEXT, action TEXT, resource_type TEXT, resource_id TEXT, details TEXT, ip_address TEXT, user_agent TEXT, created_at TEXT)`,
      'CREATE TABLE conversation_read_states (agent_id TEXT NOT NULL, conversation_id TEXT NOT NULL, last_read_at TEXT, marked_unread_at TEXT, PRIMARY KEY (agent_id, conversation_id))',
      `CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, sender_type TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '', message_type TEXT NOT NULL DEFAULT 'text', metadata TEXT,
        is_recalled INTEGER DEFAULT 0, is_sent INTEGER DEFAULT 1, delivery_status TEXT DEFAULT 'delivered',
        deleted_at TEXT, created_at TEXT NOT NULL)`,
      'CREATE INDEX idx_messages_created_at ON messages(created_at)',
      'CREATE INDEX idx_messages_sender_type_created_at ON messages(sender_type, created_at)',
      'CREATE INDEX idx_messages_conv_sender_deleted_created ON messages(conversation_id, sender_type, deleted_at, created_at)',
      'CREATE INDEX idx_conversations_status ON conversations(status)',
      'CREATE INDEX idx_messages_conversation ON messages(conversation_id)'
    ]) { await run(raw, ddl); }

    // 428 conversations / 414 open / 11 teams (and the unassigned pool)
    let seed = 20261029;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const customers: unknown[][] = [];
    const conversations: unknown[][] = [];
    for (let i = 1; i <= 428; i++) {
      customers.push([i, i % 4 === 0 ? 'facebook' : 'line', `Customer ${i}`]);
      const team = i % 12 === 0 ? null : (i % 11) + 1;
      conversations.push([`c${i}`, i, i <= 14 ? 'closed' : 'active', team, new Date(NOW - Math.floor(rnd() * 200) * DAY).toISOString()]);
    }
    await insertBatch(raw, 'INSERT INTO customers (id, platform, display_name) VALUES (?,?,?)', customers);
    await insertBatch(raw, 'INSERT INTO conversations (id, customer_id, status, assigned_team_id, created_at) VALUES (?,?,?,?,?)', conversations);

    // 5,537 messages over ~200 days (about 27 per day), 60 / 30 / 10 customer / agent / system
    const messages: unknown[][] = [];
    for (let i = 0; i < 5537; i++) {
      const r = rnd();
      const at = new Date(NOW - Math.floor(rnd() * 200 * DAY) - 5 * 60_000).toISOString();
      messages.push([`m${i}`, `c${1 + Math.floor(rnd() * 428)}`, r < 0.6 ? 'customer' : r < 0.9 ? 'agent' : 'system', at]);
    }
    await insertBatch(raw, "INSERT INTO messages (id, conversation_id, sender_type, content, created_at) VALUES (?,?,?,'hello',?)", messages);

    // Agent a1 has opened about half the conversations at some point; 3% are flagged unread
    const readStates: unknown[][] = [];
    for (let i = 1; i <= 428; i++) {
      if (rnd() < 0.5) {
        readStates.push(['a1', `c${i}`, new Date(NOW - Math.floor(rnd() * 120 * DAY)).toISOString(), rnd() < 0.06 ? new Date(NOW - DAY).toISOString() : null]);
      }
    }
    // Agent a2 works the inbox: every conversation opened within the last hour except ~10 left unread, 4 flagged
    for (let i = 1; i <= 428; i++) {
      readStates.push(['a2', `c${i}`, i % 43 === 0 ? new Date(NOW - 100 * DAY).toISOString() : new Date(NOW - 3600_000).toISOString(), i % 107 === 0 ? new Date(NOW - 1800_000).toISOString() : null]);
    }
    await insertBatch(raw, 'INSERT INTO conversation_read_states (agent_id, conversation_id, last_read_at, marked_unread_at) VALUES (?,?,?,?)', readStates);

    // Apply the migrations exactly like production would: backfill from existing data
    for (const file of [MIGRATION_ROLLUP, MIGRATION_AWAITING, MIGRATION_MARKERS, MIGRATION_HYGIENE]) {
      for (const statement of statementsOf(readMigration(file))) { await run(raw, statement); }
    }
    await aggregateMessageRollup(raw, NOW); // the cron catches up the last minute
  }, 120_000);

  afterAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\nD1 rows_read per call (5,537 messages / 428 conversations / 414 open)\n' +
      results.map(r => `${r.endpoint.padEnd(44)} before ${String(r.before).padStart(7)}   after ${String(r.after).padStart(6)}`).join('\n'));
    if (process.env.MEASURE_OUT) { writeFileSync(process.env.MEASURE_OUT, JSON.stringify(results, null, 2)); }
    await dispose?.();
  });

  async function measure(endpoint: string, before: (d1: D1Database) => Promise<unknown>, after: (d1: D1Database) => Promise<unknown>) {
    const meter = counting(raw);
    meter.reset();
    await before(meter.d1);
    const beforeRows = meter.get();
    meter.reset();
    await after(meter.d1);
    const afterRows = meter.get();
    results.push({ endpoint, before: beforeRows, after: afterRows });
    return { beforeRows, afterRows };
  }

  /* ----------------------------- legacy (pre-rollup) queries ----------------------------- */

  const legacyWaiting = async (d1: D1Database, user: typeof admin | typeof agent) => {
    const visibility = getConversationVisibilitySql(user, 'c.assigned_team_id');
    await d1.prepare(`
      WITH vis AS (SELECT c.id AS id FROM conversations c WHERE ${visibility.clause} AND c.status <> 'closed' AND c.deleted_at IS NULL),
      last_agent AS (
        SELECT m.conversation_id AS conversation_id, MAX(m.created_at) AS at FROM messages m
        INNER JOIN vis ON vis.id = m.conversation_id
        WHERE m.sender_type = 'agent' AND m.deleted_at IS NULL AND COALESCE(m.is_recalled, 0) = 0
          AND (m.metadata IS NULL OR m.metadata NOT LIKE '%"broadcastId"%')
        GROUP BY m.conversation_id),
      waiting AS (
        SELECT vis.id AS conversation_id, MIN(cm.created_at) AS waiting_since, COUNT(cm.id) AS unanswered
        FROM vis LEFT JOIN last_agent la ON la.conversation_id = vis.id
        INNER JOIN messages cm ON cm.conversation_id = vis.id AND cm.sender_type = 'customer'
          AND cm.deleted_at IS NULL AND cm.created_at > COALESCE(la.at, '')
        GROUP BY vis.id)
      SELECT w.conversation_id AS conversationId, c.customer_id AS customerId, w.waiting_since AS waitingSince, w.unanswered AS unansweredCount,
        (SELECT lm.content FROM messages lm WHERE lm.conversation_id = w.conversation_id AND lm.sender_type = 'customer' AND lm.deleted_at IS NULL ORDER BY lm.created_at DESC LIMIT 1) AS lastCustomerContent,
        (SELECT lm.message_type FROM messages lm WHERE lm.conversation_id = w.conversation_id AND lm.sender_type = 'customer' AND lm.deleted_at IS NULL ORDER BY lm.created_at DESC LIMIT 1) AS lastCustomerType,
        COUNT(*) OVER () AS total
      FROM waiting w INNER JOIN conversations c ON c.id = w.conversation_id LEFT JOIN customers cu ON cu.id = c.customer_id
      ORDER BY w.waiting_since ASC, w.conversation_id ASC LIMIT ?
    `).bind(...visibility.params, 5).all();
  };

  const legacyVolume = async (d1: D1Database, user: typeof admin | typeof agent, days: number) => {
    const todayStart = Math.floor((NOW + 8 * 3600_000) / DAY) * DAY - 8 * 3600_000;
    const rangeStart = todayStart - (2 * days - 1) * DAY;
    const visibility = getConversationVisibilitySql(user, 'c.assigned_team_id');
    await d1.prepare(`
      SELECT date(m.created_at, '+8 hours') AS d, cu.platform AS platform, COUNT(*) AS n
      FROM messages m INNER JOIN conversations c ON c.id = m.conversation_id LEFT JOIN customers cu ON cu.id = c.customer_id
      WHERE m.sender_type = 'customer' AND m.created_at >= ? AND m.created_at <= ? AND m.deleted_at IS NULL AND ${visibility.clause}
      GROUP BY d, cu.platform
    `).bind(new Date(rangeStart).toISOString(), new Date(NOW).toISOString(), ...visibility.params).all();
  };

  const legacySummaryMessages = async (d1: D1Database, user: typeof admin | typeof agent) => {
    const todayStart = Math.floor((NOW + 8 * 3600_000) / DAY) * DAY - 8 * 3600_000;
    const visibility = getConversationVisibilitySql(user, 'c.assigned_team_id');
    await d1.prepare(`
      SELECT COALESCE(SUM(CASE WHEN m.created_at >= ? THEN 1 ELSE 0 END), 0) AS today,
             COALESCE(SUM(CASE WHEN m.created_at < ? THEN 1 ELSE 0 END), 0) AS yesterday
      FROM messages m INNER JOIN conversations c ON c.id = m.conversation_id
      WHERE m.sender_type = 'customer' AND m.created_at >= ? AND m.created_at <= ? AND m.deleted_at IS NULL AND ${visibility.clause}
    `).bind(new Date(todayStart).toISOString(), new Date(NOW - DAY).toISOString(), new Date(todayStart - DAY).toISOString(), new Date(NOW).toISOString(), ...visibility.params).all();
  };

  const legacyChannelStats = async (d1: D1Database) => {
    const cutoff = new Date(NOW - DAY).toISOString();
    await d1.prepare(`
      SELECT cu.platform AS platform,
        SUM(CASE WHEN m.sender_type = 'customer' THEN 1 ELSE 0 END) AS customerTotal,
        SUM(CASE WHEN m.sender_type = 'agent' THEN 1 ELSE 0 END) AS agentTotal,
        SUM(CASE WHEN m.sender_type = 'customer' AND m.created_at >= ? THEN 1 ELSE 0 END) AS customer24h,
        SUM(CASE WHEN m.sender_type = 'agent' AND m.created_at >= ? THEN 1 ELSE 0 END) AS agent24h,
        MAX(CASE WHEN m.sender_type IN ('customer', 'agent') THEN m.created_at END) AS lastActivityAt
      FROM messages m INNER JOIN conversations c ON m.conversation_id = c.id INNER JOIN customers cu ON c.customer_id = cu.id
      WHERE m.deleted_at IS NULL GROUP BY cu.platform
    `).bind(cutoff, cutoff).all();
  };

  /* ----------------------------------- measurements ----------------------------------- */

  it('GET /conversations/waiting (admin)', async () => {
    const { beforeRows, afterRows } = await measure('GET /conversations/waiting (admin)',
      d1 => legacyWaiting(d1, admin), d1 => getWaitingConversations(d1, admin, 5, NOW));
    expect(afterRows).toBeLessThan(beforeRows / 4);
    expect(afterRows).toBeLessThan(2000);
  });

  it('GET /conversations/waiting (agent, 2 teams)', async () => {
    const { beforeRows, afterRows } = await measure('GET /conversations/waiting (agent, 2 teams)',
      d1 => legacyWaiting(d1, agent), d1 => getWaitingConversations(d1, agent, 5, NOW));
    expect(afterRows).toBeLessThan(beforeRows / 4);
  });

  it.each([7, 30, 90] as const)('GET /dashboard/message-volume?days=%i', async (days) => {
    const { beforeRows, afterRows } = await measure(`GET /dashboard/message-volume?days=${days}`,
      d1 => legacyVolume(d1, admin, days), d1 => buildMessageVolume(d1, admin, days, NOW));
    expect(afterRows).toBeLessThan(beforeRows);
  });

  /** The three conversation-table queries of the summary that were not changed by this work. */
  const unchangedSummaryQueries = async (d1: D1Database, user: typeof admin | typeof agent) => {
    const todayStart = Math.floor((NOW + 8 * 3600_000) / DAY) * DAY - 8 * 3600_000;
    const visibility = getConversationVisibilitySql(user, 'c.assigned_team_id');
    const iso = (ms: number) => new Date(ms).toISOString();
    await d1.prepare(`
      SELECT COALESCE(SUM(CASE WHEN c.closed_at >= ? THEN 1 ELSE 0 END), 0) AS today, COALESCE(SUM(CASE WHEN c.closed_at < ? THEN 1 ELSE 0 END), 0) AS yesterday
      FROM conversations c WHERE c.status = 'closed' AND c.closed_at >= ? AND c.closed_at <= ? AND ${visibility.clause}
    `).bind(iso(todayStart), iso(NOW - DAY), iso(todayStart - DAY), iso(NOW), ...visibility.params).all();
    await d1.prepare(`SELECT COUNT(*) AS n FROM conversations c WHERE c.status <> 'closed' AND c.deleted_at IS NULL AND ${visibility.clause}`)
      .bind(...visibility.params).all();
    await d1.prepare(`
      SELECT COALESCE(SUM(CASE WHEN c.created_at >= ? THEN 1 ELSE 0 END), 0) AS todayCount
      FROM conversations c WHERE c.created_at >= ? AND c.created_at <= ? AND c.first_response_at IS NOT NULL AND ${visibility.clause}
    `).bind(iso(todayStart), iso(todayStart - DAY), iso(NOW), ...visibility.params).all();
  };

  it.each([['admin', admin], ['agent, 2 teams', agent]] as const)('GET /dashboard/summary (%s)', async (label, user) => {
    const { beforeRows, afterRows } = await measure(`GET /dashboard/summary (${label})`,
      async d1 => {
        await legacySummaryMessages(d1, user);
        await legacyWaiting(d1, user);
        await unchangedSummaryQueries(d1, user);
      },
      d1 => buildDashboardSummary(d1, user, NOW));
    expect(afterRows).toBeLessThan(beforeRows);
  });

  it('GET /api/channels activity (per-platform message stats)', async () => {
    const { beforeRows, afterRows } = await measure('channels per-platform message stats',
      d1 => legacyChannelStats(d1), d1 => computeMessageStats({ DB: d1 } as unknown as Bindings, NOW));
    expect(afterRows).toBeLessThan(beforeRows);
  });


  it.each([['admin', { id: 'a1', ...admin }], ['agent, 2 teams', { id: 'a1', ...agent }]] as const)(
    'GET /conversations/stats unread aggregate (%s)', async (label, user) => {
      let before: unknown;
      let after: unknown;
      const { beforeRows, afterRows } = await measure(`GET /conversations/stats unread (${label})`,
        async d1 => { before = await legacyUnreadAggregate(d1, user); },
        async d1 => { after = await fastUnreadAggregate(d1, user); });
      expect(after).toEqual(before);
      // Pessimistic dataset: ~234 of 414 conversations are unread for this agent, and every unread
      // message is read once by design. Cost is O(unread), so the real gain is shown by the caught-up agent below.
      expect(afterRows).toBeLessThan(beforeRows * 0.25);
    });

  it('GET /conversations/stats unread aggregate (agent who keeps up with the inbox)', async () => {
    const user = { id: 'a2', ...admin };
    let before: unknown;
    let after: unknown;
    const { beforeRows, afterRows } = await measure('GET /conversations/stats unread (agent caught up)',
      async d1 => { before = await legacyUnreadAggregate(d1, user); },
      async d1 => { after = await fastUnreadAggregate(d1, user); });
    expect(after).toEqual(before);
    expect(afterRows).toBeLessThan(beforeRows * 0.1);
  });

  it('GET /conversations/stats conversation counts, by (team, status)', async () => {
    const sql = 'SELECT assigned_team_id AS teamId, status, COUNT(*) AS n FROM conversations GROUP BY assigned_team_id, status';
    const { beforeRows, afterRows } = await measure('GET /conversations/stats counts (team,status)',
      async d1 => {
        // without idx_conversations_team_status (as before migration 0071)
        await d1.prepare(sql.replace('FROM conversations', 'FROM conversations NOT INDEXED')).all();
      },
      d1 => d1.prepare(sql).all());
    expect(afterRows).toBeLessThanOrEqual(beforeRows);
  });

  it('GET /conversations?awaiting=stale (admin, page of 20) and the summary stale counts', async () => {
    const meter = counting(raw);
    meter.reset();
    const summary = await getStaleWaitingSummary(meter.d1, admin, NOW);
    const summaryRows = meter.get();
    results.push({ endpoint: 'stale waiting summary (admin)', before: 0, after: summaryRows });
    expect(summary.count).toBeGreaterThan(50);
    expect(summaryRows).toBeLessThan(2000);

    meter.reset();
    const page = await meter.d1.prepare(`
      SELECT c.id FROM conversations c
      WHERE c.awaiting_since IS NOT NULL AND c.awaiting_since < ? AND c.status <> 'closed' AND c.deleted_at IS NULL
      ORDER BY CASE WHEN ${neverRepliedSql('c.id')} THEN 0 ELSE 1 END, c.awaiting_since ASC, c.id ASC LIMIT 20
    `).bind(waitingWindowStartIso(NOW)).all<{ id: string }>();
    await getNeverRepliedIds(meter.d1, (page.results ?? []).map(r => r.id));
    results.push({ endpoint: 'GET /conversations?awaiting=stale (page 20)', before: 0, after: meter.get() });
    expect(meter.get()).toBeLessThan(2000);
  });

  it('nightly heal of awaiting_since with the sign-off rule (steady state)', async () => {
    const meter = counting(raw);
    const healed = await healAwaitingSince(meter.d1, NOW);
    results.push({ endpoint: 'cron nightly healAwaitingSince', before: 0, after: meter.get() });
    expect(healed.corrected).toBe(0);
    expect(meter.get()).toBeLessThan(20_000);
  });

  it('nightly auto-close: select + close a batch of at most 200', async () => {
    const meter = counting(raw);
    const result = await autoCloseIdleConversations({ DB: meter.d1 } as unknown as Bindings, NOW);
    results.push({ endpoint: `cron nightly auto-close (closed ${result.closed})`, before: 0, after: meter.get() });
    expect(result.closed).toBeLessThanOrEqual(200);
    expect(meter.get()).toBeLessThan(5000);
    // converged: the next run selects nothing it can still close
    const again = counting(raw);
    const second = await autoCloseIdleConversations({ DB: again.d1 } as unknown as Bindings, NOW);
    results.push({ endpoint: `cron nightly auto-close, second run (closed ${second.closed})`, before: 0, after: again.get() });
    expect(again.get()).toBeLessThan(500);
  });

  it('*/5 cron: aggregateMessageRollup with nothing new', async () => {
    const meter = counting(raw);
    await aggregateMessageRollup(meter.d1, NOW + 5 * 60_000);
    results.push({ endpoint: 'cron */5 rollup (no new messages)', before: 0, after: meter.get() });
    expect(meter.get()).toBeLessThan(50);
  });
});
