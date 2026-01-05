/**
 * Conversation Sort Composable
 *
 * 负责管理对话列表的排序逻辑
 *
 * @module composables/conversation/useConversationSort
 *
 * @example
 * ```ts
 * const { sortBy, sortOrder, updateSort, toggleSortOrder } = useConversationSort()
 *
 * // 更新排序字段
 * updateSort('lastMessageAt', 'desc')
 *
 * // 切换排序方向
 * toggleSortOrder()
 * ```
 */

import { ref, computed, type Ref } from 'vue'
import type { Conversation } from '@/types'

/**
 * 可用的排序字段类型
 */
export type SortField = 'lastMessageAt' | 'createdAt' | 'updatedAt' | 'unreadCount' | 'customerName'

/**
 * 排序方向类型
 */
export type SortOrder = 'asc' | 'desc'

export interface ConversationSortComposable {
  /** 当前排序字段 */
  sortBy: Ref<SortField>
  /** 当前排序方向 */
  sortOrder: Ref<SortOrder>
  /** 排序字段显示名称 */
  sortFieldLabel: Ref<string>
  /** 更新排序配置 */
  updateSort: (field: SortField, order?: SortOrder) => void
  /** 切换排序方向 */
  toggleSortOrder: () => void
  /** 应用排序到对话列表 */
  applySortToConversations: (conversations: Conversation[]) => Conversation[]
}

/**
 * 排序字段显示名称映射
 */
const SORT_FIELD_LABELS: Record<SortField, string> = {
  lastMessageAt: '最后消息时间',
  createdAt: '创建时间',
  updatedAt: '更新时间',
  unreadCount: '未读数量',
  customerName: '客户名称'
}

/**
 * 使用对话排序功能
 *
 * @param {SortField} initialField - 初始排序字段（默认：'lastMessageAt'）
 * @param {SortOrder} initialOrder - 初始排序方向（默认：'desc'）
 * @returns {ConversationSortComposable} 排序相关的状态和方法
 */
export function useConversationSort(
  initialField: SortField = 'lastMessageAt',
  initialOrder: SortOrder = 'desc'
): ConversationSortComposable {
  // 状态
  const sortBy = ref<SortField>(initialField)
  const sortOrder = ref<SortOrder>(initialOrder)

  // 计算属性：排序字段显示名称
  const sortFieldLabel = computed(() => SORT_FIELD_LABELS[sortBy.value])

  /**
   * 更新排序配置
   *
   * @param {SortField} field - 排序字段
   * @param {SortOrder} order - 排序方向（可选，默认保持当前方向）
   *
   * @example
   * updateSort('lastMessageAt', 'desc')
   * updateSort('unreadCount') // 保持当前排序方向
   */
  function updateSort(field: SortField, order?: SortOrder): void {
    sortBy.value = field
    if (order) {
      sortOrder.value = order
    }
  }

  /**
   * 切换排序方向
   *
   * @example
   * toggleSortOrder() // 'asc' <-> 'desc'
   */
  function toggleSortOrder(): void {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  }

  /**
   * 应用排序到对话列表
   *
   * @param {Conversation[]} conversations - 原始对话列表
   * @returns {Conversation[]} 排序后的对话列表
   *
   * @example
   * const sortedConversations = applySortToConversations(conversations)
   */
  function applySortToConversations(conversations: Conversation[]): Conversation[] {
    if (!conversations || conversations.length === 0) {
      return []
    }

    return [...conversations].sort((a, b) => {
      let aValue: string | number | Date | undefined
      let bValue: string | number | Date | undefined

      switch (sortBy.value) {
        case 'lastMessageAt':
          aValue = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
          bValue = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
          break
        case 'createdAt':
          aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0
          bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0
          break
        case 'updatedAt':
          aValue = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
          bValue = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
          break
        case 'unreadCount':
          aValue = a.unreadCount || 0
          bValue = b.unreadCount || 0
          break
        case 'customerName':
          aValue = a.customer?.name || ''
          bValue = b.customer?.name || ''
          break
        default:
          aValue = 0
          bValue = 0
      }

      // 比较逻辑
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder.value === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder.value === 'asc' ? aValue - bValue : bValue - aValue
      }

      return 0
    })
  }

  return {
    sortBy,
    sortOrder,
    sortFieldLabel,
    updateSort,
    toggleSortOrder,
    applySortToConversations
  }
}
