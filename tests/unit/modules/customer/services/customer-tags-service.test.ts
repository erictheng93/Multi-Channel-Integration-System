// CustomerTagService Unit Tests
// Tests for src/modules/customer/services/customer-tags.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomerTagService } from '@modules/customer/services/customer-tags';
import {
  CustomerNotFoundError,
  type CustomerTag,
  type CustomerTagAssignment
} from '@modules/customer/types/customer-types';

// ======================== Mock Data ========================

const NOW = '2024-06-15T10:00:00.000Z';

interface MockCustomer { id: number }
interface MockTag { id: number; name: string; color: string | null }
interface MockCustomerTag {
  customerId: number;
  tagId: number;
  assignedBy: string | null;
  assignedAt: string;
}

const seedCustomers: MockCustomer[] = [
  { id: 1 },
  { id: 2 },
  { id: 3 }
];

const seedTags: MockTag[] = [
  { id: 10, name: 'VIP', color: '#FF0000' },
  { id: 20, name: 'Priority', color: '#00FF00' },
  { id: 30, name: 'New', color: null }
];

const seedAssignments: MockCustomerTag[] = [
  { customerId: 1, tagId: 10, assignedBy: 'agent-1', assignedAt: NOW },
  { customerId: 1, tagId: 20, assignedBy: 'agent-1', assignedAt: NOW },
  { customerId: 2, tagId: 10, assignedBy: 'system', assignedAt: NOW }
];

// ======================== Drizzle Mock ========================

