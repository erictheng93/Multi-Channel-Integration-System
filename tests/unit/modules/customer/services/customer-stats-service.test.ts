// CustomerStatsService Unit Tests
// Tests for src/modules/customer/services/customer-stats.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomerStatsService } from '@modules/customer/services/customer-stats';
import type { CustomerStats } from '@modules/customer/types/customer-types';
import type { JWTPayload } from '@/types';

// ======================== Mock Data ========================

const adminPayload: JWTPayload = {
  userId: 'admin-1',
  role: 'admin',
  teamId: undefined
} as any;

const agentPayload: JWTPayload = {
  userId: 'agent-1',
  role: 'agent',
  teamId: 2
} as any;

// ======================== Mock Factory ========================

/**
 * Create a mock drizzle DB that returns configurable results for each sub-query
 * used by getCustomerStats (which calls 7 queries in parallel via Promise.all).
 */
function createMockDb(options: {
  total?: number;
  platformStats?: Array<{ platform: string; count: number }>;
  teamStats?: Array<{ teamName: string; count: number }>;
  taggedCount?: number;
  emailCount?: number;
  phoneCount?: number;
  recentActiveCount?: number;
  // Activity stats
  totalActive?: number;
  dailyActive?: Array<{ date: string; count: number }>;
  topActive?: Array<{ customerId: number; displayName: string | null; messageCount: number }>;
  // Growth stats
  monthlyGrowth?: Array<{ month: string; count: number }>;
} = {}) {
  const {
    total = 100,
    platformStats = [
      { platform: 'line', count: 60 },
      { platform: 'facebook', count: 40 }
    ],
    teamStats = [
      { teamName: 'Support Team', count: 70 },
      { teamName: '未分配', count: 30 }
    ],
    taggedCount = 25,
    emailCount = 45,
    phoneCount = 35,
    recentActiveCount = 15,
    totalActive = 20,
    dailyActive = [
      { date: '2024-06-14', count: 5 },
      { date: '2024-06-15', count: 8 }
    ],
    topActive = [
      { customerId: 1, displayName: 'Active User', messageCount: 50 },
      { customerId: 2, displayName: null, messageCount: 30 }
    ],
    monthlyGrowth = [
      { month: '2024-05', count: 10 },
      { month: '2024-06', count: 15 }
    ]
  } = options;

  // Track which query pattern is being used
  let selectCallIndex = 0;

  const mockDb: any = {
    select: (fields?: any) => {
      selectCallIndex++;

      const keys = fields ? Object.keys(fields) : [];

      // ---- getCustomerStats sub-queries ----

      // getTotalCustomers: select({ total: count(customers.id) })
      if (keys.includes('total') && keys.length === 1) {
        return {
          from: () => ({
            where: () => ({
              get: async () => ({ total })
            }),
            get: async () => ({ total })
          })
        };
      }

      // getPlatformStats: select({ platform, count })
      if (keys.includes('platform') && keys.includes('count')) {
        return {
          from: () => ({
            where: () => ({
              groupBy: () => ({
                all: async () => platformStats
              })
            }),
            groupBy: () => ({
              all: async () => platformStats
            })
          })
        };
      }

      // getTeamStats: select({ teamName, count })
      if (keys.includes('teamName') && keys.includes('count')) {
        return {
          from: () => ({
            leftJoin: () => ({
              where: () => ({
                groupBy: () => ({
                  all: async () => teamStats
                })
              }),
              groupBy: () => ({
                all: async () => teamStats
              })
            })
          })
        };
      }

      // getTaggedCustomersCount: select({ count }) with innerJoin
      // Count queries that use innerJoin (tagged, recentActive)
      if (keys.includes('count') && keys.length === 1) {
        return {
          from: () => ({
            innerJoin: (table: any) => {
              // If we join customerTags → taggedCount
              // If we join conversations → recentActiveCount
              return {
                where: () => ({
                  get: async () => ({ count: taggedCount })
                }),
                innerJoin: () => ({
                  where: () => ({
                    get: async () => ({ count: recentActiveCount })
                  })
                }),
                get: async () => ({ count: taggedCount })
              };
            },
            where: () => ({
              get: async () => ({ count: emailCount })
            }),
            get: async () => ({ count: emailCount })
          })
        };
      }

      // ---- getActivityStats queries ----

      // totalActiveResult: select({ count }) with multiple innerJoins
      // dailyActiveResult: select({ date, count }) with innerJoins
      if (keys.includes('date') && keys.includes('count')) {
        return {
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: () => ({
                  groupBy: () => ({
                    orderBy: () => ({
                      all: async () => dailyActive
                    })
                  })
                })
              })
            })
          })
        };
      }

      // topActiveCustomers: select({ customerId, displayName, messageCount })
      if (keys.includes('customerId') && keys.includes('displayName') && keys.includes('messageCount')) {
        return {
          from: () => ({
            innerJoin: () => ({
              innerJoin: () => ({
                where: () => ({
                  groupBy: () => ({
                    orderBy: () => ({
                      limit: () => ({
                        all: async () => topActive
                      })
                    })
                  })
                })
              })
            })
          })
        };
      }

      // ---- getGrowthStats queries ----

      // monthlyGrowthResult: select({ month, count })
      if (keys.includes('month') && keys.includes('count')) {
        return {
          from: () => ({
            where: () => ({
              groupBy: () => ({
                orderBy: () => ({
                  all: async () => monthlyGrowth
                })
              })
            })
          })
        };
      }

      // Fallback chain
      const chain: any = {
        from: () => chain, leftJoin: () => chain, innerJoin: () => chain,
        where: () => chain, groupBy: () => chain, orderBy: () => chain,
        limit: () => chain, offset: () => chain,
        get: async () => null,
        all: async () => []
      };
      return chain;
    },

    _resetCallIndex: () => { selectCallIndex = 0; }
  };

  return mockDb;
}

