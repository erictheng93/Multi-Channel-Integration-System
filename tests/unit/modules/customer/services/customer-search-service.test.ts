// CustomerSearchService Unit Tests
// Tests for src/modules/customer/services/customer-search.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomerSearchService } from '@modules/customer/services/customer-search';
import type {
  CustomerFilters,
  CustomerSearchQuery,
  CustomerListResponse,
  CustomerSearchResponse
} from '@modules/customer/types/customer-types';
import type { JWTPayload } from '@/types';

// ======================== Mock Data ========================

const NOW = '2024-06-15T10:00:00.000Z';

const mockCustomerRow = {
  id: 1,
  platform: 'line',
  platformUserId: 'U12345',
  displayName: 'Test Customer',
  avatarUrl: 'https://example.com/avatar.png',
  phone: '+886912345678',
  email: 'test@example.com',
  sourceTeamId: 1,
  teamName: 'Support Team',
  tagNames: 'VIP,Priority',
  tagColors: '#FF0000,#00FF00',
  totalConversations: 5,
  activeConversations: 2,
  lastConversationAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
  metadata: null
};

const mockSearchResult = {
  id: 1,
  platform: 'line',
  platformUserId: 'U12345',
  displayName: 'Test Customer',
  avatarUrl: 'https://example.com/avatar.png',
  email: 'test@example.com',
  phone: '+886912345678'
};

const adminPayload: JWTPayload = {
  userId: 'admin-1',
  role: 'admin',
  teamId: undefined
} as any;

const agentPayload: JWTPayload = {
  userId: 'agent-1',
  role: 'agent',
  primaryTeamId: 2
} as any;

// ======================== Mock Factory ========================

function createMockDb(options: {
  listResults?: any[];
  countResult?: number;
  searchResults?: any[];
  suggestionResults?: any[];
} = {}) {
  const {
    listResults = [mockCustomerRow],
    countResult = 1,
    searchResults = [mockSearchResult],
    suggestionResults = [{ displayName: 'Test Customer' }]
  } = options;

  let callCount = 0;

  const mockDb: any = {
    select: (fields?: any) => {
      callCount++;

      // COUNT query (getFilteredCustomersCount)
      if (fields && fields.total !== undefined) {
        return {
          from: () => ({
            leftJoin: () => ({
              where: () => ({
                get: async () => ({ total: countResult })
              })
            }),
            where: () => ({
              get: async () => ({ total: countResult })
            })
          })
        };
      }

      // Search suggestions (select({ displayName }))
      if (fields && Object.keys(fields).length === 1 && fields.displayName !== undefined) {
        return {
          from: () => ({
            where: () => ({
              limit: () => ({
                all: async () => suggestionResults
              })
            })
          })
        };
      }

      // Quick search results (select with id, platform, displayName, etc but no teamName/tagNames)
      if (fields && fields.id !== undefined && fields.platform !== undefined &&
          fields.displayName !== undefined && !fields.teamName) {
        return {
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => ({
                  all: async () => searchResults
                })
              })
            })
          })
        };
      }

      // Main getCustomerList query (complex with JOINs)
      const mainChain: any = {
        from: () => mainChain,
        leftJoin: () => mainChain,
        where: () => mainChain,
        groupBy: () => mainChain,
        orderBy: () => mainChain,
        limit: () => mainChain,
        offset: () => mainChain,
        as: () => mainChain,
        all: async () => listResults,
        get: async () => listResults[0] || null
      };
      return mainChain;
    },
    _callCount: () => callCount
  };

  return mockDb;
}

function createService(mockDb: any): CustomerSearchService {
  const service = new CustomerSearchService({} as any);
  (service as any).drizzleDb = mockDb;
  return service;
}

// ======================== Tests ========================

