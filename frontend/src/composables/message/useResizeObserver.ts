/**
 * Resize Observer Composable
 *
 * Monitors virtual list content height changes (e.g., when images/videos
 * finish loading) and compensates scroll position to prevent layout shift.
 *
 * @module composables/message/useResizeObserver
 */

/* global ResizeObserver, ResizeObserverEntry */

import { type Ref } from 'vue'

/**
 * Options for useResizeObserver composable
 */
export interface UseResizeObserverOptions {
  scrollContainer: Ref<HTMLElement | undefined>
  listContainer: Ref<HTMLElement | undefined>
  isUserAtBottom: Ref<boolean>
  recentlyScrolledToBottom: Ref<boolean>
}

/**
 * Composable for managing ResizeObserver on virtual list content.
 *
 * Provides:
 * - setupContentResizeObserver: Initialize observer on mount
 * - cleanupContentResizeObserver: Disconnect observer on unmount
 * - Automatic scroll position compensation when content height changes
 *
 * @param options - Configuration options
 * @returns Setup and cleanup functions for the resize observer
 */
export function useResizeObserver(options: UseResizeObserverOptions) {
  const { scrollContainer, listContainer, isUserAtBottom, recentlyScrolledToBottom } = options

  // Internal state
  let contentResizeObserver: ResizeObserver | null = null
  let previousContentHeight = 0
  let resizeCompensationPending = false

  /**
   * Handle content resize events.
   * When content height increases (e.g., image load) and user is near bottom,
   * compensate scroll position to maintain visual position.
   */
  const handleContentResize = (entries: ResizeObserverEntry[]) => {
    if (!scrollContainer.value || resizeCompensationPending) {
      return
    }

    const entry = entries[0]
    if (!entry) { return }

    const newHeight = entry.contentRect.height
    const heightDelta = newHeight - previousContentHeight

    // Only handle height increases > 5px (ignore micro-changes)
    if (heightDelta > 5 && previousContentHeight > 0) {
      const container = scrollContainer.value
      const { scrollTop, scrollHeight, clientHeight } = container

      // Check if user is near bottom (tolerance 150px)
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      const wasNearBottom = distanceFromBottom < 150

      // Compensate during grace period or when user is at bottom
      const shouldCompensate = wasNearBottom || recentlyScrolledToBottom.value || isUserAtBottom.value

      if (shouldCompensate) {
        resizeCompensationPending = true

        // Use RAF for smooth compensation
        window.requestAnimationFrame(() => {
          if (scrollContainer.value) {
            const targetScroll = scrollContainer.value.scrollHeight - clientHeight
            scrollContainer.value.scrollTop = targetScroll

            console.log(`🔄 [ResizeObserver] Compensated scroll for height change: ` +
              `+${Math.round(heightDelta)}px, scrollTop: ${Math.round(scrollTop)} → ${Math.round(targetScroll)}`)
          }
          resizeCompensationPending = false
        })
      } else {
        console.log(`📏 [ResizeObserver] Height changed +${Math.round(heightDelta)}px but user not at bottom (distance: ${Math.round(distanceFromBottom)}px)`)
      }
    }

    previousContentHeight = newHeight
  }

  /**
   * Set up the ResizeObserver on the list container.
   * Should be called in onMounted.
   */
  const setupContentResizeObserver = () => {
    if (!listContainer.value || contentResizeObserver) {
      return
    }

    contentResizeObserver = new ResizeObserver(handleContentResize)
    contentResizeObserver.observe(listContainer.value)

    previousContentHeight = listContainer.value.getBoundingClientRect().height
    console.log(`📐 [ResizeObserver] Initialized with height: ${Math.round(previousContentHeight)}px`)
  }

  /**
   * Clean up the ResizeObserver.
   * Should be called in onUnmounted.
   */
  const cleanupContentResizeObserver = () => {
    if (contentResizeObserver) {
      contentResizeObserver.disconnect()
      contentResizeObserver = null
      console.log('📐 [ResizeObserver] Disconnected')
    }
  }

  return {
    setupContentResizeObserver,
    cleanupContentResizeObserver,
  }
}
