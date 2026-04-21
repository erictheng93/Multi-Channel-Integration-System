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
      <span class="loading-spinner" />
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
import { createLogger } from '@/utils/logger'

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
  isHistoryPrepending: false,
  historyPrependCount: 0
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
  retry: [messageId: string]
  initialScrollComplete: []
}>()
const frontendLogger = createLogger('VirtualMessageList')
import { ref } from 'vue'
import type { Message } from '@/types'
import MessageBubble from '@/components/conversation/MessageBubble.vue'
import DateSeparator from '@/components/conversation/DateSeparator.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import { useVirtualList } from '@/composables/message/useVirtualList'
import { useVirtualScroll } from '@/composables/message/useVirtualScroll'
import { useScrollEventHandlers } from '@/composables/message/useScrollEventHandlers'
import { useResizeObserver } from '@/composables/message/useResizeObserver'
import { useScrollWatchers } from '@/composables/message/useScrollWatchers'

interface Props {
  messages: Message[]
  displayedMessages?: Message[]
  loading?: boolean // General loading state
  hasMore?: boolean // Has more messages to load
  loadingHistory?: boolean // Loading historical messages
  showDateSeparators?: boolean
  isSearchActive?: boolean
  isUpdating?: boolean
  isTyping?: boolean
  typingUsers?: string[] // Typing users from parent
  searchTerm?: string
  enableAnimations?: boolean
  scrollBehavior?: 'auto' | 'smooth'
  animationClasses?: Record<string, string>
  websocketEnabled?: boolean  // WebSocket connection status
  isHistoryPrepending?: boolean
  historyPrependCount?: number
}

// Template refs
const scrollContainer = ref<HTMLElement>()
const listContainer = ref<HTMLElement>()

// Emit wrapper that matches the composable's expected signature
const emitWrapper = (event: string, ...args: unknown[]) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (emit as any)(event, ...args)
}

// 1. Virtual List (virtualizer, displayedMessages, virtualItems)
const {
  displayedMessages,
  virtualItems,
  virtualizer,
} = useVirtualList({
  props,
  scrollContainer,
})

// 2. Virtual Scroll (scroll-to operations, position checks, grace period)
const {
  isUserAtBottom,
  isProgrammaticScrolling,
  isInitialScrollDone,
  recentlyScrolledToBottom,
  scrollToMessageByIndex,
  scrollToTop,
  scrollToBottom,
  checkIfUserAtBottom,
  checkIfUserAtTop,
  waitForStableScrollHeight,
  cleanupGracePeriod,
} = useVirtualScroll({
  scrollContainer,
  virtualizer,
  virtualItemsLength: () => virtualItems.value.length,
})

// 3. Scroll Event Handlers (handleScroll, handleManualLoadMore)
const {
  showLoadMoreTrigger,
  handleScroll,
  handleManualLoadMore,
  cleanupTimeouts,
} = useScrollEventHandlers({
  props,
  scrollContainer,
  isProgrammaticScrolling,
  isUserAtBottom,
  recentlyScrolledToBottom,
  checkIfUserAtBottom,
  checkIfUserAtTop,
  emit: emitWrapper,
})

// 4. Resize Observer (content height change compensation)
const {
  setupContentResizeObserver,
  cleanupContentResizeObserver,
} = useResizeObserver({
  scrollContainer,
  listContainer,
  isUserAtBottom,
  recentlyScrolledToBottom,
})

// 5. Scroll Watchers (lifecycle, watch handlers, animations)
const {
  isNewMessage,
} = useScrollWatchers({
  props,
  scrollContainer,
  displayedMessages,
  virtualItemsLength: () => virtualItems.value.length,
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
  emit: emitWrapper,
})

// Wire up scrollToMessage with virtualItems index lookup
const scrollToMessage = async (messageId: string, retries = 3, delay = 100) => {
  const index = virtualItems.value.findIndex(item =>
    item.type === 'message' && (item.data as Message).id === messageId
  )
  if (index < 0) { return }
  await scrollToMessageByIndex(index, retries, delay)
}

// Handle retry event from MessageBubble
const handleRetry = (messageId: string) => {
  frontendLogger.debug('[VirtualMessageList] Retry event received for message:', messageId)
  emit('retry', messageId)
}

// Expose methods and template refs
defineExpose({
  scrollToMessage,
  scrollToTop,
  scrollToBottom,
  // Template refs (exposed to satisfy TypeScript noUnusedLocals)
  listContainer
})
</script>

<style scoped>
/* Spacious, Minimal Container Design */
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

/* 載入指示器（頂部） */
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

/* 載入更多按鈕（頂部） */
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

/* Spacious Message Item Container */
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
