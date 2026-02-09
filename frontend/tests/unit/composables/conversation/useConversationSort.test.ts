/**
 * Unit Tests for useConversationSort Composable
 *
 * @module tests/unit/composables/conversation/useConversationSort.test
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useConversationSort, type SortField, type SortOrder } from '@/composables/conversation/useConversationSort'
import type { Conversation } from '@/types'

describe('useConversationSort', () => {
  let sortComposable: ReturnType<typeof useConversationSort>

  // 测试数据
  const mockConversations: Conversation[] = [
    {
      id: '1',
      customerId: 'customer-1',
      customer: { id: 'customer-1', name: 'Alice' } as any,
      platform: 'line',
      status: 'open',
      lastMessageAt: '2024-01-03T10:00:00Z',
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-03T10:00:00Z',
      unreadCount: 5
    },
    {
      id: '2',
      customerId: 'customer-2',
      customer: { id: 'customer-2', name: 'Bob' } as any,
      platform: 'line',
      status: 'open',
      lastMessageAt: '2024-01-02T10:00:00Z',
      createdAt: '2024-01-02T10:00:00Z',
      updatedAt: '2024-01-02T10:00:00Z',
      unreadCount: 2
    },
    {
      id: '3',
      customerId: 'customer-3',
      customer: { id: 'customer-3', name: 'Charlie' } as any,
      platform: 'line',
      status: 'open',
      lastMessageAt: '2024-01-01T10:00:00Z',
      createdAt: '2024-01-03T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z',
      unreadCount: 10
    }
  ] as Conversation[]

  beforeEach(() => {
    sortComposable = useConversationSort()
  })

  describe('初始化状态', () => {
    it('应该初始化为默认排序配置', () => {
      const { sortBy, sortOrder } = sortComposable

      expect(sortBy.value).toBe('updatedAt')
      expect(sortOrder.value).toBe('desc')
    })

    it('应该支持自定义初始排序配置', () => {
      const customSort = useConversationSort('unreadCount', 'asc')

      expect(customSort.sortBy.value).toBe('unreadCount')
      expect(customSort.sortOrder.value).toBe('asc')
    })
  })

  describe('updateSort', () => {
    it('应该正确更新排序字段和方向', () => {
      const { sortBy, sortOrder, updateSort } = sortComposable

      updateSort('unreadCount', 'asc')

      expect(sortBy.value).toBe('unreadCount')
      expect(sortOrder.value).toBe('asc')
    })

    it('应该支持只更新排序字段而保持当前方向', () => {
      const { sortBy, sortOrder, updateSort } = sortComposable

      // 初始方向是 desc
      expect(sortOrder.value).toBe('desc')

      updateSort('unreadCount')

      expect(sortBy.value).toBe('unreadCount')
      expect(sortOrder.value).toBe('desc') // 方向保持不变
    })
  })

  describe('toggleSortOrder', () => {
    it('应该正确切换排序方向', () => {
      const { sortOrder, toggleSortOrder } = sortComposable

      expect(sortOrder.value).toBe('desc')

      toggleSortOrder()
      expect(sortOrder.value).toBe('asc')

      toggleSortOrder()
      expect(sortOrder.value).toBe('desc')
    })
  })

  describe('sortFieldLabel', () => {
    it('应该返回正确的排序字段显示名称', () => {
      const { sortFieldLabel, updateSort } = sortComposable

      updateSort('lastMessageAt')
      expect(sortFieldLabel.value).toBe('最后消息时间')

      updateSort('createdAt')
      expect(sortFieldLabel.value).toBe('创建时间')

      updateSort('unreadCount')
      expect(sortFieldLabel.value).toBe('未读数量')

      updateSort('customerName')
      expect(sortFieldLabel.value).toBe('客户名称')
    })
  })

  describe('applySortToConversations', () => {
    it('应该按 lastMessageAt 降序排序', () => {
      const { applySortToConversations, updateSort } = sortComposable

      updateSort('lastMessageAt', 'desc')
      const sorted = applySortToConversations(mockConversations)

      expect(sorted[0].id).toBe('1') // 2024-01-03
      expect(sorted[1].id).toBe('2') // 2024-01-02
      expect(sorted[2].id).toBe('3') // 2024-01-01
    })

    it('应该按 lastMessageAt 升序排序', () => {
      const { applySortToConversations, updateSort } = sortComposable

      updateSort('lastMessageAt', 'asc')
      const sorted = applySortToConversations(mockConversations)

      expect(sorted[0].id).toBe('3') // 2024-01-01
      expect(sorted[1].id).toBe('2') // 2024-01-02
      expect(sorted[2].id).toBe('1') // 2024-01-03
    })

    it('应该按 unreadCount 降序排序', () => {
      const { applySortToConversations, updateSort } = sortComposable

      updateSort('unreadCount', 'desc')
      const sorted = applySortToConversations(mockConversations)

      expect(sorted[0].unreadCount).toBe(10)
      expect(sorted[1].unreadCount).toBe(5)
      expect(sorted[2].unreadCount).toBe(2)
    })

    it('应该按 unreadCount 升序排序', () => {
      const { applySortToConversations, updateSort } = sortComposable

      updateSort('unreadCount', 'asc')
      const sorted = applySortToConversations(mockConversations)

      expect(sorted[0].unreadCount).toBe(2)
      expect(sorted[1].unreadCount).toBe(5)
      expect(sorted[2].unreadCount).toBe(10)
    })

    it('应该按 customerName 升序排序', () => {
      const { applySortToConversations, updateSort } = sortComposable

      updateSort('customerName', 'asc')
      const sorted = applySortToConversations(mockConversations)

      expect(sorted[0].customer?.name).toBe('Alice')
      expect(sorted[1].customer?.name).toBe('Bob')
      expect(sorted[2].customer?.name).toBe('Charlie')
    })

    it('应该按 customerName 降序排序', () => {
      const { applySortToConversations, updateSort } = sortComposable

      updateSort('customerName', 'desc')
      const sorted = applySortToConversations(mockConversations)

      expect(sorted[0].customer?.name).toBe('Charlie')
      expect(sorted[1].customer?.name).toBe('Bob')
      expect(sorted[2].customer?.name).toBe('Alice')
    })

    it('应该处理空数组', () => {
      const { applySortToConversations } = sortComposable

      const sorted = applySortToConversations([])
      expect(sorted).toEqual([])
    })

    it('不应该修改原数组', () => {
      const { applySortToConversations } = sortComposable
      const originalLength = mockConversations.length
      const firstId = mockConversations[0].id

      applySortToConversations(mockConversations)

      expect(mockConversations.length).toBe(originalLength)
      expect(mockConversations[0].id).toBe(firstId)
    })
  })
})
