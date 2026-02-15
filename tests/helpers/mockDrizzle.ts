/**
 * @deprecated Use DatabaseTestEnvironment instead. This legacy Drizzle mock will be removed in a future cleanup.
 * @see tests/helpers/DatabaseTestEnvironment.ts
 */

import { vi } from 'vitest'

export interface MockDrizzleQuery {
  select: vi.Mock
  where: vi.Mock
  leftJoin: vi.Mock
  limit: vi.Mock
  offset: vi.Mock
  orderBy: vi.Mock
  execute: vi.Mock
}

export class MockDrizzleDB {
  private queryResponses: Map<string, any> = new Map()

  // Main query methods
  select = vi.fn((fields?: any) => this.createQueryBuilder('select', fields))
  insert = vi.fn((table: any) => this.createQueryBuilder('insert', table))
  update = vi.fn((table: any) => this.createQueryBuilder('update', table))
  delete = vi.fn((table: any) => this.createQueryBuilder('delete', table))

  // Batch method for executing multiple queries atomically
  batch = vi.fn(async (queries: any[]) => {
    // Execute all queries and return their results
    const results = await Promise.all(
      queries.map(async (query) => {
        if (query && typeof query.then === 'function') {
          return await query
        }
        return { success: true }
      })
    )
    return results
  })

  // Query builder
  private createQueryBuilder(type: string, target: any) {
    const self = this
    const builder: any = {
      _type: type,
      _target: target,
      _table: null,
      _where: null,
      _joins: [],
      _limit: null,
      _offset: null,
      _orderBy: null,
      _values: null,
      _set: null,

      from: vi.fn((table: any) => {
        builder._table = table
        return builder
      }),
      where: vi.fn((condition: any) => {
        builder._where = condition
        return builder
      }),
      leftJoin: vi.fn((table: any, on: any) => {
        builder._joins.push({ table, on, type: 'left' })
        return builder
      }),
      innerJoin: vi.fn((table: any, on: any) => {
        builder._joins.push({ table, on, type: 'inner' })
        return builder
      }),
      limit: vi.fn((count: number) => {
        builder._limit = count
        return builder
      }),
      offset: vi.fn((count: number) => {
        builder._offset = count
        return builder
      }),
      orderBy: vi.fn((field: any) => {
        builder._orderBy = field
        return builder
      }),
      values: vi.fn((data: any) => {
        builder._values = data
        return builder
      }),
      set: vi.fn((data: any) => {
        builder._set = data
        return builder
      }),
      returning: vi.fn(() => builder),

      get: vi.fn(async () => {
        // Get returns a single row (first item from array result)
        const result = await builder._executeQuery()
        return Array.isArray(result) && result.length > 0 ? result[0] : null
      }),

      all: vi.fn(async () => {
        // All returns all rows
        const result = await builder._executeQuery()
        return Array.isArray(result) ? result : []
      }),

      execute: vi.fn(async () => {
        return builder._executeQuery()
      }),

      _executeQuery: async () => {
        // Check if we have a pre-configured response
        const key = self.getQueryKey(type, target, builder)
        if (self.queryResponses.has(key)) {
          return self.queryResponses.get(key)
        }

        // Check by query type and characteristics
        if (type === 'select') {
          // Check if it's a count query
          if (target?.total !== undefined || JSON.stringify(target).includes('count')) {
            return [{ total: 0 }]
          }
          return []
        } else if (type === 'insert') {
          return [builder._values || { id: 1 }]
        } else if (type === 'update' || type === 'delete') {
          return { changes: 1 }
        }

        return []
      }
    }

    // Make the builder directly awaitable (simulates Drizzle's Promise-like behavior)
    builder.then = vi.fn(async (resolve: any) => {
      const result = await builder._executeQuery()
      return resolve(result)
    })

    builder.catch = vi.fn(async (reject: any) => {
      try {
        await builder._executeQuery()
      } catch (error) {
        return reject(error)
      }
    })

    return builder
  }

