/**
 * List Sorting Composable
 *
 * 通用列表排序功能，支援：
 * - 多欄位排序
 * - 升序/降序切換
 * - localStorage 持久化使用者偏好
 *
 * @module composables/useListSorting
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'

// ==================== Types ====================

export type SortOrder = 'asc' | 'desc'

export interface SortOption<T extends string = string> {
  field: T
  label: string
  defaultOrder?: SortOrder
}

export interface SortState<T extends string = string> {
  field: T
  order: SortOrder
}

export interface UseListSortingOptions<T extends string = string> {
  /** localStorage 存儲的 key */
  storageKey: string
  /** 可排序的欄位選項 */
  sortOptions: SortOption<T>[]
  /** 預設排序設定 */
  defaultSort: SortState<T>
}

export interface UseListSortingReturn<T extends string = string> {
  /** 當前排序狀態 */
  sortState: Ref<SortState<T>>
  /** 可用的排序選項 */
  sortOptions: SortOption<T>[]
  /** 當前排序欄位的標籤 */
  currentSortLabel: ComputedRef<string>
  /** 設置排序欄位 */
  setSortField: (_field: T) => void
  /** 切換排序順序 */
  toggleSortOrder: () => void
  /** 重置為預設排序 */
  resetSort: () => void
  /** 排序函數（用於 Array.sort） */
  sortFn: <Item>(_items: Item[], _getFieldValue: (_item: Item, _field: T) => unknown) => Item[]
}

// ==================== Composable ====================

/**
 * 列表排序 Composable
 *
 * @example
 * ```typescript
 * const { sortState, setSortField, toggleSortOrder, sortFn } = useListSorting({
 * storageKey: 'member-list-sort',
 * sortOptions: [
 * { field: 'createdAt', label: '建立時間', defaultOrder: 'desc' },
 * { field: 'name', label: '名稱', defaultOrder: 'asc' },
 * ],
 * defaultSort: { field: 'createdAt', order: 'desc' }
 * })
 *
 * // 排序列表
 * const sortedItems = sortFn(items, (item, field) => item[field])
 * ```
 */
export function useListSorting<T extends string = string>(
  options: UseListSortingOptions<T>
): UseListSortingReturn<T> {
  const { storageKey, sortOptions, defaultSort } = options

  // ==================== State ====================

  /**
   * 從 localStorage 讀取排序設定
   */
  function loadSortState(): SortState<T> {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as SortState<T>
        // 驗證欄位是否有效
        const validField = sortOptions.some(opt => opt.field === parsed.field)
        if (validField && (parsed.order === 'asc' || parsed.order === 'desc')) {
          return parsed
        }
      }
    } catch (e) {
      console.warn(`[useListSorting] Failed to load sort state from localStorage:`, e)
    }
    return { ...defaultSort }
  }

  const sortState = ref<SortState<T>>(loadSortState()) as Ref<SortState<T>>

  // ==================== Computed ====================

  const currentSortLabel = computed(() => {
    const option = sortOptions.find(opt => opt.field === sortState.value.field)
    return option?.label || ''
  })

  // ==================== Methods ====================

  /**
   * 設置排序欄位
   * 如果點擊相同欄位，切換排序順序
   */
  function setSortField(field: T) {
    if (sortState.value.field === field) {
      // 相同欄位，切換順序
      toggleSortOrder()
    } else {
      // 不同欄位，使用該欄位的預設順序或 desc
      const option = sortOptions.find(opt => opt.field === field)
      sortState.value = {
        field,
        order: option?.defaultOrder || 'desc'
      }
    }
  }

  /**
   * 切換排序順序
   */
  function toggleSortOrder() {
    sortState.value = {
      ...sortState.value,
      order: sortState.value.order === 'asc' ? 'desc' : 'asc'
    }
  }

  /**
   * 重置為預設排序
   */
  function resetSort() {
    sortState.value = { ...defaultSort }
  }

  /**
   * 排序函數
   * 用於對列表進行排序
   */
  function sortFn<Item>(
    items: Item[],
    getFieldValue: (_item: Item, _field: T) => unknown
  ): Item[] {
    const { field, order } = sortState.value
    const multiplier = order === 'asc' ? 1 : -1

    return [...items].sort((a, b) => {
      const aValue = getFieldValue(a, field)
      const bValue = getFieldValue(b, field)

      // Handle null/undefined
      if (aValue === null || aValue === undefined) {
        if (bValue === null || bValue === undefined) {return 0}
        return multiplier
      }
      if (bValue === null || bValue === undefined) {return -multiplier}

      // Handle dates (string format)
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        // Check if it's a date string
        const aDate = Date.parse(aValue)
        const bDate = Date.parse(bValue)
        if (!isNaN(aDate) && !isNaN(bDate)) {
          return (aDate - bDate) * multiplier
        }
        // String comparison (case-insensitive)
        return aValue.localeCompare(bValue) * multiplier
      }

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * multiplier
      }

      // Handle booleans
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return (Number(aValue) - Number(bValue)) * multiplier
      }

      // Fallback: convert to string and compare
      return String(aValue).localeCompare(String(bValue)) * multiplier
    })
  }

  // ==================== Watchers ====================

  // 保存排序設定到 localStorage
  watch(
    sortState,
    (newState) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newState))
      } catch (e) {
        console.warn(`[useListSorting] Failed to save sort state to localStorage:`, e)
      }
    },
    { deep: true }
  )

  // ==================== Return ====================

  return {
    sortState,
    sortOptions,
    currentSortLabel,
    setSortField,
    toggleSortOrder,
    resetSort,
    sortFn
  }
}

