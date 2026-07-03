import { describe, expect, it, vi } from 'vitest';
import type { Database } from '@/db/drizzle-factory';
import { BroadcastService } from '@/modules/broadcast/services/broadcast-service';

describe('BroadcastService pagination ordering', () => {
  it('uses a stable id tiebreaker for broadcast history pagination', async () => {
    const orderBy = vi.fn(() => ({
      limit: vi.fn(() => ({
        offset: vi.fn(async () => []),
      })),
    }));
    const db = createBroadcastListDb(orderBy);
    const service = new BroadcastService(db);

    await service.list(1, 20);

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
    const service = new BroadcastService(db);

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