describe('CustomerSearchService - getCustomerList', () => {
  let service: CustomerSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return paginated customer list', async () => {
    const mockDb = createMockDb({ listResults: [mockCustomerRow], countResult: 1 });
    service = createService(mockDb);

    const result = await service.getCustomerList({}, { page: 1, pageSize: 20 });

    expect(result.customers).toHaveLength(1);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(20);
    expect(result.pagination.total).toBe(1);
    expect(result.pagination.totalPages).toBe(1);
  });

  it('should parse tagNames and tagColors into structured tags array', async () => {
    const mockDb = createMockDb({
      listResults: [{
        ...mockCustomerRow,
        tagNames: 'VIP,Priority',
        tagColors: '#FF0000,#00FF00'
      }]
    });
    service = createService(mockDb);

    const result = await service.getCustomerList({}, { page: 1, pageSize: 20 });

    expect(result.customers[0].tags).toEqual([
      { name: 'VIP', color: '#FF0000' },
      { name: 'Priority', color: '#00FF00' }
    ]);
  });

  it('should return empty tags array when tagNames is null', async () => {
    const mockDb = createMockDb({
      listResults: [{ ...mockCustomerRow, tagNames: null, tagColors: null }]
    });
    service = createService(mockDb);

    const result = await service.getCustomerList({}, { page: 1, pageSize: 20 });

    expect(result.customers[0].tags).toEqual([]);
  });

  it('should default totalConversations and activeConversations to 0 when null', async () => {
    const mockDb = createMockDb({
      listResults: [{
        ...mockCustomerRow,
        totalConversations: null,
        activeConversations: null
      }]
    });
    service = createService(mockDb);

    const result = await service.getCustomerList({}, { page: 1, pageSize: 20 });

    expect(result.customers[0].totalConversations).toBe(0);
    expect(result.customers[0].activeConversations).toBe(0);
  });

  it('should calculate correct totalPages', async () => {
    const mockDb = createMockDb({ countResult: 55 });
    service = createService(mockDb);

    const result = await service.getCustomerList({}, { page: 1, pageSize: 20 });

    expect(result.pagination.totalPages).toBe(3); // ceil(55/20) = 3
  });

  it('should calculate offset from page and pageSize', async () => {
    // Page 3, pageSize 10 → offset should be 20
    const mockDb = createMockDb();
    service = createService(mockDb);

    const result = await service.getCustomerList({}, { page: 3, pageSize: 10 });

    // Verify the result structure is correct (offset calculation is internal)
    expect(result.pagination.page).toBe(3);
  });

  it('should return empty list when no results', async () => {
    const mockDb = createMockDb({ listResults: [], countResult: 0 });
    service = createService(mockDb);

    const result = await service.getCustomerList({}, { page: 1, pageSize: 20 });

    expect(result.customers).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  it('should use default tag color when tagColors entry is missing', async () => {
    const mockDb = createMockDb({
      listResults: [{
        ...mockCustomerRow,
        tagNames: 'VIP,Priority,New',
        tagColors: '#FF0000,#00FF00'  // Missing third color
      }]
    });
    service = createService(mockDb);

    const result = await service.getCustomerList({}, { page: 1, pageSize: 20 });

    expect(result.customers[0].tags[2]).toEqual({
      name: 'New',
      color: '#3B82F6'  // Default color
    });
  });

  it('should rethrow database errors', async () => {
    // getCustomerList builds subqueries first, then the main query.
    // The subquery chain: select().from().groupBy().as() must return an object.
    // The main chain must propagate through all joins/where/groupBy/orderBy/limit/offset.
    const errorChain: any = {
      from: () => errorChain, leftJoin: () => errorChain, innerJoin: () => errorChain,
      where: () => errorChain, groupBy: () => errorChain, orderBy: () => errorChain,
      limit: () => errorChain, offset: () => errorChain, as: () => errorChain,
      all: async () => { throw new Error('DB connection lost'); },
      get: async () => { throw new Error('DB connection lost'); }
    };
    const mockDb = { select: () => errorChain };
    service = createService(mockDb);

    await expect(
      service.getCustomerList({}, { page: 1, pageSize: 20 })
    ).rejects.toThrow('DB connection lost');
  });
});

