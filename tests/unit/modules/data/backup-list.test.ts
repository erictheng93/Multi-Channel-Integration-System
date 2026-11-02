import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('@/middleware/auth', () => ({
  jwtAuth: async (_c: unknown, next: () => Promise<void>) => next(),
  requireRole: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

import backupHandler, { listPrefix } from '@/modules/data/handlers/backup';
import { BACKUP_POLICY, BACKUP_PREFIXES } from '@/modules/data/services/backup-policy';

type Obj = { key: string; size: number; uploaded: Date };

/** In-memory R2 that honours prefix, limit, cursor and truncated like the real list(). */
function fakeBucket(objects: Obj[], pageLimit = 1000) {
  const list = vi.fn(async (opts: { prefix?: string; limit?: number; cursor?: string }) => {
    const matching = objects.filter((o) => o.key.startsWith(opts.prefix ?? ''));
    const start = opts.cursor ? Number(opts.cursor) : 0;
    const size = Math.min(opts.limit ?? 1000, pageLimit);
    const slice = matching.slice(start, start + size);
    const truncated = start + size < matching.length;
    return { objects: slice, truncated, cursor: truncated ? String(start + size) : undefined };
  });
  return { bucket: { list } as unknown as R2Bucket, list };
}

const obj = (key: string, day: number): Obj => ({
  key,
  size: 10,
  uploaded: new Date(Date.UTC(2026, 9, day)),
});

describe('listPrefix (BK1)', () => {
  it('follows truncated/cursor so more than one page is returned', async () => {
    const many = Array.from({ length: 25 }, (_, i) => obj(`daily/d-${String(i).padStart(2, '0')}.sql.gz`, 1));
    const { bucket, list } = fakeBucket(many, 10);
    const r = await listPrefix(bucket, 'daily');
    expect(r.items).toHaveLength(25);
    expect(r.incomplete).toBe(false);
    expect(list).toHaveBeenCalledTimes(3);
    expect(list.mock.calls[0]?.[0]).toMatchObject({ prefix: 'daily/' });
    expect(list.mock.calls[1]?.[0]).toMatchObject({ cursor: '10' });
  });

  it('reports incompleteness instead of hiding it when the page bound is hit', async () => {
    const many = Array.from({ length: 30_000 }, (_, i) => obj(`manual/m-${i}.sql`, 1));
    const { bucket } = fakeBucket(many);
    const r = await listPrefix(bucket, 'manual');
    expect(r.items).toHaveLength(10_000);
    expect(r.incomplete).toBe(true);
  });

  it('empty prefix returns nothing', async () => {
    const { bucket } = fakeBucket([]);
    expect(await listPrefix(bucket, 'tags')).toEqual({ items: [], incomplete: false });
  });
});

describe('GET /api/data/backup', () => {
  const app = new Hono();
  app.route('/', backupHandler);

  it('lists every prefix, newest first, with per-tier counts and the policy constants', async () => {
    const { bucket } = fakeBucket([
      obj('daily/a.sql.gz', 2),
      obj('daily/b.sql.gz', 5),
      obj('monthly/m.sql.gz', 1),
      obj('members/x.sql.gz', 3),
      obj('tags/t.sql.gz', 4),
      obj('assignments/s.sql.gz', 6),
      obj('manual/z.sql', 7),
    ]);
    const res = await app.request('/', {}, { R2_BACKUP: bucket } as never);
    const body = (await res.json()) as { data: any };
    expect(body.data.count).toBe(7);
    expect(body.data.items[0].key).toBe('manual/z.sql');
    expect(body.data.lastAuto.key).toBe('daily/b.sql.gz');
    expect(body.data.countsByTier).toEqual({ daily: 2, monthly: 1, manual: 1, members: 1, tags: 1, assignments: 1 });
    expect(Object.keys(body.data.countsByTier).sort()).toEqual([...BACKUP_PREFIXES].sort());
    expect(body.data.incompletePrefixes).toEqual([]);
    expect(body.data.policy).toEqual(BACKUP_POLICY);
  });

  it('policy documents the configured schedule and retention as constants', () => {
    expect(BACKUP_POLICY.source).toBe('configuration-constants');
    expect(BACKUP_POLICY.schedule).toMatchObject({ cron: '0 19 * * *', timezone: 'Asia/Taipei', localTime: '03:00' });
    expect(BACKUP_POLICY.retentionDays).toEqual({
      daily: 30, monthly: 365, members: 365, tags: 365, assignments: 365, manual: 90,
    });
  });

  it('no backups yet: empty list, null lastAuto', async () => {
    const { bucket } = fakeBucket([]);
    const res = await app.request('/', {}, { R2_BACKUP: bucket } as never);
    const body = (await res.json()) as { data: any };
    expect(body.data.count).toBe(0);
    expect(body.data.lastAuto).toBeNull();
  });
});
