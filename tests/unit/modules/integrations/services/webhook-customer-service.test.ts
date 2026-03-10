// webhook-customer-service.ts Unit Tests
// Tests for findOrCreateCustomer, triggerBackgroundSyncIfNeeded

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
  desc: (...args: any[]) => ({ type: 'desc', args }),
}));

// DB mock state
const mockGet = vi.fn();
const mockInsertValues = vi.fn();

function createSelectChain() {
  const chain: Record<string, any> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.get = mockGet;
  return chain;
}

function createInsertChain() {
  const chain: Record<string, any> = {};
  chain.values = mockInsertValues.mockReturnValue(chain);
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

const mockDb = {
  select: vi.fn().mockImplementation(() => createSelectChain()),
  insert: vi.fn().mockImplementation(() => createInsertChain()),
};

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => mockDb),
}));

vi.mock('@/db/schema', () => ({
  customers: {
    id: { name: 'id' },
    platform: { name: 'platform' },
    platformUserId: { name: 'platformUserId' },
    displayName: { name: 'displayName' },
    avatarUrl: { name: 'avatarUrl' },
    createdAt: { name: 'createdAt' },
    updatedAt: { name: 'updatedAt' },
  },
  customerTeamAssignments: {
    platformUserId: { name: 'platformUserId' },
    displayName: { name: 'displayName' },
    assignedAt: { name: 'assignedAt' },
  },
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-03-09T12:00:00.000Z'),
}));

// Mock user-sync service
const mockSyncLineUser = vi.fn();
const mockSyncFacebookUser = vi.fn();
const mockNeedsUpdate = vi.fn();

vi.mock('@/services/user-sync', () => ({
  createUserSyncService: vi.fn(() => ({
    syncLineUser: mockSyncLineUser,
    syncFacebookUser: mockSyncFacebookUser,
    needsUpdate: mockNeedsUpdate,
  })),
}));

import {
  findOrCreateCustomer,
  triggerBackgroundSyncIfNeeded,
} from '@modules/integrations/services/webhook-customer-service';

const mockEnv = { DB: {} } as any;

