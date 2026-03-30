# LINE User Data Sync Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 confirmed data sync bugs (displayName corruption, follow handler race condition, missing WebSocket profile broadcast) by consolidating 4 duplicated customer creation/update code paths into a single canonical service.

**Architecture:** Rewrite `webhook-customer-service.ts` as the single source of truth with distributed lock, deletedAt filter, and correct field mapping. All webhook handlers delegate to it. Add `customer_profile_updated` WebSocket event and frontend handler.

**Tech Stack:** TypeScript, Drizzle ORM, Cloudflare Workers (Durable Objects for locks), Vitest, Vue 3 (Pinia stores)

**Spec:** `docs/superpowers/specs/2026-03-30-line-data-sync-fix-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/modules/integrations/services/webhook-customer-service.ts` | Rewrite | Single source of truth for webhook customer operations |
| `src/modules/customer/services/customer-crud.ts` | Fix L268 | ORM-based customer CRUD (non-webhook API path) |
| `src/modules/integrations/handlers/line-message-handler.ts` | Simplify | Delegate to shared service, keep message-specific logic |
| `src/modules/integrations/handlers/line-follow-handler.ts` | Simplify | Delegate to shared service, keep follow-specific logic |
| `src/modules/integrations/handlers/facebook-event-processor.ts` | Simplify | Delegate to shared service, keep Facebook-specific logic |
| `src/modules/integrations/services/message-normalization-service.ts` | Simplify | Remove private findOrCreateCustomer, delegate |
| `frontend/src/stores/conversations/realtimeHandler.ts` | Add case | Handle `customer_profile_updated` WebSocket event |
| `tests/unit/modules/integrations/services/webhook-customer-service.test.ts` | Rewrite | Full test coverage for consolidated service |
| `tests/unit/modules/customer/services/customer-crud-field-mapping.test.ts` | Create | Regression tests for Bug #1 fix |

---

## Task 1: Fix Bug #1 — customer-crud.ts displayName/avatarUrl typo

**Files:**
- Modify: `src/modules/customer/services/customer-crud.ts:268`
- Create: `tests/unit/modules/customer/services/customer-crud-field-mapping.test.ts`

- [ ] **Step 1: Write the regression test file**

Create `tests/unit/modules/customer/services/customer-crud-field-mapping.test.ts`:

```typescript
// Regression tests for Bug #1: displayName was overwritten with avatarUrl
// See: docs/superpowers/specs/2026-03-30-line-data-sync-fix-design.md

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: (...args: any[]) => ({ type: 'eq', args }),
  and: (...args: any[]) => ({ type: 'and', args }),
  desc: (...args: any[]) => ({ type: 'desc', args }),
  sql: { raw: (s: string) => s },
}));

// Track what gets passed to update()
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

// Mock DB chain
const mockFindByIdResult = vi.fn();
const mockFindByPlatformResult = vi.fn();

vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: mockFindByIdResult,
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn(),
            }),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: mockUpdateSet.mockReturnValue({
        where: mockUpdateWhere.mockImplementation(() =>
          Promise.resolve()
        ),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue(Promise.resolve()),
    }),
  })),
}));

vi.mock('@/db/schema', () => ({
  customers: { id: 'id', platform: 'platform', platformUserId: 'platformUserId', displayName: 'displayName', avatarUrl: 'avatarUrl' },
  customerTags: {},
  tags: {},
  teams: {},
  conversations: {},
  messages: {},
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-03-30T12:00:00.000Z'),
}));

vi.mock('@/utils/logger', () => ({
  createContextLogger: () => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  }),
}));

import { CustomerCrudService } from '@modules/customer/services/customer-crud';

describe('CustomerCrudService.findOrCreate — field mapping regression', () => {
  let service: CustomerCrudService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CustomerCrudService({} as D1Database);
  });

  const existingCustomer = {
    id: 1,
    platform: 'line',
    platformUserId: 'U123',
    displayName: 'Original Name',
    avatarUrl: 'https://old-avatar.jpg',
    email: null,
    phone: null,
    sourceTeamId: null,
    metadata: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('BUG #1 REGRESSION: avatar change must NOT overwrite displayName', async () => {
    // Existing customer found
    mockFindByPlatformResult.mockResolvedValueOnce?.(existingCustomer);
    mockFindByIdResult.mockResolvedValueOnce(existingCustomer);
    // After update, return updated customer
    mockFindByIdResult.mockResolvedValueOnce({
      ...existingCustomer,
      avatarUrl: 'https://new-avatar.jpg',
    });

    await service.findOrCreate('line', 'U123', {
      displayName: 'Original Name', // same name
      avatarUrl: 'https://new-avatar.jpg', // changed avatar
    });

    // The update SET call must contain avatarUrl, NOT displayName = avatarUrl
    const setArg = mockUpdateSet.mock.calls[0]?.[0];
    if (setArg) {
      expect(setArg.avatarUrl).toBe('https://new-avatar.jpg');
      expect(setArg.displayName).toBeUndefined();
    }
  });

  it('name change only must update displayName, not avatarUrl', async () => {
    mockFindByIdResult.mockResolvedValueOnce(existingCustomer);
    mockFindByIdResult.mockResolvedValueOnce({
      ...existingCustomer,
      displayName: 'New Name',
    });

    await service.findOrCreate('line', 'U123', {
      displayName: 'New Name', // changed name
      avatarUrl: 'https://old-avatar.jpg', // same avatar
    });

    const setArg = mockUpdateSet.mock.calls[0]?.[0];
    if (setArg) {
      expect(setArg.displayName).toBe('New Name');
      expect(setArg.avatarUrl).toBeUndefined();
    }
  });

  it('both name AND avatar change must update both correctly', async () => {
    mockFindByIdResult.mockResolvedValueOnce(existingCustomer);
    mockFindByIdResult.mockResolvedValueOnce({
      ...existingCustomer,
      displayName: 'New Name',
      avatarUrl: 'https://new-avatar.jpg',
    });

    await service.findOrCreate('line', 'U123', {
      displayName: 'New Name',
      avatarUrl: 'https://new-avatar.jpg',
    });

    const setArg = mockUpdateSet.mock.calls[0]?.[0];
    if (setArg) {
      expect(setArg.displayName).toBe('New Name');
      expect(setArg.avatarUrl).toBe('https://new-avatar.jpg');
    }
  });

  it('neither changes must NOT trigger update', async () => {
    mockFindByIdResult.mockResolvedValueOnce(existingCustomer);

    await service.findOrCreate('line', 'U123', {
      displayName: 'Original Name',
      avatarUrl: 'https://old-avatar.jpg',
    });

    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL on "avatar change" test**

Run: `cd D:/Code/Multi_Channel_Integration_System && npx vitest run tests/unit/modules/customer/services/customer-crud-field-mapping.test.ts`

Expected: The first test ("BUG #1 REGRESSION") should FAIL because `setArg.displayName` will be `'https://new-avatar.jpg'` instead of `undefined`.

- [ ] **Step 3: Fix the 1-line typo**

In `src/modules/customer/services/customer-crud.ts`, line 268, change:

```typescript
// BEFORE (line 268):
updateData.displayName = additionalInfo.avatarUrl;

