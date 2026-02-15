/**
 * @deprecated Use DatabaseTestEnvironment instead. This legacy KV mock will be removed in a future cleanup.
 * @see tests/helpers/DatabaseTestEnvironment.ts
 */
import { vi } from 'vitest'

export class MockKVNamespace {
  private store = new Map<string, string>()
  
  get = vi.fn(async (key: string): Promise<string | null> => {
    return this.store.get(key) || null
  })

  put = vi.fn(async (key: string, value: string, options?: any): Promise<void> => {
    this.store.set(key, value)
    
    // Simulate TTL expiration
    if (options?.expirationTtl) {
      setTimeout(() => {
        this.store.delete(key)
      }, options.expirationTtl * 1000)
    }
  })

  delete = vi.fn(async (key: string): Promise<void> => {
    this.store.delete(key)
  })

  list = vi.fn(async (options?: any) => {
    const keys = Array.from(this.store.keys())
    return {
      keys: keys.map(name => ({ name })),
      list_complete: true,
      cursor: null
    }
  })

  // Helper methods for testing
  setMockValue(key: string, value: string) {
    this.store.set(key, value)
  }

  getMockValue(key: string): string | undefined {
    return this.store.get(key)
  }

  clearMockStore() {
    this.store.clear()
  }

  getMockStore() {
    return new Map(this.store)
  }

  reset() {
    this.store.clear()
    vi.clearAllMocks()
  }
}

export const createMockKV = () => new MockKVNamespace()