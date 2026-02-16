/**
 * Scroll Event Handlers Composable
 *
 * Handles the main scroll event handler (handleScroll), manual load-more
 * button click, scroll direction detection, and load-more trigger visibility.
 *
 * @module composables/message/useScrollEventHandlers
 */

import { ref, type Ref } from 'vue'

/**
 * Props required by useScrollEventHandlers composable
 */
export interface UseScrollEventHandlersProps {
  loading?: boolean
  hasMore?: boolean
  loadingHistory?: boolean
}

/**
 * Options for useScrollEventHandlers composable
 */
export interface UseScrollEventHandlersOptions {
  props: UseScrollEventHandlersProps
  scrollContainer: Ref<HTMLElement | undefined>
  isProgrammaticScrolling: Ref<boolean>
  isUserAtBottom: Ref<boolean>
  recentlyScrolledToBottom: Ref<boolean>
  checkIfUserAtBottom: () => boolean
  checkIfUserAtTop: () => boolean
  emit: (_event: string, ..._args: unknown[]) => void
}

/**
 * Composable for managing scroll event handling.
 *
 * Provides:
 * - handleScroll: Main scroll event handler with direction detection
 * - handleManualLoadMore: Click handler for load-more button
 * - showLoadMoreTrigger: Reactive visibility of load-more trigger
 * - Scroll direction tracking and debounced trigger visibility
 *
 * @param options - Configuration options
 * @returns Scroll event handlers and reactive state
 */
export function useScrollEventHandlers(options: UseScrollEventHandlersOptions) {
  const {
    props,
    scrollContainer,
    isProgrammaticScrolling,
    isUserAtBottom,
    recentlyScrolledToBottom,
    checkIfUserAtBottom,
    checkIfUserAtTop,
    emit,
  } = options

  // Refs for scroll tracking
  const lastScrollTop = ref(0)
  const lastLoadMoreTime = ref(0)
  const lastScrollDebugTime = ref(0)
  const showLoadMoreTrigger = ref(false)

  // Constants
  const LOAD_MORE_THROTTLE_MS = 1000
  const SCROLL_DIRECTION_THRESHOLD = 10
  const SHOW_LOAD_MORE_NEAR_TOP_THRESHOLD = 500
  const SHOW_LOAD_MORE_DELAY_MS = 200
  const HIDE_LOAD_MORE_DELAY_MS = 400

  // Debounce timers for load-more trigger visibility
  let hideLoadMoreTimeout: ReturnType<typeof setTimeout> | null = null
  let showLoadMoreTimeout: ReturnType<typeof setTimeout> | null = null

  /**
   * Main scroll event handler.
   * Detects scroll direction, updates user position tracking,
   * triggers load-more when near top, and manages load-more trigger visibility.
   */
  const handleScroll = () => {
    if (!scrollContainer.value) { return }

    // Skip during programmatic scrolling to prevent race conditions
    if (isProgrammaticScrolling.value) {
      console.log('🔒 [handleScroll] Skipped - programmatic scrolling in progress')
      return
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value

    // Update user position
    const isAtBottom = checkIfUserAtBottom()
    const isAtTop = checkIfUserAtTop()

    // Don't reset isUserAtBottom to false during grace period
    if (isAtBottom) {
      isUserAtBottom.value = true
    } else if (!recentlyScrolledToBottom.value) {
      isUserAtBottom.value = false
    } else {
      console.log('🛡️ [handleScroll] Grace period active - preserving isUserAtBottom = true')
    }

    // Check scroll direction with threshold to avoid flickering
    const scrollDelta = lastScrollTop.value - scrollTop
    const isScrollingUp = scrollDelta > SCROLL_DIRECTION_THRESHOLD
    const isScrollingDown = scrollDelta < -SCROLL_DIRECTION_THRESHOLD
    const isNearTop = scrollTop < SHOW_LOAD_MORE_NEAR_TOP_THRESHOLD

    // Show load-more trigger when scrolling up near top with more messages available
    const shouldShowLoadMore = isScrollingUp && isNearTop && props.hasMore && !props.loading

    if (shouldShowLoadMore) {
      if (hideLoadMoreTimeout) {
        clearTimeout(hideLoadMoreTimeout)
        hideLoadMoreTimeout = null
      }
      if (!showLoadMoreTimeout && !showLoadMoreTrigger.value) {
        showLoadMoreTimeout = setTimeout(() => {
          showLoadMoreTrigger.value = true
          showLoadMoreTimeout = null
        }, SHOW_LOAD_MORE_DELAY_MS)
      }
    } else if (isScrollingDown || !isNearTop) {
      if (showLoadMoreTimeout) {
        clearTimeout(showLoadMoreTimeout)
        showLoadMoreTimeout = null
      }
      if (!hideLoadMoreTimeout && showLoadMoreTrigger.value) {
        hideLoadMoreTimeout = setTimeout(() => {
          showLoadMoreTrigger.value = false
          hideLoadMoreTimeout = null
        }, HIDE_LOAD_MORE_DELAY_MS)
      }
    }

    // Debug scroll state every 2 seconds
    if (Date.now() - lastScrollDebugTime.value > 2000) {
      console.log(`🔍 [VirtualMessageList] Scroll State:`, {
        scrollTop: Math.round(scrollTop),
        scrollHeight: Math.round(scrollHeight),
        clientHeight: Math.round(clientHeight),
        isAtTop,
        isScrollingUp,
        loadingHistory: props.loadingHistory,
        loading: props.loading,
        hasMore: props.hasMore,
        threshold: 100,
        topDistance: Math.round(scrollTop)
      })
      lastScrollDebugTime.value = Date.now()
    }

    // Load more historical messages when scrolling near top
    if (isAtTop && !props.loadingHistory && !props.loading && props.hasMore && isScrollingUp) {
      const now = Date.now()
      if (now - lastLoadMoreTime.value > LOAD_MORE_THROTTLE_MS) {
        console.log('📜 User scrolled up to top, loading more history...')
        lastLoadMoreTime.value = now
        emit('loadMore')
      }
    }

    // Emit scroll event
    emit('scroll', { scrollTop, scrollHeight, clientHeight })

    // Update lastScrollTop AFTER direction detection
    lastScrollTop.value = scrollTop
  }

  /**
   * Manual load-more button click handler.
   * Immediately hides the trigger and emits loadMore event.
   */
  const handleManualLoadMore = () => {
    if (props.loading || !props.hasMore) {
      console.log('⚠️ [VirtualMessageList] Cannot load more:', { loading: props.loading, hasMore: props.hasMore })
      return
    }
    console.log('🔼 [VirtualMessageList] Manual load more triggered')

    showLoadMoreTrigger.value = false

    if (showLoadMoreTimeout) {
      clearTimeout(showLoadMoreTimeout)
      showLoadMoreTimeout = null
    }
    if (hideLoadMoreTimeout) {
      clearTimeout(hideLoadMoreTimeout)
      hideLoadMoreTimeout = null
    }

    emit('loadMore')
  }

  /**
   * Clean up all debounce timeouts.
   */
  function cleanupTimeouts() {
    if (hideLoadMoreTimeout) {
      clearTimeout(hideLoadMoreTimeout)
      hideLoadMoreTimeout = null
    }
    if (showLoadMoreTimeout) {
      clearTimeout(showLoadMoreTimeout)
      showLoadMoreTimeout = null
    }
  }

  return {
    // Reactive state
    showLoadMoreTrigger,

    // Methods
    handleScroll,
    handleManualLoadMore,
    cleanupTimeouts,
  }
}
