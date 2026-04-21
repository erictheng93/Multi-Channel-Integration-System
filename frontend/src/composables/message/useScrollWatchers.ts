/**
 * Scroll Watchers Composable
 *
 * Manages all watch() calls for the virtual message list:
 * - History prepending with scroll position preservation
 * - Message count changes with auto-scroll behavior
 * - onMounted and onUnmounted lifecycle for scroll setup/teardown
 *
 * @module composables/message/useScrollWatchers
 */

import { ref, watch, nextTick, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { Message } from '@/types'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useScrollWatchers')

/**
 * Props required by useScrollWatchers composable
 */
export interface UseScrollWatchersProps {
  isSearchActive?: boolean
  isHistoryPrepending?: boolean
  historyPrependCount?: number
}

/**
 * Options for useScrollWatchers composable
 */
export interface UseScrollWatchersOptions {
  props: UseScrollWatchersProps
  scrollContainer: Ref<HTMLElement | undefined>
  displayedMessages: ComputedRef<Message[]>
  virtualItemsLength: () => number
  isProgrammaticScrolling: Ref<boolean>
  isUserAtBottom: Ref<boolean>
  isInitialScrollDone: Ref<boolean>
  scrollToBottom: (_retries?: number, _delay?: number) => Promise<void>
  waitForStableScrollHeight: (_maxWaitMs?: number, _checkIntervalMs?: number) => Promise<void>
  checkIfUserAtBottom: () => boolean
  handleScroll: () => void
  setupContentResizeObserver: () => void
  cleanupContentResizeObserver: () => void
  cleanupGracePeriod: () => void
  cleanupTimeouts: () => void
  emit: (_event: string, ..._args: unknown[]) => void
}

/**
 * Composable for managing scroll-related watchers and lifecycle hooks.
 *
 * Provides:
 * - History prepend watch with scroll position preservation
 * - Message count change watch with auto-scroll
 * - onMounted scroll initialization
 * - onUnmounted cleanup
 * - New message animation tracking
 *
 * @param options - Configuration options
 * @returns Animation-related methods and refs
 */
export function useScrollWatchers(options: UseScrollWatchersOptions) {
  const {
    props,
    scrollContainer,
    displayedMessages,
    virtualItemsLength,
    isProgrammaticScrolling,
    isUserAtBottom,
    isInitialScrollDone,
    scrollToBottom,
    waitForStableScrollHeight,
    checkIfUserAtBottom,
    handleScroll,
    setupContentResizeObserver,
    cleanupContentResizeObserver,
    cleanupGracePeriod,
    cleanupTimeouts,
    emit,
  } = options

  // Animation state
  const newMessageIds = ref(new Set<string>())

  // Scroll position preservation for history prepend
  const scrollPositionBeforePrepend = ref<{
    scrollTop: number
    scrollHeight: number
    clientHeight: number
    wasAtBottom: boolean
    firstVisibleMessageId: string | null
  } | null>(null)
  const pendingScrollPreservation = ref(false)

  /**
   * Check if a message is new (for animation purposes).
   */
  const isNewMessage = (messageId: string) => {
    return newMessageIds.value.has(messageId)
  }

  /**
   * Mark new messages for entrance animation.
   */
  const addMessageAnimation = () => {
    const existingIds = new Set(props.isSearchActive ? [] : displayedMessages.value.map(m => m.id))
    displayedMessages.value.forEach(msg => {
      if (!existingIds.has(msg.id)) {
        newMessageIds.value.add(msg.id)
        setTimeout(() => {
          newMessageIds.value.delete(msg.id)
        }, 500)
      }
    })
  }

  // Watch for history prepending to capture scroll position BEFORE DOM updates
  watch(() => props.isHistoryPrepending, (isPrepending, wasPrepending) => {
    if (isPrepending && !wasPrepending && scrollContainer.value) {
      const container = scrollContainer.value
      const { scrollTop, scrollHeight, clientHeight } = container

      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      const wasAtBottom = distanceFromBottom < 200

      scrollPositionBeforePrepend.value = {
        scrollTop,
        scrollHeight,
        clientHeight,
        wasAtBottom,
        firstVisibleMessageId: null
      }
      pendingScrollPreservation.value = true
      frontendLogger.debug(`[ScrollPreservation] Captured position before prepend: scrollTop=${scrollTop}, scrollHeight=${scrollHeight}, distanceFromBottom=${distanceFromBottom}, wasAtBottom=${wasAtBottom}`)
    }
  })

  // Watch displayedMessages count for auto-scroll behavior
  watch(() => displayedMessages.value.length, async (newCount, oldCount) => {
    frontendLogger.debug(`[DisplayedMessageWatch] Displayed count changed: ${oldCount} → ${newCount}, virtualItems: ${virtualItemsLength()}`)

    if (oldCount !== undefined && oldCount > 0 && newCount > oldCount) {
      // Check if this is a history prepend operation
      const isHistoryPrepend = pendingScrollPreservation.value && scrollPositionBeforePrepend.value

      if (isHistoryPrepend) {
        const savedPosition = scrollPositionBeforePrepend.value
        const wasAtBottomBeforePrepend = savedPosition?.wasAtBottom ?? false

        frontendLogger.debug(`[ScrollPreservation] History prepend detected, wasAtBottom: ${wasAtBottomBeforePrepend}`)

        isProgrammaticScrolling.value = true

        await nextTick()
        await new Promise(resolve => window.requestAnimationFrame(resolve))

        if (scrollContainer.value && savedPosition) {
          const container = scrollContainer.value

          if (wasAtBottomBeforePrepend) {
            frontendLogger.debug(`[ScrollPreservation] User was at bottom, scrolling to bottom after prepend...`)

            scrollPositionBeforePrepend.value = null
            pendingScrollPreservation.value = false

            isProgrammaticScrolling.value = false

            await waitForStableScrollHeight()
            await scrollToBottom()

            await new Promise(resolve => setTimeout(resolve, 200))
            if (!checkIfUserAtBottom()) {
              frontendLogger.debug('[ScrollPreservation] Post-scroll verification: not at bottom, scrolling again...')
              await scrollToBottom()
            }

            frontendLogger.debug(`[ScrollPreservation] Scrolled to bottom after history prepend`)
            return
          } else {
            const newScrollHeight = container.scrollHeight
            const heightDifference = newScrollHeight - savedPosition.scrollHeight

            const newScrollTop = savedPosition.scrollTop + heightDifference
            container.scrollTop = newScrollTop

            frontendLogger.debug(`[ScrollPreservation] Adjusted scroll position (user was NOT at bottom):`)
            frontendLogger.debug(` - Old scrollHeight: ${savedPosition.scrollHeight}, New scrollHeight: ${newScrollHeight}`)
            frontendLogger.debug(` - Height difference: ${heightDifference}`)
            frontendLogger.debug(` - Old scrollTop: ${savedPosition.scrollTop}, New scrollTop: ${newScrollTop}`)

            scrollPositionBeforePrepend.value = null
            pendingScrollPreservation.value = false

            setTimeout(() => {
              isProgrammaticScrolling.value = false
              frontendLogger.debug(`[ScrollPreservation] Guard cleared`)
            }, 100)
          }
        }

        return
      }

      // Normal new messages
      const wasAtBottom = isUserAtBottom.value
      frontendLogger.debug(`[DisplayedMessageWatch] New messages detected, wasAtBottom: ${wasAtBottom}`)

      await nextTick()
      addMessageAnimation()

      // Wait for virtualizer to fully update
      await new Promise(resolve => window.requestAnimationFrame(resolve))
      await nextTick()
      await new Promise(resolve => window.requestAnimationFrame(resolve))
      await new Promise(resolve => setTimeout(resolve, 20))

      frontendLogger.debug(`[DisplayedMessageWatch] After wait - virtualItems: ${virtualItemsLength()}`)

      if (!props.isSearchActive && wasAtBottom) {
        frontendLogger.debug('[DisplayedMessageWatch] Auto-scrolling to bottom...')
        await waitForStableScrollHeight()
        await scrollToBottom()

        await new Promise(resolve => setTimeout(resolve, 200))
        if (!checkIfUserAtBottom()) {
          frontendLogger.debug('[DisplayedMessageWatch] Post-scroll verification: not at bottom, scrolling again...')
          await scrollToBottom()
        }
      } else if (!wasAtBottom) {
        frontendLogger.debug('[DisplayedMessageWatch] User not at bottom, showing notification')
        emit('newMessageWhileScrolled')
      }
    } else if ((oldCount === undefined || oldCount === 0) && newCount > 0) {
      // Initial load
      if (isInitialScrollDone.value) {
        frontendLogger.debug('[DisplayedMessageWatch] Initial load detected, but onMounted already handled scroll - skipping')
        return
      }

      frontendLogger.debug('[DisplayedMessageWatch] Initial load detected, scrolling to bottom...')
      await nextTick()
      await new Promise(resolve => window.requestAnimationFrame(resolve))
      await waitForStableScrollHeight()
      await scrollToBottom()

      await nextTick()
      await new Promise(resolve => window.requestAnimationFrame(resolve))

      if (!checkIfUserAtBottom()) {
        frontendLogger.debug('[DisplayedMessageWatch] Quick verification: not at bottom, scrolling again...')
        await scrollToBottom()
      }

      isInitialScrollDone.value = true

      emit('initialScrollComplete')
      frontendLogger.debug('[DisplayedMessageWatch] Emitted initialScrollComplete event')
    } else if ((oldCount === undefined || oldCount === 0) && newCount === 0) {
      // FIX: Zero-message initial load — emit initialScrollComplete so skeleton can hide
      if (!isInitialScrollDone.value) {
        frontendLogger.debug('[DisplayedMessageWatch] Initial load with zero messages, emitting initialScrollComplete')
        isInitialScrollDone.value = true
        emit('initialScrollComplete')
      }
    }
  })

  // Lifecycle: Mount
  onMounted(async () => {
    frontendLogger.debug('[VirtualMessageList] Component mounted')
    await nextTick()

    await new Promise(resolve => window.requestAnimationFrame(resolve))
    await nextTick()
    await new Promise(resolve => window.requestAnimationFrame(resolve))

    // Add scroll listener
    if (scrollContainer.value) {
      scrollContainer.value.addEventListener('scroll', handleScroll, { passive: true })
    }

    // Set up ResizeObserver
    setupContentResizeObserver()

    // Scroll to bottom if we have messages
    if (!props.isSearchActive && displayedMessages.value.length > 0) {
      frontendLogger.debug(`[VirtualMessageList] Initial scroll to bottom with ${displayedMessages.value.length} messages`)

      await waitForStableScrollHeight()
      await scrollToBottom()

      await nextTick()
      await new Promise(resolve => window.requestAnimationFrame(resolve))

      if (!checkIfUserAtBottom()) {
        frontendLogger.debug('[VirtualMessageList] Quick verification: not at bottom, scrolling again...')
        await scrollToBottom()
      }

      isInitialScrollDone.value = true
      frontendLogger.debug('[VirtualMessageList] Single optimized scroll complete, isInitialScrollDone=true')

      emit('initialScrollComplete')
      frontendLogger.debug('[VirtualMessageList] Emitted initialScrollComplete event')
    }
  })

  // Lifecycle: Unmount
  onUnmounted(() => {
    if (scrollContainer.value) {
      scrollContainer.value.removeEventListener('scroll', handleScroll)
    }
    cleanupTimeouts()
    cleanupGracePeriod()
    cleanupContentResizeObserver()
  })

  return {
    newMessageIds,
    isNewMessage,
    addMessageAnimation,
  }
}
