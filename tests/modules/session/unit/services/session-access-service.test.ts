// SessionAccessService.canAccessSession: admin bypass, unassigned pool, team membership, fail-closed.

import { describe, it, expect, vi } from 'vitest';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { SessionAccessService } from '@modules/session/services/session-access-service';

/** Each select().from().where()[.limit()].get() call resolves the next queued result. */
function createDb(results: Array<unknown | Error>) {
  const queue = [...results];
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.get = vi.fn(async () => {
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  const select = vi.fn(() => chain);
  return { db: { select } as unknown as DrizzleD1Database, select };
}

describe('SessionAccessService.canAccessSession', () => {
  it('lets an admin through without any lookup', async () => {
    const { db, select } = createDb([]);
    await expect(new SessionAccessService(db).canAccessSession('s1', 'a1', 'admin')).resolves.toBe(true);
    expect(select).not.toHaveBeenCalled();
  });

  it('denies an agent when the session does not exist', async () => {
    const { db } = createDb([undefined]);
    await expect(new SessionAccessService(db).canAccessSession('s1', 'a1', 'agent')).resolves.toBe(false);
  });

  it('denies an agent when the conversation does not exist', async () => {
    const { db } = createDb([{ id: 's1', conversationId: 'c1' }, undefined]);
    await expect(new SessionAccessService(db).canAccessSession('s1', 'a1', 'agent')).resolves.toBe(false);
  });

  it('lets an agent into the unassigned pool without a membership lookup', async () => {
    const { db, select } = createDb([{ id: 's1', conversationId: 'c1' }, { id: 'c1', assignedTeamId: null }]);
    await expect(new SessionAccessService(db).canAccessSession('s1', 'a1', 'agent')).resolves.toBe(true);
    expect(select).toHaveBeenCalledTimes(2);
  });

  it('lets an agent into a conversation assigned to a team they belong to', async () => {
    const { db } = createDb([{ id: 's1', conversationId: 'c1' }, { id: 'c1', assignedTeamId: 7 }, { teamId: 7 }]);
    await expect(new SessionAccessService(db).canAccessSession('s1', 'a1', 'agent')).resolves.toBe(true);
  });

  it('denies an agent for another team conversation', async () => {
    const { db } = createDb([{ id: 's1', conversationId: 'c1' }, { id: 'c1', assignedTeamId: 7 }, undefined]);
    await expect(new SessionAccessService(db).canAccessSession('s1', 'a1', 'agent')).resolves.toBe(false);
  });

  it('fails closed when the database throws', async () => {
    const { db } = createDb([new Error('d1 down')]);
    await expect(new SessionAccessService(db).canAccessSession('s1', 'a1', 'agent')).resolves.toBe(false);
  });
});
