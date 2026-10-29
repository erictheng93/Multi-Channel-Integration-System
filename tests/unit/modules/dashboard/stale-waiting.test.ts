import { describe, expect, it } from 'vitest';
import { WAITING_WINDOW_DAYS } from '@shared/api-contracts/dashboard';
import { buildDashboardSummary } from '@/modules/dashboard/services/dashboard-service';
import { getStaleWaitingSummary, getNeverRepliedIds } from '@/modules/dashboard/services/stale-waiting-service';
import { getWaitingConversations } from '@/modules/dashboard/services/waiting-service';
import { addConv, addCustomer, addMsg, createDashboardDb, d1Of } from '../../../helpers/sqlite-d1';

const NOW = Date.parse('2026-10-29T10:00:00.000Z');
const DAY = 24 * 3600_000;
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const admin = { role: 'admin' as const, allowedTeamIds: [] as number[] };
const agentOfTeam = (...ids: number[]) => ({ role: 'agent' as const, allowedTeamIds: ids });

function build() {
  const db = createDashboardDb({ rollup: true, awaiting: true, markers: true, hygiene: true });
  addCustomer(db, 1);
  return db;
}

describe('待回覆 window', () => {
  it('is 7 days', () => {
    expect(WAITING_WINDOW_DAYS).toBe(7);
  });

  it('counts waits that started within 7 days; older ones are excluded (boundary inclusive)', async () => {
    const db = build();
    addConv(db, 'fresh');
    addMsg(db, 'fresh', 'customer', ago(3600_000));
    addConv(db, 'edge');
    addMsg(db, 'edge', 'customer', ago(7 * DAY)); // exactly on the boundary: still in the window
    addConv(db, 'stale');
    addMsg(db, 'stale', 'customer', ago(7 * DAY + 1));
    addConv(db, 'ancient');
    addMsg(db, 'ancient', 'customer', ago(100 * DAY));

    const result = await getWaitingConversations(d1Of(db), admin, 10, NOW);
    expect(result.items.map(i => i.conversationId)).toEqual(['edge', 'fresh']);
    expect(result.total).toBe(2);
  });

  it('the oldest-waiting card ignores stale waits', async () => {
    const db = build();
    addConv(db, 'fresh');
    addMsg(db, 'fresh', 'customer', ago(2 * DAY));
    addConv(db, 'ancient');
    addMsg(db, 'ancient', 'customer', ago(60 * DAY));
    const summary = await buildDashboardSummary(d1Of(db), admin, NOW);
    expect(summary.waiting.count).toBe(1);
    expect(summary.waiting.oldestWaitingSince).toBe(ago(2 * DAY));
    expect(summary.staleWaiting).toEqual({ count: 1, neverRepliedCount: 1 });
  });

  it('an empty window still reports stale waits', async () => {
    const db = build();
    addConv(db, 'ancient');
    addMsg(db, 'ancient', 'customer', ago(60 * DAY));
    const summary = await buildDashboardSummary(d1Of(db), admin, NOW);
    expect(summary.waiting).toMatchObject({ count: 0, oldestWaitingSince: null, top: [] });
    expect(summary.staleWaiting.count).toBe(1);
  });
});

describe('staleWaiting summary', () => {
  it('counts stale waits and those never answered by a human', async () => {
    const db = build();
    // never replied (system auto-reply and a broadcast do not count)
    addConv(db, 'never1');
    addMsg(db, 'never1', 'customer', ago(40 * DAY));
    addConv(db, 'never2');
    addMsg(db, 'never2', 'system', ago(31 * DAY));
    addMsg(db, 'never2', 'agent', ago(31 * DAY), { metadata: '{"broadcastId":"b"}' });
    addMsg(db, 'never2', 'customer', ago(30 * DAY));
    // replied once long ago, then the customer wrote again and was ignored
    addConv(db, 'replied');
    addMsg(db, 'replied', 'customer', ago(50 * DAY));
    addMsg(db, 'replied', 'agent', ago(49 * DAY));
    addMsg(db, 'replied', 'customer', ago(20 * DAY));
    // not stale: answered, closed, deleted, fresh
    addConv(db, 'answered');
    addMsg(db, 'answered', 'customer', ago(40 * DAY));
    addMsg(db, 'answered', 'agent', ago(39 * DAY));
    addConv(db, 'closed', { status: 'closed' });
    addMsg(db, 'closed', 'customer', ago(40 * DAY));
    addConv(db, 'deleted');
    addMsg(db, 'deleted', 'customer', ago(40 * DAY));
    db.prepare("UPDATE conversations SET deleted_at = ? WHERE id = 'deleted'").run(ago(DAY));
    addConv(db, 'fresh');
    addMsg(db, 'fresh', 'customer', ago(DAY));

    expect(await getStaleWaitingSummary(d1Of(db), admin, NOW)).toEqual({ count: 3, neverRepliedCount: 2 });
    const never = await getNeverRepliedIds(d1Of(db), ['never1', 'never2', 'replied', 'fresh']);
    expect([...never].sort()).toEqual(['fresh', 'never1', 'never2']);
  });

  it('respects conversation visibility', async () => {
    const db = build();
    addConv(db, 'mine', { team: 7 });
    addConv(db, 'pool');
    addConv(db, 'theirs', { team: 9 });
    ['mine', 'pool', 'theirs'].forEach(id => addMsg(db, id, 'customer', ago(30 * DAY)));
    expect((await getStaleWaitingSummary(d1Of(db), admin, NOW)).count).toBe(3);
    expect((await getStaleWaitingSummary(d1Of(db), agentOfTeam(7), NOW)).count).toBe(2);
    expect((await getStaleWaitingSummary(d1Of(db), agentOfTeam(), NOW)).count).toBe(1);
  });

  it('a sign-off after a reply is not stale waiting', async () => {
    const db = build();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', ago(40 * DAY));
    addMsg(db, 'c', 'agent', ago(39 * DAY));
    addMsg(db, 'c', 'customer', ago(38 * DAY), { content: '謝謝' });
    expect((await getStaleWaitingSummary(d1Of(db), admin, NOW)).count).toBe(0);
  });

  it('reads through the partial index, not the table', () => {
    const db = build();
    const plan = (db.prepare(`EXPLAIN QUERY PLAN
      SELECT COUNT(*) FROM conversations c
      WHERE c.awaiting_since IS NOT NULL AND c.awaiting_since < ? AND c.status <> 'closed' AND c.deleted_at IS NULL`)
      .all('x') as Array<{ detail: string }>).map(p => p.detail).join(' | ');
    expect(plan).toContain('idx_conversations_awaiting_since');
  });
});