// ==================== Pre-configured Sorting Hooks ====================

/**
 * 成員列表排序
 */
export type MemberSortField = 'createdAt' | 'name' | 'email' | 'role' | 'isActive'

export function useMemberListSorting() {
  return useListSorting<MemberSortField>({
    storageKey: 'team-management-member-sort',
    sortOptions: [
      { field: 'createdAt', label: '建立時間', defaultOrder: 'desc' },
      { field: 'name', label: '名稱', defaultOrder: 'asc' },
      { field: 'email', label: 'Email', defaultOrder: 'asc' },
      { field: 'role', label: '角色', defaultOrder: 'asc' },
      { field: 'isActive', label: '狀態', defaultOrder: 'desc' }
    ],
    defaultSort: { field: 'createdAt', order: 'desc' }
  })
}

/**
 * 團隊列表排序
 */
export type TeamSortField = 'createdAt' | 'name' | 'memberCount' | 'isActive'

export function useTeamListSorting() {
  return useListSorting<TeamSortField>({
    storageKey: 'team-management-team-sort',
    sortOptions: [
      { field: 'createdAt', label: '建立時間', defaultOrder: 'desc' },
      { field: 'name', label: '名稱', defaultOrder: 'asc' },
      { field: 'memberCount', label: '成員數', defaultOrder: 'desc' },
      { field: 'isActive', label: '狀態', defaultOrder: 'desc' }
    ],
    defaultSort: { field: 'createdAt', order: 'desc' }
  })
}

// ==================== Sort Mode Types ====================

export type SortMode = 'auto' | 'custom'

export interface SortModeState {
  mode: SortMode
  customOrder: string[]  // Array of item IDs in custom order
}

export interface UseSortModeOptions {
  /** localStorage 存儲的 key */
  storageKey: string
  /** 預設排序模式 */
  defaultMode?: SortMode
}

export interface UseSortModeReturn {
  /** 當前排序模式 */
  sortMode: Ref<SortMode>
  /** 自訂順序 (項目 ID 陣列) */
  customOrder: Ref<string[]>
  /** 是否為自訂排序模式 */
  isCustomMode: ComputedRef<boolean>
  /** 切換排序模式 */
  toggleSortMode: () => void
  /** 設置排序模式 */
  setSortMode: (_mode: SortMode) => void
  /** 更新自訂順序 */
  updateCustomOrder: (_newOrder: string[]) => void
  /** 清除自訂順序 */
  clearCustomOrder: () => void
  /** 根據自訂順序排序項目 */
  applyCustomOrder: <T extends { id: string | number }>(_items: T[]) => T[]
}