function createMockDrizzle() {
  let customersStore: MockCustomer[] = [];
  let tagsStore: MockTag[] = [];
  let assignmentsStore: MockCustomerTag[] = [];
  const insertedAssignments: MockCustomerTag[] = [];
  const deletedConditions: Array<{ customerId?: number; tagIds?: number[] }> = [];

  // Reset with seed data
  function reset() {
    customersStore = seedCustomers.map(c => ({ ...c }));
    tagsStore = seedTags.map(t => ({ ...t }));
    assignmentsStore = seedAssignments.map(a => ({ ...a }));
    insertedAssignments.length = 0;
    deletedConditions.length = 0;
  }
  reset();

  // Track which table+fields for routing
  let currentContext: 'customer-exists' | 'tag-join' | 'available-tags' |
    'tag-exists' | 'existing-assignments' | 'tag-usage' | 'tag-history' |
    'find-by-tags' | 'customers-without-tags' | 'unknown' = 'unknown';

  // Filtering state within chain
  let filterCustomerId: number | undefined;
  let filterTagIds: number[] | undefined;
  let havingTagCount: number | undefined;

  const mockDb: any = {
    select: (fields?: any) => {
      // Detect query type by fields
      if (fields) {
        const keys = Object.keys(fields);
        // select({ id: customers.id }) → customer or tag existence check
        if (keys.length === 1 && keys[0] === 'id') {
          // Will be resolved by .from()
          currentContext = 'unknown';
        }
        // select({ id, name, color }) → tag data (getCustomerTags or getAvailableTags)
        else if (keys.includes('name') && keys.includes('color') && keys.includes('id')) {
          currentContext = 'available-tags';
        }
        // select({ tagId }) → existing assignments
        else if (keys.length === 1 && keys[0] === 'tagId') {
          currentContext = 'existing-assignments';
        }
        // select({ tagId, tagName, tagColor, customerCount }) → tag usage stats
        else if (keys.includes('tagId') && keys.includes('tagName') && keys.includes('customerCount')) {
          currentContext = 'tag-usage';
        }
        // select({ customerId, tagId, assignedBy, assignedAt }) → tag history
        else if (keys.includes('customerId') && keys.includes('tagId') && keys.includes('assignedBy')) {
          currentContext = 'tag-history';
        }
        // select({ customerId, tagCount }) → findCustomersByTags matchAll
        else if (keys.includes('customerId') && keys.includes('tagCount')) {
          currentContext = 'find-by-tags';
        }
        // select({ customerId }) → findCustomersByTags OR getCustomersWithoutTags
        else if (keys.length === 1 && keys[0] === 'customerId') {
          currentContext = 'find-by-tags';
        }
      }

      // Reset filter state
      filterCustomerId = undefined;
      filterTagIds = undefined;
      havingTagCount = undefined;

      const chain: any = {
        from: (table: any) => {
          // Try to detect table by context
          // When select({ id }) and from is called, we resolve context by table reference
          // Since we can't inspect table directly, we rely on subsequent chain calls
          return chain;
        },
        innerJoin: () => {
          // innerJoin(tags, ...) → this is getCustomerTags (tag-join)
          if (currentContext === 'available-tags') {
            currentContext = 'tag-join';
          }
          return chain;
        },
        leftJoin: () => {
          // leftJoin can be tag-usage or customers-without-tags
          if (currentContext === 'find-by-tags') {
            currentContext = 'customers-without-tags';
          }
          return chain;
        },
        where: (condition: any) => {
          // We track filter state via the condition argument
          // For simplicity, use the currentContext to decide behavior
          return chain;
        },
        groupBy: () => chain,
        having: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        offset: () => chain,
        get: async () => {
          // Customer existence check
          if (currentContext === 'customer-exists' || currentContext === 'unknown') {
            if (filterCustomerId !== undefined) {
              const found = customersStore.find(c => c.id === filterCustomerId);
              return found ? { id: found.id } : null;
            }
            // Default: return first customer
            return customersStore.length > 0 ? { id: customersStore[0].id } : null;
          }
          return null;
        },
        all: async () => {
          switch (currentContext) {
            case 'tag-join':
              // getCustomerTags: return tags for the customer
              return assignmentsStore
                .filter(a => filterCustomerId === undefined || a.customerId === filterCustomerId)
                .map(a => {
                  const tag = tagsStore.find(t => t.id === a.tagId);
                  return tag ? { id: tag.id, name: tag.name, color: tag.color } : null;
                })
                .filter(Boolean);

            case 'available-tags':
              return tagsStore.map(t => ({ id: t.id, name: t.name, color: t.color }));

            case 'tag-exists':
              // Return tags that exist from filterTagIds
              return tagsStore
                .filter(t => !filterTagIds || filterTagIds.includes(t.id))
                .map(t => ({ id: t.id }));

            case 'existing-assignments':
              return assignmentsStore
                .filter(a =>
                  (filterCustomerId === undefined || a.customerId === filterCustomerId) &&
                  (!filterTagIds || filterTagIds.includes(a.tagId))
                )
                .map(a => ({ tagId: a.tagId }));

            case 'tag-usage':
              // Group by tag, count customers
              return tagsStore.map(t => {
                const count = assignmentsStore.filter(a => a.tagId === t.id).length;
                return {
                  tagId: t.id,
                  tagName: t.name,
                  tagColor: t.color,
                  customerCount: count
                };
              });

            case 'tag-history':
              return assignmentsStore
                .filter(a => filterCustomerId === undefined || a.customerId === filterCustomerId)
                .map(a => ({
                  customerId: a.customerId,
                  tagId: a.tagId,
                  assignedBy: a.assignedBy,
                  assignedAt: a.assignedAt
                }));

            case 'find-by-tags':
              // Find customers who have any of the filterTagIds
              {
                const customerMap = new Map<number, Set<number>>();
                assignmentsStore
                  .filter(a => !filterTagIds || filterTagIds.includes(a.tagId))
                  .forEach(a => {
                    if (!customerMap.has(a.customerId)) {
                      customerMap.set(a.customerId, new Set());
                    }
                    customerMap.get(a.customerId)!.add(a.tagId);
                  });
                if (havingTagCount !== undefined) {
                  // matchAll: only customers with ALL tags
                  return Array.from(customerMap.entries())
                    .filter(([_, tagSet]) => tagSet.size >= havingTagCount!)
                    .map(([customerId, tagSet]) => ({ customerId, tagCount: tagSet.size }));
                }
                return Array.from(customerMap.keys()).map(customerId => ({ customerId }));
              }

            case 'customers-without-tags':
              {
                const taggedIds = new Set(assignmentsStore.map(a => a.customerId));
                return customersStore
                  .filter(c => !taggedIds.has(c.id))
                  .map(c => ({ customerId: c.id }));
              }

            default:
              return [];
          }
        }
      };

      return chain;
    },

    insert: (table: any) => ({
      values: (data: any) => ({
        run: async () => {
          insertedAssignments.push({ ...data });
          assignmentsStore.push({ ...data });
        }
      })
    }),

    delete: (table: any) => ({
      where: (condition: any) => ({
        run: async () => {
          // For simplicity, track the delete and apply it
          if (filterCustomerId !== undefined && filterTagIds) {
            assignmentsStore = assignmentsStore.filter(
              a => !(a.customerId === filterCustomerId && filterTagIds!.includes(a.tagId))
            );
          } else if (filterCustomerId !== undefined) {
            assignmentsStore = assignmentsStore.filter(a => a.customerId !== filterCustomerId);
          }
        }
      })
    }),

    // Expose internals for test assertions
    _customers: () => customersStore,
    _tags: () => tagsStore,
    _assignments: () => assignmentsStore,
    _insertedAssignments: () => insertedAssignments,
    _reset: reset,
    _setCustomers: (data: MockCustomer[]) => { customersStore = data; },
    _setTags: (data: MockTag[]) => { tagsStore = data; },
    _setAssignments: (data: MockCustomerTag[]) => { assignmentsStore = data; },
    _setFilterCustomerId: (id: number | undefined) => { filterCustomerId = id; },
    _setFilterTagIds: (ids: number[] | undefined) => { filterTagIds = ids; },
    _setHavingTagCount: (n: number | undefined) => { havingTagCount = n; },
    _setContext: (ctx: typeof currentContext) => { currentContext = ctx; }
  };

  return mockDb;
}

