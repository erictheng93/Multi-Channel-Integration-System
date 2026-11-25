/**
 * Analytics platform filter: conversation analytics narrow to one platform through an EXISTS
 * subquery on customers. The D1 double records every prepared statement and its bound params so
 * the tests assert on the SQL the service actually sends, not just on `success`.
 */

import { describe, expect, test } from 'vitest';
import { AnalyticsService } from '@modules/analytics/services/analytics-core';
import { createDbClient } from '@/db/drizzle-factory';
import type { ConversationAnalyticsQuery } from '@modules/analytics/types/analytics-types';

interface Captured { sql: string; params: unknown[] }

function capturingD1(captured: Captured[]): D1Database {
  const bound = (query: string, params: unknown[]) => {
    const record = () => captured.push({ sql: query, params });
    return {
      all: async () => { record(); return { results: [], success: true, meta: {} }; },
      raw: async () => { record(); return []; },
      first: async () => { record(); return null; },
      run: async () => { record(); return { results: [], success: true, meta: {} }; }
    };
  };
  return {
    prepare: (query: string) => ({
      bind: (...params: unknown[]) => bound(query, params),
      ...bound(query, [])
    }),
    batch: async () => []
  } as unknown as D1Database;
}

function setup() {
  const captured: Captured[] = [];
  const d1 = capturingD1(captured);
  const service = new AnalyticsService({ database: createDbClient(d1), kv: undefined, env: { DB: d1 } as never });
  return { service, captured };
}

const PLATFORM_EXISTS = /exists\s*\(\s*select 1 from "customers"[\s\S]*"customers"\."platform"\s*=\s*\?/i;

describe('Analytics platform filter (conversation analytics)', () => {
  test.each(['line', 'facebook'] as const)('binds platform %s into an EXISTS on customers', async platform => {
    const { service, captured } = setup();
    const query: ConversationAnalyticsQuery = { timeRange: '7d', filters: { platform }, metrics: ['total_conversations'] };

    const result = await service.getConversationAnalytics(query);

    expect(result.success).toBe(true);
    const filtered = captured.filter(c => PLATFORM_EXISTS.test(c.sql));
    expect(filtered.length).toBeGreaterThan(0);
    for (const statement of filtered) expect(statement.params).toContain(platform);
  });

  test('combines platform with the team filter in the same statement', async () => {
    const { service, captured } = setup();

    await service.getConversationAnalytics({ timeRange: '7d', filters: { platform: 'line', teamId: 7 }, metrics: [] });

    const statement = captured.find(c => PLATFORM_EXISTS.test(c.sql));
    expect(statement?.sql).toMatch(/"conversations"\."assigned_team_id"\s*=\s*\?/);
    expect(statement?.params).toEqual(expect.arrayContaining(['line', 7]));
  });

  test.each([
    ['missing', {}],
    ['null', { platform: null as unknown as undefined }],
    ['undefined', { platform: undefined }]
  ])('a %s platform adds no platform condition (all platforms)', async (_label, filters) => {
    const { service, captured } = setup();

    const result = await service.getConversationAnalytics({ timeRange: '7d', filters, metrics: [] });

    expect(result.success).toBe(true);
    expect(captured.length).toBeGreaterThan(0);
    expect(captured.some(c => /"customers"\."platform"/.test(c.sql))).toBe(false);
  });
});