function createService(mockDb: any): CustomerStatsService {
  const service = new CustomerStatsService({} as any);
  (service as any).drizzleDb = mockDb;
  return service;
}

// ======================== Tests ========================

describe('CustomerStatsService - getCustomerStats', () => {
  let service: CustomerStatsService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return complete stats overview for admin', async () => {
    // getCustomerStats calls 7 queries via Promise.all. The select() calls
    // are made synchronously before promises resolve, so a call counter works.
    let countQueryIdx = 0;
    const countResults = [25, 45, 35, 15]; // tagged, email, phone, recentActive

    const statsDb: any = {
      select: (fields?: any) => {
        const keys = fields ? Object.keys(fields) : [];

        // getTotalCustomers: select({ total })
        if (keys.includes('total') && keys.length === 1) {
          return {
            from: () => ({
              where: () => ({ get: async () => ({ total: 100 }) }),
              get: async () => ({ total: 100 })
            })
          };
        }

        // getPlatformStats: select({ platform, count })
        if (keys.includes('platform') && keys.includes('count')) {
          return {
            from: () => ({
              where: () => ({
                groupBy: () => ({
                  all: async () => [
                    { platform: 'line', count: 60 },
                    { platform: 'facebook', count: 40 }
                  ]
                })
              }),
              groupBy: () => ({
                all: async () => [
                  { platform: 'line', count: 60 },
                  { platform: 'facebook', count: 40 }
                ]
              })
            })
          };
        }

        // getTeamStats: select({ teamName, count })
        if (keys.includes('teamName') && keys.includes('count')) {
          return {
            from: () => ({
              leftJoin: () => ({
                where: () => ({
                  groupBy: () => ({
                    all: async () => [
                      { teamName: 'Support Team', count: 70 },
                      { teamName: '未分配', count: 30 }
                    ]
                  })
                }),
                groupBy: () => ({
                  all: async () => [
                    { teamName: 'Support Team', count: 70 },
                    { teamName: '未分配', count: 30 }
                  ]
                })
              })
            })
          };
        }

        // COUNT queries (tagged, email, phone, recentActive) - use counter
        if (keys.includes('count') && keys.length === 1) {
          const currentIdx = countQueryIdx++;
          const val = countResults[currentIdx] ?? 0;
          const countChain: any = {
            from: () => countChain, innerJoin: () => countChain,
            where: () => countChain, leftJoin: () => countChain,
            get: async () => ({ count: val })
          };
          return countChain;
        }

        // Fallback
        const chain: any = {
          from: () => chain, leftJoin: () => chain, innerJoin: () => chain,
          where: () => chain, groupBy: () => chain, orderBy: () => chain,
          get: async () => null, all: async () => []
        };
        return chain;
      }
    };
    service = createService(statsDb);

    const result = await service.getCustomerStats(adminPayload);

    expect(result.total).toBe(100);
    expect(result.byPlatform).toEqual({ line: 60, facebook: 40 });
    expect(result.byTeam).toEqual({ 'Support Team': 70, '未分配': 30 });
    expect(result.withTags).toBe(25);
    expect(result.withEmail).toBe(45);
    expect(result.withPhone).toBe(35);
    expect(result.recentActive).toBe(15);
  });

  it('should return stats structure with correct types', async () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const result = await service.getCustomerStats();

    expect(typeof result.total).toBe('number');
    expect(typeof result.byPlatform).toBe('object');
    expect(typeof result.byTeam).toBe('object');
    expect(typeof result.withTags).toBe('number');
    expect(typeof result.withEmail).toBe('number');
    expect(typeof result.withPhone).toBe('number');
    expect(typeof result.recentActive).toBe('number');
  });

  it('should handle zero stats gracefully', async () => {
    const mockDb = createMockDb({
      total: 0,
      platformStats: [],
      teamStats: [],
      taggedCount: 0,
      emailCount: 0,
      phoneCount: 0,
      recentActiveCount: 0
    });
    service = createService(mockDb);

    const result = await service.getCustomerStats();

    expect(result.total).toBe(0);
    expect(result.byPlatform).toEqual({});
    expect(result.byTeam).toEqual({});
    expect(result.withTags).toBe(0);
  });

  it('should rethrow database errors', async () => {
    // getCustomerStats runs Promise.all with 7 sub-queries. The first to throw
    // will cause the whole Promise.all to reject. We need a chain that supports
    // all possible chain methods so it doesn't fail on a missing method.
    const errorChain: any = {
      from: () => errorChain, leftJoin: () => errorChain, innerJoin: () => errorChain,
      where: () => errorChain, groupBy: () => errorChain, orderBy: () => errorChain,
      limit: () => errorChain, offset: () => errorChain,
      get: async () => { throw new Error('DB connection failed'); },
      all: async () => { throw new Error('DB connection failed'); }
    };
    const errorDb = { select: () => errorChain };
    service = createService(errorDb);

    await expect(service.getCustomerStats()).rejects.toThrow('DB connection failed');
  });
});