// ======================== Helper ========================

function createService(mockDb: any): CustomerTagService {
  const service = new CustomerTagService({} as any);
  (service as any).drizzleDb = mockDb;
  return service;
}

// ======================== Tests ========================

describe('CustomerTagService - Tag Queries', () => {
  let mockDb: ReturnType<typeof createMockDrizzle>;
  let service: CustomerTagService;

  beforeEach(() => {
    mockDb = createMockDrizzle();
    service = createService(mockDb);
    vi.clearAllMocks();
  });

  describe('getCustomerTags', () => {
    it('should return tags for an existing customer', async () => {
      // Customer 1 has tags 10 (VIP) and 20 (Priority)
      mockDb._setContext('customer-exists');
      mockDb._setFilterCustomerId(1);

      // Mock the chain: first call checks customer exists, second gets tags
      const selectSpy = vi.fn()
        .mockReturnValueOnce({
          // First select: customer existence check
          from: () => ({
            where: () => ({
              get: async () => ({ id: 1 })
            })
          })
        })
        .mockReturnValueOnce({
          // Second select: get tags via JOIN
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                all: async () => [
                  { id: 10, name: 'VIP', color: '#FF0000' },
                  { id: 20, name: 'Priority', color: '#00FF00' }
                ]
              })
            })
          })
        });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.getCustomerTags(1);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 10, name: 'VIP', color: '#FF0000' });
      expect(result[1]).toEqual({ id: 20, name: 'Priority', color: '#00FF00' });
    });

    it('should throw CustomerNotFoundError when customer does not exist', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({
          where: () => ({
            get: async () => null
          })
        })
      });
      (service as any).drizzleDb = { select: selectSpy };

      await expect(service.getCustomerTags(999)).rejects.toThrow(CustomerNotFoundError);
    });

    it('should return empty array when customer has no tags', async () => {
      const selectSpy = vi.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              get: async () => ({ id: 2 })
            })
          })
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                all: async () => []
              })
            })
          })
        });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.getCustomerTags(2);
      expect(result).toEqual([]);
    });

    it('should use default color #3B82F6 when tag has null color', async () => {
      const selectSpy = vi.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              get: async () => ({ id: 1 })
            })
          })
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                all: async () => [
                  { id: 30, name: 'New', color: null }
                ]
              })
            })
          })
        });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.getCustomerTags(1);

      expect(result).toHaveLength(1);
      expect(result[0].color).toBe('#3B82F6');
    });
  });

  describe('getAvailableTags', () => {
    it('should return all available tags', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({
          orderBy: () => ({
            all: async () => [
              { id: 10, name: 'VIP', color: '#FF0000' },
              { id: 20, name: 'Priority', color: '#00FF00' },
              { id: 30, name: 'New', color: null }
            ]
          })
        })
      });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.getAvailableTags();

      expect(result).toHaveLength(3);
      expect(result.map(t => t.name)).toEqual(['VIP', 'Priority', 'New']);
    });

    it('should use default color for tags without color', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({
          orderBy: () => ({
            all: async () => [
              { id: 30, name: 'New', color: null }
            ]
          })
        })
      });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.getAvailableTags();

      expect(result[0].color).toBe('#3B82F6');
    });

    it('should return empty array when no tags exist', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({
          orderBy: () => ({
            all: async () => []
          })
        })
      });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.getAvailableTags();
      expect(result).toEqual([]);
    });
  });
});

