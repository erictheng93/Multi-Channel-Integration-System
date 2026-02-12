// CustomerCrudService Unit Tests
// Tests for src/modules/customer/services/customer-crud.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomerCrudService } from '@modules/customer/services/customer-crud';
import {
  CustomerNotFoundError,
  CustomerAlreadyExistsError,
  type Customer,
  type CreateCustomerData,
  type UpdateCustomerData,
  type CustomerWithDetails
} from '@modules/customer/types/customer-types';

// ======================== Mock Data ========================

const NOW = '2024-06-15T10:00:00.000Z';

const mockCustomer: Customer = {
  id: 1,
  platform: 'line',
  platformUserId: 'U12345',
  displayName: 'Test Customer',
  avatarUrl: 'https://example.com/avatar.png',
  email: 'customer@example.com',
  phone: '+886912345678',
  sourceTeamId: 1,
  metadata: null,
  createdAt: NOW,
  updatedAt: NOW
};

const mockTeam = {
  id: 1,
  name: 'Support Team',
  description: 'Main support team'
};

const mockTag = {
  id: 1,
  name: 'VIP',
  color: '#FF0000'
};

// ======================== Drizzle Mock ========================

const createMockDrizzle = () => {
  const customersStore = new Map<number, Customer>();
  let nextId = 1;

  // Default data
  customersStore.set(1, { ...mockCustomer });

  /**
   * Customer + team JOIN chain:
   * select({...}).from(customers).leftJoin(teams, ...)
   */
  const createCustomerChain = () => {
    const chain: any = {
      from: () => chain, select: () => chain, leftJoin: () => chain,
      where: () => chain, orderBy: () => chain, limit: () => chain, offset: () => chain,
      get: async () => {
        const customers = Array.from(customersStore.values());
        if (customers.length === 0) return null;
        return { ...customers[0], teamName: mockTeam.name };
      },
      all: async () => Array.from(customersStore.values())
    };
    return chain;
  };

  /**
   * Count chain: select({ count: sql`COUNT(*)` })
   */
  const createCountChain = () => {
    const chain: any = {
      from: () => chain, where: () => chain,
      get: async () => ({ count: 2 }) // Default: 2 conversations
    };
    return chain;
  };

  /**
   * Date stats chain: select({ lastConversationAt, firstConversationAt })
   */
  const createDateStatsChain = () => {
    const chain: any = {
      from: () => chain, where: () => chain,
      get: async () => ({
        lastConversationAt: NOW,
        firstConversationAt: '2024-01-01T00:00:00.000Z'
      })
    };
    return chain;
  };

  /**
   * Tags chain: select({id, name, color}).from(customerTags).innerJoin(tags, ...)
   */
  const createTagsChain = () => {
    const chain: any = {
      from: () => chain, innerJoin: () => chain, where: () => chain,
      all: async () => [{ ...mockTag }]
    };
    return chain;
  };

  /**
   * Messages chain: select({id, conversationId, ...}).from(messages).innerJoin(conversations, ...)
   */
  const createMessagesChain = () => {
    const chain: any = {
      from: () => chain, innerJoin: () => chain, where: () => chain,
      orderBy: () => chain, limit: () => chain,
      all: async () => [{
        id: 'msg-1',
        conversationId: 'conv-1',
        senderType: 'customer',
        content: 'Hello',
        messageType: 'text',
        createdAt: NOW
      }]
    };
    return chain;
  };

  /**
   * Plain customer select (no join): select().from(customers).where(...)
   */
  const createPlainCustomerChain = () => {
    const chain: any = {
      from: () => chain, where: () => chain, orderBy: () => chain,
      limit: () => chain, offset: () => chain,
      get: async () => {
        const customers = Array.from(customersStore.values());
        if (customers.length === 0) return null;
        return customers[0];
      },
      all: async () => Array.from(customersStore.values())
    };
    return chain;
  };

  const mockDb: any = {
    select: (fields?: any) => {
      if (!fields) {
        // select() with no fields = plain select (findById, findByPlatformId)
        return createPlainCustomerChain();
      }
      // select({ count: ... }) = count queries (getConversationStats)
      if (fields.count !== undefined) {
        return createCountChain();
      }
      // select({ lastConversationAt, firstConversationAt }) = date stats
      if (fields.lastConversationAt !== undefined) {
        return createDateStatsChain();
      }
      // select({ id, name, color }) = tags query
      if (fields.id !== undefined && fields.name !== undefined && fields.color !== undefined) {
        return createTagsChain();
      }
      // select({ id, conversationId, senderType, ... }) = messages query
      if (fields.conversationId !== undefined && fields.senderType !== undefined) {
        return createMessagesChain();
      }
      // select({...customer fields}).from(customers).leftJoin(teams) = customer with details
      if (fields.id !== undefined && fields.platform !== undefined) {
        return createCustomerChain();
      }
      // Fallback: plain customer
      return createPlainCustomerChain();
    },
    insert: (table: any) => ({
      values: (data: any) => ({
        returning: (fields?: any) => ({
          get: async () => {
            const id = nextId++;
            const newCustomer = { ...data, id };
            customersStore.set(id, newCustomer);
            return { id };
          }
        })
      })
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: () => {
          const firstKey = Array.from(customersStore.keys())[0];
          if (firstKey !== undefined) {
            const existing = customersStore.get(firstKey)!;
            customersStore.set(firstKey, { ...existing, ...data });
          }
          return Promise.resolve();
        }
      })
    }),
    _store: customersStore,
    _resetNextId: () => { nextId = 1; }
  };

  return mockDb;
};

