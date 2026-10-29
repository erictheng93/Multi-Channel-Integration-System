/**
 * Channel overview stats against real SQLite (aggregate SQL) plus KV alert key scanning (CH1/CH2).
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const handle = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/db/drizzle-factory', () => ({ createDbClient: () => handle.db }));

import {
  computeMessageStats,
  getChannelOverviews,
  getMessageStats,
  getWebhookHealth,
} from '@/modules/integrations/services/channel-overview-stats-service';
import { recordWebhookSignatureFailure } from '@/utils/webhook-alert';
import type { Bindings } from '@/types';

const NOW = Date.parse('2026-10-29T06:00:00.000Z');
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const HOUR = 3600_000;

function makeKv() {
  const store = new Map<string, string>();
  const list = vi.fn(async ({ prefix }: { prefix: string }) => ({
    keys: [...store.keys()].filter(k => k.startsWith(prefix)).sort().map(name => ({ name })),
    list_complete: true,
  }));
  return {
    store,
    list,
    kv: {
      get: vi.fn(async (k: string) => store.get(k) ?? null),
      put: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
      list,
    },
  };
}

describe('channel overview stats (real SQLite)', () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.exec(`
      CREATE TABLE customers (id INTEGER PRIMARY KEY, platform TEXT NOT NULL);
      CREATE TABLE conversations (id TEXT PRIMARY KEY, customer_id INTEGER NOT NULL);
      CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, sender_type TEXT NOT NULL,
        created_at TEXT, deleted_at TEXT);
    `);
    handle.db = drizzle(sqlite);
  });

  const seedConv = (id: string, customerId: number, platform: string) => {
    sqlite.prepare('INSERT OR IGNORE INTO customers VALUES (?, ?)').run(customerId, platform);
    sqlite.prepare('INSERT INTO conversations VALUES (?, ?)').run(id, customerId);
  };
  let n = 0;
  const msg = (conv: string, sender: string, createdAt: string, deletedAt: string | null = null) =>
    sqlite.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?)').run(`m${++n}`, conv, sender, createdAt, deletedAt);

  test('counts customer/agent messages per platform for 24 h and all time, with last activity', async () => {
    seedConv('c-line', 1, 'line');
    seedConv('c-fb', 2, 'facebook');
    msg('c-line', 'customer', iso(-1 * HOUR));
    msg('c-line', 'customer', iso(-30 * HOUR));
    msg('c-line', 'agent', iso(-2 * HOUR));
    msg('c-line', 'agent', iso(-48 * HOUR));
    msg('c-line', 'system', iso(-10 * 60_000));
    msg('c-line', 'customer', iso(-1 * HOUR), iso(-HOUR / 2));
    msg('c-fb', 'customer', iso(-25 * HOUR));

    const { platforms } = await computeMessageStats({} as Bindings, NOW);
    expect(platforms.line).toEqual({
      customerMessages24h: 1,
      agentMessages24h: 1,
      customerMessagesTotal: 2,
      agentMessagesTotal: 2,
      lastActivityAt: iso(-1 * HOUR),
    });
    expect(platforms.facebook).toEqual({
      customerMessages24h: 0,
      agentMessages24h: 0,
      customerMessagesTotal: 1,
      agentMessagesTotal: 0,
      lastActivityAt: iso(-25 * HOUR),
    });
  });

  test('empty database yields no platforms, and the overview reports real zeros', async () => {
    const { kv } = makeKv();
    const env = { CACHE: kv } as unknown as Bindings;
    const snapshot = await getMessageStats(env);
    expect(snapshot?.platforms).toEqual({});
    const overviews = await getChannelOverviews(env, ['line']);
    expect(overviews.line?.activity).toEqual({
      customerMessages24h: 0, agentMessages24h: 0, customerMessagesTotal: 0, agentMessagesTotal: 0, lastActivityAt: null,
    });
  });

  test('the aggregate is cached in KV for 5 minutes (one query for repeated reads)', async () => {
    seedConv('c1', 1, 'line');
    msg('c1', 'customer', new Date().toISOString());
    const { kv } = makeKv();
    const env = { CACHE: kv } as unknown as Bindings;
    await getMessageStats(env);
    sqlite.prepare("INSERT INTO messages VALUES ('late','c1','customer',?,NULL)").run(new Date().toISOString());
    const second = await getMessageStats(env);
    expect(second?.platforms.line?.customerMessagesTotal).toBe(1);
    expect(kv.put).toHaveBeenCalledWith(expect.any(String), expect.any(String), { expirationTtl: 300 });
  });

  test('a failing stats query yields null activity, not zeros', async () => {
    sqlite.exec('DROP TABLE messages');
    const { kv } = makeKv();
    const overviews = await getChannelOverviews({ CACHE: kv } as unknown as Bindings, ['line']);
    expect(overviews.line?.activity).toBeNull();
  });
});

describe('webhook health from KV alert keys (CH2)', () => {
  test('counts processing failures and signature windows in the last 24 h only', async () => {
    const { kv, store } = makeKv();
    store.set(`alert:webhook_failure:line:${NOW - 2 * HOUR}`, '{}');
    store.set(`alert:webhook_failure:line:${NOW - 1 * HOUR}`, '{}');
    store.set(`alert:webhook_failure:line:${NOW - 30 * HOUR}`, '{}');
    store.set(`alert:webhook_failure:facebook:${NOW - 1 * HOUR}`, '{}');
    store.set(`alert:webhook_signature_failure:line:${NOW - 5 * HOUR}`, '{}');

    const line = await getWebhookHealth({ CACHE: kv } as unknown as Bindings, 'line', NOW);
    expect(line).toEqual({
      processingFailures24h: 2,
      lastProcessingFailureAt: iso(-1 * HOUR),
      signatureFailureMinutes24h: 1,
      lastSignatureFailureAt: iso(-5 * HOUR),
    });
    const fb = await getWebhookHealth({ CACHE: kv } as unknown as Bindings, 'facebook', NOW);
    expect(fb.processingFailures24h).toBe(1);
    expect(fb.signatureFailureMinutes24h).toBe(0);
    expect(fb.lastSignatureFailureAt).toBeNull();
  });

  test('no alerts means zero and null', async () => {
    const { kv } = makeKv();
    expect(await getWebhookHealth({ CACHE: kv } as unknown as Bindings, 'line', NOW)).toEqual({
      processingFailures24h: 0,
      lastProcessingFailureAt: null,
      signatureFailureMinutes24h: 0,
      lastSignatureFailureAt: null,
    });
  });

  test('KV failure degrades to zeros instead of throwing', async () => {
    const env = { CACHE: { list: async () => { throw new Error('kv down'); } } } as unknown as Bindings;
    expect((await getWebhookHealth(env, 'line', NOW)).processingFailures24h).toBe(0);
  });

  test('signature failures are recorded once per minute and read back', async () => {
    const { kv, store } = makeKv();
    const env = { CACHE: kv } as unknown as Bindings;
    await recordWebhookSignatureFailure(env, 'line', 'Invalid signature');
    await recordWebhookSignatureFailure(env, 'line', 'Invalid signature');
    await recordWebhookSignatureFailure(env, 'line', 'Invalid signature');
    expect(kv.put).toHaveBeenCalledTimes(1);
    expect([...store.keys()][0]).toMatch(/^alert:webhook_signature_failure:line:\d+$/);
    const health = await getWebhookHealth(env, 'line');
    expect(health.signatureFailureMinutes24h).toBe(1);
    expect(health.processingFailures24h).toBe(0);
  });

  test('recording never throws when KV is down', async () => {
    const env = { CACHE: { get: async () => { throw new Error('x'); }, put: async () => undefined } } as unknown as Bindings;
    await expect(recordWebhookSignatureFailure(env, 'facebook', 'bad')).resolves.toBeUndefined();
  });
});