describe('CustomerTagService - Tag Operations', () => {
  let service: CustomerTagService;

  beforeEach(() => {
    service = new CustomerTagService({} as any);
    vi.clearAllMocks();
  });

  describe('addTagsToCustomer', () => {
    it('should add new tags to customer', async () => {
      const insertValues: any[] = [];
      const selectSpy = vi.fn()
        // 1st: customer existence check
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ get: async () => ({ id: 1 }) }) })
        })
        // 2nd: tag existence check
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ all: async () => [{ id: 10 }, { id: 20 }] }) })
        })
        // 3rd: existing assignments check
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ all: async () => [] }) })
        });

      (service as any).drizzleDb = {
        select: selectSpy,
        insert: () => ({
          values: (data: any) => ({
            run: async () => { insertValues.push(data); }
          })
        })
      };

      await service.addTagsToCustomer(1, [10, 20], { userId: 'agent-1' } as any);

      expect(insertValues).toHaveLength(2);
      expect(insertValues[0].customerId).toBe(1);
      expect(insertValues[0].tagId).toBe(10);
      expect(insertValues[0].assignedBy).toBe('agent-1');
      expect(insertValues[1].tagId).toBe(20);
    });

    it('should skip tags already assigned (deduplication)', async () => {
      const insertValues: any[] = [];
      const selectSpy = vi.fn()
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ get: async () => ({ id: 1 }) }) })
        })
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ all: async () => [{ id: 10 }, { id: 20 }] }) })
        })
        // Tag 10 already assigned
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ all: async () => [{ tagId: 10 }] }) })
        });

      (service as any).drizzleDb = {
        select: selectSpy,
        insert: () => ({
          values: (data: any) => ({
            run: async () => { insertValues.push(data); }
          })
        })
      };

      await service.addTagsToCustomer(1, [10, 20]);

      // Only tag 20 should be inserted (10 was already assigned)
      expect(insertValues).toHaveLength(1);
      expect(insertValues[0].tagId).toBe(20);
    });

    it('should throw CustomerNotFoundError for non-existent customer', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({ where: () => ({ get: async () => null }) })
      });
      (service as any).drizzleDb = { select: selectSpy };

      await expect(
        service.addTagsToCustomer(999, [10])
      ).rejects.toThrow(CustomerNotFoundError);
    });

    it('should throw error for invalid tag IDs', async () => {
      const selectSpy = vi.fn()
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ get: async () => ({ id: 1 }) }) })
        })
        // Only tag 10 exists, tag 99 does not
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ all: async () => [{ id: 10 }] }) })
        });

      (service as any).drizzleDb = { select: selectSpy };

      await expect(
        service.addTagsToCustomer(1, [10, 99])
      ).rejects.toThrow('Invalid tag IDs: 99');
    });

    it('should use "system" as assignedBy when no userPayload', async () => {
      const insertValues: any[] = [];
      const selectSpy = vi.fn()
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ get: async () => ({ id: 1 }) }) })
        })
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ all: async () => [{ id: 10 }] }) })
        })
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ all: async () => [] }) })
        });

      (service as any).drizzleDb = {
        select: selectSpy,
        insert: () => ({
          values: (data: any) => ({
            run: async () => { insertValues.push(data); }
          })
        })
      };

      await service.addTagsToCustomer(1, [10]);

      expect(insertValues[0].assignedBy).toBe('system');
    });

    it('should not insert when all tags are already assigned', async () => {
      const insertValues: any[] = [];
      const selectSpy = vi.fn()
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ get: async () => ({ id: 1 }) }) })
        })
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ all: async () => [{ id: 10 }] }) })
        })
        // All tags already assigned
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ all: async () => [{ tagId: 10 }] }) })
        });

      (service as any).drizzleDb = {
        select: selectSpy,
        insert: () => ({
          values: (data: any) => ({
            run: async () => { insertValues.push(data); }
          })
        })
      };

      await service.addTagsToCustomer(1, [10]);

      expect(insertValues).toHaveLength(0);
    });

    it('should set assignedAt timestamp on each inserted tag', async () => {
      const insertValues: any[] = [];
      const selectSpy = vi.fn()
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ get: async () => ({ id: 1 }) }) })
        })
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ all: async () => [{ id: 10 }] }) })
        })
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ all: async () => [] }) })
        });

      (service as any).drizzleDb = {
        select: selectSpy,
        insert: () => ({
          values: (data: any) => ({
            run: async () => { insertValues.push(data); }
          })
        })
      };

      await service.addTagsToCustomer(1, [10]);

      expect(insertValues[0].assignedAt).toBeDefined();
      // Should be a valid ISO timestamp
      expect(new Date(insertValues[0].assignedAt).toISOString()).toBe(insertValues[0].assignedAt);
    });
  });

  describe('removeTagsFromCustomer', () => {
    it('should remove tags from customer', async () => {
      let deleteWhereExecuted = false;

      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({ where: () => ({ get: async () => ({ id: 1 }) }) })
      });

      (service as any).drizzleDb = {
        select: selectSpy,
        delete: () => ({
          where: () => ({
            run: async () => { deleteWhereExecuted = true; }
          })
        })
      };

      await service.removeTagsFromCustomer(1, [10, 20]);

      expect(deleteWhereExecuted).toBe(true);
    });

    it('should throw CustomerNotFoundError for non-existent customer', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({ where: () => ({ get: async () => null }) })
      });
      (service as any).drizzleDb = { select: selectSpy };

      await expect(
        service.removeTagsFromCustomer(999, [10])
      ).rejects.toThrow(CustomerNotFoundError);
    });
  });

  describe('setCustomerTags', () => {
    it('should delete all existing tags then add new ones', async () => {
      let deleteExecuted = false;
      const insertValues: any[] = [];

      // We need to handle multiple select calls:
      // 1st: setCustomerTags checks customer exists
      // 2nd-4th: addTagsToCustomer internal calls (customer check, tag check, existing check)
      const selectSpy = vi.fn()
        // setCustomerTags: customer existence
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ get: async () => ({ id: 1 }) }) })
        })
        // addTagsToCustomer: customer existence
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ get: async () => ({ id: 1 }) }) })
        })
        // addTagsToCustomer: tag existence
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ all: async () => [{ id: 30 }] }) })
        })
        // addTagsToCustomer: existing assignments (after delete, should be empty)
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ all: async () => [] }) })
        });

      (service as any).drizzleDb = {
        select: selectSpy,
        delete: () => ({
          where: () => ({
            run: async () => { deleteExecuted = true; }
          })
        }),
        insert: () => ({
          values: (data: any) => ({
            run: async () => { insertValues.push(data); }
          })
        })
      };

      await service.setCustomerTags(1, [30]);

      expect(deleteExecuted).toBe(true);
      expect(insertValues).toHaveLength(1);
      expect(insertValues[0].tagId).toBe(30);
    });

    it('should only delete when tagIds is empty (clear all tags)', async () => {
      let deleteExecuted = false;
      const insertValues: any[] = [];

      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({ where: () => ({ get: async () => ({ id: 1 }) }) })
      });

      (service as any).drizzleDb = {
        select: selectSpy,
        delete: () => ({
          where: () => ({
            run: async () => { deleteExecuted = true; }
          })
        }),
        insert: () => ({
          values: (data: any) => ({
            run: async () => { insertValues.push(data); }
          })
        })
      };

      await service.setCustomerTags(1, []);

      expect(deleteExecuted).toBe(true);
      expect(insertValues).toHaveLength(0);
    });

    it('should throw CustomerNotFoundError for non-existent customer', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({ where: () => ({ get: async () => null }) })
      });
      (service as any).drizzleDb = { select: selectSpy };

      await expect(
        service.setCustomerTags(999, [10])
      ).rejects.toThrow(CustomerNotFoundError);
    });
  });
});