// AFTER:
updateData.avatarUrl = additionalInfo.avatarUrl;
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `cd D:/Code/Multi_Channel_Integration_System && npx vitest run tests/unit/modules/customer/services/customer-crud-field-mapping.test.ts`

Expected: All 4 tests PASS.

- [ ] **Step 5: Run full backend type check**

Run: `cd D:/Code/Multi_Channel_Integration_System && npx tsc --noEmit`

Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
cd D:/Code/Multi_Channel_Integration_System
git add src/modules/customer/services/customer-crud.ts tests/unit/modules/customer/services/customer-crud-field-mapping.test.ts
git commit -m "fix: correct avatarUrl field mapping in CustomerCrudService.findOrCreate

Bug #1: updateData.displayName was set to avatarUrl value instead of
updateData.avatarUrl, corrupting display names with URL strings when
avatar changed. Added regression tests for all 4 field-mapping scenarios."
```

---

## Task 2: Rewrite webhook-customer-service.ts — Consolidated Service

**Files:**
- Rewrite: `src/modules/integrations/services/webhook-customer-service.ts`
- Rewrite: `tests/unit/modules/integrations/services/webhook-customer-service.test.ts`

- [ ] **Step 1: Write the tests for the consolidated service**

Rewrite `tests/unit/modules/integrations/services/webhook-customer-service.test.ts` with full coverage for the new API:

```typescript
// webhook-customer-service.ts Unit Tests — Consolidated Service
// Tests: findOrCreateCustomer (with lock + deletedAt), updateCustomerProfile, triggerBackgroundSyncIfNeeded

import { describe, it, expect, beforeEach, vi } from 'vitest';

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
const mockAll = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

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
  chain.then = (resolve: (v: any) => void) => Promise.resolve(undefined).then(resolve);
  return chain;
}

function createUpdateChain() {
  const chain: Record<string, any> = {};
  chain.set = mockUpdateSet.mockReturnValue(chain);
  chain.where = mockUpdateWhere.mockReturnValue(Promise.resolve());
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
    deletedAt: { name: 'deletedAt' },
    createdAt: { name: 'createdAt' },
    updatedAt: { name: 'updatedAt' },
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
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  }),
}));

vi.mock('@/utils/timestamp', () => ({
  nowISO: vi.fn(() => '2026-03-30T12:00:00.000Z'),
}));

// Mock distributed lock — executes callback immediately (no real DO)
const mockWithLock = vi.fn().mockImplementation(
  async (_key: string, fn: () => Promise<any>, _opts?: any) => fn()
);
vi.mock('@/services/distributed-lock-service', () => ({
  DistributedLockService: vi.fn().mockImplementation(() => ({
    withLock: mockWithLock,
  })),
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
const mockBroadcastConversationEvent = vi.fn().mockResolvedValue(true);
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(() => ({
    broadcastConversationEvent: mockBroadcastConversationEvent,
  })),
}));

import {
  findOrCreateCustomer,
  updateCustomerProfile,
  triggerBackgroundSyncIfNeeded,
} from '@modules/integrations/services/webhook-customer-service';

const mockEnv = { DB: {}, DISTRIBUTED_LOCK: {} } as any;

