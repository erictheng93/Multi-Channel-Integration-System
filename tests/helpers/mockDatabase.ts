import { vi } from 'vitest'

export interface MockD1Result {
  success: boolean
  meta?: {
    last_row_id?: number
    changes?: number
    duration?: number
  }
  results?: any[]
}

export interface MockD1Statement {
  bind: (...values: any[]) => MockD1Statement
  run: () => Promise<MockD1Result>
  first: <T = any>() => Promise<T | null>
  all: <T = any>() => Promise<{ results: T[] }>
  raw: <T = any>() => Promise<T[][]>
}

export class MockD1Database {
  private mockStatements = new Map<string, MockD1Statement>()

  prepare = vi.fn((query: string): MockD1Statement => {
    const statement: MockD1Statement = {
      bind: vi.fn((...values: any[]) => statement),
      run: vi.fn().mockResolvedValue({
        success: true,
        meta: { changes: 0 },
        results: []
      }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
      raw: vi.fn().mockResolvedValue([])
    }

    this.mockStatements.set(query, statement)
    return statement
  })

  // Helper methods for setting up mock responses
  mockQuery(query: string, response: any) {
    const statement = this.mockStatements.get(query)
    if (statement) {
      if (Array.isArray(response)) {
        statement.all = vi.fn().mockResolvedValue({ results: response })
        statement.raw = vi.fn().mockResolvedValue(response.map(row => Object.values(row)))
      } else if (response === null || response === undefined) {
        statement.first = vi.fn().mockResolvedValue(null)
        statement.raw = vi.fn().mockResolvedValue([])
      } else {
        statement.first = vi.fn().mockResolvedValue(response)
        statement.raw = vi.fn().mockResolvedValue([Object.values(response)])
      }
    }
  }

  mockInsert(query: string, insertId: number) {
    const statement = this.mockStatements.get(query)
    if (statement) {
      statement.run = vi.fn().mockResolvedValue({
        success: true,
        meta: { last_row_id: insertId }
      })
      statement.raw = vi.fn().mockResolvedValue([[insertId]])
    }
  }

  mockUpdate(query: string, changes: number = 1) {
    const statement = this.mockStatements.get(query)
    if (statement) {
      statement.run = vi.fn().mockResolvedValue({
        success: true,
        meta: { changes }
      })
      statement.raw = vi.fn().mockResolvedValue([[changes]])
    }
  }

  mockError(query: string, error: Error) {
    const statement = this.mockStatements.get(query)
    if (statement) {
      statement.run = vi.fn().mockRejectedValue(error)
      statement.first = vi.fn().mockRejectedValue(error)
      statement.all = vi.fn().mockRejectedValue(error)
      statement.raw = vi.fn().mockRejectedValue(error)
    }
  }

  reset() {
    this.mockStatements.clear()
    vi.clearAllMocks()
  }
}

export const createMockDatabase = () => new MockD1Database()

/**
 * Helper function to create a complete D1 PreparedStatement mock
 * Ensures all required methods (including .raw()) are present
 */
export function createMockStatement(overrides?: Partial<MockD1Statement>): MockD1Statement {
  const statement: MockD1Statement = {
    bind: vi.fn((...values: any[]) => statement),
    run: vi.fn().mockResolvedValue({
      success: true,
      meta: { changes: 0 },
      results: []
    }),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [] }),
    raw: vi.fn().mockResolvedValue([]),
    ...overrides
  }

  // Ensure bind always returns a complete statement
  statement.bind = vi.fn((...values: any[]) => {
    if (overrides?.bind) {
      return overrides.bind(...values)
    }
    return statement
  })

  return statement
}

// Export new refactored test helpers
export { MockDatabaseFactory } from './MockDatabaseFactory'
export { DatabaseTestHelper } from './DatabaseTestHelper'