describe('CustomerTagService - Batch Operations', () => {
  let service: CustomerTagService;

  beforeEach(() => {
    service = new CustomerTagService({} as any);
    vi.clearAllMocks();
  });

  describe('addTagsToMultipleCustomers', () => {
    it('should add tags to all customers successfully', async () => {
      const addSpy = vi.spyOn(service, 'addTagsToCustomer').mockResolvedValue(undefined);

      const result = await service.addTagsToMultipleCustomers([1, 2, 3], [10], { userId: 'agent-1' } as any);

      expect(result.success).toEqual([1, 2, 3]);
      expect(result.failed).toEqual([]);
      expect(addSpy).toHaveBeenCalledTimes(3);
    });

    it('should track failed customers without stopping the batch', async () => {
      const addSpy = vi.spyOn(service, 'addTagsToCustomer')
        .mockResolvedValueOnce(undefined) // customer 1 succeeds
        .mockRejectedValueOnce(new CustomerNotFoundError(2)) // customer 2 fails
        .mockResolvedValueOnce(undefined); // customer 3 succeeds

      const result = await service.addTagsToMultipleCustomers([1, 2, 3], [10]);

      expect(result.success).toEqual([1, 3]);
      expect(result.failed).toEqual([2]);
    });

    it('should return all failed when all customers fail', async () => {
      vi.spyOn(service, 'addTagsToCustomer')
        .mockRejectedValue(new Error('DB error'));

      const result = await service.addTagsToMultipleCustomers([1, 2], [10]);

      expect(result.success).toEqual([]);
      expect(result.failed).toEqual([1, 2]);
    });

    it('should return empty arrays for empty customer list', async () => {
      const result = await service.addTagsToMultipleCustomers([], [10]);

      expect(result.success).toEqual([]);
      expect(result.failed).toEqual([]);
    });
  });

  describe('removeTagsFromMultipleCustomers', () => {
    it('should remove tags from all customers successfully', async () => {
      const removeSpy = vi.spyOn(service, 'removeTagsFromCustomer').mockResolvedValue(undefined);

      const result = await service.removeTagsFromMultipleCustomers([1, 2], [10, 20]);

      expect(result.success).toEqual([1, 2]);
      expect(result.failed).toEqual([]);
      expect(removeSpy).toHaveBeenCalledTimes(2);
    });

    it('should track failed customers without stopping the batch', async () => {
      vi.spyOn(service, 'removeTagsFromCustomer')
        .mockRejectedValueOnce(new CustomerNotFoundError(1))
        .mockResolvedValueOnce(undefined);

      const result = await service.removeTagsFromMultipleCustomers([1, 2], [10]);

      expect(result.success).toEqual([2]);
      expect(result.failed).toEqual([1]);
    });

    it('should handle all failures gracefully', async () => {
      vi.spyOn(service, 'removeTagsFromCustomer')
        .mockRejectedValue(new Error('Connection lost'));

      const result = await service.removeTagsFromMultipleCustomers([1, 2, 3], [10]);

      expect(result.success).toEqual([]);
      expect(result.failed).toEqual([1, 2, 3]);
    });
  });
});

