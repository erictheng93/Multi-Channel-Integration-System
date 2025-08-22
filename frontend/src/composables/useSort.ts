// 排序 Composable
import { ref, computed } from 'vue'
import type { SortOptions } from './types'

export function useSort<T>(data: T[], defaultSort?: SortOptions<T>) {
  const sortKey = ref<keyof T | null>(defaultSort?.key || null)
  const sortDirection = ref<'asc' | 'desc'>(defaultSort?.direction || 'asc')

  // 排序後的數據
  const sortedData = computed(() => {
    if (!sortKey.value) {
      return data
    }

    return [...data].sort((a, b) => {
      const currentSortKey = sortKey.value
      if (!currentSortKey) {
        return 0
      }
      
      const aValue = (a as Record<string, unknown>)[currentSortKey]
      const bValue = (b as Record<string, unknown>)[currentSortKey]

      let comparison = 0

      // 處理不同類型的比較
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue)
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime()
      } else {
        // 轉換為字符串進行比較
        const aStr = String(aValue)
        const bStr = String(bValue)
        comparison = aStr.localeCompare(bStr)
      }

      return sortDirection.value === 'desc' ? -comparison : comparison
    })
  })

  // 排序狀態
  const sortState = computed(() => ({
    key: sortKey.value,
    direction: sortDirection.value,
    isActive: (key: keyof T) => sortKey.value === key,
    getDirection: (key: keyof T) => sortKey.value === key ? sortDirection.value : null
  }))

  // 方法
  const sort = (key: keyof T, direction?: 'asc' | 'desc') => {
    if (sortKey.value === key && !direction) {
      // 切換排序方向
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = key
      sortDirection.value = direction || 'asc'
    }
  }

  const clearSort = () => {
    sortKey.value = null
    sortDirection.value = 'asc'
  }

  const setSortKey = (key: keyof T) => {
    sortKey.value = key
  }

  const setSortDirection = (direction: 'asc' | 'desc') => {
    sortDirection.value = direction
  }

  const toggleDirection = () => {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  }

  // 多欄位排序
  const multiSort = (sorts: SortOptions<T>[]) => {
    if (!sorts.length) {return data}

    return [...data].sort((a, b) => {
      for (const sortOption of sorts) {
        const aValue = a[sortOption.key]
        const bValue = b[sortOption.key]

        let comparison = 0

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue)
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue
        } else if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime()
        } else {
          const aStr = String(aValue)
          const bStr = String(bValue)
          comparison = aStr.localeCompare(bStr)
        }

        if (comparison !== 0) {
          return sortOption.direction === 'desc' ? -comparison : comparison
        }
      }

      return 0
    })
  }

  return {
    // 狀態
    sortKey,
    sortDirection,
    sortedData,
    sortState,

    // 方法
    sort,
    clearSort,
    setSortKey,
    setSortDirection,
    toggleDirection,
    multiSort
  }
}