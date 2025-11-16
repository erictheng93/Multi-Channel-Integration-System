import { vi } from 'vitest'

/**
 * Query Setup Configuration
 */
export interface QuerySetup {
  table: string
  where?: string[]
  result: any
  nth?: number // Which call to this query (for sequential scenarios)
  error?: Error // Mock error scenario
}

/**
 * Factory for creating complete database mocks
 * Handles all D1 PreparedStatement methods including .raw()
 *
 * @example
 * const factory = new MockDatabaseFactory()
 * const mockDb = factory.createCompleteMock()
 *
 * factory.setupSelectQuery({
 *   table: 'customers',
 *   where: ['platform', 'platform_user_id'],
 *   result: mockCustomer
 * })
 */
export class MockDatabaseFactory {
  private queryMocks: Map<string, QuerySetup[]> = new Map()
  private queryCallCounts: Map<string, number> = new Map()
  private mockDb: any = null
  private storage: Map<string, Map<string, any>> = new Map() // In-memory storage by table

  /**
   * 創建完整的 mock database
   * 包含所有必需的 D1 Database 方法
   */
  createCompleteMock() {
    this.mockDb = {
      prepare: vi.fn((query: string) => this.createStatementMock(query)),
      dump: vi.fn(),
      batch: vi.fn(),
      exec: vi.fn()
    }
    return this.mockDb
  }

  /**
   * 創建完整的 PreparedStatement mock
   * 確保包含所有方法，特別是 .raw()
   */
  private createStatementMock(query: string): any {
    let boundArgs: any[] = []

    const statement: any = {
      bind: vi.fn((...args: any[]) => {
        boundArgs = args
        return statement
      }),
      run: vi.fn(async () => {
        // Handle INSERT operations with basic state management
        if (query.toLowerCase().includes('insert into')) {
          const tableMatch = query.match(/insert into\s+`?(\w+)`?/i)
          if (tableMatch) {
            const table = tableMatch[1]
            this.handleInsert(table, boundArgs)
          }
        }
        return {
          success: true,
          meta: { changes: 1, last_row_id: Date.now() },
          results: []
        }
      }),
      first: vi.fn(async () => {
        // Handle SELECT operations with basic state retrieval
        if (query.toLowerCase().includes('select') && query.toLowerCase().includes('where')) {
          const tableMatch = query.match(/from\s+`?(\w+)`?/i)
          if (tableMatch) {
            const table = tableMatch[1]
            return this.handleSelect(table, boundArgs)
          }
        }
        return null
      }),
      all: vi.fn(async () => {
        const results = []
        if (query.toLowerCase().includes('select')) {
          const tableMatch = query.match(/from\s+`?(\w+)`?/i)
          if (tableMatch) {
            const table = tableMatch[1]
            const tableStorage = this.storage.get(table)
            if (tableStorage) {
              results.push(...Array.from(tableStorage.values()))
            }
          }
        }
        return { results, success: true, meta: {} }
      }),
      raw: vi.fn().mockResolvedValue([]),
      get: vi.fn(async () => {
        // Drizzle uses .get() instead of .first()
        return statement.first()
      })
    }

    // Check if we have a pre-configured mock for this query
    const mockConfig = this.findQueryMock(query)
    if (mockConfig) {
      this.applyMockConfig(statement, mockConfig)
    }

    return statement
  }

  /**
   * Handle INSERT operations by storing data in memory
   */
  private handleInsert(table: string, args: any[]): void {
    if (!this.storage.has(table)) {
      this.storage.set(table, new Map())
    }
    const tableStorage = this.storage.get(table)!

    // Create a record from the arguments
    // This is a simplified version - real implementation would parse the query
    if (args.length > 0 && typeof args[0] === 'object') {
      const record = args[0]
      const id = record.id || `generated-${Date.now()}`
      tableStorage.set(id, { ...record, id })
    }
  }

  /**
   * Handle SELECT operations by retrieving data from memory
   */
  private handleSelect(table: string, args: any[]): any | null {
    const tableStorage = this.storage.get(table)
    if (!tableStorage || tableStorage.size === 0) {
      return null
    }

    // If args provided, try to find by ID (first arg)
    if (args.length > 0) {
      const id = args[0]
      return tableStorage.get(id) || null
    }

    // Otherwise return first record
    return Array.from(tableStorage.values())[0] || null
  }

  /**
   * Clear all stored data (useful for test isolation)
   */
  clearStorage(): void {
    this.storage.clear()
  }

  /**
   * 設定 SELECT 查詢的 mock 行為
   */
  setupSelectQuery(config: QuerySetup) {
    const key = this.getQueryKey('SELECT', config.table)
    const existing = this.queryMocks.get(key) || []
    existing.push(config)
    this.queryMocks.set(key, existing)
  }