describe('CustomerTagService - Tag Analytics', () => {
  let service: CustomerTagService;

  beforeEach(() => {
    service = new CustomerTagService({} as any);
    vi.clearAllMocks();
  });

  describe('getTagUsageStats', () => {
    it('should return usage statistics for all tags', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({
          leftJoin: () => ({
            groupBy: () => ({
              orderBy: () => ({
                all: async () => [
                  { tagId: 10, tagName: 'VIP', tagColor: '#FF0000', customerCount: 5 },
                  { tagId: 20, tagName: 'Priority', tagColor: '#00FF00', customerCount: 3 },
                  { tagId: 30, tagName: 'New', tagColor: null, customerCount: 0 }
                ]
              })
            })
          })
        })
      });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.getTagUsageStats();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        tagId: 10, tagName: 'VIP', tagColor: '#FF0000', customerCount: 5
      });
      expect(result[2].tagColor).toBe('#3B82F6'); // null → default
      expect(result[2].customerCount).toBe(0);
    });

    it('should default customerCount to 0 when null', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({
          leftJoin: () => ({
            groupBy: () => ({
              orderBy: () => ({
                all: async () => [
                  { tagId: 10, tagName: 'VIP', tagColor: '#FF0000', customerCount: null }
                ]
              })
            })
          })
        })
      });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.getTagUsageStats();

      expect(result[0].customerCount).toBe(0);
    });

    it('should rethrow database errors', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({
          leftJoin: () => ({
            groupBy: () => ({
              orderBy: () => ({
                all: async () => { throw new Error('Query failed'); }
              })
            })
          })
        })
      });
      (service as any).drizzleDb = { select: selectSpy };

      await expect(service.getTagUsageStats()).rejects.toThrow('Query failed');
    });
  });

  describe('getCustomerTagHistory', () => {
    it('should return tag history for existing customer', async () => {
      const selectSpy = vi.fn()
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ get: async () => ({ id: 1 }) }) })
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                all: async () => [
                  { customerId: 1, tagId: 10, assignedBy: 'agent-1', assignedAt: NOW },
                  { customerId: 1, tagId: 20, assignedBy: 'agent-2', assignedAt: '2024-06-14T10:00:00.000Z' }
                ]
              })
            })
          })
        });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.getCustomerTagHistory(1);

      expect(result).toHaveLength(2);
      expect(result[0].tagId).toBe(10);
      expect(result[0].assignedBy).toBe('agent-1');
      expect(result[1].tagId).toBe(20);
    });

    it('should throw CustomerNotFoundError for non-existent customer', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({ where: () => ({ get: async () => null }) })
      });
      (service as any).drizzleDb = { select: selectSpy };

      await expect(service.getCustomerTagHistory(999)).rejects.toThrow(CustomerNotFoundError);
    });

    it('should use fallback timestamp when assignedAt is null', async () => {
      const selectSpy = vi.fn()
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ get: async () => ({ id: 1 }) }) })
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                all: async () => [
                  { customerId: 1, tagId: 10, assignedBy: null, assignedAt: null }
                ]
              })
            })
          })
        });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.getCustomerTagHistory(1);

      expect(result[0].assignedAt).toBeDefined();
      // Should be a valid ISO date (fallback to current time)
      expect(() => new Date(result[0].assignedAt!)).not.toThrow();
    });
  });
});

