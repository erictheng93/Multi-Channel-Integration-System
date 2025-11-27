<template>
  <div
    ref="scrollContainer"
    class="virtual-message-list"
  >
    <!-- Search Results Header -->
    <div
      v-if="isSearchActive"
      class="search-results-header"
    >
      <span>搜索結果 ({{ displayedMessages.length }})</span>
      <button
        class="clear-search-btn"
        @click="$emit('searchClear')"
      >
        清除搜索
      </button>
    </div>

    <!-- Loading indicator at TOP (for loading older messages) -->
    <div
      v-if="loading && hasMore"
      class="loading-indicator loading-top"
    >
      <span class="loading-spinner">⏳</span>
      <span>載入中...</span>
    </div>

    <!-- Load more trigger at TOP (for loading older messages) - only show when scrolling up -->
    <Transition name="load-more-fade">
      <div
        v-if="hasMore && !loading && showLoadMoreTrigger"
        class="load-more-trigger load-more-top"
        @click="handleManualLoadMore"
      >
        <div class="load-more-content">
          <span class="load-more-icon">↑</span>
          <span>載入更早的訊息</span>
        </div>
      </div>
    </Transition>

    <!-- Virtual Content Container -->
    <div
      ref="listContainer"
      class="virtual-content"
      :class="{ updating: props.isUpdating }"
      :style="{
        height: `${virtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative'
      }"
    >
      <div
        v-for="virtualItem in virtualizer.getVirtualItems()"
        :key="String(virtualItem.key)"
        :ref="(el) => el && virtualizer.measureElement(el as Element)"
        :data-index="virtualItem.index"
        class="virtual-item"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          minHeight: `${virtualItem.size}px`,
          transform: `translateY(${virtualItem.start}px)`
        }"
      >
        <div
          :class="{
            'date-separator-item': virtualItems[virtualItem.index]?.type === 'date',
            'message-item': virtualItems[virtualItem.index]?.type === 'message'
          }"
        >
          <!-- Date Separator -->
          <DateSeparator
            v-if="virtualItems[virtualItem.index]?.type === 'date'"
            :date="virtualItems[virtualItem.index]?.data as Date"
          />

          <!-- Message with v-memo optimization and smooth entrance animation -->
          <Transition
            v-else-if="virtualItems[virtualItem.index]?.type === 'message'"
            name="message"
            mode="out-in"
            appear
          >
            <MessageBubble
              :key="(virtualItems[virtualItem.index]?.data as Message).id"
              :class="[
                'message-bubble-wrapper',
                props.animationClasses?.[(virtualItems[virtualItem.index]?.data as Message).id] || '',
                { 'message-new': isNewMessage((virtualItems[virtualItem.index]?.data as Message).id) }
              ]"
              :message="virtualItems[virtualItem.index]?.data as Message"
              :delivered="true"
              @copy="$emit('messageCopy', $event)"
              @reply="$emit('messageReply', $event)"
              @forward="$emit('messageForward', $event)"
              @recall="$emit('messageRecall', $event)"
              @select="$emit('messageSelect', $event)"
              @retry="handleRetry"
            />
          </Transition>

          <!-- Typing Indicator -->
          <div
            v-else-if="virtualItems[virtualItem.index]?.type === 'typing'"
            class="typing-indicator"
          >
            <div class="typing-dots">
              <span />
              <span />
              <span />
            </div>
            <span class="typing-text">對方正在輸入...</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading States with fixed height to prevent CLS -->
    <div
      v-if="loadingHistory && messages.length > 0"
      class="history-loading-wrapper"
      style="height: 60px; display: flex; align-items: center; justify-content: center;"
    >
      <div class="history-loading-content">
        <HamsterLoader message="載入更多歷史訊息..." />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import type { Message } from '@/types'
import MessageBubble from '@/components/conversation/MessageBubble.vue'
import DateSeparator from '@/components/conversation/DateSeparator.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'

interface VirtualItem {
  type: 'message' | 'date' | 'typing'
  data: Message | Date
  id: string
}


interface Props {
  messages: Message[]
  displayedMessages?: Message[]
  loading?: boolean           // General loading state
  hasMore?: boolean           // Has more messages to load
  loadingHistory?: boolean    // Loading historical messages
  showDateSeparators?: boolean
  isSearchActive?: boolean
  isUpdating?: boolean
  isTyping?: boolean
  typingUsers?: string[]      // Typing users from parent
  searchTerm?: string
  enableAnimations?: boolean
  scrollBehavior?: 'auto' | 'smooth'
  animationClasses?: Record<string, string>
  websocketEnabled?: boolean  // WebSocket connection status
  isHistoryPrepending?: boolean  // 🔧 FIX: 歷史消息正在前插
  historyPrependCount?: number   // 🔧 FIX: 前插的消息數量
}

const props = withDefaults(defineProps<Props>(), {
  displayedMessages: undefined,
  loading: false,
  hasMore: false,
  loadingHistory: false,
  showDateSeparators: true,
  isSearchActive: false,
  isUpdating: false,
  isTyping: false,
  typingUsers: () => [],
  searchTerm: '',
  enableAnimations: true,
  scrollBehavior: 'smooth',
  animationClasses: () => ({}),
  websocketEnabled: false,
  isHistoryPrepending: false,  // 🔧 FIX: 默認不是歷史前插
  historyPrependCount: 0       // 🔧 FIX: 默認前插數量為 0
})

const emit = defineEmits<{
  messageCopy: [message: Message]
  messageReply: [message: Message]
  messageForward: [message: Message]
  messageRecall: [message: Message]
  messageSelect: [message: Message]
  searchClear: []
  loadMore: []
  scroll: [scrollInfo: { scrollTop: number; scrollHeight: number; clientHeight: number }]
  scrollToTop: []
  scrollToBottom: []
  newMessageWhileScrolled: []
  retry: [messageId: string]  // Retry failed message
}>()

// Refs
const scrollContainer = ref<HTMLElement>()
const listContainer = ref<HTMLElement>()
const newMessageIds = ref(new Set<string>())
const isUserAtBottom = ref(true)
const lastScrollTop = ref(0)
const lastLoadMoreTime = ref(0)
const lastScrollDebugTime = ref(0)
const LOAD_MORE_THROTTLE_MS = 1000 // Prevent too frequent load requests
const isProgrammaticScrolling = ref(false) // Guard to prevent scroll events during programmatic scroll
const showLoadMoreTrigger = ref(false) // Only show load-more trigger when scrolling up

// 🔧 FIX: 滾動位置保持相關的狀態
const scrollPositionBeforePrepend = ref<{
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  wasAtBottom: boolean // 🔧 FIX: 記錄用戶在前插前是否在底部
  firstVisibleMessageId: string | null
} | null>(null)
const pendingScrollPreservation = ref(false) // 標記是否需要在下一次 DOM 更新後保持滾動位置

// 🔧 FIX: Debounce timers for load-more trigger visibility
let hideLoadMoreTimeout: ReturnType<typeof setTimeout> | null = null
let showLoadMoreTimeout: ReturnType<typeof setTimeout> | null = null

// 🔧 FIX: Constants for scroll detection
const SCROLL_DIRECTION_THRESHOLD = 10 // Minimum pixels to detect scroll direction change
const SHOW_LOAD_MORE_NEAR_TOP_THRESHOLD = 500 // Only show "load more" when within 500px of top
const SHOW_LOAD_MORE_DELAY_MS = 200 // Delay before showing load more trigger
const HIDE_LOAD_MORE_DELAY_MS = 400 // Delay before hiding load more trigger

// Computed
const displayedMessages = computed(() => {
  // Use provided displayedMessages if available, otherwise use messages
  if (props.displayedMessages) {
    return props.displayedMessages
  }

  if (props.isSearchActive && props.searchTerm) {
    return props.messages.filter(msg =>
      msg.content.toLowerCase().includes(props.searchTerm.toLowerCase())
    )
  }
  return props.messages
})

const virtualItems = computed<VirtualItem[]>(() => {
  const items: VirtualItem[] = []

  if (props.showDateSeparators) {
    let currentDate = ''

    displayedMessages.value.forEach((message) => {
      const messageDate = new Date(message.createdAt).toDateString()

      if (messageDate !== currentDate) {
        currentDate = messageDate
        items.push({
          type: 'date',
          data: new Date(message.createdAt),
          id: `date-${messageDate}`
        })
      }

      items.push({
        type: 'message',
        data: message,
        id: `message-${message.id}`
      })
    })
  } else {
    displayedMessages.value.forEach((message) => {
      items.push({
        type: 'message',
        data: message,
        id: `message-${message.id}`
      })
    })
  }

  return items
})

// Virtualizer setup
const virtualizer = useVirtualizer({
  get count() { return virtualItems.value.length },
  getScrollElement: () => scrollContainer.value || null,
  estimateSize: () => 100, // 🔧 FIX: Increased from 80 to 100 for file messages
  overscan: 5,
  measureElement: (element) => element?.getBoundingClientRect().height || 100,
})

// Methods
const scrollToMessage = async (messageId: string, retries = 3, delay = 100) => {
  const index = virtualItems.value.findIndex(item =>
    item.type === 'message' && (item.data as Message).id === messageId
  )

  if (index < 0 || !virtualizer.value) {
    return
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Wait for virtualizer to be ready
      await nextTick()

      const container = virtualizer.value.scrollElement
      if (container && virtualizer.value.options.count === virtualItems.value.length) {
        virtualizer.value.scrollToIndex(index, {
          align: 'center'
        })
        return // Success
      }
    } catch (error) {
      console.warn(`Scroll to message attempt ${attempt + 1} failed:`, error)
    }

    // Wait before retry
    if (attempt < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

const scrollToTop = async (retries = 5, delay = 150) => {
  if (!virtualizer.value || virtualItems.value.length === 0) {
    return
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Wait a tick for the virtualizer to process any pending updates
      await nextTick()

      // Check if virtualizer has the correct count and container element
      const container = virtualizer.value.scrollElement
      if (container && virtualizer.value.options.count === virtualItems.value.length) {
        // Use direct scroll for more reliable scrolling
        container.scrollTop = 0
        return // Success
      }
    } catch (error) {
      console.warn(`Scroll to top attempt ${attempt + 1} failed:`, error)
    }

    // Wait before retry with exponential backoff
    if (attempt < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)))
    }
  }

  // Final fallback: try scrollToIndex with a longer timeout
  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    if (virtualizer.value) {
      virtualizer.value.scrollToIndex(0, { align: 'start' })
    }
  } catch (error) {
    console.warn('Final scroll to top attempt failed:', error)
  }
}

const scrollToBottom = async (retries = 10, delay = 100) => {
  const lastIndex = virtualItems.value.length - 1
  if (lastIndex < 0 || !virtualizer.value) {
    console.log('🔽 [ScrollToBottom] Skipped - no items or virtualizer')
    return
  }

  console.log(`🔽 [ScrollToBottom] Starting scroll to bottom, items: ${virtualItems.value.length}`)

  // Set guard to prevent scroll events from triggering during programmatic scroll
  isProgrammaticScrolling.value = true

  // Helper: Wait for next animation frame for better DOM sync
  const waitForFrame = () => new Promise(resolve => window.requestAnimationFrame(resolve))

  // Helper: Check if virtualizer is ready (relaxed conditions)
  const isVirtualizerReady = (): boolean => {
    if (!virtualizer.value) {return false}
    const container = virtualizer.value.scrollElement
    if (!container) {return false}

    const totalSize = virtualizer.value.getTotalSize()
    // Relaxed condition: just need totalSize > 0 and container exists
    // Removed strict count comparison which caused race conditions
    return totalSize > 0
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Phase 1: Wait for DOM using RAF instead of fixed timeout
      await waitForFrame()
      await nextTick()

      // Phase 2: Check if virtualizer is ready
      if (isVirtualizerReady() && virtualizer.value?.scrollElement) {
        const container = virtualizer.value.scrollElement

        // Phase 3: Execute scroll - use scrollHeight for accurate positioning
        // getTotalSize() uses estimated sizes which can be inaccurate for items like file attachments
        // scrollHeight gives the actual rendered content height
        const actualScrollHeight = container.scrollHeight
        container.scrollTop = actualScrollHeight // This will be clamped to max scroll position

        console.log(`✅ [ScrollToBottom] Scrolled on attempt ${attempt + 1}, scrollHeight: ${actualScrollHeight}`)

        // Phase 4: Verification scroll after a short delay
        await new Promise(resolve => setTimeout(resolve, 50))
        await waitForFrame()

        // Double-check and fine-tune with scrollToIndex
        if (virtualizer.value && virtualItems.value.length > 0) {
          const finalIndex = virtualItems.value.length - 1
          virtualizer.value.scrollToIndex(finalIndex, { align: 'end' })
        }

        // Final verification: scroll again after content has fully rendered
        // File attachments and other dynamic content may change scrollHeight
        setTimeout(async () => {
          if (scrollContainer.value) {
            const finalScrollHeight = scrollContainer.value.scrollHeight
            scrollContainer.value.scrollTop = finalScrollHeight
            console.log(`🔽 [ScrollToBottom] Final verification scroll, scrollHeight: ${finalScrollHeight}`)
          }
        }, 150)

        // Clear guard after successful scroll
        setTimeout(() => {
          isProgrammaticScrolling.value = false
          isUserAtBottom.value = true // We just scrolled to bottom
          console.log('🔽 [ScrollToBottom] Success - guard cleared')
        }, 200)

        return // Success
      }
    } catch (error) {
      console.warn(`⚠️ [ScrollToBottom] Attempt ${attempt + 1} failed:`, error)
    }

    // Wait before retry with exponential backoff (capped at 500ms)
    if (attempt < retries - 1) {
      const waitTime = Math.min(delay * Math.pow(1.5, attempt), 500)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  // Final fallback: force scroll using multiple methods
  console.log('🔄 [ScrollToBottom] Using final fallback methods...')
  try {
    await new Promise(resolve => setTimeout(resolve, 200))

    if (virtualizer.value) {
      // Method 1: Direct scrollTop
      const container = virtualizer.value.scrollElement
      if (container) {
        container.scrollTop = container.scrollHeight
      }

      // Method 2: scrollToIndex
      await new Promise(resolve => setTimeout(resolve, 50))
      virtualizer.value.scrollToIndex(virtualItems.value.length - 1, { align: 'end' })
    }
  } catch (error) {
    console.warn('❌ [ScrollToBottom] Final fallback failed:', error)
  } finally {
    // Clear guard after final fallback completes
    setTimeout(() => {
      isProgrammaticScrolling.value = false
      isUserAtBottom.value = true // We just scrolled to bottom, so user is at bottom
      console.log('🔽 [ScrollToBottom] Guard cleared, isUserAtBottom set to true')
    }, 100)
  }
}

// Animation handling with smooth entrance
const isNewMessage = (messageId: string) => {
  return newMessageIds.value.has(messageId)
}

const addMessageAnimation = () => {
  // Mark new messages for animation
  const existingIds = new Set(props.messages.map(m => m.id))
  displayedMessages.value.forEach(msg => {
    if (!existingIds.has(msg.id)) {
      newMessageIds.value.add(msg.id)
      // Auto-remove after animation completes
      setTimeout(() => {
        newMessageIds.value.delete(msg.id)
      }, 500)
    }
  })
}

// Smart scroll management
const checkIfUserAtBottom = () => {
  if (!scrollContainer.value) {return true}
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value
  const threshold = 100 // pixels from bottom
  return scrollHeight - scrollTop - clientHeight < threshold
}

const checkIfUserAtTop = () => {
  if (!scrollContainer.value) {return false}
  const { scrollTop } = scrollContainer.value
  const threshold = 2500 // Increased threshold for virtual scrolling compatibility
  return scrollTop < threshold
}

const handleScroll = () => {
  if (!scrollContainer.value) {return}

  // Skip scroll handling during programmatic scrolling to prevent race conditions
  if (isProgrammaticScrolling.value) {
    console.log('🔒 [handleScroll] Skipped - programmatic scrolling in progress')
    return
  }

  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value

  // Update user position
  const isAtBottom = checkIfUserAtBottom()
  const isAtTop = checkIfUserAtTop()

  isUserAtBottom.value = isAtBottom

  // 🔧 FIX: Check scroll direction with threshold to avoid flickering from micro-movements
  const scrollDelta = lastScrollTop.value - scrollTop
  const isScrollingUp = scrollDelta > SCROLL_DIRECTION_THRESHOLD
  const isScrollingDown = scrollDelta < -SCROLL_DIRECTION_THRESHOLD
  const isNearTop = scrollTop < SHOW_LOAD_MORE_NEAR_TOP_THRESHOLD

  // 🔧 FIX: Only show load-more trigger when:
  // 1. Scrolling up significantly (not micro-movements)
  // 2. Near the top of the list
  // 3. Has more messages to load
  // 4. Not currently loading
  const shouldShowLoadMore = isScrollingUp && isNearTop && props.hasMore && !props.loading

  if (shouldShowLoadMore) {
    // Clear any pending hide timeout
    if (hideLoadMoreTimeout) {
      clearTimeout(hideLoadMoreTimeout)
      hideLoadMoreTimeout = null
    }
    // Show with debounce to prevent rapid flickering
    if (!showLoadMoreTimeout && !showLoadMoreTrigger.value) {
      showLoadMoreTimeout = setTimeout(() => {
        showLoadMoreTrigger.value = true
        showLoadMoreTimeout = null
      }, SHOW_LOAD_MORE_DELAY_MS)
    }
  } else if (isScrollingDown || !isNearTop) {
    // Clear any pending show timeout
    if (showLoadMoreTimeout) {
      clearTimeout(showLoadMoreTimeout)
      showLoadMoreTimeout = null
    }
    // Hide with debounce when scrolling down or moved away from top
    if (!hideLoadMoreTimeout && showLoadMoreTrigger.value) {
      hideLoadMoreTimeout = setTimeout(() => {
        showLoadMoreTrigger.value = false
        hideLoadMoreTimeout = null
      }, HIDE_LOAD_MORE_DELAY_MS)
    }
  }

  // Debug scroll state every few scrolls
  if (Date.now() - lastScrollDebugTime.value > 2000) { // Debug every 2 seconds
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

  // Load more historical messages when scrolling near top AND scrolling up
  if (isAtTop && !props.loadingHistory && !props.loading && props.hasMore && isScrollingUp) {
    // Throttle load-more requests to prevent spam
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

// Manual load more (click on button)
const handleManualLoadMore = () => {
  if (props.loading || !props.hasMore) {
    console.log('⚠️ [VirtualMessageList] Cannot load more:', { loading: props.loading, hasMore: props.hasMore })
    return
  }
  console.log('🔼 [VirtualMessageList] Manual load more triggered')

  // 🔧 FIX: Immediately hide the button after clicking to prevent repeated clicks
  showLoadMoreTrigger.value = false

  // Clear any pending timeouts
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

// Handle retry event from MessageBubble
const handleRetry = (messageId: string) => {
  console.log('🔄 [VirtualMessageList] Retry event received for message:', messageId)
  emit('retry', messageId)
}

// 🔧 FIX: Watch for history prepending to capture scroll position BEFORE DOM updates
watch(() => props.isHistoryPrepending, (isPrepending, wasPrepending) => {
  if (isPrepending && !wasPrepending && scrollContainer.value) {
    // 歷史前插開始 - 保存當前滾動位置
    const container = scrollContainer.value
    const { scrollTop, scrollHeight, clientHeight } = container

    // 🔧 FIX: 檢查用戶是否 "接近底部"（容差 200px，因為文件附件可能導致高度變化）
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    const wasAtBottom = distanceFromBottom < 200

    scrollPositionBeforePrepend.value = {
      scrollTop,
      scrollHeight,
      clientHeight,
      wasAtBottom, // 🔧 FIX: 記錄用戶是否在底部
      firstVisibleMessageId: null
    }
    pendingScrollPreservation.value = true
    console.log(`📌 [ScrollPreservation] Captured position before prepend: scrollTop=${scrollTop}, scrollHeight=${scrollHeight}, distanceFromBottom=${distanceFromBottom}, wasAtBottom=${wasAtBottom}`)
  }
})

// Watchers with smart scroll behavior - FIXED race condition
// Watch displayedMessages (not messages) because displayedMessages is what virtualItems uses
// This ensures we scroll AFTER the UI has actually updated
watch(() => displayedMessages.value.length, async (newCount, oldCount) => {
  console.log(`📨 [DisplayedMessageWatch] Displayed count changed: ${oldCount} → ${newCount}, virtualItems: ${virtualItems.value.length}`)

  if (oldCount !== undefined && newCount > oldCount) {
    // 🔧 FIX: Check if this is a history prepend operation
    const isHistoryPrepend = pendingScrollPreservation.value && scrollPositionBeforePrepend.value

    if (isHistoryPrepend) {
      // 🔧 FIX: 歷史前插 - 根據用戶之前的位置決定滾動行為
      const savedPosition = scrollPositionBeforePrepend.value
      const wasAtBottomBeforePrepend = savedPosition?.wasAtBottom ?? false

      console.log(`📌 [ScrollPreservation] History prepend detected, wasAtBottom: ${wasAtBottomBeforePrepend}`)

      // Set programmatic scrolling guard
      isProgrammaticScrolling.value = true

      await nextTick()
      await new Promise(resolve => window.requestAnimationFrame(resolve))

      if (scrollContainer.value && savedPosition) {
        const container = scrollContainer.value

        if (wasAtBottomBeforePrepend) {
          // 🔧 FIX: 用戶之前在底部 - 前插後滾動到底部
          console.log(`📌 [ScrollPreservation] User was at bottom, scrolling to bottom after prepend...`)

          // Clear the saved position first
          scrollPositionBeforePrepend.value = null
          pendingScrollPreservation.value = false

          // Clear guard temporarily to allow scrollToBottom to work
          isProgrammaticScrolling.value = false

          // Scroll to bottom
          await scrollToBottom()

          console.log(`📌 [ScrollPreservation] Scrolled to bottom after history prepend`)
          return // Don't proceed with normal scroll behavior
        } else {
          // 🔧 用戶在中間位置 - 保持相對滾動位置
          const newScrollHeight = container.scrollHeight
          const heightDifference = newScrollHeight - savedPosition.scrollHeight

          // Adjust scrollTop to maintain visual position
          const newScrollTop = savedPosition.scrollTop + heightDifference
          container.scrollTop = newScrollTop

          console.log(`📌 [ScrollPreservation] Adjusted scroll position (user was NOT at bottom):`)
          console.log(`   - Old scrollHeight: ${savedPosition.scrollHeight}, New scrollHeight: ${newScrollHeight}`)
          console.log(`   - Height difference: ${heightDifference}`)
          console.log(`   - Old scrollTop: ${savedPosition.scrollTop}, New scrollTop: ${newScrollTop}`)

          // Clear the saved position
          scrollPositionBeforePrepend.value = null
          pendingScrollPreservation.value = false

          // Clear guard after a short delay
          setTimeout(() => {
            isProgrammaticScrolling.value = false
            console.log(`📌 [ScrollPreservation] Guard cleared`)
          }, 100)
        }
      }

      return // Don't proceed with normal scroll behavior
    }

    // Check if user was at bottom before new messages
    const wasAtBottom = isUserAtBottom.value
    console.log(`📨 [DisplayedMessageWatch] New messages detected, wasAtBottom: ${wasAtBottom}`)

    await nextTick()
    addMessageAnimation()

    // Wait for RAF + multiple ticks to ensure virtualizer has FULLY updated
    await new Promise(resolve => window.requestAnimationFrame(resolve))
    await nextTick()
    await new Promise(resolve => window.requestAnimationFrame(resolve))

    // Extra wait to ensure virtualItems computed has recalculated
    await new Promise(resolve => setTimeout(resolve, 20))

    console.log(`📨 [DisplayedMessageWatch] After wait - virtualItems: ${virtualItems.value.length}`)

    // Only auto-scroll if user was already at bottom
    if (!props.isSearchActive && wasAtBottom) {
      console.log('📨 [DisplayedMessageWatch] Auto-scrolling to bottom...')
      await scrollToBottom()
    } else if (!wasAtBottom) {
      // Show new message notification to parent
      console.log('📨 [DisplayedMessageWatch] User not at bottom, showing notification')
      emit('newMessageWhileScrolled')
    }
  } else if (oldCount === undefined && newCount > 0) {
    // Initial load - always scroll to bottom
    console.log('📨 [DisplayedMessageWatch] Initial load detected, scrolling to bottom...')
    await nextTick()
    await new Promise(resolve => window.requestAnimationFrame(resolve))
    await scrollToBottom()
  }
})

// Lifecycle with scroll listener - OPTIMIZED: Single smart scroll
onMounted(async () => {
  console.log('🚀 [VirtualMessageList] Component mounted')
  await nextTick()

  // Wait for multiple animation frames to ensure DOM and virtualizer are ready
  await new Promise(resolve => window.requestAnimationFrame(resolve))
  await nextTick()
  await new Promise(resolve => window.requestAnimationFrame(resolve))

  // Add scroll listener for smart scroll management (do this first)
  if (scrollContainer.value) {
    scrollContainer.value.addEventListener('scroll', handleScroll, { passive: true })
  }

  // Now scroll to bottom if we have messages
  if (!props.isSearchActive && displayedMessages.value.length > 0) {
    console.log(`🚀 [VirtualMessageList] Initial scroll to bottom with ${displayedMessages.value.length} messages`)

    // 🔧 OPTIMIZED: Wait for scrollHeight to stabilize before scrolling (single scroll)
    // This replaces the previous two-scroll approach
    await waitForStableScrollHeight()
    await scrollToBottom()
    console.log('🚀 [VirtualMessageList] Single optimized scroll complete')
  }
})

/**
 * 🔧 OPTIMIZED: Wait for scrollHeight to stabilize before scrolling
 * This ensures virtual list has fully rendered before we scroll
 * Replaces the old approach of scrolling twice
 */
const waitForStableScrollHeight = async (maxWaitMs = 500, checkIntervalMs = 50): Promise<void> => {
  if (!scrollContainer.value) return

  let lastScrollHeight = scrollContainer.value.scrollHeight
  let stableCount = 0
  const requiredStableChecks = 2 // Need 2 consecutive stable readings
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs))
    await new Promise(resolve => window.requestAnimationFrame(resolve))

    if (!scrollContainer.value) return

    const currentScrollHeight = scrollContainer.value.scrollHeight

    if (currentScrollHeight === lastScrollHeight) {
      stableCount++
      if (stableCount >= requiredStableChecks) {
        console.log(`📏 [ScrollHeight] Stabilized at ${currentScrollHeight}px after ${Date.now() - startTime}ms`)
        return
      }
    } else {
      stableCount = 0
      console.log(`📏 [ScrollHeight] Changed: ${lastScrollHeight} → ${currentScrollHeight}`)
      lastScrollHeight = currentScrollHeight
    }
  }

  console.log(`📏 [ScrollHeight] Timeout after ${maxWaitMs}ms, proceeding with current height: ${lastScrollHeight}`)
}

onUnmounted(() => {
  if (scrollContainer.value) {
    scrollContainer.value.removeEventListener('scroll', handleScroll)
  }
  // 🔧 FIX: Clean up all timeouts
  if (hideLoadMoreTimeout) {
    clearTimeout(hideLoadMoreTimeout)
    hideLoadMoreTimeout = null
  }
  if (showLoadMoreTimeout) {
    clearTimeout(showLoadMoreTimeout)
    showLoadMoreTimeout = null
  }
})

// Expose methods
defineExpose({
  scrollToMessage,
  scrollToTop,
  scrollToBottom
})
</script>

<style scoped>
/* 🎨 Spacious, Minimal Container Design */
.virtual-message-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  /* Extra padding for spacious feel */
  padding: 0.5rem 0;

  /* Modern, subtle scrollbar */
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
}

.virtual-message-list::-webkit-scrollbar {
  width: 6px;
}

.virtual-message-list::-webkit-scrollbar-track {
  background: transparent;
}

.virtual-message-list::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
  transition: background 0.2s;
}

.virtual-message-list::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Clean Search Header */
.search-results-header {
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
  position: sticky;
  top: 0;
  z-index: 10;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.clear-search-btn {
  background: transparent;
  color: #3b82f6;
  border: 1px solid #dbeafe;
  padding: 0.375rem 1rem;
  border-radius: 2rem;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.clear-search-btn:hover {
  background: #eff6ff;
  border-color: #93c5fd;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

/* 🔼 載入指示器（頂部） */
.loading-indicator {
  text-align: center;
  padding: 1rem;
  color: var(--text-secondary, #64748b);
}

.loading-top {
  position: sticky;
  top: 0;
  background: linear-gradient(to bottom, rgba(255,255,255,0.98), rgba(255,255,255,0.95));
  backdrop-filter: blur(8px);
  z-index: 10;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 🔼 載入更多按鈕（頂部） */
.load-more-trigger {
  text-align: center;
  padding: 1rem;
  cursor: pointer;
  color: var(--primary-color, #3b82f6);
  transition: all 0.2s;
}

.load-more-top {
  position: sticky;
  top: 0;
  background: linear-gradient(to bottom, rgba(59, 130, 246, 0.05), rgba(59, 130, 246, 0.02));
  backdrop-filter: blur(4px);
  z-index: 10;
  border-bottom: 2px solid var(--primary-color, #3b82f6);
  margin-bottom: 0.5rem;
}

.load-more-top:hover {
  background: linear-gradient(to bottom, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05));
  border-bottom-color: var(--primary-color, #3b82f6);
}

/* Load more trigger fade transition */
.load-more-fade-enter-active,
.load-more-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.load-more-fade-enter-from,
.load-more-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.load-more-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 500;
}

.load-more-icon {
  font-size: 1.2rem;
  animation: bounce-up 1.5s ease-in-out infinite;
}

@keyframes bounce-up {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* Smooth Scrollable Container */
/* Virtual Content Container - No longer scrollable, just content */
.virtual-content {
  position: relative;
  contain: layout style paint;
  flex-shrink: 0; /* Don't shrink this container */
}

.virtual-content.updating {
  pointer-events: none;
  opacity: 0.98;
}

/* Optimized Virtual Items */
.virtual-item {
  contain: layout style paint;
  will-change: transform;
  transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Elegant Date Separator */
.date-separator-item {
  display: flex;
  justify-content: center;
  padding: 1.25rem 0;
  position: sticky;
  top: 0;
  z-index: 5;
  background: linear-gradient(to bottom,
    rgba(250, 251, 252, 0.95) 0%,
    rgba(250, 251, 252, 0.8) 50%,
    transparent 100%);
  backdrop-filter: blur(8px);
}

/* 🎨 Spacious Message Item Container */
.message-item {
  padding: 0.375rem 1rem;
  display: flex;
  flex-direction: column;
  position: relative;
  /* More breathing room between messages */
  margin: 0.125rem 0;
}

/* Modern Typing Indicator */
.typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1.5rem;
  margin: 0.5rem 1.5rem;
  background: rgba(248, 250, 252, 0.8);
  border-radius: 1.5rem;
  width: fit-content;
  backdrop-filter: blur(8px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.typing-dots {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  background: linear-gradient(135deg, #64748b, #94a3b8);
  border-radius: 50%;
  animation: typing-pulse 1.5s infinite cubic-bezier(0.4, 0, 0.6, 1);
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

.typing-text {
  font-size: 0.8125rem;
  color: #64748b;
  font-weight: 400;
  letter-spacing: 0.01em;
}

@keyframes typing-pulse {
  0%, 60%, 100% {
    transform: scale(1);
    opacity: 0.3;
  }
  30% {
    transform: scale(1.3);
    opacity: 1;
  }
}

/* Smooth Message Animations */
.message-bubble-wrapper {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: center;
}

/* Elegant Entrance Animations */
.message-enter-from,
.message-appear-from {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}

.message-enter-active,
.message-appear-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.message-enter-to,
.message-appear-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Subtle Leave Animation */
.message-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.message-leave-active {
  transition: all 0.15s cubic-bezier(0.4, 0, 1, 1);
  position: absolute;
  width: 100%;
}

.message-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

/* New Message Animation */
.message-new {
  animation: messageSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Smooth Loading Animation */
.message-fade-in {
  animation: smoothFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes smoothFadeIn {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Clean Loading State */
.history-loading-wrapper {
  position: sticky;
  top: 0;
  z-index: 15;
  background: linear-gradient(to bottom,
    rgba(255, 255, 255, 0.98) 0%,
    rgba(255, 255, 255, 0.9) 100%);
  backdrop-filter: blur(16px);
}

.history-loading-content {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  font-size: 0.8125rem;
  color: #64748b;
  font-weight: 500;
}

/* Responsive Design - Mobile First */
@media (max-width: 768px) {
  .virtual-message-list {
    background: #ffffff;
  }

  .message-item {
    padding: 0.375rem 1rem;
  }

  .date-separator-item {
    padding: 1rem 0;
  }

  .search-results-header {
    padding: 0.875rem 1rem;
    font-size: 0.8125rem;
  }

  .clear-search-btn {
    padding: 0.3125rem 0.875rem;
    font-size: 0.75rem;
  }

  .typing-indicator {
    margin: 0.375rem 1rem;
    padding: 0.75rem 1.25rem;
  }

  .virtual-message-list::-webkit-scrollbar {
    width: 4px;
  }
}

/* Tablet Adjustments */
@media (min-width: 769px) and (max-width: 1024px) {
  .message-item {
    padding: 0.5rem 1.25rem;
  }
}

/* Large Screens */
@media (min-width: 1440px) {
  .message-item {
    padding: 0.625rem 2rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  .date-separator-item {
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  .typing-indicator {
    margin: 0.5rem 2rem;
  }
}

/* Accessibility & Performance */
@media (prefers-reduced-motion: reduce) {
  .message-enter-from,
  .message-enter-active,
  .message-appear-from,
  .message-appear-active,
  .message-leave-from,
  .message-leave-active,
  .message-bubble-wrapper,
  .message-new,
  .message-fade-in {
    animation: none !important;
    transition: opacity 0.15s ease !important;
  }

  .typing-dots span {
    animation: none;
    opacity: 0.6;
  }

  .virtual-message-list {
    scroll-behavior: auto;
  }
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .search-results-header {
    border-bottom: 2px solid currentColor;
  }

  .clear-search-btn {
    border-width: 2px;
  }

  .typing-indicator {
    border: 1px solid currentColor;
  }
}

/* Dark Mode Support (Future Enhancement) */
@media (prefers-color-scheme: dark) {
  .virtual-message-list {
    background: linear-gradient(to bottom, #0f172a 0%, #1e293b 100%);
  }

  .search-results-header {
    background: rgba(15, 23, 42, 0.95);
    border-bottom-color: rgba(255, 255, 255, 0.06);
    color: #94a3b8;
  }

  .typing-indicator {
    background: rgba(30, 41, 59, 0.8);
    color: #94a3b8;
  }

  .virtual-message-list::-webkit-scrollbar-thumb {
    background: #475569;
  }

  .virtual-message-list::-webkit-scrollbar-thumb:hover {
    background: #64748b;
  }
}
</style>
