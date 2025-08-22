// 搜尋 Composable
import { ref, computed } from 'vue'
import { useDebounce } from './useDebounce'
import type { SearchOptions } from './types'

export function useSearch<T>(
  data: T[],
  searchFields: (keyof T)[],
  options: SearchOptions = {}
) {
  const {
    debounceMs = 300,
    minLength = 1,
    caseSensitive = false
  } = options

  const query = ref('')
  const debouncedQuery = useDebounce(query, debounceMs)

  // 搜尋結果
  const results = computed(() => {
    const searchTerm = debouncedQuery.value.trim()
    
    if (!searchTerm || searchTerm.length < minLength) {
      return data
    }

    const searchValue = caseSensitive ? searchTerm : searchTerm.toLowerCase()

    return data.filter(item => {
      return searchFields.some(field => {
        const fieldValue = item[field]
        if (fieldValue === null || fieldValue === undefined) {return false}
        
        const stringValue = String(fieldValue)
        const compareValue = caseSensitive ? stringValue : stringValue.toLowerCase()
        
        return compareValue.includes(searchValue)
      })
    })
  })

  // 搜尋統計
  const stats = computed(() => ({
    total: data.length,
    filtered: results.value.length,
    hasResults: results.value.length > 0,
    isSearching: debouncedQuery.value.trim().length >= minLength
  }))

  // 方法
  const setQuery = (newQuery: string) => {
    query.value = newQuery
  }

  const clear = () => {
    query.value = ''
  }

  const highlight = (text: string, className = 'highlight') => {
    const searchTerm = debouncedQuery.value.trim()
    if (!searchTerm || !stats.value.isSearching) {return text}

    const regex = new RegExp(`(${searchTerm})`, caseSensitive ? 'g' : 'gi')
    return text.replace(regex, `<span class="${className}">$1</span>`)
  }

  return {
    // 狀態
    query,
    debouncedQuery,
    results,
    stats,

    // 方法
    setQuery,
    clear,
    highlight
  }
}

// 高級搜尋 Composable
export function useAdvancedSearch<T>(data: T[]) {
  const filters = ref<Record<string, unknown>>({})
  const sortBy = ref<keyof T | null>(null)
  const sortOrder = ref<'asc' | 'desc'>('asc')

  // 過濾和排序結果
  const results = computed(() => {
    let filtered = [...data]

    // 應用過濾器
    Object.entries(filters.value).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        filtered = filtered.filter(item => {
          const itemValue = item[key as keyof T]
          
          if (typeof value === 'string') {
            return String(itemValue).toLowerCase().includes(value.toLowerCase())
          } else if (typeof value === 'boolean') {
            return itemValue === value
          } else if (Array.isArray(value)) {
            return value.includes(itemValue)
          } else {
            return itemValue === value
          }
        })
      }
    })

    // 應用排序
    if (sortBy.value) {
      filtered.sort((a, b) => {
        const sortKey = sortBy.value
        if (!sortKey) {
          return 0
        }
        
        const aValue = (a as Record<string, unknown>)[sortKey]
        const bValue = (b as Record<string, unknown>)[sortKey]
        
        let comparison = 0
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue)
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          if (aValue < bValue) {
            comparison = -1
          } else if (aValue > bValue) {
            comparison = 1
          }
        } else {
          // Convert to string for comparison
          const aStr = String(aValue || '')
          const bStr = String(bValue || '')
          comparison = aStr.localeCompare(bStr)
        }
        
        return sortOrder.value === 'desc' ? -comparison : comparison
      })
    }

    return filtered
  })

  // 方法
  const setFilter = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === '') {
      delete filters.value[key]
    } else {
      filters.value[key] = value
    }
  }

  const removeFilter = (key: string) => {
    delete filters.value[key]
  }

  const clearFilters = () => {
    filters.value = {}
  }

  const setSorting = (key: keyof T, order: 'asc' | 'desc' = 'asc') => {
    sortBy.value = key
    sortOrder.value = order
  }

  const toggleSort = (key: keyof T) => {
    if (sortBy.value === key) {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortBy.value = key
      sortOrder.value = 'asc'
    }
  }

  const clearSort = () => {
    sortBy.value = null
    sortOrder.value = 'asc'
  }

  const reset = () => {
    clearFilters()
    clearSort()
  }

  return {
    // 狀態
    filters,
    sortBy,
    sortOrder,
    results,

    // 方法
    setFilter,
    removeFilter,
    clearFilters,
    setSorting,
    toggleSort,
    clearSort,
    reset
  }
}