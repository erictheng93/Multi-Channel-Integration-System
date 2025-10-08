/**
 * 搜索結果分頁工具
 * 用於大量搜索結果的分頁顯示
 */

import type { Message } from '@/types'

export interface PaginationConfig {
  /**
   * 每頁顯示的結果數量
   * @default 20
   */
  pageSize?: number

  /**
   * 當前頁碼（從 1 開始）
   * @default 1
   */
  currentPage?: number

  /**
   * 總結果數量
   */
  totalResults?: number
}

export interface PaginatedResults<T = Message> {
  /**
   * 當前頁的數據
   */
  data: T[]

  /**
   * 分頁信息
   */
  pagination: {
    currentPage: number
    pageSize: number
    totalResults: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
    startIndex: number
    endIndex: number
  }
}

/**
 * 對搜索結果進行分頁
 * @param results - 全部搜索結果
 * @param config - 分頁配置
 * @returns 分頁後的結果
 */
export function paginateResults<T = Message>(
  results: T[],
  config: PaginationConfig = {}
): PaginatedResults<T> {
  const {
    pageSize = 20,
    currentPage = 1,
    totalResults = results.length
  } = config

  // 計算總頁數
  const totalPages = Math.ceil(totalResults / pageSize)

  // 確保當前頁在有效範圍內
  const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages || 1))

  // 計算起始和結束索引
  const startIndex = (validCurrentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalResults)

  // 提取當前頁數據
  const data = results.slice(startIndex, endIndex)

  return {
    data,
    pagination: {
      currentPage: validCurrentPage,
      pageSize,
      totalResults,
      totalPages,
      hasNextPage: validCurrentPage < totalPages,
      hasPrevPage: validCurrentPage > 1,
      startIndex,
      endIndex
    }
  }
}

/**
 * 獲取指定頁碼的數據
 * @param results - 全部結果
 * @param pageNumber - 頁碼（從 1 開始）
 * @param pageSize - 每頁大小
 * @returns 指定頁的數據
 */
export function getPage<T = Message>(
  results: T[],
  pageNumber: number,
  pageSize: number = 20
): T[] {
  const startIndex = (pageNumber - 1) * pageSize
  const endIndex = startIndex + pageSize
  return results.slice(startIndex, endIndex)
}

/**
 * 計算總頁數
 * @param totalResults - 總結果數
 * @param pageSize - 每頁大小
 * @returns 總頁數
 */
export function getTotalPages(totalResults: number, pageSize: number = 20): number {
  return Math.ceil(totalResults / pageSize)
}

/**
 * 生成頁碼數組（用於分頁組件）
 * @param currentPage - 當前頁
 * @param totalPages - 總頁數
 * @param maxVisible - 最多顯示的頁碼數量
 * @returns 頁碼數組
 *
 * @example
 * generatePageNumbers(5, 10, 5)
 * // → [3, 4, 5, 6, 7]
 *
 * generatePageNumbers(1, 10, 5)
 * // → [1, 2, 3, 4, 5]
 */
export function generatePageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 7
): number[] {
  if (totalPages <= maxVisible) {
    // 如果總頁數小於等於最大顯示數，顯示所有頁碼
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const half = Math.floor(maxVisible / 2)
  let start = Math.max(1, currentPage - half)
  const end = Math.min(totalPages, start + maxVisible - 1)

  // 調整起始位置
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }

  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

/**
 * 生成頁碼數組（包含省略號）
 * @param currentPage - 當前頁
 * @param totalPages - 總頁數
 * @param maxVisible - 最多顯示的頁碼數量
 * @returns 頁碼數組（可能包含 null 表示省略號）
 *
 * @example
 * generatePageNumbersWithEllipsis(5, 20, 7)
 * // → [1, null, 4, 5, 6, null, 20]
 */
export function generatePageNumbersWithEllipsis(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 7
): Array<number | null> {
  if (totalPages <= maxVisible + 2) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const result: Array<number | null> = []
  const leftEllipsis = currentPage > Math.ceil(maxVisible / 2) + 1
  const rightEllipsis = currentPage < totalPages - Math.floor(maxVisible / 2)

  // 始終顯示第一頁
  result.push(1)

  if (leftEllipsis) {
    result.push(null) // 左側省略號
  }

  // 計算中間頁碼範圍
  const half = Math.floor((maxVisible - 2) / 2)
  let start = Math.max(2, currentPage - half)
  let end = Math.min(totalPages - 1, currentPage + half)

  // 調整範圍以保持固定數量
  if (end - start < maxVisible - 3) {
    if (start === 2) {
      end = Math.min(totalPages - 1, start + maxVisible - 3)
    } else {
      start = Math.max(2, end - maxVisible + 3)
    }
  }

  // 添加中間頁碼
  for (let i = start; i <= end; i++) {
    result.push(i)
  }

  if (rightEllipsis) {
    result.push(null) // 右側省略號
  }

  // 始終顯示最後一頁
  if (totalPages > 1) {
    result.push(totalPages)
  }

  return result
}

/**
 * 獲取分頁摘要文本
 * @param startIndex - 起始索引
 * @param endIndex - 結束索引
 * @param totalResults - 總結果數
 * @returns 摘要文本
 *
 * @example
 * getPaginationSummary(0, 20, 150)
 * // → "顯示 1-20 條，共 150 條結果"
 */
export function getPaginationSummary(
  startIndex: number,
  endIndex: number,
  totalResults: number
): string {
  if (totalResults === 0) {
    return '無結果'
  }

  return `顯示 ${startIndex + 1}-${endIndex} 條，共 ${totalResults} 條結果`
}

/**
 * 計算跳轉頁碼
 * @param currentPage - 當前頁
 * @param totalPages - 總頁數
 * @param offset - 偏移量（正數向後，負數向前）
 * @returns 新頁碼
 */
export function calculateJumpPage(
  currentPage: number,
  totalPages: number,
  offset: number
): number {
  const newPage = currentPage + offset
  return Math.max(1, Math.min(newPage, totalPages))
}

/**
 * 檢查是否需要分頁
 * @param totalResults - 總結果數
 * @param pageSize - 每頁大小
 * @returns 是否需要分頁
 */
export function needsPagination(totalResults: number, pageSize: number = 20): boolean {
  return totalResults > pageSize
}