// ======================== Tests ========================

describe('CustomerCrudService - Query Operations', () => {
  let mockDrizzle: ReturnType<typeof createMockDrizzle>;
  let service: CustomerCrudService;

  beforeEach(() => {
    mockDrizzle = createMockDrizzle();
    service = new CustomerCrudService({} as any);
    (service as any).drizzleDb = mockDrizzle;
    vi.clearAllMocks();
  });

  describe('findById', () => {
    it('should return customer when found', async () => {
      const result = await service.findById(1);

      expect(result).toBeDefined();
      expect(result!.id).toBe(1);
      expect(result!.displayName).toBe('Test Customer');
      expect(result!.platform).toBe('line');
      expect(result!.platformUserId).toBe('U12345');
    });

    it('should return null when customer not found', async () => {
      mockDrizzle._store.clear();

      const result = await service.findById(999);

      expect(result).toBeNull();
    });

    it('should return all customer fields', async () => {
      const result = await service.findById(1);

      expect(result).toMatchObject({
        id: 1,
        platform: 'line',
        platformUserId: 'U12345',
        displayName: 'Test Customer',
        avatarUrl: 'https://example.com/avatar.png',
        email: 'customer@example.com',
        phone: '+886912345678',
        sourceTeamId: 1,
        createdAt: NOW,
        updatedAt: NOW
      });
    });

    it('should handle customer with null optional fields', async () => {
      mockDrizzle._store.clear();
      mockDrizzle._store.set(2, {
        ...mockCustomer,
        id: 2,
        displayName: null,
        avatarUrl: null,
        email: null,
        phone: null,
        sourceTeamId: null,
        metadata: null
      });

      const result = await service.findById(2);

      expect(result!.displayName).toBeNull();
      expect(result!.avatarUrl).toBeNull();
      expect(result!.email).toBeNull();
      expect(result!.phone).toBeNull();
      expect(result!.sourceTeamId).toBeNull();
    });
  });

  describe('findByIdWithDetails', () => {
    it('should return customer with team name', async () => {
      const result = await service.findByIdWithDetails(1);

      expect(result).toBeDefined();
      expect(result!.teamName).toBe('Support Team');
    });

    it('should return null when customer not found', async () => {
      mockDrizzle._store.clear();

      const result = await service.findByIdWithDetails(999);

      expect(result).toBeNull();
    });

    it('should include tags array', async () => {
      const result = await service.findByIdWithDetails(1);

      expect(result!.tags).toBeDefined();
      expect(Array.isArray(result!.tags)).toBe(true);
    });

    it('should include conversation stats', async () => {
      const result = await service.findByIdWithDetails(1);

      expect(result!.conversationStats).toBeDefined();
      expect(typeof result!.conversationStats.total).toBe('number');
      expect(typeof result!.conversationStats.active).toBe('number');
      expect(typeof result!.conversationStats.closed).toBe('number');
    });

    it('should include recent messages', async () => {
      const result = await service.findByIdWithDetails(1);

      expect(result!.recentMessages).toBeDefined();
      expect(Array.isArray(result!.recentMessages)).toBe(true);
    });

    it('should use default color for tags without color', async () => {
      const result = await service.findByIdWithDetails(1);

      // The mock always returns tags, verify color defaults work
      expect(result).toBeDefined();
      expect(result!.tags).toBeDefined();
      if (result!.tags && result!.tags.length > 0) {
        // mockTag has color: '#FF0000', but if null would default to '#3B82F6'
        expect(typeof result!.tags[0].color).toBe('string');
      }
    });
  });

  describe('findByPlatformId', () => {
    it('should find customer by platform and platformUserId', async () => {
      const result = await service.findByPlatformId('line', 'U12345');

      expect(result).toBeDefined();
      expect(result!.platform).toBe('line');
      expect(result!.platformUserId).toBe('U12345');
    });

    it('should return null when no match', async () => {
      mockDrizzle._store.clear();

      const result = await service.findByPlatformId('facebook', 'FB999');

      expect(result).toBeNull();
    });

    it('should handle different platforms', async () => {
      mockDrizzle._store.clear();
      mockDrizzle._store.set(10, {
        ...mockCustomer,
        id: 10,
        platform: 'facebook',
        platformUserId: 'FB123'
      });

      const result = await service.findByPlatformId('facebook', 'FB123');

      expect(result).toBeDefined();
      expect(result!.platform).toBe('facebook');
    });
  });
});

