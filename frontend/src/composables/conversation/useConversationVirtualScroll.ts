/**
 * Conversation Virtual Scroll Composable
 *
 * 负责管理对话列表的虚拟滚动配置和状态
 *
 * @module composables/conversation/useConversationVirtualScroll
 *
 * @example
 * ```ts
 * const {
 *   visibleRange,
 *   scrollConfig,
 *   handleVisibleRangeChange,
 *   handleReachBottom,
 *   resetScroll
 * } = useConversationVirtualScroll()
 * ```
 */

import { ref, type Ref } from 'vue'

export interface VisibleRange {
  /** 可见范围起始索引 */
  startIndex: number
  /** 可见范围结束索引 */
  endIndex: number
}

export interface ScrollConfig {
  /** 单个项目高度（像素） */
  itemHeight: number
  /** 容器高度（像素） */
  containerHeight: number
  /** 预渲染项目数 */
  overscan: number
  /** 预加载页数 */
  preloadPages: number
  /** 启用智能预加载 */
  enableSmartPreload: boolean
  /** 预测加载阈值（0-1） */
  predictiveLoadThreshold: number
  /** Intersection Observer 阈值 */
  intersectionThreshold: number
  /** Intersection Observer root margin */
  rootMargin: string
}

export interface ConversationVirtualScrollComposable {
  /** 可见范围 */
  visibleRange: Ref<VisibleRange>
  /** 虚拟滚动配置 */
  scrollConfig: ScrollConfig
  /** 是否正在预加载 */
  isPreloading: Ref<boolean>
  /** 是否已到达末尾 */
  reachedEnd: Ref<boolean>
  /** 处理可见范围变化 */
  handleVisibleRangeChange: (startIndex: number, endIndex: number, onPreload?: () => Promise<void>) => Promise<void>
  /** 处理到达底部 */
  handleReachBottom: (onLoadMore?: () => Promise<void>) => Promise<void>
  /** 处理预测性加载 */
  handlePredictiveLoad: (direction: 'up' | 'down', estimatedDistance: number, onPreload?: () => Promise<void>) => void
  /** 重置滚动状态 */
  resetScroll: () => void
  /** 设置已到达末尾 */
  setReachedEnd: (reached: boolean) => void
}

/**
 * 默认滚动配置
 */
const DEFAULT_SCROLL_CONFIG: ScrollConfig = {
  itemHeight: 120,
  containerHeight: 600,
  overscan: 3,
  preloadPages: 2,
  enableSmartPreload: true,
  predictiveLoadThreshold: 0.8,
  intersectionThreshold: 0.5,
  rootMargin: '200px'
}

/**
 * 使用对话虚拟滚动功能
 *
 * @param {Partial<ScrollConfig>} customConfig - 自定义配置（可选）
 * @returns {ConversationVirtualScrollComposable} 虚拟滚动相关的状态和方法
 */
export function useConversationVirtualScroll(
  customConfig?: Partial<ScrollConfig>
): ConversationVirtualScrollComposable {
  // 状态
  const visibleRange = ref<VisibleRange>({
    startIndex: 0,
    endIndex: 0
  })
  const isPreloading = ref(false)
  const reachedEnd = ref(false)

  // 合并配置
  const scrollConfig: ScrollConfig = {
    ...DEFAULT_SCROLL_CONFIG,
    ...customConfig
  }

  /**
   * 处理可见范围变化事件
   *
   * @param {number} startIndex - 可见范围起始索引
   * @param {number} endIndex - 可见范围结束索引
   * @param {Function} onPreload - 预加载回调（可选）
   * @async
   *
   * @example
   * await handleVisibleRangeChange(0, 20, async () => {
   *   await loadNextPage()
   * })
   */
  async function handleVisibleRangeChange(
    startIndex: number,
    endIndex: number,
    onPreload?: () => Promise<void>
  ): Promise<void> {
    visibleRange.value = { startIndex, endIndex }

    if (import.meta.env.DEV) {
      console.log(`👀 [VirtualScroll] Visible range: ${startIndex}-${endIndex}`)
    }

    // 智能预加载逻辑
    if (scrollConfig.enableSmartPreload && onPreload && !isPreloading.value && !reachedEnd.value) {
      // 预加载在这里被触发，当用户滚动接近底部时
      // 不在这里直接调用 onPreload()，由 handlePredictiveLoad 处理
    }
  }

  /**
   * 处理到达底部事件
   *
   * @param {Function} onLoadMore - 加载更多回调（可选）
   * @async
   *
   * @example
   * await handleReachBottom(async () => {
   *   await loadMoreConversations()
   * })
   */
  async function handleReachBottom(onLoadMore?: () => Promise<void>): Promise<void> {
    if (!onLoadMore || isPreloading.value || reachedEnd.value) {
      return
    }

    console.log('🔄 [VirtualScroll] Reached bottom, loading more')
    isPreloading.value = true

    try {
      await onLoadMore()
    } catch (error) {
      console.error('[VirtualScroll] Failed to load more:', error)
      throw error
    } finally {
      isPreloading.value = false
    }
  }

  /**
   * 处理预测性加载事件
   *
   * @param {'up' | 'down'} direction - 滚动方向
   * @param {number} estimatedDistance - 估计距离（剩余项目数）
   * @param {Function} onPreload - 预加载回调（可选）
   *
   * @example
   * handlePredictiveLoad('down', 5, async () => {
   *   await preloadNextPage()
   * })
   */
  function handlePredictiveLoad(
    direction: 'up' | 'down',
    estimatedDistance: number,
    onPreload?: () => Promise<void>
  ): void {
    if (import.meta.env.DEV) {
      console.log(`🔮 [VirtualScroll] Predictive load: ${direction}, distance: ${estimatedDistance}`)
    }

    // 如果向下滚动且接近底部，触发预加载
    if (
      direction === 'down' &&
      estimatedDistance < 10 &&
      scrollConfig.enableSmartPreload &&
      onPreload &&
      !isPreloading.value &&
      !reachedEnd.value
    ) {
      isPreloading.value = true

      onPreload()
        .then(() => {
          isPreloading.value = false
        })
        .catch((error) => {
          console.error('[VirtualScroll] Predictive load failed:', error)
          isPreloading.value = false
        })
    }
  }

  /**
   * 重置滚动状态
   *
   * @example
   * resetScroll()
   */
  function resetScroll(): void {
    visibleRange.value = { startIndex: 0, endIndex: 0 }
    isPreloading.value = false
    reachedEnd.value = false
    console.log('🔄 [VirtualScroll] Scroll state reset')
  }

  /**
   * 设置已到达末尾状态
   *
   * @param {boolean} reached - 是否已到达末尾
   *
   * @example
   * setReachedEnd(true)
   */
  function setReachedEnd(reached: boolean): void {
    reachedEnd.value = reached
    if (reached) {
      console.log('🏁 [VirtualScroll] Reached end of list')
    }
  }

  return {
    visibleRange,
    scrollConfig,
    isPreloading,
    reachedEnd,
    handleVisibleRangeChange,
    handleReachBottom,
    handlePredictiveLoad,
    resetScroll,
    setReachedEnd
  }
}
