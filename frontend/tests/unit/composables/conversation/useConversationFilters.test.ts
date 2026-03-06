/**
 * Unit Tests for useConversationFilters Composable
 *
 * @module tests/unit/composables/conversation/useConversationFilters.test
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useConversationFilters } from '@/composables/conversation/useConversationFilters'

describe('useConversationFilters', () => {
  let filtersComposable: ReturnType<typeof useConversationFilters>

  beforeEach(() => {
    filtersComposable = useConversationFilters()
  })

  describe('初始化状态', () => {
    it('应该初始化为默认筛选条件', () => {
      const { filters, selectedTagIds, hasActiveFilters } = filtersComposable

      expect(filters.value.status).toBe('')
      expect(filters.value.platform).toBe('')
      expect(filters.value.teamId).toBeUndefined()
      expect(filters.value.tagIds).toEqual([])
      expect(filters.value.search).toBe('')
      expect(selectedTagIds.value).toEqual([])
      expect(hasActiveFilters.value).toBe(false)
    })
  })

  describe('updateFilter', () => {
    it('应该正确更新单个筛选条件', () => {
      const { filters, updateFilter } = filtersComposable

      updateFilter('status', 'open')
      expect(filters.value.status).toBe('open')

      updateFilter('platform', 'line')
      expect(filters.value.platform).toBe('line')
    })

    it('应该正确更新搜索筛选条件', () => {
      const { filters, updateFilter } = filtersComposable

      updateFilter('search', 'test query')
      expect(filters.value.search).toBe('test query')
    })

    it('更新筛选条件后 hasActiveFilters 应该为 true', () => {
      const { hasActiveFilters, updateFilter } = filtersComposable

      updateFilter('status', 'open')
      expect(hasActiveFilters.value).toBe(true)
    })
  })

  describe('updateTagFilter', () => {
    it('应该正确更新标签筛选', () => {
      const { filters, selectedTagIds, updateTagFilter } = filtersComposable

      updateTagFilter([1, 2, 3])
      expect(selectedTagIds.value).toEqual([1, 2, 3])
      expect(filters.value.tagIds).toEqual([1, 2, 3])
    })
  })

  describe('toggleTagFilter', () => {
    it('应该正确切换标签选中状态', () => {
      const { selectedTagIds, toggleTagFilter } = filtersComposable

      // 选中标签 1
      toggleTagFilter(1)
      expect(selectedTagIds.value).toEqual([1])

      // 选中标签 2
      toggleTagFilter(2)
      expect(selectedTagIds.value).toEqual([1, 2])

      // 取消选中标签 1
      toggleTagFilter(1)
      expect(selectedTagIds.value).toEqual([2])
    })
  })

  describe('clearTagFilter', () => {
    it('应该清除所有标签筛选', () => {
      const { selectedTagIds, filters, updateTagFilter, clearTagFilter } = filtersComposable

      updateTagFilter([1, 2, 3])
      expect(selectedTagIds.value).toEqual([1, 2, 3])

      clearTagFilter()
      expect(selectedTagIds.value).toEqual([])
      expect(filters.value.tagIds).toEqual([])
    })
  })

  describe('clearAllFilters', () => {
    it('应该清除所有筛选条件', () => {
      const { filters, updateFilter, updateTagFilter, clearAllFilters, hasActiveFilters } =
        filtersComposable

      // 设置多个筛选条件
      // Note: Individual assignment (assignedTo) removed - only team-based filtering is supported now
      updateFilter('status', 'open')
      updateFilter('platform', 'line')
      updateFilter('search', 'test query')
      updateTagFilter([1, 2])

      expect(hasActiveFilters.value).toBe(true)

      // 清除所有筛选
      clearAllFilters()

      expect(filters.value.status).toBe('')
      expect(filters.value.platform).toBe('')
      expect(filters.value.search).toBe('')
      expect(filters.value.tagIds).toEqual([])
      expect(hasActiveFilters.value).toBe(false)
    })
  })

  describe('getApiFilters', () => {
    // Note: Individual assignment (assignedTo) tests removed - only team-based filtering is supported now
    // The following tests for 'me' and 'unassigned' assignedTo values have been deprecated

    it('应该移除空字符串值', () => {
      const { updateFilter, getApiFilters } = filtersComposable

      updateFilter('status', '')
      updateFilter('platform', 'line')
      const apiFilters = getApiFilters()

      expect(apiFilters.status).toBeUndefined()
      expect(apiFilters.platform).toBe('line')
    })

    it('应该包含所有非空筛选条件', () => {
      const { updateFilter, updateTagFilter, getApiFilters } = filtersComposable

      updateFilter('status', 'open')
      updateFilter('platform', 'line')
      updateFilter('search', 'customer name')
      updateTagFilter([1, 2])
      const apiFilters = getApiFilters()

      expect(apiFilters.status).toBe('open')
      expect(apiFilters.platform).toBe('line')
      expect(apiFilters.search).toBe('customer name')
      expect(apiFilters.tagIds).toEqual([1, 2])
    })

    it('应该移除空搜索字段', () => {
      const { getApiFilters } = filtersComposable
      const apiFilters = getApiFilters()

      // search defaults to '' which should be removed
      expect(apiFilters.search).toBeUndefined()
    })
  })

  describe('hasActiveFilters 计算属性', () => {
    it('当所有筛选为默认值时应该为 false', () => {
      const { hasActiveFilters } = filtersComposable

      expect(hasActiveFilters.value).toBe(false)
    })

    it('当 status 筛选有值时应该为 true', () => {
      const { hasActiveFilters, updateFilter } = filtersComposable

      updateFilter('status', 'open')
      expect(hasActiveFilters.value).toBe(true)
    })

    it('当 platform 筛选有值时应该为 true', () => {
      const { hasActiveFilters, updateFilter } = filtersComposable

      updateFilter('platform', 'line')
      expect(hasActiveFilters.value).toBe(true)
    })

    // Note: Individual assignment (assignedTo) test removed - only team-based filtering is supported now

    it('当有搜索筛选时应该为 true', () => {
      const { hasActiveFilters, updateFilter } = filtersComposable

      updateFilter('search', 'test')
      expect(hasActiveFilters.value).toBe(true)
    })

    it('当搜索为空白字符时应该为 false', () => {
      const { hasActiveFilters, updateFilter } = filtersComposable

      updateFilter('search', '   ')
      expect(hasActiveFilters.value).toBe(false)
    })

    it('当有标签筛选时应该为 true', () => {
      const { hasActiveFilters, updateTagFilter } = filtersComposable

      updateTagFilter([1])
      expect(hasActiveFilters.value).toBe(true)
    })

    it('当有 teamId 筛选时应该为 true', () => {
      const { hasActiveFilters, updateFilter } = filtersComposable

      updateFilter('teamId', 1)
      expect(hasActiveFilters.value).toBe(true)
    })
  })
})