describe('CustomerStatsService - Permission Conditions', () => {
  let service: CustomerStatsService;

  beforeEach(() => {
    const mockDb = createMockDb();
    service = createService(mockDb);
    vi.clearAllMocks();
  });

  it('should not add team filter for admin users', () => {
    const conditions = (service as any).buildPermissionConditions(adminPayload);

    // Admin: only soft-delete exclusion, no team scope
    expect(conditions.length).toBe(1); // Just the _deleted check
  });

  it('should add team-scoping condition for non-admin agents', () => {
    const conditions = (service as any).buildPermissionConditions(agentPayload);

    // Agent: team scope + soft-delete exclusion = 2 conditions
    expect(conditions.length).toBe(2);
  });

  it('should only add soft-delete exclusion when no payload provided', () => {
    const conditions = (service as any).buildPermissionConditions(undefined);

    // No user: only soft-delete exclusion
    expect(conditions.length).toBe(1);
  });

  it('should only add soft-delete exclusion when agent has no teamId', () => {
    const noTeamPayload = { userId: 'agent-2', role: 'agent', teamId: undefined } as any;

    const conditions = (service as any).buildPermissionConditions(noTeamPayload);

    // No teamId: only soft-delete exclusion
    expect(conditions.length).toBe(1);
  });
});

describe('CustomerStatsService - getPlatformDistribution', () => {
  let service: CustomerStatsService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return platform distribution', async () => {
    const mockDb = createMockDb({
      platformStats: [
        { platform: 'line', count: 60 },
        { platform: 'facebook', count: 40 }
      ]
    });
    service = createService(mockDb);

    const result = await service.getPlatformDistribution(adminPayload);

    expect(result).toEqual({ line: 60, facebook: 40 });
  });

  it('should return empty object when no customers', async () => {
    const mockDb = createMockDb({ platformStats: [] });
    service = createService(mockDb);

    const result = await service.getPlatformDistribution();

    expect(result).toEqual({});
  });

  it('should rethrow database errors', async () => {
    const errorDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              all: async () => { throw new Error('Platform query failed'); }
            })
          }),
          groupBy: () => ({
            all: async () => { throw new Error('Platform query failed'); }
          })
        })
      })
    };
    service = createService(errorDb);

    await expect(service.getPlatformDistribution()).rejects.toThrow('Platform query failed');
  });
});