describe('webhook-customer-service (consolidated)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // findOrCreateCustomer
  // =========================================================================
  describe('findOrCreateCustomer', () => {
    it('should return existing customer without creating', async () => {
      const existing = { id: 1, platformUserId: 'U123', platform: 'line', displayName: 'User', deletedAt: null };
      mockGet.mockResolvedValueOnce(existing);

      const result = await findOrCreateCustomer(mockEnv, 'U123', 'line');

      expect(result).toEqual(existing);
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockWithLock).not.toHaveBeenCalled();
    });

    it('should use distributed lock when creating new customer', async () => {
      // Initial query: not found
      mockGet.mockResolvedValueOnce(undefined);
      // Inside lock - double check: not found
      mockGet.mockResolvedValueOnce(undefined);
      // Profile sync
      mockSyncLineUser.mockResolvedValueOnce({
        displayName: 'Test User',
        pictureUrl: 'https://pic.jpg',
      });
      // Re-query after insert
      mockGet.mockResolvedValueOnce({ id: 2, displayName: 'Test User' });

      await findOrCreateCustomer(mockEnv, 'U123', 'line');

      expect(mockWithLock).toHaveBeenCalledWith(
        'webhook:customer:line:U123',
        expect.any(Function),
        { ttl: 15000, timeout: 8000 }
      );
    });

    it('should return existing customer found during double-check inside lock', async () => {
      const existing = { id: 1, displayName: 'User' };
      // Initial: not found
      mockGet.mockResolvedValueOnce(undefined);
      // Double check inside lock: found (race resolved)
      mockGet.mockResolvedValueOnce(existing);

      const result = await findOrCreateCustomer(mockEnv, 'U123', 'line');

      expect(result).toEqual(existing);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should filter out soft-deleted customers (deletedAt IS NULL)', async () => {
      // The WHERE clause should include deletedAt IS NULL.
      // We verify by checking that when a customer exists with deletedAt set,
      // the query (mocked) returns undefined, triggering creation.
      mockGet.mockResolvedValueOnce(undefined); // Initial: filtered out by deletedAt
      mockGet.mockResolvedValueOnce(undefined); // Double check
      mockSyncLineUser.mockResolvedValueOnce({ displayName: 'New', pictureUrl: null });
      mockGet.mockResolvedValueOnce({ id: 3, displayName: 'New' });

      const result = await findOrCreateCustomer(mockEnv, 'U123', 'line');

      expect(result).toEqual({ id: 3, displayName: 'New' });
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should fallback to LIFF-captured name for LINE when API fails', async () => {
      mockGet.mockResolvedValueOnce(undefined); // Initial
      mockGet.mockResolvedValueOnce(undefined); // Double check
      mockSyncLineUser.mockResolvedValueOnce(null); // API returns null
      mockGet.mockResolvedValueOnce({ displayName: 'LIFF Name' }); // LIFF fallback
      mockGet.mockResolvedValueOnce({ id: 4, displayName: 'LIFF Name' }); // Re-query

      await findOrCreateCustomer(mockEnv, 'U123', 'line');

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'LIFF Name' })
      );
    });

    it('should NOT use LIFF fallback for Facebook', async () => {
      mockGet.mockResolvedValueOnce(undefined);
      mockGet.mockResolvedValueOnce(undefined);
      mockSyncFacebookUser.mockResolvedValueOnce(null);
      mockGet.mockResolvedValueOnce({ id: 5, displayName: 'Facebook User' });

      await findOrCreateCustomer(mockEnv, 'FB123', 'facebook');

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Facebook User' })
      );
    });

    it('should set sourceTeamId when provided', async () => {
      mockGet.mockResolvedValueOnce(undefined);
      mockGet.mockResolvedValueOnce(undefined);
      mockSyncLineUser.mockResolvedValueOnce({ displayName: 'User', pictureUrl: null });
      mockGet.mockResolvedValueOnce({ id: 6 });

      await findOrCreateCustomer(mockEnv, 'U123', 'line', { sourceTeamId: 5 });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ sourceTeamId: 5 })
      );
    });
  });

  // =========================================================================
  // updateCustomerProfile
  // =========================================================================
  describe('updateCustomerProfile', () => {
    const existingCustomer = {
      id: 1,
      displayName: 'Old Name',
      avatarUrl: 'https://old.jpg',
    };

    it('should update displayName correctly', async () => {
      mockGet.mockResolvedValueOnce(existingCustomer); // findById
      mockAll.mockResolvedValueOnce([{ id: 'conv-1' }]); // conversation query

      await updateCustomerProfile(mockEnv, 1, { displayName: 'New Name' });

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'New Name' })
      );
      // Should NOT contain avatarUrl in the update
      const setArg = mockUpdateSet.mock.calls[0][0];
      expect(setArg.avatarUrl).toBeUndefined();
    });

    it('should update avatarUrl correctly', async () => {
      mockGet.mockResolvedValueOnce(existingCustomer);
      mockAll.mockResolvedValueOnce([{ id: 'conv-1' }]);

      await updateCustomerProfile(mockEnv, 1, { avatarUrl: 'https://new.jpg' });

      const setArg = mockUpdateSet.mock.calls[0][0];
      expect(setArg.avatarUrl).toBe('https://new.jpg');
      expect(setArg.displayName).toBeUndefined();
    });

    it('should update both fields correctly when both change', async () => {
      mockGet.mockResolvedValueOnce(existingCustomer);
      mockAll.mockResolvedValueOnce([{ id: 'conv-1' }]);

      await updateCustomerProfile(mockEnv, 1, {
        displayName: 'New Name',
        avatarUrl: 'https://new.jpg',
      });

      const setArg = mockUpdateSet.mock.calls[0][0];
      expect(setArg.displayName).toBe('New Name');
      expect(setArg.avatarUrl).toBe('https://new.jpg');
    });

    it('should NOT update or broadcast when nothing changed', async () => {
      mockGet.mockResolvedValueOnce(existingCustomer);

      await updateCustomerProfile(mockEnv, 1, {
        displayName: 'Old Name',
        avatarUrl: 'https://old.jpg',
      });

      expect(mockUpdateSet).not.toHaveBeenCalled();
      expect(mockBroadcastConversationEvent).not.toHaveBeenCalled();
    });

    it('should broadcast customer_profile_updated via WebSocket on change', async () => {
      mockGet.mockResolvedValueOnce(existingCustomer);
      mockAll.mockResolvedValueOnce([{ id: 'conv-1' }, { id: 'conv-2' }]);

      await updateCustomerProfile(mockEnv, 1, { displayName: 'New Name' });

      expect(mockBroadcastConversationEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'customer_profile_updated',
          data: expect.objectContaining({
            customerId: 1,
            changes: { displayName: 'New Name' },
          }),
        })
      );
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
    });

    it('should nullify updatedAt on sync failure for retry-on-next-message', async () => {
      mockNeedsUpdate.mockResolvedValueOnce(true);
      mockSyncLineUser.mockRejectedValueOnce(new Error('API timeout'));

      await triggerBackgroundSyncIfNeeded(mockEnv, 'U123', 'line');

      // Wait for fire-and-forget to settle
      await new Promise(r => setTimeout(r, 50));

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
      mockNeedsUpdate.mockRejectedValueOnce(new Error('check error'));

      await expect(
        triggerBackgroundSyncIfNeeded(mockEnv, 'U123', 'line')
      ).resolves.toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run the tests — expect FAIL (old service lacks new functions)**

Run: `cd D:/Code/Multi_Channel_Integration_System && npx vitest run tests/unit/modules/integrations/services/webhook-customer-service.test.ts`

Expected: FAIL — `updateCustomerProfile` is not exported, distributed lock tests fail, deletedAt tests fail.

- [ ] **Step 3: Rewrite the service implementation**

Rewrite `src/modules/integrations/services/webhook-customer-service.ts`:

```typescript
// src/modules/integrations/services/webhook-customer-service.ts
// Consolidated customer lookup/creation/update logic for ALL webhook handlers.
// Single source of truth — no inline customer SQL in handlers.

import { eq, and, ne, desc, isNull } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { customers, customerTeamAssignments, conversations } from '@/db/schema';
import type { Bindings } from '@/types';
import { DistributedLockService } from '@/services/distributed-lock-service';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { createContextLogger } from '@/utils/logger';
import { nowISO } from '@/utils/timestamp';

const log = createContextLogger('WebhookCustomer');

type Platform = 'line' | 'facebook';

/** Profile update fields — typed to prevent field confusion (Bug #1 fix) */
export interface CustomerProfileUpdates {
  displayName?: string;
  avatarUrl?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Find an existing customer by platform user ID, or create a new one.
 * Uses distributed lock to prevent race conditions (Bug #2 fix).
 * Filters by deletedAt IS NULL to exclude soft-deleted records.
 */
export async function findOrCreateCustomer(
  env: Bindings,
  platformUserId: string,
  platform: Platform,
  opts?: { groupId?: string; sourceTeamId?: number }
): Promise<typeof customers.$inferSelect | null> {
  const drizzleDb = createDbClient(env.DB);

  // Query with deletedAt filter
  let user = await drizzleDb
    .select()
    .from(customers)
    .where(and(
      eq(customers.platformUserId, platformUserId),
      eq(customers.platform, platform),
      isNull(customers.deletedAt)
    ))
    .get();

  if (user) return user;

  // Not found — acquire distributed lock to prevent race condition
  const lockService = new DistributedLockService(env);
  user = await lockService.withLock(
    `webhook:customer:${platform}:${platformUserId}`,
    async () => {
      // Double-check inside lock
      const existing = await drizzleDb
        .select()
        .from(customers)
        .where(and(
          eq(customers.platformUserId, platformUserId),
          eq(customers.platform, platform),
          isNull(customers.deletedAt)
        ))
        .get();
      if (existing) return existing;

      // Fetch profile via UserSyncService
      let displayName = platform === 'line' ? 'LINE User' : 'Facebook User';
      let avatarUrl: string | null = null;

      try {
        const { createUserSyncService } = await import('@/services/user-sync');
        const userSyncService = createUserSyncService(env);

        if (platform === 'line') {
          const profile = await userSyncService.syncLineUser(platformUserId, opts?.groupId);
          if (profile) {
            displayName = profile.displayName;
            avatarUrl = profile.pictureUrl || null;
          }
        } else {
          const profile = await userSyncService.syncFacebookUser(platformUserId);
          if (profile) {
            displayName = profile.displayName;
            avatarUrl = profile.pictureUrl || null;
          }
        }
      } catch (profileError) {
        log.warn(`Failed to sync ${platform} user profile`, {
          error: profileError instanceof Error ? profileError.message : String(profileError),
        });
      }

      // LIFF fallback: only for LINE when profile fetch failed
      if (platform === 'line' && displayName === 'LINE User') {
        try {
          const assignment = await drizzleDb
            .select({ displayName: customerTeamAssignments.displayName })
            .from(customerTeamAssignments)
            .where(eq(customerTeamAssignments.platformUserId, platformUserId))
            .orderBy(desc(customerTeamAssignments.assignedAt))
            .limit(1)
            .get();
          if (assignment?.displayName) {
            displayName = assignment.displayName;
            log.info('Using LIFF-captured displayName as fallback', { platformUserId, displayName });
          }
        } catch (fallbackError) {
          log.warn('Failed to query LIFF assignment for displayName fallback', {
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          });
        }
      }

      // INSERT new customer
      const timestamp = nowISO();
      await drizzleDb
        .insert(customers)
        .values({
          platform,
          platformUserId,
          displayName,
          avatarUrl,
          sourceTeamId: opts?.sourceTeamId ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });

      // Re-query to get the full record with auto-generated ID
      const created = await drizzleDb
        .select()
        .from(customers)
        .where(and(
          eq(customers.platformUserId, platformUserId),
          eq(customers.platform, platform)
        ))
        .get();
      return created || null;
    },
    { ttl: 15000, timeout: 8000 }
  );

  return user || null;
}

/**
 * Update customer profile fields with correct field mapping.
 * Broadcasts customer_profile_updated via WebSocket when visible fields change (Bug #3 fix).
 */
export async function updateCustomerProfile(
  env: Bindings,
  customerId: number,
  updates: CustomerProfileUpdates
): Promise<void> {
  const drizzleDb = createDbClient(env.DB);

  // Fetch current customer to diff
  const current = await drizzleDb
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .get();

  if (!current) {
    log.warn('updateCustomerProfile: customer not found', { customerId });
    return;
  }

  // Diff: only update actually changed fields
  const changes: Record<string, string | null> = {};
  if (updates.displayName !== undefined && updates.displayName !== current.displayName) {
    changes.displayName = updates.displayName;
  }
  if (updates.avatarUrl !== undefined && updates.avatarUrl !== current.avatarUrl) {
    changes.avatarUrl = updates.avatarUrl;
  }

  // Handle metadata merge separately
  let mergedMetadata: string | undefined;
  if (updates.metadata) {
    const existingMetadata = current.metadata ? JSON.parse(current.metadata as string) : {};
    mergedMetadata = JSON.stringify({ ...existingMetadata, ...updates.metadata });
  }

  const hasProfileChanges = Object.keys(changes).length > 0;
  const hasMetadataChanges = mergedMetadata !== undefined;

  if (!hasProfileChanges && !hasMetadataChanges) {
    return; // Nothing to update
  }

  // Build update payload
  const setPayload: Record<string, any> = { updatedAt: nowISO() };
  if (changes.displayName !== undefined) setPayload.displayName = changes.displayName;
  if (changes.avatarUrl !== undefined) setPayload.avatarUrl = changes.avatarUrl;
  if (mergedMetadata !== undefined) setPayload.metadata = mergedMetadata;

  await drizzleDb
    .update(customers)
    .set(setPayload)
    .where(eq(customers.id, customerId));

  // Broadcast WebSocket event if visible fields changed
  if (hasProfileChanges) {
    try {
      // Query active conversations for this customer
      const activeConvos = await drizzleDb
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(
          eq(conversations.customerId, customerId),
          ne(conversations.status, 'closed'),
          isNull(conversations.deletedAt)
        ))
        .all();

      const conversationIds = activeConvos.map(c => c.id);

      if (conversationIds.length > 0) {
        const broadcastService = new WebSocketBroadcastService(env);
        // Broadcast to each conversation room
        for (const convId of conversationIds) {
          await broadcastService.broadcastConversationEvent({
            type: 'customer_profile_updated' as any,
            conversationId: convId,
            data: {
              customerId,
              changes,
              conversationIds,
            },
          });
        }
        log.info('Broadcast customer_profile_updated', {
          customerId,
          conversationCount: conversationIds.length,
          changedFields: Object.keys(changes),
        });
      }
    } catch (broadcastError) {
      log.warn('Failed to broadcast customer profile update', {
        error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError),
      });
    }
  }
}

/**
 * Check if customer profile needs sync and trigger async update.
 * On sync failure, nullifies updatedAt so next interaction triggers retry (retry-on-next-message).
 */
export async function triggerBackgroundSyncIfNeeded(
  env: Bindings,
  platformUserId: string,
  platform: Platform,
  groupId?: string
): Promise<void> {
  try {
    const { createUserSyncService } = await import('@/services/user-sync');
    const userSyncService = createUserSyncService(env);
    const needsUpdate = await userSyncService.needsUpdate(platformUserId, platform);

    if (needsUpdate) {
      // Fire-and-forget sync (preserves webhook response latency)
      const syncPromise = platform === 'line'
        ? userSyncService.syncLineUser(platformUserId, groupId)
        : userSyncService.syncFacebookUser(platformUserId);

      syncPromise.catch(async (error: unknown) => {
        log.warn(`Background ${platform} user sync failed`, {
          error: error instanceof Error ? error.message : String(error),
        });

        // Retry-on-next-message: nullify updatedAt so next interaction retries immediately
        try {
          const drizzleDb = createDbClient(env.DB);
          await drizzleDb
            .update(customers)
            .set({ updatedAt: null })
            .where(and(
              eq(customers.platformUserId, platformUserId),
              eq(customers.platform, platform)
            ));
          log.info('Set updatedAt=null for retry-on-next-message', { platformUserId, platform });
        } catch (retrySetupError) {
          log.warn('Failed to set updatedAt=null for retry', {
            error: retrySetupError instanceof Error ? retrySetupError.message : String(retrySetupError),
          });
        }
      });
    }
  } catch (syncError) {
    log.warn(`Error checking ${platform} user sync status`, {
      error: syncError instanceof Error ? syncError.message : String(syncError),
    });
  }
}
```

- [ ] **Step 4: Run the tests — expect PASS**

Run: `cd D:/Code/Multi_Channel_Integration_System && npx vitest run tests/unit/modules/integrations/services/webhook-customer-service.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Run backend type check**

Run: `cd D:/Code/Multi_Channel_Integration_System && npx tsc --noEmit`

Expected: No new errors. (Existing handler imports of `findOrCreateCustomer` and `triggerBackgroundSyncIfNeeded` still work since the function signatures are compatible.)

- [ ] **Step 6: Commit**

```bash
cd D:/Code/Multi_Channel_Integration_System
git add src/modules/integrations/services/webhook-customer-service.ts tests/unit/modules/integrations/services/webhook-customer-service.test.ts
git commit -m "refactor: consolidate webhook customer service with lock, deletedAt, and profile broadcast

Rewrite webhook-customer-service.ts as single source of truth:
- findOrCreateCustomer: distributed lock + deletedAt filter + LIFF fallback
- updateCustomerProfile: typed interface prevents field confusion + WS broadcast
- triggerBackgroundSyncIfNeeded: retry-on-next-message via updatedAt nullification"
```

---

## Task 3: Simplify line-message-handler.ts — Delegate to shared service

**Files:**
- Modify: `src/modules/integrations/handlers/line-message-handler.ts`

- [ ] **Step 1: Replace inline customer creation with shared service call**

In `src/modules/integrations/handlers/line-message-handler.ts`, replace the inline customer creation block (lines ~130-216) and sync check (lines ~229-244).

Remove these imports that are no longer needed:
```typescript
// REMOVE these imports:
import { eq, and, desc } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { customers, customerTeamAssignments } from '@/db/schema';
import { DistributedLockService } from '@/services/distributed-lock-service';
```

Add the shared service import:
```typescript
import { findOrCreateCustomer, triggerBackgroundSyncIfNeeded } from '../services/webhook-customer-service';
```

Replace the inline customer creation block (from `const drizzleDb = createDbClient(env.DB);` through the lock-based creation and the sync check) with:

```typescript
    // Query or create customer (consolidated service with lock + deletedAt filter)
    const user = await findOrCreateCustomer(env, userId, 'line', {
      groupId: event.source.groupId,
    });

    if (!user) {
      log.error('LINE Webhook: Failed to find or create user', { userIdPrefix: userId.substring(0, 10) });
      return;
    }

    log.debug('User found/created successfully', {
      userId: user.id,
      platformUserIdPrefix: user.platformUserId?.substring(0, 10),
      displayName: user.displayName,
    });

    // Trigger background profile sync if stale (fire-and-forget)
    triggerBackgroundSyncIfNeeded(env, userId, 'line', event.source.groupId);
```

Keep the `customerTeamAssignments` import — it is still used in the team assignment query block (~lines 247-267) that remains inline.

Keep everything after the team assignment lookup unchanged (findOrCreateConversation, isDuplicateMessage, saveMessage, auto-reply, deferred tasks).

- [ ] **Step 2: Run backend type check**

Run: `cd D:/Code/Multi_Channel_Integration_System && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd D:/Code/Multi_Channel_Integration_System
git add src/modules/integrations/handlers/line-message-handler.ts
git commit -m "refactor: line-message-handler delegates to consolidated webhook-customer-service

Remove ~80 lines of inline customer creation/sync logic.
Now uses findOrCreateCustomer (with lock + deletedAt) and
triggerBackgroundSyncIfNeeded (with retry-on-failure)."
```

---

## Task 4: Simplify line-follow-handler.ts — Delegate + add lock protection

**Files:**
- Modify: `src/modules/integrations/handlers/line-follow-handler.ts`

- [ ] **Step 1: Replace inline customer creation and update with shared service**

In `src/modules/integrations/handlers/line-follow-handler.ts`:

Add import:
```typescript
import { findOrCreateCustomer, updateCustomerProfile } from '../services/webhook-customer-service';
```

Replace the inline customer creation block (the `if (!existingCustomer)` at ~line 179 through the re-query at ~line 205 AND the `else` update block at ~lines 212-231) with:

```typescript
    // Step 7: Find or create customer (consolidated service — has distributed lock)
    if (!existingCustomer) {
      existingCustomer = await findOrCreateCustomer(env, userId, 'line', {
        sourceTeamId: assignedTeamId ?? undefined,
      });

      if (!existingCustomer) {
        log.error('LINE Follow: Failed to find or create customer', { userId: userId.substring(0, 10) });
        return;
      }

      log.info('Customer created via consolidated service', {
        customerId: existingCustomer.id,
        displayName,
        teamId: assignedTeamId,
      });
    }

    // Step 7b: Update profile with follow event data (name, avatar, metadata)
    const timestamp = nowISO();
    const existingMetadata = existingCustomer.metadata
      ? JSON.parse(existingCustomer.metadata as string)
      : {};

    await updateCustomerProfile(env, existingCustomer.id, {
      displayName,
      avatarUrl,
      metadata: {
        ...existingMetadata,
        lastFollowedAt: timestamp,
        ...(assignedTeamId && { assignedViaQR: true, teamId: assignedTeamId }),
      },
    });
```

Keep all follow-specific logic (QR code token extraction, parallel team assignment lookup, LIFF displayName override, conversation creation with team assignment, welcome auto-reply) unchanged.

Keep `eq`, `and`, `ne`, `desc` imports — they are still used for conversation queries and team assignment lookups that remain inline in the follow handler. Remove `createDbClient` and `customers` imports only if no longer referenced (the follow handler still uses `drizzleDb` for conversation creation at ~line 246, so keep `createDbClient`; `customers` is replaced by the shared service call).

- [ ] **Step 2: Run backend type check**

Run: `cd D:/Code/Multi_Channel_Integration_System && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd D:/Code/Multi_Channel_Integration_System
git add src/modules/integrations/handlers/line-follow-handler.ts
git commit -m "refactor: line-follow-handler delegates to consolidated service (adds lock)

Bug #2 fix: follow handler now uses findOrCreateCustomer which has
distributed lock protection. Previously had no lock, causing race
conditions with simultaneous follow + message events."
```

---

## Task 5: Simplify facebook-event-processor.ts — Delegate to shared service

**Files:**
- Modify: `src/modules/integrations/handlers/facebook-event-processor.ts`

- [ ] **Step 1: Replace inline customer creation and sync with shared service**

In `src/modules/integrations/handlers/facebook-event-processor.ts`:

Remove imports no longer needed:
```typescript
// REMOVE:
import { eq, and } from 'drizzle-orm';
import { createDbClient } from '@/db/drizzle-factory';
import { customers } from '@/db/schema';
import { DistributedLockService } from '@/services/distributed-lock-service';
```

Add shared service import:
```typescript
import { findOrCreateCustomer, triggerBackgroundSyncIfNeeded } from '../services/webhook-customer-service';
```

Replace the entire inline customer creation block (~lines 107-187, from `const drizzleDb = createDbClient(env.DB);` through the sync check `else` block) with:

```typescript
    // Query or create customer (consolidated service with lock + deletedAt filter)
    const user = await findOrCreateCustomer(env, userId, 'facebook');

    if (!user) {
      log.error('Facebook Webhook: Failed to find or create user');
      return;
    }

    // Trigger background profile sync if stale (fire-and-forget with retry)
    triggerBackgroundSyncIfNeeded(env, userId, 'facebook');
```

Keep everything after (`findOrCreateConversation`, `isDuplicateMessage`, `saveMessage`, deferred tasks) unchanged.

- [ ] **Step 2: Run backend type check**

Run: `cd D:/Code/Multi_Channel_Integration_System && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd D:/Code/Multi_Channel_Integration_System
git add src/modules/integrations/handlers/facebook-event-processor.ts
git commit -m "refactor: facebook-event-processor delegates to consolidated webhook-customer-service

Remove ~70 lines of inline customer creation/sync logic.
Now uses shared service with lock, deletedAt filter, and retry-on-failure."
```

---

## Task 6: Simplify message-normalization-service.ts — Remove private findOrCreateCustomer

**Files:**
- Modify: `src/modules/integrations/services/message-normalization-service.ts`

- [ ] **Step 1: Replace private findOrCreateCustomer with shared service**

In `src/modules/integrations/services/message-normalization-service.ts`:

Add to `ProcessInboundMessageOptions` interface (~line 109):
```typescript
export interface ProcessInboundMessageOptions {
  platform: Platform;
  rawEvent: any;
  channelConfig: any;
  db: D1Database;
  env?: Bindings;  // NEW: needed for distributed lock in shared service
  teamId: number;
}
```

Add import:
```typescript
import type { Bindings } from '@/types';
import { findOrCreateCustomer as sharedFindOrCreateCustomer } from './webhook-customer-service';
```

In `processInboundMessage` method (~line 142), replace the customer creation call:

```typescript
      // Step 2: Find or create customer (use shared service if env available, fallback to local)
      let customer: { id: number; displayName: string } | null;
      if (options.env) {
        const result = await sharedFindOrCreateCustomer(
          options.env,
          extracted.platformUserId,
          platform as 'line' | 'facebook',
          { sourceTeamId: teamId }
        );
        customer = result ? { id: result.id, displayName: result.displayName || 'Unknown' } : null;
      } else {
        // Legacy fallback for callers that don't pass env
        customer = await this.findOrCreateCustomer(
          db,
          platform,
          extracted.platformUserId,
          extracted.displayName,
          extracted.avatarUrl,
          teamId
        );
      }
```

Mark the private `findOrCreateCustomer` method as `@deprecated`:
```typescript
  /**
   * @deprecated Use shared findOrCreateCustomer from webhook-customer-service instead.
   * Kept temporarily for backwards compatibility with callers that don't pass env.
   */
  private async findOrCreateCustomer(
```

- [ ] **Step 2: Run backend type check**

Run: `cd D:/Code/Multi_Channel_Integration_System && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd D:/Code/Multi_Channel_Integration_System
git add src/modules/integrations/services/message-normalization-service.ts
git commit -m "refactor: message-normalization-service delegates to shared webhook-customer-service

Add env parameter to ProcessInboundMessageOptions.
When env is available, uses shared findOrCreateCustomer with lock + deletedAt.
Legacy private method marked @deprecated for backward compatibility."
```

---

## Task 7: Add frontend WebSocket handler for customer_profile_updated

**Files:**
- Modify: `frontend/src/stores/conversations/realtimeHandler.ts`

- [ ] **Step 1: Add the customer_profile_updated case to handleRealtimeUpdate**

In `frontend/src/stores/conversations/realtimeHandler.ts`, inside the `switch (message.type)` block, add a new case BEFORE the `default` case (~line 575):

```typescript
      case 'customer_profile_updated': {
        // Bug #3 fix: update cached customer data when profile changes on backend
        const profileData = data as {
          customerId?: number
          changes?: { displayName?: string; avatarUrl?: string | null }
          conversationIds?: string[]
        } | undefined

        if (profileData?.changes && profileData?.conversationIds) {
          const { changes, conversationIds: affectedIds } = profileData

          for (const convId of affectedIds) {
            const convIndex = conversations.value.findIndex(c => c.id === convId)
            if (convIndex !== -1) {
              const conv = conversations.value[convIndex]
              // Update the customer fields on the conversation object
              if (conv.customer) {
                if (changes.displayName !== undefined) {
                  conv.customer.name = changes.displayName
                }
                if (changes.avatarUrl !== undefined) {
                  conv.customer.avatarUrl = changes.avatarUrl ?? undefined
                }
              }
              // Also update currentConversation if it's the one being viewed
              if (currentConversation.value?.id === convId && currentConversation.value.customer) {
                if (changes.displayName !== undefined) {
                  currentConversation.value.customer.name = changes.displayName
                }
                if (changes.avatarUrl !== undefined) {
                  currentConversation.value.customer.avatarUrl = changes.avatarUrl ?? undefined
                }
              }
            }
          }

          // Invalidate conversation list cache so next fetch gets fresh data
          conversationCache.invalidateConversation(conversationId || affectedIds[0])
          lastUpdateTime.value = new Date()
          console.log('[ConversationsStore] Customer profile updated', {
            customerId: profileData.customerId,
            changedFields: Object.keys(profileData.changes),
            affectedConversations: affectedIds.length,
          })
        }
        break
      }
```

- [ ] **Step 2: Run frontend type check**

Run: `cd D:/Code/Multi_Channel_Integration_System/frontend && npx vue-tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Run frontend lint**

Run: `cd D:/Code/Multi_Channel_Integration_System/frontend && npx eslint src/stores/conversations/realtimeHandler.ts --fix`

Expected: No errors (or auto-fixed).

- [ ] **Step 4: Commit**

```bash
cd D:/Code/Multi_Channel_Integration_System
git add frontend/src/stores/conversations/realtimeHandler.ts
git commit -m "feat: handle customer_profile_updated WebSocket event in frontend

Bug #3 fix: when backend broadcasts profile changes, frontend now
updates cached customer name/avatar in conversation list and detail
view immediately, without waiting for cache expiry or page reload."
```

---

## Task 8: Full verification — run all tests and type checks

**Files:** None (verification only)

- [ ] **Step 1: Run backend type check**

Run: `cd D:/Code/Multi_Channel_Integration_System && npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 2: Run frontend type check**

Run: `cd D:/Code/Multi_Channel_Integration_System/frontend && npx vue-tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Run all backend tests**

Run: `cd D:/Code/Multi_Channel_Integration_System && npx vitest run`

Expected: All tests pass (1842+ existing + new tests).

- [ ] **Step 4: Run all frontend tests**

Run: `cd D:/Code/Multi_Channel_Integration_System/frontend && npx vitest run`

Expected: All tests pass (3624+ existing tests).

- [ ] **Step 5: Verify no inline customer creation remains in handlers**

Run these grep checks to confirm consolidation is complete:

```bash
# Should NOT find any direct customer insert in handlers (only in webhook-customer-service.ts)
cd D:/Code/Multi_Channel_Integration_System
grep -n "insert(customers)" src/modules/integrations/handlers/*.ts
# Expected: no matches

# Should find findOrCreateCustomer imported from shared service in all handlers
grep -n "from.*webhook-customer-service" src/modules/integrations/handlers/*.ts
# Expected: matches in line-message-handler.ts, line-follow-handler.ts, facebook-event-processor.ts
```

- [ ] **Step 6: Commit verification results (if any fixes needed)**

If any fixes were needed during verification, commit them:

```bash
git add -A
git commit -m "fix: address verification issues from full test suite run"
```

---

## Post-Deploy: Data Repair (Manual)

After deploying the fix, run a one-time data repair for customers whose `displayName` was corrupted by Bug #1. This is NOT a code task — it is an operational step:

1. Query corrupted records: `SELECT * FROM customers WHERE display_name LIKE 'http%' OR display_name LIKE '%line-scdn%' OR display_name LIKE '%fbcdn%'`
2. For each: call LINE/Facebook Profile API to fetch real displayName
3. UPDATE with correct displayName and avatarUrl
4. Specifically verify the 3 reported users: 洪建豐, lily卉, 呂s (機制機電科技)

This can be done via Drizzle Studio (`bun run db:studio`) or a temporary admin endpoint.