  /**
   * 設定 INSERT 查詢的 mock 行為
   */
  setupInsertQuery(config: Omit<QuerySetup, 'where'>) {
    const key = this.getQueryKey('INSERT', config.table)
    const existing = this.queryMocks.get(key) || []
    existing.push(config as QuerySetup)
    this.queryMocks.set(key, existing)
  }

  /**
   * 設定 UPDATE 查詢的 mock 行為
   */
  setupUpdateQuery(config: QuerySetup) {
    const key = this.getQueryKey('UPDATE', config.table)
    const existing = this.queryMocks.get(key) || []
    existing.push(config)
    this.queryMocks.set(key, existing)
  }

  /**
   * 設定 DELETE 查詢的 mock 行為
   */
  setupDeleteQuery(config: Omit<QuerySetup, 'result'>) {
    const key = this.getQueryKey('DELETE', config.table)
    const existing = this.queryMocks.get(key) || []
    existing.push({ ...config, result: { success: true, meta: { changes: 1 } } } as QuerySetup)
    this.queryMocks.set(key, existing)
  }

  /**
   * 根據查詢找到對應的 mock 配置
   */
  private findQueryMock(query: string): QuerySetup | null {
    // Normalize query for matching
    const normalizedQuery = query.toLowerCase().trim()

    for (const [key, configs] of this.queryMocks.entries()) {
      if (normalizedQuery.includes(key.toLowerCase())) {
        // Handle sequential calls (nth parameter)
        const callCount = (this.queryCallCounts.get(key) || 0) + 1
        this.queryCallCounts.set(key, callCount)

        // Find config matching the call count
        const config = configs.find(c => !c.nth || c.nth === callCount)
        return config || configs[configs.length - 1] // Return last config as fallback
      }
    }
    return null
  }

  /**
   * 應用 mock 配置到 statement
   */
  private applyMockConfig(statement: any, config: QuerySetup) {
    // Handle error scenarios
    if (config.error) {
      statement.run = vi.fn().mockRejectedValue(config.error)
      statement.first = vi.fn().mockRejectedValue(config.error)
      statement.all = vi.fn().mockRejectedValue(config.error)
      statement.raw = vi.fn().mockRejectedValue(config.error)
      return
    }

    // Handle different result types
    if (Array.isArray(config.result)) {
      // Multiple results
      statement.all = vi.fn().mockResolvedValue({
        results: config.result,
        success: true,
        meta: {}
      })
      statement.raw = vi.fn().mockResolvedValue(
        config.result.map((r: any) =>
          typeof r === 'object' && r !== null ? Object.values(r) : [r]
        )
      )
      statement.first = vi.fn().mockResolvedValue(config.result[0] || null)
    } else if (config.result === null || config.result === undefined) {
      // No result
      statement.first = vi.fn().mockResolvedValue(null)
      statement.all = vi.fn().mockResolvedValue({ results: [], success: true, meta: {} })
      statement.raw = vi.fn().mockResolvedValue([])
    } else if (typeof config.result === 'object' && 'success' in config.result) {
      // Run result (INSERT/UPDATE/DELETE)
      statement.run = vi.fn().mockResolvedValue(config.result)
      statement.raw = vi.fn().mockResolvedValue([[config.result.meta?.last_row_id || 0]])
    } else {
      // Single result
      statement.first = vi.fn().mockResolvedValue(config.result)
      statement.all = vi.fn().mockResolvedValue({
        results: [config.result],
        success: true,
        meta: {}
      })
      const values = typeof config.result === 'object' && config.result !== null
        ? Object.values(config.result)
        : [config.result]
      statement.raw = vi.fn().mockResolvedValue([values])
    }
  }

  /**
   * 生成查詢的唯一鍵
   */
  private getQueryKey(type: string, table: string): string {
    return `${type}:${table}`
  }

  /**
   * 獲取當前 mock database 實例
   */
  getDatabase() {
    return this.mockDb
  }

  /**
   * 重置所有 mocks
   */
  reset() {
    this.queryMocks.clear()
    this.queryCallCounts.clear()
    if (this.mockDb) {
      vi.clearAllMocks()
    }
  }

  /**
   * 獲取查詢調用統計
   */
  getQueryStats(queryPattern: string): number {
    if (!this.mockDb || !this.mockDb.prepare) {
      return 0
    }
    return this.mockDb.prepare.mock.calls.filter((call: any[]) =>
      call[0].toLowerCase().includes(queryPattern.toLowerCase())
    ).length
  }
}
