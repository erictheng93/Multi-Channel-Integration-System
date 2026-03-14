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
      console.log(`[ScrollPreservation] Captured position before prepend: scrollTop=${scrollTop}, scrollHeight=${scrollHeight}, distanceFromBottom=${distanceFromBottom}, wasAtBottom=${wasAtBottom}`)
    }
  })

  // Watch displayedMessages count for auto-scroll behavior
  watch(() => displayedMessages.value.length, async (newCount, oldCount) => {
    console.log(`[DisplayedMessageWatch] Displayed count changed: ${oldCount} → ${newCount}, virtualItems: ${virtualItemsLength()}`)

    if (oldCount !== undefined && oldCount > 0 && newCount > oldCount) {
      // Check if this is a history prepend operation
      const isHistoryPrepend = pendingScrollPreservation.value && scrollPositionBeforePrepend.value

      if (isHistoryPrepend) {
        const savedPosition = scrollPositionBeforePrepend.value
        const wasAtBottomBeforePrepend = savedPosition?.wasAtBottom ?? false

        console.log(`[ScrollPreservation] History prepend detected, wasAtBottom: ${wasAtBottomBeforePrepend}`)

        isProgrammaticScrolling.value = true

        await nextTick()
        await new Promise(resolve => window.requestAnimationFrame(resolve))

        if (scrollContainer.value && savedPosition) {
          const container = scrollContainer.value

          if (wasAtBottomBeforePrepend) {
            console.log(`[ScrollPreservation] User was at bottom, scrolling to bottom after prepend...`)

            scrollPositionBeforePrepend.value = null
            pendingScrollPreservation.value = false

            isProgrammaticScrolling.value = false

            await waitForStableScrollHeight()
            await scrollToBottom()

            await new Promise(resolve => setTimeout(resolve, 200))
            if (!checkIfUserAtBottom()) {
              console.log('[ScrollPreservation] Post-scroll verification: not at bottom, scrolling again...')
              await scrollToBottom()
            }

            console.log(`[ScrollPreservation] Scrolled to bottom after history prepend`)
            return
          } else {
            const newScrollHeight = container.scrollHeight
            const heightDifference = newScrollHeight - savedPosition.scrollHeight

            const newScrollTop = savedPosition.scrollTop + heightDifference
            container.scrollTop = newScrollTop

            console.log(`[ScrollPreservation] Adjusted scroll position (user was NOT at bottom):`)
            console.log(` - Old scrollHeight: ${savedPosition.scrollHeight}, New scrollHeight: ${newScrollHeight}`)
            console.log(` - Height difference: ${heightDifference}`)
            console.log(` - Old scrollTop: ${savedPosition.scrollTop}, New scrollTop: ${newScrollTop}`)

            scrollPositionBeforePrepend.value = null
            pendingScrollPreservation.value = false

            setTimeout(() => {
              isProgrammaticScrolling.value = false
              console.log(`[ScrollPreservation] Guard cleared`)
            }, 100)
          }
        }

        return
      }

      // Normal new messages
      const wasAtBottom = isUserAtBottom.value
      console.log(`[DisplayedMessageWatch] New messages detected, wasAtBottom: ${wasAtBottom}`)

      await nextTick()
      addMessageAnimation()

      // Wait for virtualizer to fully update
      await new Promise(resolve => window.requestAnimationFrame(resolve))
      await nextTick()
      await new Promise(resolve => window.requestAnimationFrame(resolve))
      await new Promise(resolve => setTimeout(resolve, 20))

      console.log(`[DisplayedMessageWatch] After wait - virtualItems: ${virtualItemsLength()}`)

      if (!props.isSearchActive && wasAtBottom) {
        console.log('[DisplayedMessageWatch] Auto-scrolling to bottom...')
        await waitForStableScrollHeight()
        await scrollToBottom()

        await new Promise(resolve => setTimeout(resolve, 200))
        if (!checkIfUserAtBottom()) {
          console.log('[DisplayedMessageWatch] Post-scroll verification: not at bottom, scrolling again...')
          await scrollToBottom()
        }
      } else if (!wasAtBottom) {
        console.log('[DisplayedMessageWatch] User not at bottom, showing notification')
        emit('newMessageWhileScrolled')
      }
    } else if ((oldCount === undefined || oldCount === 0) && newCount > 0) {
      // Initial load
      if (isInitialScrollDone.value) {
        console.log('[DisplayedMessageWatch] Initial load detected, but onMounted already handled scroll - skipping')
        return
      }

      console.log('[DisplayedMessageWatch] Initial load detected, scrolling to bottom...')
      await nextTick()
      await new Promise(resolve => window.requestAnimationFrame(resolve))
      await waitForStableScrollHeight()
      await scrollToBottom()

      await nextTick()
      await new Promise(resolve => window.requestAnimationFrame(resolve))

      if (!checkIfUserAtBottom()) {
        console.log('[DisplayedMessageWatch] Quick verification: not at bottom, scrolling again...')
        await scrollToBottom()
      }

      isInitialScrollDone.value = true

      emit('initialScrollComplete')
      console.log('[DisplayedMessageWatch] Emitted initialScrollComplete event')
    } else if ((oldCount === undefined || oldCount === 0) && newCount === 0) {
      // FIX: Zero-message initial load — emit initialScrollComplete so skeleton can hide
      if (!isInitialScrollDone.value) {
        console.log('[DisplayedMessageWatch] Initial load with zero messages, emitting initialScrollComplete')
        isInitialScrollDone.value = true
        emit('initialScrollComplete')
      }
    }
  })

  // Lifecycle: Mount
  onMounted(async () => {
    console.log('[VirtualMessageList] Component mounted')
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
      console.log(`[VirtualMessageList] Initial scroll to bottom with ${displayedMessages.value.length} messages`)

      await waitForStableScrollHeight()
      await scrollToBottom()

      await nextTick()
      await new Promise(resolve => window.requestAnimationFrame(resolve))

      if (!checkIfUserAtBottom()) {
        console.log('[VirtualMessageList] Quick verification: not at bottom, scrolling again...')
        await scrollToBottom()
      }

      isInitialScrollDone.value = true
      console.log('[VirtualMessageList] Single optimized scroll complete, isInitialScrollDone=true')

      emit('initialScrollComplete')
      console.log('[VirtualMessageList] Emitted initialScrollComplete event')
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
