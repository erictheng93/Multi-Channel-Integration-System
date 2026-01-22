/**
 * Conversation Filters Composable
 *
 * 负责管理对话列表的多重筛选逻辑
 *
 * @module composables/conversation/useConversationFilters
 *
 * @example
 * ```ts
 * const { filters, updateFilter, clearAllFilters, hasActiveFilters } = useConversationFilters()
 *
 * // 更新筛选条件
 * updateFilter('status', 'open')
 * updateFilter('platform', 'line')
 *
 * // 清除所有筛选
 * clearAllFilters()
 * ```
 */

import { ref, computed, type Ref } from 'vue'
import type { ConversationFilters } from '@/types'

export interface ConversationFiltersComposable {
  /** 筛选条件对象 */
  filters: Ref<ConversationFilters>
  /** 选中的标签 ID 列表 */
  selectedTagIds: Ref<number[]>
  /** 是否有活动的筛选条件 */
  hasActiveFilters: Ref<boolean>
  /** 更新单个筛选条件 */
  updateFilter: <K extends keyof ConversationFilters>(key: K, value: ConversationFilters[K]) => void
  /** 更新标签筛选 */
  updateTagFilter: (tagIds: number[]) => void
  /** 切换标签筛选状态 */
  toggleTagFilter: (tagId: number) => void
  /** 清除标签筛选 */
  clearTagFilter: () => void
  /** 清除所有筛选条件 */
  clearAllFilters: () => void
  /** 重置到默认筛选 */
  resetToDefaults: () => void
  /** 获取 API 查询参数 */
  getApiFilters: (currentAgentId?: string) => Record<string, unknown>
}

/**
 * 默认筛选条件
 * Note: Individual assignment filter (assignedTo) removed - only team-based filtering is supported now
 */
const DEFAULT_FILTERS: ConversationFilters = {
  status: '',
  platform: '',
  teamId: undefined,
  tagIds: []
}

/**
 * 使用对话筛选功能
 *
 * @returns {ConversationFiltersComposable} 筛选相关的状态和方法
 */
export function useConversationFilters(): ConversationFiltersComposable {
  // 状态
  const filters = ref<ConversationFilters>({ ...DEFAULT_FILTERS })
  const selectedTagIds = ref<number[]>([])

  // 计算属性：是否有活动的筛选条件
  // Note: Individual assignment filter (assignedTo) removed - only team-based filtering is supported now
  const hasActiveFilters = computed<boolean>(() => {
    return (
      filters.value.status !== '' ||
      filters.value.platform !== '' ||
      filters.value.teamId !== undefined ||
      (filters.value.tagIds !== undefined && filters.value.tagIds.length > 0)
    )
  })

  /**
   * 更新单个筛选条件
   *
   * @param {K} key - 筛选条件的键
   * @param {ConversationFilters[K]} value - 筛选条件的值
   *
   * @example
   * updateFilter('status', 'open')
   * updateFilter('platform', 'line')
   */
  function updateFilter<K extends keyof ConversationFilters>(
    key: K,
    value: ConversationFilters[K]
  ): void {
    filters.value[key] = value
  }

  /**
   * 更新标签筛选
   *
   * @param {number[]} tagIds - 标签 ID 列表
   *
   * @example
   * updateTagFilter([1, 2, 3])
   */
  function updateTagFilter(tagIds: number[]): void {
    selectedTagIds.value = [...tagIds]
    filters.value.tagIds = [...tagIds]
  }

  /**
   * 切换标签筛选状态
   *
   * @param {number} tagId - 标签 ID
   *
   * @example
   * toggleTagFilter(1) // 选中/取消选中 ID=1 的标签
   */
  function toggleTagFilter(tagId: number): void {
    const index = selectedTagIds.value.indexOf(tagId)
    if (index > -1) {
      selectedTagIds.value.splice(index, 1)
    } else {
      selectedTagIds.value.push(tagId)
    }
    filters.value.tagIds = [...selectedTagIds.value]
  }

  /**
   * 清除标签筛选
   *
   * @example
   * clearTagFilter() // 移除所有标签筛选
   */
  function clearTagFilter(): void {
    selectedTagIds.value = []
    filters.value.tagIds = []
  }

  /**
   * 清除所有筛选条件
   *
   * @example
   * clearAllFilters() // 显示所有对话
   */
  function clearAllFilters(): void {
    filters.value = { ...DEFAULT_FILTERS }
    selectedTagIds.value = []
  }

  /**
   * 重置到默认筛选
   *
   * @example
   * resetToDefaults()
   */
  function resetToDefaults(): void {
    clearAllFilters()
  }

  /**
   * 获取 API 查询参数
   * Note: Individual assignment filter (assignedTo) removed - only team-based filtering is supported now
   *
   * @returns {Record<string, unknown>} API 查询参数对象
   *
   * @example
   * const apiFilters = getApiFilters()
   * // { status: 'open', platform: 'line', teamId: 1 }
   */
  function getApiFilters(): Record<string, unknown> {
    const apiFilters: Record<string, unknown> = { ...filters.value }

    // 移除空字符串值
    Object.keys(apiFilters).forEach(key => {
      if (apiFilters[key] === '' || apiFilters[key] === undefined) {
        delete apiFilters[key]
      }
    })

    return apiFilters
  }

  return {
    filters,
    selectedTagIds,
    hasActiveFilters,
    updateFilter,
    updateTagFilter,
    toggleTagFilter,
    clearTagFilter,
    clearAllFilters,
    resetToDefaults,
    getApiFilters
  }
}
