/**
 * Unit Tests for useConversationCache Composable
 *
 * @module tests/unit/composables/conversation/useConversationCache.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useConversationCache } from '@/composables/conversation/useConversationCache'
import type { Conversation, ConversationFilters } from '@/types'

describe('useConversationCache', () => {
  let cacheComposable: ReturnType<typeof useConversationCache>

  // 創建真實的 localStorage 實現
  // 創建真實的 localStorage 實現
  const createRealLocalStorage = () => {
    const storage: Record<string, string> = {}
    const localStorageProxy: any = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => {
        storage[key] = value
        // 同時設置為代理對象的屬性，以支持 Object.keys()
        localStorageProxy[key] = value
      },
      removeItem: (key: string) => {
        delete storage[key]
        delete localStorageProxy[key]
      },
      clear: () => {
        Object.keys(storage).forEach(key => {
          delete storage[key]
          delete localStorageProxy[key]
        })
      },
      get length() { return Object.keys(storage).length },
      key: (index: number) => Object.keys(storage)[index] || null
    }
    return localStorageProxy
  }

  // 测试数据
  const mockConversations: Conversation[] = [
    {
      id: '1',
      customerId: 'customer-1',
      customerName: 'Test Customer',
      platform: 'line',
      status: 'active',
      lastMessageAt: '2024-01-01T10:00:00Z',
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z'
    }
  ] as Conversation[]

  beforeEach(() => {
    // 使用真實的 localStorage 實現
    const realLocalStorage = createRealLocalStorage()
    Object.defineProperty(global, 'localStorage', {
      value: realLocalStorage,
      writable: true,
      configurable: true
    })

    cacheComposable = useConversationCache()
    // 清除 localStorage
    localStorage.clear()
    // 重置统计
    cacheComposable.resetStats()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('初始化状态', () => {
    it('应该初始化为零统计', () => {
      const { cacheHits, cacheMisses, cacheHitRate } = cacheComposable

      expect(cacheHits.value).toBe(0)
      expect(cacheMisses.value).toBe(0)
      expect(cacheHitRate.value).toBe(0)
    })
  })

  describe('generateCacheKey', () => {
    it('应该生成基本缓存键', () => {
      const { generateCacheKey } = cacheComposable

      const filters: ConversationFilters = {
        status: '',
        platform: '',
        assignedTo: undefined
      }

      const key = generateCacheKey(filters, 1)
      expect(key).toBe('conversation-list:page=1')
    })

    it('应该包含 status 筛选', () => {
      const { generateCacheKey } = cacheComposable

      const filters: ConversationFilters = {
        status: 'active',
        platform: '',
        assignedTo: undefined
      }

      const key = generateCacheKey(filters, 1)
      expect(key).toBe('conversation-list:status=active:page=1')
    })

    it('应该包含 platform 筛选', () => {
      const { generateCacheKey } = cacheComposable

      const filters: ConversationFilters = {
        status: '',
        platform: 'line',
        assignedTo: undefined
      }

      const key = generateCacheKey(filters, 1)
      expect(key).toBe('conversation-list:platform=line:page=1')
    })

    it('应该包含多个筛选条件', () => {
      const { generateCacheKey } = cacheComposable

      // Note: Individual assignment (assignedTo) removed - only team-based filtering is supported now
      const filters: ConversationFilters = {
        status: 'active',
        platform: 'line',
        tagIds: [1, 2, 3]
      }

      const key = generateCacheKey(filters, 2)
      expect(key).toBe('conversation-list:status=active:platform=line:tags=1,2,3:page=2')
    })
  })

  describe('setCachedData & getCachedData', () => {
    it('应该正确设置和获取缓存数据', async () => {
      const { setCachedData, getCachedData } = cacheComposable

      const key = 'test-key'
      await setCachedData(key, mockConversations)

      const cached = await getCachedData(key)
      expect(cached).toEqual(mockConversations)
    })

    it('未找到缓存时应该返回 null', async () => {
      const { getCachedData, cacheMisses } = cacheComposable

      const cached = await getCachedData('non-existent-key')

      expect(cached).toBeNull()
      expect(cacheMisses.value).toBe(1)
    })

    it('缓存命中时应该增加命中计数', async () => {
      const { setCachedData, getCachedData, cacheHits } = cacheComposable

      const key = 'test-key'
      await setCachedData(key, mockConversations)
      await getCachedData(key)

      expect(cacheHits.value).toBe(1)
    })

    it('缓存未命中时应该增加未命中计数', async () => {
      const { getCachedData, cacheMisses } = cacheComposable

      await getCachedData('non-existent-key')
      await getCachedData('another-non-existent-key')

      expect(cacheMisses.value).toBe(2)
    })

    it('应该正确计算缓存命中率', async () => {
      const { setCachedData, getCachedData, cacheHitRate } = cacheComposable

      const key = 'test-key'
      await setCachedData(key, mockConversations)

      // 2 次命中，1 次未命中
      await getCachedData(key)
      await getCachedData(key)
      await getCachedData('non-existent-key')

      // 命中率应该是 2/3 = 66.67%
      expect(cacheHitRate.value).toBeCloseTo(66.67, 1)
    })
  })

  describe('缓存过期', () => {
    it('过期的缓存应该返回 null', async () => {
      const { setCachedData, getCachedData } = cacheComposable

      const key = 'test-key'
      // 设置 TTL 为 100ms
      await setCachedData(key, mockConversations, 100)

      // 等待缓存过期
      await new Promise(resolve => setTimeout(resolve, 150))

      const cached = await getCachedData(key)
      expect(cached).toBeNull()
    })

    it('未过期的缓存应该正常返回', async () => {
      const { setCachedData, getCachedData } = cacheComposable

      const key = 'test-key'
      // 设置 TTL 为 1000ms
      await setCachedData(key, mockConversations, 1000)

      // 立即获取
      const cached = await getCachedData(key)
      expect(cached).toEqual(mockConversations)
    })
  })

  describe('invalidateCache', () => {
    it('应该删除指定缓存', async () => {
      const { setCachedData, getCachedData, invalidateCache } = cacheComposable

      const key = 'test-key'
      await setCachedData(key, mockConversations)

      await invalidateCache(key)

      const cached = await getCachedData(key)
      expect(cached).toBeNull()
    })

    it('应该删除所有对话缓存（不提供 key 时）', async () => {
      const { setCachedData, getCachedData, invalidateCache } = cacheComposable

      await setCachedData('conversation-list:page=1', mockConversations)
      await setCachedData('conversation-list:page=2', mockConversations)
      await setCachedData('other-cache:page=1', mockConversations)

      await invalidateCache()

      // 对话缓存应该被删除
      expect(await getCachedData('conversation-list:page=1')).toBeNull()
      expect(await getCachedData('conversation-list:page=2')).toBeNull()

      // 其他缓存应该保留
      expect(await getCachedData('other-cache:page=1')).toEqual(mockConversations)
    })
  })

  describe('clearAllCache', () => {
    it('应该清除所有缓存', async () => {
      const { setCachedData, getCachedData, clearAllCache } = cacheComposable

      await setCachedData('cache-1', mockConversations)
      await setCachedData('cache-2', mockConversations)

      await clearAllCache()

      expect(await getCachedData('cache-1')).toBeNull()
      expect(await getCachedData('cache-2')).toBeNull()
    })
  })

  describe('resetStats', () => {
    it('应该重置所有统计数据', async () => {
      const { setCachedData, getCachedData, cacheHits, cacheMisses, resetStats } = cacheComposable

      await setCachedData('test-key', mockConversations)
      await getCachedData('test-key')
      await getCachedData('non-existent-key')

      expect(cacheHits.value).toBe(1)
      expect(cacheMisses.value).toBe(1)

      resetStats()

      expect(cacheHits.value).toBe(0)
      expect(cacheMisses.value).toBe(0)
    })
  })

  describe('错误处理', () => {
    it('无效的缓存数据应该触发 cacheMisses', async () => {
      const { getCachedData, cacheMisses } = cacheComposable

      // 设置无效的缓存数据
      localStorage.setItem('test-key', 'invalid-json')

      const cached = await getCachedData('test-key')

      expect(cached).toBeNull()
      expect(cacheMisses.value).toBe(1)
    })
  })
})