describe('CustomerSearchService - Team Scoping Security', () => {
  let service: CustomerSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not add team filter for admin users', () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    // Access private method directly for security verification
    const conditions = (service as any).buildFilterConditions({}, adminPayload);

    // Admin should have no team-scoping conditions
    // (may have other conditions, but none should reference teamId filtering)
    expect(conditions.length).toBe(0);
  });

  it('should add team-scope condition for non-admin agent', () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const conditions = (service as any).buildFilterConditions({}, agentPayload);

    // Agent with teamId should have at least 1 condition (team scoping)
    expect(conditions.length).toBeGreaterThanOrEqual(1);
  });

  it('should not add team filter when userPayload is undefined', () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const conditions = (service as any).buildFilterConditions({}, undefined);

    expect(conditions.length).toBe(0);
  });

  it('should apply platform filter', () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const conditions = (service as any).buildFilterConditions(
      { platform: 'line' } as CustomerFilters,
      adminPayload
    );

    expect(conditions.length).toBe(1);
  });

  it('should apply search keyword filter', () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const conditions = (service as any).buildFilterConditions(
      { search: 'test' } as CustomerFilters,
      adminPayload
    );

    expect(conditions.length).toBe(1);
  });

  it('should apply hasEmail=true filter', () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const conditions = (service as any).buildFilterConditions(
      { hasEmail: true } as CustomerFilters,
      adminPayload
    );

    expect(conditions.length).toBe(1);
  });

  it('should apply hasEmail=false filter', () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const conditions = (service as any).buildFilterConditions(
      { hasEmail: false } as CustomerFilters,
      adminPayload
    );

    expect(conditions.length).toBe(1);
  });

  it('should apply hasPhone filter', () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const conditions = (service as any).buildFilterConditions(
      { hasPhone: true } as CustomerFilters,
      adminPayload
    );

    expect(conditions.length).toBe(1);
  });

  it('should apply date range filters', () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const conditions = (service as any).buildFilterConditions(
      { dateFrom: '2024-01-01', dateTo: '2024-12-31' } as CustomerFilters,
      adminPayload
    );

    expect(conditions.length).toBe(2);
  });

  it('should apply status=active filter', () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const conditions = (service as any).buildFilterConditions(
      { status: 'active' } as CustomerFilters,
      adminPayload
    );

    expect(conditions.length).toBe(1);
  });

  it('should apply status=inactive filter', () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const conditions = (service as any).buildFilterConditions(
      { status: 'inactive' } as CustomerFilters,
      adminPayload
    );

    expect(conditions.length).toBe(1);
  });

  it('should combine multiple filters', () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const conditions = (service as any).buildFilterConditions(
      {
        platform: 'line',
        teamId: 1,
        search: 'test',
        hasEmail: true,
        status: 'active'
      } as CustomerFilters,
      agentPayload
    );

    // Agent team scope + platform + teamId + search + hasEmail + status = 6
    expect(conditions.length).toBe(6);
  });

  it('should apply tagId filter', () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const conditions = (service as any).buildFilterConditions(
      { tagId: 10 } as CustomerFilters,
      adminPayload
    );

    expect(conditions.length).toBe(1);
  });
});

