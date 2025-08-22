// 過濾 Composable - 完全修復版本
import { ref, computed } from 'vue'

interface FilterOptions<T> {
  key: keyof T
  value: unknown
  operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith'
}

export function useFilter<T extends Record<string, unknown>>(data: T[]) {
  const filters = ref([] as Array<FilterOptions<T>>)

  // 過濾後的數據
  const filteredData = computed(() => {
    if (!filters.value.length) {return data}

    return data.filter(item => {
      return filters.value.every((filter) => {
        const itemValue = item[filter.key as keyof T]
        const filterValue = filter.value
        const operator = filter.operator || 'eq'

        switch (operator) {
          case 'eq':
            return itemValue === filterValue
          case 'ne':
            return itemValue !== filterValue
          case 'gt':
            return Number(itemValue) > Number(filterValue)
          case 'gte':
            return Number(itemValue) >= Number(filterValue)
          case 'lt':
            return Number(itemValue) < Number(filterValue)
          case 'lte':
            return Number(itemValue) <= Number(filterValue)
          case 'contains':
            return String(itemValue).toLowerCase().includes(String(filterValue).toLowerCase())
          case 'startsWith':
            return String(itemValue).toLowerCase().startsWith(String(filterValue).toLowerCase())
          case 'endsWith':
            return String(itemValue).toLowerCase().endsWith(String(filterValue).toLowerCase())
          default:
            return itemValue === filterValue
        }
      })
    })
  })

  // 過濾統計
  const filterStats = computed(() => ({
    total: data.length,
    filtered: filteredData.value.length,
    activeFilters: filters.value.length,
    hasFilters: filters.value.length > 0
  }))

  // 方法
  const addFilter = (filter: FilterOptions<T>) => {
    const existingIndex = filters.value.findIndex((f) =>
      f.key === filter.key && f.operator === filter.operator
    )

    if (existingIndex > -1) {
      (filters.value as FilterOptions<T>[])[existingIndex] = { ...filter }
    } else {
      (filters.value as FilterOptions<T>[]).push({ ...filter })
    }
  }

  const removeFilter = (key: keyof T, operator?: string) => {
    filters.value = filters.value.filter((f) =>
      !(f.key === key && (!operator || f.operator === operator))
    )
  }

  const updateFilter = (key: keyof T, value: unknown, operator?: string) => {
    const filter = filters.value.find((f) =>
      f.key === key && (!operator || f.operator === operator)
    )

    if (filter) {
      filter.value = value
    } else {
      addFilter({ key, value, operator: operator as FilterOptions<T>['operator'] })
    }
  }

  const clearFilters = () => {
    filters.value = []
  }

  const getFilter = (key: keyof T, operator?: string) => {
    return filters.value.find((f) =>
      f.key === key && (!operator || f.operator === operator)
    )
  }

  const hasFilter = (key: keyof T, operator?: string) => {
    return !!getFilter(key, operator)
  }

  // 預設過濾器方法
  const filterByText = (key: keyof T, text: string) => {
    if (!text.trim()) {
      removeFilter(key, 'contains')
    } else {
      updateFilter(key, text, 'contains')
    }
  }

  const filterByValue = (key: keyof T, value: unknown) => {
    if (value === null || value === undefined || value === '') {
      removeFilter(key, 'eq')
    } else {
      updateFilter(key, value, 'eq')
    }
  }

  const filterByRange = (key: keyof T, min?: number, max?: number) => {
    removeFilter(key, 'gte')
    removeFilter(key, 'lte')

    if (min !== null && min !== undefined) {
      addFilter({ key, value: min, operator: 'gte' })
    }
    if (max !== null && max !== undefined) {
      addFilter({ key, value: max, operator: 'lte' })
    }
  }

  const filterByArray = (key: keyof T, values: unknown[]) => {
    if (!values.length) {
      removeFilter(key, 'eq')
    } else {
      filters.value = filters.value.filter((f) => f.key !== key)
      values.forEach(value => {
        addFilter({ key, value, operator: 'eq' })
      })
    }
  }

  return {
    // 狀態
    filters,
    filteredData,
    filterStats,

    // 方法
    addFilter,
    removeFilter,
    updateFilter,
    clearFilters,
    getFilter,
    hasFilter,
    filterByText,
    filterByValue,
    filterByRange,
    filterByArray
  }
}