describe('CustomerStatsService - getTeamDistribution', () => {
  let service: CustomerStatsService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return team distribution', async () => {
    const mockDb = createMockDb({
      teamStats: [
        { teamName: 'Support', count: 50 },
        { teamName: 'Sales', count: 30 },
        { teamName: '未分配', count: 20 }
      ]
    });
    service = createService(mockDb);

    const result = await service.getTeamDistribution(adminPayload);

    expect(result).toEqual({ Support: 50, Sales: 30, '未分配': 20 });
  });

  it('should return empty object when no teams', async () => {
    const mockDb = createMockDb({ teamStats: [] });
    service = createService(mockDb);

    const result = await service.getTeamDistribution();

    expect(result).toEqual({});
  });
});

describe('CustomerStatsService - getActivityStats', () => {
  let service: CustomerStatsService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return activity statistics', async () => {
    // getActivityStats makes 3 sequential queries with different select fields.
    // We use a call-index counter to return the right data for each query.
    let selectCallIdx = 0;
    const activityDb: any = {
      select: (fields?: any) => {
        selectCallIdx++;
        const keys = fields ? Object.keys(fields) : [];

        // Query 1: totalActiveResult - select({ count })
        if (selectCallIdx === 1 && keys.includes('count')) {
          return {
            from: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: () => ({
                    get: async () => ({ count: 20 })
                  })
                })
              })
            })
          };
        }

        // Query 2: dailyActiveResult - select({ date, count })
        if (keys.includes('date') && keys.includes('count')) {
          return {
            from: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: () => ({
                    groupBy: () => ({
                      orderBy: () => ({
                        all: async () => [
                          { date: '2024-06-14', count: 5 },
                          { date: '2024-06-15', count: 8 }
                        ]
                      })
                    })
                  })
                })
              })
            })
          };
        }

        // Query 3: topActiveResult - select({ customerId, displayName, messageCount })
        if (keys.includes('customerId') && keys.includes('displayName')) {
          return {
            from: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: () => ({
                    groupBy: () => ({
                      orderBy: () => ({
                        limit: () => ({
                          all: async () => [
                            { customerId: 1, displayName: 'Active User', messageCount: 50 },
                            { customerId: 2, displayName: null, messageCount: 30 }
                          ]
                        })
                      })
                    })
                  })
                })
              })
            })
          };
        }

        // Fallback
        const chain: any = {
          from: () => chain, innerJoin: () => chain, where: () => chain,
          groupBy: () => chain, orderBy: () => chain, limit: () => chain,
          get: async () => ({ count: 0 }),
          all: async () => []
        };
        return chain;
      }
    };
    service = createService(activityDb);

    const result = await service.getActivityStats(adminPayload, 30);

    expect(result.totalActive).toBe(20);
    expect(result.dailyActive).toEqual({
      '2024-06-14': 5,
      '2024-06-15': 8
    });
    expect(result.topActiveCustomers).toHaveLength(2);
    expect(result.topActiveCustomers[0]).toEqual({
      customerId: 1,
      displayName: 'Active User',
      messageCount: 50
    });
  });

  it('should use "Customer {id}" as fallback for null displayName', async () => {
    let selectCallIdx = 0;
    const fallbackDb: any = {
      select: (fields?: any) => {
        selectCallIdx++;
        const keys = fields ? Object.keys(fields) : [];

        if (selectCallIdx === 1 && keys.includes('count')) {
          return {
            from: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: () => ({
                    get: async () => ({ count: 1 })
                  })
                })
              })
            })
          };
        }
        if (keys.includes('date')) {
          return {
            from: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: () => ({
                    groupBy: () => ({
                      orderBy: () => ({
                        all: async () => []
                      })
                    })
                  })
                })
              })
            })
          };
        }
        if (keys.includes('customerId') && keys.includes('displayName')) {
          return {
            from: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: () => ({
                    groupBy: () => ({
                      orderBy: () => ({
                        limit: () => ({
                          all: async () => [
                            { customerId: 5, displayName: null, messageCount: 10 }
                          ]
                        })
                      })
                    })
                  })
                })
              })
            })
          };
        }
        const chain: any = {
          from: () => chain, innerJoin: () => chain, where: () => chain,
          groupBy: () => chain, orderBy: () => chain, limit: () => chain,
          get: async () => ({ count: 0 }), all: async () => []
        };
        return chain;
      }
    };
    service = createService(fallbackDb);

    const result = await service.getActivityStats();

    expect(result.topActiveCustomers[0].displayName).toBe('Customer 5');
  });

  it('should default to 30 days when days not provided', async () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const result = await service.getActivityStats(adminPayload);

    // Should work with default 30 days
    expect(result).toHaveProperty('totalActive');
    expect(result).toHaveProperty('dailyActive');
    expect(result).toHaveProperty('topActiveCustomers');
  });

  it('should handle zero active results', async () => {
    let selectCallIdx = 0;
    const zeroDb: any = {
      select: (fields?: any) => {
        selectCallIdx++;
        const keys = fields ? Object.keys(fields) : [];

        if (selectCallIdx === 1 && keys.includes('count')) {
          return {
            from: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: () => ({
                    get: async () => ({ count: 0 })
                  })
                })
              })
            })
          };
        }
        if (keys.includes('date') && keys.includes('count')) {
          return {
            from: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: () => ({
                    groupBy: () => ({
                      orderBy: () => ({
                        all: async () => []
                      })
                    })
                  })
                })
              })
            })
          };
        }
        if (keys.includes('customerId') && keys.includes('displayName')) {
          return {
            from: () => ({
              innerJoin: () => ({
                innerJoin: () => ({
                  where: () => ({
                    groupBy: () => ({
                      orderBy: () => ({
                        limit: () => ({
                          all: async () => []
                        })
                      })
                    })
                  })
                })
              })
            })
          };
        }

        const chain: any = {
          from: () => chain, innerJoin: () => chain, where: () => chain,
          groupBy: () => chain, orderBy: () => chain, limit: () => chain,
          get: async () => ({ count: 0 }),
          all: async () => []
        };
        return chain;
      }
    };
    service = createService(zeroDb);

    const result = await service.getActivityStats();

    expect(result.totalActive).toBe(0);
    expect(result.dailyActive).toEqual({});
    expect(result.topActiveCustomers).toEqual([]);
  });

  it('should rethrow database errors', async () => {
    const errorDb = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                get: async () => { throw new Error('Activity query failed'); }
              })
            })
          })
        })
      })
    };
    service = createService(errorDb);

    await expect(service.getActivityStats()).rejects.toThrow('Activity query failed');
  });
});

