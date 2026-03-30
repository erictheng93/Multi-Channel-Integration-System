// CustomerCrudService Field Mapping Regression Tests
// Regression tests for Bug #1: avatarUrl/displayName copy-paste typo in findOrCreate

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomerCrudService } from '@modules/customer/services/customer-crud';
import type { Customer, UpdateCustomerData } from '@modules/customer/types/customer-types';

// ======================== Mock Data ========================

const NOW = '2024-06-15T10:00:00.000Z';

const baseCustomer: Customer = {
  id: 1,
  platform: 'line',
  platformUserId: 'U12345',
  displayName: 'Original Name',
  avatarUrl: 'https://example.com/old-avatar.png',
  email: null,
  phone: null,
  sourceTeamId: null,
  metadata: null,
  createdAt: NOW,
  updatedAt: NOW
};

// ======================== Helpers ========================

/**
 * Creates a service instance whose internal drizzleDb is mocked so
 * findByPlatformId and findById return `existingCustomer`.
 * Then spies on the high-level `service.update()` method so we can
 * capture the UpdateCustomerData argument without caring about the
 * internal drizzle chain complexity.
 */
const createServiceWithExistingCustomer = (existingCustomer: Customer) => {
  const service = new CustomerCrudService({} as any);

  // Mock the drizzle DB: every select().from().where().get() returns existingCustomer
  const mockDb: any = {
    select: () => ({
      from: () => ({
        where: () => ({
          get: async () => ({ ...existingCustomer })
        })
      })
    }),
    insert: () => ({
      values: (data: any) => ({
        returning: () => ({
          get: async () => ({ id: 99, ...data })
        })
      })
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve()
      })
    })
  };

  (service as any).drizzleDb = mockDb;

  // Spy on the service-level update() method — capture the UpdateCustomerData argument
  const capturedUpdateCalls: UpdateCustomerData[] = [];
  vi.spyOn(service, 'update').mockImplementation(
    async (_id: number, data: UpdateCustomerData) => {
      capturedUpdateCalls.push({ ...data });
      return { ...existingCustomer, ...data } as Customer;
    }
  );

  return { service, capturedUpdateCalls };
};

// ======================== Tests ========================

describe('CustomerCrudService - findOrCreate field mapping (Bug #1 regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('BUG #1 REGRESSION: avatar change must NOT overwrite displayName', async () => {
    const existingCustomer: Customer = {
      ...baseCustomer,
      displayName: 'Original Name',
      avatarUrl: 'https://example.com/old-avatar.png'
    };

    const { service, capturedUpdateCalls } = createServiceWithExistingCustomer(existingCustomer);

    await service.findOrCreate('line', 'U12345', {
      displayName: 'Original Name',                         // unchanged — must NOT trigger displayName update
      avatarUrl: 'https://example.com/new-avatar.png'       // changed
    });

    // Exactly one update call should have happened
    expect(capturedUpdateCalls.length).toBe(1);
    const updateData = capturedUpdateCalls[0];

    // avatarUrl must be set to the new URL
    expect(updateData.avatarUrl).toBe('https://example.com/new-avatar.png');

    // displayName must NOT be in the update at all (it didn't change)
    expect(updateData.displayName).toBeUndefined();
  });

  it('name change only must update displayName, not avatarUrl', async () => {
    const existingCustomer: Customer = {
      ...baseCustomer,
      displayName: 'Old Name',
      avatarUrl: 'https://example.com/avatar.png'
    };

    const { service, capturedUpdateCalls } = createServiceWithExistingCustomer(existingCustomer);

    await service.findOrCreate('line', 'U12345', {
      displayName: 'New Name',
      avatarUrl: 'https://example.com/avatar.png'   // same as existing — must NOT trigger avatarUrl update
    });

    expect(capturedUpdateCalls.length).toBe(1);
    const updateData = capturedUpdateCalls[0];

    expect(updateData.displayName).toBe('New Name');
    expect(updateData.avatarUrl).toBeUndefined();
  });

  it('both name AND avatar change must update both correctly', async () => {
    const existingCustomer: Customer = {
      ...baseCustomer,
      displayName: 'Old Name',
      avatarUrl: 'https://example.com/old-avatar.png'
    };

    const { service, capturedUpdateCalls } = createServiceWithExistingCustomer(existingCustomer);

    await service.findOrCreate('line', 'U12345', {
      displayName: 'New Name',
      avatarUrl: 'https://example.com/new-avatar.png'
    });

    expect(capturedUpdateCalls.length).toBe(1);
    const updateData = capturedUpdateCalls[0];

    // Both fields must be updated to their own correct values
    expect(updateData.displayName).toBe('New Name');
    expect(updateData.avatarUrl).toBe('https://example.com/new-avatar.png');

    // Cross-field contamination checks (the exact bug we're fixing)
    expect(updateData.displayName).not.toBe('https://example.com/new-avatar.png');
    expect(updateData.avatarUrl).not.toBe('New Name');
  });

  it('neither changes must NOT trigger update', async () => {
    const existingCustomer: Customer = {
      ...baseCustomer,
      displayName: 'Same Name',
      avatarUrl: 'https://example.com/same-avatar.png'
    };

    const { service, capturedUpdateCalls } = createServiceWithExistingCustomer(existingCustomer);

    await service.findOrCreate('line', 'U12345', {
      displayName: 'Same Name',
      avatarUrl: 'https://example.com/same-avatar.png'
    });

    // No update should be triggered when nothing changes
    expect(capturedUpdateCalls.length).toBe(0);
  });
});