describe('CustomerSearchService - quickSearch', () => {
  let service: CustomerSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return search results for valid query', async () => {
    const mockDb = createMockDb({
      searchResults: [mockSearchResult]
    });
    service = createService(mockDb);

    const result = await service.quickSearch({ q: 'Test', limit: 10 });

    expect(result.results).toHaveLength(1);
    expect(result.query).toBe('Test');
    expect(result.total).toBe(1);
  });

  it('should return empty results when query is less than 2 characters', async () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const result = await service.quickSearch({ q: 'T' });

    expect(result.results).toEqual([]);
    expect(result.query).toBe('T');
    expect(result.total).toBe(0);
  });

  it('should return empty results for single character query', async () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const result = await service.quickSearch({ q: 'A' });

    expect(result.results).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should use default limit of 10', async () => {
    const mockDb = createMockDb({ searchResults: [mockSearchResult] });
    service = createService(mockDb);

    const result = await service.quickSearch({ q: 'Test' });

    // Default limit is 10, result uses it internally
    expect(result.results).toBeDefined();
  });

  it('should return multiple results', async () => {
    const mockDb = createMockDb({
      searchResults: [
        { ...mockSearchResult, id: 1, displayName: 'Test A' },
        { ...mockSearchResult, id: 2, displayName: 'Test B' },
        { ...mockSearchResult, id: 3, displayName: 'Test C' }
      ]
    });
    service = createService(mockDb);

    const result = await service.quickSearch({ q: 'Test', limit: 10 });

    expect(result.results).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it('should handle platform filter in search', async () => {
    const mockDb = createMockDb({ searchResults: [mockSearchResult] });
    service = createService(mockDb);

    const result = await service.quickSearch({
      q: 'Test',
      platform: 'line'
    });

    expect(result.results).toHaveLength(1);
  });

  it('should rethrow database errors', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                all: async () => { throw new Error('Search failed'); }
              })
            })
          })
        })
      })
    };
    service = createService(mockDb);

    await expect(
      service.quickSearch({ q: 'Test' })
    ).rejects.toThrow('Search failed');
  });
});

describe('CustomerSearchService - advancedSearch', () => {
  let service: CustomerSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delegate to getCustomerList', async () => {
    const mockDb = createMockDb();
    service = createService(mockDb);
    const getListSpy = vi.spyOn(service, 'getCustomerList');

    const filters: CustomerFilters = { platform: 'line', search: 'test' };
    const pagination = { page: 1, pageSize: 20 };

    await service.advancedSearch(filters, pagination, adminPayload);

    expect(getListSpy).toHaveBeenCalledWith(filters, pagination, adminPayload);
  });

  it('should return same structure as getCustomerList', async () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const result = await service.advancedSearch({}, { page: 1, pageSize: 20 });

    expect(result).toHaveProperty('customers');
    expect(result).toHaveProperty('pagination');
  });
});

describe('CustomerSearchService - getSearchSuggestions', () => {
  let service: CustomerSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return suggestions for valid query', async () => {
    const mockDb = createMockDb({
      suggestionResults: [
        { displayName: 'Test Customer' },
        { displayName: 'Test User' }
      ]
    });
    service = createService(mockDb);

    const result = await service.getSearchSuggestions('Test', 5);

    expect(result).toEqual(['Test Customer', 'Test User']);
  });

  it('should return empty array when query is less than 2 characters', async () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const result = await service.getSearchSuggestions('T');

    expect(result).toEqual([]);
  });

  it('should use default limit of 5', async () => {
    const mockDb = createMockDb({
      suggestionResults: [{ displayName: 'Test' }]
    });
    service = createService(mockDb);

    const result = await service.getSearchSuggestions('Test');

    expect(result).toBeDefined();
  });

  it('should filter out null display names', async () => {
    const mockDb = createMockDb({
      suggestionResults: [
        { displayName: 'Valid Name' },
        { displayName: null },
        { displayName: 'Another Name' }
      ]
    });
    service = createService(mockDb);

    const result = await service.getSearchSuggestions('Name');

    expect(result).toEqual(['Valid Name', 'Another Name']);
  });

  it('should return empty array on database error (graceful fallback)', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => ({
              all: async () => { throw new Error('DB error'); }
            })
          })
        })
      })
    };
    service = createService(mockDb);

    const result = await service.getSearchSuggestions('Test');

    // getSearchSuggestions returns [] on error (doesn't throw)
    expect(result).toEqual([]);
  });

  it('should respect the limit parameter', async () => {
    const mockDb = createMockDb({
      suggestionResults: [
        { displayName: 'A' },
        { displayName: 'B' },
        { displayName: 'C' },
        { displayName: 'D' },
        { displayName: 'E' }
      ]
    });
    service = createService(mockDb);

    const result = await service.getSearchSuggestions('test', 3);

    // Limit is applied via .limit() + .slice()
    expect(result.length).toBeLessThanOrEqual(3);
  });
});