describe('webhook-customer-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // findOrCreateCustomer
  // =========================================================================
  describe('findOrCreateCustomer', () => {
    it('should return existing customer without creating', async () => {
      const existing = { id: 1, platformUserId: 'U123', platform: 'line', displayName: 'User' };
      mockGet.mockResolvedValueOnce(existing);

      const result = await findOrCreateCustomer(mockEnv, 'U123', 'line');

      expect(result).toEqual(existing);
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockSyncLineUser).not.toHaveBeenCalled();
    });

    it('should create new LINE customer with synced profile', async () => {
      // First select: no existing customer
      mockGet.mockResolvedValueOnce(undefined);
      // user-sync returns profile
      mockSyncLineUser.mockResolvedValueOnce({
        displayName: 'LINE User Profile',
        pictureUrl: 'https://profile.line.me/pic.jpg',
      });
      // Re-query after insert
      const newCustomer = { id: 2, platformUserId: 'U123', platform: 'line', displayName: 'LINE User Profile' };
      mockGet.mockResolvedValueOnce(newCustomer);

      const result = await findOrCreateCustomer(mockEnv, 'U123', 'line');

      expect(result).toEqual(newCustomer);
      expect(mockSyncLineUser).toHaveBeenCalledWith('U123');
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'line',
          platformUserId: 'U123',
          displayName: 'LINE User Profile',
          avatarUrl: 'https://profile.line.me/pic.jpg',
        })
      );
    });

    it('should create new Facebook customer with synced profile', async () => {
      mockGet.mockResolvedValueOnce(undefined);
      mockSyncFacebookUser.mockResolvedValueOnce({
        displayName: 'FB User',
        pictureUrl: 'https://fb.com/pic.jpg',
      });
      const newCustomer = { id: 3, platformUserId: 'FB123', platform: 'facebook', displayName: 'FB User' };
      mockGet.mockResolvedValueOnce(newCustomer);

      const result = await findOrCreateCustomer(mockEnv, 'FB123', 'facebook');

      expect(result).toEqual(newCustomer);
      expect(mockSyncFacebookUser).toHaveBeenCalledWith('FB123');
    });

    it('should use default name when LINE profile sync fails', async () => {
      mockGet.mockResolvedValueOnce(undefined);
      mockSyncLineUser.mockRejectedValueOnce(new Error('API error'));
      // No LIFF assignment found either
      mockGet.mockResolvedValueOnce(undefined);
      // Re-query after insert
      mockGet.mockResolvedValueOnce({ id: 4, displayName: 'LINE User' });

      await findOrCreateCustomer(mockEnv, 'U123', 'line');

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'LINE User' })
      );
    });

    it('should fallback to LIFF-captured name when LINE sync returns generic name', async () => {
      mockGet.mockResolvedValueOnce(undefined);
      // sync returns null profile → displayName stays 'LINE User'
      mockSyncLineUser.mockResolvedValueOnce(null);
      // LIFF assignment found with captured name
      mockGet.mockResolvedValueOnce({ displayName: 'LIFF Captured Name' });
      // Re-query after insert
      mockGet.mockResolvedValueOnce({ id: 5, displayName: 'LIFF Captured Name' });

      await findOrCreateCustomer(mockEnv, 'U123', 'line');

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'LIFF Captured Name' })
      );
    });

    it('should NOT use LIFF fallback for Facebook platform', async () => {
      mockGet.mockResolvedValueOnce(undefined);
      mockSyncFacebookUser.mockResolvedValueOnce(null);
      // Re-query after insert — should use default 'Facebook User'
      mockGet.mockResolvedValueOnce({ id: 6, displayName: 'Facebook User' });

      await findOrCreateCustomer(mockEnv, 'FB123', 'facebook');

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Facebook User' })
      );
      // LIFF query should NOT have been made (only 2 selects: initial + re-query)
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it('should return null when re-query after insert fails', async () => {
      mockGet.mockResolvedValueOnce(undefined); // no existing
      mockSyncLineUser.mockResolvedValueOnce(null);
      mockGet.mockResolvedValueOnce(undefined); // LIFF fallback
      mockGet.mockResolvedValueOnce(undefined); // re-query returns null

      const result = await findOrCreateCustomer(mockEnv, 'U123', 'line');

      expect(result).toBeNull();
    });

    it('should handle LIFF fallback query failure gracefully', async () => {
      mockGet.mockResolvedValueOnce(undefined);
      mockSyncLineUser.mockResolvedValueOnce(null);
      // LIFF query throws
      mockGet.mockRejectedValueOnce(new Error('LIFF DB error'));
      // Re-query after insert
      mockGet.mockResolvedValueOnce({ id: 7, displayName: 'LINE User' });

      const result = await findOrCreateCustomer(mockEnv, 'U123', 'line');

      // Should still succeed with default name
      expect(result).toBeTruthy();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'LINE User' })
      );
    });
  });

  // =========================================================================
  // triggerBackgroundSyncIfNeeded
  // =========================================================================
  describe('triggerBackgroundSyncIfNeeded', () => {
    it('should trigger LINE sync when update needed', async () => {
      mockNeedsUpdate.mockResolvedValueOnce(true);
      mockSyncLineUser.mockResolvedValueOnce(undefined);

      await triggerBackgroundSyncIfNeeded(mockEnv, 'U123', 'line');

      expect(mockNeedsUpdate).toHaveBeenCalledWith('U123', 'line');
      expect(mockSyncLineUser).toHaveBeenCalledWith('U123', undefined);
    });

    it('should trigger Facebook sync when update needed', async () => {
      mockNeedsUpdate.mockResolvedValueOnce(true);
      mockSyncFacebookUser.mockResolvedValueOnce(undefined);

      await triggerBackgroundSyncIfNeeded(mockEnv, 'FB123', 'facebook');

      expect(mockSyncFacebookUser).toHaveBeenCalledWith('FB123');
    });

    it('should NOT sync when update not needed', async () => {
      mockNeedsUpdate.mockResolvedValueOnce(false);

      await triggerBackgroundSyncIfNeeded(mockEnv, 'U123', 'line');

      expect(mockSyncLineUser).not.toHaveBeenCalled();
      expect(mockSyncFacebookUser).not.toHaveBeenCalled();
    });

    it('should pass groupId to LINE sync', async () => {
      mockNeedsUpdate.mockResolvedValueOnce(true);
      mockSyncLineUser.mockResolvedValueOnce(undefined);

      await triggerBackgroundSyncIfNeeded(mockEnv, 'U123', 'line', 'group-1');

      expect(mockSyncLineUser).toHaveBeenCalledWith('U123', 'group-1');
    });

    it('should not throw when needsUpdate check fails', async () => {
      mockNeedsUpdate.mockRejectedValueOnce(new Error('sync check error'));

      // Should not throw
      await expect(
        triggerBackgroundSyncIfNeeded(mockEnv, 'U123', 'line')
      ).resolves.toBeUndefined();
    });

    it('should not throw when background sync fails', async () => {
      mockNeedsUpdate.mockResolvedValueOnce(true);
      mockSyncLineUser.mockRejectedValueOnce(new Error('sync error'));

      // Fire-and-forget — function returns before sync completes
      await expect(
        triggerBackgroundSyncIfNeeded(mockEnv, 'U123', 'line')
      ).resolves.toBeUndefined();
    });
  });
});
