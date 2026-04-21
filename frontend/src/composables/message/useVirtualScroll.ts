/**
 * Virtual Scroll Composable
 *
 * Handles scroll-to operations (scrollToMessage, scrollToTop, scrollToBottom),
 * scroll position checks, grace period logic, and programmatic scrolling guards.
 *
 * @module composables/message/useVirtualScroll
 */

import { ref, nextTick, type Ref } from 'vue'
import type { Virtualizer } from '@tanstack/vue-virtual'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useVirtualScroll')

/**
 * Options for useVirtualScroll composable
 */
export interface UseVirtualScrollOptions {
  scrollContainer: Ref<HTMLElement | undefined>
  virtualizer: Ref<Virtualizer<HTMLElement, Element>>
  virtualItemsLength: () => number
}

/**
 * Composable for managing virtual scroll operations.
 *
 * Provides scroll-to methods with retry logic, scroll position detection,
 * and a grace period system to prevent race conditions with virtualizer
 * height adjustments after scrollToBottom.
 *
 * @param options - Configuration options
 * @returns Scroll operation methods and reactive state
 */
export function useVirtualScroll(options: UseVirtualScrollOptions) {
  const { scrollContainer, virtualizer, virtualItemsLength } = options

  // Reactive state
  const isUserAtBottom = ref(true)
  const isProgrammaticScrolling = ref(false)
  const isInitialScrollDone = ref(false)

  // Grace period state - prevents scroll events from resetting isUserAtBottom
  // after scrollToBottom completes. This handles the race condition where:
  // 1. scrollToBottom completes and sets isUserAtBottom = true
  // 2. Virtualizer adjusts heights, triggering scroll events
  // 3. These events would incorrectly set isUserAtBottom = false
  // 4. New messages arrive but auto-scroll doesn't happen
  const recentlyScrolledToBottom = ref(false)
  let recentlyScrolledToBottomTimeout: ReturnType<typeof setTimeout> | null = null
  const GRACE_PERIOD_MS = 1000

  /**
   * Start grace period after scrollToBottom.
   * During this period, scroll events cannot set isUserAtBottom to false.
   */
  function startGracePeriod() {
    if (recentlyScrolledToBottomTimeout) {
      clearTimeout(recentlyScrolledToBottomTimeout)
    }

    recentlyScrolledToBottom.value = true
    frontendLogger.debug(`[GracePeriod] Started (${GRACE_PERIOD_MS}ms)`)

    recentlyScrolledToBottomTimeout = setTimeout(() => {
      recentlyScrolledToBottom.value = false
      recentlyScrolledToBottomTimeout = null
      frontendLogger.debug('[GracePeriod] Ended')
    }, GRACE_PERIOD_MS)
  }

  /**
   * Clean up grace period timeout.
   */
  function cleanupGracePeriod() {
    if (recentlyScrolledToBottomTimeout) {
      clearTimeout(recentlyScrolledToBottomTimeout)
      recentlyScrolledToBottomTimeout = null
    }
  }

  /**
   * Check if user is at the bottom of the scroll container.
   */
  const checkIfUserAtBottom = () => {
    if (!scrollContainer.value) { return true }
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value
    const threshold = 100
    return scrollHeight - scrollTop - clientHeight < threshold
  }

  /**
   * Check if user is at the top of the scroll container.
   */
  const checkIfUserAtTop = () => {
    if (!scrollContainer.value) { return false }
    const { scrollTop } = scrollContainer.value
    const threshold = 2500
    return scrollTop < threshold
  }

  /**
   * Wait for scrollHeight to stabilize before scrolling.
   * This ensures virtual list has fully rendered before we scroll.
   */
  const waitForStableScrollHeight = async (maxWaitMs = 250, checkIntervalMs = 25): Promise<void> => {
    if (!scrollContainer.value) { return }

    let lastScrollHeight = scrollContainer.value.scrollHeight
    let stableCount = 0
    const requiredStableChecks = 2
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs))
      await new Promise(resolve => window.requestAnimationFrame(resolve))

      if (!scrollContainer.value) { return }

      const currentScrollHeight = scrollContainer.value.scrollHeight

      if (currentScrollHeight === lastScrollHeight) {
        stableCount++
        if (stableCount >= requiredStableChecks) {
          frontendLogger.debug(`[ScrollHeight] Stabilized at ${currentScrollHeight}px after ${Date.now() - startTime}ms`)
          return
        }
      } else {
        stableCount = 0
        frontendLogger.debug(`[ScrollHeight] Changed: ${lastScrollHeight} → ${currentScrollHeight}`)
        lastScrollHeight = currentScrollHeight
      }
    }

    frontendLogger.debug(`[ScrollHeight] Timeout after ${maxWaitMs}ms, proceeding with current height: ${lastScrollHeight}`)
  }

  // Helper: Wait for next animation frame
  const waitForFrame = () => new Promise(resolve => window.requestAnimationFrame(resolve))

  /**
   * Scroll to a message by its index in the virtual items array.
   * The parent component is responsible for resolving message ID to index.
   */
  const scrollToMessageByIndex = async (index: number, retries = 3, delay = 100) => {
    if (index < 0 || !virtualizer.value) {
      return
    }

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await nextTick()

        const container = virtualizer.value.scrollElement
        if (container && virtualizer.value.options.count === virtualItemsLength()) {
          virtualizer.value.scrollToIndex(index, {
            align: 'center'
          })
          return
        }
      } catch (error) {
        console.warn(`Scroll to message attempt ${attempt + 1} failed:`, error)
      }

      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  /**
   * Scroll to top with retry logic and exponential backoff.
   */
  const scrollToTop = async (retries = 5, delay = 150) => {
    if (!virtualizer.value || virtualItemsLength() === 0) {
      return
    }

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await nextTick()

        const container = virtualizer.value.scrollElement
        if (container && virtualizer.value.options.count === virtualItemsLength()) {
          container.scrollTop = 0
          return
        }
      } catch (error) {
        console.warn(`Scroll to top attempt ${attempt + 1} failed:`, error)
      }

      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)))
      }
    }

    // Final fallback
    try {
      await new Promise(resolve => setTimeout(resolve, 300))
      if (virtualizer.value) {
        virtualizer.value.scrollToIndex(0, { align: 'start' })
      }
    } catch (error) {
      console.warn('Final scroll to top attempt failed:', error)
    }
  }

  /**
   * Scroll to bottom with retry logic, exponential backoff, and grace period.
   */
  const scrollToBottom = async (retries = 10, delay = 100) => {
    const lastIndex = virtualItemsLength() - 1
    if (lastIndex < 0 || !virtualizer.value) {
      frontendLogger.debug('[ScrollToBottom] Skipped - no items or virtualizer')
      return
    }

    frontendLogger.debug(`[ScrollToBottom] Starting scroll to bottom, items: ${virtualItemsLength()}, lastIndex: ${lastIndex}`)

    isProgrammaticScrolling.value = true

    const isVirtualizerReady = (): boolean => {
      if (!virtualizer.value) { return false }
      const container = virtualizer.value.scrollElement
      if (!container) { return false }

      const totalSize = virtualizer.value.getTotalSize()
      return totalSize > 0
    }

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await waitForFrame()
        await nextTick()

        if (isVirtualizerReady() && virtualizer.value) {
          virtualizer.value.scrollToIndex(lastIndex, { align: 'end' })

          await waitForFrame()
          await nextTick()

          const container = virtualizer.value.scrollElement
          if (container) {
            const beforeScrollTop = container.scrollTop
            container.scrollTop = container.scrollHeight

            frontendLogger.debug(`[ScrollToBottom] Scrolled on attempt ${attempt + 1}, ` +
              `scrollToIndex(${lastIndex}), scrollTop: ${beforeScrollTop} → ${container.scrollTop}, ` +
              `scrollHeight: ${container.scrollHeight}`)
          }

          setTimeout(() => {
            isProgrammaticScrolling.value = false
            isUserAtBottom.value = true

            startGracePeriod()
            frontendLogger.debug('[ScrollToBottom] Success - guard cleared, grace period started')
          }, 100)

          return
        }
      } catch (error) {
        console.warn(`[ScrollToBottom] Attempt ${attempt + 1} failed:`, error)
      }

      if (attempt < retries - 1) {
        const waitTime = Math.min(delay * Math.pow(1.5, attempt), 500)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    // Final fallback
    frontendLogger.debug('[ScrollToBottom] Using final fallback methods...')
    try {
      await new Promise(resolve => setTimeout(resolve, 200))

      if (virtualizer.value) {
        virtualizer.value.scrollToIndex(virtualItemsLength() - 1, { align: 'end' })

        await new Promise(resolve => setTimeout(resolve, 50))
        const container = virtualizer.value.scrollElement
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      }
    } catch (error) {
      console.warn('[ScrollToBottom] Final fallback failed:', error)
    } finally {
      setTimeout(() => {
        isProgrammaticScrolling.value = false
        isUserAtBottom.value = true

        startGracePeriod()
        frontendLogger.debug('[ScrollToBottom] Guard cleared, isUserAtBottom set to true, grace period started')
      }, 100)
    }
  }

  return {
    // Reactive state
    isUserAtBottom,
    isProgrammaticScrolling,
    isInitialScrollDone,
    recentlyScrolledToBottom,

    // Methods
    scrollToMessageByIndex,
    scrollToTop,
    scrollToBottom,
    checkIfUserAtBottom,
    checkIfUserAtTop,
    waitForStableScrollHeight,
    startGracePeriod,
    cleanupGracePeriod,
  }
}
