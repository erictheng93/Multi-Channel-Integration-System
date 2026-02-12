/**
 * Search Panel Composable
 *
 * 管理搜索面板的显示/隐藏状态、自动聚焦和搜索结果处理
 *
 * @module composables/useSearchPanel
 * @example
 * ```typescript
 * const searchPanel = useSearchPanel({
 *   onSearchResults: (results) => controller.setSearchResults(results),
 *   onSearchClear: () => controller.clearSearch()
 * })
 *
 * // In template
 * <ConversationHeader @search="searchPanel.toggle" />
 * <MessageSearch
 *   v-if="searchPanel.isOpen.value"
 *   ref="searchPanel.searchRef.value"
 *   @search-results="searchPanel.handleSearchResults"
 *   @search-clear="searchPanel.handleSearchClear"
 * />
 * ```
 */

import { ref, nextTick } from 'vue'
import type { Ref } from 'vue'
import type { Message } from '@/types'

/**
 * MessageSearch 组件实例类型
 */
export interface MessageSearchInstance {
  focus?: () => void
}

/**
 * useSearchPanel 配置选项
 */
export interface SearchPanelOptions {
  /**
   * 搜索结果回调
   * @param results - 搜索到的消息列表
   */
  onSearchResults?: (_results: Message[]) => void

  /**
   * 清除搜索回调
   */
  onSearchClear?: () => void

  /**
   * 是否在打开时自动聚焦 (默认: true)
   */
  autoFocus?: boolean
}

/**
 * useSearchPanel 返回值
 */
export interface SearchPanelReturn {
  // State
  /** 搜索面板是否打开 */
  isOpen: Ref<boolean>
  /** MessageSearch 组件引用 */
  searchRef: Ref<MessageSearchInstance | null>

  // Actions
  /** 切换搜索面板显示/隐藏 */
  toggle: () => Promise<void>
  /** 打开搜索面板 */
  open: () => Promise<void>
  /** 关闭搜索面板 */
  close: () => void

  // Handlers
  /** 处理搜索结果 */
  handleSearchResults: (_results: Message[]) => void
  /** 处理清除搜索 */
  handleSearchClear: () => void
}

/**
 * 搜索面板管理 Composable
 *
 * 功能:
 * - ✅ 搜索面板显示/隐藏状态
 * - ✅ 自动聚焦管理
 * - ✅ 搜索结果处理
 * - ✅ 清除搜索
 *
 * @param options - 配置选项
 * @returns 搜索面板状态和操作方法
 */
export function useSearchPanel(options: SearchPanelOptions = {}): SearchPanelReturn {
  const {
    onSearchResults,
    onSearchClear,
    autoFocus = true,
  } = options

  // ============================================================================
  // State
  // ============================================================================

  const isOpen = ref(false)
  const searchRef = ref<MessageSearchInstance | null>(null)

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * 切换搜索面板显示/隐藏
   */
  const toggle = async (): Promise<void> => {
    isOpen.value = !isOpen.value

    if (isOpen.value) {
      // 打开时自动聚焦
      if (autoFocus) {
        await nextTick()
        searchRef.value?.focus?.()
      }
    } else {
      // 关闭时清除搜索
      close()
    }
  }

  /**
   * 打开搜索面板
   */
  const open = async (): Promise<void> => {
    if (isOpen.value) {return} // 已经打开，不需要重复操作

    isOpen.value = true

    if (autoFocus) {
      await nextTick()
      searchRef.value?.focus?.()
    }
  }

  /**
   * 关闭搜索面板
   */
  const close = (): void => {
    isOpen.value = false
    onSearchClear?.()
  }

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * 处理搜索结果
   * @param results - 搜索到的消息列表
   */
  const handleSearchResults = (results: Message[]): void => {
    onSearchResults?.(results)
  }

  /**
   * 处理清除搜索
   */
  const handleSearchClear = (): void => {
    close()
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    isOpen,
    searchRef,

    // Actions
    toggle,
    open,
    close,

    // Handlers
    handleSearchResults,
    handleSearchClear,
  }
}
