import { describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';
import type { Database } from '@/db/drizzle-factory';
import { BroadcastService } from '@/modules/broadcast/services/broadcast-service';
import { broadcasts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createBroadcastFixture } from './broadcast-fixture';

describe('BroadcastService pagination ordering', () => {
  it('checks existence without attachment access and excludes soft-deleted records', async () => {
    const { sqlite, db } = createBroadcastFixture();
    try {
      await db.insert(broadcasts).values({ id: 'b-1', title: '通知', content: 'Hello', tagIds: '[1]', createdBy: 'agent-1' });
      const service = new BroadcastService(db, {} as Bindings);
      // Removing the attachments table proves this path cannot hydrate/sign attachments.
      sqlite.exec('DROP TABLE broadcast_attachments');
      expect(await service.findTitle('b-1', null)).toBe('通知');
      expect(await service.findTitle('b-1', 'agent-1')).toBe('通知');
      expect(await service.findTitle('b-1', 'agent-2')).toBeNull();
      expect(await service.findTitle('missing', null)).toBeNull();
      await db.update(broadcasts).set({ deletedAt: '2026-10-13T00:00:00Z' }).where(eq(broadcasts.id, 'b-1'));
      expect(await service.findTitle('b-1', null)).toBeNull();
    } finally {sqlite.close();}
  });
  it('uses a stable id tiebreaker for broadcast history pagination', async () => {
    const orderBy = vi.fn(() => ({
      limit: vi.fn(() => ({
        offset: vi.fn(async () => []),
      })),
    }));
    const db = createBroadcastListDb(orderBy);
    const service = new BroadcastService(db, {} as Bindings);

    await service.list(1, 20, null);

    expect(orderBy).toHaveBeenCalledTimes(1);
    expect(orderBy.mock.calls[0]).toHaveLength(2);
  });

  it('uses a stable id tiebreaker for recipient detail pagination', async () => {
    const orderBy = vi.fn(() => ({
      limit: vi.fn(() => ({
        offset: vi.fn(async () => []),
      })),
    }));
    const db = createRecipientListDb(orderBy);
    const service = new BroadcastService(db, {} as Bindings);

    await service.listRecipients('broadcast-1', 1, 20);

    expect(orderBy).toHaveBeenCalledTimes(1);
    expect(orderBy.mock.calls[0]).toHaveLength(2);
  });
});

function createBroadcastListDb(orderBy: ReturnType<typeof vi.fn>): Database {
  let selectCalls = 0;
  const db = {
    select: vi.fn(() => {
      selectCalls += 1;
      if (selectCalls === 1) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(async () => [{ total: 0 }]),
          })),
        };
      }

      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({ orderBy })),
        })),
      };
    }),
  };

  return db as unknown as Database;
}

function createRecipientListDb(orderBy: ReturnType<typeof vi.fn>): Database {
  let selectCalls = 0;
  const db = {
    select: vi.fn(() => {
      selectCalls += 1;
      if (selectCalls === 1) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(async () => [{ total: 0 }]),
          })),
        };
      }

      return {
        from: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({ orderBy })),
          })),
        })),
      };
    }),
  };

  return db as unknown as Database;
}
