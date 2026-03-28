// SessionStatsService unit tests — priority query and sentiment null
// Verifies that sessionsByPriority uses a real DB JOIN (not hardcoded)
// and sessionsBySentiment returns null.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionStatsService } from '@modules/session/services/session-stats-service';

// ======================== Mock Setup ========================

const mockSelectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn()
};

const mockInsertChain = {
  values: vi.fn().mockReturnThis(),
  run: vi.fn().mockResolvedValue(undefined)
};

const mockDeleteChain = {
  where: vi.fn().mockReturnThis(),
  run: vi.fn().mockResolvedValue(undefined)
};

const mockDb = {
  select: vi.fn(() => mockSelectChain),
  insert: vi.fn(() => mockInsertChain),
  update: vi.fn(() => mockSelectChain),
  delete: vi.fn(() => mockDeleteChain)
};

vi.mock('drizzle-orm/d1', () => ({
  drizzle: () => mockDb
}));

// ======================== Helpers ========================

const arrayToRecord = (
  array: Array<Record<string, unknown>>,
  keyField: string,
  defaultValue: string
): Record<string, number> => {
  const result: Record<string, number> = { [defaultValue]: 0 };
  for (const item of array) {
    const key = String(item[keyField] ?? defaultValue);
    result[key] = (result[key] ?? 0) + Number(item.count ?? 0);
  }
  return result;
};

// ======================== Tests ========================

describe('SessionStatsService', () => {
  let service: SessionStatsService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Restore chain returns after clearAllMocks
    mockSelectChain.from.mockReturnThis();
    mockSelectChain.where.mockReturnThis();
    mockSelectChain.orderBy.mockReturnThis();
    mockSelectChain.limit.mockReturnThis();
    mockSelectChain.offset.mockReturnThis();
    mockSelectChain.groupBy.mockReturnThis();
    mockSelectChain.leftJoin.mockReturnThis();
    mockSelectChain.innerJoin.mockReturnThis();
    mockInsertChain.values.mockReturnThis();
    mockDeleteChain.where.mockReturnThis();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new SessionStatsService(mockDb as any);
  });

  describe('getStats', () => {
    it('should return sessionsBySentiment as null', async () => {
      // basic stats query
      mockSelectChain.get.mockResolvedValueOnce({
        totalSessions: 5,
        activeSessions: 2,
        avgMessages: 3.5
      });
      // type stats query
      mockSelectChain.all
        .mockResolvedValueOnce([{ sessionType: 'continuous', count: 5 }])
        // priority JOIN query
        .mockResolvedValueOnce([]);

      const stats = await service.getStats(undefined, arrayToRecord);

      expect(stats.sessionsBySentiment).toBeNull();
    });

    it('should call innerJoin for priority query (not hardcoded)', async () => {
      mockSelectChain.get.mockResolvedValueOnce({
        totalSessions: 3,
        activeSessions: 1,
        avgMessages: 2
      });
      mockSelectChain.all
        .mockResolvedValueOnce([])  // type stats
        .mockResolvedValueOnce([]); // priority stats

      await service.getStats(undefined, arrayToRecord);

      // innerJoin must have been called for the priority query
      expect(mockSelectChain.innerJoin).toHaveBeenCalledTimes(1);
    });

    it('should aggregate priority counts from DB rows', async () => {
      mockSelectChain.get.mockResolvedValueOnce({
        totalSessions: 10,
        activeSessions: 4,
        avgMessages: 5
      });
      mockSelectChain.all
        .mockResolvedValueOnce([]) // type stats
        .mockResolvedValueOnce([  // priority rows from DB JOIN
          { priority: 'high', count: 3 },
          { priority: 'low', count: 2 },
          { priority: 'urgent', count: 1 },
          { priority: 'normal', count: 4 }  // 'normal' maps to medium fallback
        ]);

      const stats = await service.getStats(undefined, arrayToRecord);

      expect(stats.sessionsByPriority.high).toBe(3);
      expect(stats.sessionsByPriority.low).toBe(2);
      expect(stats.sessionsByPriority.urgent).toBe(1);
      // 'normal' is not a key in the result record, so it falls back to medium
      expect(stats.sessionsByPriority.medium).toBe(4);
    });

    it('should return zero priority counts when DB throws', async () => {
      mockSelectChain.get.mockResolvedValueOnce({
        totalSessions: 2,
        activeSessions: 1,
        avgMessages: 1
      });
      mockSelectChain.all
        .mockResolvedValueOnce([]) // type stats
        .mockRejectedValueOnce(new Error('DB join failed')); // priority query fails

      const stats = await service.getStats(undefined, arrayToRecord);

      expect(stats.sessionsByPriority).toEqual({ low: 0, medium: 0, high: 0, urgent: 0 });
    });

    it('should not set medium to total (old hardcoded behaviour is gone)', async () => {
      const total = 7;
      mockSelectChain.get.mockResolvedValueOnce({
        totalSessions: total,
        activeSessions: 3,
        avgMessages: 2
      });
      mockSelectChain.all
        .mockResolvedValueOnce([]) // type stats
        .mockResolvedValueOnce([]); // no priority rows

      const stats = await service.getStats(undefined, arrayToRecord);

      // With no rows, all counts should be 0 — never equal to total
      expect(stats.sessionsByPriority.medium).toBe(0);
      expect(stats.sessionsByPriority.medium).not.toBe(total);
    });
  });

  describe('batchOperation — add_tags / remove_tags', () => {
    const mockCallbacks = {
      closeSession: vi.fn().mockResolvedValue(true),
      reopenSession: vi.fn().mockResolvedValue(true),
      deleteSession: vi.fn().mockResolvedValue(true)
    };

    it('should insert tags when action is add_tags and userId is provided', async () => {
      // First select: get conversationId for the session
      mockSelectChain.get.mockResolvedValue({ conversationId: 'conv_1' });

      const result = await service.batchOperation(
        {
          sessionIds: ['sess_1'],
          action: 'add_tags',
          data: { tags: ['10', '20'] }
        },
        mockCallbacks,
        'user_42'
      );

      expect(result.successCount).toBe(1);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      expect(mockInsertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: 'conv_1', tagId: 10, assignedBy: 'user_42' })
      );
    });

    it('should skip tag insert when userId is absent', async () => {
      mockSelectChain.get.mockResolvedValue({ conversationId: 'conv_1' });

      const result = await service.batchOperation(
        {
          sessionIds: ['sess_1'],
          action: 'add_tags',
          data: { tags: ['10'] }
        },
        mockCallbacks
        // no userId
      );

      expect(result.successCount).toBe(1);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should delete tags when action is remove_tags', async () => {
      mockSelectChain.get.mockResolvedValue({ conversationId: 'conv_1' });

      const result = await service.batchOperation(
        {
          sessionIds: ['sess_1'],
          action: 'remove_tags',
          data: { tags: ['10', '20'] }
        },
        mockCallbacks,
        'user_42'
      );

      expect(result.successCount).toBe(1);
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });
  });
});