// ==================== Sort Mode Composable ====================

/**
 * 排序模式 Composable
 *
 * 支援「自動排序」與「自訂順序」兩種模式
 *
 * @example
 * ```typescript
 * const { sortMode, customOrder, toggleSortMode, applyCustomOrder } = useSortMode({
 * storageKey: 'member-list-sort-mode'
 * })
 *
 * // 根據模式排序
 * const sortedItems = isCustomMode.value
 * ? applyCustomOrder(items)
 * : sortFn(items, getFieldValue)
 * ```
 */
export function useSortMode(options: UseSortModeOptions): UseSortModeReturn {
  const { storageKey, defaultMode = 'auto' } = options

  // ==================== State ====================

  /**
   * 從 localStorage 讀取排序模式設定
   */
  function loadSortModeState(): SortModeState {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as SortModeState
        if (parsed.mode === 'auto' || parsed.mode === 'custom') {
          return {
            mode: parsed.mode,
            customOrder: Array.isArray(parsed.customOrder) ? parsed.customOrder : []
          }
        }
      }
    } catch (e) {
      console.warn(`[useSortMode] Failed to load sort mode from localStorage:`, e)
    }
    return { mode: defaultMode, customOrder: [] }
  }

  const state = loadSortModeState()
  const sortMode = ref<SortMode>(state.mode)
  const customOrder = ref<string[]>(state.customOrder)

  // ==================== Computed ====================

  const isCustomMode = computed(() => sortMode.value === 'custom')

  // ==================== Methods ====================

  function toggleSortMode() {
    sortMode.value = sortMode.value === 'auto' ? 'custom' : 'auto'
  }

  function setSortMode(mode: SortMode) {
    sortMode.value = mode
  }

  function updateCustomOrder(newOrder: string[]) {
    customOrder.value = newOrder
  }

  function clearCustomOrder() {
    customOrder.value = []
  }

  /**
   * 根據自訂順序排序項目
   */
  function applyCustomOrder<T extends { id: string | number }>(items: T[]): T[] {
    if (customOrder.value.length === 0) {
      return items
    }

    const orderMap = new Map<string, number>()
    customOrder.value.forEach((id, index) => {
      orderMap.set(String(id), index)
    })

    return [...items].sort((a, b) => {
      const aIndex = orderMap.get(String(a.id))
      const bIndex = orderMap.get(String(b.id))

      // 如果都在自訂順序中，按自訂順序排序
      if (aIndex !== undefined && bIndex !== undefined) {
        return aIndex - bIndex
      }
      // 如果只有 a 在自訂順序中，a 排前面
      if (aIndex !== undefined) {return -1}
      // 如果只有 b 在自訂順序中，b 排前面
      if (bIndex !== undefined) {return 1}
      // 都不在自訂順序中，保持原順序
      return 0
    })
  }

  // ==================== Watchers ====================

  // 保存排序模式到 localStorage
  watch(
    [sortMode, customOrder],
    ([newMode, newOrder]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          mode: newMode,
          customOrder: newOrder
        }))
      } catch (e) {
        console.warn(`[useSortMode] Failed to save sort mode to localStorage:`, e)
      }
    },
    { deep: true }
  )

  // ==================== Return ====================

  return {
    sortMode,
    customOrder,
    isCustomMode,
    toggleSortMode,
    setSortMode,
    updateCustomOrder,
    clearCustomOrder,
    applyCustomOrder
  }
}

// ==================== Pre-configured Sort Mode Hooks ====================

/**
 * 成員列表排序模式
 */
export function useMemberSortMode() {
  return useSortMode({
    storageKey: 'team-management-member-sort-mode',
    defaultMode: 'auto'
  })
}

/**
 * 團隊列表排序模式
 */
export function useTeamSortMode() {
  return useSortMode({
    storageKey: 'team-management-team-sort-mode',
    defaultMode: 'auto'
  })
}