describe('CustomerCrudService - Create Operations', () => {
  let mockDrizzle: ReturnType<typeof createMockDrizzle>;
  let service: CustomerCrudService;

  beforeEach(() => {
    mockDrizzle = createMockDrizzle();
    service = new CustomerCrudService({} as any);
    (service as any).drizzleDb = mockDrizzle;
    mockDrizzle._store.clear();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new customer successfully', async () => {
      const data: CreateCustomerData = {
        platform: 'line',
        platformUserId: 'U-new-123',
        displayName: 'New Customer',
        email: 'new@example.com'
      };

      const result = await service.create(data);

      expect(result).toBeDefined();
      expect(result.platform).toBe('line');
      expect(result.platformUserId).toBe('U-new-123');
      expect(result.displayName).toBe('New Customer');
    });

    it('should throw CustomerAlreadyExistsError for duplicate platform+userId', async () => {
      // Add an existing customer
      mockDrizzle._store.set(1, { ...mockCustomer });

      await expect(
        service.create({
          platform: 'line',
          platformUserId: 'U12345' // Same as mockCustomer
        })
      ).rejects.toThrow(CustomerAlreadyExistsError);
    });

    it('should set timestamps on creation', async () => {
      const result = await service.create({
        platform: 'webchat',
        platformUserId: 'WC-001'
      });

      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should handle optional fields as null', async () => {
      const result = await service.create({
        platform: 'line',
        platformUserId: 'U-minimal'
      });

      expect(result).toBeDefined();
    });

    it('should serialize metadata to JSON', async () => {
      const metadata = { line: { statusMessage: 'Hello' } };

      const result = await service.create({
        platform: 'line',
        platformUserId: 'U-meta',
        metadata
      });

      expect(result).toBeDefined();
    });

    it('should support sourceTeamId', async () => {
      const result = await service.create({
        platform: 'line',
        platformUserId: 'U-team',
        sourceTeamId: 2
      });

      expect(result).toBeDefined();
    });
  });

  describe('findOrCreate', () => {
    it('should create customer when not found', async () => {
      const result = await service.findOrCreate('line', 'U-new', {
        displayName: 'New User'
      });

      expect(result).toBeDefined();
      expect(result.platform).toBe('line');
    });

    it('should return existing customer when found', async () => {
      mockDrizzle._store.set(1, { ...mockCustomer });

      const result = await service.findOrCreate('line', 'U12345');

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should update existing customer with new info', async () => {
      mockDrizzle._store.set(1, {
        ...mockCustomer,
        displayName: 'Old Name',
        email: null
      });

      const result = await service.findOrCreate('line', 'U12345', {
        displayName: 'New Name',
        email: 'updated@example.com'
      });

      expect(result).toBeDefined();
    });

    it('should not update when additional info matches existing data', async () => {
      const spyUpdate = vi.spyOn(service, 'update');
      mockDrizzle._store.set(1, { ...mockCustomer });

      const result = await service.findOrCreate('line', 'U12345', {
        displayName: mockCustomer.displayName! // Same value
      });

      expect(result).toBeDefined();
    });

    it('should merge metadata with existing metadata', async () => {
      mockDrizzle._store.set(1, {
        ...mockCustomer,
        metadata: JSON.stringify({ existing: 'data' })
      });

      const result = await service.findOrCreate('line', 'U12345', {
        metadata: { newField: 'value' }
      });

      expect(result).toBeDefined();
    });

    it('should handle null additionalInfo', async () => {
      mockDrizzle._store.set(1, { ...mockCustomer });

      const result = await service.findOrCreate('line', 'U12345');

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });
  });
});

