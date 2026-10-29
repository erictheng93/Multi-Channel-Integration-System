import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import Sqlite from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { drizzle, type RemoteCallback } from 'drizzle-orm/sqlite-proxy';
import * as schema from '@/db/schema';

const state = vi.hoisted(() => ({
  db: null as unknown,
  user: { id: 'agent-1', role: 'agent', allowedTeamIds: [1] } as Record<string, unknown>,
}));

vi.mock('@/middleware/auth', () => ({
  jwtAuth: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('jwtPayload', { userId: 'agent-1', role: state.user.role, primaryTeamId: 1 });
    c.set('user', state.user);
    await next();
  },
}));
vi.mock('@/db/drizzle-factory', () => ({ createDbClient: () => state.db }));
vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const businessHours = {
  hasSchedule: true,
  isOpen: true,
  timezone: 'Asia/Taipei',
  closesAt: '18:00',
  opensAt: null,
};
vi.mock('@modules/auto-reply/services/schedule-service', () => ({
  getBusinessHoursStatus: vi.fn(async () => businessHours),
}));

import autoReplyStatsHandler from '@modules/auto-reply/handlers/auto-reply-stats';

// 2026-10-29 10:00 Taipei. Taipei today starts 2026-10-28T16:00Z; "yesterday same time" is 2026-10-28T02:00Z.
const NOW = new Date('2026-10-29T02:00:00.000Z');

describe('GET /auto-reply/stats', () => {
  let sqlite: Sqlite.Database;
  const app = new Hono();
  app.route('/auto-reply/stats', autoReplyStatsHandler);
  const env = { DB: {}, CACHE: {} };

  const get = async (query = 'teamId=1') => {
    const res = await app.request(`/auto-reply/stats?${query}`, {}, env);
    return { status: res.status, body: (await res.json()) as { data: Record<string, unknown> } };
  };
  const addLog = (at: string, opts: { rule?: number; conv?: string } = {}) =>
    sqlite
      .prepare('INSERT INTO auto_reply_logs (rule_id, conversation_id, platform, reply_method, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(opts.rule ?? 1, opts.conv ?? 'c-mine', 'line', 'reply_api', at);
  const addDelivery = (id: string, status: string, at: string, opts: { rule?: number; conv?: string } = {}) =>
    sqlite
      .prepare('INSERT INTO auto_reply_deliveries (platform, platform_message_id, rule_id, conversation_id, status, attempt_count, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)')
      .run('line', id, opts.rule ?? 1, opts.conv ?? 'c-mine', status, at);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    state.user = { id: 'agent-1', role: 'agent', allowedTeamIds: [1] };

    sqlite = new Sqlite(':memory:');
    for (const table of [schema.autoReplyRules, schema.autoReplyLogs, schema.autoReplyDeliveries, schema.conversations]) {
      const config = getTableConfig(table);
      sqlite.exec(`CREATE TABLE "${config.name}" (${config.columns.map((column) =>
        `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`
      ).join(', ')})`);
    }
    const execute: RemoteCallback = async (query, params, method) => {
      const statement = sqlite.prepare(query);
      if (method === 'run') { statement.run(...params); return { rows: [] }; }
      const rows = statement.raw().all(...params);
      return { rows: method === 'get' ? rows[0] as unknown[] : rows };
    };
    state.db = drizzle(execute, { schema });

    sqlite.exec(`
      INSERT INTO auto_reply_rules (id, team_id, name, trigger_type) VALUES (1, 1, 'mine', 'keyword'), (2, 2, 'other', 'keyword'), (3, NULL, 'global', 'welcome');
      INSERT INTO conversations (id, assigned_team_id) VALUES ('c-mine', 1), ('c-pool', NULL), ('c-other', 2);
    `);
  });
  afterEach(() => {
    vi.useRealTimers();
    sqlite.close();
  });

  it('returns zeros, a null rate and the business-hours state when nothing happened', async () => {
    const { status, body } = await get();

    expect(status).toBe(200);
    expect(body.data).toEqual({
      todaySuccess: 0,
      todayFailed: 0,
      yesterdaySameTimeSuccess: 0,
      successRate: null,
      businessHours,
    });
  });

  it('counts today in Asia/Taipei, not UTC, and compares with yesterday up to the same time', async () => {
    addLog('2026-10-28T17:00:00.000Z'); // Taipei 01:00 today (UTC date is still Oct 28)
    addLog('2026-10-28T16:00:00.000Z'); // exactly Taipei midnight: today
    addLog('2026-10-28T15:59:59.000Z'); // Taipei 23:59 yesterday, after the same time of day: neither
    addLog('2026-10-27T20:00:00.000Z'); // Taipei 04:00 yesterday: before 10:00, counts for yesterday
    addLog('2026-10-27T10:00:00.000Z'); // two days ago: neither

    const { body } = await get();

    expect(body.data.todaySuccess).toBe(2);
    expect(body.data.yesterdaySameTimeSuccess).toBe(1);
  });

  it('takes failures from the delivery ledger and derives the success rate', async () => {
    addLog('2026-10-28T17:00:00.000Z');
    addLog('2026-10-28T18:00:00.000Z');
    addLog('2026-10-28T19:00:00.000Z');
    addDelivery('m1', 'failed', '2026-10-28T20:00:00.000Z');
    addDelivery('m2', 'success', '2026-10-28T20:00:00.000Z');
    addDelivery('m3', 'pending', '2026-10-28T20:00:00.000Z');
    addDelivery('m4', 'failed', '2026-10-28T15:00:00.000Z'); // yesterday

    const { body } = await get();

    expect(body.data.todayFailed).toBe(1);
    expect(body.data.successRate).toBe(0.75);
  });

  it('scopes to the team plus global rules and to conversations the agent can see', async () => {
    addLog('2026-10-28T17:00:00.000Z', { rule: 1, conv: 'c-mine' });
    addLog('2026-10-28T17:00:00.000Z', { rule: 3, conv: 'c-pool' }); // global rule, shared pool
    addLog('2026-10-28T17:00:00.000Z', { rule: 2, conv: 'c-mine' }); // another team's rule
    addLog('2026-10-28T17:00:00.000Z', { rule: 3, conv: 'c-other' }); // another team's conversation
    addDelivery('f1', 'failed', '2026-10-28T20:00:00.000Z', { rule: 2 });
    addDelivery('f2', 'failed', '2026-10-28T20:00:00.000Z', { rule: 3, conv: 'c-other' });
    addDelivery('f3', 'failed', '2026-10-28T20:00:00.000Z', { rule: 1 });

    const { body } = await get();

    expect(body.data.todaySuccess).toBe(2);
    expect(body.data.todayFailed).toBe(1);
  });

  it('forbids a team the caller does not belong to, but lets admins read any team', async () => {
    expect((await get('teamId=2')).status).toBe(403);

    state.user = { id: 'admin-1', role: 'admin', allowedTeamIds: [] };
    addLog('2026-10-28T17:00:00.000Z', { rule: 2, conv: 'c-other' });
    const { status, body } = await get('teamId=2');

    expect(status).toBe(200);
    expect(body.data.todaySuccess).toBe(1);
  });
});
