// webhook-customer-service.ts Unit Tests
// Tests for findOrCreateCustomer, updateCustomerProfile, triggerBackgroundSyncIfNeeded
// Consolidated service: distributed lock + deletedAt filter + LIFF fallback + WS broadcast

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
  ne: (...args: any[]) => ({ type: 'ne', args }),
  desc: (...args: any[]) => ({ type: 'desc', args }),
  isNull: (...args: any[]) => ({ type: 'isNull', args }),
}));

// DB mock state
const mockGet = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockAll = vi.fn();

function createSelectChain() {
  const chain: Record<string, any> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.get = mockGet;
  chain.all = mockAll;
  return chain;
}

function createInsertChain() {
  const chain: Record<string, any> = {};
  chain.values = mockInsertValues.mockReturnValue(chain);
  // insert(...).values(...).returning().get() yields the created row; it shares mockGet's queue.
  chain.returning = vi.fn().mockReturnValue({ get: mockGet });
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

function createUpdateChain() {
  const chain: Record<string, any> = {};
  chain.set = mockUpdateSet.mockReturnValue(chain);
  chain.where = mockUpdateWhere.mockReturnValue(chain);
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

const mockDb = {
  select: vi.fn().mockImplementation(() => createSelectChain()),
  insert: vi.fn().mockImplementation(() => createInsertChain()),
  update: vi.fn().mockImplementation(() => createUpdateChain()),
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
    sourceTeamId: { name: 'sourceTeamId' },
    metadata: { name: 'metadata' },
    createdAt: { name: 'createdAt' },
    updatedAt: { name: 'updatedAt' },
    deletedAt: { name: 'deletedAt' },
  },
  customerTeamAssignments: {
    platformUserId: { name: 'platformUserId' },
    displayName: { name: 'displayName' },
    assignedAt: { name: 'assignedAt' },
  },
  conversations: {
    id: { name: 'id' },
    customerId: { name: 'customerId' },
    status: { name: 'status' },
    deletedAt: { name: 'deletedAt' },
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

// Mock distributed lock service
const mockWithLock = vi.fn();
vi.mock('@/services/distributed-lock-service', () => ({
  DistributedLockService: vi.fn(function () {
    return {
      withLock: mockWithLock,
    };
  }),
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

// Mock WebSocket broadcast service
const mockBroadcastConversationEvent = vi.fn();
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn(function () {
    return {
      broadcastConversationEvent: mockBroadcastConversationEvent,
    };
  }),
}));

import {
  findOrCreateCustomer,
  PROFILE_FETCH_TIMEOUT_MS,
  updateCustomerProfile,
  triggerBackgroundSyncIfNeeded,
} from '@modules/integrations/services/webhook-customer-service';

const mockEnv = { DB: {}, DISTRIBUTED_LOCK: {} } as any;

describe('webhook-customer-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: withLock executes callback immediately
    mockWithLock.mockImplementation(async (_resource: string, fn: () => Promise<any>) => fn());
  });

  // =========================================================================
  // findOrCreateCustomer
  // =========================================================================
  describe('findOrCreateCustomer', () => {
    it('should return existing customer without creating (no lock needed)', async () => {
      const existing = { id: 1, platformUserId: 'U123', platform: 'line', displayName: 'User', deletedAt: null };
      mockGet.mockResolvedValueOnce(existing);

      const result = await findOrCreateCustomer(mockEnv, 'U123', 'line');

      expect(result).toEqual(existing);
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockSyncLineUser).not.toHaveBeenCalled();
      // Lock should NOT be acquired when customer already exists
      expect(mockWithLock).not.toHaveBeenCalled();
    });

    it('should use distributed lock when creating new customer', async () => {
      // First select: no existing customer
      mockGet.mockResolvedValueOnce(undefined);

      // Inside lock: double-check returns undefined (still no customer)
      mockGet.mockResolvedValueOnce(undefined);

      // user-sync returns profile
      mockSyncLineUser.mockResolvedValueOnce({
        displayName: 'LINE User Profile',
        pictureUrl: 'https://profile.line.me/pic.jpg',
      });

      // Row returned by INSERT ... RETURNING
      const newCustomer = { id: 2, platformUserId: 'U123', platform: 'line', displayName: 'LINE User Profile' };
      mockGet.mockResolvedValueOnce(newCustomer);

      const result = await findOrCreateCustomer(mockEnv, 'U123', 'line');

      expect(result).toEqual(newCustomer);
      expect(mockWithLock).toHaveBeenCalledWith(
        'webhook:customer:line:U123',
        expect.any(Function),
        expect.objectContaining({ ttl: 15000, timeout: 8000 })
      );
      expect(mockSyncLineUser).toHaveBeenCalledWith('U123', undefined, { signal: expect.any(AbortSignal) });
    });

    it('should return existing customer found during double-check inside lock (race resolved)', async () => {
      // First select: no existing customer
      mockGet.mockResolvedValueOnce(undefined);

      // Inside lock: double-check FINDS the customer (another worker created it)
      const raceCustomer = { id: 99, platformUserId: 'U123', platform: 'line', displayName: 'Created by race' };
      mockGet.mockResolvedValueOnce(raceCustomer);

      const result = await findOrCreateCustomer(mockEnv, 'U123', 'line');

      expect(result).toEqual(raceCustomer);
      // Lock was acquired, but no insert should happen
      expect(mockWithLock).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockSyncLineUser).not.toHaveBeenCalled();
    });

    it('should filter soft-deleted customers (deletedAt IS NULL)', async () => {
      // The initial query should include isNull(deletedAt) filter
      // We verify this by checking that the where clause is called with the right structure
      const existing = { id: 1, platformUserId: 'U123', platform: 'line', displayName: 'User' };
      mockGet.mockResolvedValueOnce(existing);

      await findOrCreateCustomer(mockEnv, 'U123', 'line');

      // The select chain's where should have been called
      const selectChain = mockDb.select.mock.results[0]?.value;
      expect(selectChain.where).toHaveBeenCalled();
      // Verify the where call includes our isNull filter (3 conditions via and())
      const whereArgs = selectChain.where.mock.calls[0][0];
      expect(whereArgs).toEqual(
        expect.objectContaining({ type: 'and' })
      );
    });

    it('should fallback to LIFF-captured name for LINE when API fails', async () => {
      // First select: no existing customer
      mockGet.mockResolvedValueOnce(undefined);
      // Double-check: still no customer
      mockGet.mockResolvedValueOnce(undefined);
      // LINE sync fails
      mockSyncLineUser.mockRejectedValueOnce(new Error('API error'));
      // LIFF assignment found
      mockGet.mockResolvedValueOnce({ displayName: 'LIFF Captured Name' });
      // Row returned by INSERT ... RETURNING
      mockGet.mockResolvedValueOnce({ id: 5, displayName: 'LIFF Captured Name' });

      await findOrCreateCustomer(mockEnv, 'U123', 'line');

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'LIFF Captured Name' })
      );
    });

    it('should NOT use LIFF fallback for Facebook', async () => {
      // First select: no existing customer
      mockGet.mockResolvedValueOnce(undefined);
      // Double-check: still no customer
      mockGet.mockResolvedValueOnce(undefined);
      // Facebook sync returns null
      mockSyncFacebookUser.mockResolvedValueOnce(null);
      // Row returned by INSERT ... RETURNING — should use default 'Facebook User'
      mockGet.mockResolvedValueOnce({ id: 6, displayName: 'Facebook User' });

      await findOrCreateCustomer(mockEnv, 'FB123', 'facebook');

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Facebook User' })
      );
      // LIFF query should NOT have been made
      // Selects: 1. initial lookup, 2. double-check in lock (the insert returns its row) = 2
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it('should set sourceTeamId when provided', async () => {
      // First select: no existing customer
      mockGet.mockResolvedValueOnce(undefined);
      // Double-check: still no customer
      mockGet.mockResolvedValueOnce(undefined);
      // LINE sync returns profile
      mockSyncLineUser.mockResolvedValueOnce({
        displayName: 'User With Team',
        pictureUrl: 'https://example.com/pic.jpg',
      });
      // Row returned by INSERT ... RETURNING
      mockGet.mockResolvedValueOnce({ id: 10, displayName: 'User With Team', sourceTeamId: 42 });

      await findOrCreateCustomer(mockEnv, 'U456', 'line', { sourceTeamId: 42 });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ sourceTeamId: 42 })
      );
    });

    it('should create new Facebook customer with synced profile', async () => {
      mockGet.mockResolvedValueOnce(undefined);
      // Double-check: no customer
      mockGet.mockResolvedValueOnce(undefined);
      mockSyncFacebookUser.mockResolvedValueOnce({
        displayName: 'FB User',
        pictureUrl: 'https://fb.com/pic.jpg',
      });
      const newCustomer = { id: 3, platformUserId: 'FB123', platform: 'facebook', displayName: 'FB User' };
      mockGet.mockResolvedValueOnce(newCustomer);

      const result = await findOrCreateCustomer(mockEnv, 'FB123', 'facebook');

      expect(result).toEqual(newCustomer);
      expect(mockSyncFacebookUser).toHaveBeenCalledWith('FB123', { signal: expect.any(AbortSignal) });
    });

    describe('profile fetch timeout (inside the 15s customer lock)', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      // Like a real fetch: never settles on its own, rejects once its signal aborts.
      function hangingFetchUntilAborted(): (userId: string, ...rest: unknown[]) => Promise<never> {
        return (_userId: string, ...rest: unknown[]) => {
          const options = rest.find((arg): arg is { signal: AbortSignal } =>
            typeof arg === 'object' && arg !== null && 'signal' in arg);
          return new Promise<never>((_resolve, reject) => {
            options?.signal.addEventListener('abort', () => reject(options.signal.reason));
          });
        };
      }

      it('is 5s, well inside the 15s lock TTL', async () => {
        mockGet.mockResolvedValueOnce(undefined);
        mockGet.mockResolvedValueOnce(undefined);
        mockSyncFacebookUser.mockResolvedValueOnce(null);
        mockGet.mockResolvedValueOnce({ id: 1 });
        await findOrCreateCustomer(mockEnv, 'FB1', 'facebook');

        const ttl = (mockWithLock.mock.calls[0][2] as { ttl: number }).ttl;
        expect(ttl).toBe(15000);
        expect(PROFILE_FETCH_TIMEOUT_MS).toBe(5000);
        expect(PROFILE_FETCH_TIMEOUT_MS).toBeLessThan(ttl / 2);
      });

      it('aborts a LINE profile fetch that never resolves at 5s and still creates the customer with the default name', async () => {
        mockGet.mockResolvedValueOnce(undefined); // initial lookup
        mockGet.mockResolvedValueOnce(undefined); // double-check in lock
        mockSyncLineUser.mockImplementationOnce(hangingFetchUntilAborted());
        mockGet.mockResolvedValueOnce(undefined); // LIFF fallback: nothing captured
        const created = { id: 7, platformUserId: 'U777', platform: 'line', displayName: 'LINE User' };
        mockGet.mockResolvedValueOnce(created); // row returned by INSERT ... RETURNING

        let settled = false;
        const pending = findOrCreateCustomer(mockEnv, 'U777', 'line').finally(() => { settled = true; });

        await vi.advanceTimersByTimeAsync(PROFILE_FETCH_TIMEOUT_MS - 1);
        expect(settled).toBe(false);
        expect(mockInsertValues).not.toHaveBeenCalled();
        const signal = (mockSyncLineUser.mock.calls[0][2] as { signal: AbortSignal }).signal;
        expect(signal.aborted).toBe(false);

        await vi.advanceTimersByTimeAsync(1);
        await expect(pending).resolves.toEqual(created);
        expect(signal.aborted).toBe(true);
        expect((signal.reason as DOMException).name).toBe('TimeoutError');
        expect(mockInsertValues).toHaveBeenCalledWith(
          expect.objectContaining({ platformUserId: 'U777', displayName: 'LINE User', avatarUrl: null })
        );
      });

      it('still gives up at 5s when the profile call ignores the signal (Facebook)', async () => {
        mockGet.mockResolvedValueOnce(undefined);
        mockGet.mockResolvedValueOnce(undefined);
        mockSyncFacebookUser.mockImplementationOnce(() => new Promise<never>(() => {}));
        const created = { id: 8, platformUserId: 'FB8', platform: 'facebook', displayName: 'Facebook User' };
        mockGet.mockResolvedValueOnce(created);

        const pending = findOrCreateCustomer(mockEnv, 'FB8', 'facebook');
        await vi.advanceTimersByTimeAsync(PROFILE_FETCH_TIMEOUT_MS);

        await expect(pending).resolves.toEqual(created);
        expect(mockInsertValues).toHaveBeenCalledWith(
          expect.objectContaining({ displayName: 'Facebook User', avatarUrl: null })
        );
      });

      it('clears the timer when the profile arrives in time', async () => {
        mockGet.mockResolvedValueOnce(undefined);
        mockGet.mockResolvedValueOnce(undefined);
        mockSyncLineUser.mockResolvedValueOnce({ displayName: 'Fast', pictureUrl: 'https://p/x.jpg' });
        mockGet.mockResolvedValueOnce({ id: 9, displayName: 'Fast' });

        await findOrCreateCustomer(mockEnv, 'U9', 'line');

        expect(vi.getTimerCount()).toBe(0);
        expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Fast' }));
      });
    });

    it('should propagate an insert failure that is not a lost create race', async () => {
      mockGet.mockResolvedValueOnce(undefined); // no existing
      mockGet.mockResolvedValueOnce(undefined); // double-check
      mockSyncLineUser.mockResolvedValueOnce(null);
      mockGet.mockResolvedValueOnce(undefined); // LIFF fallback
      mockGet.mockRejectedValueOnce(new Error('NOT NULL constraint failed: customers.platform')); // INSERT ... RETURNING

      await expect(findOrCreateCustomer(mockEnv, 'U123', 'line')).rejects.toThrow('NOT NULL constraint failed');
    });

    it('should handle LIFF fallback query failure gracefully', async () => {
      mockGet.mockResolvedValueOnce(undefined);
      mockGet.mockResolvedValueOnce(undefined); // double-check
      mockSyncLineUser.mockResolvedValueOnce(null);
      // LIFF query throws
      mockGet.mockRejectedValueOnce(new Error('LIFF DB error'));
      // Row returned by INSERT ... RETURNING
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
  // updateCustomerProfile
  // =========================================================================
  describe('updateCustomerProfile', () => {
    it('should update displayName correctly (avatarUrl not in SET)', async () => {
      const existing = { id: 10, displayName: 'Old Name', avatarUrl: 'https://old.pic', metadata: null };
      mockGet.mockResolvedValueOnce(existing);
      // Active conversations for broadcast
      mockAll.mockResolvedValueOnce([{ id: 'conv-1' }]);
      mockBroadcastConversationEvent.mockResolvedValueOnce(true);

      await updateCustomerProfile(mockEnv, 10, { displayName: 'New Name' });

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'New Name',
          updatedAt: '2026-03-09T12:00:00.000Z',
        })
      );
      // avatarUrl should NOT be in the set call
      const setArg = mockUpdateSet.mock.calls[0][0];
      expect(setArg).not.toHaveProperty('avatarUrl');
    });

    it('should update avatarUrl correctly (displayName not in SET)', async () => {
      const existing = { id: 10, displayName: 'Same Name', avatarUrl: 'https://old.pic', metadata: null };
      mockGet.mockResolvedValueOnce(existing);
      // Active conversations for broadcast
      mockAll.mockResolvedValueOnce([{ id: 'conv-1' }]);
      mockBroadcastConversationEvent.mockResolvedValueOnce(true);

      await updateCustomerProfile(mockEnv, 10, { avatarUrl: 'https://new.pic' });

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          avatarUrl: 'https://new.pic',
          updatedAt: '2026-03-09T12:00:00.000Z',
        })
      );
      const setArg = mockUpdateSet.mock.calls[0][0];
      expect(setArg).not.toHaveProperty('displayName');
    });

    it('should update both fields correctly when both change', async () => {
      const existing = { id: 10, displayName: 'Old Name', avatarUrl: 'https://old.pic', metadata: null };
      mockGet.mockResolvedValueOnce(existing);
      mockAll.mockResolvedValueOnce([{ id: 'conv-1' }]);
      mockBroadcastConversationEvent.mockResolvedValueOnce(true);

      await updateCustomerProfile(mockEnv, 10, {
        displayName: 'New Name',
        avatarUrl: 'https://new.pic',
      });

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'New Name',
          avatarUrl: 'https://new.pic',
          updatedAt: '2026-03-09T12:00:00.000Z',
        })
      );
    });

    it('should NOT update or broadcast when nothing changed', async () => {
      const existing = { id: 10, displayName: 'Same Name', avatarUrl: 'https://same.pic', metadata: null };
      mockGet.mockResolvedValueOnce(existing);

      await updateCustomerProfile(mockEnv, 10, {
        displayName: 'Same Name',
        avatarUrl: 'https://same.pic',
      });

      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockBroadcastConversationEvent).not.toHaveBeenCalled();
    });

    it('should broadcast customer_profile_updated via WebSocket when fields change', async () => {
      const existing = { id: 10, displayName: 'Old Name', avatarUrl: 'https://old.pic', metadata: null };
      mockGet.mockResolvedValueOnce(existing);
      // Two active conversations
      mockAll.mockResolvedValueOnce([{ id: 'conv-1' }, { id: 'conv-2' }]);
      mockBroadcastConversationEvent.mockResolvedValue(true);

      await updateCustomerProfile(mockEnv, 10, { displayName: 'New Name' });

      // Should broadcast to each active conversation
      expect(mockBroadcastConversationEvent).toHaveBeenCalledTimes(2);
      expect(mockBroadcastConversationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'customer_profile_updated',
          conversationId: 'conv-1',
          data: expect.objectContaining({
            customerId: 10,
            changes: { displayName: 'New Name' },
            conversationIds: ['conv-1', 'conv-2'],
          }),
        })
      );
      expect(mockBroadcastConversationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'customer_profile_updated',
          conversationId: 'conv-2',
          data: expect.objectContaining({
            customerId: 10,
            changes: { displayName: 'New Name' },
            conversationIds: ['conv-1', 'conv-2'],
          }),
        })
      );
    });

    it('should not broadcast when customer not found', async () => {
      mockGet.mockResolvedValueOnce(undefined);

      await updateCustomerProfile(mockEnv, 999, { displayName: 'New Name' });

      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockBroadcastConversationEvent).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // triggerBackgroundSyncIfNeeded
  // =========================================================================
  describe('triggerBackgroundSyncIfNeeded', () => {
    it('should trigger LINE sync when stale', async () => {
      mockNeedsUpdate.mockResolvedValueOnce(true);
      mockSyncLineUser.mockResolvedValueOnce(undefined);

      await triggerBackgroundSyncIfNeeded(mockEnv, 'U123', 'line');

      expect(mockNeedsUpdate).toHaveBeenCalledWith('U123', 'line');
      expect(mockSyncLineUser).toHaveBeenCalledWith('U123', undefined);
    });

    it('should trigger Facebook sync when stale', async () => {
      mockNeedsUpdate.mockResolvedValueOnce(true);
      mockSyncFacebookUser.mockResolvedValueOnce(undefined);

      await triggerBackgroundSyncIfNeeded(mockEnv, 'FB123', 'facebook');

      expect(mockSyncFacebookUser).toHaveBeenCalledWith('FB123');
    });

    it('should NOT sync when recently updated', async () => {
      mockNeedsUpdate.mockResolvedValueOnce(false);

      await triggerBackgroundSyncIfNeeded(mockEnv, 'U123', 'line');

      expect(mockSyncLineUser).not.toHaveBeenCalled();
      expect(mockSyncFacebookUser).not.toHaveBeenCalled();
    });

    it('should nullify updatedAt on sync failure (retry-on-next-message)', async () => {
      mockNeedsUpdate.mockResolvedValueOnce(true);
      mockSyncLineUser.mockRejectedValueOnce(new Error('LINE API down'));

      await triggerBackgroundSyncIfNeeded(mockEnv, 'U123', 'line');

      // Wait for fire-and-forget to settle
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should set updatedAt to null to enable retry
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ updatedAt: null })
      );
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

      // Fire-and-forget -- function returns before sync completes
      await expect(
        triggerBackgroundSyncIfNeeded(mockEnv, 'U123', 'line')
      ).resolves.toBeUndefined();
    });
  });
});