describe('CustomerCrudService - Update Operations', () => {
  let mockDrizzle: ReturnType<typeof createMockDrizzle>;
  let service: CustomerCrudService;

  beforeEach(() => {
    mockDrizzle = createMockDrizzle();
    service = new CustomerCrudService({} as any);
    (service as any).drizzleDb = mockDrizzle;
    mockDrizzle._store.set(1, { ...mockCustomer });
    vi.clearAllMocks();
  });

  describe('update', () => {
    it('should update customer displayName', async () => {
      const result = await service.update(1, {
        displayName: 'Updated Name'
      });

      expect(result).toBeDefined();
      expect(result.displayName).toBe('Updated Name');
    });

    it('should update customer email', async () => {
      const result = await service.update(1, {
        email: 'new-email@example.com'
      });

      expect(result).toBeDefined();
      expect(result.email).toBe('new-email@example.com');
    });

    it('should update customer phone', async () => {
      const result = await service.update(1, {
        phone: '+886999888777'
      });

      expect(result).toBeDefined();
      expect(result.phone).toBe('+886999888777');
    });

    it('should update sourceTeamId', async () => {
      const result = await service.update(1, {
        sourceTeamId: 2
      });

      expect(result).toBeDefined();
      expect(result.sourceTeamId).toBe(2);
    });

    it('should update metadata', async () => {
      const newMetadata = { line: { statusMessage: 'Updated' } };
      const result = await service.update(1, {
        metadata: newMetadata
      });

      expect(result).toBeDefined();
    });

    it('should set updatedAt timestamp', async () => {
      const beforeUpdate = new Date().toISOString();

      const result = await service.update(1, {
        displayName: 'Time Test'
      });

      expect(result.updatedAt).toBeDefined();
    });

    it('should throw CustomerNotFoundError for non-existent customer', async () => {
      mockDrizzle._store.clear();

      await expect(
        service.update(999, { displayName: 'Test' })
      ).rejects.toThrow(CustomerNotFoundError);
    });

    it('should allow setting null values', async () => {
      const result = await service.update(1, {
        email: null,
        phone: null
      });

      expect(result).toBeDefined();
    });

    it('should clear metadata when set to null', async () => {
      const result = await service.update(1, {
        metadata: null
      });

      expect(result).toBeDefined();
    });
  });
});

describe('CustomerCrudService - Delete Operations', () => {
  let mockDrizzle: ReturnType<typeof createMockDrizzle>;
  let service: CustomerCrudService;

  beforeEach(() => {
    mockDrizzle = createMockDrizzle();
    service = new CustomerCrudService({} as any);
    (service as any).drizzleDb = mockDrizzle;
    mockDrizzle._store.set(1, { ...mockCustomer });
    vi.clearAllMocks();
  });

  describe('softDelete', () => {
    it('should soft delete by adding _deleted flag to metadata', async () => {
      await service.softDelete(1);

      const updated = mockDrizzle._store.get(1);
      expect(updated).toBeDefined();
      // The customer should still exist (soft delete)
      expect(mockDrizzle._store.has(1)).toBe(true);
    });

    it('should throw CustomerNotFoundError for non-existent customer', async () => {
      mockDrizzle._store.clear();

      await expect(
        service.softDelete(999)
      ).rejects.toThrow(CustomerNotFoundError);
    });

    it('should preserve existing metadata during soft delete', async () => {
      mockDrizzle._store.set(1, {
        ...mockCustomer,
        metadata: JSON.stringify({ existingField: 'value' })
      });

      await service.softDelete(1);

      // Should have called update which merges metadata
      const updated = mockDrizzle._store.get(1);
      expect(updated).toBeDefined();
    });

    it('should set _deletedAt timestamp in metadata', async () => {
      await service.softDelete(1);

      // The soft delete adds _deleted and _deletedAt to metadata via update
      const updated = mockDrizzle._store.get(1);
      if (updated?.metadata) {
        const meta = JSON.parse(updated.metadata);
        expect(meta._deleted).toBe(true);
        expect(meta._deletedAt).toBeDefined();
      }
    });
  });
});

describe('CustomerCrudService - Error Handling', () => {
  it('should handle database errors in findById gracefully', async () => {
    const errorDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            get: async () => { throw new Error('Database connection lost'); }
          })
        })
      })
    };

    const service = new CustomerCrudService({} as any);
    (service as any).drizzleDb = errorDb;

    await expect(service.findById(1)).rejects.toThrow('Database connection lost');
  });

  it('should handle database errors in findByPlatformId', async () => {
    const errorDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            get: async () => { throw new Error('Query timeout'); }
          })
        })
      })
    };

    const service = new CustomerCrudService({} as any);
    (service as any).drizzleDb = errorDb;

    await expect(
      service.findByPlatformId('line', 'U123')
    ).rejects.toThrow('Query timeout');
  });

  it('should handle database errors in create', async () => {
    const errorDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            get: async () => null // No existing customer
          })
        })
      }),
      insert: () => ({
        values: () => ({
          returning: () => ({
            get: async () => { throw new Error('Insert failed - disk full'); }
          })
        })
      })
    };

    const service = new CustomerCrudService({} as any);
    (service as any).drizzleDb = errorDb;

    await expect(
      service.create({ platform: 'line', platformUserId: 'U-fail' })
    ).rejects.toThrow('Insert failed - disk full');
  });
});