  // Helper to set up mock responses for data queries
  mockSelectResponse(response: any[]) {
    // Set up select to return this response by default
    this.select = vi.fn((fields?: any) => {
      const builder = this.createQueryBuilder('select', fields)

      // Check if this is a count query (avoid JSON.stringify for circular refs)
      const isCountQuery = fields && typeof fields === 'object' && ('total' in fields)

      if (!isCountQuery) {
        builder._executeQuery = vi.fn(async () => response)
        builder.then = vi.fn(async (resolve: any) => resolve(response))
      }

      return builder
    })
  }

  // Helper to set up mock responses for count queries
  mockCountResponse(total: number) {
    // Intercept select queries with count
    this.select = vi.fn((fields?: any) => {
      const builder = this.createQueryBuilder('select', fields)

      // Check if this is a count query (avoid JSON.stringify for circular refs)
      const isCountQuery = fields && typeof fields === 'object' && ('total' in fields)

      if (isCountQuery) {
        builder._executeQuery = vi.fn(async () => [{ total }])
        builder.then = vi.fn(async (resolve: any) => resolve([{ total }]))
      }

      return builder
    })
  }

  // Combined helper to set up both data and count responses
  mockQueryResponses(dataResponse: any[], countTotal: number) {
    this.select = vi.fn((fields?: any) => {
      const builder = this.createQueryBuilder('select', fields)

      // Check if this is a count query by looking for 'total' property
      // Avoid JSON.stringify to prevent circular reference errors
      const isCountQuery = fields && typeof fields === 'object' && ('total' in fields)

      if (isCountQuery) {
        builder._executeQuery = vi.fn(async () => [{ total: countTotal }])
        builder.then = vi.fn(async (resolve: any) => resolve([{ total: countTotal }]))
      } else {
        builder._executeQuery = vi.fn(async () => dataResponse)
        builder.then = vi.fn(async (resolve: any) => resolve(dataResponse))
      }

      return builder
    })
  }

  mockInsertResponse(tableName: string, insertedData: any) {
    const key = `insert:${tableName}`
    this.queryResponses.set(key, [insertedData])

    this.insert = vi.fn((table: any) => {
      const builder = this.createQueryBuilder('insert', table)
      builder.execute = vi.fn().mockResolvedValue([insertedData])
      builder.then = vi.fn(async (resolve: any) => resolve([insertedData]))
      return builder
    })
  }

  mockUpdateResponse(tableName: string, changes: number = 1) {
    const key = `update:${tableName}`
    this.queryResponses.set(key, { changes })

    this.update = vi.fn((table: any) => {
      const builder = this.createQueryBuilder('update', table)
      builder.execute = vi.fn().mockResolvedValue({ changes })
      builder.then = vi.fn(async (resolve: any) => resolve({ changes }))
      return builder
    })
  }

  mockError(error: Error) {
    this.select = vi.fn(() => {
      const builder = this.createQueryBuilder('select', {})
      builder.execute = vi.fn().mockRejectedValue(error)
      builder.then = vi.fn(async (_, reject: any) => reject(error))
      return builder
    })
  }

  private getQueryKey(type: string, target: any, builder: any): string {
    let key = `${type}:`

    if (target?.name) {
      key += target.name
    } else if (builder._table?.name) {
      key += builder._table.name
    }

    return key
  }

  reset() {
    this.queryResponses.clear()
    vi.clearAllMocks()
  }
}

export const createMockDrizzle = () => new MockDrizzleDB()

// Mock DatabaseService
export class MockDatabaseService {
  db: MockDrizzleDB

  constructor() {
    this.db = createMockDrizzle()
  }

  getDatabase() {
    return this.db
  }

  // Common database service methods
  transaction = vi.fn(async (callback: any) => {
    return await callback(this.db)
  })

  reset() {
    this.db.reset()
    vi.clearAllMocks()
  }
}

export const createMockDatabaseService = () => new MockDatabaseService()