describe('CustomerStatsService - getGrowthStats', () => {
  let service: CustomerStatsService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return growth statistics', async () => {
    const mockDb = createMockDb({
      monthlyGrowth: [
        { month: '2024-05', count: 10 },
        { month: '2024-06', count: 15 }
      ]
    });
    service = createService(mockDb);

    const result = await service.getGrowthStats(adminPayload, 12);

    expect(result.monthlyGrowth).toEqual({
      '2024-05': 10,
      '2024-06': 15
    });
    expect(result.totalGrowth).toBe(25);
    expect(result.averageMonthlyGrowth).toBe(12.5);
  });

  it('should default to 12 months when not specified', async () => {
    const mockDb = createMockDb();
    service = createService(mockDb);

    const result = await service.getGrowthStats(adminPayload);

    expect(result).toHaveProperty('monthlyGrowth');
    expect(result).toHaveProperty('totalGrowth');
    expect(result).toHaveProperty('averageMonthlyGrowth');
  });

  it('should handle zero growth', async () => {
    const mockDb = createMockDb({ monthlyGrowth: [] });
    service = createService(mockDb);

    const result = await service.getGrowthStats();

    expect(result.monthlyGrowth).toEqual({});
    expect(result.totalGrowth).toBe(0);
    expect(result.averageMonthlyGrowth).toBe(0);
  });

  it('should round averageMonthlyGrowth to 2 decimal places', async () => {
    const mockDb = createMockDb({
      monthlyGrowth: [
        { month: '2024-04', count: 7 },
        { month: '2024-05', count: 11 },
        { month: '2024-06', count: 13 }
      ]
    });
    service = createService(mockDb);

    const result = await service.getGrowthStats();

    // total=31, avg=31/3=10.333... → rounded to 10.33
    expect(result.averageMonthlyGrowth).toBe(10.33);
  });

  it('should rethrow database errors', async () => {
    const errorDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            groupBy: () => ({
              orderBy: () => ({
                all: async () => { throw new Error('Growth query failed'); }
              })
            })
          })
        })
      })
    };
    service = createService(errorDb);

    await expect(service.getGrowthStats()).rejects.toThrow('Growth query failed');
  });
});