describe('CustomerTagService - Tag Search', () => {
  let service: CustomerTagService;

  beforeEach(() => {
    service = new CustomerTagService({} as any);
    vi.clearAllMocks();
  });

  describe('findCustomersByTags - matchAll=false (OR logic)', () => {
    it('should find customers with any of the specified tags', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              all: async () => [
                { customerId: 1 },
                { customerId: 2 },
                { customerId: 3 }
              ]
            })
          })
        })
      });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.findCustomersByTags([10, 20], false);

      expect(result).toEqual([1, 2, 3]);
    });

    it('should return empty array when no customers match', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              all: async () => []
            })
          })
        })
      });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.findCustomersByTags([99], false);

      expect(result).toEqual([]);
    });
  });

  describe('findCustomersByTags - matchAll=true (AND logic)', () => {
    it('should find customers with ALL specified tags', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              having: () => ({
                all: async () => [
                  { customerId: 1, tagCount: 2 }
                ]
              })
            })
          })
        })
      });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.findCustomersByTags([10, 20], true);

      expect(result).toEqual([1]);
    });

    it('should return empty when no customer has all tags', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              having: () => ({
                all: async () => []
              })
            })
          })
        })
      });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.findCustomersByTags([10, 20, 30], true);

      expect(result).toEqual([]);
    });
  });

  describe('getCustomersWithoutTags', () => {
    it('should return customer IDs with no tags', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              all: async () => [
                { customerId: 3 },
                { customerId: 4 }
              ]
            })
          })
        })
      });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.getCustomersWithoutTags();

      expect(result).toEqual([3, 4]);
    });

    it('should return empty array when all customers have tags', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              all: async () => []
            })
          })
        })
      });
      (service as any).drizzleDb = { select: selectSpy };

      const result = await service.getCustomersWithoutTags();

      expect(result).toEqual([]);
    });

    it('should rethrow database errors', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        from: () => ({
          leftJoin: () => ({
            where: () => ({
              all: async () => { throw new Error('DB timeout'); }
            })
          })
        })
      });
      (service as any).drizzleDb = { select: selectSpy };

      await expect(service.getCustomersWithoutTags()).rejects.toThrow('DB timeout');
    });
  });
});
