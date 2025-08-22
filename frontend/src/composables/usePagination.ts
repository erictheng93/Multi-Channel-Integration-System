// 分頁 Composable
import { ref, computed } from 'vue'
import type { PaginationOptions } from './types'

export function usePagination(options: PaginationOptions = {}) {
  const currentPage = ref(options.page || 1)
  const pageSize = ref(options.limit || 20)
  const total = ref(options.total || 0)

  // 計算屬性
  const totalPages = computed(() => Math.ceil(total.value / pageSize.value))
  const hasNext = computed(() => currentPage.value < totalPages.value)
  const hasPrev = computed(() => currentPage.value > 1)
  const startIndex = computed(() => (currentPage.value - 1) * pageSize.value)
  const endIndex = computed(() => Math.min(startIndex.value + pageSize.value, total.value))

  // 分頁範圍
  const pageRange = computed(() => {
    const range = []
    const maxVisible = 5
    let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages.value, start + maxVisible - 1)

    // 調整起始位置
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }

    for (let i = start; i <= end; i++) {
      range.push(i)
    }

    return range
  })

  // 方法
  const setPage = (page: number) => {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page
    }
  }

  const nextPage = () => {
    if (hasNext.value) {
      currentPage.value++
    }
  }

  const prevPage = () => {
    if (hasPrev.value) {
      currentPage.value--
    }
  }

  const firstPage = () => {
    currentPage.value = 1
  }

  const lastPage = () => {
    currentPage.value = totalPages.value
  }

  const setPageSize = (size: number) => {
    pageSize.value = size
    // 重新計算當前頁面
    const newTotalPages = Math.ceil(total.value / size)
    if (currentPage.value > newTotalPages) {
      currentPage.value = newTotalPages || 1
    }
  }

  const setTotal = (newTotal: number) => {
    total.value = newTotal
    // 檢查當前頁面是否仍然有效
    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value || 1
    }
  }

  const reset = () => {
    currentPage.value = 1
    total.value = 0
  }

  // 獲取分頁數據
  const paginateData = <T>(data: T[]) => {
    const start = startIndex.value
    const end = endIndex.value
    return data.slice(start, end)
  }

  // 獲取分頁信息
  const getPaginationInfo = () => {
    return {
      page: currentPage.value,
      pageSize: pageSize.value,
      total: total.value,
      totalPages: totalPages.value,
      hasNext: hasNext.value,
      hasPrev: hasPrev.value,
      startIndex: startIndex.value + 1, // 1-based index for display
      endIndex: endIndex.value
    }
  }

  return {
    // 狀態
    currentPage,
    pageSize,
    total,
    totalPages,
    hasNext,
    hasPrev,
    startIndex,
    endIndex,
    pageRange,

    // 方法
    setPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    setPageSize,
    setTotal,
    reset,
    paginateData,
    getPaginationInfo
  }
}